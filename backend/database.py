"""
SQLite database for persistent storage
"""
import sqlite3
import os
from datetime import datetime
from typing import List
from algorithms.models import Case, Courtroom

DB_PATH = os.path.join(os.path.dirname(__file__), "court.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist"""
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            case_type TEXT NOT NULL,
            severity INTEGER NOT NULL,
            urgency INTEGER NOT NULL,
            complexity INTEGER NOT NULL,
            filed_date TEXT NOT NULL,
            deadline TEXT NOT NULL,
            required_expertise TEXT NOT NULL,
            public_interest INTEGER DEFAULT 0,
            estimated_duration INTEGER DEFAULT 2,
            plaintiff TEXT DEFAULT '',
            defendant TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS courtrooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            judge_name TEXT NOT NULL,
            judge_expertise TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            current_load INTEGER DEFAULT 0,
            available INTEGER DEFAULT 1
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS uploaded_datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            num_cases INTEGER NOT NULL,
            data TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()


# ===== CASE OPERATIONS =====
def save_case(case: Case):
    conn = get_connection()
    conn.execute("""
        INSERT OR REPLACE INTO cases 
        (id, case_type, severity, urgency, complexity, filed_date, deadline,
         required_expertise, public_interest, estimated_duration, 
         plaintiff, defendant, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        case.id, case.case_type, case.severity, case.urgency, case.complexity,
        case.filed_date.isoformat(), case.deadline.isoformat(),
        case.required_expertise, case.public_interest, case.estimated_duration,
        case.plaintiff, case.defendant, case.status
    ))
    conn.commit()
    conn.close()


def get_all_cases() -> List[Case]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM cases ORDER BY created_at DESC").fetchall()
    conn.close()
    
    return [
        Case(
            id=r['id'],
            case_type=r['case_type'],
            severity=r['severity'],
            urgency=r['urgency'],
            complexity=r['complexity'],
            filed_date=datetime.fromisoformat(r['filed_date']),
            deadline=datetime.fromisoformat(r['deadline']),
            required_expertise=r['required_expertise'],
            public_interest=r['public_interest'],
            estimated_duration=r['estimated_duration'],
            plaintiff=r['plaintiff'],
            defendant=r['defendant'],
            status=r['status']
        )
        for r in rows
    ]


def delete_case(case_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
    conn.commit()
    conn.close()


def clear_all_cases():
    conn = get_connection()
    conn.execute("DELETE FROM cases")
    conn.commit()
    conn.close()


# ===== COURTROOM OPERATIONS =====
def save_courtroom(room: Courtroom):
    conn = get_connection()
    conn.execute("""
        INSERT OR REPLACE INTO courtrooms 
        (id, name, judge_name, judge_expertise, capacity, current_load, available)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        room.id, room.name, room.judge_name, ",".join(room.judge_expertise),
        room.capacity, room.current_load, 1 if room.available else 0
    ))
    conn.commit()
    conn.close()


def get_all_rooms() -> List[Courtroom]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM courtrooms").fetchall()
    conn.close()
    
    return [
        Courtroom(
            id=r['id'],
            name=r['name'],
            judge_name=r['judge_name'],
            judge_expertise=r['judge_expertise'].split(","),
            capacity=r['capacity'],
            current_load=r['current_load'],
            available=bool(r['available'])
        )
        for r in rows
    ]


def seed_default_rooms():
    """Create default courtrooms if none exist"""
    rooms = get_all_rooms()
    if rooms:
        return
    
    default_rooms = [
        Courtroom("CR-1", "Courtroom 1", "Hon. Judge Smith", 
                  ["criminal", "family"], 50),
        Courtroom("CR-2", "Courtroom 2", "Hon. Judge Brown", 
                  ["civil", "corporate"], 40),
        Courtroom("CR-3", "Courtroom 3", "Hon. Judge Davis", 
                  ["criminal", "civil"], 60),
        Courtroom("CR-4", "Courtroom 4", "Hon. Judge Wilson", 
                  ["family", "civil"], 35),
        Courtroom("CR-5", "Courtroom 5", "Hon. Judge Garcia", 
                  ["corporate", "criminal"], 45),
        Courtroom("CR-6", "Courtroom 6", "Hon. Judge Martinez", 
                  ["civil", "family"], 50),
        Courtroom("CR-7", "Courtroom 7", "Hon. Judge Anderson", 
                  ["criminal", "corporate"], 40),
        Courtroom("CR-8", "Courtroom 8", "Hon. Judge Taylor", 
                  ["family", "criminal"], 55),
    ]
    
    for r in default_rooms:
        save_courtroom(r)