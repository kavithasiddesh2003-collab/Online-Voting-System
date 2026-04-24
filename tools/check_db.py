import sqlite3
from pathlib import Path


def main() -> None:
    db_path = Path(__file__).resolve().parents[1] / "database" / "database.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db_path))
    try:
        integrity = con.execute("PRAGMA integrity_check").fetchone()
        tables = con.execute("select name from sqlite_master where type='table'").fetchall()
        print("db:", db_path)
        print("integrity_check:", integrity)
        print("tables:", tables)
    finally:
        con.close()


if __name__ == "__main__":
    main()

