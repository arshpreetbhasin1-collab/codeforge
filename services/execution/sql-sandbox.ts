import "server-only";
import { Client } from "pg";
import { validateReadOnlySql } from "@/lib/security/sql-validator";
import { truncateOutput } from "@/lib/execution/normalize";
import type { ExecutionResult, ResourceLimits } from "@/lib/execution/types";

/**
 * Isolated SQL execution — see SQL and SQL SECURITY. Never runs against
 * Supabase or the application's real database: it connects to a
 * dedicated `SQL_SANDBOX_DATABASE_URL`, and every statement — the
 * problem's own schema/seed DDL included — runs inside a single
 * transaction that is ALWAYS rolled back, so nothing persists between
 * executions and nothing the learner's query does (even if validation
 * somehow missed it) can survive past this function returning.
 *
 * Defense in depth, in order:
 *   1. validateReadOnlySql rejects anything but a single SELECT/WITH
 *      statement before a connection is even opened.
 *   2. A uniquely-named throwaway schema, dropped implicitly by the
 *      rollback (never explicitly DROPped — the rollback IS the cleanup).
 *   3. `SET LOCAL statement_timeout` enforces the time limit inside
 *      Postgres itself, not just from the Node side.
 *   4. The whole thing is one transaction that never commits.
 */
export async function executeSql(
  learnerSql: string,
  dataset: { schemaSql: string; seedSql: string },
  limits: ResourceLimits,
): Promise<ExecutionResult> {
  const validation = validateReadOnlySql(learnerSql);
  if (!validation.valid) {
    return {
      errorCategory: "compile_error",
      stdout: "",
      stderr: "",
      compileOutput: validation.reason,
      executionTimeMs: 0,
      memoryUsedKb: null,
      exitCode: null,
      truncated: false,
    };
  }

  const connectionString = process.env.SQL_SANDBOX_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "SQL sandbox is not configured — set SQL_SANDBOX_DATABASE_URL to a dedicated, isolated " +
        "Postgres instance (never the app's Supabase database). See .env.local.example.",
    );
  }

  const schemaName = `exec_${crypto.randomUUID().replace(/-/g, "")}`;
  const client = new Client({ connectionString, statement_timeout: limits.timeLimitMs });
  const startedAt = Date.now();

  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${Number(limits.timeLimitMs)}`);
    await client.query(`CREATE SCHEMA ${schemaName}`);
    await client.query(`SET LOCAL search_path TO ${schemaName}`);
    await client.query(dataset.schemaSql);
    await client.query(dataset.seedSql);

    const result = await client.query(learnerSql);

    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) => columns.map((col) => row[col]));
    const canonical = JSON.stringify(rows);
    const { text: stdout, truncated } = truncateOutput(canonical, limits.outputLimitBytes);

    return {
      errorCategory: null,
      stdout,
      stderr: "",
      compileOutput: null,
      executionTimeMs: Date.now() - startedAt,
      memoryUsedKb: null,
      exitCode: 0,
      truncated,
      sqlRows: rows,
      sqlColumns: columns,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = /statement timeout|canceling statement/i.test(message);
    return {
      errorCategory: isTimeout ? "time_limit_exceeded" : "runtime_error",
      stdout: "",
      stderr: isTimeout ? "" : sanitizePostgresError(message),
      compileOutput: null,
      executionTimeMs: Date.now() - startedAt,
      memoryUsedKb: null,
      exitCode: null,
      truncated: false,
    };
  } finally {
    try {
      // Always rolls back — the throwaway schema and any DDL/DML the
      // learner's query might have snuck past validation vanish with it.
      await client.query("ROLLBACK");
    } catch {
      // Connection may already be broken (e.g. after a timeout) — nothing
      // more to do; the connection close below is what actually matters.
    }
    await client.end().catch(() => {});
  }
}

function sanitizePostgresError(message: string): string {
  // Postgres error messages are already free of filesystem paths for
  // ordinary query errors — this exists as a single choke point in case
  // that assumption ever needs revisiting (see RUNTIME ERROR: never
  // expose container/host details).
  return message.replace(/\/[^\s]+\.(c|py|so)\b/g, "[internal]");
}
