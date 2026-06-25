import os
import sqlite3
import pandas as pd
from datetime import datetime
import sys

# Paths
excel_path = sys.argv[1] if len(sys.argv) > 1 else r"c:\Users\sarth\OneDrive\Desktop\tanker excelsheet.xlsx"
db_path = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.sqlite"))

# Create directory if it doesn't exist
if os.path.dirname(db_path):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

print("Connecting to database...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create tables
cursor.execute("""
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    location TEXT,
    rate_per_tanker REAL DEFAULT 0
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS daily_supply (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    client_id INTEGER NOT NULL,
    location TEXT,
    tankers_supplied INTEGER NOT NULL DEFAULT 0,
    rate_per_tanker REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    description TEXT,
    payment_status TEXT DEFAULT 'UNPAID',
    FOREIGN KEY(client_id) REFERENCES clients(id)
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    description TEXT
);
""")
# Clear existing data to allow re-running the script without duplicates
cursor.execute("DELETE FROM daily_supply;")
cursor.execute("DELETE FROM expenses;")
cursor.execute("DELETE FROM clients;")
cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('daily_supply', 'expenses', 'clients');")
conn.commit()

# Load Excel File
print(f"Loading Excel file from {excel_path}...")
xls = pd.ExcelFile(excel_path)

# Helper function to clean strings
def clean_str(val):
    if pd.isna(val):
        return ""
    return str(val).strip()

# Helper function to format dates to YYYY-MM-DD
def clean_date(val):
    if pd.isna(val):
        return ""
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    val_str = str(val).strip()
    try:
        # Check if it has time part
        if " " in val_str:
            val_str = val_str.split(" ")[0]
        dt = pd.to_datetime(val_str)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return val_str

# 1. Import CLIENT LIST
print("Importing clients...")
df_clients = pd.read_excel(excel_path, sheet_name="CLIENT LIST")
df_clients.columns = [str(col).strip() for col in df_clients.columns]

client_map = {} # Maps client name (clean, lower) -> client_id

for idx, row in df_clients.iterrows():
    name = clean_str(row.get("CLIENT LIST"))
    if not name:
        continue
    location = clean_str(row.get("LOCATION"))
    
    rate = row.get("RATE PER TANKER")
    try:
        rate = float(rate) if not pd.isna(rate) else 0.0
    except ValueError:
        rate = 0.0
        
    # Insert or Ignore
    cursor.execute("""
    INSERT OR IGNORE INTO clients (name, location, rate_per_tanker)
    VALUES (?, ?, ?)
    """, (name, location, rate))
    
    # Get ID
    cursor.execute("SELECT id FROM clients WHERE name = ?", (name,))
    client_id = cursor.fetchone()[0]
    client_map[name.lower()] = client_id

conn.commit()
print(f"Loaded {len(client_map)} clients from CLIENT LIST.")

# 2. Import DAILY SUPPLY
print("Importing daily supplies...")
df_supply = pd.read_excel(excel_path, sheet_name="DAILY SUPPLY")
df_supply.columns = [str(col).strip() for col in df_supply.columns]

supply_count = 0
for idx, row in df_supply.iterrows():
    date_val = clean_date(row.get("DATE"))
    company = clean_str(row.get("COMPANY"))
    if not date_val or not company:
        continue
        
    # Find client_id
    company_lower = company.lower()
    if company_lower in client_map:
        client_id = client_map[company_lower]
    else:
        # If client not in database, add it
        print(f"Found new client in supply sheet: '{company}'. Creating client record...")
        cursor.execute("INSERT INTO clients (name) VALUES (?)", (company,))
        cursor.execute("SELECT id FROM clients WHERE name = ?", (company,))
        client_id = cursor.fetchone()[0]
        client_map[company_lower] = client_id
        
    location = clean_str(row.get("LOCATION"))
    
    # Tankers
    tankers = row.get("NO OF TANKER SUPPLIED")
    try:
        tankers = int(tankers) if not pd.isna(tankers) else 0
    except ValueError:
        tankers = 0
        
    # Rate
    rate = row.get("RATE PER TANKER")
    try:
        rate = float(rate) if not pd.isna(rate) else 0.0
    except ValueError:
        rate = 0.0
        
    # Total
    total = row.get("TOTAL AMOUNT")
    try:
        total = float(total) if not pd.isna(total) else (tankers * rate)
    except ValueError:
        total = tankers * rate
        
    desc = clean_str(row.get("DESCRIPTION"))
    
    # Payment status (trim spaces)
    pay = clean_str(row.get("PAYMENT"))
    if not pay:
        # check alternative spelling
        pay = clean_str(row.get("PAYMENT STATUS"))
    
    # Standardize payment status to PAID or UNPAID
    pay = pay.upper()
    if "UNPAID" in pay:
        pay = "UNPAID"
    elif "PAID" in pay:
        pay = "PAID"
    else:
        pay = "UNPAID" # Default
        
    cursor.execute("""
    INSERT INTO daily_supply (date, client_id, location, tankers_supplied, rate_per_tanker, total_amount, description, payment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (date_val, client_id, location, tankers, rate, total, desc, pay))
    supply_count += 1

conn.commit()
print(f"Loaded {supply_count} supply records.")

# 3. Import EXPENSES
print("Importing expenses...")
df_expenses = pd.read_excel(excel_path, sheet_name="EXPENSES")
df_expenses.columns = [str(col).strip() for col in df_expenses.columns]

expense_count = 0
for idx, row in df_expenses.iterrows():
    date_val = clean_date(row.get("DATE"))
    if not date_val:
        # Check if alternative date name exists
        date_val = clean_date(row.get("DATE "))
        if not date_val:
            continue
            
    cat = clean_str(row.get("EXPENSE CATEGORY"))
    if not cat:
        continue
        
    amount = row.get("AMOUNT")
    try:
        amount = float(amount) if not pd.isna(amount) else 0.0
    except ValueError:
        amount = 0.0
        
    desc = clean_str(row.get("DESCRIPTION"))
    
    cursor.execute("""
    INSERT INTO expenses (date, category, amount, description)
    VALUES (?, ?, ?, ?)
    """, (date_val, cat, amount, desc))
    expense_count += 1

conn.commit()
print(f"Loaded {expense_count} expense records.")

# Print verification statistics
print("\n--- IMPORT VERIFICATION SUMMARY ---")
cursor.execute("SELECT COUNT(*) FROM clients")
print(f"Total Clients in Database: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM daily_supply")
print(f"Total Daily Supplies in Database: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM expenses")
print(f"Total Expenses in Database: {cursor.fetchone()[0]}")

# Verification of sums
cursor.execute("SELECT SUM(total_amount), SUM(tankers_supplied) FROM daily_supply")
rev, tanks = cursor.fetchone()
cursor.execute("SELECT SUM(amount) FROM expenses")
exp = cursor.fetchone()[0]
net = rev - exp
pct = (net / rev * 100) if rev else 0

print(f"Total Tankers Supplied: {tanks}")
print(f"Total Revenue Earned: Rs. {rev:,.2f}")
print(f"Total Expenses: Rs. {exp:,.2f}")
print(f"NET PROFIT: Rs. {net:,.2f}")
print(f"PROFIT PERCENTAGE: {pct:.2f}%")

conn.close()
print("\nImport completed successfully!")
