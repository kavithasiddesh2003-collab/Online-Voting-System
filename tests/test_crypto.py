import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'core')))

import pytest
from crypto import PaillierCrypto, generate_trustee_shares, combine_shares

def test_paillier_encryption_decryption():
    """Test basic Paillier encryption/decryption"""
    paillier = PaillierCrypto()
    public_key, private_key = paillier.generate_keypair(key_length=256)
    
    paillier.set_public_key(public_key)
    paillier.set_private_key(private_key)
    
    # Test encryption/decryption
    plaintext = 42
    ciphertext = paillier.encrypt(plaintext)
    decrypted = paillier.decrypt(ciphertext)
    
    assert decrypted == plaintext

def test_homomorphic_addition():
    """Test homomorphic addition property"""
    paillier = PaillierCrypto()
    public_key, private_key = paillier.generate_keypair(key_length=256)
    
    paillier.set_public_key(public_key)
    paillier.set_private_key(private_key)
    
    # Encrypt two numbers
    m1, m2 = 10, 20
    c1 = paillier.encrypt(m1)
    c2 = paillier.encrypt(m2)
    
    # Homomorphic addition
    c_sum = paillier.add_ciphertexts(c1, c2)
    decrypted_sum = paillier.decrypt(c_sum)
    
    assert decrypted_sum == m1 + m2

def test_trustee_shares():
    """Test trustee share generation and combination"""
    paillier = PaillierCrypto()
    _, private_key = paillier.generate_keypair(key_length=256)
    
    # Generate 3 shares
    shares = generate_trustee_shares(private_key, n_shares=3, threshold=2)
    assert len(shares) == 3
    
    # Combine first 2 shares
    combined = combine_shares(shares[:2])
    
    # Should reconstruct original key
    assert int(combined['p']) + int(shares[2]['p_share']) == int(private_key['p'])
    assert int(combined['q']) + int(shares[2]['q_share']) == int(private_key['q'])

def test_multiple_votes_aggregation():
    """Test aggregating multiple encrypted votes"""
    paillier = PaillierCrypto()
    public_key, private_key = paillier.generate_keypair(key_length=256)
    
    paillier.set_public_key(public_key)
    paillier.set_private_key(private_key)
    
    # Simulate 5 votes for a candidate
    votes = [paillier.encrypt(1) for _ in range(5)]
    
    # Aggregate
    aggregated = votes[0]
    for vote in votes[1:]:
        aggregated = paillier.add_ciphertexts(aggregated, vote)
    
    # Decrypt total
    total = paillier.decrypt(aggregated)
    assert total == 5
