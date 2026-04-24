import sys
import os

# Add backend folder to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'core')
sys.path.insert(0, os.path.abspath(backend_path))
