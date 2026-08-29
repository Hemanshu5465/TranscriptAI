// Vercel function: authorizes browser → Vercel Blob presigned uploads so a media
// file (up to 50 MB) goes straight to Blob, bypassing the 4.5 MB serverless body
// limit. Uses the OIDC auth the Blob connection provides (VERCEL_OIDC_TOKEN +
// BLOB_STORE_ID) — no BLOB_READ_WRITE_TOKEN needed. Routed at /api/blob.
//
// Handles both invocation styles Vercel may use: Node (req, res) and Web (Request).
import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned } from "@vercel/blob/client";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB — keep in sync with backend max_upload_mb
const ALLOWED = ["video/*", "audio/*", "application/octet-stream"];

export default async function handler(reqOrRequest, maybeRes) {
  const isNode = maybeRes && typeof maybeRes.end === "function";

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

  let webRequest;
  if (isNode) {
    const host = reqOrRequest.headers.host || "localhost";
    const proto = reqOrRequest.headers["x-forwarded-proto"] || "https";
    webRequest = new Request(`${proto}://${host}${reqOrRequest.url || "/api/blob"}`, {
      method: reqOrRequest.method || "POST",
      headers: new Headers(reqOrRequest.headers),
    });
  } else {
    webRequest = reqOrRequest;
  }

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request: webRequest,
      getSignedToken: async (pathname) => ({
        token: await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
        }),
        urlOptions: {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 30 * 60 * 1000,
        },
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
