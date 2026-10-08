# League Scorer

- **Front end:** HTML, CSS and plain JavaScript modules in `public/`
- **Back end:** a Node.js server built with [Express](https://expressjs.com) (`server.js`)
- **Database:** SQLite, using the `node:sqlite` module built into Node, with plain SQL (`db/`)

---

## Contents

1. [Getting started](#1-getting-started)
2. [npm scripts](#2-npm-scripts)
3. [Using the app](#3-using-the-app)
4. [Project structure](#4-project-structure)
5. [How it works](#5-how-it-works)
6. [The database](#6-the-database)
7. [API routes](#7-api-routes)
8. [Function reference](#8-function-reference)
9. [Scoring rules](#9-scoring-rules)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Getting started

### What you need

- **Node.js 22.13 or newer** (this includes npm). Download the LTS version from
  <https://nodejs.org/en/download>. Check that it's installed by running:

  ```
  node -v
  npm -v
  ```

  Each command should print a version number. If `node -v` shows something lower than
  `v22.13`, install a newer version. Older versions don't include `node:sqlite`.

### Step by step

1. **Open a terminal in the project folder** (the folder with `package.json`). In VS Code,
   that's *Terminal → New Terminal*.

2. **Install the packages** listed in `package.json`. This app only needs Express.

   ```
   npm install
   ```

   This creates the `node_modules/` folder. It's in `.gitignore`, so it never gets committed.
   Anyone can rebuild it with `npm install`.

3. **(Optional) Choose the staff login.** Copy `.env.example` to a new file called `.env`
   and change the values:

   ```
   PORT=3000
   ADMIN_EMAIL=you@school.edu
   ADMIN_PASSWORD=pick-a-long-password
   ```

   The server applies `.env` **every time it starts**, so you can add or change it at any
   time and just restart:
   - It creates the `ADMIN_EMAIL` account, or sets that account's password to match `.env`.
   - It deletes the default `admin@league.local` account (its password is printed in this README).
   - Your teams and results aren't touched.

   If you skip this step, the account is `admin@league.local` / `changeme123`.
   `.env` is in `.gitignore`, so your password never ends up on GitHub.

4. **Start the server.**

   ```
   npm start
   ```

   You should see:

   ```
   > league-scorer@1.0.0 start
   > node --env-file-if-exists=.env server.js

   Staff account from .env: you@school.edu
   League Scorer running at http://localhost:3000
   ```

   The first start also creates `league.db`. The first time the server starts after you add
   `.env`, it prints `Removed the default admin@league.local account`.

   Without a `.env` file, the first start prints this instead:

   ```
   .env not found. Continuing without it.
   Created staff account admin@league.local (password: changeme123)
   Set your own in .env (see .env.example), then restart.
   ```

5. **Open <http://localhost:3000>** in your browser. To make changes, click
   **Staff sign in** and use the email and password from step 3.

6. **Stop the server** with `Ctrl + C` in the terminal.

> **Don't open `index.html` directly or with Live Server.** The page loads all its data
> from the server's `/api` routes, so without `npm start` it shows
> *"Couldn't reach the league server."*

---

## 2. npm scripts

These are defined in the `"scripts"` section of `package.json`. Run them with `npm run <name>`.
`start` is special, so plain `npm start` works too.

| Command | What it does | When to use it |
|---|---|---|
| `npm start` | Starts the server (`node server.js`) and reads `.env` if there is one | Normal use |
| `npm run dev` | Same, but with `--watch`: the server restarts every time you save a server file | While you're writing code |
| `npm run create-admin -- <email> <password>` | Adds a staff account, or changes the password if the email already exists | Adding staff, or if you forget the password |
| `npm run db:reset` | Deletes `league.db` | Starting over. Stop the server first; the next `npm start` builds a fresh database |

Example:

```
npm run create-admin -- coach@school.edu "a long password"
```

The `--` tells npm that what follows belongs to the script, not to npm. Passwords must
be at least 8 characters.

**Files you only change through the app:** `league.db` holds everything (teams, results,
rules, staff accounts). It's created automatically and is ignored by Git. To start from a
clean database, run `npm run db:reset`, then `npm start`.

---

## 3. Using the app

### Tabs

The four tabs are links (`#match-night`, `#season`, `#rosters`, `#rules`). The address
bar always shows which tab is open, so refresh, the Back button and shared links all work.
For example, <http://localhost:3000/#season> opens straight to the standings.

| Tab | Everyone sees | Staff can also |
|---|---|---|
| **Match night** | A week picker, that week's results table (points per game, elims, average placement, total), and the list of games entered | Enter a result; **Edit** or **Delete** any result |
| **Season tracker** | Season standings (points per week, games, elims, average placement, total), a Teams/Players switch, search, and a team detail panel with stat cards, weekly results and player stats | **Load sample season** (replaces everything with demo data) and **Clear all results** |
| **Rosters** | Every team, its school, its players, and its games and points | **Add**, **Edit** or **Delete** a team |
| **Scoring rules** | Season settings, the placement points table, tie breakers, how player points work | Change the season name, weeks, games per week, points per elim and placement points |

### Public view and admin view

- **Public view:** anyone who opens the site can read everything. The page re-downloads
  the scores every 30 seconds, so people watching on match night see new results without
  refreshing.
- **Admin view:** after **Staff sign in**, a red "Admin view" banner appears and the
  edit controls show up on every tab. The header shows who's signed in, plus a
  **Sign out** button. You stay signed in for 7 days, even after closing the browser.

### Typical match night

1. Sign in.
2. On **Match night**, choose the week.
3. For each team in each game: pick the game, type the placement, pick the team, and enter
   each player's elims and deaths. Then click **Save result**.
4. Typo? Click **Edit** next to that result, fix it, and click **Update result**.
5. The results table, the standings and every player's stats update right away.

The server stops two common mistakes: entering the same team twice in one game, and
giving two teams the same placement in one game.

---

## 4. Project structure

```
midterm-project/
├── package.json          project name, npm scripts, and the Express dependency
├── package-lock.json     exact package versions (commit this; don't edit by hand)
├── server.js             the Express server: serves public/ and answers /api requests
├── .env.example          template for .env (port and first staff account)
├── .gitignore            keeps node_modules/, league.db and .env out of Git
├── README.md             this file
│
├── public/               everything the browser downloads
│   ├── index.html        the page: header, four tab sections, sign-in dialog
│   ├── style.css         all styling; light and dark themes use CSS variables
│   ├── script.js         page logic: talks to the server, draws tables and forms
│   └── scoring.js        pure functions for points, stats and standings
│
└── db/                   the database (never sent to the browser)
    ├── schema.sql        CREATE TABLE statements and the default rules
    ├── seed.sql          INSERT statements for the starting 8 teams and 16 players
    ├── database.js       opens the database and holds every SQL query
    ├── sample-matches.json   96 demo results for "Load sample season"
    ├── create-admin.js   script behind npm run create-admin
    └── reset.js          script behind npm run db:reset
```

The server only shares the `public/` folder, so visitors can never download `server.js`,
the `db/` folder or `league.db`.

---

## 5. How it works

### The big picture

```
 Browser (public/)                     Server (server.js)              Database (db/)
 ────────────────                      ──────────────────              ──────────────
 script.js ── fetch("/api/...") ──▶   route checks staff token  ──▶   database.js checks
                                       (for changes)                   the input and runs SQL
           ◀── JSON response ───────  sends the result back    ◀──    on league.db
 scoring.js turns the JSON into
 points, standings and stats,
 then script.js redraws the page
```

- The **database** stores raw facts only: who placed where, and who got how many elims.
  It never stores points.
- **Points are calculated in the browser** by `scoring.js` every time the page draws.
  So when staff change the scoring rules, every old result is rescored automatically.
- The **server checks everything twice**: once in JavaScript (with clear error
  messages), and again through rules in the database itself (`UNIQUE`, `CHECK`,
  `FOREIGN KEY`).

### Example: what happens when staff save a result

1. Staff fill in the form and click **Save result**. The `submit` listener in
   `script.js` calls `event.preventDefault()` and builds an object like
   `{ week, game, teamId, placement, players: [{ playerId, elims, deaths }, ...] }`.
2. `api("POST", "/api/matches", result)` sends it with `fetch()`, along with the staff
   token in the `Authorization` header.
3. In `server.js`, `requireStaff` looks the token up in the `sessions` table. With no
   valid token, the server answers **401** and nothing is saved.
4. The route calls `createMatch()` in `database.js`. `checkMatch()` makes sure the week,
   game and placement are in range, the team exists, the team isn't already entered for
   that game, the placement isn't taken, and every player has a line.
   Any problem throws an error with a friendly message, and the server answers
   **400** or **409** with `{ "error": "..." }`.
5. If everything is valid, one transaction runs `INSERT INTO matches` and then one
   `INSERT INTO player_results` for each player. Either all of them save or none do.
6. The browser gets `201 Created` back. `refresh()` downloads `/api/league` again, and
   `renderAll()` redraws every tab with the new numbers.

### Signing in

1. The sign-in dialog sends the email and password to `POST /api/login`.
2. `logIn()` finds the account and checks the password against the stored **scrypt hash**.
   The real password is never stored.
3. If it matches, the server makes a random 64-character **token**, saves it in the
   `sessions` table, and sends it back.
4. The browser keeps the token in `localStorage` and sends it with every change it makes.
5. **Sign out** deletes the token from the database and from the browser. Tokens also
   expire after 7 days.

---

## 6. The database

The tables are defined in [`db/schema.sql`](db/schema.sql). The arrows below show which
table each one points to.

```
settings (1 row)          placement_points
  season_name               place  ─ 1, 2, 3 ...
  weeks                     points ─ 65, 56, 52 ...
  matches_per_week
  points_per_elim

teams ◀──── players ◀──── player_results ────▶ matches ────▶ teams
  id          id            match_id             id
  name        team_id       player_id            week
  school      epic_name     elims                game
              slot (1 or 2) deaths               team_id
                                                 placement

admins ◀──── sessions
  id            token
  email         admin_id
  password_hash created_at
```

| Table | One row is… | Rules the database enforces |
|---|---|---|
| `settings` | The season settings (there's only ever one row) | `CHECK (id = 1)` |
| `placement_points` | How many points one finishing place is worth | `place` is the primary key |
| `teams` | One team | `name` is `UNIQUE COLLATE NOCASE`, so there can't be both "Owls" and "owls" |
| `players` | One player on a team | Deleting a team deletes its players (`ON DELETE CASCADE`) |
| `matches` | One team's finish in one game | `UNIQUE (week, game, team_id)` and `UNIQUE (week, game, placement)`; `placement >= 1` |
| `player_results` | One player's elims and deaths in one match | `elims >= 0`, `deaths >= 0`; deleted along with its match or player |
| `admins` | One staff account | `email` is unique; only a salted hash of the password is stored |
| `sessions` | One signed-in browser | Deleted when its admin is deleted |

**Why players have an `id`:** results point at `player_id`, not the player's name.
So when staff rename a player (or a team), every past result stays connected.

**Looking inside the database:** the [SQLite Viewer](https://marketplace.visualstudio.com/items?itemName=qwtel.sqlite-viewer)
VS Code extension can open `league.db` and show each table.

---

## 7. API routes

All routes are in `server.js`. Each route answers with JSON. When something goes wrong,
the answer is `{ "error": "message" }` with an HTTP status code:

- `400`: bad input
- `401`: not signed in
- `404`: not found
- `409`: duplicate

Routes marked **Staff** need the header `Authorization: Bearer <token>`.

| Method | Route | Staff | Body sent | Answer |
|---|---|---|---|---|
| GET | `/api/league` | | — | `{ rules, teams, matches }` (everything the page needs) |
| POST | `/api/login` | | `{ email, password }` | `{ token, email }` or 401 |
| GET | `/api/me` | ✔ | — | `{ email }` (checks a saved token is still good) |
| POST | `/api/logout` | ✔ | — | `{ ok: true }` |
| POST | `/api/teams` | ✔ | `{ name, school, players: ["Name1", "Name2"] }` | `201 { id }` |
| PUT | `/api/teams/:id` | ✔ | same as above | `{ ok: true }` |
| DELETE | `/api/teams/:id` | ✔ | — | `{ ok: true }` (also deletes its players and results) |
| POST | `/api/matches` | ✔ | `{ week, game, teamId, placement, players: [{ playerId, elims, deaths }] }` | `201 { id }` |
| PUT | `/api/matches/:id` | ✔ | same as above | `{ ok: true }` |
| DELETE | `/api/matches/:id` | ✔ | — | `{ ok: true }` |
| DELETE | `/api/matches` | ✔ | — | `{ deleted: <count> }` (clears every result) |
| PUT | `/api/rules` | ✔ | `{ seasonName, weeks, matchesPerWeek, pointsPerElim, placementPoints: [65, 56, ...] }` | `{ ok: true }` |
| POST | `/api/sample-season` | ✔ | — | `{ loaded: 96 }` |

The shape of `GET /api/league`:

```json
{
  "rules": { "seasonName": "Fall 2026 Duos", "weeks": 7, "matchesPerWeek": 4,
             "pointsPerElim": 2, "placementPoints": [65, 56, 52] },
  "teams": [
    { "id": 1, "name": "Northgate Owls", "school": "Northgate College",
      "players": [{ "id": 1, "name": "Zyphr" }, { "id": 2, "name": "OwlEyes" }] }
  ],
  "matches": [
    { "id": 1, "week": 1, "game": 1, "teamId": 2, "placement": 1,
      "players": [{ "playerId": 3, "name": "Corvid", "elims": 5, "deaths": 0 }] }
  ]
}
```

---

## 8. Function reference

### `public/scoring.js`: the math

These are **pure functions**: they never change their inputs and never touch the page.
Both `script.js` (browser) and `database.js` (server) import from this file.

| Function | What it returns |
|---|---|
| `placementPoints(placement, rules)` | Points for finishing in that place, or `0` past the end of the table |
| `teamElims(match)` | Total eliminations for both players in one match |
| `matchPoints(match, rules)` | Team points for one match = placement points + team elims × points per elim |
| `average(total, count)` | `total / count`, or `0` when `count` is `0` (so there's never a divide-by-zero) |
| `killDeath(elims, deaths)` | K/D ratio; with 0 deaths it's just the elims |
| `teamStats(team, matches, rules)` | `{ teamId, team, games, elims, points, avgElims, avgPoints, avgPlace }` for one team. Pass in one week's matches to get weekly stats |
| `compareStandings(a, b)` | The `sort()` callback for tie breakers: points, then elims, then average placement (lower wins). Teams with no games go last |
| `standings(teams, matches, rules)` | Every team's `teamStats`, ranked best first |
| `playerStats(player, team, matches, rules)` | `{ playerId, name, team, games, elims, deaths, kd, points, avgElims, avgPoints }` for one player |
| `allPlayerStats(teams, matches, rules)` | Every rostered player's stats, sorted by points (then elims) |
| `ordinal(n)` | `1 → "1st"`, `2 → "2nd"`, `11 → "11th"`, `22 → "22nd"` |

### `public/script.js`: the page

**State.** The current data lives in a few variables at the top of the file: `rules`,
`teams`, `matches`, `staffEmail` (`null` in the public view), `editingMatchId`,
`editingTeamId`, `selectedTeamId` and `seasonView`. The page is always redrawn from them.

**Talking to the server**

| Function | What it does |
|---|---|
| `api(method, url, body)` | Sends a `fetch()` request with the staff token and a JSON body, and returns the JSON answer. On an error it throws an `Error` with the server's message. A `401` while signed in signs the user out |
| `loadLeague()` | `GET /api/league` and stores the result in `rules`, `teams` and `matches` |
| `refresh()` | `loadLeague()` followed by `renderAll()`. Called after every change |

**Building elements**

| Function | What it does |
|---|---|
| `showMessage(el, text)` / `hideMessage(el)` | Shows or hides a message box (uses the `.hide` class) |
| `showStatus(el, text, isError)` | Shows a red (error) or green (success) message under a form |
| `makeCell(text, className)` | Makes a `<td>` |
| `makeHeaderRow(headings, leftColumns)` | Makes a `<tr>` of `<th>`s; the first `leftColumns` are left-aligned |
| `makeRankCell(rank)` | A `<td>` with a gold, silver or bronze badge for the top 3 |
| `makeTable(headings, rows)` | A whole table from an array of row arrays (used in the team detail panel) |
| `makeSmallButton(text, onClick, isDanger)` | A small Edit/Delete/Close button with its click listener |
| `makeStatCard(label, value)` | One stat box in the team detail panel |
| `fillNumberSelect(select, count, label)` | Fills a `<select>` with "Week 1…N" or "Game 1…N" and keeps the current choice |

**Lookups and formatting**

| Function | What it does |
|---|---|
| `findTeam(id)` / `findMatch(id)` | Finds a team or match by id (`.find()`) |
| `teamName(id)` | A team's name, or "Unknown team" |
| `formatAverage(value, games)` | One decimal place, or "–" if there are no games |
| `isStaff()` | `true` when someone is signed in |
| `latestWeek()` | The highest week with results, so the page opens on the current week |

**Tabs, theme and signing in**

| Function | What it does |
|---|---|
| `showPageFromHash()` | Shows the section that matches `location.hash` and highlights its tab. Runs on load and on every `hashchange` |
| `setTheme(theme)` | Switches light or dark mode. The page starts in dark mode; clicking the toggle saves the visitor's choice in `localStorage` (`chosenTheme`) |
| `setStaff(email)` | Switches between the public and admin views by toggling the `is-admin` class on `<body>`. CSS hides `.admin-only` elements without it |
| `signedOut(message)` | Forgets the token and returns to the public view |
| `checkStaff()` | On page load, asks `/api/me` whether the saved token still works |

**Match night**

| Function | What it does |
|---|---|
| `fillTeamSelect()` | Fills the team dropdown |
| `renderPlayerInputs(existingMatch)` | One row of Elims/Deaths inputs per player on the chosen team; when editing, fills in the saved numbers |
| `startEditingMatch(id)` / `stopEditingMatch()` | Loads a result into the form for editing, or resets the form to "add" mode |
| `deleteMatch(id)` | Asks to confirm, then `DELETE /api/matches/:id` |
| `renderMatchNight()` | Draws the selected week's results table and the list of games entered (with Edit/Delete for staff) |
| *submit listener on `#result-form`* | Reads the form, then `POST`s (new) or `PUT`s (editing) the result |

**Season tracker**

| Function | What it does |
|---|---|
| `renderSeason()` | Draws the Teams or Players table, handles search, and shows the right empty or no-match message |
| `renderTeamStandings(search)` | The team standings with weekly columns. Ranks come from the full list, so they stay right while searching |
| `renderPlayerTable(search)` | The player leaderboard |
| `matchesSearch(text, search)` | Case-insensitive "does this name contain the search text?" |
| `selectTeam(id)` / `renderTeamDetail()` | Opens and draws the team detail panel (stat cards, weekly results, player stats) |
| *click listeners on Load sample season / Clear all results* | `POST /api/sample-season` / `DELETE /api/matches` |

**Rosters**

| Function | What it does |
|---|---|
| `renderRosters()` | Draws each team with its school, player chips, record, and (for staff) Edit/Delete |
| `startEditingTeam(id)` / `stopEditingTeam()` | Loads a team into the form for editing, or resets it to "add" mode |
| `deleteTeam(id)` | Asks to confirm (and says how many results go with it), then `DELETE /api/teams/:id` |
| *submit listener on `#team-form`* | `POST`s a new team or `PUT`s changes |

**Scoring rules**

| Function | What it does |
|---|---|
| `renderRules()` | Draws the read-only rules and the placement points grid |
| `fillRulesForm()` | Copies the saved rules into the staff editor (also used by **Discard changes**) |
| `addPlaceInput(points)` | Adds one placement points box (used by **Add place**) |
| *submit listener on `#rules-form`* | `PUT /api/rules`, then refreshes so every score is recalculated |

**Start up**

| Function | What it does |
|---|---|
| `renderAll()` | Redraws every tab from the current data |
| `init()` | Runs once on load: sets the theme, shows the right tab, loads the league (with loading and error messages), checks whether staff are signed in, and starts the 30-second public refresh |

### `server.js`: the web server

| Piece | What it does |
|---|---|
| `express.json()` | Turns JSON request bodies into `req.body` |
| `express.static("public")` | Sends the files in `public/` to the browser |
| Staff account setup | On every start: if `.env` has `ADMIN_EMAIL` and `ADMIN_PASSWORD`, saves that account (creating it or updating its password) and deletes the default `admin@league.local`. With no `.env` and no accounts, it creates the default account |
| `getToken(req)` | Reads the token from the `Authorization: Bearer ...` header |
| `requireStaff(req, res, next)` | **Middleware** placed in front of every route that changes data. Looks up the token; with no valid token it answers 401, otherwise it calls `next()` |
| `idFrom(req)` | Turns `:id` from the URL into a number |
| `app.get / post / put / delete(...)` | The routes in [section 7](#7-api-routes). Each one is a couple of lines that call `database.js` |
| 404 handler | Any unknown `/api/...` address returns a JSON 404 |
| Error handler | Errors from `database.js` carry a status (400/404/409) and are sent back as `{ error }`. Anything unexpected is logged and returns a generic 500 |

### `db/database.js`: every SQL query

When this file loads, it opens `league.db` (or `DB_FILE` from `.env`), turns on foreign
keys, runs `schema.sql`, and, if the database file is brand new, also runs `seed.sql`.

**Helpers (only used inside this file)**

| Function | What it does |
|---|---|
| `readDbFile(name)` | Reads a file from the `db/` folder |
| `userError(message, status)` | Makes an `Error` with an HTTP status, for problems with the user's input |
| `inTransaction(work)` | Runs `BEGIN`, then `work()`, then `COMMIT`; on any error it runs `ROLLBACK` so nothing half-saves |
| `checkWholeNumber(value, label, min, max)` | Throws a friendly error unless the value is a whole number in range |
| `checkText(value, label, required, maxLength)` | Trims text, then checks that it's present (if required) and short enough |
| `getSettings()` | `SELECT`s the one settings row |
| `checkTeam(data, teamId)` | Validates a team: name, 2 different players, no duplicate team name, and no player already on another team |
| `checkMatch(data, matchId)` | Validates a result: ranges, team exists, no duplicate team or placement in that game, and a line for every player |
| `insertLines(matchId, lines)` | `INSERT`s each player's elims and deaths |
| `hashPassword(password)` / `passwordMatches(password, stored)` | Salted scrypt hashing, and a check that can't be timed to guess the hash |

**Exported (called by `server.js` and the scripts)**

| Function | SQL it runs |
|---|---|
| `getLeague()` | `SELECT`s every table and `JOIN`s player names onto results; returns `{ rules, teams, matches }` |
| `createTeam(data)` | `INSERT INTO teams`, then 2 × `INSERT INTO players` (in a transaction) |
| `updateTeam(id, data)` | `UPDATE teams` and `UPDATE players` by slot, so player ids (and their stats) are kept |
| `deleteTeam(id)` | `DELETE FROM teams`; cascades to its players, matches and results |
| `createMatch(data)` | `INSERT INTO matches` plus a `player_results` row per player |
| `updateMatch(id, data)` | `UPDATE matches`, then deletes and re-inserts its `player_results` |
| `deleteMatch(id)` / `deleteAllMatches()` | `DELETE FROM matches` (one, or all) |
| `updateRules(data)` | `UPDATE settings`, then replaces every `placement_points` row |
| `loadSampleSeason()` | Deletes all teams, re-runs `seed.sql`, and inserts the 96 results from `sample-matches.json` |
| `countAdmins()` | `SELECT COUNT(*) FROM admins` |
| `saveAdmin(email, password)` | `INSERT ... ON CONFLICT DO UPDATE`: adds an account or changes its password |
| `deleteAdmin(email)` | `DELETE FROM admins`; its sessions cascade, so it's signed out everywhere |
| `logIn(email, password)` | Checks the password, `INSERT`s a new session, and deletes sessions older than 7 days |
| `findSession(token)` | `JOIN`s sessions to admins; returns the staff member, or nothing if the token is missing or expired |
| `logOut(token)` | `DELETE`s the session |

### `db/create-admin.js` and `db/reset.js`

- **`create-admin.js`** reads the email and password from the command line and calls `saveAdmin()`.
- **`reset.js`** deletes `league.db` and SQLite's `-wal`/`-shm` helper files if they exist.

---

## 9. Scoring rules

These are the defaults, set in `schema.sql`. Staff can change all of them on the
**Scoring rules** tab.

- **Team points per game** = placement points + (team's total elims × 2)
- **Placement points:** 1st 65, 2nd 56, 3rd 52, 4th 48, 5th 44, then down to 25th = 2.
  Anything after 25th earns 0 placement points, but elims still count.
- **Player points** = the team's placement points + (that player's own elims × 2)
- **K/D** = elims ÷ deaths (just elims if they never died)
- **Tie breakers:** total points → total eliminations → average placement (lower is better)

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| The page says *"Couldn't reach the league server"* | The server isn't running, or you opened the file directly or with Live Server. Run `npm start` and go to <http://localhost:3000> |
| `npm : ... running scripts is disabled on this system` (Windows PowerShell) | Run this once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `Cannot find package 'express'` | Run `npm install` first |
| `No such built-in module: node:sqlite` | Your Node is too old. Install Node 22.13 or newer (`node -v` to check) |
| `Error: listen EADDRINUSE: address already in use :::3000` | Something is already using port 3000, probably another copy of the server. Stop it with `Ctrl + C`, or set `PORT=3001` in `.env` |
| Forgot the staff password | `npm run create-admin -- <your email> <new password>` |
| Made or changed `.env`, but the old login still works | Restart the server (`Ctrl + C`, then `npm start`). `.env` is applied on every start. Check that both `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set |
| Server stops with *"Problem with ADMIN_EMAIL / ADMIN_PASSWORD in .env"* | The `.env` password must be at least 8 characters |
| Want to start completely fresh | Stop the server, run `npm run db:reset`, then `npm start` |
| Edit buttons disappeared | Your session expired (7 days) or you were signed out. Sign in again |
