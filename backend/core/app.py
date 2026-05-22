# backend/app.py
import json
import os
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
    reload_users_from_csv, delete_election, get_all_users
)
from crypto import (
    PaillierCrypto, generate_trustee_shares, combine_shares, sign_data
)
from auth import generate_otp, verify_otp, send_otp

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY", "dev-secret-key-change-in-production"
)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)
CORS(app,
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     supports_credentials=False)
jwt = JWTManager(app)

HERE = os.path.dirname(__file__)
ROOT_DIR = os.path.abspath(os.path.join(HERE, '..', '..'))
DATABASE_DIR = os.path.join(ROOT_DIR, 'database')
BULLETIN_FILE = os.path.join(DATABASE_DIR, 'bulletin.json')
TRUSTEE_FILE = os.path.join(DATABASE_DIR, 'trustee_keys.json')

os.makedirs(DATABASE_DIR, exist_ok=True)

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

otp_store = {}


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
            # Return same shape as get_user: (id, name, identifier, created_at, role)
            return (admin[0], admin[1], admin[2], None, admin[4])
        return None
    return get_user(identity)


@app.route('/register', methods=['POST'])
def register():
    from werkzeug.security import generate_password_hash
    data = request.json or {}
    raw_phone = data.get('phone', '').strip()
    name      = data.get('name', '').strip()
    voter_id  = data.get('voter_id', '').strip() or None
    dob       = data.get('dob', '').strip() or None
    password  = data.get('password', '').strip() or None

    if not raw_phone:
        return jsonify({'error': 'Phone number required'}), 400
    phone = _normalize_phone(raw_phone)
    user = get_user(phone)
    if not user:
        return jsonify({'error': 'Phone number not found on voter roll. Contact admin.'}), 403

    # Check if voter has already completed registration (password already set)
    try:
        conn = __import__('models').get_conn()
        c = conn.cursor()
        c.execute("SELECT password_hash FROM users WHERE phone=?", (phone,))
        row = c.fetchone()
        conn.close()
        if row and row[0]:
            return jsonify({'error': 'You are already registered. Please sign in using your password.'}), 409
    except Exception:
        pass

    pwd_hash = generate_password_hash(password) if password else None

    # Update voter_id, dob, password_hash if provided
    if voter_id or dob or pwd_hash:
        try:
            conn = __import__('models').get_conn()
            c = conn.cursor()
            c.execute(
                "UPDATE users SET voter_id=?, dob=?, password_hash=? WHERE phone=?",
                (voter_id, dob, pwd_hash, phone)
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

    return jsonify({'message': 'Registration successful! You can now sign in.', 'phone': phone}), 200


@app.route('/request-otp', methods=['POST'])
def request_otp_route():
    data = request.json or {}
    raw_phone = data.get('phone', '').strip()
    if not raw_phone:
        return jsonify({'error': 'Phone number required'}), 400
    phone = _normalize_phone(raw_phone)
    user = get_user(phone)
    if not user:
        return jsonify({'error': 'Phone number not found on voter roll.'}), 403
    if not user[5]:  # approved column
        return jsonify({'error': 'Your account is pending admin approval. Please wait for the admin to approve your registration.'}), 403
    code = generate_otp(phone)
    otp_store[phone] = {'otp': code, 'timestamp': time.time(), 'attempts': 0}
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
    # admin = (id, name, email, password_hash, role)
    if not admin[3] or not check_password_hash(admin[3], password):
        return jsonify({'error': 'Invalid password'}), 401
    # Use email as JWT identity for admins
    token = create_access_token(identity=f"admin:{email}")
    return jsonify({
        'token': token,
        'user': {'id': admin[0], 'name': admin[1], 'email': admin[2], 'role': admin[4]}
    }), 200


@app.route('/auth', methods=['POST'])
def authenticate():
    data = request.json or {}
    raw_phone = data.get('phone', '').strip()
    otp_input = data.get('otp', '').strip()
    if not raw_phone or not otp_input:
        return jsonify({'error': 'Phone number and OTP required'}), 400
    phone = _normalize_phone(raw_phone)
    if phone not in otp_store:
        return jsonify({'error': 'No OTP request found. Please request a code first.'}), 404
    rec = otp_store[phone]
    if rec['attempts'] >= 3:
        return jsonify({'error': 'Too many attempts. Request a new OTP.'}), 429
    if not verify_otp(phone, otp_input, rec['otp']):
        rec['attempts'] += 1
        return jsonify({'error': f'Invalid OTP. {3 - rec["attempts"]} attempts left.'}), 401
    if time.time() - rec['timestamp'] > 300:
        del otp_store[phone]
        return jsonify({'error': 'OTP expired. Request a new OTP.'}), 401
    del otp_store[phone]
    user = get_user(phone)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if not user[5]:  # approved column
        return jsonify({'error': 'Your account is pending admin approval. Please wait.'}), 403
    token = create_access_token(identity=phone)
    return jsonify({'token': token, 'user': {'id': user[0], 'name': user[1], 'phone': user[2], 'role': user[4]}}), 200


@app.route('/elections', methods=['GET'])
@jwt_required()
def list_elections():
    elections = get_all_elections()
    result = []
    for e in elections:
        candidates_data = json.loads(e[2])
        # candidates_data can be a list of names or list of dicts with name/photo
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
            'end_time': e[6] if len(e) > 6 else None,
            'start_time': e[7] if len(e) > 7 else None
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
    # Legacy support: also accept duration_minutes
    duration_minutes = data.get('duration_minutes', 0)

    if not name or not isinstance(candidates, list) or len(candidates) < 2:
        return jsonify({'error': 'Invalid election data'}), 400

    # Store candidates as list of dicts with name and photo
    candidates_with_photos = [
        {'name': c, 'photo': candidate_photos[i] if i < len(candidate_photos) else ''}
        for i, c in enumerate(candidates)
    ]

    paillier = PaillierCrypto()
    public_key, private_key = paillier.generate_keypair()
    public_key_str = {'n': str(public_key['n']), 'g': str(public_key['g'])}
    shares = generate_trustee_shares(private_key, n_shares=3, threshold=2)

    def parse_iso(raw):
        """Parse ISO datetime and store as UTC ISO string (with Z suffix)."""
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
            if parsed.utcoffset() is not None:
                # timezone-aware: convert to UTC naive
                utc = parsed.replace(tzinfo=None) - parsed.utcoffset()
            else:
                # naive datetime from frontend datetime-local input is local IST, convert to UTC
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

    # Clean trustee shares
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

    # Clean bulletin entries for this election
    try:
        bulletin = _read_bulletin_safe()
        cleaned = [v for v in bulletin if v.get('election_id') != election_id]
        _write_bulletin_safe(cleaned)
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

    if not name or not isinstance(candidates, list) or len(candidates) < 2:
        return jsonify({'error': 'Invalid election data'}), 400

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

    conn = __import__('models').get_conn()
    c = conn.cursor()
    c.execute(
        "UPDATE elections SET name=?, candidates_json=?, end_time=?, start_time=? WHERE id=?",
        (name, json.dumps(candidates_with_photos), end_time, start_time, election_id)
    )
    conn.commit()
    conn.close()

    return jsonify({'message': 'Election updated successfully'}), 200
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
    if user[4] == 'admin':
        return jsonify({'error': 'Admins are not allowed to vote'}), 403

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
            # Display in IST for user-friendly message
            start_ist = start_time + IST_OFFSET
            return jsonify({'error': f'Voting has not started yet. It begins on {start_ist.strftime("%d/%m/%Y at %I:%M %p")} IST'}), 403

    entry = {
        'vote_id': f"vote_{election_id}_{int(time.time()*1000)}_{user[0]}",
        'election_id': election_id,
        'ciphertext': ciphertext,
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'anon_voter_hash': anon_hash
    }
    entry['signature'] = sign_data(json.dumps(entry, sort_keys=True))

    _append_bulletin_entry(entry)
    mark_voted(user[0], election_id)
    return jsonify({'message': 'Vote recorded', 'vote_id': entry['vote_id']}), 201


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

    bulletin = _read_bulletin_safe()
    votes = [v for v in bulletin if v.get('election_id') == election_id]
    if not votes:
        return jsonify({'error': 'No votes cast'}), 400

    paillier = PaillierCrypto()
    paillier.set_public_key(public_key)

    aggregated = {i: None for i in range(len(candidates))}
    for v in votes:
        try:
            cdata = json.loads(v['ciphertext'])
            idx = int(cdata['candidate_index'])
            val_str = str(cdata['value'])
            if not val_str.isdigit():
                return jsonify({'error': 'Invalid ciphertext format'}), 400
            cipher_int = int(val_str)
            if aggregated[idx] is None:
                aggregated[idx] = cipher_int
            else:
                aggregated[idx] = paillier.add_ciphertexts(aggregated[idx], cipher_int)
        except Exception as ex:
            return jsonify({'error': f'Corrupted vote: {str(ex)}'}), 400

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
                if count < 0:
                    return jsonify({'error': f'Decryption sanity check failed for {name}'}), 400
                results[name] = int(count)
            except Exception as ex:
                return jsonify({'error': f'Decryption failed for {name}: {str(ex)}'}), 400

    update_election(election_id, 'tallied', json.dumps(results))
    return jsonify({'election_id': election_id, 'results': results, 'total_votes': len(votes)}), 200


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

    bulletin = _read_bulletin_safe()
    votes = [v for v in bulletin if v.get('election_id') == election_id]
    if not votes:
        return jsonify({'error': 'No votes cast'}), 400

    paillier = PaillierCrypto()
    paillier.set_public_key(public_key)

    aggregated = {i: None for i in range(len(candidates))}
    for v in votes:
        try:
            cdata = json.loads(v['ciphertext'])
            idx = int(cdata['candidate_index'])
            val_str = str(cdata['value'])
            if not val_str.isdigit():
                return jsonify({'error': 'Invalid ciphertext format'}), 400
            cipher_int = int(val_str)
            if aggregated[idx] is None:
                aggregated[idx] = cipher_int
            else:
                aggregated[idx] = paillier.add_ciphertexts(aggregated[idx], cipher_int)
        except Exception as ex:
            return jsonify({'error': f'Corrupted vote: {str(ex)}'}), 400

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
                if count < 0:
                    return jsonify({'error': f'Decryption sanity check failed for {name}'}), 400
                results[name] = int(count)
            except Exception as ex:
                return jsonify({'error': f'Decryption failed for {name}: {str(ex)}'}), 400

    update_election(election_id, 'tallied', json.dumps(results))
    return jsonify({'election_id': election_id, 'results': results, 'total_votes': len(votes)}), 200


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

    # Get all voters
    c.execute("SELECT id, name, phone FROM users WHERE role='voter'")
    all_voters = c.fetchall()

    # Get who voted in this election
    c.execute("SELECT user_id FROM votes WHERE election_id=?", (election_id,))
    voted_ids = set(row[0] for row in c.fetchall())
    conn.close()

    voters = []
    for v in all_voters:
        voters.append({
            'id': v[0],
            'name': v[1],
            'phone': v[2],
            'voted': v[0] in voted_ids
        })

    return jsonify({
        'election_id': election_id,
        'election_name': e[1],
        'total_voters': len(voters),
        'voted_count': len(voted_ids),
        'voters': voters
    }), 200
def get_bulletin():
    return jsonify(_read_bulletin_safe()), 200


@app.route('/admin/live-count/<int:election_id>', methods=['GET'])
@jwt_required()
def live_vote_count(election_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    candidates = _parse_candidates(e[2])
    bulletin = _read_bulletin_safe()
    votes = [v for v in bulletin if v.get('election_id') == election_id]

    # Count votes per candidate index from bulletin (candidate_index is stored in plaintext)
    counts = {name: 0 for name in candidates}
    for v in votes:
        try:
            cdata = json.loads(v['ciphertext'])
            idx = int(cdata['candidate_index'])
            if 0 <= idx < len(candidates):
                counts[candidates[idx]] += 1
        except Exception:
            pass

    return jsonify({
        'election_id': election_id,
        'name': e[1],
        'status': e[3],
        'total_votes': len(votes),
        'counts': counts
    }), 200


@app.route('/admin/pending-voters', methods=['GET'])
@jwt_required()
def get_pending_voters():
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    conn = __import__('models').get_conn()
    c = conn.cursor()
    c.execute("SELECT id,name,phone,voter_id,dob,created_at,approved FROM users WHERE role='voter' ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    voters = [{'id': r[0], 'name': r[1], 'phone': r[2], 'voter_id': r[3], 'dob': r[4], 'created_at': r[5], 'approved': bool(r[6])} for r in rows]
    return jsonify(voters), 200


@app.route('/admin/approve-voter/<int:user_id>', methods=['POST'])
@jwt_required()
def approve_voter(user_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    conn = __import__('models').get_conn()
    c = conn.cursor()
    c.execute("UPDATE users SET approved=1 WHERE id=? AND role='voter'", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Voter approved'}), 200


@app.route('/admin/reject-voter/<int:user_id>', methods=['DELETE'])
@jwt_required()
def reject_voter(user_id):
    u = _get_current_user()
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    conn = __import__('models').get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE id=? AND role='voter'", (user_id,))
    conn.commit()
    conn.close()
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

    # Get all voters
    all_users = get_all_users()
    voters = [usr for usr in all_users if usr[5] == 'voter']  # role is index 5

    # Get who voted
    conn = __import__('models').get_conn()
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