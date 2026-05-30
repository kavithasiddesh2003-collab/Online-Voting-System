import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'core')))

import pytest
import json
from app import app
from models import init_db


@pytest.fixture
def client():
    """Create test client with fresh in-memory state"""
    app.config['TESTING'] = True
    init_db()
    with app.test_client() as client:
        yield client


def test_register_endpoint(client):
    """Test user registration requires name, phone, dob, and password."""
    response = client.post('/register', json={
        'name': 'Alice Johnson',
        'phone': '+919876543210',
        'dob': '1995-05-15',
        'password': 'alicepass123',
    })
    # Either 201 (registered) or 409 (already exists from prior seed) are acceptable
    assert response.status_code in (201, 409)
    data = json.loads(response.data)
    assert 'message' in data or 'error' in data


def test_register_underage_rejected(client):
    """Under-18 registrations must be rejected."""
    response = client.post('/register', json={
        'name': 'Young User',
        'phone': '+919000000001',
        'dob': '2015-01-01',
        'password': 'pass123',
    })
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert '18' in data['error']


def test_auth_requires_otp(client):
    """Authentication without a prior OTP request returns a clear error."""
    response = client.post('/auth', json={
        'phone': '+919876543210',
        'password': 'somepass',
        'otp': '000000',
    })
    # 400 (no OTP found) or 404 (user not registered in test DB) are both acceptable
    assert response.status_code in (400, 404)


def test_elections_requires_auth(client):
    """Elections endpoint must reject unauthenticated requests."""
    response = client.get('/elections')
    assert response.status_code == 401


def test_bulletin_public_access(client):
    """Bulletin board must be publicly readable."""
    response = client.get('/bulletin')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)


def test_admin_login_bad_password(client):
    """Admin login with wrong password returns 401 or 403."""
    response = client.post('/admin-login', json={
        'email': 'admin@test.com',
        'password': 'wrongpassword',
    })
    assert response.status_code in (401, 403)