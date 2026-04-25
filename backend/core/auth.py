import hashlib
import hmac
import os
import time
import requests

SECRET_SALT = os.getenv("OTP_HMAC_SALT", "securevote-demo-salt-change-in-production")


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

    # Strip + and spaces, keep only digits for MSG91
    mobile = phone.replace("+", "").replace(" ", "").replace("-", "")

    # Use MSG91 OTP API with the otp parameter
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
            # Fallback to console
            print(f"⚠️ MSG91 error: {data}")
            print(f"\n{'=' * 50}")
            print(f"📱 OTP for {phone}: {otp}")
            print(f"{'=' * 50}\n")
    except Exception as e:
        print(f"⚠️ Failed to send SMS: {e}")
        print(f"\n{'=' * 50}")
        print(f"📱 OTP for {phone}: {otp}")
        print(f"{'=' * 50}\n")