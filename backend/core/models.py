import csv
import os
import sqlite3

CORE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.abspath(os.path.join(CORE_DIR, "..", ".."))
DATABASE_DIR = os.path.join(ROOT_DIR, "database")
os.makedirs(DATABASE_DIR, exist_ok=True)

DB_PATH = os.path.join(DATABASE_DIR, "database.db")
USERS_CSV = os.path.join(DATABASE_DIR, "users.csv")

MYSQL_HOST = os.getenv("MYSQL_HOST", "").strip()
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "").strip()
USE_MYSQL = bool(MYSQL_HOST and MYSQL_DATABASE)

if USE_MYSQL:
    import pymysql

PH = "%s" if USE_MYSQL else "?"


def get_conn():
    os.makedirs(DATABASE_DIR, exist_ok=True)
    if USE_MYSQL:
        return pymysql.connect(
            host=MYSQL_HOST,
            port=int(os.getenv("MYSQL_PORT", "3306")),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
            database=MYSQL_DATABASE,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.Cursor,
            autocommit=False,
        )
    return sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)


def init_db():
    conn = get_conn()
    if not USE_MYSQL:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
    c = conn.cursor()

    if USE_MYSQL:
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) UNIQUE,
                email VARCHAR(320) UNIQUE,
                password_hash VARCHAR(255),
                voter_id VARCHAR(50),
                dob VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                role VARCHAR(32) DEFAULT 'voter'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS elections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(512) NOT NULL,
                candidates_json TEXT NOT NULL,
                status VARCHAR(32) DEFAULT 'active',
                paillier_public_key TEXT,
                results_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time VARCHAR(64) NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                election_id INT NOT NULL,
                voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_user_election (user_id, election_id),
                CONSTRAINT fk_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_votes_election FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
    else:
        c.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            voter_id TEXT,
            dob TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            role TEXT DEFAULT 'voter',
            approved INTEGER DEFAULT 0
        )""")
        # Migrate existing DBs: add approved column if missing
        try:
            c.execute('ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0')
        except Exception:
            pass
        c.execute("""CREATE TABLE IF NOT EXISTS elections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            candidates_json TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            paillier_public_key TEXT,
            results_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TEXT,
            start_time TEXT
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            election_id INTEGER NOT NULL,
            voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, election_id)
        )""")
        try:
            c.execute("SELECT end_time FROM elections LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE elections ADD COLUMN end_time TEXT")
        try:
            c.execute("SELECT start_time FROM elections LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE elections ADD COLUMN start_time TEXT")
        try:
            c.execute("SELECT approved FROM users LIMIT 1")
        except sqlite3.OperationalError:
            c.execute("ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0")
            # Auto-approve existing voters seeded from CSV
            c.execute("UPDATE users SET approved=1 WHERE role='voter'")

        # Fix voters with NULL password_hash — generate from name + DOB
        from werkzeug.security import generate_password_hash as _gph
        null_voters = conn.execute(
            "SELECT id, name, dob FROM users WHERE role='voter' AND (password_hash IS NULL OR password_hash='')"
        ).fetchall()
        for vid, vname, vdob in null_voters:
            try:
                name_part = (vname or '').strip().lower().replace(' ', '')[:4]
                dob_parts = (vdob or '').replace('/', '-').split('-')
                day_part = dob_parts[2] if len(dob_parts) == 3 and len(dob_parts[0]) == 4 else (dob_parts[0] if dob_parts else '01')
                auto_pass = name_part + day_part.zfill(2)
                pwd_hash = _gph(auto_pass)
                conn.execute("UPDATE users SET password_hash=? WHERE id=?", (pwd_hash, vid))
            except Exception:
                pass
        conn.commit()

    conn.commit()
    conn.close()
    seed_users_from_csv()


def seed_users_from_csv():
    """
    CSV columns: name, phone, role, email, password, voter_id, dob
    - Voters : need name + phone
    - Admins : need name + email + password
    """
    if not os.path.exists(USERS_CSV):
        return
    from werkzeug.security import generate_password_hash
    conn = get_conn()
    c = conn.cursor()
    with open(USERS_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name     = (row.get("name") or "").strip()
            phone    = (row.get("phone") or "").strip() or None
            email    = (row.get("email") or "").strip().lower() or None
            password = (row.get("password") or "").strip() or None
            voter_id = (row.get("voter_id") or "").strip() or None
            dob      = (row.get("dob") or "").strip() or None
            role     = (row.get("role") or "voter").strip().lower()
            if not name:
                continue
            pwd_hash = generate_password_hash(password) if password else None
            # Auto-generate password for voters with no password: first 4 letters of name + day of DOB
            if not pwd_hash and role == 'voter' and name and dob:
                try:
                    name_part = name.strip().lower().replace(' ', '')[:4]
                    # DOB can be DD-MM-YYYY or YYYY-MM-DD
                    dob_parts = dob.replace('/', '-').split('-')
                    day_part = dob_parts[2] if len(dob_parts[0]) == 4 else dob_parts[0]
                    auto_pass = name_part + day_part.zfill(2)
                    pwd_hash = generate_password_hash(auto_pass)
                except Exception:
                    pass
            try:
                if USE_MYSQL:
                    c.execute(
                        "INSERT IGNORE INTO users (name,phone,email,password_hash,voter_id,dob,role) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                        (name, phone, email, pwd_hash, voter_id, dob, role),
                    )
                else:
                    # CSV-seeded users are pre-verified → approved=1
                    c.execute(
                        "INSERT OR IGNORE INTO users (name,phone,email,password_hash,voter_id,dob,role,approved) VALUES (?,?,?,?,?,?,?,1)",
                        (name, phone, email, pwd_hash, voter_id, dob, role),
                    )
            except Exception:
                pass
    conn.commit()
    conn.close()


def reload_users_from_csv():
    """
    Full two-way sync from users.csv → database (voters only).
    - New rows in CSV → inserted into DB
    - Rows removed from CSV → deleted from DB (voter role only)
    - Changed fields (voter_id, name, dob) → updated in DB
    Admins are never touched.
    """
    if not os.path.exists(USERS_CSV):
        return
    from werkzeug.security import generate_password_hash

    conn = get_conn()
    c = conn.cursor()

    # Read CSV into a dict keyed by normalised phone
    def norm(p):
        return (p or '').strip().replace(' ', '').replace('-', '')

    csv_voters = {}
    with open(USERS_CSV, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            role = (row.get('role') or 'voter').strip().lower()
            if role != 'voter':
                continue
            phone = norm(row.get('phone', ''))
            name  = (row.get('name') or '').strip()
            if not name or not phone:
                continue
            csv_voters[phone] = {
                'name':     name,
                'phone':    row.get('phone', '').strip(),
                'voter_id': (row.get('voter_id') or '').strip() or None,
                'dob':      (row.get('dob') or '').strip() or None,
                'password': (row.get('password') or '').strip() or None,
            }

    # Fetch all current voters from DB
    c.execute("SELECT id, name, phone, voter_id, dob FROM users WHERE role='voter'")
    db_voters = {norm(r[2]): {'id': r[0], 'name': r[1], 'phone': r[2], 'voter_id': r[3], 'dob': r[4]} for r in c.fetchall()}

    # 1. Delete voters in DB but not in CSV
    for phone, dbv in db_voters.items():
        if phone not in csv_voters:
            c.execute("DELETE FROM votes WHERE user_id=?", (dbv['id'],))
            c.execute("DELETE FROM users WHERE id=? AND role='voter'", (dbv['id'],))

    # 2. Update changed fields for existing voters
    for phone, row in csv_voters.items():
        if phone in db_voters:
            dbv = db_voters[phone]
            if (row['name'] != dbv['name'] or
                row['voter_id'] != dbv['voter_id'] or
                row['dob'] != dbv['dob']):
                c.execute(
                    "UPDATE users SET name=?, voter_id=?, dob=? WHERE id=? AND role='voter'",
                    (row['name'], row['voter_id'], row['dob'], dbv['id'])
                )

    # 3. Insert new voters from CSV not yet in DB
    for phone, row in csv_voters.items():
        if phone not in db_voters:
            pwd_hash = generate_password_hash(row['password']) if row['password'] else None
            if not pwd_hash and row['name'] and row['dob']:
                try:
                    name_part = row['name'].strip().lower().replace(' ', '')[:4]
                    dob_parts = row['dob'].replace('/', '-').split('-')
                    day_part = dob_parts[2] if len(dob_parts[0]) == 4 else dob_parts[0]
                    pwd_hash = generate_password_hash(name_part + day_part.zfill(2))
                except Exception:
                    pass
            c.execute(
                "INSERT OR IGNORE INTO users (name,phone,voter_id,dob,password_hash,role,approved) VALUES (?,?,?,?,?,?,1)",
                (row['name'], row['phone'], row['voter_id'], row['dob'], pwd_hash, 'voter')
            )

    conn.commit()
    conn.close()


def get_user(phone):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"SELECT id,name,phone,created_at,role,approved FROM users WHERE phone={PH}", (phone,)
    )
    row = c.fetchone()
    conn.close()
    return row


def get_admin_by_email(email):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"SELECT id,name,email,password_hash,role FROM users WHERE email={PH} AND role='admin'",
        (email.strip().lower(),)
    )
    row = c.fetchone()
    conn.close()
    return row


def create_user(name, phone, voter_id=None, dob=None, password_hash=None):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"INSERT INTO users (name,phone,voter_id,dob,password_hash) VALUES ({PH},{PH},{PH},{PH},{PH})",
        (name, phone, voter_id, dob, password_hash)
    )
    conn.commit()
    conn.close()


def get_election(election_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"SELECT id,name,candidates_json,status,paillier_public_key,results_json,end_time,start_time FROM elections WHERE id={PH}",
        (election_id,),
    )
    row = c.fetchone()
    conn.close()
    return row


def get_all_elections():
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "SELECT id,name,candidates_json,status,paillier_public_key,results_json,end_time,start_time FROM elections ORDER BY id DESC"
    )
    rows = c.fetchall()
    conn.close()
    return rows


def create_election(name, candidates_json, public_key_json, end_time=None, start_time=None):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"INSERT INTO elections (name,candidates_json,status,paillier_public_key,end_time,start_time) VALUES ({PH},{PH},{PH},{PH},{PH},{PH})",
        (name, candidates_json, "active", public_key_json, end_time, start_time),
    )
    conn.commit()
    eid = c.lastrowid
    conn.close()
    return eid


def update_election(election_id, status, results_json):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"UPDATE elections SET status={PH}, results_json={PH} WHERE id={PH}",
        (status, results_json, election_id),
    )
    conn.commit()
    conn.close()


def has_voted(user_id, election_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"SELECT 1 FROM votes WHERE user_id={PH} AND election_id={PH}",
        (user_id, election_id),
    )
    row = c.fetchone()
    conn.close()
    return row is not None


def mark_voted(user_id, election_id):
    conn = get_conn()
    c = conn.cursor()
    if USE_MYSQL:
        c.execute(
            "INSERT IGNORE INTO votes (user_id, election_id) VALUES (%s,%s)",
            (user_id, election_id),
        )
    else:
        c.execute(
            "INSERT OR IGNORE INTO votes (user_id, election_id) VALUES (?,?)",
            (user_id, election_id),
        )
    conn.commit()
    conn.close()


def delete_election(election_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute(f"DELETE FROM votes WHERE election_id={PH}", (election_id,))
    c.execute(f"DELETE FROM elections WHERE id={PH}", (election_id,))
    if not USE_MYSQL:
        # Reset autoincrement so next election gets the lowest available ID
        c.execute("SELECT MAX(id) FROM elections")
        row = c.fetchone()
        max_id = row[0] if row and row[0] is not None else 0
        c.execute(
            "UPDATE sqlite_sequence SET seq=? WHERE name='elections'",
            (max_id,)
        )
    conn.commit()
    conn.close()


def get_all_users():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT id,name,phone,voter_id,dob,role,created_at FROM users ORDER BY id")
    rows = c.fetchall()
    conn.close()
    return rows