// Adds a staff account, or changes its password if it already exists.
// Usage:  npm run create-admin -- coach@school.edu "a long password"

import { saveAdmin } from "./database.js";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log("Usage: npm run create-admin -- <email> <password>");
  process.exit(1);
}

try {
  saveAdmin(email, password);
  console.log("Saved staff account " + email.toLowerCase());
} catch (error) {
  console.log(error.message);
  process.exit(1);
}
