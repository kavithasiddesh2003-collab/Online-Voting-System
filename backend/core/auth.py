# backend/auth.py
import hashlib
import hmac
import os
import time
import sqlite3
import requests

SECRET_SALT = os.getenv("OTP_HMAC_SALT", "securevote-demo-salt-change-in-production")

# ── OTP store backed by SQLite so it survives server restarts ─────────────────

import sys
CORE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.abspath(os.path.join(CORE_DIR, '..', '..'))
DATABASE_DIR = os.path.join(ROOT_DIR, 'database')
os.makedirs(DATABASE_DIR, exist_ok=True)
_OTP_DB = os.path.join(DATABASE_DIR, 'otp_store.db')


def _get_otp_conn():
    conn = sqlite3.connect(_OTP_DB, timeout=10, check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS otp_store (
            phone     TEXT PRIMARY KEY,
            otp       TEXT NOT NULL,
            timestamp REAL NOT NULL,
            attempts  INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    return conn


def store_otp(phone, otp):
    conn = _get_otp_conn()
    conn.execute(
        "INSERT OR REPLACE INTO otp_store (phone, otp, timestamp, attempts) VALUES (?, ?, ?, 0)",
        (phone, otp, time.time())
    )
    conn.commit()
    conn.close()


def get_otp_record(phone):
    """Returns dict {otp, timestamp, attempts} or None."""
    conn = _get_otp_conn()
    row = conn.execute(
        "SELECT otp, timestamp, attempts FROM otp_store WHERE phone=?", (phone,)
    ).fetchone()
    conn.close()
    if row:
        return {'otp': row[0], 'timestamp': row[1], 'attempts': row[2]}
    return None


def increment_otp_attempts(phone):
    conn = _get_otp_conn()
    conn.execute("UPDATE otp_store SET attempts = attempts + 1 WHERE phone=?", (phone,))
    conn.commit()
    conn.close()


def delete_otp(phone):
    conn = _get_otp_conn()
    conn.execute("DELETE FROM otp_store WHERE phone=?", (phone,))
    conn.commit()
    conn.close()


# ── OTP generation & verification ─────────────────────────────────────────────

def generate_otp(phone):
    """Generate 6-digit OTP using HMAC-SHA256 (time-windowed, 5-min window)."""
    timestamp = str(int(time.time() / 300))
    message = f"{phone}:{timestamp}"
    hmac_hash = hmac.new(
        SECRET_SALT.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    otp = str(int(hmac_hash[:8], 16))[-6:]
    return otp


def verify_otp(phone, input_otp, expected_otp):
    return input_otp == expected_otp


def send_otp(phone, otp):
    """Send OTP via MSG91 SMS when configured; otherwise log to console."""
    authkey = os.getenv("MSG91_API_KEY", "").strip()

    if not authkey:
        print(f"\n{'=' * 50}")
        print(f"📱 OTP for {phone}: {otp}")
        print("(Set MSG91_API_KEY in .env to send real SMS.)")
        print(f"{'=' * 50}\n")
        return

    mobile = phone.replace("+", "").replace(" ", "").replace("-", "")
    url = "https://control.msg91.com/api/v5/otp"
    params = {
        "mobile": mobile,
        "authkey": authkey,
        "otp": otp,
        "otp_length": 6,
        "otp_expiry": 5,
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        print(f"MSG91 response: {data}")
        if data.get("type") == "success":
            print(f"✅ OTP sent to {phone} via MSG91")
        else:
            print(f"⚠️ MSG91 error: {data}")
            print(f"\n{'=' * 50}")
            print(f"📱 OTP for {phone}: {otp}")
            print(f"{'=' * 50}\n")
    except Exception as e:
        print(f"⚠️ Failed to send SMS: {e}")
        print(f"\n{'=' * 50}")
        print(f"📱 OTP for {phone}: {otp}")
        print(f"{'=' * 50}\n")