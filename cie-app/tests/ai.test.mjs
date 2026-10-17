import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";

// Run the actual TypeScript modules with isolated Worker and provider bindings.
// No external requests, API keys, or real database records are used.
const root = process.cwd();
const requirements = [
  { id: "competency:c1", skill: "Drawings", description: "Read drawings" },
  { id: "competency:c2", skill: "Drawings", description: "Specifications" },
  { id: "skill:s2", skill: "Safety", description: "Safety" },
];
const evaluations = [
  { id: "competency:c1", status: "matched", evidence: "Read structural drawings", recommendation: "" },
  { id: "competency:c2", status: "partial", evidence: "Assisted with specs", recommendation: "Practice reviewing specifications." },
  { id: "skill:s2", status: "missing", evidence: "No safety evidence documented", recommendation: "Complete site safety training." },
];

async function fixture(options = {}) {
  const captured = { calls: 0 };
  const db = {
    prepare(sql) {
      captured.sql = [...(captured.sql ?? []), sql];
      return {
        bind(id) { assert.equal(id, 1); return this; },
        async first() { return options.missingRole ? null : { id: 1, name: "Engineer", description: "Site engineering" }; },
        async all() { return { results: options.rows ?? [
          { skill_id: "s1", skill_name: "Drawings", competency_id: "c1", description: "Read drawings" },
          { skill_id: "s1", skill_name: "Drawings", competency_id: "c2", description: "Specifications" },
          { skill_id: "s2", skill_name: "Safety", competency_id: null, description: null },
        ] }; },
      };
    },
  };
  class APIError extends Error { constructor(status) { super("Provider detail must stay private"); this.status = status; } }
  class APIConnectionTimeoutError extends APIError {}
  class OpenAI {
    static APIError = APIError;
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    constructor(config) {
      captured.config = config;
      this.responses = { create: async (request) => {
        captured.calls++;
        captured.request = request;
        if (options.providerStatus) throw new APIError(options.providerStatus);
        return options.response ?? { status: "completed", output_text: JSON.stringify({ readable_resume: true, evaluations }) };
      } };
    }
  }
  const env = {
    DB: db,
    OPENAI_API_KEY: options.noKey ? undefined : "test-key",
    RESUME_RATE_LIMITER: { limit: async ({ key }) => {
      captured.rateKey = key;
      return { success: !options.limited };
    } },
  };
  const context = vm.createContext({ URL, Request, Response, File, FormData, TextDecoder, Uint8Array, btoa });
  const cache = new Map();
  async function load(name) {
    if (cache.has(name)) return cache.get(name);
    let module;
    if (name === "cloudflare:workers") {
      module = new vm.SyntheticModule(["env"], function () { this.setExport("env", env); }, { context });
    } else if (name === "openai") {
      module = new vm.SyntheticModule(["default"], function () { this.setExport("default", OpenAI); }, { context });
    } else {
      const source = stripTypeScriptTypes(readFileSync(name, "utf8"), { mode: "transform" });
      module = new vm.SourceTextModule(source, { context, identifier: name });
    }
    cache.set(name, module);
    await module.link((specifier, parent) => {
      if (["cloudflare:workers", "openai"].includes(specifier)) return load(specifier);
      const filename = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(parent.identifier), specifier);
      return load(filename + ".ts");
    });
    return module;
  }
  const route = await load(path.join(root, "app/api/analyze-resume/route.ts"));
  await route.evaluate();
  const scoring = await load(path.join(root, "lib/ai/scoring.ts"));
  const upload = await load(path.join(root, "lib/ai/upload.ts"));
  return { post: route.namespace.POST, score: scoring.namespace.scoreAnalysis, upload: upload.namespace.readResumeUpload, captured };
}

function request({ filename = "resume.pdf", content = "%PDF-1.7\nExample resume", type = "application/pdf", roleId = "1", origin = "https://conskill.in" } = {}) {
  const form = new FormData();
  form.append("resume", new File([content], filename, { type }));
  form.append("roleId", roleId);
  return new Request("https://conskill.in/api/analyze-resume", { method: "POST", body: form, headers: { Origin: origin, "CF-Connecting-IP": "192.0.2.1" } });
}

test("scoring: competency coverage and half credit, independent of model order", async () => {
  const { score } = await fixture();
  const result = score(requirements, { evaluations: [...evaluations].reverse() });
  assert.equal(result.score, 50);
  assert.equal(result.counts.matched, 1);
  assert.equal(result.requirements[0].id, "competency:c1");
  assert.equal(score(requirements, { evaluations: evaluations.map((item) => ({ ...item, status: "matched" })) }).score, 100);
  assert.equal(score(requirements, { evaluations: evaluations.map((item) => ({ ...item, status: "missing", recommendation: "Practice" })) }).score, 0);
});

test("scoring: reject empty, duplicate, missing, invented, and malformed evaluations", async () => {
  const { score } = await fixture();
  for (const output of [null, {}, { evaluations: [] },
    { evaluations: [...evaluations, evaluations[0]] },
    { evaluations: [evaluations[0], evaluations[1], { ...evaluations[2], id: "invented" }] },
    { evaluations: evaluations.map((item) => ({ ...item, status: "qualified" })) },
    { evaluations: evaluations.map((item) => ({ ...item, evidence: "" })) },
    { evaluations: evaluations.map((item) => ({ ...item, recommendation: "" })) },
  ]) assert.throws(() => score(requirements, output));
  assert.throws(() => score([], { evaluations: [] }));
});

test("endpoint: real analysis pipeline, no double counting, strict private provider request", async () => {
  const { post, captured } = await fixture();
  const response = await post(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.equal(data.score, 50);
  assert.equal(data.requirements.length, 3);
  assert.equal(data.role.name, "Engineer");
  assert.equal(captured.calls, 1);
  assert.equal(captured.rateKey, "192.0.2.1");
  assert.equal(captured.request.store, false);
  assert.equal(captured.request.text.format.strict, true);
  assert.equal(captured.request.model, "gpt-4.1-mini");
  assert.match(captured.request.input[0].content[1].file_data, /^data:application\/pdf;base64,/);
  assert.ok(!JSON.stringify(data).includes("test-key"));
});

for (const [name, options, status] of [
  ["missing key", { noKey: true }, 503],
  ["rate limit", { limited: true }, 429],
  ["deleted role", { missingRole: true }, 404],
  ["empty role", { rows: [] }, 422],
  ["provider overload", { providerStatus: 429 }, 503],
  ["unreadable resume", { response: { status: "completed", output_text: JSON.stringify({ readable_resume: false, evaluations: [] }) } }, 422],
  ["truncated output", { response: { status: "incomplete", output_text: "{}" } }, 502],
  ["malformed provider JSON", { response: { status: "completed", output_text: "invalid" } }, 502],
  ["missing evaluation", { response: { status: "completed", output_text: JSON.stringify({ readable_resume: true, evaluations: evaluations.slice(1) }) } }, 502],
]) test("endpoint: " + name, async () => {
  const { post } = await fixture(options);
  const response = await post(request());
  assert.equal(response.status, status);
  assert.ok((await response.json()).error);
});

test("endpoint: rejects cross-origin requests before calling provider", async () => {
  const { post, captured } = await fixture();
  assert.equal((await post(request({ origin: "https://other.example" }))).status, 403);
  assert.equal(captured.calls, 0);
});

test("upload: rejects invalid IDs, fake PDFs, empty files, Word files, and oversized uploads", async () => {
  const { post, captured } = await fixture();
  for (const input of [
    { roleId: "0" }, { roleId: "bad" }, { roleId: "1.5" },
    { content: "not a pdf" }, { content: "" }, { filename: "resume.docx" },
    { content: "%PDF-" + "x".repeat(5 * 1024 * 1024) },
  ]) assert.ok((await post(request(input))).status >= 400);
  assert.equal(captured.calls, 0);
});

test("upload: bounds actual streams even without Content-Length", async () => {
  const { upload } = await fixture();
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(6 * 1024 * 1024)); controller.close(); } });
  await assert.rejects(() => upload(new Request("https://conskill.in/api/analyze-resume", {
    method: "POST", body, duplex: "half", headers: { "Content-Type": "multipart/form-data; boundary=test" },
  })), /5 MB/);
});
