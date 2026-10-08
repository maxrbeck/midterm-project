// Deletes the database file so the next start builds a fresh one
// (schema.sql + seed.sql, no results, staff account from .env or the default).
// Usage:  npm run db:reset      (stop the server first)

import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const dbFile = process.env.DB_FILE || path.join(import.meta.dirname, "..", "league.db");

// SQLite can leave two helper files next to the database.
[dbFile, dbFile + "-wal", dbFile + "-shm"].forEach(function (file) {
  if (existsSync(file)) {
    rmSync(file);
    console.log("Deleted " + path.basename(file));
  }
});

console.log("Database reset. Run npm start to build a fresh one.");
