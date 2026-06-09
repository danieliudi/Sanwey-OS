import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ServiceAccount {
  client_email: string;
  private_key:  string;
  token_uri?:   string;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud:   sa.token_uri ?? "https://oauth2.googleapis.com/token",
    exp:   now + 3600,
    iat:   now,
  };

  // Build JWT manually (Deno native crypto)
  const header  = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const sigInput = `${header}.${payload}`;

  // Import RSA private key (PKCS8 PEM → CryptoKey)
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sigBytes = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(sigInput),
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${sigInput}.${sig}`;

  // Exchange JWT for access token
  const tokenRes = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`Failed to get access token: ${txt.slice(0, 200)}`);
  }

  const { access_token } = await tokenRes.json() as { access_token: string };
  return access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return jsonResponse({ error: "Method not allowed" }, 405);

  // Verify caller is authenticated
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { fileBase64, fileName, mimeType, folderId } = body as {
    fileBase64: string;
    fileName:   string;
    mimeType:   string;
    folderId:   string;
  };

  if (!fileBase64 || !fileName || !folderId) {
    return jsonResponse({ error: "fileBase64, fileName and folderId are required" }, 400);
  }

  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) {
    return jsonResponse({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not configured" }, 503);
  }

  let sa: ServiceAccount;
  try { sa = JSON.parse(saJson) as ServiceAccount; } catch {
    return jsonResponse({ error: "Invalid GOOGLE_SERVICE_ACCOUNT_JSON" }, 500);
  }

  let accessToken: string;
  try { accessToken = await getAccessToken(sa); } catch (e) {
    return jsonResponse({ error: `Auth error: ${(e as Error).message}` }, 500);
  }

  // Decode base64 to bytes
  const fileBytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
  const effectiveMime = mimeType || "application/octet-stream";

  // Multipart upload to Drive API v3
  const metadata = JSON.stringify({
    name:    fileName,
    parents: [folderId],
  });

  const boundary = `boundary_${Date.now()}`;
  const parts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${effectiveMime}\r\n\r\n`,
  ];

  const enc = new TextEncoder();
  const closing = enc.encode(`\r\n--${boundary}--`);
  const part1   = enc.encode(parts[0]);
  const part2   = enc.encode(parts[1]);

  const multipart = new Uint8Array(part1.length + part2.length + fileBytes.length + closing.length);
  multipart.set(part1, 0);
  multipart.set(part2, part1.length);
  multipart.set(fileBytes, part1.length + part2.length);
  multipart.set(closing, part1.length + part2.length + fileBytes.length);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name",
    {
      method:  "POST",
      headers: {
        "Authorization":  `Bearer ${accessToken}`,
        "Content-Type":   `multipart/related; boundary=${boundary}`,
        "Content-Length": String(multipart.length),
      },
      body: multipart,
    },
  );

  if (!uploadRes.ok) {
    const txt = await uploadRes.text();
    return jsonResponse({ error: "Drive upload failed", detail: txt.slice(0, 300) }, 502);
  }

  const result = await uploadRes.json() as { id: string; webViewLink: string; name: string };
  return jsonResponse({
    driveFileId:      result.id,
    driveWebViewLink: result.webViewLink,
    driveName:        result.name,
  });
});
