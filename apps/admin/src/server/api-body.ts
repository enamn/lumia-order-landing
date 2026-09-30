import { AppError } from "./errors";
export async function jsonBody(request: Request, maxBytes = 32768) {
  const label = maxBytes >= 1048576 ? `${Math.round(maxBytes / 1048576)} MB` : `${Math.round(maxBytes / 1024)} KB`;
  const tooLarge = () => new AppError("BODY_TOO_LARGE", `Request body exceeds ${label}.`, 413);
  if (Number(request.headers.get("content-length")) > maxBytes) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_JSON", "A JSON body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > maxBytes) { await reader.cancel(); throw tooLarge(); } chunks.push(value); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
