import sys
sys.path.insert(0, 'core')
from models import get_conn

c = get_conn()
rows = c.execute("SELECT id,name,email,role FROM users WHERE role='admin'").fetchall()
print('Admin rows:', rows)
