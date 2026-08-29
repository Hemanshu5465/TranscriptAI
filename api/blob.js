// Vercel Node function: mints scoped client-upload tokens for Vercel Blob.
// The browser (@vercel/blob/client `upload()`) POSTs here, gets a short-lived
// token, then uploads the file straight to Blob — bypassing the 4.5 MB
// serverless body limit. Routed at /api/blob (see vercel.json).
import { handleUpload } from "@vercel/blob/client";

const MAX_BYTES = 50 * 1024 * 1024; // keep in sync with backend max_upload_mb

export default async function handler(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*", "audio/*"],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op: the browser hands the blob URL straight to /api/v1/transcripts.
      },
    });
    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error?.message ?? "upload failed" },
      { status: 400 },
    );
  }
}
