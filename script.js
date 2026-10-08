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
// State: everything the app knows lives in these variables.
// The page is always re-drawn from them (see renderAll()).
// ---------------------------------------------------------------
let rules = null;
let teams = [];
let matches = [];
let seasonView = "teams"; // "teams" or "players"
let selectedTeam = null; // team name shown in the detail panel

// ---------------------------------------------------------------
// Element references
// ---------------------------------------------------------------
const appMessage = document.querySelector("#app-message");
const seasonName = document.querySelector("#season-name");
const tabButtons = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");
const themeToggle = document.querySelector("#theme-toggle");

// Match night
const weekSelect = document.querySelector("#week-select");
const gameSelect = document.querySelector("#game-select");
const teamSelect = document.querySelector("#team-select");
const placementInput = document.querySelector("#placement-input");
const playerInputs = document.querySelector("#player-inputs");
const resultForm = document.querySelector("#result-form");
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
const teamNameInput = document.querySelector("#team-name-input");
const schoolInput = document.querySelector("#school-input");
const player1Input = document.querySelector("#player1-input");
const player2Input = document.querySelector("#player2-input");
const teamFormStatus = document.querySelector("#team-form-status");
const rosterTitle = document.querySelector("#roster-title");
const rosterMessage = document.querySelector("#roster-message");
const rosterList = document.querySelector("#roster-list");

// Scoring rules
const ruleWeeks = document.querySelector("#rule-weeks");
const ruleGames = document.querySelector("#rule-games");
const ruleElim = document.querySelector("#rule-elim");
const pointsGrid = document.querySelector("#points-grid");
const pointsNote = document.querySelector("#points-note");

// ---------------------------------------------------------------
// Loading and saving data
// ---------------------------------------------------------------

// fetch() a JSON file and return the parsed data (Lecture 12).
async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Request failed: " + response.status);
  }
  return await response.json();
}

// localStorage only stores text, so arrays get turned into JSON text first.
function saveData() {
  localStorage.setItem("teams", JSON.stringify(teams));
  localStorage.setItem("matches", JSON.stringify(matches));
}

// Returns the saved array, or null if nothing has been saved yet.
function loadSaved(key) {
  const text = localStorage.getItem(key);
  if (text === null) {
    return null;
  }
  return JSON.parse(text);
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

function fillNumberSelect(select, count, label) {
  select.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = label + " " + i;
    select.appendChild(option);
  }
}

function findTeam(teamName) {
  return teams.find(function (team) {
    return team.name === teamName;
  });
}

// Shows "–" instead of 0.0 for teams/players with no games.
function formatAverage(value, games) {
  if (games === 0) {
    return "–";
  }
  return value.toFixed(1);
}

// ---------------------------------------------------------------
// Tabs and theme
// ---------------------------------------------------------------
function showPage(pageId) {
  pages.forEach(function (page) {
    if (page.id === pageId) {
      page.classList.remove("hide");
    } else {
      page.classList.add("hide");
    }
  });

  tabButtons.forEach(function (button) {
    if (button.getAttribute("data-page") === pageId) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

tabButtons.forEach(function (button) {
  button.addEventListener("click", function (event) {
    showPage(event.target.getAttribute("data-page"));
  });
});

function setTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
  }
  localStorage.setItem("theme", theme);
}

themeToggle.addEventListener("click", function () {
  if (document.body.classList.contains("dark")) {
    setTheme("light");
  } else {
    setTheme("dark");
  }
});

// ---------------------------------------------------------------
// Match night
// ---------------------------------------------------------------
function fillTeamSelect() {
  const current = teamSelect.value;
  teamSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a team…";
  teamSelect.appendChild(placeholder);

  teams.forEach(function (team) {
    const option = document.createElement("option");
    option.value = team.name;
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
function renderPlayerInputs() {
  playerInputs.innerHTML = "";
  const team = findTeam(teamSelect.value);

  if (team === undefined) {
    const hint = document.createElement("p");
    hint.classList.add("hint");
    hint.textContent = "Pick a team to enter each player's eliminations and deaths.";
    playerInputs.appendChild(hint);
    return;
  }

  team.players.forEach(function (playerName) {
    const row = document.createElement("div");
    row.classList.add("player-row");
    row.setAttribute("data-player", playerName);

    const name = document.createElement("span");
    name.classList.add("player-name");
    name.textContent = playerName;

    const elimsLabel = document.createElement("label");
    elimsLabel.textContent = "Elims";
    const elimsInput = document.createElement("input");
    elimsInput.type = "number";
    elimsInput.min = 0;
    elimsInput.value = 0;
    elimsInput.classList.add("elims-input");
    elimsLabel.appendChild(elimsInput);

    const deathsLabel = document.createElement("label");
    deathsLabel.textContent = "Deaths";
    const deathsInput = document.createElement("input");
    deathsInput.type = "number";
    deathsInput.min = 0;
    deathsInput.value = 0;
    deathsInput.classList.add("deaths-input");
    deathsLabel.appendChild(deathsInput);

    row.append(name, elimsLabel, deathsLabel);
    playerInputs.appendChild(row);
  });
}

teamSelect.addEventListener("change", function () {
  renderPlayerInputs();
});

weekSelect.addEventListener("change", function () {
  renderMatchNight();
});

function isWholeNumber(value) {
  return Number.isInteger(value) && value >= 0;
}

resultForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const week = Number(weekSelect.value);
  const game = Number(gameSelect.value);
  const teamName = teamSelect.value;
  const placement = Number(placementInput.value);

  if (teamName === "") {
    showStatus(formStatus, "Choose a team first.", true);
    return;
  }

  if (!isWholeNumber(placement) || placement < 1) {
    showStatus(formStatus, "Placement must be 1 or higher.", true);
    return;
  }

  // Only one result per team per game.
  const duplicateIndex = matches.findIndex(function (match) {
    return match.week === week && match.game === game && match.team === teamName;
  });
  if (duplicateIndex !== -1) {
    showStatus(formStatus, teamName + " already has a result for week " + week + ", game " + game + ". Delete it below to re-enter it.", true);
    return;
  }

  // Two teams can't finish in the same place in the same game.
  const takenBy = matches.find(function (match) {
    return match.week === week && match.game === game && match.placement === placement;
  });
  if (takenBy !== undefined) {
    showStatus(formStatus, ordinal(placement) + " place in game " + game + " is already taken by " + takenBy.team + ".", true);
    return;
  }

  // Read each player's row.
  const players = [];
  let badNumber = false;
  playerInputs.querySelectorAll(".player-row").forEach(function (row) {
    const elims = Number(row.querySelector(".elims-input").value);
    const deaths = Number(row.querySelector(".deaths-input").value);

    if (!isWholeNumber(elims) || !isWholeNumber(deaths)) {
      badNumber = true;
    }

    players.push({
      name: row.getAttribute("data-player"),
      elims: elims,
      deaths: deaths
    });
  });

  if (badNumber) {
    showStatus(formStatus, "Elims and deaths must be whole numbers, 0 or more.", true);
    return;
  }

  const match = {
    id: "m" + Date.now(),
    week: week,
    game: game,
    team: teamName,
    placement: placement,
    players: players
  };

  matches.push(match);
  saveData();

  showStatus(formStatus, "Saved: " + teamName + " finished " + ordinal(placement) + " for " + matchPoints(match, rules) + " points.", false);

  // Clear the team-specific parts but keep week and game for the next entry.
  teamSelect.value = "";
  placementInput.value = "";
  renderPlayerInputs();
  renderAll();
});

function deleteMatch(matchId) {
  const index = matches.findIndex(function (match) {
    return match.id === matchId;
  });

  if (index === -1) {
    return;
  }

  matches.splice(index, 1);
  saveData();
  renderAll();
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
        return m.team === row.team && m.game === g;
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

    const gameTag = document.createElement("span");
    gameTag.classList.add("tag");
    gameTag.textContent = "G" + match.game;

    const summary = document.createElement("span");
    summary.classList.add("match-summary");
    summary.textContent = match.team + " · " + ordinal(match.placement) + " · " + teamElims(match) + " elims";

    const points = document.createElement("span");
    points.classList.add("match-points");
    points.textContent = matchPoints(match, rules) + " pts";

    const deleteButton = document.createElement("button");
    deleteButton.classList.add("icon-button");
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("data-id", match.id);
    deleteButton.addEventListener("click", function (event) {
      deleteMatch(event.target.getAttribute("data-id"));
    });

    li.append(gameTag, summary, points, deleteButton);
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
    showMessage(seasonMessage, "No teams yet. Add some on the Rosters tab.");
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
    showMessage(seasonMessage, "No results yet. Enter some on Match night, or click \"Load sample season\".");
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
    if (row.team === selectedTeam) {
      tr.classList.add("selected");
    }
    tr.appendChild(makeRankCell(index + 1));

    const nameCell = document.createElement("td");
    nameCell.classList.add("name-cell");
    const nameButton = document.createElement("button");
    nameButton.classList.add("link-button");
    nameButton.textContent = row.team;
    nameButton.setAttribute("data-team", row.team);
    nameButton.addEventListener("click", function (event) {
      selectTeam(event.target.getAttribute("data-team"));
    });
    nameCell.appendChild(nameButton);
    tr.appendChild(nameCell);

    for (let w = 1; w <= rules.weeks; w++) {
      const weekMatches = matches.filter(function (match) {
        return match.week === w;
      });
      const week = teamStats(row.team, weekMatches, rules);
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

function selectTeam(teamName) {
  selectedTeam = teamName;
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
  const team = findTeam(selectedTeam);

  if (team === undefined) {
    selectedTeam = null;
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
  sub.textContent = team.school + " · " + team.players.join(" & ");
  titleBox.append(title, sub);

  const closeButton = document.createElement("button");
  closeButton.classList.add("icon-button");
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", function () {
    selectedTeam = null;
    renderSeason();
  });

  head.append(titleBox, closeButton);
  teamDetail.appendChild(head);

  // Season stat cards
  const ranked = standings(teams, matches, rules);
  const rank = ranked.findIndex(function (row) {
    return row.team === team.name;
  }) + 1;
  const stats = teamStats(team.name, matches, rules);

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
    const week = teamStats(team.name, weekMatches, rules);
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

  const playerRows = team.players.map(function (playerName) {
    const p = playerStats(playerName, team.name, matches, rules);
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

// Replaces the current teams and results with the files in /data.
async function loadSampleSeason() {
  if (matches.length > 0) {
    const ok = confirm("Replace your current teams and results with the sample season?");
    if (!ok) {
      return;
    }
  }

  loadSampleButton.disabled = true;
  showMessage(seasonMessage, "Loading sample season...");

  try {
    const sampleTeams = await loadJson("data/teams.json");
    const sampleMatches = await loadJson("data/sample-matches.json");

    teams = sampleTeams;
    matches = sampleMatches;
    selectedTeam = null;
    saveData();
    renderAll();
  } catch (error) {
    showMessage(seasonMessage, "Couldn't load the sample season. Please try again.");
    console.log(error);
  }

  loadSampleButton.disabled = false;
}

loadSampleButton.addEventListener("click", function () {
  loadSampleSeason();
});

clearResultsButton.addEventListener("click", function () {
  if (matches.length === 0) {
    return;
  }
  const ok = confirm("Delete all " + matches.length + " results? Teams will be kept.");
  if (!ok) {
    return;
  }
  matches = [];
  saveData();
  renderAll();
});

// ---------------------------------------------------------------
// Rosters
// ---------------------------------------------------------------
teamForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const name = teamNameInput.value.trim();
  const school = schoolInput.value.trim();
  const player1 = player1Input.value.trim();
  const player2 = player2Input.value.trim();

  if (name === "" || player1 === "" || player2 === "") {
    showStatus(teamFormStatus, "Team name and both players are required.", true);
    return;
  }

  const existingIndex = teams.findIndex(function (team) {
    return team.name.toLowerCase() === name.toLowerCase();
  });
  if (existingIndex !== -1) {
    showStatus(teamFormStatus, "There's already a team called " + teams[existingIndex].name + ".", true);
    return;
  }

  if (player1.toLowerCase() === player2.toLowerCase()) {
    showStatus(teamFormStatus, "The two players need different names.", true);
    return;
  }

  teams.push({
    name: name,
    school: school,
    players: [player1, player2]
  });
  saveData();

  teamForm.reset();
  showStatus(teamFormStatus, name + " was added.", false);
  renderAll();
});

function deleteTeam(teamName) {
  const teamMatches = matches.filter(function (match) {
    return match.team === teamName;
  });

  let question = "Delete " + teamName + "?";
  if (teamMatches.length > 0) {
    question = "Delete " + teamName + " and its " + teamMatches.length + " results?";
  }
  if (!confirm(question)) {
    return;
  }

  const index = teams.findIndex(function (team) {
    return team.name === teamName;
  });
  teams.splice(index, 1);

  // Keep every match that isn't this team's.
  matches = matches.filter(function (match) {
    return match.team !== teamName;
  });

  saveData();
  renderAll();
}

function renderRosters() {
  rosterList.innerHTML = "";
  rosterTitle.textContent = teams.length + (teams.length === 1 ? " team" : " teams");

  if (teams.length === 0) {
    showMessage(rosterMessage, "No teams yet. Add one with the form.");
    return;
  }
  hideMessage(rosterMessage);

  teams.forEach(function (team) {
    const stats = teamStats(team.name, matches, rules);
    const li = document.createElement("li");

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
    team.players.forEach(function (playerName) {
      const chip = document.createElement("span");
      chip.classList.add("chip");
      chip.textContent = playerName;
      players.appendChild(chip);
    });

    info.append(name, school, players);

    const record = document.createElement("p");
    record.classList.add("roster-record");
    record.textContent = stats.games + " games · " + stats.points + " pts";

    const deleteButton = document.createElement("button");
    deleteButton.classList.add("icon-button");
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("data-team", team.name);
    deleteButton.addEventListener("click", function (event) {
      deleteTeam(event.target.getAttribute("data-team"));
    });

    li.append(info, record, deleteButton);
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

// ---------------------------------------------------------------
// Start up
// ---------------------------------------------------------------

// Re-draw everything that depends on teams or matches.
function renderAll() {
  fillTeamSelect();
  renderMatchNight();
  renderSeason();
  renderRosters();
}

// Start the week picker on the latest week that has results.
function latestWeek() {
  return matches.reduce(function (latest, match) {
    return Math.max(latest, match.week);
  }, 1);
}

async function init() {
  setTheme(localStorage.getItem("theme") === "dark" ? "dark" : "light");
  showMessage(appMessage, "Loading league data...");

  try {
    rules = await loadJson("data/rules.json");

    // First visit: start from data/teams.json. After that, use what was saved.
    const savedTeams = loadSaved("teams");
    if (savedTeams === null) {
      teams = await loadJson("data/teams.json");
    } else {
      teams = savedTeams;
    }

    const savedMatches = loadSaved("matches");
    if (savedMatches !== null) {
      matches = savedMatches;
    }

    hideMessage(appMessage);
  } catch (error) {
    showMessage(appMessage, "Couldn't load the league data. Open this page with Live Server — fetch() doesn't work from a file:// URL.");
    appMessage.classList.add("error");
    console.log(error);
    return;
  }

  fillNumberSelect(weekSelect, rules.weeks, "Week");
  fillNumberSelect(gameSelect, rules.matchesPerWeek, "Game");
  weekSelect.value = latestWeek();

  renderRules();
  renderPlayerInputs();
  renderAll();
}

init();
