/**
 * Hand-written domain types mirroring db/schema/*.sql.
 *
 * The app should code against these, not against `Database["public"]["Tables"]`
 * directly — once real Supabase-generated types exist (see types/database.ts),
 * these can be derived from them without changing call sites.
 */

export type UUID = string;
export type ISODateString = string;

export type UserRole = "student" | "mentor" | "admin";

export type ExperienceLevel = "complete_beginner" | "beginner" | "intermediate" | "advanced";

export type LearningGoal =
  | "learn_programming"
  | "master_dsa"
  | "interview_prep"
  | "improve_problem_solving"
  | "build_projects";

export interface Profile {
  id: UUID;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  bio: string | null;
  preferredLanguageId: UUID | null;
  timezone: string;
  onboardingCompletedAt: ISODateString | null;
  /** Onboarding preferences only — never used to seed mastery. See lib/mastery. */
  experienceLevel: ExperienceLevel | null;
  learningGoal: LearningGoal | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------
// Language registry
// ---------------------------------------------------------------------

export type ExecutionProvider = "sandboxed_container" | "external_api" | "wandbox" | "sql_sandbox";

export interface Language {
  id: UUID;
  slug: string;
  displayName: string;
  version: string;
  fileExtension: string;
  syntaxHighlighter: string;
  executionProvider: ExecutionProvider;
  compileCommand: string | null;
  runCommand: string;
  timeoutMs: number;
  memoryLimitMb: number;
  enabled: boolean;
  sortOrder: number;
  /** Opaque id passed to the execution provider (e.g. "cpython-3.12.7"). Null when execution isn't wired up. */
  providerLanguageId: string | null;
  /** Whether this language actually runs code this phase — see lib/execution/registry.ts. */
  executionEnabled: boolean;
}

// ---------------------------------------------------------------------
// Skill graph
// ---------------------------------------------------------------------

export type SkillCategory =
  | "foundations"
  | "control_flow"
  | "functions"
  | "data_structures"
  | "algorithms"
  | "complexity"
  | "debugging"
  | "system_design"
  | "databases"
  | "web"
  | "testing";

export interface Skill {
  id: UUID;
  slug: string;
  name: string;
  description: string;
  category: SkillCategory;
  languageId: UUID | null;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface SkillDependency {
  id: UUID;
  skillId: UUID;
  prerequisiteSkillId: UUID;
}

// ---------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------

export interface Curriculum {
  id: UUID;
  slug: string;
  title: string;
  description: string;
  languageId: UUID;
  isPublished: boolean;
  sortOrder: number;
}

export interface Module {
  id: UUID;
  curriculumId: UUID;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  learningObjectives: string[];
  estimatedMinutes: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface Concept {
  id: UUID;
  slug: string;
  name: string;
  skillId: UUID | null;
}

/** One-page lesson: WHY / WHAT / HOW / EXAMPLE / COMMON MISTAKE / MICRO CHALLENGE. */
export interface Lesson {
  id: UUID;
  moduleId: UUID;
  conceptId: UUID | null;
  slug: string;
  title: string;
  why: string;
  what: string;
  how: string;
  exampleCode: string;
  exampleLanguageId: UUID | null;
  commonMistake: string;
  microChallengePrompt: string;
  sortOrder: number;
  isPublished: boolean;
  learningObjectives: string[];
  keyTakeaways: string[];
  estimatedMinutes: number;
  /** The problem this lesson leads into — see LESSON DESIGN §9 CODE CHALLENGE. */
  nextProblemId: UUID | null;
}

/** Concept stays fixed across languages; only the syntax shown changes. */
export interface LessonCodeExample {
  id: UUID;
  lessonId: UUID;
  languageId: UUID;
  code: string;
  explanation: string | null;
  sortOrder: number;
}

export type MicroCheckType = "multiple_choice" | "predict_output" | "conceptual";

export interface MicroCheckOption {
  id: string;
  label: string;
}

export interface MicroCheck {
  id: UUID;
  lessonId: UUID;
  type: MicroCheckType;
  question: string;
  codeSnippet: string | null;
  options: MicroCheckOption[] | null;
  correctAnswer: string;
  explanation: string;
  sortOrder: number;
}

export interface UserMicroCheckAttempt {
  id: UUID;
  userId: UUID;
  microCheckId: UUID;
  selectedAnswer: string;
  isCorrect: boolean;
  attemptedAt: ISODateString;
}

// ---------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------

export type ProblemDifficulty = "intro" | "easy" | "medium" | "hard" | "boss";
export type ProblemSkillRelationship = "teaches" | "prerequisite";

export type ProblemKind =
  | "implementation"
  | "debugging"
  | "output_prediction"
  | "algorithm_selection"
  | "complexity_analysis"
  | "code_completion"
  | "refactoring"
  | "edge_case_reasoning";

export interface Problem {
  id: UUID;
  slug: string;
  title: string;
  statement: string;
  difficulty: ProblemDifficulty;
  problemType: ProblemKind;
  /** 1 (recognition) .. 5 (transfer) — see PROBLEM PROGRESSION. */
  progressionLevel: 1 | 2 | 3 | 4 | 5;
  learningObjective: string;
  constraints: string | null;
  solutionApproach: string | null;
  expectedTimeComplexity: string | null;
  expectedSpaceComplexity: string | null;
  isBossChallenge: boolean;
  isPublished: boolean;
  timeLimitMs: number;
  memoryLimitMb: number;
  /** Has real starter code + a verified stdin/stdout (or SQL dataset) contract — see PROBLEM VALIDATION. */
  isExecutable: boolean;
}

/** The isolated dataset a SQL problem's queries run against — see SQL PROBLEM DESIGN. */
export interface SqlProblemDataset {
  problemId: UUID;
  schemaSql: string;
  seedSql: string;
}

export interface ProblemStarterCode {
  id: UUID;
  problemId: UUID;
  languageId: UUID;
  starterCode: string;
}

export interface ProblemSkillLink {
  problemId: UUID;
  skillId: UUID;
  relationship: ProblemSkillRelationship;
}

export interface ProblemCommonMistake {
  id: UUID;
  problemId: UUID;
  description: string;
  detectionHint: string | null;
  mistakeKey: string | null;
}

/** Normalized, extensible mistake taxonomy — see COMMON MISTAKE SYSTEM. */
export interface MistakeTaxonomyEntry {
  key: string;
  skillId: UUID | null;
  title: string;
  description: string;
}

export type ComparisonMode =
  | "exact"
  | "trim"
  | "normalize_whitespace"
  | "numeric_tolerance"
  | "unordered_lines"
  | "unordered_rows";

export interface ProblemTestCase {
  id: UUID;
  problemId: UUID;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  isEdgeCase: boolean;
  explanation: string | null;
  sortOrder: number;
  weight: number;
  comparisonMode: ComparisonMode;
  numericTolerance: number | null;
  /** Null = use the parent problem's limit. */
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
}

/** Graded hint ladder — see AI SAFETY / EDUCATIONAL PRINCIPLE. */
export interface Hint {
  id: UUID;
  problemId: UUID;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
}

// ---------------------------------------------------------------------
// Execution & submissions
// ---------------------------------------------------------------------

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "error"
  | "timeout"
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "output_limit_exceeded"
  | "system_error";

export interface TestCaseRunResult {
  testCaseId: UUID;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  runtimeMs: number | null;
}

export interface CodeRun {
  id: UUID;
  userId: UUID;
  problemId: UUID | null;
  languageId: UUID;
  sourceCode: string;
  stdin: string | null;
  status: RunStatus;
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  durationMs: number | null;
  /** Visible-test results only — see SUBMIT VS RUN. */
  testResults: TestCaseRunResult[];
  executionId: string | null;
}

export type SubmissionStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "error"
  | "timeout"
  | "accepted"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "output_limit_exceeded"
  | "system_error"
  | "cancelled";

export interface Submission {
  id: UUID;
  userId: UUID;
  problemId: UUID;
  languageId: UUID;
  sourceCode: string;
  status: SubmissionStatus;
  passedTestCount: number;
  totalTestCount: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  hintsUsedCount: number;
  executionId: string | null;
  createdAt: ISODateString;
}

export interface SubmissionResult {
  id: UUID;
  submissionId: UUID;
  testCaseId: UUID;
  passed: boolean;
  actualOutput: string | null;
  runtimeMs: number | null;
  errorMessage: string | null;
  memoryKb: number | null;
  errorType: string | null;
}

// ---------------------------------------------------------------------
// Learning events, progress & mastery
// ---------------------------------------------------------------------

export type LearningEventType =
  | "lesson_viewed"
  | "lesson_started"
  | "lesson_completed"
  | "micro_check_started"
  | "micro_check_completed"
  | "challenge_started"
  | "problem_started"
  | "problem_attempted"
  | "problem_completed"
  | "submission_created"
  | "submission_passed"
  | "submission_failed"
  | "hint_requested"
  | "solution_viewed"
  | "concept_reviewed"
  | "problem_abandoned"
  | "boss_started"
  | "boss_completed"
  | "project_started"
  | "project_completed"
  | "project_stage_started"
  | "project_stage_completed"
  | "project_test_run"
  | "project_submitted"
  | "project_passed"
  | "project_failed"
  | "project_reviewed"
  | "interview_started"
  | "interview_completed"
  | "compilation_mistake"
  | "runtime_mistake"
  | "efficiency_mistake"
  | "logic_mistake"
  | "skill_mastery_updated";

// ---------------------------------------------------------------------
// Lesson & problem progress (simple completion state — NOT the mastery
// engine; see services/mastery for that).
// ---------------------------------------------------------------------

export type LessonProgressStatus = "in_progress" | "completed";

export interface UserLessonProgress {
  userId: UUID;
  lessonId: UUID;
  status: LessonProgressStatus;
  startedAt: ISODateString;
  completedAt: ISODateString | null;
}

export type ProblemProgressStatus = "attempted" | "completed";

export interface UserProblemProgress {
  userId: UUID;
  problemId: UUID;
  status: ProblemProgressStatus;
  attemptsCount: number;
  firstAttemptedAt: ISODateString;
  completedAt: ISODateString | null;
  /** Last language attempted — not the mastery engine, just a UI convenience. */
  languageId: UUID | null;
  bestPassedTestCount: number;
  bestTotalTestCount: number;
}

export interface UserDailyActivity {
  userId: UUID;
  activityDate: string; // YYYY-MM-DD
  eventCount: number;
}

export interface LearningEvent {
  id: UUID;
  userId: UUID;
  eventType: LearningEventType;
  skillId: UUID | null;
  problemId: UUID | null;
  lessonId: UUID | null;
  submissionId: UUID | null;
  projectId: UUID | null;
  projectSubmissionId: UUID | null;
  metadata: Record<string, unknown>;
  createdAt: ISODateString;
}

export interface UserSkillProgress {
  userId: UUID;
  skillId: UUID;
  attemptCount: number;
  successCount: number;
  lastAttemptedAt: ISODateString | null;
}

/** 0-24 NOT_STARTED / 25-44 EXPLORING / 45-64 DEVELOPING / 65-79 COMPETENT / 80-94 STRONG / 95-100 MASTERED. See lib/mastery/weights.ts. */
export type MasteryLevel = "not_started" | "exploring" | "developing" | "competent" | "strong" | "mastered";

/** Output of lib/mastery/mastery.ts, cached per (user, skill). */
export interface SkillMastery {
  userId: UUID;
  skillId: UUID;
  masteryScore: number; // 0-100, "guided" — hint-assisted successes count, discounted
  confidence: number; // 0-100 — how much evidence this score is based on, not a second mastery score
  successRate: number; // 0-100
  attemptCount: number;
  /** Same evidence restricted to hint-free attempts — null when there isn't enough of it to report. See INDEPENDENCE SCORE. */
  independentScore: number | null;
  lastReviewedAt: ISODateString | null;
  nextReviewDueAt: ISODateString | null;
}

export type MistakeCategory =
  | "compilation_error"
  | "syntax_error"
  | "type_error"
  | "runtime_error"
  | "time_limit"
  | "output_limit"
  | "wrong_answer"
  | "edge_case_failure"
  | "logic_error"
  | "off_by_one"
  | "boundary_error"
  | "input_handling"
  | "output_format"
  | "data_structure_misuse"
  | "algorithm_selection"
  | "time_complexity"
  | "space_complexity"
  | "sql_query_error"
  | "sql_schema_error"
  | "unknown"
  | "architecture_error"
  | "testing_gap";

export type MistakeConfidence = "low" | "medium" | "high";

/**
 * One classified mistake on one submission — immutable, never updated.
 * See MISTAKE DNA. Exactly one of (submissionId, projectSubmissionId) is
 * set — see db/schema/020_project_engine.sql's exactly-one-source check.
 */
export interface MistakeEvent {
  id: UUID;
  userId: UUID;
  submissionId: UUID | null;
  problemId: UUID | null;
  projectSubmissionId: UUID | null;
  projectId: UUID | null;
  category: MistakeCategory;
  confidence: MistakeConfidence;
  evidence: string | null;
  detectedAt: ISODateString;
}

export interface MistakePattern {
  id: UUID;
  userId: UUID;
  skillId: UUID | null;
  patternKey: string;
  description: string;
  occurrenceCount: number;
  firstSeenAt: ISODateString;
  lastSeenAt: ISODateString;
}

export type ReviewOutcome = "pending" | "passed" | "failed" | "skipped";

export interface ReviewSession {
  id: UUID;
  userId: UUID;
  skillId: UUID;
  problemId: UUID | null;
  scheduledFor: ISODateString;
  outcome: ReviewOutcome;
  completedAt: ISODateString | null;
}

// ---------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------

export type ProjectDifficulty = "beginner" | "intermediate" | "advanced";

/**
 * Outcome-classification axis for a project (see EVALUATION VERDICTS) —
 * distinct from ProjectSubmissionStatus below, which is the legacy
 * manual-review workflow state. A project can have a real verdict here
 * while still being mid-workflow on that other axis.
 */
export type ProjectVerdict = "not_started" | "in_progress" | "passed" | "needs_improvement" | "failed";

/** @deprecated superseded by ProjectSkill (project_skills table) — kept only because projects.required_skills jsonb still exists in the schema, unread by new code. */
export interface ProjectRequiredSkill {
  skillId: UUID;
  minMasteryScore: number;
  minConfidence?: number;
}

/** projects.scoring_weights — keys match a ProjectReview.scoreBreakdown / ProjectSubmission.scoreBreakdown's keys. Percentages, sums to 100. */
export interface ProjectScoringWeights {
  correctness: number;
  edgeCases: number;
  efficiency: number;
  codeQuality: number;
  testing: number;
}

export interface ProjectExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface Project {
  id: UUID;
  slug: string;
  title: string;
  description: string;
  difficulty: ProjectDifficulty;
  /** @deprecated see ProjectRequiredSkill */
  requiredSkills: ProjectRequiredSkill[];
  starterRepoUrl: string | null;
  isPublished: boolean;
  overview: string;
  problemStatement: string;
  whyItMatters: string;
  objectives: string[];
  constraintsList: string[];
  examples: ProjectExample[];
  starterInstructions: string;
  scoringWeights: ProjectScoringWeights;
  estimatedHours: number | null;
  isFeatured: boolean;
}

export interface ProjectRequirement {
  id: UUID;
  projectId: UUID;
  title: string;
  description: string;
  sortOrder: number;
}

export type ProjectSkillRelationship = "prerequisite" | "demonstrates";

export interface ProjectSkill {
  id: UUID;
  projectId: UUID;
  skillId: UUID;
  relationship: ProjectSkillRelationship;
  minMasteryScore: number | null;
  minConfidence: number | null;
}

export interface ProjectLanguage {
  id: UUID;
  projectId: UUID;
  languageId: UUID;
}

export interface ProjectStage {
  id: UUID;
  projectId: UUID;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
}

export interface ProjectStageRequirement {
  id: UUID;
  stageId: UUID;
  description: string;
  sortOrder: number;
}

export type ProjectStageStatus = "not_started" | "in_progress" | "completed";

export interface ProjectStageProgress {
  id: UUID;
  userId: UUID;
  projectId: UUID;
  stageId: UUID;
  status: ProjectStageStatus;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
}

/** Coarse per-project progress index — what the dashboard's "Current Project" card reads. See db/schema/020_project_engine.sql. */
export interface UserProjectProgress {
  id: UUID;
  userId: UUID;
  projectId: UUID;
  verdict: ProjectVerdict;
  bestScore: number | null;
  currentStageId: UUID | null;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
}

export type ProjectSubmissionStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "approved"
  | "changes_requested";

/** Per-criterion breakdown — keys match ProjectScoringWeights. AI never writes these; see AI SAFETY: "AI must never determine the core correctness score." */
export interface ProjectScoreBreakdown {
  correctness: number;
  edgeCases: number;
  efficiency: number;
  codeQuality: number;
  testing: number;
}

/**
 * A single graded attempt. The legacy manual-review fields (status,
 * repositoryUrl, deploymentUrl, reviewerNotes) still serve the external-
 * repo review path from db/schema/008_projects.sql; the rest serve the
 * automated judge path added by 020_project_engine.sql. A project can
 * have many submissions per learner now (multiple stages, retries).
 */
export interface ProjectSubmission {
  id: UUID;
  userId: UUID;
  projectId: UUID;
  status: ProjectSubmissionStatus;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  reviewerNotes: string | null;
  stageId: UUID | null;
  attemptNumber: number;
  languageId: UUID | null;
  sourceCode: string | null;
  verdict: ProjectVerdict | null;
  score: number | null;
  scoreBreakdown: ProjectScoreBreakdown | null;
  passedTestCount: number;
  totalTestCount: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  executionId: string | null;
  compileOutput: string | null;
  startedAt: ISODateString | null;
  submittedAt: ISODateString | null;
}

/** Mirrors ProblemTestCase's shape exactly — see db/schema/020_project_engine.sql. */
export interface ProjectTestCase {
  id: UUID;
  stageId: UUID;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  isEdgeCase: boolean;
  explanation: string | null;
  weight: number;
  comparisonMode: ComparisonMode;
  numericTolerance: number | null;
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
  sortOrder: number;
}

export interface ProjectTestResult {
  id: UUID;
  projectSubmissionId: UUID;
  testCaseId: UUID;
  passed: boolean;
  actualOutput: string | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  errorType: string | null;
}

export interface ProjectSqlDataset {
  id: UUID;
  stageId: UUID;
  schemaSql: string;
  seedSql: string;
}

/** Post-submission report — see PROJECT REVIEW. aiSummary is clearly-labeled AI commentary, kept separate from the deterministic fields around it. */
export interface ProjectReview {
  id: UUID;
  userId: UUID;
  projectId: UUID;
  projectSubmissionId: UUID;
  overallScore: number;
  scoreBreakdown: ProjectScoreBreakdown;
  verdict: ProjectVerdict;
  strengths: string[];
  weaknesses: string[];
  skillsDemonstrated: { skillId: UUID; skillName: string; note: string }[];
  complexityAssessment: string | null;
  testingAssessment: string | null;
  nextRecommendedAction: string | null;
  aiSummary: string | null;
  reviewedAt: ISODateString;
}

/** Portfolio foundation only — see PORTFOLIO. A later prompt builds the full portfolio UI on top of this. */
export interface ProjectPortfolioEntry {
  id: UUID;
  userId: UUID;
  projectId: UUID;
  projectSubmissionId: UUID;
  projectReviewId: UUID;
  score: number;
  skillsDemonstrated: { skillId: UUID; skillName: string; note: string }[];
  languageSlug: string;
  difficulty: ProjectDifficulty;
  completedAt: ISODateString;
}

// ---------------------------------------------------------------------
// Interviews, achievements, notifications
// ---------------------------------------------------------------------

export type InterviewKind = "coding" | "debugging" | "system_design" | "behavioral";
export type InterviewStatus = "in_progress" | "completed" | "abandoned";

export interface InterviewSession {
  id: UUID;
  userId: UUID;
  kind: InterviewKind;
  status: InterviewStatus;
  problemId: UUID | null;
  score: number | null;
  feedback: string | null;
}

export interface Achievement {
  id: UUID;
  userId: UUID;
  achievementKey: string;
  title: string;
  description: string;
  earnedAt: ISODateString;
}

export interface Notification {
  id: UUID;
  userId: UUID;
  title: string;
  body: string;
  link: string | null;
  readAt: ISODateString | null;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------

export type AiCapability =
  | "mentor"
  | "hint"
  | "code_review"
  | "explanation"
  | "interviewer"
  | "project_review";

export interface AiConversation {
  id: UUID;
  userId: UUID;
  capability: AiCapability;
  problemId: UUID | null;
  projectId: UUID | null;
  interviewSessionId: UUID | null;
}

export type AiMessageRole = "system" | "user" | "assistant";

export interface AiMessage {
  id: UUID;
  conversationId: UUID;
  role: AiMessageRole;
  content: string;
  hintLevel: 1 | 2 | 3 | 4 | 5 | 6 | null;
  provider: string | null;
  model: string | null;
}

// ---------------------------------------------------------------------
// GitHub & deployment
// ---------------------------------------------------------------------

export interface GithubConnection {
  id: UUID;
  userId: UUID;
  githubUsername: string;
  connectedAt: ISODateString;
}

export type DeploymentStatus = "pending" | "building" | "live" | "failed";

export interface Deployment {
  id: UUID;
  userId: UUID;
  projectSubmissionId: UUID | null;
  provider: string;
  status: DeploymentStatus;
  url: string | null;
}
