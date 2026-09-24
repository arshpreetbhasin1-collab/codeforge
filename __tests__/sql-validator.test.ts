import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "@/lib/security/sql-validator";

describe("validateReadOnlySql", () => {
  it("accepts a plain SELECT", () => {
    expect(validateReadOnlySql("SELECT name, salary FROM employees WHERE salary > 50000").valid).toBe(true);
  });

  it("accepts a WITH ... SELECT (CTE)", () => {
    expect(validateReadOnlySql("WITH top AS (SELECT * FROM employees) SELECT * FROM top").valid).toBe(true);
  });

  it("accepts joins, aggregation, and subqueries", () => {
    const sql = `
      SELECT d.name, COUNT(*), AVG(e.salary)
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.salary > (SELECT AVG(salary) FROM employees)
      GROUP BY d.name
      HAVING COUNT(*) > 2
      ORDER BY d.name
    `;
    expect(validateReadOnlySql(sql).valid).toBe(true);
  });

  it("rejects DROP TABLE", () => {
    const result = validateReadOnlySql("DROP TABLE employees");
    expect(result.valid).toBe(false);
  });

  it("rejects a SELECT hiding a second statement after a semicolon", () => {
    const result = validateReadOnlySql("SELECT 1; DROP TABLE employees;");
    expect(result.valid).toBe(false);
  });

  it("rejects a DROP hidden after a SELECT and a comment", () => {
    const result = validateReadOnlySql("SELECT 1 -- ok\n; DROP TABLE employees");
    expect(result.valid).toBe(false);
  });

  it("does not false-positive on a denylisted word appearing inside an identifier", () => {
    // "offset" contains "set", "created_at" is fine, "insert_date" contains "insert"
    // as a column name, not the keyword — none of these should trip the denylist.
    const result = validateReadOnlySql(
      "SELECT created_at, insert_date FROM events ORDER BY created_at OFFSET 10",
    );
    expect(result.valid).toBe(true);
  });

  it("rejects INSERT/UPDATE/DELETE", () => {
    expect(validateReadOnlySql("INSERT INTO employees (name) VALUES ('x')").valid).toBe(false);
    expect(validateReadOnlySql("UPDATE employees SET salary = 0").valid).toBe(false);
    expect(validateReadOnlySql("DELETE FROM employees").valid).toBe(false);
  });

  it("rejects SELECT ... INTO (creates a table)", () => {
    expect(validateReadOnlySql("SELECT * INTO new_table FROM employees").valid).toBe(false);
  });

  it("rejects dangerous functions like pg_sleep and pg_read_file", () => {
    expect(validateReadOnlySql("SELECT pg_sleep(10)").valid).toBe(false);
    expect(validateReadOnlySql("SELECT pg_read_file('/etc/passwd')").valid).toBe(false);
  });

  it("rejects GRANT/REVOKE/CREATE EXTENSION", () => {
    expect(validateReadOnlySql("GRANT ALL ON employees TO public").valid).toBe(false);
    expect(validateReadOnlySql("CREATE EXTENSION dblink").valid).toBe(false);
  });

  it("rejects an empty query", () => {
    expect(validateReadOnlySql("   ").valid).toBe(false);
  });

  it("rejects a statement that isn't SELECT/WITH even if it contains no denylisted keyword", () => {
    expect(validateReadOnlySql("EXPLAIN SELECT * FROM employees").valid).toBe(false);
  });

  it("string literals containing keywords do not trigger false positives", () => {
    const result = validateReadOnlySql("SELECT * FROM employees WHERE name = 'drop the beat'");
    expect(result.valid).toBe(true);
  });
});
