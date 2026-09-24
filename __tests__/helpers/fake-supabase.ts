/**
 * Minimal in-memory stand-in for the subset of the Supabase JS query
 * builder that services/learning/*.ts actually calls: .from().select()
 * .eq()...maybeSingle()/.single(), .insert(), .update()...eq(). Not a
 * general-purpose mock — just enough surface to unit test the branching
 * logic in the progress/learning-event services without a live database.
 */
export function createFakeSupabase() {
  const tables = new Map<string, Record<string, unknown>[]>();

  function table(name: string): Record<string, unknown>[] {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  }

  function from(name: string) {
    let filters: [string, unknown][] = [];
    let pendingUpdate: Record<string, unknown> | null = null;
    let pendingInsert: Record<string, unknown>[] | null = null;

    const builder = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters = [...filters, [col, val]];
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters = [...filters, [col, vals]];
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      async maybeSingle() {
        const rows = matchRows(table(name), filters);
        return { data: rows[0] ?? null, error: null };
      },
      async single() {
        const rows = matchRows(table(name), filters);
        if (rows.length === 0) return { data: null, error: { message: "not found" } };
        return { data: rows[0], error: null };
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        pendingInsert = (Array.isArray(payload) ? payload : [payload]).map((row) => ({
          id: crypto.randomUUID(),
          ...row,
        }));
        return builder;
      },
      update(patch: Record<string, unknown>) {
        pendingUpdate = patch;
        return builder;
      },
      // Terminal — supports both `await supabase.from(x).insert(y)` and
      // `await supabase.from(x).update(y).eq(...)` without a separate
      // terminal method call, matching how the real client resolves a
      // query builder directly.
      then(resolve: (v: { data: unknown; error: null }) => void) {
        if (pendingInsert) {
          table(name).push(...pendingInsert);
          resolve({ data: pendingInsert, error: null });
          return;
        }
        if (pendingUpdate) {
          const rows = matchRows(table(name), filters);
          for (const row of rows) Object.assign(row, pendingUpdate);
          resolve({ data: rows, error: null });
          return;
        }
        resolve({ data: matchRows(table(name), filters), error: null });
      },
    };

    return builder;
  }

  return { from, _tables: tables };
}

function matchRows(rows: Record<string, unknown>[], filters: [string, unknown][]) {
  return rows.filter((row) =>
    filters.every(([col, val]) => (Array.isArray(val) ? val.includes(row[col]) : row[col] === val)),
  );
}
