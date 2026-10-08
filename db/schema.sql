-- schema.sql
-- Every table the league needs. "IF NOT EXISTS" means this file is safe
-- to run every time the server starts: it only creates what's missing.

-- One row of season settings (the CHECK makes sure there's only ever id 1).
CREATE TABLE IF NOT EXISTS settings (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  season_name      TEXT    NOT NULL,
  weeks            INTEGER NOT NULL,
  matches_per_week INTEGER NOT NULL,
  points_per_elim  INTEGER NOT NULL
);

-- How many points each finishing place is worth (1st = 65, 2nd = 56, ...).
CREATE TABLE IF NOT EXISTS placement_points (
  place  INTEGER PRIMARY KEY,
  points INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  school TEXT    NOT NULL DEFAULT ''
);

-- Each player belongs to one team. slot is 1 or 2 (their spot on the duo).
-- ON DELETE CASCADE: deleting a team deletes its players too.
CREATE TABLE IF NOT EXISTS players (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id   INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  epic_name TEXT    NOT NULL,
  slot      INTEGER NOT NULL,
  UNIQUE (team_id, slot)
);

-- One row per team per game.
-- The two UNIQUE rules stop a team being entered twice in the same game,
-- and stop two teams having the same placement in the same game.
CREATE TABLE IF NOT EXISTS matches (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  week      INTEGER NOT NULL,
  game      INTEGER NOT NULL,
  team_id   INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL CHECK (placement >= 1),
  UNIQUE (week, game, team_id),
  UNIQUE (week, game, placement)
);

-- Each player's eliminations and deaths in one match.
CREATE TABLE IF NOT EXISTS player_results (
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  elims     INTEGER NOT NULL DEFAULT 0 CHECK (elims >= 0),
  deaths    INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  PRIMARY KEY (match_id, player_id)
);

-- Staff accounts. Passwords are never stored, only a salted hash of them.
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL
);

-- A signed-in staff member gets a random token. The browser sends it back
-- with every change it asks for, and the server looks it up here.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Default rules (ECAC Duos). OR IGNORE: skip if they're already there.
INSERT OR IGNORE INTO settings (id, season_name, weeks, matches_per_week, points_per_elim)
VALUES (1, 'Fall 2026 Duos', 7, 4, 2);

INSERT OR IGNORE INTO placement_points (place, points) VALUES
  (1, 65), (2, 56), (3, 52), (4, 48), (5, 44),
  (6, 40), (7, 38), (8, 36), (9, 34), (10, 32),
  (11, 30), (12, 28), (13, 26), (14, 24), (15, 22),
  (16, 20), (17, 18), (18, 16), (19, 14), (20, 12),
  (21, 10), (22, 8), (23, 6), (24, 4), (25, 2);
