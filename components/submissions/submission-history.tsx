"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { VerdictBadge } from "@/components/execution/verdict-badge";
import { fadeIn } from "@/lib/motion/tokens";
import { getSubmissionDetailAction, getSubmissionHistoryAction } from "@/lib/execution/actions";
import type { SubmissionHistoryItem } from "@/services/execution/get-submission-history";
import type { SubmissionDetail } from "@/services/execution/get-submission-detail";
import type { Verdict } from "@/lib/judge/verdicts";

const STATUS_TO_VERDICT: Record<string, Verdict> = {
  accepted: "accepted",
  wrong_answer: "wrong_answer",
  compile_error: "compile_error",
  runtime_error: "runtime_error",
  time_limit_exceeded: "time_limit_exceeded",
  memory_limit_exceeded: "memory_limit_exceeded",
  output_limit_exceeded: "output_limit_exceeded",
  system_error: "system_error",
  cancelled: "cancelled",
  passed: "accepted",
  failed: "wrong_answer",
  queued: "queued",
  running: "running",
};

export function SubmissionHistory({ problemId, refreshKey }: { problemId: string; refreshKey: number }) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SubmissionHistoryItem[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale data for the new page/problem before the fetch resolves
    setItems(null);
    getSubmissionHistoryAction(problemId, page)
      .then((result) => {
        if (cancelled) return;
        setItems(result.submissions);
        setTotalCount(result.totalCount);
      })
      .catch(() => {
        // Not signed in, or a transient failure — show an empty state
        // rather than crashing the problem page over a history sidebar.
        if (!cancelled) {
          setItems([]);
          setTotalCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [problemId, page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(totalCount / 10));

  return (
    <motion.div {...fadeIn} className="flex flex-col gap-3">
      {items === null ? (
        <>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions yet — press Submit to make your first attempt.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Language</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2 font-medium">Tests</th>
                <th className="px-3 py-2 font-medium">Runtime</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
                  onClick={() => setSelectedId(item.id)}
                >
                  <td className="px-3 py-2">{item.languageName}</td>
                  <td className="px-3 py-2">
                    <VerdictBadge verdict={STATUS_TO_VERDICT[item.status] ?? "system_error"} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.passedTestCount}/{item.totalTestCount}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.runtimeMs != null ? `${item.runtimeMs} ms` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
            <ChevronRight />
          </Button>
        </div>
      )}

      <SubmissionDetailDialog submissionId={selectedId} onClose={() => setSelectedId(null)} />
    </motion.div>
  );
}

function SubmissionDetailDialog({ submissionId, onClose }: { submissionId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);

  useEffect(() => {
    if (!submissionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog closed: clear the previous submission's detail
      setDetail(null);
      return;
    }
    let cancelled = false;
    getSubmissionDetailAction(submissionId)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  return (
    <Dialog open={submissionId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submission detail</DialogTitle>
        </DialogHeader>
        {!detail ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <VerdictBadge verdict={STATUS_TO_VERDICT[detail.status] ?? "system_error"} />
              <span className="text-sm text-muted-foreground">{detail.languageName}</span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>
                Tests: {detail.passedTestCount}/{detail.totalTestCount}
              </span>
              <span>Runtime: {detail.runtimeMs != null ? `${detail.runtimeMs} ms` : "Not available"}</span>
              <span>Memory: {detail.memoryKb != null ? `${detail.memoryKb} KB` : "Memory measurement unavailable"}</span>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Source code</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-code-surface p-3 font-mono text-xs whitespace-pre-wrap">
                {detail.sourceCode}
              </pre>
            </div>
            {detail.visibleResults.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Visible test results</p>
                <div className="flex flex-col gap-2">
                  {detail.visibleResults.map((r) => (
                    <div
                      key={r.testCaseId}
                      className={`rounded border p-2 text-xs ${r.passed ? "border-brand/30" : "border-destructive/30"}`}
                    >
                      {r.passed ? "Passed" : "Failed"} — expected {r.expectedOutput.slice(0, 60)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.hiddenSummary.total > 0 && (
              <p className="text-xs text-muted-foreground">
                Hidden tests: {detail.hiddenSummary.passed}/{detail.hiddenSummary.total} passed
              </p>
            )}
            {detail.executionId && (
              <p className="text-xs text-muted-foreground">Execution ID: {detail.executionId}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
