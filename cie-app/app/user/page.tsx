"use client";

import Link from "vinext/shims/link";
import { useEffect, useState } from "react";
import type { AnalysisResult, MatchStatus } from "@/lib/ai/scoring";

type Role = { id: number; name: string };

export default function UserPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleId, setRoleId] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [filter, setFilter] = useState<MatchStatus | "all">("all");

  async function handleAnalyze(event: React.FormEvent) {
    event.preventDefault();
    if (analyzing || !resume || !roleId) return;
    setAnalysisError("");
    setResult(null);
    if (!/\.pdf$/i.test(resume.name) || resume.size === 0 || resume.size > 5 * 1024 * 1024) {
      setAnalysisError("Choose a nonempty PDF resume, 5 MB or smaller.");
      return;
    }
    setAnalyzing(true);
    try {
      const body = new FormData();
      body.append("resume", resume);
      body.append("roleId", roleId);
      const response = await fetch("/api/analyze-resume", { method: "POST", body });
      const data = await response.json() as AnalysisResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not analyze the resume.");
      setResult(data as AnalysisResult);
      setFilter("all");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Could not analyze the resume.");
    } finally { setAnalyzing(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function loadRoles() {
      try {
        const response = await fetch("/api/roles", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load roles. Please refresh to try again.");
        const data = await response.json() as { roles: Role[] };
        setRoles(data.roles);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Could not load roles.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRoles();
    return () => controller.abort();
  }, []);

  return (
    <main className="user-page">
      <Link className="brand" href="/">Conskill</Link>
      <section className="user-application">
        <h1>Get started</h1>
        <form className="user-fields" onSubmit={handleAnalyze} aria-busy={analyzing}>
          <label htmlFor="resume">Upload resume</label>
          <input
            id="resume"
            type="file"
            accept=".pdf,application/pdf"
            required
            disabled={analyzing}
            aria-describedby="resume-help resume-status"
            onChange={(event) => { setResume(event.target.files?.[0] ?? null); setResult(null); setAnalysisError(""); }}
          />
          <p id="resume-help" className="field-help">PDF, up to 5 MB. Export Word documents as PDF first.</p>
          <p id="resume-status" className="field-help" aria-live="polite">{resume ? "Selected: " + resume.name : "No resume selected."}</p>
          <label htmlFor="role">Choose a role</label>
          <select
            id="role"
            value={roleId}
            onChange={(event) => { setRoleId(event.target.value); setResult(null); setAnalysisError(""); }}
            required
            disabled={analyzing || loading || !!error || roles.length === 0}
            aria-describedby={error ? "roles-error" : undefined}
          >
            <option value="">{loading ? "Loading roles..." : error ? "Roles unavailable" : roles.length === 0 ? "No roles available yet" : "Select a role"}</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          {error && <p id="roles-error" className="error-message" role="alert">{error}</p>}
          <p className="field-help">Your resume is sent to OpenAI for analysis. Conskill does not save your resume or results.</p>
          <button className="analyze-button" type="submit" disabled={analyzing || loading || !!error || !resume || !roleId}>
            {analyzing ? "Analyzing..." : "Analyze resume"}
          </button>
          {analyzing && <p className="field-help" role="status">Reading your resume and checking role competencies. This may take a minute.</p>}
          {analysisError && <p className="error-message" role="alert">{analysisError}</p>}
        </form>
        {result && (
          <section className="analysis-results" aria-label="Resume analysis results">
            <h2>{result.role.name}</h2>
            <p className="match-score">{result.score}% <span>resume match</span></p>
            <p className="field-help">{result.counts.matched} demonstrated · {result.counts.partial} partial · {result.counts.missing} not demonstrated</p>
            <p className="field-help">Each competency counts once: demonstrated = 1, partial = 0.5, not demonstrated = 0. This reflects resume evidence, not a hiring decision.</p>
            <div className="analysis-filters" role="group" aria-label="Filter requirements">
              {(["all", "matched", "partial", "missing"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {{ all: "All", matched: "Demonstrated", partial: "Partial", missing: "Not demonstrated" }[value]}
                </button>
              ))}
            </div>
            <div className="analysis-items" aria-live="polite">
              {result.requirements.filter((item) => filter === "all" || item.status === filter).map((item) => (
                <article className="analysis-item" key={item.id}>
                  <span className="analysis-skill">{item.skill}</span>
                  <h3>{item.description}</h3>
                  <span className={"analysis-status status-" + item.status}>
                    {{ matched: "Demonstrated", partial: "Partial evidence", missing: "Not demonstrated" }[item.status]}
                  </span>
                  <p>{item.evidence}</p>
                  {item.recommendation && <p><strong>Next step:</strong> {item.recommendation}</p>}
                </article>
              ))}
              {filter !== "all" && result.counts[filter] === 0 && <p>No requirements in this category.</p>}
            </div>
          </section>
        )}
        <Link href="/">Back to home</Link>
      </section>
    </main>
  );
}
