# SecureVote — Privacy-Preserving Online Voting System

A full-stack web-based electronic voting system built with React and Flask, using **Paillier Homomorphic Encryption** and **Shamir Secret Sharing** to ensure votes remain private even during counting.

---

## Features

- Voter self-registration with admin approval workflow
- Mandatory Voter ID in the fixed format `VOT###` (e.g. `VOT001`), validated on both frontend and backend
- Real-time duplicate phone number check during registration (`GET /check-phone`)
- Three-factor authentication: phone number + password + SMS OTP
- Password (auto-generated as first 4 letters of name + day of birth) must be lowercase only, enforced on both registration and login
- Client-side vote encryption using Paillier homomorphic encryption (browser-side, before any network call)
- Threshold decryption via Shamir Secret Sharing (no single point of trust)
- Public bulletin board for auditability
- Duplicate vote prevention (one vote per user per election)
- Admin dashboard: create, edit, delete, and tally elections
- Admin voter management: approve/reject pending voters, view voter status, reload voters from CSV
- Election scheduling with configurable start and end times (UTC/IST)
- Up to 20 candidates per election with photo support
- Live results with bar chart, winner detection, and tie handling
- Supports SQLite (default) and MySQL
- Standalone independent verification tool for auditing the bulletin board

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, React Router DOM, Axios, Crypto-JS |
| Backend | Python, Flask, Flask-JWT-Extended, Flask-CORS, Werkzeug |
| Database | SQLite (default) / MySQL (via PyMySQL) |
| Cryptography | Paillier (`phe`), Shamir Secret Sharing, HMAC-SHA256 |
| OTP | MSG91 SMS API (falls back to console logging in development if no API key is set) |

---

## Project Structure

```
Online-Voting-System/
├── backend/
│   ├── core/
│   │   ├── app.py          # Flask routes
│   │   ├── auth.py         # OTP generation, MSG91 delivery, and verification
│   │   ├── crypto.py       # Paillier encryption / Shamir sharing / HMAC signing
│   │   ├── models.py       # DB models (SQLite + MySQL)
│   │   └── verify.py       # Post-election verification tool
│   ├── run.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── utils/
│       │   └── crypto.js   # Client-side Paillier encryption (PaillierJS, BigInt)
│       └── components/
│           ├── LandingPage.js
│           ├── Register.js
│           ├── Login.js
│           ├── AdminPanel.js
│           ├── VoterPanel.js
│           ├── VoteForm.js
│           ├── Results.js
│           └── ElectionList.js
├── database/
│   └── schema.sql
├── assets/
│   └── screenshots/
└── package.json            # Root: runs both servers together
```

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/kavithasiddesh2003-collab/Online-Voting-System.git
cd Online-Voting-System
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in your values:

```env
JWT_SECRET_KEY=your-secret-key
OTP_HMAC_SALT=your-otp-salt
HMAC_SIGNING_KEY=your-signing-key

# MSG91 (for SMS OTP). If left blank, OTPs are printed to the server console instead of being sent.
MSG91_API_KEY=

# MySQL (optional — omit to use SQLite)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=securevote
```

### 3. Install dependencies

```bash
# Backend
pip install -r backend/requirements.txt

# Frontend
npm install
npm run install:frontend
```

### 4. Run the app

```bash
# Both backend + frontend together (recommended)
npm start

# Or separately
python backend/run.py        # Flask on http://localhost:5000
cd frontend && npm start     # React on http://localhost:3000
```

---

## Voter Seeding (Optional)

To pre-load voters, place a `database/users.csv` file with columns:

```
name,phone,role,email,password,voter_id,dob
```

- Voters need: `name`, `phone`, `voter_id` (format `VOT###`), `dob`
- Admin needs: `name`, `email`, `password`, `role=admin`
- Voter password is auto-generated as `first4letters_of_name + day_of_dob` (lowercase) if not provided

> ⚠️ `database/*.csv` is gitignored. Never commit real personal data to the repository.

To sync the database with an updated CSV from the admin panel, use **Admin → Reload Users**.

---

## System Workflow

1. Admin creates an election, sets candidates, start time, and end time
2. A Paillier keypair is generated server-side; the private key is split via Shamir Secret Sharing
3. Voters self-register (pending admin approval) or are pre-seeded via CSV
4. Voter authenticates with phone + password + SMS OTP (via MSG91, or console-logged OTP in development)
5. Vote is encrypted **client-side in the browser** before being sent to the server — the server never performs vote encryption
6. The encrypted ballot is stored on the public bulletin board (candidate choice is excluded from this public record); the candidate index is recorded separately in a private, server-side ledger used only for tallying
7. After the election ends, admin tallies using threshold decryption (homomorphic addition of ciphertexts, then decryption via reconstructed trustee key)
8. Results are displayed as a bar chart with winner detection and tie handling; individual votes are never revealed

---

## Post-Election Verification

```bash
python backend/core/verify.py --election_id 1
```

Verifies the bulletin board integrity and confirms tallied results match encrypted ballots.

---

## Screenshots

| | |
|---|---|
| ![Landing Page](assets/screenshots/1.Landingpage.png) | ![Register](assets/screenshots/2.Register.png) |
| ![Admin Login](assets/screenshots/3.Adminlogin.png) | ![Admin Panel](assets/screenshots/4.Adminpanel.png) |
| ![Admin Panel 2](assets/screenshots/5.Adminpanel1.png) | ![Voter Login](assets/screenshots/6.Voterlogin.png) |
| ![Voter Panel](assets/screenshots/7.voterpanel.png) | |

---

## Security Notes

- `.env` files, `.db` files, `bulletin.json`, `trustee_keys.json`, `private_ledger.json`, and all CSVs are gitignored
- Never commit real voter data or credentials to the repository
- Change all default keys before deploying
- OTPs are stored in a separate SQLite database (`otp_store.db`), distinct from the main application database, with per-phone attempt tracking to limit brute-force guessing
- Vote encryption happens entirely client-side; the backend only signs bulletin entries (HMAC-SHA256) and aggregates/decrypts ciphertexts at tally time

---

## Future Improvements

- Blockchain-based bulletin board storage
- Biometric authentication
- Mobile app support
- Large-scale election scalability

---

## Author

Kavitha T S