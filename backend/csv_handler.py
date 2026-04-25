"""
CSV upload handler — parses uploaded court case files
"""
import csv
import io
from datetime import datetime
from typing import List, Tuple
from algorithms.models import Case


def parse_csv(csv_content: str) -> Tuple[List[Case], List[str]]:
    """
    Parse CSV string into Case objects.
    Returns: (list of cases, list of errors)
    """
    cases = []
    errors = []
    
    required_columns = [
        'case_id', 'case_type', 'severity', 'urgency', 'complexity',
        'filed_date', 'deadline'
    ]
    
    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        
        # Validate columns
        if not reader.fieldnames:
            return [], ["CSV is empty or malformed"]
        
        missing = [c for c in required_columns if c not in reader.fieldnames]
        if missing:
            return [], [f"Missing required columns: {', '.join(missing)}"]
        
        for row_num, row in enumerate(reader, start=2):  # row 1 is header
            try:
                case = Case(
                    id=row['case_id'].strip(),
                    case_type=row['case_type'].strip().lower(),
                    severity=int(row['severity']),
                    urgency=int(row['urgency']),
                    complexity=int(row['complexity']),
                    filed_date=datetime.fromisoformat(row['filed_date'].strip()),
                    deadline=datetime.fromisoformat(row['deadline'].strip()),
                    required_expertise=row['case_type'].strip().lower(),
                    public_interest=int(row.get('public_interest', 0) or 0),
                    estimated_duration=int(row.get('estimated_duration', 2) or 2),
                    plaintiff=row.get('plaintiff', '').strip(),
                    defendant=row.get('defendant', '').strip(),
                    status='pending'
                )
                
                # Validation
                if case.case_type not in ['criminal', 'civil', 'family', 'corporate']:
                    errors.append(f"Row {row_num}: Invalid case_type '{case.case_type}'")
                    continue
                if not (1 <= case.severity <= 10):
                    errors.append(f"Row {row_num}: severity must be 1-10")
                    continue
                if not (1 <= case.urgency <= 10):
                    errors.append(f"Row {row_num}: urgency must be 1-10")
                    continue
                
                cases.append(case)
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
    except Exception as e:
        errors.append(f"Parse error: {str(e)}")
    
    return cases, errors


def export_csv(cases: List[Case]) -> str:
    """Export cases to CSV string"""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'case_id', 'case_type', 'severity', 'urgency', 'complexity',
        'filed_date', 'deadline', 'public_interest', 'plaintiff',
        'defendant', 'estimated_duration'
    ])
    for c in cases:
        writer.writerow([
            c.id, c.case_type, c.severity, c.urgency, c.complexity,
            c.filed_date.date().isoformat(), c.deadline.date().isoformat(),
            c.public_interest, c.plaintiff, c.defendant, c.estimated_duration
        ])
    return output.getvalue()