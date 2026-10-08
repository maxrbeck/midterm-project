// database.js
// Opens the SQLite database and holds every SQL query the server runs.
// server.js never writes SQL itself; it calls the functions exported here.

import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ordinal } from "../public/scoring.js";

const dbFolder = import.meta.dirname;
const dbFile = process.env.DB_FILE || path.join(dbFolder, "..", "league.db");

function readDbFile(fileName) {
  return readFileSync(path.join(dbFolder, fileName), "utf8");
}

// ":memory:" is a throwaway database that is always new.
const isNewDatabase = dbFile === ":memory:" || !existsSync(dbFile);

const db = new DatabaseSync(dbFile);
db.exec("PRAGMA foreign_keys = ON"); // makes ON DELETE CASCADE work
db.exec(readDbFile("schema.sql"));

if (isNewDatabase) {
  db.exec(readDbFile("seed.sql"));
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

// An error that's the user's fault (bad input). server.js sends its
// message back to the browser with the given HTTP status.
function userError(message, status) {
  const error = new Error(message);
  error.status = status || 400;
  return error;
}

// Runs several statements as one unit: either all of them happen, or none do.
function inTransaction(work) {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function checkWholeNumber(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw userError(label + " must be a whole number from " + min + " to " + max + ".");
  }
  return value;
}

function checkText(value, label, required, maxLength) {
  if (value === undefined || value === null) {
    value = "";
  }
  if (typeof value !== "string") {
    throw userError(label + " must be text.");
  }
  const trimmed = value.trim();
  if (required && trimmed === "") {
    throw userError(label + " is required.");
  }
  if (trimmed.length > maxLength) {
    throw userError(label + " must be " + maxLength + " characters or fewer.");
  }
  return trimmed;
}

function getSettings() {
  return db.prepare("SELECT season_name, weeks, matches_per_week, points_per_elim FROM settings WHERE id = 1").get();
}

// ---------------------------------------------------------------
// Reading everything
// ---------------------------------------------------------------

// Everything the page needs, in the same shape the browser code uses.
export function getLeague() {
  const settings = getSettings();
  const placementRows = db.prepare("SELECT points FROM placement_points ORDER BY place").all();
  const teamRows = db.prepare("SELECT id, name, school FROM teams ORDER BY id").all();
  const playerRows = db.prepare("SELECT id, team_id, epic_name FROM players ORDER BY team_id, slot").all();
  const matchRows = db.prepare("SELECT id, week, game, team_id, placement FROM matches ORDER BY week, game, placement").all();

  // JOIN pulls each player's name in next to their result.
  const resultRows = db.prepare(`
    SELECT player_results.match_id, player_results.player_id, players.epic_name,
           player_results.elims, player_results.deaths
    FROM player_results
    JOIN players ON players.id = player_results.player_id
    ORDER BY players.slot
  `).all();

  const teams = teamRows.map(function (team) {
    const players = playerRows
      .filter(function (player) {
        return player.team_id === team.id;
      })
      .map(function (player) {
        return { id: player.id, name: player.epic_name };
      });

    return { id: team.id, name: team.name, school: team.school, players: players };
  });

  const matches = matchRows.map(function (match) {
    const players = resultRows
      .filter(function (row) {
        return row.match_id === match.id;
      })
      .map(function (row) {
        return { playerId: row.player_id, name: row.epic_name, elims: row.elims, deaths: row.deaths };
      });

    return {
      id: match.id,
      week: match.week,
      game: match.game,
      teamId: match.team_id,
      placement: match.placement,
      players: players
    };
  });

  return {
    rules: {
      seasonName: settings.season_name,
      weeks: settings.weeks,
      matchesPerWeek: settings.matches_per_week,
      pointsPerElim: settings.points_per_elim,
      placementPoints: placementRows.map(function (row) {
        return row.points;
      })
    },
    teams: teams,
    matches: matches
  };
}

// ---------------------------------------------------------------
// Teams
// ---------------------------------------------------------------

// Checks a team from the browser. teamId is the team being edited (0 for a new team).
function checkTeam(data, teamId) {
  data = data || {};
  const name = checkText(data.name, "Team name", true, 40);
  const school = checkText(data.school, "School", false, 60);

  if (!Array.isArray(data.players) || data.players.length !== 2) {
    throw userError("A team needs exactly 2 players.");
  }
  const players = data.players.map(function (playerName, index) {
    return checkText(playerName, "Player " + (index + 1), true, 30);
  });
  if (players[0].toLowerCase() === players[1].toLowerCase()) {
    throw userError("The two players need different names.");
  }

  // name is COLLATE NOCASE in schema.sql, so this ignores capital letters.
  const sameName = db.prepare("SELECT name FROM teams WHERE name = ? AND id != ?").get(name, teamId);
  if (sameName) {
    throw userError("There's already a team called " + sameName.name + ".", 409);
  }

  // A player can only be on one team.
  players.forEach(function (playerName) {
    const elsewhere = db.prepare(`
      SELECT teams.name FROM players
      JOIN teams ON teams.id = players.team_id
      WHERE players.epic_name = ? COLLATE NOCASE AND players.team_id != ?
    `).get(playerName, teamId);

    if (elsewhere) {
      throw userError(playerName + " is already on " + elsewhere.name + ".", 409);
    }
  });

  return { name: name, school: school, players: players };
}

export function createTeam(data) {
  const team = checkTeam(data, 0);

  return inTransaction(function () {
    const result = db.prepare("INSERT INTO teams (name, school) VALUES (?, ?)").run(team.name, team.school);
    const teamId = Number(result.lastInsertRowid);

    const insertPlayer = db.prepare("INSERT INTO players (team_id, slot, epic_name) VALUES (?, ?, ?)");
    team.players.forEach(function (playerName, index) {
      insertPlayer.run(teamId, index + 1, playerName);
    });

    return teamId;
  });
}

// Renaming a player keeps their id, so their past results stay with them.
export function updateTeam(teamId, data) {
  const existing = db.prepare("SELECT id FROM teams WHERE id = ?").get(teamId);
  if (!existing) {
    throw userError("That team doesn't exist.", 404);
  }
  const team = checkTeam(data, teamId);

  inTransaction(function () {
    db.prepare("UPDATE teams SET name = ?, school = ? WHERE id = ?").run(team.name, team.school, teamId);

    const updatePlayer = db.prepare("UPDATE players SET epic_name = ? WHERE team_id = ? AND slot = ?");
    team.players.forEach(function (playerName, index) {
      updatePlayer.run(playerName, teamId, index + 1);
    });
  });
}

// Deletes the team; CASCADE also deletes its players and results.
export function deleteTeam(teamId) {
  const result = db.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
  if (result.changes === 0) {
    throw userError("That team doesn't exist.", 404);
  }
}

// ---------------------------------------------------------------
// Match results
// ---------------------------------------------------------------

// Checks a result from the browser. matchId is the match being edited (0 for a new one).
function checkMatch(data, matchId) {
  data = data || {};
  const settings = getSettings();
  const week = checkWholeNumber(data.week, "Week", 1, settings.weeks);
  const game = checkWholeNumber(data.game, "Game", 1, settings.matches_per_week);
  const placement = checkWholeNumber(data.placement, "Placement", 1, 100);

  let team = undefined;
  if (Number.isInteger(data.teamId)) {
    team = db.prepare("SELECT id, name FROM teams WHERE id = ?").get(data.teamId);
  }
  if (!team) {
    throw userError("Choose a team.");
  }

  const sameTeam = db.prepare("SELECT id FROM matches WHERE week = ? AND game = ? AND team_id = ? AND id != ?")
    .get(week, game, team.id, matchId);
  if (sameTeam) {
    throw userError(team.name + " already has a result for week " + week + ", game " + game + ". Edit that one instead.", 409);
  }

  const samePlace = db.prepare(`
    SELECT teams.name FROM matches
    JOIN teams ON teams.id = matches.team_id
    WHERE matches.week = ? AND matches.game = ? AND matches.placement = ? AND matches.id != ?
  `).get(week, game, placement, matchId);
  if (samePlace) {
    throw userError(ordinal(placement) + " place in game " + game + " is already taken by " + samePlace.name + ".", 409);
  }

  // Every player on the team needs an elims/deaths line.
  if (!Array.isArray(data.players)) {
    throw userError("Enter each player's elims and deaths.");
  }
  const roster = db.prepare("SELECT id, epic_name FROM players WHERE team_id = ? ORDER BY slot").all(team.id);

  const lines = roster.map(function (player) {
    const line = data.players.find(function (p) {
      return p && p.playerId === player.id;
    });
    if (line === undefined) {
      throw userError("Enter elims and deaths for " + player.epic_name + ".");
    }

    return {
      playerId: player.id,
      elims: checkWholeNumber(line.elims, player.epic_name + "'s elims", 0, 99),
      deaths: checkWholeNumber(line.deaths, player.epic_name + "'s deaths", 0, 99)
    };
  });

  return { week: week, game: game, teamId: team.id, placement: placement, lines: lines };
}

function insertLines(matchId, lines) {
  const insert = db.prepare("INSERT INTO player_results (match_id, player_id, elims, deaths) VALUES (?, ?, ?, ?)");
  lines.forEach(function (line) {
    insert.run(matchId, line.playerId, line.elims, line.deaths);
  });
}

export function createMatch(data) {
  const match = checkMatch(data, 0);

  return inTransaction(function () {
    const result = db.prepare("INSERT INTO matches (week, game, team_id, placement) VALUES (?, ?, ?, ?)")
      .run(match.week, match.game, match.teamId, match.placement);
    const matchId = Number(result.lastInsertRowid);
    insertLines(matchId, match.lines);
    return matchId;
  });
}

export function updateMatch(matchId, data) {
  const existing = db.prepare("SELECT id FROM matches WHERE id = ?").get(matchId);
  if (!existing) {
    throw userError("That result doesn't exist anymore.", 404);
  }
  const match = checkMatch(data, matchId);

  inTransaction(function () {
    db.prepare("UPDATE matches SET week = ?, game = ?, team_id = ?, placement = ? WHERE id = ?")
      .run(match.week, match.game, match.teamId, match.placement, matchId);

    // Simplest way to update the player lines: delete the old ones, insert the new ones.
    db.prepare("DELETE FROM player_results WHERE match_id = ?").run(matchId);
    insertLines(matchId, match.lines);
  });
}

export function deleteMatch(matchId) {
  const result = db.prepare("DELETE FROM matches WHERE id = ?").run(matchId);
  if (result.changes === 0) {
    throw userError("That result doesn't exist anymore.", 404);
  }
}

export function deleteAllMatches() {
  const result = db.prepare("DELETE FROM matches").run();
  return result.changes;
}

// ---------------------------------------------------------------
// Rules
// ---------------------------------------------------------------
export function updateRules(data) {
  data = data || {};
  const seasonName = checkText(data.seasonName, "Season name", true, 40);
  const weeks = checkWholeNumber(data.weeks, "Weeks", 1, 20);
  const matchesPerWeek = checkWholeNumber(data.matchesPerWeek, "Games per week", 1, 10);
  const pointsPerElim = checkWholeNumber(data.pointsPerElim, "Points per elimination", 0, 20);

  if (!Array.isArray(data.placementPoints) || data.placementPoints.length === 0 || data.placementPoints.length > 100) {
    throw userError("Placement points need between 1 and 100 places.");
  }
  const placementPoints = data.placementPoints.map(function (points, index) {
    return checkWholeNumber(points, ordinal(index + 1) + " place points", 0, 500);
  });

  inTransaction(function () {
    db.prepare("UPDATE settings SET season_name = ?, weeks = ?, matches_per_week = ?, points_per_elim = ? WHERE id = 1")
      .run(seasonName, weeks, matchesPerWeek, pointsPerElim);

    db.prepare("DELETE FROM placement_points").run();
    const insert = db.prepare("INSERT INTO placement_points (place, points) VALUES (?, ?)");
    placementPoints.forEach(function (points, index) {
      insert.run(index + 1, points);
    });
  });
}

// ---------------------------------------------------------------
// Sample season
// ---------------------------------------------------------------

// Replaces every team and result with the seed roster + db/sample-matches.json.
// sample-matches.json uses team and player names, so we look up their ids here.
export function loadSampleSeason() {
  const sample = JSON.parse(readDbFile("sample-matches.json"));

  inTransaction(function () {
    db.prepare("DELETE FROM teams").run(); // cascades to players, matches, results
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('teams', 'players', 'matches')").run();
    db.exec(readDbFile("seed.sql"));

    const findTeam = db.prepare("SELECT id FROM teams WHERE name = ?");
    const findPlayer = db.prepare("SELECT id FROM players WHERE team_id = ? AND epic_name = ?");
    const insertMatch = db.prepare("INSERT INTO matches (week, game, team_id, placement) VALUES (?, ?, ?, ?)");

    sample.forEach(function (match) {
      const team = findTeam.get(match.team);
      const result = insertMatch.run(match.week, match.game, team.id, match.placement);
      const lines = match.players.map(function (player) {
        return {
          playerId: findPlayer.get(team.id, player.name).id,
          elims: player.elims,
          deaths: player.deaths
        };
      });
      insertLines(Number(result.lastInsertRowid), lines);
    });
  });

  return sample.length;
}

// ---------------------------------------------------------------
// Staff accounts and sessions
// ---------------------------------------------------------------

// Stored as "salt:hash". scrypt is a slow-on-purpose hash, which makes
// guessing passwords from a stolen database very expensive.
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

function passwordMatches(password, stored) {
  const parts = stored.split(":");
  const expected = Buffer.from(parts[1], "hex");
  const actual = scryptSync(password, parts[0], 64);
  return timingSafeEqual(actual, expected);
}

export function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS total FROM admins").get().total;
}

// Deletes a staff account (CASCADE also signs it out everywhere).
// Returns true if there was one to delete.
export function deleteAdmin(email) {
  const result = db.prepare("DELETE FROM admins WHERE email = ?").run(email);
  return result.changes > 0;
}

// Adds a staff account, or changes the password if the email already exists.
export function saveAdmin(email, password) {
  const cleanEmail = checkText(email, "Email", true, 100).toLowerCase();
  if (typeof password !== "string" || password.length < 8) {
    throw userError("Password must be at least 8 characters.");
  }
  db.prepare(`
    INSERT INTO admins (email, password_hash) VALUES (?, ?)
    ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash
  `).run(cleanEmail, hashPassword(password));
}

// Returns { token, email } for a correct email + password, otherwise null.
export function logIn(email, password) {
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }
  const admin = db.prepare("SELECT id, email, password_hash FROM admins WHERE email = ?").get(email.trim());
  if (!admin || !passwordMatches(password, admin.password_hash)) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, admin_id) VALUES (?, ?)").run(token, admin.id);

  // Tidy up: sessions only last 7 days.
  db.prepare("DELETE FROM sessions WHERE created_at < datetime('now', '-7 days')").run();

  return { token: token, email: admin.email };
}

// The staff member a token belongs to, or undefined if it's missing or expired.
export function findSession(token) {
  return db.prepare(`
    SELECT admins.id, admins.email FROM sessions
    JOIN admins ON admins.id = sessions.admin_id
    WHERE sessions.token = ? AND sessions.created_at > datetime('now', '-7 days')
  `).get(token);
}

export function logOut(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
