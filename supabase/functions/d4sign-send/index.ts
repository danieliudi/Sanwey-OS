import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Item 12 — envia um documento (armazenado no nosso Storage) pro D4Sign
// pra assinatura eletrônica. Autenticado (RH aciona de dentro da plataforma).
//
// Fails open: sem D4SIGN_API_TOKEN/D4SIGN_CRYPT_KEY/D4SIGN_SAFE_UUID
// configurados no Supabase, responde { configured: false } em vez de
// quebrar — mesmo padrão do item 11 (check-document-legibility). Ainda NÃO
// testado contra a API real do D4Sign (sem credenciais até o momento);
// assim que a chave chegar, validar o fluxo completo end-to-end antes de
// liberar pro usuário final.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse({ error: "Autenticação necessária" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return jsonResponse({ error: "Sessão inválida" }, 401);

    const apiToken = Deno.env.get("D4SIGN_API_TOKEN");
    const cryptKey = Deno.env.get("D4SIGN_CRYPT_KEY");
    const safeUuid = Deno.env.get("D4SIGN_SAFE_UUID");
    const baseUrl  = Deno.env.get("D4SIGN_BASE_URL") || "https://secure.d4sign.com.br/api/v1";
    const webhookSecret = Deno.env.get("D4SIGN_WEBHOOK_SECRET");

    if (!apiToken || !cryptKey || !safeUuid) {
      return jsonResponse({ configured: false });
    }

    const body = await req.json();
    const {
      domain, recordId, signers, sourceStorageBucket, sourceStoragePath, message,
    } = body;

    if (!domain || !recordId || !Array.isArray(signers) || !signers.length || !sourceStorageBucket || !sourceStoragePath) {
      return jsonResponse({ error: "Parâmetros obrigatórios: domain, recordId, signers, sourceStorageBucket, sourceStoragePath." }, 400);
    }

    const authQS = `tokenAPI=${encodeURIComponent(apiToken)}&cryptKey=${encodeURIComponent(cryptKey)}`;

    // 1) Baixa o arquivo-fonte do nosso Storage.
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from(sourceStorageBucket)
      .download(sourceStoragePath);
    if (downloadErr || !fileBlob) {
      return jsonResponse({ error: `Não foi possível ler o arquivo de origem: ${downloadErr?.message || "não encontrado"}` }, 400);
    }

    // 2) Upload pro cofre (safe) do D4Sign.
    const form = new FormData();
    form.append("file", fileBlob, sourceStoragePath.split("/").pop() || "documento.pdf");
    const uploadRes = await fetch(`${baseUrl}/documents/${safeUuid}/upload?${authQS}`, {
      method: "POST",
      body: form,
    });
    const uploadData = await uploadRes.json();
    const documentUuid = uploadData?.uuid;
    if (!uploadRes.ok || !documentUuid) {
      return jsonResponse({ error: `Falha no upload pro D4Sign: ${JSON.stringify(uploadData)}` }, 502);
    }

    // 3) Cadastra os signatários.
    const signersPayload = {
      signers: signers.map((s: { name: string; email: string }) => ({
        email: s.email,
        act: "1", // 1 = assinar
        foreign: "0",
        certificadoicpbrasil: "0",
        assinatura_presencial: "0",
        docauth: "0",
        docauthandselfie: "0",
        embed_methodauth: "email",
        embed_smsauth: "",
      })),
    };
    const signersRes = await fetch(`${baseUrl}/documents/${documentUuid}/createlist?${authQS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signersPayload),
    });
    if (!signersRes.ok) {
      const errBody = await signersRes.text();
      return jsonResponse({ error: `Falha ao cadastrar signatários: ${errBody}` }, 502);
    }

    // 4) Registra o webhook deste documento (se tivermos um secret nosso pra
    // validar a assinatura do callback depois).
    if (webhookSecret) {
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/d4sign-webhook`;
      await fetch(`${baseUrl}/documents/${documentUuid}/registerwebhook?${authQS}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, hmac_secret: webhookSecret }),
      }).catch(() => { /* não bloqueia o envio se o registro do webhook falhar */ });
    }

    // 5) Envia de fato pra assinatura.
    const sendRes = await fetch(`${baseUrl}/documents/${documentUuid}/sendtosigner?${authQS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message || "Documento pra assinatura — Grupo Sanwey", skip_email: "0", workflow: "0" }),
    });
    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      return jsonResponse({ error: `Falha ao enviar pra assinatura: ${errBody}` }, 502);
    }

    // 6) Registra localmente.
    const { error: dbErr } = await supabase.from("rh_signature_requests").upsert({
      domain, record_id: recordId,
      status: "enviado",
      signers,
      source_storage_path: `${sourceStorageBucket}/${sourceStoragePath}`,
      d4sign_document_uuid: documentUuid,
      sent_at: new Date().toISOString(),
      created_by: userData.user.id,
    }, { onConflict: "d4sign_document_uuid" });
    if (dbErr) return jsonResponse({ error: dbErr.message }, 500);

    return jsonResponse({ ok: true, documentUuid });
  } catch (err: any) {
    return jsonResponse({ error: err.message || "Erro inesperado." }, 500);
  }
});
