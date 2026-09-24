import { CheckCircle2, XCircle } from "lucide-react";
import { VerdictBadge } from "./verdict-badge";
import { isPreTestFailure, type Verdict } from "@/lib/judge/verdicts";
import { cn } from "@/lib/utils";

export interface VisibleTestDisplay {
  testCaseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
}

export interface ResultDisplayData {
  kind: "run" | "submit";
  verdict: Verdict;
  compileOutput: string | null;
  visibleTests: VisibleTestDisplay[];
  hiddenSummary?: { passed: number; total: number };
  passedCount: number;
  totalCount: number;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  truncated?: boolean;
  executionId: string;
  isSql?: boolean;
}

export function TestResultsPanel({ result }: { result: ResultDisplayData }) {
  if (isPreTestFailure(result.verdict)) {
    return <PreTestFailurePanel result={result} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <VerdictBadge verdict={result.verdict} />
        <span className="text-sm text-muted-foreground">
          {result.passedCount} / {result.totalCount} test{result.totalCount === 1 ? "" : "s"} passed
        </span>
      </div>

      {result.kind === "submit" && result.hiddenSummary && result.hiddenSummary.total > 0 && (
        <p className="text-sm text-muted-foreground">
          Hidden tests: {result.hiddenSummary.passed} / {result.hiddenSummary.total} passed
        </p>
      )}

      {(result.runtimeMs !== undefined || result.memoryKb !== undefined) && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Runtime: {result.runtimeMs != null ? `${result.runtimeMs} ms` : "Not available"}</span>
          <span>Memory: {result.memoryKb != null ? `${result.memoryKb} KB` : "Memory measurement unavailable"}</span>
        </div>
      )}

      {result.truncated && (
        <p className="text-xs text-amber-600 dark:text-amber-500">Output was truncated (output limit exceeded).</p>
      )}

      <div className="flex flex-col gap-2">
        {result.visibleTests.map((test, i) => (
          <TestCard key={test.testCaseId} test={test} index={i} isSql={result.isSql} />
        ))}
      </div>

      {result.verdict === "wrong_answer" && (
        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">What to inspect</p>
          <ul className="list-inside list-disc">
            <li>Edge cases (empty input, boundary values)</li>
            <li>Loop boundaries and off-by-one errors</li>
            <li>Whether your output format exactly matches what&apos;s expected</li>
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Execution ID: {result.executionId}</p>
    </div>
  );
}

function TestCard({ test, index, isSql }: { test: VisibleTestDisplay; index: number; isSql?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3 text-sm", test.passed ? "border-brand/30" : "border-destructive/30")}>
      <div className="mb-2 flex items-center gap-2 font-medium">
        {test.passed ? (
          <CheckCircle2 className="size-4 text-brand" aria-hidden="true" />
        ) : (
          <XCircle className="size-4 text-destructive" aria-hidden="true" />
        )}
        Test {index + 1}
        <span className="sr-only">{test.passed ? "passed" : "failed"}</span>
      </div>
      {isSql ? (
        <SqlResultComparison test={test} />
      ) : (
        <div className="grid gap-2 font-mono text-xs sm:grid-cols-3">
          {test.input && (
            <div>
              <p className="mb-1 font-sans text-muted-foreground">Input</p>
              <pre className="overflow-x-auto rounded bg-code-surface p-2 whitespace-pre-wrap">{test.input}</pre>
            </div>
          )}
          <div>
            <p className="mb-1 font-sans text-muted-foreground">Expected</p>
            <pre className="overflow-x-auto rounded bg-code-surface p-2 whitespace-pre-wrap">{test.expectedOutput}</pre>
          </div>
          <div>
            <p className="mb-1 font-sans text-muted-foreground">Your output</p>
            <pre className="overflow-x-auto rounded bg-code-surface p-2 whitespace-pre-wrap">
              {test.actualOutput || "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SqlResultComparison({ test }: { test: VisibleTestDisplay }) {
  const expected = tryParseRows(test.expectedOutput);
  const actual = tryParseRows(test.actualOutput);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Expected shape</p>
        <RowsTable rows={expected} />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Your result</p>
        <RowsTable rows={actual} />
      </div>
    </div>
  );
}

function tryParseRows(text: string): unknown[][] | null {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function RowsTable({ rows }: { rows: unknown[][] | null }) {
  if (!rows) return <p className="text-xs text-muted-foreground">(empty)</p>;
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-xs">
        <tbody>
          {rows.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 font-mono whitespace-nowrap">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <p className="border-t px-2 py-1 text-xs text-muted-foreground">+{rows.length - 10} more rows</p>
      )}
      {rows.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No rows</p>}
    </div>
  );
}

function PreTestFailurePanel({ result }: { result: ResultDisplayData }) {
  const explanation: Partial<Record<Verdict, string>> = {
    time_limit_exceeded: "Your program did not finish within the allowed execution time.",
    memory_limit_exceeded: "Your program used more memory than allowed.",
    output_limit_exceeded: "Your program printed more output than allowed.",
    system_error: "Execution service temporarily unavailable.",
  };

  return (
    <div className="flex flex-col gap-3">
      <VerdictBadge verdict={result.verdict} />
      {explanation[result.verdict] && <p className="text-sm text-muted-foreground">{explanation[result.verdict]}</p>}
      {result.compileOutput && (
        <pre className="overflow-x-auto rounded-lg bg-code-surface p-3 font-mono text-xs whitespace-pre-wrap">
          {result.compileOutput}
        </pre>
      )}
      <p className="text-xs text-muted-foreground">Execution ID: {result.executionId} — try again.</p>
    </div>
  );
}
