"""
Benchmark — FIXED simulation
Key fix: Make courtroom load match deadline distribution
so order within a day MATTERS for violations.
"""
import random
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from .models import Case, Courtroom
from .hpcs_ga import HPCS_GA
from .baseline import FCFS, OriginalWeighted, SJF
from .time_utils import derive_reference_date

CASE_TYPES = ['criminal', 'civil', 'family', 'corporate']


def generate_cases(n: int = 200, seed: int = 42) -> List[Case]:
    """
    Generate cases with TIGHT deadlines to make scheduling matter.
    Many cases have deadlines BEFORE they can possibly be heard.
    """
    random.seed(seed)
    cases = []
    for i in range(n):
        ct = random.choice(CASE_TYPES)
        filed = datetime.now() - timedelta(days=random.randint(0, 30))
        
        # KEY: Most cases have TIGHT deadlines to differentiate algorithms
        category = random.choices(
            ['critical', 'urgent', 'medium', 'relaxed'], 
            weights=[0.25, 0.35, 0.25, 0.15]  # 60% are urgent/critical
        )[0]
        
        if category == 'critical':
            deadline_days = random.randint(1, 5)      # MUST be done immediately
        elif category == 'urgent':
            deadline_days = random.randint(6, 15)
        elif category == 'medium':
            deadline_days = random.randint(16, 40)
        else:
            deadline_days = random.randint(41, 90)
        
        deadline = datetime.now() + timedelta(days=deadline_days)
        
        cases.append(Case(
            id=f"CASE-{1000+i}",
            case_type=ct,
            severity=random.randint(1, 10),
            urgency=random.randint(1, 10),
            complexity=random.randint(1, 10),
            filed_date=filed,
            deadline=deadline,
            required_expertise=ct,
            public_interest=random.randint(0, 10),
            estimated_duration=random.randint(1, 6),
            plaintiff=f"Plaintiff-{i}",
            defendant=f"Defendant-{i}"
        ))
    return cases


def generate_rooms(n: int = 5, seed: int = 42) -> List[Courtroom]:
    """FEWER rooms = OVERLOADED system = scheduling matters"""
    random.seed(seed)
    rooms = []
    for i in range(n):
        # Each room handles MULTIPLE case types (so all cases CAN be assigned)
        expertise = random.sample(CASE_TYPES, k=random.randint(2, 3))
        rooms.append(Courtroom(
            id=f"CR-{i+1}",
            name=f"Courtroom {i+1}",
            judge_name=f"Hon. Judge {chr(65 + i % 26)}",
            judge_expertise=expertise,
            capacity=random.randint(20, 100)
        ))
    return rooms


def evaluate(algo_name: str, assignments: List[Dict], 
             all_cases: List[Case], num_rooms: int,
             reference_time: Optional[datetime] = None) -> Dict:
    if not assignments:
        return _empty_result(algo_name)

    now = reference_time or derive_reference_date(all_cases)
    
    case_dict = {c.id: c for c in all_cases}
    
    total_hearing_wait = 0
    total_full_wait = 0
    violations = 0
    starvation = 0
    severity_weighted_wait = 0
    urgent_violations = 0
    urgent_total = 0
    critical_violations = 0   # NEW: deadline ≤ 5 days
    critical_total = 0
    
    for a in assignments:
        case = case_dict[a['case_id']]
        hearing_day = a['hearing_day']
        
        current_age = max(0, (now - case.filed_date).days)
        days_to_deadline = (case.deadline - now).days
        full_wait = current_age + hearing_day
        
        total_hearing_wait += hearing_day
        total_full_wait += full_wait
        severity_weighted_wait += hearing_day * case.severity
        
        # Deadline violation
        if hearing_day > days_to_deadline:
            violations += 1
            if days_to_deadline <= 14:
                urgent_violations += 1
            if days_to_deadline <= 5:
                critical_violations += 1
        
        if days_to_deadline <= 14:
            urgent_total += 1
        if days_to_deadline <= 5:
            critical_total += 1
        
        if full_wait > 60:
            starvation += 1
    
    n = len(assignments)
    
    used_rooms = len({a['courtroom_id'] for a in assignments})
    utilization = (used_rooms / num_rooms) * 100 if num_rooms > 0 else 0
    
    type_counts = {}
    for a in assignments:
        type_counts[a['case_type']] = type_counts.get(a['case_type'], 0) + 1
    values = list(type_counts.values())
    if values and sum(v*v for v in values) > 0:
        jain = (sum(values)**2) / (len(values) * sum(v*v for v in values))
    else:
        jain = 0
    
    return {
        'algorithm': algo_name,
        'avg_hearing_wait': round(total_hearing_wait / n, 2),
        'avg_full_wait': round(total_full_wait / n, 2),
        'severity_weighted_wait': round(severity_weighted_wait / n, 2),
        'deadline_violations_pct': round((violations / n) * 100, 2),
        'urgent_violations_pct': round((urgent_violations / urgent_total * 100) if urgent_total > 0 else 0, 2),
        'critical_violations_pct': round((critical_violations / critical_total * 100) if critical_total > 0 else 0, 2),
        'judge_utilization_pct': round(utilization, 2),
        'starvation_count': starvation,
        'throughput': n,
        'fairness_index': round(jain, 3),
        'estimated_clearance_days': max(a['hearing_day'] for a in assignments)
    }


def _empty_result(algo_name):
    return {
        'algorithm': algo_name, 'avg_hearing_wait': 0, 'avg_full_wait': 0,
        'severity_weighted_wait': 0, 'deadline_violations_pct': 0,
        'urgent_violations_pct': 0, 'critical_violations_pct': 0,
        'judge_utilization_pct': 0, 'starvation_count': 0,
        'throughput': 0, 'fairness_index': 0, 'estimated_clearance_days': 0
    }


def run_benchmark(num_cases: int = 200, num_rooms: int = 5) -> Dict:
    cases = generate_cases(num_cases)
    rooms = generate_rooms(num_rooms)
    reference_time = derive_reference_date(cases)

    algorithms = [
        ("FCFS", FCFS()),
        ("Original Weighted", OriginalWeighted(reference_time=reference_time)),
        ("SJF", SJF()),
        ("HPCS-GA (Proposed)", HPCS_GA(reference_time=reference_time))
    ]

    results = []
    for name, algo in algorithms:
        assignments = algo.assign(cases, rooms)
        metrics = evaluate(name, assignments, cases, num_rooms, reference_time=reference_time)
        results.append(metrics)

    return results, cases, rooms


if __name__ == "__main__":
    print("=" * 115)
    print("🧪 ALGORITHM BENCHMARK — HEAVY LOAD COURT")
    print("Dataset: 200 cases, 5 courtrooms (40 cases per room — VERY heavy)")
    print("Tight deadlines: 60% of cases have deadlines ≤ 15 days")
    print("=" * 115)
    
    results, cases, rooms = run_benchmark(num_cases=200, num_rooms=5)
    
    print(f"\n{'Algorithm':<22} {'SevWait':<10} {'AllViol%':<10} {'UrgViol%':<10} "
          f"{'CritViol%':<10} {'Starve':<8} {'Fair':<8} {'Clear'}")
    print("-" * 115)
    for r in results:
        marker = " ⭐" if "HPCS" in r['algorithm'] else ""
        print(f"{r['algorithm']:<22} "
              f"{r['severity_weighted_wait']:<10} "
              f"{r['deadline_violations_pct']:<10} "
              f"{r['urgent_violations_pct']:<10} "
              f"{r['critical_violations_pct']:<10} "
              f"{r['starvation_count']:<8} "
              f"{r['fairness_index']:<8} "
              f"{r['estimated_clearance_days']}{marker}")
    
    print("\n📖 LEGEND:")
    print("  SevWait    = Severity-weighted wait (severe cases waiting = BAD)")
    print("  AllViol%   = % of all cases heard after deadline")
    print("  UrgViol%   = % of urgent cases (deadline ≤14d) violated")
    print("  CritViol%  = % of CRITICAL cases (deadline ≤5d) violated ⭐")
    print("  Starve     = Cases waiting > 60 days")
    
    # ===== Top 10 cases per algorithm =====
    print("\n" + "=" * 115)
    print("📊 TOP 10 SCHEDULED CASES PER ALGORITHM")
    print("=" * 115)
    
    for algo_name, algo in [
        ("FCFS", FCFS()),
        ("Original Weighted", OriginalWeighted()),
        ("HPCS-GA", HPCS_GA())
    ]:
        print(f"\n--- {algo_name} ---")
        assignments = algo.assign(cases, rooms)[:10]
        for a in assignments:
            case = next(c for c in cases if c.id == a['case_id'])
            ddl = (case.deadline - datetime.now()).days
            
            if ddl <= 5:
                marker = "🔴CRITICAL"
            elif ddl <= 14:
                marker = "🟡URGENT"
            else:
                marker = ""
            
            will_violate = " ❌VIOLATED" if a['hearing_day'] > ddl else ""
            
            print(f"  Pos {a['position']:>3} | {case.id} | Sev={case.severity:>2} | "
                  f"Deadline=in {ddl:>3}d | HearDay={a['hearing_day']:>2} | "
                  f"Score={a['priority_score']:>7} {marker}{will_violate}")