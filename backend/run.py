import os
import sys

CORE_DIR = os.path.join(os.path.dirname(__file__), "core")
if CORE_DIR not in sys.path:
    sys.path.insert(0, CORE_DIR)

from app import app


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)
