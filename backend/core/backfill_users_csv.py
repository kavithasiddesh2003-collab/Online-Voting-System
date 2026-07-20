"""
One-off: write every already-approved voter into users.csv.

The live app only appends a voter to users.csv at the moment an admin
clicks "Approve" (see approve_voter() in app.py). Anyone approved before
that logic existed/worked, or if users.csv was deleted/reset since, never
got backfilled. This script fixes that once.

Run from backend/core/:
    python backfill_users_csv.py

Safe to run multiple times — _csv_add_voter() skips anyone whose phone
number is already present in the CSV.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from models import get_conn, DATABASE_DIR  # noqa: E402
from app import _csv_add_voter  # noqa: E402  (reuses the exact same write logic as the live app)


def main():
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "SELECT name, phone, voter_id, dob FROM users WHERE role='voter' AND approved=1"
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        print("No approved voters found.")
        return

    csv_path = os.path.join(DATABASE_DIR, 'users.csv')
    added = 0
    for name, phone, voter_id, dob in rows:
        before = os.path.getmtime(csv_path) if os.path.exists(csv_path) else None
        _csv_add_voter(csv_path, name, phone, voter_id, dob)
        after = os.path.getmtime(csv_path) if os.path.exists(csv_path) else None
        if before != after:
            added += 1

    print(f"\nDone. {added} new row(s) written to {csv_path} (existing entries were skipped).")


if __name__ == "__main__":
    main()