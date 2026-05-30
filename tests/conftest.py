# tests/conftest.py
# pytest automatically discovers and loads this file as shared fixtures.
# (Previously named test_conftest.py which caused it to run as a test, not fixtures.)

import sys
import os

# Add backend core to Python path so all test files can import app/models/crypto
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'core'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)