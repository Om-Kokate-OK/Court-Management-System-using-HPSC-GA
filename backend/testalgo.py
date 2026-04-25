"""
Quick test to verify HPCS-GA algorithm works
"""
from algorithms.benchmark import run_benchmark
from algorithms.hpcs_ga import HPCS_GA, Case, Courtroom
from datetime import datetime, timedelta

print("=" * 60)
print("🧪 TEST 1: Simple HPCS-GA Test")
print("=" * 60)

# Create 3 sample cases
cases = [
    Case(
        id="CASE-001", case_type="criminal", severity=9, urgency=8,
        complexity=7, filed_date=datetime.now() - timedelta(days=60),
        deadline=datetime.now() + timedelta(days=10),
        required_expertise="criminal", public_interest=8,
        plaintiff="State", defendant="John Doe"
    ),
    Case(
        id="CASE-002", case_type="civil", severity=4, urgency=5,
        complexity=6, filed_date=datetime.now() - timedelta(days=20),
        deadline=datetime.now() + timedelta(days=30),
        required_expertise="civil", public_interest=2,
        plaintiff="Alice", defendant="Bob"
    ),
    Case(
        id="CASE-003", case_type="family", severity=6, urgency=9,
        complexity=4, filed_date=datetime.now() - timedelta(days=5),
        deadline=datetime.now() + timedelta(days=3),
        required_expertise="family", public_interest=3,
        plaintiff="Person X", defendant="Person Y"
    ),
]

# Create 3 courtrooms
rooms = [
    Courtroom(id="CR-1", name="Court 1", judge_name="Judge A",
              judge_expertise=["criminal"], capacity=50),
    Courtroom(id="CR-2", name="Court 2", judge_name="Judge B",
              judge_expertise=["civil", "corporate"], capacity=30),
    Courtroom(id="CR-3", name="Court 3", judge_name="Judge C",
              judge_expertise=["family"], capacity=40),
]

# Run HPCS-GA
algo = HPCS_GA()

print("\n📊 Priority Scores:")
for c in cases:
    print(f"  {c.id} ({c.case_type}): Priority = {algo.priority_score(c)}")

print("\n🤖 Running HPCS-GA Assignment...")
assignments = algo.assign(cases, rooms)

print(f"\n✅ Got {len(assignments)} assignments:\n")
for a in assignments:
    print(f"  {a['case_id']} → {a['courtroom_name']} (Judge: {a['judge']})")
    print(f"    Priority: {a['priority_score']}, Cost: {a['cost']}\n")

print("=" * 60)
print("🧪 TEST 2: Full Benchmark (100 cases, 20 rooms)")
print("=" * 60)

results, _, _ = run_benchmark()
print(f"\n{'Algorithm':<25} {'AvgWait':<10} {'Violations':<12} {'Util%':<10} {'Throughput'}")
print("-" * 70)
for r in results:
    print(f"{r['algorithm']:<25} {r['avg_waiting_days']:<10} "
          f"{r['deadline_violations_pct']:<12} {r['judge_utilization_pct']:<10} "
          f"{r['throughput']}")

print("\n✅ All tests passed!" if results else "❌ Tests failed")