import csv
import os
import sqlite3

CORE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.abspath(os.path.join(CORE_DIR, "..", ".."))
DATABASE_DIR = os.path.join(ROOT_DIR, "database")

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
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = get_conn()
    c = conn.cursor()

    if USE_MYSQL:
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) UNIQUE,
                email VARCHAR(320) UNIQUE,
                password_hash VARCHAR(255),
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            role TEXT DEFAULT 'voter'
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS elections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            candidates_json TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            paillier_public_key TEXT,
            results_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TEXT
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

    conn.commit()
    conn.close()
    seed_users_from_csv()


def seed_users_from_csv():
    """
    CSV columns: name, phone, role, email, password
    - Voters  : need name + phone
    - Admins  : need name + email + password (phone optional)
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
            role     = (row.get("role") or "voter").strip().lower()
            if not name:
                continue
            pwd_hash = generate_password_hash(password) if password else None
            try:
                if USE_MYSQL:
                    c.execute(
                        "INSERT IGNORE INTO users (name,phone,email,password_hash,role) VALUES (%s,%s,%s,%s,%s)",
                        (name, phone, email, pwd_hash, role),
                    )
                else:
                    c.execute(
                        "INSERT OR IGNORE INTO users (name,phone,email,password_hash,role) VALUES (?,?,?,?,?)",
                        (name, phone, email, pwd_hash, role),
                    )
            except Exception:
                pass
    conn.commit()
    conn.close()


def reload_users_from_csv():
    seed_users_from_csv()


def get_user(phone):
    """Return (id, name, phone, created_at, role) or None — lookup by phone."""
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"SELECT id,name,phone,created_at,role FROM users WHERE phone={PH}", (phone,)
    )
    row = c.fetchone()
    conn.close()
    return row


def get_admin_by_email(email):
    """Return (id, name, email, password_hash, role) or None — lookup admin by email."""
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"SELECT id,name,email,password_hash,role FROM users WHERE email={PH} AND role='admin'",
        (email.strip().lower(),)
    )
    row = c.fetchone()
    conn.close()
    return row


def create_user(name, phone):
    conn = get_conn()
    c = conn.cursor()
    c.execute(f"INSERT INTO users (name,phone) VALUES ({PH},{PH})", (name, phone))
    conn.commit()
    conn.close()


def get_election(election_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"SELECT id,name,candidates_json,status,paillier_public_key,results_json,end_time FROM elections WHERE id={PH}",
        (election_id,),
    )
    row = c.fetchone()
    conn.close()
    return row


def get_all_elections():
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        "SELECT id,name,candidates_json,status,paillier_public_key,results_json,end_time FROM elections ORDER BY id DESC"
    )
    rows = c.fetchall()
    conn.close()
    return rows


def create_election(name, candidates_json, public_key_json, end_time=None):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        f"INSERT INTO elections (name,candidates_json,status,paillier_public_key,end_time) VALUES ({PH},{PH},{PH},{PH},{PH})",
        (name, candidates_json, "active", public_key_json, end_time),
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
    conn.commit()
    conn.close()