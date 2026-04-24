import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'core')))

import pytest
import json
from app import app
from models import init_db

@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    init_db()
    with app.test_client() as client:
        yield client

def test_register_endpoint(client):
    """Test user registration (email must exist on voter roll / seed list)."""
    response = client.post('/register', json={
        'name': 'Alice Johnson',
        'email': 'alice@test.com'
    })
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'message' in data

def test_auth_invalid_otp(client):
    """Test authentication with invalid OTP"""
    client.post('/register', json={
        'name': 'Bob Smith',
        'email': 'bob@test.com'
    })

    response = client.post('/auth', json={
        'email': 'bob@test.com',
        'otp': '000000'
    })
    assert response.status_code == 401

def test_elections_requires_auth(client):
    """Test that elections endpoint requires authentication"""
    response = client.get('/elections')
    assert response.status_code == 401

def test_bulletin_public_access(client):
    """Test that bulletin board is publicly accessible"""
    response = client.get('/bulletin')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
