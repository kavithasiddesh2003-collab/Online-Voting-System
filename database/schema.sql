-- SecureVote — SQLite schema (canonical, matches models.py)
-- For MySQL, set MYSQL_HOST and MYSQL_DATABASE in .env; models.py handles dialect differences.

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    phone         TEXT    UNIQUE,
    email         TEXT    UNIQUE,
    password_hash TEXT,
    voter_id      TEXT,
    dob           TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role          TEXT    DEFAULT 'voter',
    approved      INTEGER DEFAULT 0          -- 0 = pending, 1 = approved
);

CREATE TABLE IF NOT EXISTS elections (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL,
    candidates_json     TEXT    NOT NULL,    -- JSON array of {name, photo} objects
    status              TEXT    DEFAULT 'active',  -- active | tallied
    paillier_public_key TEXT,                -- JSON {n, g}
    results_json        TEXT,               -- JSON {candidate: vote_count} after tallying
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time            TEXT,               -- ISO-8601 UTC (e.g. 2025-06-01T12:00:00Z)
    start_time          TEXT                -- ISO-8601 UTC
);

CREATE TABLE IF NOT EXISTS votes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    election_id INTEGER NOT NULL,
    voted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, election_id),
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
);

-- ── MySQL equivalent (run manually when USE_MYSQL=1) ──────────────────────────
-- CREATE DATABASE securevote CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--
-- CREATE TABLE IF NOT EXISTS users (
--   id            INT AUTO_INCREMENT PRIMARY KEY,
--   name          VARCHAR(255)  NOT NULL,
--   phone         VARCHAR(20)   UNIQUE,
--   email         VARCHAR(320)  UNIQUE,
--   password_hash VARCHAR(255),
--   voter_id      VARCHAR(50),
--   dob           VARCHAR(20),
--   created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
--   role          VARCHAR(32)   DEFAULT 'voter',
--   approved      TINYINT(1)    DEFAULT 0
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
-- CREATE TABLE IF NOT EXISTS elections (
--   id                  INT AUTO_INCREMENT PRIMARY KEY,
--   name                VARCHAR(512)  NOT NULL,
--   candidates_json     TEXT          NOT NULL,
--   status              VARCHAR(32)   DEFAULT 'active',
--   paillier_public_key TEXT,
--   results_json        TEXT,
--   created_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
--   end_time            VARCHAR(64)   NULL,
--   start_time          VARCHAR(64)   NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
-- CREATE TABLE IF NOT EXISTS votes (
--   id          INT AUTO_INCREMENT PRIMARY KEY,
--   user_id     INT NOT NULL,
--   election_id INT NOT NULL,
--   voted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uniq_user_election (user_id, election_id),
--   CONSTRAINT fk_votes_user     FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
--   CONSTRAINT fk_votes_election FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;