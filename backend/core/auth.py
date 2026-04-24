import hashlib
import hmac
import os
import time

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
    """Send OTP via Twilio SMS when configured; otherwise log to console."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.getenv("TWILIO_FROM_NUMBER", "").strip()

    if not account_sid or not auth_token or not from_number:
        # Development fallback — print to console
        print(f"\n{'=' * 50}")
        print(f"📱 OTP for {phone}: {otp}")
        print("(Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env to send real SMS.)")
        print(f"{'=' * 50}\n")
        return

    from twilio.rest import Client  # imported lazily so app starts without twilio if unconfigured

    client = Client(account_sid, auth_token)
    client.messages.create(
        body=f"Your BallotHub login code is: {otp}\nExpires in 5 minutes. Do not share it.",
        from_=from_number,
        to=phone,
    )