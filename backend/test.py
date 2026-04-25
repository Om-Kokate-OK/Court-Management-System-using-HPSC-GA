"""
Verify HPCS-GA produces logically correct results
"""
from algorithms.hpcs_ga import HPCS_GA, Case, Courtroom
from datetime import datetime, timedelta

def test_high_severity_higher_priority():
    """Test: High severity case should have higher priority score"""
    algo = HPCS_GA()
    
    case_high = Case(
        id="HIGH", case_type="criminal", severity=10, urgency=5,
        complexity=5, filed_date=datetime.now() - timedelta(days=30),
        deadline=datetime.now() + timedelta(days=30),
        required_expertise="criminal"
    )
    case_low = Case(
        id="LOW", case_type="criminal", severity=2, urgency=5,
        complexity=5, filed_date=datetime.now() - timedelta(days=30),
        deadline=datetime.now() + timedelta(days=30),
        required_expertise="criminal"
    )
    
    assert algo.priority_score(case_high) > algo.priority_score(case_low), \
        "High severity should give higher priority"
    print("✅ Test 1 PASSED: High severity → higher priority")

def test_old_case_higher_priority():
    """Test: Older case should have higher priority (aging)"""
    algo = HPCS_GA()
    
    old_case = Case(
        id="OLD", case_type="civil", severity=5, urgency=5, complexity=5,
        filed_date=datetime.now() - timedelta(days=120),
        deadline=datetime.now() + timedelta(days=30),
        required_expertise="civil"
    )
    new_case = Case(
        id="NEW", case_type="civil", severity=5, urgency=5, complexity=5,
        filed_date=datetime.now() - timedelta(days=2),
        deadline=datetime.now() + timedelta(days=30),
        required_expertise="civil"
    )
    
    assert algo.priority_score(old_case) > algo.priority_score(new_case), \
        "Old case should have higher priority due to aging"
    print("✅ Test 2 PASSED: Old case → higher priority (aging works)")

def test_expertise_constraint():
    """Test: Case can only go to matching expertise courtroom"""
    algo = HPCS_GA()
    
    cases = [Case(
        id="C1", case_type="criminal", severity=8, urgency=8, complexity=5,
        filed_date=datetime.now(), deadline=datetime.now() + timedelta(days=10),
        required_expertise="criminal"
    )]
    rooms = [
        Courtroom(id="R1", name="Civil Court", judge_name="J1",
                  judge_expertise=["civil"], capacity=20),
        Courtroom(id="R2", name="Criminal Court", judge_name="J2",
                  judge_expertise=["criminal"], capacity=20),
    ]
    
    assignments = algo.assign(cases, rooms)
    assert len(assignments) == 1, "Should assign 1 case"
    assert assignments[0]['courtroom_id'] == "R2", \
        "Criminal case must go to criminal court"
    print("✅ Test 3 PASSED: Expertise constraint enforced")

def test_no_starvation():
    """Test: Very old case must be in top assignments"""
    algo = HPCS_GA()
    
    cases = [Case(
        id=f"C{i}", case_type="civil", severity=5, urgency=5, complexity=5,
        filed_date=datetime.now() - timedelta(days=i),
        deadline=datetime.now() + timedelta(days=30),
        required_expertise="civil"
    ) for i in [1, 5, 10, 200]]  # Last one is 200 days old!
    
    scores = [(c.id, algo.priority_score(c)) for c in cases]
    scores.sort(key=lambda x: -x[1])
    
    assert scores[0][0] == "C200", "Oldest case should have highest priority"
    print("✅ Test 4 PASSED: No starvation - oldest case prioritized")

if __name__ == "__main__":
    print("🧪 Running Correctness Tests...\n")
    test_high_severity_higher_priority()
    test_old_case_higher_priority()
    test_expertise_constraint()
    test_no_starvation()
    print("\n🎉 ALL TESTS PASSED! Algorithm is correct.")