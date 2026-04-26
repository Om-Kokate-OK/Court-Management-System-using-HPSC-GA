"""
FastAPI server with persistent storage and CSV upload
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from datetime import datetime, timedelta
import io

from algorithms.models import Case, Courtroom
from algorithms.hpcs_ga import HPCS_GA
from algorithms.baseline import FCFS, OriginalWeighted, SJF
from algorithms.benchmark import evaluate, run_benchmark, generate_cases, generate_rooms
from algorithms.time_utils import derive_reference_date
import database as db
from csv_handler import parse_csv, export_csv

app = FastAPI(title="Court Management System API")


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines):
    text_lines = [
        "BT",
        "/F1 12 Tf",
        "50 800 Td",
    ]
    for i, line in enumerate(lines):
        if i > 0:
            text_lines.append("0 -16 Td")
        text_lines.append(f"({_escape_pdf_text(line)}) Tj")
    text_lines.append("ET")
    stream = "\n".join(text_lines).encode("latin-1", errors="replace")

    objects = []
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
    )
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(
        f"5 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
        + stream
        + b"\nendstream\nendobj\n"
    )

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("latin-1"))

    pdf.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_offset}\n"
            "%%EOF\n"
        ).encode("latin-1")
    )
    return bytes(pdf)


def _simulate_until_close(cases, rooms):
    """Run a day-by-day simulation until all cases are closed or no progress is possible."""
    if not cases:
        raise HTTPException(status_code=400, detail="No cases available for simulation.")
    if not rooms:
        raise HTTPException(status_code=400, detail="No courtrooms available for simulation.")

    remaining = list(cases)
    reference_time = derive_reference_date(remaining)
    hpcs = HPCS_GA(use_ga=False, reference_time=reference_time)

    timeline = []
    room_usage = {r.name: 0 for r in rooms}
    total_overdue = 0
    total_closed = 0
    day = 0
    max_days = 365

    while remaining and day < max_days:
        day_date = reference_time + timedelta(days=day)
        ranked = sorted(remaining, key=lambda c: hpcs.priority_score(c), reverse=True)
        scheduled = []
        used_case_ids = set()

        rooms_by_balance = sorted(rooms, key=lambda r: room_usage[r.name])

        for room in rooms_by_balance:
            if not room.available:
                continue

            # One effective hearing slot per courtroom/day keeps the simulation timeline understandable.
            slots = 1
            for _ in range(slots):
                candidate = None
                for case in ranked:
                    if case.id in used_case_ids:
                        continue
                    if case.required_expertise in room.judge_expertise:
                        candidate = case
                        break

                if candidate is None:
                    for case in ranked:
                        if case.id not in used_case_ids:
                            candidate = case
                            break

                if candidate is None:
                    break

                used_case_ids.add(candidate.id)
                score = round(hpcs.priority_score(candidate), 2)
                overdue = day_date > candidate.deadline
                total_overdue += 1 if overdue else 0

                scheduled.append({
                    "case_id": candidate.id,
                    "case_type": candidate.case_type,
                    "courtroom": room.name,
                    "judge": room.judge_name,
                    "priority_score": score,
                    "overdue": overdue,
                })
                room_usage[room.name] += 1

        if not scheduled:
            break

        closed_today_ids = {item["case_id"] for item in scheduled}
        total_closed += len(closed_today_ids)
        remaining = [c for c in remaining if c.id not in closed_today_ids]

        timeline.append({
            "day": day,
            "date": day_date.date().isoformat(),
            "closed_today": len(closed_today_ids),
            "remaining_after": len(remaining),
            "overdue_today": sum(1 for x in scheduled if x["overdue"]),
            "assignments": scheduled,
        })

        day += 1

    max_room = max(room_usage.values()) if room_usage else 1
    min_room = min(room_usage.values()) if room_usage else 0
    fairness_index = 1 - ((max_room - min_room) / max(1, total_closed))

    top_ranked = sorted(cases, key=lambda c: hpcs.priority_score(c), reverse=True)[:12]
    ranked_snapshot = [
        {
            "case_id": c.id,
            "case_type": c.case_type,
            "severity": c.severity,
            "urgency": c.urgency,
            "deadline": c.deadline.date().isoformat(),
            "priority_score": round(hpcs.priority_score(c), 2),
        }
        for c in top_ranked
    ]

    return {
        "reference_time": reference_time.isoformat(),
        "summary": {
            "total_cases": len(cases),
            "closed_cases": total_closed,
            "remaining_cases": len(remaining),
            "simulation_days": len(timeline),
            "deadline_breaches": total_overdue,
            "avg_daily_throughput": round(total_closed / max(1, len(timeline)), 2),
            "fairness_index": round(fairness_index, 3),
            "status": "completed" if len(remaining) == 0 else "stopped_no_capacity",
        },
        "room_usage": room_usage,
        "ranked_snapshot": ranked_snapshot,
        "timeline": timeline,
    }

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


@app.get("/api/architecture/access")
def architecture_access():
    """Return a short-lived access payload used by the hidden architecture lab page."""
    cases = db.get_all_cases()
    rooms = db.get_all_rooms()
    issued_at = datetime.utcnow()
    key_seed = f"{len(cases)}-{len(rooms)}-{issued_at.strftime('%Y%m%d%H%M')}"
    return {
        "access_granted": True,
        "issued_at": issued_at.isoformat() + "Z",
        "expires_in_sec": 900,
        "key": key_seed,
        "dataset": {
            "cases": len(cases),
            "courtrooms": len(rooms),
        },
    }


@app.get("/api/simulation/dynamic")
def dynamic_simulation(case_source: str = "database", num_cases: int = 20):
    """Run a realistic day-by-day simulation until cases are closed."""
    rooms = db.get_all_rooms()

    source_key = case_source.lower().strip()
    if source_key == "synthetic":
        bounded_cases = max(10, min(num_cases, 120))
        cases = generate_cases(bounded_cases)
    else:
        cases = db.get_all_cases()

    payload = _simulate_until_close(cases, rooms)
    payload["source"] = "synthetic" if source_key == "synthetic" else "database"
    payload["requested_cases"] = num_cases
    payload["used_cases"] = len(cases)
    payload["rooms"] = len(rooms)
    return payload


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


@app.get("/api/visualization/hungarian")
def hungarian_visualization(top_n: int = 12):
    cases = db.get_all_cases()
    rooms = db.get_all_rooms()
    if not cases:
        raise HTTPException(status_code=400, detail="No cases in database. Upload CSV first.")
    if not rooms:
        raise HTTPException(status_code=400, detail="No courtrooms available.")

    reference_time = derive_reference_date(cases)
    hpcs = HPCS_GA(use_ga=False, reference_time=reference_time)
    payload = hpcs.explain_hungarian(cases, rooms, top_n=top_n)
    payload["reference_time"] = reference_time.isoformat()
    return payload


@app.get("/api/ga-evolution")
def ga_evolution(num_cases: int = 120, num_rooms: int = 5, generations: int = 20, pop_size: int = 30):
    cases = generate_cases(num_cases)
    rooms = generate_rooms(num_rooms)
    reference_time = derive_reference_date(cases)

    hpcs = HPCS_GA(
        use_ga=True,
        ga_generations=max(1, generations),
        ga_pop_size=max(4, pop_size),
        reference_time=reference_time,
    )
    hpcs.assign(cases, rooms)

    return {
        "history": hpcs.get_ga_history(),
        "final_weights": {
            "alpha": round(hpcs.alpha, 4),
            "beta": round(hpcs.beta, 4),
            "gamma": round(hpcs.gamma, 4),
            "delta": round(hpcs.delta, 4),
            "epsilon": round(hpcs.epsilon, 4),
        },
        "num_cases": num_cases,
        "num_rooms": num_rooms,
        "generations": generations,
        "population": pop_size,
    }


@app.get("/api/report/pdf")
def generate_report_pdf():
    cases = db.get_all_cases()
    rooms = db.get_all_rooms()
    if not cases:
        raise HTTPException(status_code=400, detail="No cases in database. Upload CSV first.")
    if not rooms:
        raise HTTPException(status_code=400, detail="No courtrooms available.")

    reference_time = derive_reference_date(cases)
    algorithms = [
        ("FCFS", FCFS()),
        ("Original Weighted", OriginalWeighted(reference_time=reference_time)),
        ("SJF", SJF()),
        ("HPCS-GA (Proposed)", HPCS_GA(reference_time=reference_time)),
    ]

    lines = [
        "Court Management System - Auto Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Reference Date: {reference_time.strftime('%Y-%m-%d')}",
        f"Dataset: {len(cases)} cases, {len(rooms)} courtrooms",
        "",
        "Algorithm Summary:",
    ]

    for name, algo in algorithms:
        assignments = algo.assign(cases, rooms)
        metrics = evaluate(name, assignments, cases, len(rooms), reference_time=reference_time)
        lines.append(
            f"{name}: SevWait={metrics['severity_weighted_wait']}, Viol={metrics['deadline_violations_pct']}%, "
            f"UrgViol={metrics['urgent_violations_pct']}%, ClearDays={metrics['estimated_clearance_days']}"
        )

    pdf_bytes = _build_simple_pdf(lines)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=court_report.pdf"},
    )