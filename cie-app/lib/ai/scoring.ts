export type Requirement = { id: string; skill: string; description: string };
export type MatchStatus = "matched" | "partial" | "missing";
export type Evaluation = { id: string; status: MatchStatus; evidence: string; recommendation: string };
export type AnalysisResult = {
  role: { id: number; name: string };
  score: number;
  counts: Record<MatchStatus, number>;
  requirements: Array<Requirement & Evaluation>;
};

/** Validate exact coverage before calculating a score; never trust a model's percentage. */
export function scoreAnalysis(requirements: Requirement[], output: unknown) {
  if (!requirements.length || new Set(requirements.map((item) => item.id)).size !== requirements.length) {
    throw new Error("Requirements must be nonempty and unique.");
  }
  if (!output || typeof output !== "object" || !("evaluations" in output) || !Array.isArray(output.evaluations)) {
    throw new Error("Invalid analysis response.");
  }
  const evaluations = new Map<string, Evaluation>();
  const expected = new Set(requirements.map((item) => item.id));
  for (const item of output.evaluations) {
    if (!item || typeof item !== "object" || !expected.has(item.id) || evaluations.has(item.id) ||
      !["matched", "partial", "missing"].includes(item.status) ||
      typeof item.evidence !== "string" || item.evidence.length > 2000 ||
      typeof item.recommendation !== "string" || item.recommendation.length > 2000 ||
      !item.evidence.trim() || (item.status !== "matched" && !item.recommendation.trim())) {
      throw new Error("Invalid requirement evaluation.");
    }
    evaluations.set(item.id, { id: item.id, status: item.status, evidence: item.evidence.trim(), recommendation: item.recommendation.trim() });
  }
  if (evaluations.size !== requirements.length) throw new Error("Incomplete analysis response.");
  const counts: Record<MatchStatus, number> = { matched: 0, partial: 0, missing: 0 };
  const results = requirements.map((requirement) => {
    const evaluation = evaluations.get(requirement.id)!;
    counts[evaluation.status]++;
    return { ...requirement, ...evaluation };
  });
  return {
    score: Math.round(((counts.matched + counts.partial * 0.5) / requirements.length) * 100),
    counts,
    requirements: results,
  };
}
