from datetime import datetime, timedelta
from typing import List, Optional
from .models import Case


def derive_reference_date(cases: List[Case], current_time: Optional[datetime] = None) -> datetime:
    """
    Choose a fair evaluation/scheduling reference date.

    - For live datasets with upcoming deadlines, use current time.
    - For historical datasets where every deadline is already past, anchor near
      the dataset window so metrics remain meaningful.
    """
    now = current_time or datetime.now()
    if not cases:
        return now

    if all(c.deadline < now for c in cases):
        latest_filed = max(c.filed_date for c in cases)
        return latest_filed + timedelta(days=1)

    return now
