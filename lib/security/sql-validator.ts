/**
 * Server-side validation for learner-submitted SQL — see SQL SECURITY.
 * This is the PRIMARY defense (never rely on frontend filtering); the
 * transaction-scoped, always-rolled-back sandbox in
 * services/execution/sql-sandbox.ts is defense-in-depth on top of it, not
 * a substitute for it.
 *
 * Strategy, deliberately simple rather than a full SQL parser:
 *   1. Strip string literals and comments (so keyword/statement checks
 *      can't be fooled by text inside them, and can't be tricked by a
 *      keyword hidden inside a string either way).
 *   2. Require exactly one statement (at most one trailing `;`).
 *   3. Require the statement to start with SELECT or WITH.
 *   4. Reject a denylist of keywords/functions with no legitimate use in
 *      a read-only SELECT.
 */

const DENYLISTED_KEYWORDS = [
  "drop",
  "alter",
  "truncate",
  "grant",
  "revoke",
  "create",
  "copy",
  "load",
  "insert",
  "update",
  "delete",
  "merge",
  "call",
  "do",
  "vacuum",
  "reindex",
  "cluster",
  "listen",
  "notify",
  "unlisten",
  "set",
  "reset",
  "execute",
  "prepare",
  "deallocate",
  "lock",
  "begin",
  "commit",
  "rollback",
  "savepoint",
  "into", // blocks SELECT ... INTO (creates a table)
  "pg_sleep",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "dblink",
  "lo_import",
  "lo_export",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "current_setting",
  "set_config",
];

export interface SqlValidationResult {
  valid: boolean;
  reason: string | null;
}

export function validateReadOnlySql(rawSql: string): SqlValidationResult {
  const trimmed = rawSql.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: "Query is empty." };
  }
  if (trimmed.length > 5000) {
    return { valid: false, reason: "Query is too long." };
  }

  const stripped = stripStringsAndComments(trimmed);

  const statements = splitStatements(stripped);
  if (statements.length !== 1) {
    return { valid: false, reason: "Only a single SQL statement is allowed." };
  }

  const firstKeyword = stripped.trimStart().split(/\s+/)[0]?.toLowerCase();
  if (firstKeyword !== "select" && firstKeyword !== "with") {
    return { valid: false, reason: "Only SELECT (or WITH ... SELECT) queries are allowed." };
  }

  const lower = stripped.toLowerCase();
  for (const keyword of DENYLISTED_KEYWORDS) {
    if (new RegExp(`(^|[^a-z0-9_])${keyword}([^a-z0-9_]|$)`, "i").test(lower)) {
      return { valid: false, reason: `The keyword "${keyword}" is not allowed in this sandbox.` };
    }
  }

  return { valid: true, reason: null };
}

/** Replaces string-literal and comment content with spaces, preserving length/positions for simplicity. */
function stripStringsAndComments(sql: string): string {
  let result = "";
  let i = 0;
  while (i < sql.length) {
    const twoChar = sql.slice(i, i + 2);

    if (twoChar === "--") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      result += " ".repeat(stop - i);
      i = stop;
      continue;
    }

    if (twoChar === "/*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      result += " ".repeat(stop - i);
      i = stop;
      continue;
    }

    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      result += " ".repeat(j - i);
      i = j;
      continue;
    }

    if (sql[i] === '"') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== '"') j += 1;
      j = Math.min(j + 1, sql.length);
      result += " ".repeat(j - i);
      i = j;
      continue;
    }

    result += sql[i];
    i += 1;
  }
  return result;
}

function splitStatements(strippedSql: string): string[] {
  return strippedSql
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
