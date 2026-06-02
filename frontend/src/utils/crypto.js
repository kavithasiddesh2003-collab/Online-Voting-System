/* eslint-env browser, es2021 */
/* eslint no-undef: "off" */
// ^ Ensures ESLint knows the environment and disables no-undef for global BigInt in rigid configs.

// PaillierJS: BigInt-safe encryption helper for browser
// - Normalizes public key inputs to decimal strings
// - Uses only BigInt for math (no Number mixing)
// - Returns ciphertext as decimal string for safe JSON transport

class PaillierJS {
  constructor() {
    this.n = null;
    this.g = null;
    this.n2 = null;
  }

  setPublicKey(publicKey) {
    if (!publicKey || publicKey.n == null || publicKey.g == null) {
      throw new Error('Invalid public key: missing n or g');
    }

    const normalizeToDigits = (v) => {
      if (typeof v === 'bigint') return v.toString();

      if (typeof v === 'number') {
        // Numbers can lose precision for large n/g. Prefer strings from backend.
        // Convert to string to avoid crashes; fix server if you see this warning.
        // console.warn('Public key component provided as Number; precision may be lost. Prefer decimal strings.');
        return Math.trunc(v).toString();
      }

      if (typeof v === 'string') {
        const s = v.trim();
        if (!/^[0-9]+$/.test(s)) throw new Error('Public key component must be a base-10 digit string');
        return s;
      }

      if (v && typeof v === 'object') {
        const cand = v.value ?? v._v ?? null;
        if (cand && typeof cand === 'string' && /^[0-9]+$/.test(cand.trim())) return cand.trim();
      }

      throw new Error('Unsupported public key component type');
    };

    const nStr = normalizeToDigits(publicKey.n);
    const gStr = normalizeToDigits(publicKey.g);

    // Explicitly reference via globalThis to silence strict linters
    this.n = globalThis.BigInt ? globalThis.BigInt(nStr) : BigInt(nStr);
    this.g = globalThis.BigInt ? globalThis.BigInt(gStr) : BigInt(gStr);
    this.n2 = this.n * this.n;
  }

  // Modular exponentiation: (base^exp) % mod, all BigInt
  modPow(base, exp, mod) {
    const BI = (x) => (typeof x === 'bigint' ? x : (globalThis.BigInt ? globalThis.BigInt(x) : BigInt(x)));

    base = BI(base);
    exp = BI(exp);
    mod = BI(mod);

    let result = 1n;
    base = base % mod;

    while (exp > 0n) {
      if ((exp & 1n) === 1n) {
        result = (result * base) % mod;
      }
      exp = exp >> 1n;
      base = (base * base) % mod;
    }
    return result;
  }

  // Generate random r: 1 <= r < n using cryptographically secure randomness
  randomR() {
    if (!this.n) throw new Error('Public key not set');

    // Use the same byte length as n to ensure r is uniformly distributed in [1, n)
    const nBytes = Math.ceil(this.n.toString(16).length / 2);
    const byteCount = nBytes + 8; // extra bytes to reduce modular bias
    const randomBytes = new Uint8Array(byteCount);
    crypto.getRandomValues(randomBytes);

    let r = 0n;
    for (let i = 0; i < byteCount; i++) {
      r = (r << 8n) + BigInt(randomBytes[i]);
    }
    r = r % (this.n - 1n) + 1n; // ensures r is in [1, n-1]
    return r;
  }

  // Encrypt plaintext m (expects m as small integer like 1)
  encrypt(m) {
    if (!this.n || !this.g || !this.n2) throw new Error('Public key not set');

    const BI = (x) => (typeof x === 'bigint' ? x : (globalThis.BigInt ? globalThis.BigInt(x) : BigInt(x)));
    const plaintext = BI(m);
    if (plaintext < 0n) throw new Error('Plaintext must be non-negative');

    const r = this.randomR();
    const gm = this.modPow(this.g, plaintext, this.n2);
    const rn = this.modPow(r, this.n, this.n2);
    const c = (gm * rn) % this.n2;

    return c.toString(); // decimal string for transport
  }
}

export default PaillierJS;