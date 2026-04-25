"""
Shared data models for all algorithms
"""
from dataclasses import dataclass
from datetime import datetime
from typing import List

@dataclass
class Case:
    id: str
    case_type: str           # 'criminal', 'civil', 'family', 'corporate'
    severity: int            # 1-10
    urgency: int             # 1-10
    complexity: int          # 1-10
    filed_date: datetime
    deadline: datetime
    required_expertise: str
    public_interest: int = 0
    estimated_duration: int = 2
    plaintiff: str = ""
    defendant: str = ""
    status: str = "pending"

@dataclass
class Courtroom:
    id: str
    name: str
    judge_name: str
    judge_expertise: List[str]
    capacity: int
    current_load: int = 0
    available: bool = True