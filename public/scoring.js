// scoring.js
// Pure functions that turn saved match results into points and stats.
// None of these change their inputs or touch the page (see Lecture 8),
// so script.js can call them any time it needs fresh numbers.

// Points for finishing in a given place. 1st place is index 0 in the array.
export function placementPoints(placement, rules) {
  const points = rules.placementPoints[placement - 1];

  if (points === undefined) {
    return 0;
  }
  return points;
}

// Total eliminations for the whole team in one match.
export function teamElims(match) {
  return match.players.reduce(function (sum, player) {
    return sum + player.elims;
  }, 0);
}

// Team points for one match = placement points + (team elims x points per elim).
export function matchPoints(match, rules) {
  return placementPoints(match.placement, rules) + teamElims(match) * rules.pointsPerElim;
}

export function average(total, count) {
  if (count === 0) {
    return 0;
  }
  return total / count;
}

// K/D: if a player never died, their K/D is just their elims.
export function killDeath(elims, deaths) {
  if (deaths === 0) {
    return elims;
  }
  return elims / deaths;
}

// Season (or single-week) stats for one team.
// team is { id, name }. Matches point at their team by id (match.teamId),
// so renaming a team never loses its results.
export function teamStats(team, matches, rules) {
  const teamMatches = matches.filter(function (match) {
    return match.teamId === team.id;
  });

  const games = teamMatches.length;

  const elims = teamMatches.reduce(function (sum, match) {
    return sum + teamElims(match);
  }, 0);

  const points = teamMatches.reduce(function (sum, match) {
    return sum + matchPoints(match, rules);
  }, 0);

  const placementTotal = teamMatches.reduce(function (sum, match) {
    return sum + match.placement;
  }, 0);

  return {
    teamId: team.id,
    team: team.name,
    games: games,
    elims: elims,
    points: points,
    avgElims: average(elims, games),
    avgPoints: average(points, games),
    avgPlace: average(placementTotal, games)
  };
}

// Tie breakers, in order: total points, total elims, average placement (lower is better).
export function compareStandings(a, b) {
  if (b.points !== a.points) {
    return b.points - a.points;
  }
  if (b.elims !== a.elims) {
    return b.elims - a.elims;
  }
  // A team that hasn't played yet always sorts below a team that has.
  if (a.games === 0 || b.games === 0) {
    return b.games - a.games;
  }
  return a.avgPlace - b.avgPlace;
}

// Every team's stats, ranked. map() builds a new array, so sorting it is safe.
export function standings(teams, matches, rules) {
  return teams
    .map(function (team) {
      return teamStats(team, matches, rules);
    })
    .sort(compareStandings);
}

// Stats for one player on one team. player is { id, name }, team is { id, name }.
// A player's points = their team's placement points + their OWN elim points.
export function playerStats(player, team, matches, rules) {
  let games = 0;
  let elims = 0;
  let deaths = 0;
  let points = 0;

  matches.forEach(function (match) {
    if (match.teamId !== team.id) {
      return;
    }

    const line = match.players.find(function (result) {
      return result.playerId === player.id;
    });

    if (line === undefined) {
      return;
    }

    games = games + 1;
    elims = elims + line.elims;
    deaths = deaths + line.deaths;
    points = points + placementPoints(match.placement, rules) + line.elims * rules.pointsPerElim;
  });

  return {
    playerId: player.id,
    name: player.name,
    team: team.name,
    games: games,
    elims: elims,
    deaths: deaths,
    kd: killDeath(elims, deaths),
    points: points,
    avgElims: average(elims, games),
    avgPoints: average(points, games)
  };
}

// Stats for every rostered player, best first.
export function allPlayerStats(teams, matches, rules) {
  const rows = [];

  teams.forEach(function (team) {
    team.players.forEach(function (player) {
      rows.push(playerStats(player, team, matches, rules));
    });
  });

  return rows.sort(function (a, b) {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return b.elims - a.elims;
  });
}

// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th", 22 -> "22nd"
export function ordinal(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return n + "th";
  }

  const last = n % 10;
  if (last === 1) {
    return n + "st";
  }
  if (last === 2) {
    return n + "nd";
  }
  if (last === 3) {
    return n + "rd";
  }
  return n + "th";
}
