// Vercel function: mints scoped client-upload tokens for Vercel Blob so the
// browser can upload a media file (up to 50 MB) straight to Blob, bypassing the
// 4.5 MB serverless body limit. Routed at /api/blob (see vercel.json).
//
// Handles both invocation styles Vercel may use: Node (req, res) and Web (Request).
import { handleUpload } from "@vercel/blob/client";

const MAX_BYTES = 50 * 1024 * 1024; // keep in sync with backend max_upload_mb

export default async function handler(reqOrRequest, maybeRes) {
  const isNode = maybeRes && typeof maybeRes.end === "function";

  // ── read + parse the JSON body ───────────────────────────────
  let raw = "";
  if (isNode) {
    for await (const chunk of reqOrRequest) raw += chunk;
  } else {
    raw = await reqOrRequest.text();
  }
  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return send(isNode, maybeRes, 400, { error: "invalid JSON body" });
  }

  // ── a Web Request that @vercel/blob can read headers from ────
  let webRequest;
  let origin;
  if (isNode) {
    const host = reqOrRequest.headers.host || "localhost";
    const proto = reqOrRequest.headers["x-forwarded-proto"] || "https";
    origin = `${proto}://${host}`;
    webRequest = new Request(`${origin}${reqOrRequest.url || "/api/blob"}`, {
      method: reqOrRequest.method || "POST",
      headers: new Headers(reqOrRequest.headers),
    });
  } else {
    webRequest = reqOrRequest;
    origin = new URL(reqOrRequest.url).origin;
  }

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const callbackUrl = `${prod ? `https://${prod}` : origin}/api/blob`;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: webRequest,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*", "audio/*"],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
        callbackUrl,
      }),
      onUploadCompleted: async () => {
        // No-op: the browser hands the blob URL straight to /api/v1/transcripts.
      },
    });
    return send(isNode, maybeRes, 200, jsonResponse);
  } catch (error) {
    return send(isNode, maybeRes, 400, { error: String(error?.message || error) });
  }
}

function send(isNode, res, status, payload) {
  const text = JSON.stringify(payload);
  if (isNode) {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(text);
    return;
  }
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}
