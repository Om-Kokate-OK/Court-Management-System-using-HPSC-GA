"""
Baseline algorithms — clean implementations
All return same format as HPCS-GA.
"""
from datetime import datetime
from typing import List, Dict, Optional
from .models import Case, Courtroom
from .time_utils import derive_reference_date


def _greedy_assign(sorted_cases: List[Case], rooms: List[Courtroom]) -> List[Dict]:
    """Common assignment helper — used by all baselines"""
    if not sorted_cases or not rooms:
        return []
    
    room_loads = {r.id: 0 for r in rooms}
    assignments = []
    slots_per_day_per_room = 2
    
    for case in sorted_cases:
        # Find any room with matching expertise
        candidates = [
            r for r in rooms 
            if case.required_expertise in r.judge_expertise and r.available
        ]
        if not candidates:
            continue
        
        # Baselines intentionally pick first compatible room (no optimization).
        room = candidates[0]
        
        hearing_day = room_loads[room.id] // slots_per_day_per_room
        position = len(assignments)
        
        assignments.append({
            'case_id': case.id,
            'case_type': case.case_type,
            'courtroom_id': room.id,
            'courtroom_name': room.name,
            'judge': room.judge_name,
            'priority_score': 0,
            'position': position,
            'hearing_day': hearing_day,
        })
        room_loads[room.id] += 1
    
    return assignments


# ===== 1. FCFS (First Come First Serve) =====
class FCFS:
    """Sorts by filing date — oldest first"""
    def assign(self, cases: List[Case], rooms: List[Courtroom]) -> List[Dict]:
        sorted_cases = sorted(cases, key=lambda c: c.filed_date)
        return _greedy_assign(sorted_cases, rooms)


# ===== 2. Original Weighted (Your current algo) =====
class OriginalWeighted:
    """
    P = w1·Age + w2·Severity + w3·Urgency + w4·Complexity
    Static weights, linear scoring
    """
    def __init__(self, reference_time: Optional[datetime] = None):
        self.w1 = 1.0   # age
        self.w2 = 2.0   # severity
        self.w3 = 1.5   # urgency
        self.w4 = 1.0   # complexity
        self.reference_time = reference_time

    def priority_score(self, case: Case) -> float:
        now = self.reference_time or datetime.now()
        age = max(1, (now - case.filed_date).days)
        return (
            self.w1 * age + 
            self.w2 * case.severity +
            self.w3 * case.urgency + 
            self.w4 * case.complexity
        )

    def assign(self, cases: List[Case], rooms: List[Courtroom]) -> List[Dict]:
        if self.reference_time is None:
            self.reference_time = derive_reference_date(cases)
        sorted_cases = sorted(cases, key=lambda c: -self.priority_score(c))
        result = _greedy_assign(sorted_cases, rooms)
        # Add priority scores
        for r in result:
            case = next(c for c in cases if c.id == r['case_id'])
            r['priority_score'] = round(self.priority_score(case), 2)
        return result


# ===== 3. SJF (Shortest Job First) =====
class SJF:
    """Sort by estimated duration — shortest first"""
    def assign(self, cases: List[Case], rooms: List[Courtroom]) -> List[Dict]:
        sorted_cases = sorted(cases, key=lambda c: c.estimated_duration)
        return _greedy_assign(sorted_cases, rooms)