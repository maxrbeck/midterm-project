// server.js
// Serves the page in public/ and a small JSON API backed by the SQLite database.
// Anyone can read the league. Only signed-in staff can change it.
//
// Start it with:  npm start   then open http://localhost:3000

import express from "express";
import path from "node:path";
import * as league from "./db/database.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // turns JSON request bodies into req.body
app.use(express.static(path.join(import.meta.dirname, "public")));

// Staff account setup, every time the server starts.
const defaultEmail = "admin@league.local";

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  // .env wins: create that account, or update its password to match .env.
  try {
    league.saveAdmin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  } catch (error) {
    console.log("Problem with ADMIN_EMAIL / ADMIN_PASSWORD in .env: " + error.message);
    process.exit(1);
  }
  console.log("Staff account from .env: " + process.env.ADMIN_EMAIL.toLowerCase());

  // The default account's password is in the README, so remove it once .env has its own.
  if (process.env.ADMIN_EMAIL.toLowerCase() !== defaultEmail && league.deleteAdmin(defaultEmail)) {
    console.log("Removed the default " + defaultEmail + " account");
  }
} else if (league.countAdmins() === 0) {
  // No .env and no accounts yet: make the default one so someone can sign in.
  league.saveAdmin(defaultEmail, "changeme123");
  console.log("Created staff account " + defaultEmail + " (password: changeme123)");
  console.log("Set your own in .env (see .env.example), then restart.");
}

// ---------------------------------------------------------------
// Staff check
// ---------------------------------------------------------------

// The browser sends   Authorization: Bearer <token>   with staff requests.
function getToken(req) {
  const header = req.get("Authorization") || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return "";
}

// Put this in front of any route that changes data.
function requireStaff(req, res, next) {
  const staff = league.findSession(getToken(req));
  if (!staff) {
    res.status(401).json({ error: "Please sign in as staff to do that." });
    return;
  }
  req.staff = staff;
  next();
}

function idFrom(req) {
  return Number(req.params.id);
}

// ---------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------
app.get("/api/league", function (req, res) {
  res.json(league.getLeague());
});

app.post("/api/login", function (req, res) {
  const body = req.body || {};
  const session = league.logIn(body.email, body.password);
  if (session === null) {
    res.status(401).json({ error: "Wrong email or password." });
    return;
  }
  res.json(session);
});

// ---------------------------------------------------------------
// Staff routes
// ---------------------------------------------------------------
app.get("/api/me", requireStaff, function (req, res) {
  res.json({ email: req.staff.email });
});

app.post("/api/logout", requireStaff, function (req, res) {
  league.logOut(getToken(req));
  res.json({ ok: true });
});

// Teams
app.post("/api/teams", requireStaff, function (req, res) {
  const id = league.createTeam(req.body);
  res.status(201).json({ id: id });
});

app.put("/api/teams/:id", requireStaff, function (req, res) {
  league.updateTeam(idFrom(req), req.body);
  res.json({ ok: true });
});

app.delete("/api/teams/:id", requireStaff, function (req, res) {
  league.deleteTeam(idFrom(req));
  res.json({ ok: true });
});

// Match results
app.post("/api/matches", requireStaff, function (req, res) {
  const id = league.createMatch(req.body);
  res.status(201).json({ id: id });
});

app.put("/api/matches/:id", requireStaff, function (req, res) {
  league.updateMatch(idFrom(req), req.body);
  res.json({ ok: true });
});

app.delete("/api/matches/:id", requireStaff, function (req, res) {
  league.deleteMatch(idFrom(req));
  res.json({ ok: true });
});

app.delete("/api/matches", requireStaff, function (req, res) {
  const deleted = league.deleteAllMatches();
  res.json({ deleted: deleted });
});

// Rules and sample data
app.put("/api/rules", requireStaff, function (req, res) {
  league.updateRules(req.body);
  res.json({ ok: true });
});

app.post("/api/sample-season", requireStaff, function (req, res) {
  const loaded = league.loadSampleSeason();
  res.json({ loaded: loaded });
});

// Any other /api address
app.use("/api", function (req, res) {
  res.status(404).json({ error: "No such API route: " + req.method + " " + req.originalUrl });
});

// ---------------------------------------------------------------
// Errors
// ---------------------------------------------------------------
// Express sends any error thrown in a route here.
// Errors from database.js carry a status (400, 404, 409) and a friendly message.
app.use(function (error, req, res, next) {
  if (error.status) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(port, function () {
  console.log("League Scorer running at http://localhost:" + port);
});
