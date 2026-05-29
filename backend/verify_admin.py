import sys
sys.path.insert(0, 'core')
from models import get_conn
from werkzeug.security import generate_password_hash, check_password_hash

c = get_conn()
row = c.execute("SELECT password_hash FROM users WHERE email='kavithats1211@gmail.com' AND role='admin'").fetchone()
print('Hash exists:', row is not None)
print('Password check:', check_password_hash(row[0], 'kavi@2003') if row else 'NO ROW')
