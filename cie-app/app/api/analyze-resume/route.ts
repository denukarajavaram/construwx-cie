import { env } from "cloudflare:workers";
import OpenAI from "openai";
import { getDatabase } from "@/lib/db/database";
import { analyzeResume, UnreadableResumeError } from "@/lib/ai/analyze";
import { readResumeUpload, UploadError } from "@/lib/ai/upload";
import type { Requirement } from "@/lib/ai/scoring";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Request origin is not allowed." }, 403);
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === "replace-with-your-api-key") {
    return json({ error: "Resume analysis is not configured yet. Please try again later." }, 503);
  }
  try {
    const { success } = await env.RESUME_RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "local" });
    if (!success) return json({ error: "Too many requests. Please wait a minute and try again." }, 429, { "Retry-After": "60" });
    const { file, roleId } = await readResumeUpload(request);
    const db = getDatabase();
    const role = await db.prepare("SELECT id, name, description FROM roles WHERE id = ?").bind(roleId)
      .first<{ id: number; name: string; description: string }>();
    if (!role) return json({ error: "This role no longer exists. Please select another role." }, 404);
    const { results } = await db.prepare(`
      SELECT s.id AS skill_id, s.name AS skill_name, c.id AS competency_id, c.description
      FROM role_skills s LEFT JOIN skill_competencies c ON c.skill_id = s.id
      WHERE s.role_id = ? ORDER BY s.sort_order, s.id, c.sort_order, c.id
    `).bind(roleId).all<{ skill_id: string; skill_name: string; competency_id: string | null; description: string | null }>();
    const requirements: Requirement[] = results.map((row) => ({
      id: row.competency_id ? "competency:" + row.competency_id : "skill:" + row.skill_id,
      skill: row.skill_name,
      description: row.competency_id ? row.description! : row.skill_name,
    }));
    if (!requirements.length) return json({ error: "This role has no skills to evaluate yet." }, 422);
    if (requirements.length > 100) return json({ error: "This role has too many competencies for one analysis (maximum 100)." }, 422);
    const result = await analyzeResume(env.OPENAI_API_KEY, file, role, requirements);
    return json({ role: { id: role.id, name: role.name }, ...result });
  } catch (error) {
    if (error instanceof UploadError) return json({ error: error.message }, error.status);
    if (error instanceof UnreadableResumeError) return json({ error: "Could not read a resume from this PDF. Please upload a readable, unlocked resume." }, 422);
    if (error instanceof OpenAI.APIError && error.status === 400) return json({ error: "Could not process this PDF. Try exporting a new, unlocked PDF resume." }, 422);
    if (error instanceof OpenAI.APIError && error.status === 429) return json({ error: "The analysis service is busy. Please try again later." }, 503);
    if (error instanceof OpenAI.APIConnectionTimeoutError) return json({ error: "Analysis took too long. Please try again." }, 504);
    // Never log provider request bodies or resume contents.
    return json({ error: "Could not complete the analysis. Please try again later." }, 502);
  }
}
