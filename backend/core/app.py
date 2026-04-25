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
    init_db, get_user, get_election, create_election,
    update_election, get_all_elections, has_voted, mark_voted,
    reload_users_from_csv, delete_election
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
CORS(app, resources={r"/*": {"origins": "*"}})
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


@app.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    raw_phone = data.get('phone', '').strip()
    if not raw_phone:
        return jsonify({'error': 'Phone number required'}), 400
    phone = _normalize_phone(raw_phone)
    user = get_user(phone)
    if not user:
        return jsonify({'error': 'Registration closed. Phone number not found on voter roll.'}), 403
    code = generate_otp(phone)
    otp_store[phone] = {'otp': code, 'timestamp': time.time(), 'attempts': 0}
    send_otp(phone, code)
    return jsonify({'message': 'OTP sent to your phone. Use Login to continue.', 'phone': phone}), 200


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
    code = generate_otp(phone)
    otp_store[phone] = {'otp': code, 'timestamp': time.time(), 'attempts': 0}
    send_otp(phone, code)
    return jsonify({'message': 'OTP sent'}), 200


@app.route('/admin/reload-users', methods=['POST'])
@jwt_required()
def admin_reload_users():
    phone = get_jwt_identity()
    u = get_user(phone)
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    reload_users_from_csv()
    return jsonify({'message': 'Users reloaded from CSV'}), 200


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
    token = create_access_token(identity=phone)
    return jsonify({'token': token, 'user': {'id': user[0], 'name': user[1], 'phone': user[2], 'role': user[4]}}), 200


@app.route('/elections', methods=['GET'])
@jwt_required()
def list_elections():
    elections = get_all_elections()
    return jsonify([{
        'id': e[0],
        'name': e[1],
        'candidates': json.loads(e[2]),
        'status': e[3],
        'public_key': json.loads(e[4]) if e[4] else None,
        'end_time': e[6] if len(e) > 6 else None
    } for e in elections]), 200


@app.route('/admin/election', methods=['POST'])
@jwt_required()
def create_new_election():
    phone = get_jwt_identity()
    u = get_user(phone)
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.json or {}
    name = data.get('name', '').strip()
    candidates = data.get('candidates', [])
    duration_minutes = data.get('duration_minutes', 0)

    if not name or not isinstance(candidates, list) or len(candidates) < 2:
        return jsonify({'error': 'Invalid election data'}), 400

    paillier = PaillierCrypto()
    public_key, private_key = paillier.generate_keypair()
    public_key_str = {'n': str(public_key['n']), 'g': str(public_key['g'])}
    shares = generate_trustee_shares(private_key, n_shares=3, threshold=2)

    end_time = None
    if duration_minutes and duration_minutes > 0:
        now_utc = datetime.utcnow()
        now_ist = now_utc + IST_OFFSET
        end_ist = now_ist + timedelta(minutes=duration_minutes)
        end_time = end_ist.isoformat()

    eid = create_election(name, json.dumps(candidates), json.dumps(public_key_str), end_time)

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
        'end_time': end_time
    }), 201


@app.route('/admin/election/<int:election_id>', methods=['DELETE'])
@jwt_required()
def delete_election_route(election_id):
    phone = get_jwt_identity()
    u = get_user(phone)
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

    return jsonify({'message': 'Election deleted'}), 200


@app.route('/admin/election/<int:election_id>/shares', methods=['GET'])
@jwt_required()
def get_election_shares(election_id):
    phone = get_jwt_identity()
    u = get_user(phone)
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
    phone = get_jwt_identity()
    user = get_user(phone)
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

    if len(e) > 6 and e[6]:
        end_time = datetime.fromisoformat(e[6])
        now_utc = datetime.utcnow()
        now_ist = now_utc + IST_OFFSET
        if now_ist > end_time:
            return jsonify({'error': 'Voting period has ended'}), 403

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
    phone = get_jwt_identity()
    u = get_user(phone)
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

    candidates = json.loads(e[2])
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
    phone = get_jwt_identity()
    u = get_user(phone)
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

    candidates = json.loads(e[2])
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


@app.route('/bulletin', methods=['GET'])
def get_bulletin():
    return jsonify(_read_bulletin_safe()), 200


@app.route('/admin/live-count/<int:election_id>', methods=['GET'])
@jwt_required()
def live_vote_count(election_id):
    phone = get_jwt_identity()
    u = get_user(phone)
    if not u or u[4] != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    e = get_election(election_id)
    if not e:
        return jsonify({'error': 'Election not found'}), 404

    candidates = json.loads(e[2])
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


if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)
