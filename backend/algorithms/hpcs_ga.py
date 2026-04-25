"""
Author : Om Kokate
HPCS-GA: Hybrid Priority-Constrained Scheduling with Genetic Adaptation
Full 4-phase implementation.

Phase 1 — Dynamic Priority Scoring  (non-linear + exponential aging)
Phase 2 — Cost Matrix Construction  (hard / soft constraints)
Phase 3 — Hungarian Algorithm       (optimal per-batch assignment)
Phase 4 — Genetic Weight Tuning     (tournament select, crossover, Gaussian mutation)
"""
import math
import random
import numpy as np
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from scipy.optimize import linear_sum_assignment
from .models import Case, Courtroom
from .time_utils import derive_reference_date

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
INF = 1e9
WEIGHT_BOUNDS = (0.1, 10.0)   # GA search space for each weight
GA_SIGMA      = 0.1            # Gaussian mutation std-dev
GA_LAMBDA     = 5.0            # Violation penalty in fitness function
GA_SAMPLE_CAP = 150            # Max cases used for GA fitness evaluation (speed)


class HPCS_GA:
    """
    Hybrid Priority-Constrained Scheduling with Genetic Adaptation.

    Usage
    -----
    scheduler = HPCS_GA(use_ga=True, ga_generations=25, ga_pop_size=40)
    assignments = scheduler.assign(cases, rooms)

    Parameters
    ----------
    use_ga          : bool   — Run GA weight tuning before scheduling (default True).
                               Set False for reproducible/fast benchmarks.
    ga_generations  : int    — Number of GA generations (default 25).
    ga_pop_size     : int    — Population size per generation (default 40).
    cases_per_day_per_room : int — Hearing slots per room per day (default 2).
    """

    def __init__(
        self,
        use_ga: bool = True,
        ga_generations: int = 25,
        ga_pop_size: int = 40,
        cases_per_day_per_room: int = 2,
        reference_time: Optional[datetime] = None,
    ):
        # ── Priority-score weights (Phase 1, evolved by Phase 4) ──────────
        self.alpha   = 2.5   # severity  (S^1.5)
        self.beta    = 3.0   # urgency × aging  (U · e^(A/τ))
        self.gamma   = 1.2   # complexity  (K)
        self.delta   = 4.0   # deadline pressure  (1 / D)
        self.epsilon = 1.5   # public interest  (I)
        self.tau     = 30    # aging time-constant in days

        # ── Cost-matrix weights (Phase 2) ─────────────────────────────────
        self.w1 = 1.0   # expertise-match score  (lower = better)
        self.w2 = 0.5   # normalised courtroom load
        self.w3 = 0.2   # setup-time estimate
        self.w4 = 1.0   # priority-score reward  (subtracted — higher P = cheaper)

        # ── GA hyper-parameters ───────────────────────────────────────────
        self.use_ga          = use_ga
        self.ga_generations  = ga_generations
        self.ga_pop_size     = ga_pop_size
        self.reference_time  = reference_time

        self.cases_per_day_per_room = cases_per_day_per_room

    def _get_reference_time(self, cases: Optional[List[Case]] = None) -> datetime:
        if self.reference_time is not None:
            return self.reference_time
        if cases is not None:
            self.reference_time = derive_reference_date(cases)
            return self.reference_time
        return datetime.now()

    # =========================================================================
    # PHASE 1 — Dynamic Priority Score
    # =========================================================================
    # def priority_score(
    #     self,
    #     case: Case,
    #     weights: Optional[Tuple[float, ...]] = None,
    # ) -> float:
    #     """
    #     P(c) = α·S^1.5 + β·U·e^(A/τ) + γ·K + δ·(1/D) + ε·I

    #     Parameters
    #     ----------
    #     case    : Case   — The case to score.
    #     weights : tuple  — (α, β, γ, δ, ε).  Uses instance weights if None.
    #     """
    #     if weights is None:
    #         α, β, γ, δ, ε = (
    #             self.alpha, self.beta, self.gamma, self.delta, self.epsilon
    #         )
    #     else:
    #         α, β, γ, δ, ε = weights

    #     now          = datetime.now()
    #     age          = max(0, (now - case.filed_date).days)
    #     deadline_days = max(1, (case.deadline - now).days)

    #     score = (
    #         α * (case.severity ** 1.5) +
    #         β * case.urgency * math.exp(age / self.tau) +
    #         γ * case.complexity +
    #         δ * (1.0 / deadline_days) +          # spec: δ · (1/Di)
    #         ε * case.public_interest
    #     )
    #     return round(score, 4)
    # =========================================================================
# PHASE 1 — Dynamic Priority Score (FIXED)
# =========================================================================
    def priority_score(
        self,
        case: Case,
        weights: Optional[Tuple[float, ...]] = None,
    ) -> float:
        """
        P(c) = α·S² + β·U·log(1+A) + γ·K + δ·(100/D) + ε·I
        
        FIXES:
        - severity² instead of S^1.5 → wider range (1-100)
        - log(1+A) instead of e^(A/τ) → bounded growth (no explosion)
        - 100/D instead of 1/D → meaningful deadline pressure
        """
        if weights is None:
            α, β, γ, δ, ε = (
                self.alpha, self.beta, self.gamma, self.delta, self.epsilon
            )
        else:
            α, β, γ, δ, ε = weights

        now           = self._get_reference_time()
        age           = max(0, (now - case.filed_date).days)
        deadline_days = max(1, (case.deadline - now).days)

        score = (
            α * (case.severity ** 2) +                    # FIX: ² instead of 1.5
            β * case.urgency * math.log(1 + age) +        # FIX: log instead of exp
            γ * case.complexity +
            δ * (100.0 / deadline_days) +                 # FIX: ×100 for impact
            ε * case.public_interest
        )
        return round(score, 4)
    # =========================================================================
    # PHASE 2 — Cost Matrix Construction
    # =========================================================================
    def build_cost_matrix(
        self,
        cases: List[Case],
        rooms: List[Courtroom],
        room_loads: Dict[str, int],
    ) -> np.ndarray:
        """
        Build an n×m cost matrix C where:

            C[i][j] = ∞                                  (expertise hard-constraint violated)
                    = w1·Eij + w2·Lj + w3·Tij - w4·P(ci)  (otherwise)

        Components
        ----------
        Eij  Expertise-match penalty — 0 if room is specialised to this case type,
             0.5 if the room has broader expertise (less optimal match).
        Lj   Normalised courtroom load — discourages piling onto already-busy rooms.
        Tij  Setup-time estimate — proportional to case complexity / 10.
        P(ci) Priority-score *reward* (subtracted so high-priority = cheaper cell).

        Returns
        -------
        np.ndarray of shape (n_cases, n_rooms).
        """
        n = len(cases)
        m = len(rooms)
        C = np.full((n, m), INF)

        max_load = max(room_loads.values(), default=1) or 1

        for i, case in enumerate(cases):
            p = self.priority_score(case)
            for j, room in enumerate(rooms):
                # ── Hard constraint: expertise must match ──────────────────
                if case.required_expertise not in room.judge_expertise:
                    continue
                if not room.available:
                    continue

                # Eij: specialised room (single expertise) is preferred
                Eij = 0.0 if room.judge_expertise == [case.required_expertise] else 0.5

                # Lj: normalised load [0, 1]
                Lj = room_loads.get(room.id, 0) / max_load

                # Tij: setup time proportional to complexity
                Tij = case.complexity / 10.0

                C[i][j] = self.w1 * Eij + self.w2 * Lj + self.w3 * Tij - self.w4 * p

        return C

    # =========================================================================
    # PHASE 3 — Hungarian Algorithm (batch-level optimal assignment)
    # =========================================================================
    def _hungarian_batch(
        self,
        batch: List[Case],
        rooms: List[Courtroom],
        room_loads: Dict[str, int],
    ) -> List[Tuple[Case, Courtroom]]:
        """
        Solve the assignment problem for one daily batch.

        When len(batch) > len(rooms) (more cases than rooms), each room can
        be assigned up to `cases_per_day_per_room` cases.  We tile the cost
        matrix columns so that the Hungarian solver sees enough "slots".

        Returns
        -------
        List of (case, room) pairs — optimal under the cost matrix.
        """
        if not batch or not rooms:
            return []

        C_full = self.build_cost_matrix(batch, rooms, room_loads)
        n, m   = C_full.shape

        # Drop rows that have no feasible room (all INF → expertise gap)
        feasible_rows = [i for i in range(n) if not np.all(C_full[i] == INF)]
        if not feasible_rows:
            return []

        C = C_full[feasible_rows, :]  # shape: (n_feasible, m)

        # ── Tile columns so each room appears `slots_per_room` times ──────
        slots_per_room = self.cases_per_day_per_room
        C_tiled = np.tile(C, slots_per_room)          # (n_feasible, m × slots)

        # Clip to at most n_feasible columns (no point in extra dummy cols)
        max_cols = len(feasible_rows)
        C_tiled  = C_tiled[:, :max_cols]

        # Replace remaining INF with a large finite value so scipy doesn't
        # choke on NaN-like behaviour in the optimiser
        C_tiled = np.where(C_tiled >= INF, INF / 2, C_tiled)

        row_idx, col_idx = linear_sum_assignment(C_tiled)

        results: List[Tuple[Case, Courtroom]] = []
        for r, c in zip(row_idx, col_idx):
            room_idx = c % m                          # map tiled col → real room
            orig_case_idx = feasible_rows[r]
            if C_full[orig_case_idx, room_idx] >= INF:
                continue                              # infeasible slot — skip
            results.append((batch[orig_case_idx], rooms[room_idx]))

        return results

    # =========================================================================
    # PHASE 4 — Genetic Algorithm Weight Tuning
    # =========================================================================
    def _ga_fitness(
        self,
        weights: Tuple[float, ...],
        cases: List[Case],
        rooms: List[Courtroom],
    ) -> float:
        """
        Fitness = 1 / (1 + avg_wait + λ·violations)

        Uses a fast greedy simulation (no Hungarian) so GA can iterate quickly.
        """
        sorted_cases   = sorted(cases, key=lambda c: -self.priority_score(c, weights))
        room_loads     = {r.id: 0 for r in rooms}
        cases_per_day  = len(rooms) * self.cases_per_day_per_room
        now            = self._get_reference_time()

        total_wait = 0
        violations = 0

        for pos, case in enumerate(sorted_cases):
            candidates = [
                r for r in rooms
                if case.required_expertise in r.judge_expertise and r.available
            ]
            if not candidates:
                continue

            hearing_day      = pos // cases_per_day
            days_to_deadline = (case.deadline - now).days
            total_wait      += hearing_day

            if hearing_day > days_to_deadline:
                violations += 1

            best = min(candidates, key=lambda r: room_loads.get(r.id, 0))
            room_loads[best.id] += 1

        n         = len(sorted_cases) or 1
        avg_wait  = total_wait / n
        return 1.0 / (1.0 + avg_wait + GA_LAMBDA * violations)

    def _run_ga(
        self,
        cases: List[Case],
        rooms: List[Courtroom],
    ) -> Tuple[float, ...]:
        """
        Evolve weight vector (α, β, γ, δ, ε) using:
          - Tournament selection  (k = 3)
          - Single-point crossover
          - Gaussian mutation     (σ = GA_SIGMA)
          - Elitism               (best chromosome always survives)

        Returns best weights found.
        """
        POP  = self.ga_pop_size
        GENS = self.ga_generations

        # Sample a subset of cases to keep GA evaluation fast
        sample = random.sample(cases, min(GA_SAMPLE_CAP, len(cases)))

        # ── Initialise population ─────────────────────────────────────────
        def rand_chrom() -> Tuple[float, ...]:
            return tuple(random.uniform(0.5, 5.0) for _ in range(5))

        population: List[Tuple[float, ...]] = [rand_chrom() for _ in range(POP)]

        best_weights = max(population, key=lambda w: self._ga_fitness(w, sample, rooms))
        best_fitness = self._ga_fitness(best_weights, sample, rooms)

        for _ in range(GENS):
            fitnesses = [self._ga_fitness(ch, sample, rooms) for ch in population]

            # Update global best
            gen_best_idx = max(range(POP), key=lambda i: fitnesses[i])
            if fitnesses[gen_best_idx] > best_fitness:
                best_fitness = fitnesses[gen_best_idx]
                best_weights = population[gen_best_idx]

            # ── Build next generation ──────────────────────────────────────
            new_pop: List[Tuple[float, ...]] = [best_weights]  # elitism

            def tournament() -> Tuple[float, ...]:
                idxs = random.sample(range(POP), 3)
                return population[max(idxs, key=lambda i: fitnesses[i])]

            while len(new_pop) < POP:
                p1 = tournament()
                p2 = tournament()

                # Single-point crossover
                pt    = random.randint(1, 4)
                child = p1[:pt] + p2[pt:]

                # Gaussian mutation
                child = tuple(
                    max(WEIGHT_BOUNDS[0], min(WEIGHT_BOUNDS[1],
                        w + random.gauss(0, GA_SIGMA)))
                    for w in child
                )
                new_pop.append(child)

            population = new_pop

        return best_weights

    # =========================================================================
    # PUBLIC — assign()
    # =========================================================================
    def assign(self, cases: List[Case], rooms: List[Courtroom]) -> List[Dict]:
        """
        Schedule all cases across all rooms.

        Execution order
        ---------------
        1. (Optional) Run GA to tune (α, β, γ, δ, ε)      [Phase 4]
        2. Compute priority scores, sort descending         [Phase 1]
        3. Process daily batches:
           a. Build cost matrix for this batch              [Phase 2]
           b. Solve with Hungarian algorithm                [Phase 3]
           c. Emit assignment records

        Returns
        -------
        List of dicts, each containing:
            case_id, case_type, courtroom_id, courtroom_name,
            judge, priority_score, position, hearing_day
        """
        if not cases or not rooms:
            return []

        self._get_reference_time(cases)

        # ── Phase 4: GA weight optimisation ───────────────────────────────
        if self.use_ga:
            best = self._run_ga(cases, rooms)
            self.alpha, self.beta, self.gamma, self.delta, self.epsilon = best

        # ── Phase 1: Priority-ranked ordering ─────────────────────────────
        sorted_cases = sorted(cases, key=lambda c: -self.priority_score(c))

        # ── Phases 2 & 3: Batch-level Hungarian assignment ────────────────
        cases_per_day = len(rooms) * self.cases_per_day_per_room
        room_loads    = {r.id: 0 for r in rooms}
        assignments   = []
        position      = 0

        for day, batch_start in enumerate(range(0, len(sorted_cases), cases_per_day)):
            batch = sorted_cases[batch_start : batch_start + cases_per_day]

            batch_pairs = self._hungarian_batch(batch, rooms, room_loads)

            for case, room in batch_pairs:
                assignments.append({
                    'case_id':        case.id,
                    'case_type':      case.case_type,
                    'courtroom_id':   room.id,
                    'courtroom_name': room.name,
                    'judge':          room.judge_name,
                    'priority_score': self.priority_score(case),
                    'position':       position,
                    'hearing_day':    day,
                })
                room_loads[room.id] += 1
                position += 1

        return assignments