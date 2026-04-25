"""
FastAPI server with persistent storage and CSV upload
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
import io

from algorithms.models import Case, Courtroom
from algorithms.hpcs_ga import HPCS_GA
from algorithms.baseline import FCFS, OriginalWeighted, SJF
from algorithms.benchmark import evaluate, run_benchmark
from algorithms.time_utils import derive_reference_date
import database as db
from csv_handler import parse_csv, export_csv

app = FastAPI(title="Court Management System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.on_event("startup")
def startup():
    db.init_db()
    db.seed_default_rooms()
    
    # If no cases, seed a few demo ones
    if not db.get_all_cases():
        from algorithms.benchmark import generate_cases
        for c in generate_cases(20)[:20]:
            db.save_case(c)


@app.get("/")
def root():
    return {"status": "ok", "service": "Court Management API"}


# ===== CASES =====
@app.get("/api/cases")
def get_cases():
    cases = db.get_all_cases()
    reference_time = derive_reference_date(cases)
    hpcs = HPCS_GA(use_ga=False, reference_time=reference_time)
    return [
        {
            "id": c.id, "case_type": c.case_type,
            "severity": c.severity, "urgency": c.urgency,
            "complexity": c.complexity,
            "filed_date": c.filed_date.isoformat(),
            "deadline": c.deadline.isoformat(),
            "required_expertise": c.required_expertise,
            "public_interest": c.public_interest,
            "plaintiff": c.plaintiff, "defendant": c.defendant,
            "status": c.status,
            "priority_score": hpcs.priority_score(c)
        }
        for c in cases
    ]


@app.post("/api/cases/add")
def add_case(case_data: dict):
    cases = db.get_all_cases()
    new_id = case_data.get('id') or f"CASE-{1000 + len(cases)}"
    
    new_case = Case(
        id=new_id,
        case_type=case_data['case_type'],
        severity=int(case_data['severity']),
        urgency=int(case_data['urgency']),
        complexity=int(case_data['complexity']),
        filed_date=datetime.now(),
        deadline=datetime.now() + timedelta(days=case_data.get('deadline_days', 30)),
        required_expertise=case_data['case_type'],
        public_interest=int(case_data.get('public_interest', 5)),
        estimated_duration=int(case_data.get('estimated_duration', 2)),
        plaintiff=case_data.get('plaintiff', 'Unknown'),
        defendant=case_data.get('defendant', 'Unknown')
    )
    db.save_case(new_case)
    return {"success": True, "case_id": new_case.id}


@app.delete("/api/cases/{case_id}")
def delete_case(case_id: str):
    db.delete_case(case_id)
    return {"success": True}


@app.post("/api/cases/clear")
def clear_cases():
    db.clear_all_cases()
    return {"success": True}


# ===== COURTROOMS =====
@app.get("/api/courtrooms")
def get_rooms():
    rooms = db.get_all_rooms()
    return [
        {
            "id": r.id, "name": r.name, "judge_name": r.judge_name,
            "judge_expertise": r.judge_expertise,
            "capacity": r.capacity, "current_load": r.current_load,
            "available": r.available
        }
        for r in rooms
    ]


# ===== CSV UPLOAD =====
@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload CSV and replace current cases"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Must be a CSV file")
    
    content = await file.read()
    csv_string = content.decode('utf-8')
    
    cases, errors = parse_csv(csv_string)
    
    if errors and not cases:
        raise HTTPException(status_code=400, detail={"errors": errors})
    
    # Save all parsed cases
    db.clear_all_cases()
    for c in cases:
        db.save_case(c)
    
    return {
        "success": True,
        "imported": len(cases),
        "errors": errors,
        "total_in_db": len(db.get_all_cases())
    }


@app.get("/api/download-sample-csv")
def download_sample():
    """Download a sample CSV format"""
    sample = """case_id,case_type,severity,urgency,complexity,filed_date,deadline,public_interest,plaintiff,defendant,estimated_duration
CASE-1001,criminal,9,10,7,2024-06-15,2025-01-15,8,State,John Smith,4
CASE-1002,civil,4,5,6,2024-09-20,2025-03-20,2,Alice Corp,Bob Inc,3
CASE-1003,family,6,9,4,2024-11-01,2025-01-12,3,Maria,Carlos,2
CASE-1004,corporate,7,6,8,2024-07-10,2025-02-25,5,TechCo,DataCo,5
CASE-1005,criminal,10,10,9,2024-05-01,2025-01-10,9,State,Jane Doe,6
"""
    return StreamingResponse(
        io.StringIO(sample),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sample_cases.csv"}
    )


# ===== SCHEDULE =====
@app.post("/api/schedule")
def schedule():
    cases = db.get_all_cases()
    rooms = db.get_all_rooms()
    reference_time = derive_reference_date(cases)
    hpcs = HPCS_GA(reference_time=reference_time)
    assignments = hpcs.assign(cases, rooms)
    metrics = evaluate("HPCS-GA", assignments, cases, len(rooms), reference_time=reference_time)
    return {
        "assignments": assignments,
        "metrics": metrics,
        "total": len(assignments),
        "reference_time": reference_time.isoformat()
    }


# ===== COMPARE ALL ALGORITHMS ON CURRENT DB DATA =====
@app.post("/api/compare-algorithms")
def compare_algorithms():
    """Run all 4 algorithms on cases CURRENTLY in database"""
    cases = db.get_all_cases()
    rooms = db.get_all_rooms()
    
    if not cases:
        raise HTTPException(status_code=400, detail="No cases in database. Upload CSV or add cases first.")
    if not rooms:
        raise HTTPException(status_code=400, detail="No courtrooms in database.")
    
    reference_time = derive_reference_date(cases)

    algorithms = [
        ("FCFS", FCFS()),
        ("Original Weighted", OriginalWeighted(reference_time=reference_time)),
        ("SJF", SJF()),
        ("HPCS-GA (Proposed)", HPCS_GA(reference_time=reference_time))
    ]
    
    results = []
    detailed_assignments = {}
    
    for name, algo in algorithms:
        assignments = algo.assign(cases, rooms)
        metrics = evaluate(name, assignments, cases, len(rooms), reference_time=reference_time)
        results.append(metrics)
        detailed_assignments[name] = assignments[:20]  # Top 20 for display
    
    return {
        "results": results,
        "assignments": detailed_assignments,
        "dataset_size": len(cases),
        "rooms_count": len(rooms),
        "reference_time": reference_time.isoformat()
    }


# ===== STATS =====
@app.get("/api/stats")
def stats():
    cases = db.get_all_cases()
    rooms = db.get_all_rooms()
    return {
        "total_cases": len(cases),
        "total_courtrooms": len(rooms),
        "pending": sum(1 for c in cases if c.status == 'pending'),
        "criminal": sum(1 for c in cases if c.case_type == 'criminal'),
        "civil": sum(1 for c in cases if c.case_type == 'civil'),
        "family": sum(1 for c in cases if c.case_type == 'family'),
        "corporate": sum(1 for c in cases if c.case_type == 'corporate'),
    }


# ===== SYNTHETIC BENCHMARK =====
@app.get("/api/benchmark")
def benchmark(num_cases: int = 200, num_rooms: int = 5):
    """Run synthetic benchmark for algorithm comparison page."""
    results, _, _ = run_benchmark(num_cases=num_cases, num_rooms=num_rooms)
    return {
        "success": True,
        "results": results,
        "num_cases": num_cases,
        "num_rooms": num_rooms
    }