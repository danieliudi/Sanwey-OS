import { createClient } from "jsr:@supabase/supabase-js@2";

// BX-08 (auditoria de segurança, achado registrado 19/08/2026, reforço
// pedido pelo Daniel 22/08/2026): o upload de figurinha do Chat interno
// ia direto do client pro Storage (supabase.storage.upload), confiando no
// content-type QUE O PRÓPRIO CLIENT declara — o bucket "chat-stickers" é
// público e o allowed_mime_types do bucket só valida esse header declarado,
// não os bytes reais do arquivo. Um gestor (único papel com permissão de
// upload) mal-intencionado ou com sessão comprometida podia declarar
// Content-Type: image/png num arquivo que na verdade é outra coisa (ex.:
// SVG com <script>) e o bucket aceitava, servindo esse conteúdo depois via
// getPublicUrl pra todo mundo no Chat.
//
// Esta function fecha esse gap: recebe o arquivo em base64, confere a
// assinatura binária real (magic bytes) contra PNG/WEBP antes de gravar —
// se não bater com nenhum dos dois, rejeita, independente do que o client
// declarou. Upload e insert na tabela usam service role (RLS de
// chat_is_manager já checada aqui em cima, então dispensa round-trip pela
// policy) — mesmo padrão de outras functions de upload nesta base
// (google-drive-upload, check-document-legibility).

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

const MAX_BYTES = 2 * 1024 * 1024; // mesmo teto do bucket (file_size_limit)
const DIACRITICS_RE = /[̀-ͯ]/g;

function slug(name: string) {
  return (name || "figurinha")
    .normalize("NFD").replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "figurinha";
}

function detectImageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "Autenticação necessária" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return jsonResponse({ error: "Sessão inválida" }, 401);
  const userId = userData.user.id;

  const { data: isManager, error: roleErr } = await admin.rpc("chat_is_manager", { p_user_id: userId });
  if (roleErr) return jsonResponse({ error: "Falha ao verificar permissão" }, 500);
  if (!isManager) return jsonResponse({ error: "Sem permissão para enviar figurinhas" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "JSON inválido" }, 400); }

  const { fileBase64, fileName, name } = body as { fileBase64?: string; fileName?: string; name?: string };
  if (!fileBase64) return jsonResponse({ error: "'fileBase64' é obrigatório" }, 400);

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
  } catch {
    return jsonResponse({ error: "Arquivo em base64 inválido" }, 400);
  }

  if (bytes.length === 0) return jsonResponse({ error: "Arquivo vazio" }, 400);
  if (bytes.length > MAX_BYTES) return jsonResponse({ error: "Arquivo maior que 2 MB" }, 400);

  const detected = detectImageType(bytes);
  if (!detected) {
    return jsonResponse({ error: "Arquivo não reconhecido como PNG ou WEBP válido (moderação de upload)" }, 400);
  }

  const label = (name || (fileName || "").replace(/\.[^.]+$/, "") || "figurinha").trim().slice(0, 80) || "figurinha";
  const path = `${Date.now()}-${slug(label)}.${detected.ext}`;

  const { error: storageErr } = await admin.storage
    .from("chat-stickers")
    .upload(path, bytes, { contentType: detected.mime, upsert: false });
  if (storageErr) return jsonResponse({ error: "Falha ao gravar arquivo" }, 500);

  const { data: row, error: dbErr } = await admin
    .from("chat_stickers")
    .insert({ name: label, image_path: path, uploaded_by: userId })
    .select()
    .single();
  if (dbErr) {
    await admin.storage.from("chat-stickers").remove([path]);
    return jsonResponse({ error: "Falha ao registrar figurinha" }, 500);
  }

  return jsonResponse({ sticker: row });
});
