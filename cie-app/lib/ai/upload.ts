export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_RESUME_BYTES + 64 * 1024;

export class UploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Bound the actual stream, including requests without a trustworthy Content-Length. */
export async function readResumeUpload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new UploadError("Choose a PDF resume and a role.");
  }
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    throw new UploadError("Resume must be 5 MB or smaller.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new UploadError("No resume was received.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new UploadError("Resume must be 5 MB or smaller.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let form: FormData;
  try {
    form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData();
  } catch { throw new UploadError("Could not read the upload. Please choose your file again."); }
  const file = form.get("resume");
  const roleValue = form.get("roleId");
  const roleId = typeof roleValue === "string" ? Number(roleValue) : NaN;
  if (!Number.isSafeInteger(roleId) || roleId <= 0) throw new UploadError("Choose a valid role.");
  if (!(file instanceof File) || !file.size) throw new UploadError("Choose a nonempty PDF resume.");
  if (file.size > MAX_RESUME_BYTES) throw new UploadError("Resume must be 5 MB or smaller.", 413);
  if (!/\.pdf$/i.test(file.name) || (file.type && !["application/pdf", "application/octet-stream"].includes(file.type))) {
    throw new UploadError("Please upload a PDF resume. Export Word documents as PDF first.", 415);
  }
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (header !== "%PDF-") throw new UploadError("This file does not appear to be a PDF.", 415);
  return { file, roleId };
}
