import pandas as pd
import random
from datetime import datetime, timedelta

case_types = ["criminal", "civil", "family", "corporate"]

plaintiffs = [
    "State of California", "State of Texas", "State of NY",
    "Amazon Inc", "Google LLC", "Tesla Inc",
    "ABC Corp", "XYZ Ltd", "Citizen Group",
    "Infosys Ltd", "Reliance Industries", "Flipkart Ltd"
]

defendants = [
    "John Doe", "Michael Johnson", "Robert King",
    "XYZ Suppliers", "Startup AI Inc", "Rivian Motors",
    "Rahul Sharma", "David Lee", "Underworld Don",
    "Municipal Corp", "X Corp", "Unknown Entity"
]

def random_date(start, end):
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days))

data = []

for i in range(250):
    filed = random_date(datetime(2024,1,1), datetime(2024,12,31))
    deadline = filed + timedelta(days=random.randint(30, 400))

    case = [
        f"CASE-{3000+i}",
        random.choice(case_types),
        random.randint(3,10),
        random.randint(4,10),
        random.randint(2,9),
        filed.strftime("%Y-%m-%d"),
        deadline.strftime("%Y-%m-%d"),
        random.randint(1,10),
        random.choice(plaintiffs),
        random.choice(defendants),
        random.randint(1,8)
    ]

    data.append(case)

columns = [
    "case_id","case_type","severity","urgency","complexity",
    "filed_date","deadline","public_interest",
    "plaintiff","defendant","estimated_duration"
]

df = pd.DataFrame(data, columns=columns)

df.to_csv("court_cases_250.csv", index=False)

print("CSV file generated: court_cases_250.csv")