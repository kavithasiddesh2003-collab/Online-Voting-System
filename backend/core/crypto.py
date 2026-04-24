# backend/crypto.py
import random
from phe import paillier
import hashlib
import hmac

class PaillierCrypto:
    def __init__(self):
        self.public_key = None
        self.private_key = None

    def generate_keypair(self, key_length=2048):
        """Generate Paillier public/private keypair"""
        pub, priv = paillier.generate_paillier_keypair(n_length=key_length)
        self.public_key = pub
        self.private_key = priv
        return {'n': pub.n, 'g': pub.g}, {'p': priv.p, 'q': priv.q}

    def set_public_key(self, public_key_dict):
        """Set public key from dict with n and g"""
        n = int(public_key_dict['n'])
        self.public_key = paillier.PaillierPublicKey(n=n)

    def set_private_key(self, private_key_dict):
        """Set private key from dict with p and q"""
        p = int(private_key_dict['p'])
        q = int(private_key_dict['q'])
        n = p * q
        self.public_key = paillier.PaillierPublicKey(n=n)
        self.private_key = paillier.PaillierPrivateKey(self.public_key, p, q)

    def encrypt(self, plaintext):
        """Encrypt plaintext int"""
        if not self.public_key:
            raise ValueError("Public key not set")
        enc = self.public_key.encrypt(int(plaintext))
        return enc.ciphertext()

    def decrypt(self, ciphertext):
        """Decrypt ciphertext int to plaintext int"""
        if not self.private_key:
            raise ValueError("Private key not set")
        enc_num = paillier.EncryptedNumber(self.public_key, int(ciphertext))
        plaintext = self.private_key.decrypt(enc_num)
        return int(plaintext)

    def add_ciphertexts(self, c1, c2):
        """Homomorphic addition"""
        if not self.public_key:
            raise ValueError("Public key not set")
        enc1 = paillier.EncryptedNumber(self.public_key, int(c1))
        enc2 = paillier.EncryptedNumber(self.public_key, int(c2))
        result = enc1 + enc2
        return result.ciphertext()


def generate_trustee_shares(private_key_dict, n_shares=3, threshold=2):
    """
    Shamir secret sharing for p and q using a large safe prime.
    Returns n_shares, each with p_share, q_share, and index.
    """
    p = int(private_key_dict['p'])
    q = int(private_key_dict['q'])
    
    # Use a fixed large prime for the field (must be > max(p, q))
    # For 2048-bit keys, use a known 2048-bit prime
    FIELD_PRIME = 2**2048 - 1  # Mersenne-ish; use a true large prime in production
    # Simpler: use next_prime(max(p,q)*2) but for determinism, hardcode a safe modulus
    # Here we use a practical approach: the field prime must exceed p and q
    field_prime = next_prime_after(max(p, q) * 2)
    
    def shamir_share_simple(secret, n, k, prime):
        """Generate n shares with threshold k for secret mod prime"""
        if k > n:
            raise ValueError("Threshold k cannot exceed n")
        # Polynomial: f(x) = secret + a1*x + a2*x^2 + ... + a(k-1)*x^(k-1) mod prime
        coeffs = [secret] + [random.randrange(1, prime) for _ in range(k - 1)]
        shares = []
        for i in range(1, n + 1):
            x = i
            y = sum((c * pow(x, idx, prime)) % prime for idx, c in enumerate(coeffs)) % prime
            shares.append({'index': x, 'value': y})
        return shares, prime
    
    p_shares, p_prime = shamir_share_simple(p, n_shares, threshold, field_prime)
    q_shares, q_prime = shamir_share_simple(q, n_shares, threshold, field_prime)
    
    combined = []
    for i in range(n_shares):
        combined.append({
            'p_share': str(p_shares[i]['value']),
            'q_share': str(q_shares[i]['value']),
            'index': p_shares[i]['index'],
            'prime': str(field_prime)  # store prime for reconstruction
        })
    return combined


def combine_shares(shares):
    """
    Reconstruct private key from threshold shares using Lagrange interpolation.
    Shares must include the field prime used during generation.
    """
    if len(shares) < 2:
        raise ValueError("Need at least 2 shares")
    
    # Extract field prime from first share
    prime = int(shares[0].get('prime', 0))
    if prime == 0:
        raise ValueError("Shares missing field prime; regenerate election with updated crypto")
    
    def lagrange_at_zero(share_list, prime):
        """Lagrange interpolation to recover f(0) = secret"""
        secret = 0
        for i, si in enumerate(share_list):
            xi = si['index']
            yi = si['value']
            numerator = 1
            denominator = 1
            for j, sj in enumerate(share_list):
                if i != j:
                    xj = sj['index']
                    numerator = (numerator * (-xj)) % prime
                    denominator = (denominator * (xi - xj)) % prime
            # Modular inverse
            denom_inv = pow(denominator, -1, prime)
            coeff = (numerator * denom_inv) % prime
            secret = (secret + yi * coeff) % prime
        return secret
    
    p_data = [{'index': int(s['index']), 'value': int(s['p_share'])} for s in shares]
    q_data = [{'index': int(s['index']), 'value': int(s['q_share'])} for s in shares]
    
    p = lagrange_at_zero(p_data, prime)
    q = lagrange_at_zero(q_data, prime)
    
    return {'p': p, 'q': q}


def next_prime_after(n):
    """Find next prime >= n (simple trial division for demo)"""
    candidate = n if n % 2 == 1 else n + 1
    while not is_prime_simple(candidate):
        candidate += 2
    return candidate


def is_prime_simple(n, trials=20):
    """Miller-Rabin primality test"""
    if n < 2:
        return False
    if n == 2 or n == 3:
        return True
    if n % 2 == 0:
        return False
    
    r, d = 0, n - 1
    while d % 2 == 0:
        r += 1
        d //= 2
    
    for _ in range(trials):
        a = random.randrange(2, n - 1)
        x = pow(a, d, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def sign_data(data_str):
    """HMAC-SHA256 signature"""
    secret = b'server-signing-key-change-in-production'
    return hmac.new(secret, data_str.encode('utf-8'), hashlib.sha256).hexdigest()


def verify_signature(data_str, signature):
    """Verify HMAC signature"""
    return hmac.compare_digest(sign_data(data_str), signature)
