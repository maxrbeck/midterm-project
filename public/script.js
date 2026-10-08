import {
  matchPoints,
  teamElims,
  teamStats,
  standings,
  playerStats,
  allPlayerStats,
  ordinal
} from "./scoring.js";

// ---------------------------------------------------------------
// State: a copy of what's in the database, plus what the page is doing.
// The page is always re-drawn from these variables (see renderAll()).
// ---------------------------------------------------------------
let rules = null;
let teams = [];
let matches = [];
let seasonView = "teams"; // "teams" or "players"
let selectedTeamId = null; // team shown in the detail panel
let staffEmail = null; // null means the public view
let editingMatchId = null; // result being edited, or null when adding
let editingTeamId = null; // team being edited, or null when adding

const pageIds = ["match-night", "season", "rosters", "rules"];

// ---------------------------------------------------------------
// Element references
// ---------------------------------------------------------------
const appMessage = document.querySelector("#app-message");
const seasonName = document.querySelector("#season-name");
const tabLinks = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");
const themeToggle = document.querySelector("#theme-toggle");

// Staff sign in
const signInButton = document.querySelector("#sign-in-button");
const signOutButton = document.querySelector("#sign-out-button");
const staffBadge = document.querySelector("#staff-badge");
const staffEmailText = document.querySelector("#staff-email");
const loginDialog = document.querySelector("#login-dialog");
const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginStatus = document.querySelector("#login-status");
const loginSubmit = document.querySelector("#login-submit");
const loginCancel = document.querySelector("#login-cancel");

// Match night
const weekSelect = document.querySelector("#week-select");
const gameSelect = document.querySelector("#game-select");
const teamSelect = document.querySelector("#team-select");
const placementInput = document.querySelector("#placement-input");
const playerInputs = document.querySelector("#player-inputs");
const resultForm = document.querySelector("#result-form");
const resultFormTitle = document.querySelector("#result-form-title");
const resultSubmit = document.querySelector("#result-submit");
const resultCancel = document.querySelector("#result-cancel");
const formStatus = document.querySelector("#form-status");
const resultsTitle = document.querySelector("#results-title");
const resultsMessage = document.querySelector("#results-message");
const resultsHead = document.querySelector("#results-head");
const resultsBody = document.querySelector("#results-body");
const matchList = document.querySelector("#match-list");

// Season tracker
const loadSampleButton = document.querySelector("#load-sample");
const clearResultsButton = document.querySelector("#clear-results");
const viewButtons = document.querySelectorAll(".seg");
const searchInput = document.querySelector("#search-input");
const seasonMessage = document.querySelector("#season-message");
const seasonHead = document.querySelector("#season-head");
const seasonBody = document.querySelector("#season-body");
const teamDetail = document.querySelector("#team-detail");

// Rosters
const teamForm = document.querySelector("#team-form");
const teamFormTitle = document.querySelector("#team-form-title");
const teamFormHint = document.querySelector("#team-form-hint");
const teamNameInput = document.querySelector("#team-name-input");
const schoolInput = document.querySelector("#school-input");
const player1Input = document.querySelector("#player1-input");
const player2Input = document.querySelector("#player2-input");
const teamFormStatus = document.querySelector("#team-form-status");
const teamSubmit = document.querySelector("#team-submit");
const teamCancel = document.querySelector("#team-cancel");
const rosterTitle = document.querySelector("#roster-title");
const rosterMessage = document.querySelector("#roster-message");
const rosterList = document.querySelector("#roster-list");

// Scoring rules
const ruleWeeks = document.querySelector("#rule-weeks");
const ruleGames = document.querySelector("#rule-games");
const ruleElim = document.querySelector("#rule-elim");
const pointsGrid = document.querySelector("#points-grid");
const pointsNote = document.querySelector("#points-note");
const rulesForm = document.querySelector("#rules-form");
const rulesSeasonInput = document.querySelector("#rules-season-input");
const rulesWeeksInput = document.querySelector("#rules-weeks-input");
const rulesGamesInput = document.querySelector("#rules-games-input");
const rulesElimInput = document.querySelector("#rules-elim-input");
const pointsInputs = document.querySelector("#points-inputs");
const addPlaceButton = document.querySelector("#add-place");
const removePlaceButton = document.querySelector("#remove-place");
const rulesStatus = document.querySelector("#rules-status");
const rulesDiscard = document.querySelector("#rules-discard");

// ---------------------------------------------------------------
// Talking to the server (server.js)
// ---------------------------------------------------------------

// Sends a request and returns the JSON the server answers with.
// If the server says no, this throws an Error with the server's message,
// so callers can show it with try / catch (Lecture 12).
async function api(method, url, body) {
  const options = { method: method, headers: {} };

  const token = localStorage.getItem("staffToken");
  if (token !== null) {
    options.headers["Authorization"] = "Bearer " + token;
  }

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    // Not JSON (for example an HTML error page). Keep data as {}.
  }

  // 401 while signed in means the session ran out.
  if (response.status === 401 && staffEmail !== null) {
    signedOut("You were signed out. Sign in again to keep editing.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed: " + response.status);
  }
  return data;
}

async function loadLeague() {
  const data = await api("GET", "/api/league");
  rules = data.rules;
  teams = data.teams;
  matches = data.matches;
}

// Re-download everything after a change, then re-draw.
async function refresh() {
  await loadLeague();
  renderAll();
}

// ---------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------
function showMessage(element, text) {
  element.textContent = text;
  element.classList.remove("hide");
}

function hideMessage(element) {
  element.classList.add("hide");
}

// Like showMessage, but colors the text green (success) or red (error).
function showStatus(element, text, isError) {
  showMessage(element, text);
  if (isError) {
    element.classList.add("error");
    element.classList.remove("success");
  } else {
    element.classList.add("success");
    element.classList.remove("error");
  }
}

// className can hold more than one class, like "num total".
// (classList.add() only takes one class per argument, so we set className instead.)
function makeCell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) {
    td.className = className;
  }
  return td;
}

// The first `leftColumns` headings are names (left-aligned); the rest sit over numbers.
function makeHeaderRow(headings, leftColumns) {
  const tr = document.createElement("tr");
  headings.forEach(function (heading, index) {
    const th = document.createElement("th");
    th.textContent = heading;
    if (index < leftColumns) {
      th.classList.add("left");
    }
    tr.appendChild(th);
  });
  return tr;
}

// Rank number with a gold / silver / bronze badge for the top 3.
function makeRankCell(rank) {
  const td = document.createElement("td");
  const badge = document.createElement("span");
  badge.textContent = rank;
  badge.classList.add("rank");
  if (rank <= 3) {
    badge.classList.add("rank-" + rank);
  }
  td.appendChild(badge);
  return td;
}

// Builds a simple table from headings + an array of row arrays.
function makeTable(headings, rows) {
  const wrap = document.createElement("div");
  wrap.classList.add("table-wrap");

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  thead.appendChild(makeHeaderRow(headings, 1));

  rows.forEach(function (values) {
    const tr = document.createElement("tr");
    values.forEach(function (value, index) {
      // first column is a name, the rest are numbers
      tr.appendChild(makeCell(value, index === 0 ? "name-cell" : "num"));
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

// isDanger makes it turn red on hover (for Delete buttons).
function makeSmallButton(text, onClick, isDanger) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("icon-button");
  if (isDanger) {
    button.classList.add("danger-hover");
  }
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

// Fills a <select> with "Week 1", "Week 2", ... and keeps the current choice if it still fits.
function fillNumberSelect(select, count, label) {
  const current = Number(select.value);
  select.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = label + " " + i;
    select.appendChild(option);
  }
  if (current >= 1 && current <= count) {
    select.value = current;
  }
}

function findTeam(teamId) {
  return teams.find(function (team) {
    return team.id === teamId;
  });
}

function findMatch(matchId) {
  return matches.find(function (match) {
    return match.id === matchId;
  });
}

function teamName(teamId) {
  const team = findTeam(teamId);
  if (team === undefined) {
    return "Unknown team";
  }
  return team.name;
}

// Shows "–" instead of 0.0 for teams/players with no games.
function formatAverage(value, games) {
  if (games === 0) {
    return "–";
  }
  return value.toFixed(1);
}

function isStaff() {
  return staffEmail !== null;
}

// ---------------------------------------------------------------
// Tabs: the page shown matches the #hash in the address bar,
// so refresh, the back button and shared links all work.
// (Sections are id="page-season" etc., not id="season", so the
// browser doesn't also jump-scroll down to them.)
// ---------------------------------------------------------------
function showPageFromHash() {
  let pageId = location.hash.slice(1);
  if (!pageIds.includes(pageId)) {
    pageId = "match-night";
  }

  pages.forEach(function (page) {
    if (page.id === "page-" + pageId) {
      page.classList.remove("hide");
    } else {
      page.classList.add("hide");
    }
  });

  tabLinks.forEach(function (link) {
    if (link.getAttribute("href") === "#" + pageId) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

window.addEventListener("hashchange", function () {
  showPageFromHash();
});

// ---------------------------------------------------------------
// Theme
// ---------------------------------------------------------------
function setTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
  }
}

// Only a click on the toggle saves a choice, so everyone else gets the dark default.
themeToggle.addEventListener("click", function () {
  let theme = "dark";
  if (document.body.classList.contains("dark")) {
    theme = "light";
  }
  setTheme(theme);
  localStorage.setItem("chosenTheme", theme);
});

// ---------------------------------------------------------------
// Staff sign in / sign out
// ---------------------------------------------------------------

// email = signed-in staff member, or null for the public view.
// CSS hides everything with class "admin-only" unless <body> has "is-admin".
function setStaff(email) {
  staffEmail = email;

  if (email === null) {
    document.body.classList.remove("is-admin");
    signInButton.classList.remove("hide");
    staffBadge.classList.add("hide");
  } else {
    document.body.classList.add("is-admin");
    signInButton.classList.add("hide");
    staffBadge.classList.remove("hide");
    staffEmailText.textContent = email;
  }

  stopEditingMatch();
  stopEditingTeam();
  if (rules !== null) {
    fillRulesForm();
    renderAll();
  }
}

function signedOut(message) {
  localStorage.removeItem("staffToken");
  setStaff(null);
  if (message) {
    showMessage(appMessage, message);
  }
}

// On page load: is the saved token still good?
async function checkStaff() {
  if (localStorage.getItem("staffToken") === null) {
    return;
  }
  try {
    const me = await api("GET", "/api/me");
    setStaff(me.email);
  } catch (error) {
    localStorage.removeItem("staffToken");
  }
}

signInButton.addEventListener("click", function () {
  loginForm.reset();
  hideMessage(loginStatus);
  loginDialog.showModal();
});

loginCancel.addEventListener("click", function () {
  loginDialog.close();
});

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  loginSubmit.disabled = true;

  try {
    const session = await api("POST", "/api/login", {
      email: loginEmail.value,
      password: loginPassword.value
    });
    localStorage.setItem("staffToken", session.token);
    loginDialog.close();
    hideMessage(appMessage);
    setStaff(session.email);
  } catch (error) {
    showStatus(loginStatus, error.message, true);
  }

  loginSubmit.disabled = false;
});

signOutButton.addEventListener("click", async function () {
  try {
    await api("POST", "/api/logout");
  } catch (error) {
    console.log(error);
  }
  signedOut();
});

// ---------------------------------------------------------------
// Match night
// ---------------------------------------------------------------
function fillTeamSelect() {
  const current = Number(teamSelect.value);
  teamSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a team…";
  teamSelect.appendChild(placeholder);

  teams.forEach(function (team) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    teamSelect.appendChild(option);
  });

  // Keep the old choice if that team still exists.
  if (findTeam(current) !== undefined) {
    teamSelect.value = current;
  } else {
    teamSelect.value = "";
    renderPlayerInputs();
  }
}

// One row of elims/deaths inputs for each player on the chosen team.
// When editing, existingMatch fills in the saved numbers.
function renderPlayerInputs(existingMatch) {
  playerInputs.innerHTML = "";
  const team = findTeam(Number(teamSelect.value));

  if (team === undefined) {
    const hint = document.createElement("p");
    hint.classList.add("hint");
    hint.textContent = "Pick a team to enter each player's eliminations and deaths.";
    playerInputs.appendChild(hint);
    return;
  }

  team.players.forEach(function (player) {
    let elims = 0;
    let deaths = 0;
    if (existingMatch && existingMatch.teamId === team.id) {
      const line = existingMatch.players.find(function (result) {
        return result.playerId === player.id;
      });
      if (line !== undefined) {
        elims = line.elims;
        deaths = line.deaths;
      }
    }

    const row = document.createElement("div");
    row.classList.add("player-row");
    row.setAttribute("data-player-id", player.id);

    const name = document.createElement("span");
    name.classList.add("player-name");
    name.textContent = player.name;

    const elimsLabel = document.createElement("label");
    elimsLabel.textContent = "Elims";
    const elimsInput = document.createElement("input");
    elimsInput.type = "number";
    elimsInput.min = 0;
    elimsInput.value = elims;
    elimsInput.classList.add("elims-input");
    elimsLabel.appendChild(elimsInput);

    const deathsLabel = document.createElement("label");
    deathsLabel.textContent = "Deaths";
    const deathsInput = document.createElement("input");
    deathsInput.type = "number";
    deathsInput.min = 0;
    deathsInput.value = deaths;
    deathsInput.classList.add("deaths-input");
    deathsLabel.appendChild(deathsInput);

    row.append(name, elimsLabel, deathsLabel);
    playerInputs.appendChild(row);
  });
}

teamSelect.addEventListener("change", function () {
  renderPlayerInputs(findMatch(editingMatchId));
});

weekSelect.addEventListener("change", function () {
  stopEditingMatch();
  renderMatchNight();
});

function startEditingMatch(matchId) {
  const match = findMatch(matchId);
  if (match === undefined) {
    return;
  }

  editingMatchId = match.id;
  gameSelect.value = match.game;
  teamSelect.value = match.teamId;
  placementInput.value = match.placement;
  renderPlayerInputs(match);

  resultFormTitle.textContent = "Edit result · G" + match.game + " · " + teamName(match.teamId);
  resultSubmit.textContent = "Update result";
  resultCancel.classList.remove("hide");
  resultForm.classList.add("editing");
  hideMessage(formStatus);

  renderMatchNight();
  resultForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Puts the form back to "add a new result".
function stopEditingMatch() {
  editingMatchId = null;
  resultFormTitle.textContent = "Enter a result";
  resultSubmit.textContent = "Save result";
  resultCancel.classList.add("hide");
  resultForm.classList.remove("editing");
  teamSelect.value = "";
  placementInput.value = "";
  hideMessage(formStatus);
  renderPlayerInputs();
}

resultCancel.addEventListener("click", function () {
  stopEditingMatch();
  renderMatchNight();
});

resultForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const teamId = Number(teamSelect.value);
  const team = findTeam(teamId);
  if (team === undefined) {
    showStatus(formStatus, "Choose a team first.", true);
    return;
  }

  // Read each player's row.
  const players = [];
  playerInputs.querySelectorAll(".player-row").forEach(function (row) {
    players.push({
      playerId: Number(row.getAttribute("data-player-id")),
      elims: Number(row.querySelector(".elims-input").value),
      deaths: Number(row.querySelector(".deaths-input").value)
    });
  });

  const result = {
    week: Number(weekSelect.value),
    game: Number(gameSelect.value),
    teamId: teamId,
    placement: Number(placementInput.value),
    players: players
  };

  // The server double-checks everything and answers with an error message if something's wrong.
  resultSubmit.disabled = true;
  try {
    let verb = "Saved";
    if (editingMatchId === null) {
      await api("POST", "/api/matches", result);
    } else {
      await api("PUT", "/api/matches/" + editingMatchId, result);
      verb = "Updated";
    }

    const message = verb + ": " + team.name + " finished " + ordinal(result.placement) + " for " + matchPoints(result, rules) + " points.";
    stopEditingMatch();
    await refresh();
    showStatus(formStatus, message, false);
  } catch (error) {
    showStatus(formStatus, error.message, true);
  }
  resultSubmit.disabled = false;
});

async function deleteMatch(matchId) {
  const match = findMatch(matchId);
  if (!confirm("Delete " + teamName(match.teamId) + "'s result for game " + match.game + "?")) {
    return;
  }

  try {
    await api("DELETE", "/api/matches/" + matchId);
    if (editingMatchId === matchId) {
      stopEditingMatch();
    }
    await refresh();
  } catch (error) {
    showStatus(formStatus, error.message, true);
  }
}

function renderMatchNight() {
  const week = Number(weekSelect.value);
  resultsTitle.textContent = "Week " + week + " results";

  resultsHead.innerHTML = "";
  resultsBody.innerHTML = "";
  matchList.innerHTML = "";

  const weekMatches = matches.filter(function (match) {
    return match.week === week;
  });

  if (weekMatches.length === 0) {
    showMessage(resultsMessage, "No results entered for week " + week + " yet.");
    return;
  }
  hideMessage(resultsMessage);

  // Header: # | Team | G1 | G2 | ... | Elims | Avg place | Points
  const headings = ["#", "Team"];
  for (let g = 1; g <= rules.matchesPerWeek; g++) {
    headings.push("G" + g);
  }
  headings.push("Elims", "Avg place", "Points");
  resultsHead.appendChild(makeHeaderRow(headings, 2));

  // Only teams that played this week.
  const ranked = standings(teams, weekMatches, rules).filter(function (row) {
    return row.games > 0;
  });

  ranked.forEach(function (row, index) {
    const tr = document.createElement("tr");
    tr.appendChild(makeRankCell(index + 1));
    tr.appendChild(makeCell(row.team, "name-cell"));

    for (let g = 1; g <= rules.matchesPerWeek; g++) {
      const match = weekMatches.find(function (m) {
        return m.teamId === row.teamId && m.game === g;
      });
      if (match === undefined) {
        tr.appendChild(makeCell("–", "num"));
      } else {
        tr.appendChild(makeCell(matchPoints(match, rules), "num"));
      }
    }

    tr.appendChild(makeCell(row.elims, "num"));
    tr.appendChild(makeCell(row.avgPlace.toFixed(1), "num"));
    tr.appendChild(makeCell(row.points, "num total"));
    resultsBody.appendChild(tr);
  });

  // List of every game entered, sorted by game then placement.
  const sorted = weekMatches.slice().sort(function (a, b) {
    if (a.game !== b.game) {
      return a.game - b.game;
    }
    return a.placement - b.placement;
  });

  sorted.forEach(function (match) {
    const li = document.createElement("li");
    if (match.id === editingMatchId) {
      li.classList.add("editing");
    }

    const gameTag = document.createElement("span");
    gameTag.classList.add("tag");
    gameTag.textContent = "G" + match.game;

    const summary = document.createElement("span");
    summary.classList.add("match-summary");
    const elims = teamElims(match);
    summary.textContent = teamName(match.teamId) + " · " + ordinal(match.placement) + " · " + elims + (elims === 1 ? " elim" : " elims");

    const points = document.createElement("span");
    points.classList.add("match-points");
    points.textContent = matchPoints(match, rules) + " pts";

    li.append(gameTag, summary, points);

    // Staff get Edit and Delete buttons on every result.
    if (isStaff()) {
      li.append(
        makeSmallButton("Edit", function () {
          startEditingMatch(match.id);
        }),
        makeSmallButton("Delete", function () {
          deleteMatch(match.id);
        }, true)
      );
    }

    matchList.appendChild(li);
  });
}

// ---------------------------------------------------------------
// Season tracker
// ---------------------------------------------------------------
viewButtons.forEach(function (button) {
  button.addEventListener("click", function (event) {
    seasonView = event.target.getAttribute("data-view");

    viewButtons.forEach(function (b) {
      if (b.getAttribute("data-view") === seasonView) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    renderSeason();
  });
});

searchInput.addEventListener("input", function () {
  renderSeason();
});

function matchesSearch(text, search) {
  return text.toLowerCase().includes(search);
}

function renderSeason() {
  seasonHead.innerHTML = "";
  seasonBody.innerHTML = "";
  const search = searchInput.value.trim().toLowerCase();

  if (teams.length === 0) {
    showMessage(seasonMessage, "No teams yet. Staff can add them on the Rosters tab.");
    renderTeamDetail();
    return;
  }

  let shown = 0;
  if (seasonView === "teams") {
    shown = renderTeamStandings(search);
  } else {
    shown = renderPlayerTable(search);
  }

  if (matches.length === 0) {
    showMessage(seasonMessage, "No results yet. They'll show up here once staff enter them on Match night.");
  } else if (shown === 0) {
    showMessage(seasonMessage, "Nothing matches \"" + searchInput.value.trim() + "\".");
  } else {
    hideMessage(seasonMessage);
  }

  renderTeamDetail();
}

// Returns how many rows were shown (so we can show a "no matches" message).
function renderTeamStandings(search) {
  const headings = ["#", "Team"];
  for (let w = 1; w <= rules.weeks; w++) {
    headings.push("W" + w);
  }
  headings.push("Games", "Elims", "Avg place", "Points");
  seasonHead.appendChild(makeHeaderRow(headings, 2));

  const ranked = standings(teams, matches, rules);
  let shown = 0;

  // Rank comes from the full list, so it stays correct while searching.
  ranked.forEach(function (row, index) {
    if (!matchesSearch(row.team, search)) {
      return;
    }
    shown = shown + 1;

    const tr = document.createElement("tr");
    if (row.teamId === selectedTeamId) {
      tr.classList.add("selected");
    }
    tr.appendChild(makeRankCell(index + 1));

    const nameCell = document.createElement("td");
    nameCell.classList.add("name-cell");
    const nameButton = document.createElement("button");
    nameButton.classList.add("link-button");
    nameButton.textContent = row.team;
    nameButton.addEventListener("click", function () {
      selectTeam(row.teamId);
    });
    nameCell.appendChild(nameButton);
    tr.appendChild(nameCell);

    const team = findTeam(row.teamId);
    for (let w = 1; w <= rules.weeks; w++) {
      const weekMatches = matches.filter(function (match) {
        return match.week === w;
      });
      const week = teamStats(team, weekMatches, rules);
      tr.appendChild(makeCell(week.games === 0 ? "–" : week.points, "num"));
    }

    tr.appendChild(makeCell(row.games, "num"));
    tr.appendChild(makeCell(row.elims, "num"));
    tr.appendChild(makeCell(formatAverage(row.avgPlace, row.games), "num"));
    tr.appendChild(makeCell(row.points, "num total"));
    seasonBody.appendChild(tr);
  });

  return shown;
}

function renderPlayerTable(search) {
  seasonHead.appendChild(makeHeaderRow(["#", "Player", "Team", "Games", "Elims", "Avg elims", "Deaths", "K/D", "Points", "Avg pts"], 3));

  const players = allPlayerStats(teams, matches, rules);
  let shown = 0;

  players.forEach(function (player, index) {
    if (!matchesSearch(player.name, search) && !matchesSearch(player.team, search)) {
      return;
    }
    shown = shown + 1;

    const tr = document.createElement("tr");
    tr.appendChild(makeRankCell(index + 1));
    tr.appendChild(makeCell(player.name, "name-cell"));
    tr.appendChild(makeCell(player.team, "muted"));
    tr.appendChild(makeCell(player.games, "num"));
    tr.appendChild(makeCell(player.elims, "num"));
    tr.appendChild(makeCell(formatAverage(player.avgElims, player.games), "num"));
    tr.appendChild(makeCell(player.deaths, "num"));
    tr.appendChild(makeCell(player.games === 0 ? "–" : player.kd.toFixed(2), "num"));
    tr.appendChild(makeCell(player.points, "num total"));
    tr.appendChild(makeCell(formatAverage(player.avgPoints, player.games), "num"));
    seasonBody.appendChild(tr);
  });

  return shown;
}

function selectTeam(teamId) {
  selectedTeamId = teamId;
  renderSeason();
  teamDetail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function makeStatCard(label, value) {
  const card = document.createElement("div");
  card.classList.add("stat-card");

  const valueEl = document.createElement("p");
  valueEl.classList.add("stat-value");
  valueEl.textContent = value;

  const labelEl = document.createElement("p");
  labelEl.classList.add("stat-label");
  labelEl.textContent = label;

  card.append(valueEl, labelEl);
  return card;
}

function renderTeamDetail() {
  teamDetail.innerHTML = "";
  const team = findTeam(selectedTeamId);

  if (team === undefined) {
    selectedTeamId = null;
    teamDetail.classList.add("hide");
    return;
  }
  teamDetail.classList.remove("hide");

  // Heading row with a close button
  const head = document.createElement("div");
  head.classList.add("detail-head");

  const titleBox = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = team.name;
  const sub = document.createElement("p");
  sub.classList.add("muted");
  const playerNames = team.players.map(function (player) {
    return player.name;
  });
  sub.textContent = (team.school === "" ? "No school listed" : team.school) + " · " + playerNames.join(" & ");
  titleBox.append(title, sub);

  const closeButton = makeSmallButton("Close", function () {
    selectedTeamId = null;
    renderSeason();
  });

  head.append(titleBox, closeButton);
  teamDetail.appendChild(head);

  // Season stat cards
  const ranked = standings(teams, matches, rules);
  const rank = ranked.findIndex(function (row) {
    return row.teamId === team.id;
  }) + 1;
  const stats = teamStats(team, matches, rules);

  const cards = document.createElement("div");
  cards.classList.add("stat-cards");
  cards.append(
    makeStatCard("Rank", ordinal(rank)),
    makeStatCard("Total points", stats.points),
    makeStatCard("Avg points / game", formatAverage(stats.avgPoints, stats.games)),
    makeStatCard("Total elims", stats.elims),
    makeStatCard("Avg elims / game", formatAverage(stats.avgElims, stats.games)),
    makeStatCard("Avg placement", formatAverage(stats.avgPlace, stats.games)),
    makeStatCard("Games", stats.games)
  );
  teamDetail.appendChild(cards);

  // Weekly results
  const weeklyTitle = document.createElement("h3");
  weeklyTitle.textContent = "Weekly results";
  teamDetail.appendChild(weeklyTitle);

  const weekRows = [];
  for (let w = 1; w <= rules.weeks; w++) {
    const weekMatches = matches.filter(function (match) {
      return match.week === w;
    });
    const week = teamStats(team, weekMatches, rules);
    if (week.games > 0) {
      weekRows.push(["Week " + w, week.games, week.elims, week.avgPlace.toFixed(1), week.points]);
    }
  }

  if (weekRows.length === 0) {
    const empty = document.createElement("p");
    empty.classList.add("hint");
    empty.textContent = "No games played yet.";
    teamDetail.appendChild(empty);
  } else {
    teamDetail.appendChild(makeTable(["Week", "Games", "Elims", "Avg place", "Points"], weekRows));
  }

  // Player stats for this team
  const playersTitle = document.createElement("h3");
  playersTitle.textContent = "Players";
  teamDetail.appendChild(playersTitle);

  const playerRows = team.players.map(function (player) {
    const p = playerStats(player, team, matches, rules);
    return [
      p.name,
      p.games,
      p.elims,
      formatAverage(p.avgElims, p.games),
      p.deaths,
      p.games === 0 ? "–" : p.kd.toFixed(2),
      p.points,
      formatAverage(p.avgPoints, p.games)
    ];
  });
  teamDetail.appendChild(makeTable(["Player", "Games", "Elims", "Avg elims", "Deaths", "K/D", "Points", "Avg pts"], playerRows));
}

// Staff only: replaces every team and result with the sample season.
loadSampleButton.addEventListener("click", async function () {
  if (matches.length > 0 && !confirm("Replace ALL teams and results with the sample season?")) {
    return;
  }

  loadSampleButton.disabled = true;
  showMessage(seasonMessage, "Loading sample season...");
  try {
    await api("POST", "/api/sample-season");
    selectedTeamId = null;
    stopEditingMatch();
    stopEditingTeam();
    await refresh();
    weekSelect.value = latestWeek();
    renderMatchNight();
  } catch (error) {
    showMessage(seasonMessage, error.message);
  }
  loadSampleButton.disabled = false;
});

clearResultsButton.addEventListener("click", async function () {
  if (matches.length === 0) {
    return;
  }
  if (!confirm("Delete all " + matches.length + " results? Teams will be kept.")) {
    return;
  }

  try {
    await api("DELETE", "/api/matches");
    stopEditingMatch();
    await refresh();
  } catch (error) {
    showMessage(seasonMessage, error.message);
  }
});

// ---------------------------------------------------------------
// Rosters
// ---------------------------------------------------------------
function startEditingTeam(teamId) {
  const team = findTeam(teamId);
  if (team === undefined) {
    return;
  }

  editingTeamId = team.id;
  teamNameInput.value = team.name;
  schoolInput.value = team.school;
  player1Input.value = team.players[0] ? team.players[0].name : "";
  player2Input.value = team.players[1] ? team.players[1].name : "";

  teamFormTitle.textContent = "Edit " + team.name;
  teamSubmit.textContent = "Save changes";
  teamCancel.classList.remove("hide");
  teamFormHint.classList.remove("hide");
  teamForm.classList.add("editing");
  hideMessage(teamFormStatus);

  renderRosters();
  teamForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopEditingTeam() {
  editingTeamId = null;
  teamForm.reset();
  teamFormTitle.textContent = "Add a team";
  teamSubmit.textContent = "Add team";
  teamCancel.classList.add("hide");
  teamFormHint.classList.add("hide");
  teamForm.classList.remove("editing");
  hideMessage(teamFormStatus);
}

teamCancel.addEventListener("click", function () {
  stopEditingTeam();
  renderRosters();
});

teamForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const team = {
    name: teamNameInput.value.trim(),
    school: schoolInput.value.trim(),
    players: [player1Input.value.trim(), player2Input.value.trim()]
  };

  teamSubmit.disabled = true;
  try {
    let message = team.name + " was added.";
    if (editingTeamId === null) {
      await api("POST", "/api/teams", team);
    } else {
      await api("PUT", "/api/teams/" + editingTeamId, team);
      message = team.name + " was updated.";
    }

    stopEditingTeam();
    await refresh();
    showStatus(teamFormStatus, message, false);
  } catch (error) {
    showStatus(teamFormStatus, error.message, true);
  }
  teamSubmit.disabled = false;
});

async function deleteTeam(teamId) {
  const team = findTeam(teamId);
  const teamMatches = matches.filter(function (match) {
    return match.teamId === teamId;
  });

  let question = "Delete " + team.name + "?";
  if (teamMatches.length > 0) {
    question = "Delete " + team.name + " and its " + teamMatches.length + " results?";
  }
  if (!confirm(question)) {
    return;
  }

  try {
    await api("DELETE", "/api/teams/" + teamId);
    if (editingTeamId === teamId) {
      stopEditingTeam();
    }
    await refresh();
  } catch (error) {
    showStatus(teamFormStatus, error.message, true);
  }
}

function renderRosters() {
  rosterList.innerHTML = "";
  rosterTitle.textContent = teams.length + (teams.length === 1 ? " team" : " teams");

  if (teams.length === 0) {
    showMessage(rosterMessage, "No teams yet.");
    return;
  }
  hideMessage(rosterMessage);

  teams.forEach(function (team) {
    const stats = teamStats(team, matches, rules);
    const li = document.createElement("li");
    if (team.id === editingTeamId) {
      li.classList.add("editing");
    }

    const info = document.createElement("div");
    info.classList.add("roster-info");

    const name = document.createElement("p");
    name.classList.add("roster-name");
    name.textContent = team.name;

    const school = document.createElement("p");
    school.classList.add("muted");
    school.textContent = team.school === "" ? "No school listed" : team.school;

    const players = document.createElement("div");
    players.classList.add("chips");
    team.players.forEach(function (player) {
      const chip = document.createElement("span");
      chip.classList.add("chip");
      chip.textContent = player.name;
      players.appendChild(chip);
    });

    info.append(name, school, players);

    const record = document.createElement("p");
    record.classList.add("roster-record");
    record.textContent = stats.games + " games · " + stats.points + " pts";

    li.append(info, record);

    if (isStaff()) {
      li.append(
        makeSmallButton("Edit", function () {
          startEditingTeam(team.id);
        }),
        makeSmallButton("Delete", function () {
          deleteTeam(team.id);
        }, true)
      );
    }

    rosterList.appendChild(li);
  });
}

// ---------------------------------------------------------------
// Scoring rules
// ---------------------------------------------------------------
function renderRules() {
  seasonName.textContent = rules.seasonName;
  ruleWeeks.textContent = rules.weeks;
  ruleGames.textContent = rules.matchesPerWeek;
  ruleElim.textContent = rules.pointsPerElim;

  pointsGrid.innerHTML = "";
  rules.placementPoints.forEach(function (points, index) {
    const li = document.createElement("li");
    if (index < 3) {
      li.classList.add("top-" + (index + 1));
    }

    const place = document.createElement("span");
    place.textContent = ordinal(index + 1);

    const value = document.createElement("strong");
    value.textContent = points;

    li.append(place, value);
    pointsGrid.appendChild(li);
  });

  pointsNote.textContent = "Places after " + ordinal(rules.placementPoints.length) + " earn 0 placement points but still score elimination points.";
}

// One number box per place in the staff rules editor.
function addPlaceInput(points) {
  const place = pointsInputs.children.length + 1;

  const li = document.createElement("li");
  const label = document.createElement("label");
  label.textContent = ordinal(place);

  const input = document.createElement("input");
  input.type = "number";
  input.min = 0;
  input.max = 500;
  input.required = true;
  input.value = points;
  input.classList.add("place-input");

  label.appendChild(input);
  li.appendChild(label);
  pointsInputs.appendChild(li);
}

// Copies the saved rules into the editor (also used by "Discard changes").
function fillRulesForm() {
  rulesSeasonInput.value = rules.seasonName;
  rulesWeeksInput.value = rules.weeks;
  rulesGamesInput.value = rules.matchesPerWeek;
  rulesElimInput.value = rules.pointsPerElim;

  pointsInputs.innerHTML = "";
  rules.placementPoints.forEach(function (points) {
    addPlaceInput(points);
  });
  hideMessage(rulesStatus);
}

addPlaceButton.addEventListener("click", function () {
  addPlaceInput(0);
});

removePlaceButton.addEventListener("click", function () {
  if (pointsInputs.children.length > 1) {
    pointsInputs.lastElementChild.remove();
  }
});

rulesDiscard.addEventListener("click", function () {
  fillRulesForm();
});

rulesForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const placementPoints = [];
  pointsInputs.querySelectorAll(".place-input").forEach(function (input) {
    placementPoints.push(Number(input.value));
  });

  const newRules = {
    seasonName: rulesSeasonInput.value.trim(),
    weeks: Number(rulesWeeksInput.value),
    matchesPerWeek: Number(rulesGamesInput.value),
    pointsPerElim: Number(rulesElimInput.value),
    placementPoints: placementPoints
  };

  try {
    await api("PUT", "/api/rules", newRules);
    await refresh();
    fillRulesForm();
    showStatus(rulesStatus, "Rules saved. Every score has been recalculated.", false);
  } catch (error) {
    showStatus(rulesStatus, error.message, true);
  }
});

// ---------------------------------------------------------------
// Start up
// ---------------------------------------------------------------

// Re-draw everything that depends on the league data.
function renderAll() {
  fillNumberSelect(weekSelect, rules.weeks, "Week");
  fillNumberSelect(gameSelect, rules.matchesPerWeek, "Game");
  fillTeamSelect();
  renderRules();
  renderMatchNight();
  renderSeason();
  renderRosters();
}

// Start the week picker on the latest week that has results.
function latestWeek() {
  const latest = matches.reduce(function (highest, match) {
    return Math.max(highest, match.week);
  }, 1);
  return Math.min(latest, rules.weeks);
}

async function init() {
  // Dark mode is the default; light only if the visitor picked it with the toggle.
  setTheme(localStorage.getItem("chosenTheme") === "light" ? "light" : "dark");
  showPageFromHash();
  showMessage(appMessage, "Loading league data...");

  try {
    await loadLeague();
    hideMessage(appMessage);
  } catch (error) {
    showMessage(appMessage, "Couldn't reach the league server. Start it with npm start, then open http://localhost:3000.");
    appMessage.classList.add("error");
    console.log(error);
    return;
  }

  renderAll();
  weekSelect.value = latestWeek();
  renderMatchNight();
  fillRulesForm();
  await checkStaff();

  // Public viewers get fresh scores every 30 seconds without reloading.
  // (Skipped for staff so nothing moves while they're typing.)
  setInterval(async function () {
    if (isStaff() || document.hidden) {
      return;
    }
    try {
      await refresh();
    } catch (error) {
      console.log(error);
    }
  }, 30000);
}

init();
