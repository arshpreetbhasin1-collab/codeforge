export interface WeightedTestResult {
  passed: boolean;
  weight: number;
}

export interface ScoreSummary {
  passedCount: number;
  totalCount: number;
  /** 0-100, weighted by problem_test_cases.weight. */
  scorePercent: number;
}

export function scoreSubmission(results: WeightedTestResult[]): ScoreSummary {
  if (results.length === 0) {
    return { passedCount: 0, totalCount: 0, scorePercent: 0 };
  }

  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const passedWeight = results.filter((r) => r.passed).reduce((sum, r) => sum + r.weight, 0);
  const passedCount = results.filter((r) => r.passed).length;

  return {
    passedCount,
    totalCount: results.length,
    scorePercent: totalWeight === 0 ? 0 : Math.round((passedWeight / totalWeight) * 100),
  };
}
