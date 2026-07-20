# backend/app.py
import json
import math
import os
import re
import time
from datetime import datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required

_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

from models import (
    init_db, get_user, get_admin_by_email, get_election, create_election,
    update_election, get_all_elections, has_voted, mark_voted,
    reload_users_from_csv, delete_election, get_all_users, get_conn   # FIX #8: import get_conn
)
from crypto import (
    PaillierCrypto, generate_trustee_shares, combine_shares, sign_data
)
from auth import (
    generate_otp, verify_otp, send_otp,
    store_otp, get_otp_record, increment_otp_attempts, delete_otp
)

app = Flask(__name__)

# FIX #2: Fail loudly if JWT secret is missing — never silently use a weak default in production
_jwt_secret = os.getenv("JWT_SECRET_KEY", "")
if not _jwt_secret:
    import warnings
    warnings.warn(
        "JWT_SECRET_KEY is not set. Using an insecure dev default. "
        "Set JWT_SECRET_KEY in your .env before deploying.",
        stacklevel=1,
    )
    _jwt_secret = "dev-secret-key-DO-NOT-USE-IN-PRODUCTION"

app.config["JWT_SECRET_KEY"] = _jwt_secret
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)
CORS(app,
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     supports_credentials=False)
jwt = JWTManager(app)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(HERE, '..', '..'))
DATABASE_DIR = os.path.join(ROOT_DIR, 'database')
os.makedirs(DATABASE_DIR, exist_ok=True)

BULLETIN_FILE = os.path.join(DATABASE_DIR, 'bulletin.json')
TRUSTEE_FILE = os.path.join(DATABASE_DIR, 'trustee_keys.json')

os.makedirs(DATABASE_DIR, exist_ok=True)
print(f"DATABASE_DIR: {DATABASE_DIR}")

# IST timezone offset
IST_OFFSET = timedelta(hours=5, minutes=30)

init_db()

def _read_bulletin_safe():
    if not os.path.exists(BULLETIN_FILE):
        return []
    try:
        with open(BULLETIN_FILE, 'r', encoding='utf-8') as f:
            txt = f.read().strip()
        if not txt:
            return []
        return json.loads(txt)
    except Exception:
        return []

def _write_bulletin_safe(data):
    with open(BULLETIN_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def _append_bulletin_entry(entry):
    b = _read_bulletin_safe()
    b.append(entry)
    _write_bulletin_safe(b)

if not os.path.exists(BULLETIN_FILE):
    _write_bulletin_safe([])
else:
    try:
        _write_bulletin_safe(_read_bulletin_safe())
    except Exception:
        _write_bulletin_safe([])

def _normalize_phone(raw):
    """Strip spaces/dashes and ensure E.164 format (+<digits>)."""
    phone = raw.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+" + phone
    return phone


def _parse_candidates(candidates_json):
    """Parse candidates - handles both old (list of strings) and new (list of dicts) format."""
    data = json.loads(candidates_json)
    if data and isinstance(data[0], dict):
        return [c["name"] for c in data]
    return data

def _get_current_user():
    """
    Resolve JWT identity to a user tuple (id, name, phone_or_email, created_at, role).
    Handles both voter (phone) and admin (admin:email) identities.
    """
    identity = get_jwt_identity()
    if identity and identity.startswith("admin:"):
        email = identity[len("admin:"):]
        admin = get_admin_by_email(email)
        if admin:
            return (admin[0], admin[1], admin[2], None, admin[4])
        return None
    return get_user(identity)


@app.route('/check-phone', methods=['GET'])
def check_phone():
    raw = request.args.get('phone', '').strip()
    if not raw:
        return jsonify({'error': 'Phone required'}), 400
    full = _normalize_phone(raw)
    existing = get_user(full)
    return jsonify({'exists': bool(existing)}), 200


@app.route('/register', methods=['POST'])
def register():
    from werkzeug.security import generate_password_hash
    data = request.json or {}
    raw_phone = data.get('phone', '').strip()
    name      = data.get('name', '').strip()
    voter_id  = data.get('voter_id', '').strip() or None
    if not voter_id:
        return jsonify({'error': 'Voter ID is required.'}), 400
    if not re.match(r'^VOT\d{3}$', voter_id):
        return jsonify({'error': 'Voter ID must be VOT followed by exactly 3 digits (e.g. VOT001).'}), 400
    dob       = data.get('dob', '').strip() or None
    password  = data.get('password', '').strip() or None

    if not raw_phone or not name:
        return jsonify({'error': 'Name and phone number are required'}), 400
    if not dob:
        return jsonify({'error': 'Date of birth is required'}), 400
    try:
        from datetime import datetime as _dt
        birth = _dt.strptime(dob, '%d-%m-%Y').date()
        today = _dt.today().date()
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        if age < 18:
            return jsonify({'error': 'You must be at least 18 years old to register.'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid date of birth format. Expected DD-MM-YYYY.'}), 400
    phone = _normalize_phone(raw_phone)

    existing = get_user(phone)
    if existing:
        return jsonify({'error': 'This phone number is already registered'}), 409

    pwd_hash = generate_password_hash(password) if password else None

    try:
        conn = get_conn()
        c = conn.cursor()
        c.execute(
            "INSERT INTO users (name, phone, voter_id, dob, password_hash, role, approved) VALUES (?, ?, ?, ?, ?, 'voter', 0)",
            (name, phone, voter_id, dob, pwd_hash)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

    return jsonify({'message': 'Registration successful! Waiting for admin approval before you can log in.'}), 201


@app.route('/request-otp', methods=['POST'])
def request_otp_route():
    from werkzeug.security import check_password_hash
    data = request.json or {}
    raw_phone = data.get('phone', '').strip()
    password  = data.get('password', '').strip()
    if not raw_phone:
        return jsonify({'error': 'Phone number required'}), 400
    if not password:
        return jsonify({'error': 'Password required'}), 400
    phone = _normalize_phone(raw_phone)
    user = get_user(phone)
    if not user:
        return jsonify({'error': 'Phone number not registered. Please register first.'}), 404
    if not user[5]:  # approved column
        return jsonify({'error': 'Your account is pending admin approval. You cannot log in yet.'}), 403
    # Verify password before sending OTP
    conn = get_conn()
    row = conn.execute("SELECT password_hash FROM users WHERE phone=?", (phone,)).fetchone()
    conn.close()
    if not row or not row[0] or not check_password_hash(row[0], password):
        return jsonify({'error': 'Incorrect password.'}), 401
    code = generate_otp(phone)
    store_otp(phone, code)
    send_otp(phone, code)
    return jsonify({'message': 'OTP sent'}), 200


@app.route('/admin/reload-users', methods=['POST'])
@jwt_required()
def admin_reload_users():
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    reload_users_from_csv()
    return jsonify({'message': 'Users reloaded from CSV'}), 200


@app.route('/admin-login', methods=['POST'])
def admin_login():
    """Admin login with email + password."""
    from werkzeug.security import check_password_hash
    data = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    admin = get_admin_by_email(email)
    if not admin:
        return jsonify({'error': 'Admin account not found'}), 403
    if not admin[3] or not check_password_hash(admin[3], password):
        return jsonify({'error': 'Invalid password'}), 401
    token = create_access_token(identity=f"admin:{email}")
    return jsonify({
        'token': token,
        'user': {'id': admin[0], 'name': admin[1], 'email': admin[2], 'role': admin[4]}
    }), 200


@app.route('/auth', methods=['POST'])
def authenticate():
    from werkzeug.security import check_password_hash
    data = request.json or {}
    raw_phone = data.get('phone', '').strip()
    password  = data.get('password', '').strip()
    otp_input = data.get('otp', '').strip()
    if not raw_phone or not password or not otp_input:
        return jsonify({'error': 'Phone number, password, and OTP are all required'}), 400
    phone = _normalize_phone(raw_phone)
    user = get_user(phone)
    if not user:
        return jsonify({'error': 'Phone number not registered. Please register first.'}), 404
    if not user[5]:
        return jsonify({'error': 'Your account is pending admin approval. Please wait.'}), 403
    conn = get_conn()
    row = conn.execute("SELECT password_hash FROM users WHERE phone=?", (phone,)).fetchone()
    conn.close()
    if not row or not row[0] or not check_password_hash(row[0], password):
        return jsonify({'error': 'Incorrect password.'}), 401
    rec = get_otp_record(phone)
    if not rec:
        return jsonify({'error': 'No OTP found. Please request an OTP first.'}), 400
    if rec['attempts'] >= 3:
        return jsonify({'error': 'Too many OTP attempts. Request a new one.'}), 429
    if time.time() - rec['timestamp'] > 180:
        delete_otp(phone)
        return jsonify({'error': 'OTP expired. Please request a new one.'}), 401
    if not verify_otp(phone, otp_input, rec['otp']):
        increment_otp_attempts(phone)
        remaining = 3 - (rec['attempts'] + 1)
        return jsonify({'error': f'Invalid OTP. {remaining} attempts left.'}), 401
    delete_otp(phone)
    token = create_access_token(identity=phone)
    return jsonify({'token': token, 'user': {'id': user[0], 'name': user[1], 'phone': user[2], 'role': user[4]}}), 200


@app.route('/elections', methods=['GET'])
@jwt_required()
def list_elections():
    elections = get_all_elections()
    current_user = _get_current_user()
    user_id = current_user[0] if current_user else None
    result = []
    for e in elections:
        candidates_data = json.loads(e[2])
        if candidates_data and isinstance(candidates_data[0], dict):
            names  = [c['name'] for c in candidates_data]
            photos = [c.get('photo', '') for c in candidates_data]
        else:
            names  = candidates_data
            photos = []
        result.append({
            'id': e[0],
            'name': e[1],
            'candidates': names,
            'candidate_photos': photos,
            'status': e[3],
            'public_key': json.loads(e[4]) if e[4] else None,
            'results': json.loads(e[5]) if e[5] else None,
            'end_time': e[6] if len(e) > 6 else None,
            'start_time': e[7] if len(e) > 7 else None,
            'has_voted': has_voted(user_id, e[0]) if user_id else False,
        })
    return jsonify(result), 200


@app.route('/admin/election', methods=['POST'])
@jwt_required()
def create_new_election():
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.json or {}
    name = data.get('name', '').strip()
    candidates = data.get('candidates', [])
    candidate_photos = data.get('candidate_photos', [])
    end_time_raw = data.get('end_time', None)
    start_time_raw = data.get('start_time', None)
    duration_minutes = data.get('duration_minutes', 0)

    if not name or not isinstance(candidates, list) or len(candidates) < 2 or len(candidates) > 20:
        return jsonify({'error': 'Election must have between 2 and 20 candidates.'}), 400

    candidates_with_photos = [
        {'name': c, 'photo': candidate_photos[i] if i < len(candidate_photos) else ''}
        for i, c in enumerate(candidates)
    ]

    paillier = PaillierCrypto()
    public_key, private_key = paillier.generate_keypair()
    public_key_str = {'n': str(public_key['n']), 'g': str(public_key['g'])}
    shares = generate_trustee_shares(private_key, n_shares=3, threshold=2)

    def parse_iso(raw):
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
            if parsed.utcoffset() is not None:
                utc = parsed.replace(tzinfo=None) - parsed.utcoffset()
            else:
                utc = parsed - IST_OFFSET
            return utc.isoformat() + 'Z'
        except Exception:
            return raw

    end_time = parse_iso(end_time_raw)
    start_time = parse_iso(start_time_raw)

    if not end_time and duration_minutes and duration_minutes > 0:
        end_time = (datetime.utcnow() + timedelta(minutes=duration_minutes)).isoformat() + 'Z'

    print(f"DEBUG CREATE: start_time_raw={start_time_raw!r} -> start_time={start_time!r}, end_time_raw={end_time_raw!r} -> end_time={end_time!r}")
    eid = create_election(name, json.dumps(candidates_with_photos), json.dumps(public_key_str), end_time, start_time)

    trust = {}
    if os.path.exists(TRUSTEE_FILE):
        try:
            with open(TRUSTEE_FILE, 'r', encoding='utf-8') as f:
                t = f.read().strip()
                if t:
                    trust = json.loads(t)
        except Exception:
            trust = {}
    trust[str(eid)] = {'election_id': eid, 'shares': shares, 'threshold': 2}
    with open(TRUSTEE_FILE, 'w', encoding='utf-8') as f:
        json.dump(trust, f, indent=2)

    print(f"\n=== TRUSTEE SHARES FOR ELECTION {eid} ===")
    for i, s in enumerate(shares):
        print(f"Trustee {i+1} Share: {s}")
    print("=" * 50 + "\n")

    return jsonify({
        'election_id': eid,
        'message': 'Election created. Trustee shares printed in console.',
        'public_key': public_key_str,
        'end_time': end_time,
        'start_time': start_time
    }), 201


@app.route('/admin/election/<int:election_id>', methods=['DELETE'])
@jwt_required()
def delete_election_route(election_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    delete_election(election_id)

    if os.path.exists(TRUSTEE_FILE):
        try:
            with open(TRUSTEE_FILE, 'r', encoding='utf-8') as f:
                trust = json.loads(f.read())
            if str(election_id) in trust:
                del trust[str(election_id)]
                with open(TRUSTEE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(trust, f, indent=2)
        except Exception:
            pass

    try:
        bulletin = _read_bulletin_safe()
        cleaned = [v for v in bulletin if v.get('election_id') != election_id]
        _write_bulletin_safe(cleaned)
    except Exception:
        pass

    # Critical: also purge this election's entry from the private vote ledger.
    # Election IDs get reused after deletion (autoincrement reset), and each
    # election has its own Paillier keypair. Leaving stale ciphertexts behind
    # under the same election_id key means a future election reusing that ID
    # would have its real votes homomorphically summed with old ciphertexts
    # encrypted under a completely different key — corrupting every tally.
    try:
        ledger = _read_private_ledger()
        if str(election_id) in ledger:
            del ledger[str(election_id)]
            _write_private_ledger(ledger)
    except Exception:
        pass

    return jsonify({'message': 'Election deleted'}), 200


@app.route('/admin/election/<int:election_id>', methods=['PUT'])
@jwt_required()
def edit_election_route(election_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    data = request.json or {}
    name             = data.get('name', '').strip()
    candidates       = data.get('candidates', [])
    candidate_photos = data.get('candidate_photos', [])
    start_time_raw   = data.get('start_time', None)
    end_time_raw     = data.get('end_time', None)

    if not name or not isinstance(candidates, list) or len(candidates) < 2 or len(candidates) > 20:
        return jsonify({'error': 'Election must have between 2 and 20 candidates.'}), 400

    candidates_with_photos = [
        {'name': c, 'photo': candidate_photos[i] if i < len(candidate_photos) else ''}
        for i, c in enumerate(candidates)
    ]

    def parse_iso(raw):
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
            if parsed.utcoffset() is not None:
                utc = parsed.replace(tzinfo=None) - parsed.utcoffset()
            else:
                utc = parsed - IST_OFFSET
            return utc.isoformat() + 'Z'
        except Exception:
            return raw

    end_time = parse_iso(end_time_raw)
    start_time = parse_iso(start_time_raw)

    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "UPDATE elections SET name=?, candidates_json=?, end_time=?, start_time=? WHERE id=?",
        (name, json.dumps(candidates_with_photos), end_time, start_time, election_id)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': 'Election updated successfully'}), 200


@app.route('/admin/election/<int:election_id>/shares', methods=['GET'])
@jwt_required()
def get_election_shares(election_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    if not os.path.exists(TRUSTEE_FILE):
        return jsonify({'error': 'No trustee shares found'}), 404

    try:
        with open(TRUSTEE_FILE, 'r', encoding='utf-8') as f:
            trust = json.loads(f.read())
        if str(election_id) not in trust:
            return jsonify({'error': 'Shares not found for this election'}), 404
        return jsonify({'shares': trust[str(election_id)]['shares']}), 200
    except Exception as ex:
        return jsonify({'error': f'Failed to retrieve shares: {str(ex)}'}), 500


@app.route('/vote', methods=['POST'])
@jwt_required()
def cast_vote():
    user = _get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.json or {}
    election_id = data.get('election_id')
    ciphertext = data.get('ciphertext')
    anon_hash = data.get('anon_hash')
    if not election_id or not ciphertext or not anon_hash:
        return jsonify({'error': 'Missing required fields'}), 400

    if has_voted(user[0], election_id):
        return jsonify({'error': 'Already voted in this election'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404
    if e[3] != 'active':
        return jsonify({'error': 'Election not active'}), 403

    now_utc = datetime.utcnow()

    if len(e) > 6 and e[6]:
        end_time = datetime.fromisoformat(e[6].replace('Z', ''))
        if now_utc > end_time:
            return jsonify({'error': 'Voting period has ended'}), 403

    if len(e) > 7 and e[7]:
        start_time = datetime.fromisoformat(e[7].replace('Z', ''))
        if now_utc < start_time:
            start_ist = start_time + IST_OFFSET
            return jsonify({'error': f'Voting has not started yet. It begins on {start_ist.strftime("%d/%m/%Y at %I:%M %p")} IST'}), 403

    # FIX #3: Validate ciphertext structure but do NOT store candidate_index in plaintext.
    # The bulletin board entry only stores the encrypted value — candidate choice stays private.
    try:
        cdata = json.loads(ciphertext)
        candidate_index = int(cdata['candidate_index'])
        candidates = _parse_candidates(e[2])
        if candidate_index < 0 or candidate_index >= len(candidates):
            return jsonify({'error': 'Invalid candidate index'}), 400
        # Store only the encrypted value — drop the plaintext candidate_index from the bulletin
        encrypted_value = str(cdata['value'])
        if not encrypted_value.isdigit():
            return jsonify({'error': 'Invalid ciphertext value'}), 400
        # Reject anything that isn't a plausible Paillier ciphertext for this election's
        # public key. Three checks, weakest to strongest:
        #  1) size bound: 0 < c < n^2
        #  2) shape bound: a genuine ciphertext is ~uniform over [0, n^2), so it must use
        #     almost the full bit-length of n^2 — catches hand-typed/small fake values
        #     that would otherwise slip through check #1 (e.g. someone posting "1" as value)
        #  3) group membership: gcd(c, n) must be 1, or c cannot be a valid ciphertext
        election_public_key = json.loads(e[4])
        n_check = int(election_public_key['n'])
        cipher_val = int(encrypted_value)
        n2_check = n_check * n_check
        if cipher_val <= 0 or cipher_val >= n2_check:
            return jsonify({'error': 'Invalid ciphertext value'}), 400
        if cipher_val.bit_length() < 2 * n_check.bit_length() - 8:
            return jsonify({'error': 'Invalid ciphertext value'}), 400
        if math.gcd(cipher_val, n_check) != 1:
            return jsonify({'error': 'Invalid ciphertext value'}), 400
        # Reject exact-duplicate ciphertexts (replay of a stale/copied vote payload)
        ledger_check = _read_private_ledger()
        for votes_list in ledger_check.get(str(election_id), {}).values():
            if encrypted_value in votes_list:
                return jsonify({'error': 'This ciphertext has already been recorded'}), 400
    except (KeyError, ValueError, json.JSONDecodeError) as ex:
        return jsonify({'error': f'Malformed ciphertext: {str(ex)}'}), 400

    # Build a private server-side mapping so tally still works:
    # we store per-candidate encrypted tallies in a separate server structure,
    # but the public bulletin only shows the encrypted value without the index.
    entry = {
        'vote_id': f"vote_{election_id}_{int(time.time()*1000)}_{user[0]}",
        'election_id': election_id,
        # Bulletin stores only the encrypted value — candidate choice is private
        'ciphertext': json.dumps({'value': encrypted_value}),
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'anon_voter_hash': anon_hash,
    }
    entry['signature'] = sign_data(json.dumps(entry, sort_keys=True))
    _append_bulletin_entry(entry)

    # Maintain per-candidate encrypted tally in a separate private server-side ledger
    _record_private_vote(election_id, candidate_index, encrypted_value)

    mark_voted(user[0], election_id)
    return jsonify({'message': 'Vote recorded', 'vote_id': entry['vote_id']}), 201


# ── Private vote ledger (candidate_index never exposed to public bulletin) ──

PRIVATE_LEDGER_FILE = os.path.join(DATABASE_DIR, 'private_ledger.json')

def _read_private_ledger():
    if not os.path.exists(PRIVATE_LEDGER_FILE):
        return {}
    try:
        with open(PRIVATE_LEDGER_FILE, 'r', encoding='utf-8') as f:
            return json.loads(f.read().strip() or '{}')
    except Exception:
        return {}

def _write_private_ledger(data):
    with open(PRIVATE_LEDGER_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def _record_private_vote(election_id, candidate_index, encrypted_value):
    """Append an encrypted vote for a specific candidate to the private ledger."""
    ledger = _read_private_ledger()
    key = str(election_id)
    if key not in ledger:
        ledger[key] = {}
    cand_key = str(candidate_index)
    if cand_key not in ledger[key]:
        ledger[key][cand_key] = []
    ledger[key][cand_key].append(encrypted_value)
    _write_private_ledger(ledger)


@app.route('/admin/tally', methods=['POST'])
@jwt_required()
def tally_election():
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.json or {}
    election_id = data.get('election_id')
    trustee_shares = data.get('trustee_shares', [])

    if not election_id or not isinstance(trustee_shares, list) or len(trustee_shares) < 2:
        return jsonify({'error': 'Need election_id and >=2 trustee shares'}), 400

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    candidates = _parse_candidates(e[2])
    public_key = json.loads(e[4])

    ledger = _read_private_ledger()
    election_ledger = ledger.get(str(election_id), {})

    if not election_ledger:
        return jsonify({'error': 'No votes cast'}), 400

    paillier = PaillierCrypto()
    paillier.set_public_key(public_key)

    aggregated = {i: None for i in range(len(candidates))}
    for idx in range(len(candidates)):
        votes_for_cand = election_ledger.get(str(idx), [])
        for val_str in votes_for_cand:
            if not str(val_str).isdigit():
                return jsonify({'error': 'Invalid ciphertext in ledger'}), 400
            cipher_int = int(val_str)
            if aggregated[idx] is None:
                aggregated[idx] = cipher_int
            else:
                aggregated[idx] = paillier.add_ciphertexts(aggregated[idx], cipher_int)

    try:
        private_key = combine_shares(trustee_shares)
        paillier.set_private_key(private_key)
    except Exception as ex:
        return jsonify({'error': f'Invalid trustee shares: {str(ex)}'}), 400

    results = {}
    for idx, name in enumerate(candidates):
        if aggregated[idx] is None:
            results[name] = 0
        else:
            try:
                count = paillier.decrypt(aggregated[idx])
                ballots_for_cand = len(election_ledger.get(str(idx), []))
                if count < 0 or count > ballots_for_cand:
                    return jsonify({'error': f'Decryption sanity check failed for {name} — corrupted ciphertext in ledger'}), 400
                results[name] = int(count)
            except Exception as ex:
                return jsonify({'error': f'Decryption failed for {name}: {str(ex)}'}), 400

    update_election(election_id, 'tallied', json.dumps(results))
    total_votes = sum(len(v) for v in election_ledger.values())
    return jsonify({'election_id': election_id, 'results': results, 'total_votes': total_votes}), 200


@app.route('/admin/tally-auto/<int:election_id>', methods=['POST'])
@jwt_required()
def tally_election_auto(election_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    if not os.path.exists(TRUSTEE_FILE):
        return jsonify({'error': 'Trustee shares file not found'}), 404

    try:
        with open(TRUSTEE_FILE, 'r', encoding='utf-8') as f:
            trust = json.loads(f.read())
        if str(election_id) not in trust:
            return jsonify({'error': 'Shares not found for this election'}), 404
        trustee_shares = trust[str(election_id)]['shares'][:2]
    except Exception as ex:
        return jsonify({'error': f'Failed to load shares: {str(ex)}'}), 500

    candidates = _parse_candidates(e[2])
    public_key = json.loads(e[4])

    ledger = _read_private_ledger()
    election_ledger = ledger.get(str(election_id), {})

    if not election_ledger:
        return jsonify({'error': 'No votes cast'}), 400

    paillier = PaillierCrypto()
    paillier.set_public_key(public_key)

    aggregated = {i: None for i in range(len(candidates))}
    for idx in range(len(candidates)):
        votes_for_cand = election_ledger.get(str(idx), [])
        for val_str in votes_for_cand:
            if not str(val_str).isdigit():
                return jsonify({'error': 'Invalid ciphertext in ledger'}), 400
            cipher_int = int(val_str)
            if aggregated[idx] is None:
                aggregated[idx] = cipher_int
            else:
                aggregated[idx] = paillier.add_ciphertexts(aggregated[idx], cipher_int)

    try:
        private_key = combine_shares(trustee_shares)
        paillier.set_private_key(private_key)
    except Exception as ex:
        return jsonify({'error': f'Invalid trustee shares: {str(ex)}'}), 400

    results = {}
    for idx, name in enumerate(candidates):
        if aggregated[idx] is None:
            results[name] = 0
        else:
            try:
                count = paillier.decrypt(aggregated[idx])
                ballots_for_cand = len(election_ledger.get(str(idx), []))
                if count < 0 or count > ballots_for_cand:
                    return jsonify({'error': f'Decryption sanity check failed for {name} — corrupted ciphertext in ledger'}), 400
                results[name] = int(count)
            except Exception as ex:
                return jsonify({'error': f'Decryption failed for {name}: {str(ex)}'}), 400

    update_election(election_id, 'tallied', json.dumps(results))
    total_votes = sum(len(v) for v in election_ledger.values())
    return jsonify({'election_id': election_id, 'results': results, 'total_votes': total_votes}), 200


@app.route('/results/<int:election_id>', methods=['GET'])
def get_results(election_id):
    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404
    if e[3] != 'tallied':
        return jsonify({'error': 'Election not yet tallied'}), 400
    res = json.loads(e[5]) if e[5] else {}
    return jsonify({'election_id': election_id, 'name': e[1], 'status': e[3], 'results': res}), 200


@app.route('/admin/voters/<int:election_id>', methods=['GET'])
@jwt_required()
def get_voter_list(election_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id, name, phone FROM users WHERE role='voter'")
    all_voters = c.fetchall()
    c.execute("SELECT user_id FROM votes WHERE election_id=?", (election_id,))
    voted_ids = set(row[0] for row in c.fetchall())
    conn.close()

    voters = [{'id': v[0], 'name': v[1], 'phone': v[2], 'voted': v[0] in voted_ids} for v in all_voters]

    return jsonify({
        'election_id': election_id,
        'election_name': e[1],
        'total_voters': len(voters),
        'voted_count': len(voted_ids),
        'voters': voters
    }), 200


@app.route('/bulletin', methods=['GET'])
def get_bulletin():
    return jsonify(_read_bulletin_safe()), 200


@app.route('/admin/live-count/<int:election_id>', methods=['GET'])
@jwt_required()
def live_vote_count(election_id):
    """
    FIX #3: Returns only the total encrypted vote count — not per-candidate breakdown.
    Per-candidate counts are only revealed after tallying with trustee shares.
    """
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    bulletin = _read_bulletin_safe()
    total_votes = len([v for v in bulletin if v.get('election_id') == election_id])

    return jsonify({
        'election_id': election_id,
        'name': e[1],
        'status': e[3],
        'total_votes': total_votes,
        # Note: per-candidate counts are intentionally withheld until election is tallied
    }), 200


_csv_users_path = os.path.join(DATABASE_DIR, 'users.csv')
_csv_last_mtime = os.path.getmtime(_csv_users_path) if os.path.exists(_csv_users_path) else 0

@app.route('/admin/pending-voters', methods=['GET'])
@jwt_required()
def get_pending_voters():
    global _csv_last_mtime
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    csv_path = os.path.join(DATABASE_DIR, 'users.csv')
    try:
        mtime = os.path.getmtime(csv_path) if os.path.exists(csv_path) else 0
        if mtime != _csv_last_mtime:
            print(f"[CSV SYNC] File changed (mtime={mtime}), syncing...")
            reload_users_from_csv()
            _csv_last_mtime = mtime
            print(f"[CSV SYNC] Done.")
    except Exception as e:
        print(f"CSV auto-sync error: {e}")

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id,name,phone,voter_id,dob,created_at,approved FROM users WHERE role='voter' ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    voters = [{'id': r[0], 'name': r[1], 'phone': r[2], 'voter_id': r[3], 'dob': r[4], 'created_at': r[5], 'approved': bool(r[6])} for r in rows]
    return jsonify(voters), 200


import csv as _csv_module
import tempfile
import shutil

def _safe_csv_write(csv_path, rows):
    """Write CSV safely using temp file to avoid file-lock issues."""
    tmp_path = csv_path + '.tmp'
    with open(tmp_path, 'w', newline='', encoding='utf-8') as f:
        _csv_module.writer(f, lineterminator='\r\n').writerows(rows)
    os.replace(tmp_path, csv_path)

CSV_HEADER = ['name', 'phone', 'role', 'email', 'password', 'voter_id', 'dob']

def _csv_add_voter(csv_path, name, phone, voter_id, dob):
    def norm(p):
        return p.strip().replace(' ', '').replace('-', '').replace('+91', '').lstrip('0')
    rows = []
    if os.path.exists(csv_path):
        with open(csv_path, 'r', newline='', encoding='utf-8') as f:
            rows = list(_csv_module.reader(f))
    if not rows or rows[0] != CSV_HEADER:
        rows = [CSV_HEADER] + [r for r in rows if r and r[0] != 'name']
    for r in rows[1:]:
        if len(r) >= 2 and norm(r[1]) == norm(phone):
            print(f"CSV: {name} already exists, skipping")
            return
    def _fmt_dob(d):
        if not d:
            return ''
        try:
            from datetime import datetime
            return datetime.strptime(d.strip(), '%Y-%m-%d').strftime('%d-%m-%Y')
        except Exception:
            return d
    rows.append([name, phone, 'voter', '', '', voter_id or '', _fmt_dob(dob)])
    _safe_csv_write(csv_path, rows)
    print(f"CSV: added {name} ({phone})")

def _csv_remove_voter(csv_path, phone):
    def norm(p):
        return p.strip().replace(' ', '').replace('-', '').replace('+91', '').lstrip('0')
    if not os.path.exists(csv_path):
        return
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        rows = list(_csv_module.reader(f))
    header = rows[0] if rows else []
    data = rows[1:] if len(rows) > 1 else []
    norm_phone = norm(phone)
    filtered = [r for r in data if len(r) < 2 or norm(r[1]) != norm_phone]
    _safe_csv_write(csv_path, ([header] if header else []) + filtered)
    print(f"CSV: removed {len(data)-len(filtered)} row(s) for phone {norm_phone}")

@app.route('/admin/approve-voter/<int:user_id>', methods=['POST'])
@jwt_required()
def approve_voter(user_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    conn = get_conn()
    c = conn.cursor()
    c.execute("UPDATE users SET approved=1 WHERE id=? AND role='voter'", (user_id,))
    conn.commit()
    row = conn.execute(
        "SELECT name, phone, voter_id, dob, password_hash FROM users WHERE id=?", (user_id,)
    ).fetchone()
    conn.close()

    if row:
        try:
            name, phone, voter_id, dob, _ = row
            csv_path = os.path.join(DATABASE_DIR, 'users.csv')
            _csv_add_voter(csv_path, name, phone, voter_id, dob)
            global _csv_last_mtime
            _csv_last_mtime = os.path.getmtime(csv_path)
        except Exception as e:
            import traceback
            print(f"CSV ERROR during approve: {e}")
            traceback.print_exc()

    return jsonify({'message': 'Voter approved'}), 200


@app.route('/admin/reject-voter/<int:user_id>', methods=['DELETE'])
@jwt_required()
def reject_voter(user_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    conn = get_conn()
    c = conn.cursor()
    row = conn.execute("SELECT phone FROM users WHERE id=? AND role='voter'", (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Voter not found'}), 404
    phone = row[0]
    c.execute("DELETE FROM users WHERE id=? AND role='voter'", (user_id,))
    conn.commit()
    conn.close()

    try:
        csv_path = os.path.join(DATABASE_DIR, 'users.csv')
        _csv_remove_voter(csv_path, phone)
        global _csv_last_mtime
        _csv_last_mtime = os.path.getmtime(csv_path)
    except Exception as e:
        import traceback
        print(f"CSV ERROR during reject: {e}")
        traceback.print_exc()

    return jsonify({'message': 'Voter rejected and removed'}), 200


@app.route('/admin/voter-status/<int:election_id>', methods=['GET'])
@jwt_required()
def voter_status(election_id):
    """Returns list of all voters with voted/not voted status for an election."""
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    all_users = get_all_users()
    voters = [usr for usr in all_users if usr[5] == 'voter']

    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT user_id FROM votes WHERE election_id=?", (election_id,))
    voted_ids = {row[0] for row in c.fetchall()}
    conn.close()

    result = []
    for usr in voters:
        result.append({
            'id': usr[0],
            'name': usr[1],
            'phone': usr[2],
            'voter_id': usr[3],
            'voted': usr[0] in voted_ids
        })

    return jsonify({
        'election_id': election_id,
        'election_name': e[1],
        'total_voters': len(result),
        'total_voted': len(voted_ids),
        'voters': result
    }), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)