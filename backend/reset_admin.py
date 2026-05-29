import sys
sys.path.insert(0, 'core')
from models import get_conn
from werkzeug.security import generate_password_hash

c = get_conn()
c.execute("UPDATE users SET password_hash=? WHERE email=? AND role='admin'",
          (generate_password_hash('kavi@2003'), 'kavithats1211@gmail.com'))
c.commit()
print('Password reset done')
