import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type EmailType =
  | "ferias_aprovadas"
  | "ferias_rejeitadas"
  | "welcome"
  | "candidato_aprovado"
  | "candidato_reprovado"
  | "vaga_manager_link"
  | "candidatura_recebida"
  | "avaliacao_proxima"
  | "contrato_fornecedor_vencendo";

interface SendEmailBody {
  type: EmailType;
  to?: string;
  // Lote/cópia oculta (Áudio 8 do RH): reprovação em massa. Quando presente,
  // os destinatários vão só em BCC (nunca se veem entre si) e `to` é o próprio
  // remetente. O Resend limita ~50 destinatários por chamada, então o handler
  // quebra em blocos.
  bcc?: string[];
  variables?: Record<string, string>;
  // Usados só por "candidatura_recebida" (disparado pelo próprio formulário
  // público, sem login) — ver handlePublicCandidaturaRecebida.
  vagaSlug?: string;
  candidateId?: string;
}

// ── Subjects ──────────────────────────────────────────────────────────────────

const SUBJECTS: Record<EmailType, string> = {
  ferias_aprovadas:    "Suas férias foram aprovadas — Grupo Sanwey",
  ferias_rejeitadas:   "Sobre sua solicitação de férias — Grupo Sanwey",
  welcome:             "Bem-vindo(a) ao Grupo Sanwey!",
  candidato_aprovado:  "Parabéns! Sua candidatura foi aprovada — Grupo Sanwey",
  candidato_reprovado: "Retorno sobre seu processo seletivo — Grupo Sanwey",
  vaga_manager_link:   "Candidatos pra sua avaliação — Grupo Sanwey",
  candidatura_recebida:"Recebemos sua candidatura — Grupo Sanwey",
  avaliacao_proxima:   "Avaliação de desempenho se aproximando — Grupo Sanwey",
  contrato_fornecedor_vencendo: "Contrato com fornecedor vencendo — Grupo Sanwey",
};

// ── Template builders ─────────────────────────────────────────────────────────

// Escapa HTML dos valores antes de injetar no template.
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyVars(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) =>
      acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), escapeHtml(value ?? "")),
    html,
  );
}

// Casca comum (logo + card + rodapé) — evita repetir o boilerplate em cada
// template. `inner` é o miolo específico; `accent` é a cor da barrinha.
function shell(inner: string, accent: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;"><tr><td align="center" style="padding:48px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding-bottom:28px;"><img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" /></td></tr>
      <tr><td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
        <div style="width:36px;height:3px;background:${accent};border-radius:2px;margin-bottom:28px;"></div>
        ${inner}
      </td></tr>
      <tr><td style="padding:28px 0 8px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#8A8680;line-height:1.6;">&copy; Grupo Sanwey &mdash; Commercial Intelligence Platform</p>
        <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do sistema de RH.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function tplFeriasAprovadas(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Suas férias foram aprovadas ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{EMPLOYEE_NAME}}</strong>. Sua solicitação de afastamento foi aprovada com sucesso.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="50%" style="padding:5px 0;font-size:13px;color:#8A8680;">Tipo de licença</td><td width="50%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{LEAVE_TYPE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Início</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{START_DATE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Término</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{END_DATE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Total de dias</td><td style="padding:5px 0;font-size:14px;color:#2C2C2B;font-weight:700;">{{DAYS_COUNT}} dias</td></tr>
    </table></td></tr></table>
    <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C7212B;border-radius:10px;"><a href="{{APP_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Acessar plataforma &rarr;</a></td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Aprovado por <strong style="color:#2C2C2B;">{{APPROVED_BY}}</strong>.</p>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function tplFeriasRejeitadas(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Solicitação de férias não aprovada</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{EMPLOYEE_NAME}}</strong>. Infelizmente sua solicitação de afastamento não pôde ser aprovada no momento.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="50%" style="padding:5px 0;font-size:13px;color:#8A8680;">Tipo de licença</td><td width="50%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{LEAVE_TYPE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Período solicitado</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{START_DATE}} &rarr; {{END_DATE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;vertical-align:top;padding-top:8px;">Motivo</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;padding-top:8px;line-height:1.5;">{{REASON}}</td></tr>
    </table></td></tr></table>
    <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#2C2C2B;border-radius:10px;"><a href="{{APP_URL}}/rh/ferias" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Ver minha solicitação &rarr;</a></td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Em caso de dúvidas, fale com <strong style="color:#2C2C2B;">{{MANAGER_NAME}}</strong>.</p>`;
  return applyVars(shell(inner, "#E8920A"), vars);
}

function tplWelcome(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Bem-vindo(a) ao Grupo Sanwey!</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{EMPLOYEE_NAME}}</strong>! Estamos muito felizes em tê-la(o) como parte do time. Seu acesso à plataforma está pronto — explore os recursos e conte conosco nessa jornada.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="50%" style="padding:5px 0;font-size:13px;color:#8A8680;">Cargo</td><td width="50%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{JOB_TITLE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Departamento</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{DEPARTMENT}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Seu gestor</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{MANAGER_NAME}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Data de início</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{START_DATE}}</td></tr>
    </table></td></tr></table>
    <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C7212B;border-radius:10px;"><a href="{{APP_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Acessar minha conta &rarr;</a></td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Qualquer dúvida sobre integração ou acesso, fale com <strong style="color:#2C2C2B;">{{MANAGER_NAME}}</strong>.</p>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function tplCandidatoAprovado(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Parabéns! Você foi aprovado(a)</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{CANDIDATE_NAME}}</strong>! Temos ótimas notícias: sua candidatura foi selecionada e estamos felizes em convidá-la(o) a fazer parte do Grupo Sanwey.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="40%" style="padding:5px 0;font-size:13px;color:#8A8680;">Vaga</td><td width="60%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{JOB_TITLE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Departamento</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{DEPARTMENT}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;vertical-align:top;padding-top:8px;">Próximos passos</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;padding-top:8px;line-height:1.5;">{{NEXT_STEPS}}</td></tr>
    </table></td></tr></table>
    <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C7212B;border-radius:10px;"><a href="{{APP_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Ver detalhes &rarr;</a></td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Dúvidas? Entre em contato com <strong style="color:#2C2C2B;">{{CONTACT_NAME}}</strong> pelo e-mail <a href="mailto:{{CONTACT_EMAIL}}" style="color:#C7212B;text-decoration:none;">{{CONTACT_EMAIL}}</a>.</p>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function tplCandidatoReprovado(vars: Record<string, string>): string {
  // Enviado em BCC pra vários candidatos de uma vez — genérico (sem nome nem
  // vaga; o lote pode abranger várias vagas).
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Sobre seu processo seletivo</h1>
    <p style="margin:0 0 18px;font-size:15px;color:#8A8680;line-height:1.6;">Olá! Agradecemos muito o seu interesse em fazer parte do Grupo Sanwey e o tempo dedicado ao nosso processo seletivo.</p>
    <p style="margin:0 0 18px;font-size:15px;color:#8A8680;line-height:1.6;">Após uma análise cuidadosa, informamos que, neste momento, seguimos com outros candidatos cujo perfil se aproximou mais do que a posição exige. Essa decisão não diminui suas qualificações e experiências.</p>
    <p style="margin:0 0 18px;font-size:15px;color:#8A8680;line-height:1.6;">Seu currículo permanecerá em nosso banco de talentos e, surgindo uma oportunidade aderente ao seu perfil, entraremos em contato. Desejamos muito sucesso na sua trajetória profissional.</p>
    <p style="margin:0;font-size:15px;color:#2C2C2B;line-height:1.6;font-weight:600;">Equipe de Recrutamento &mdash; Grupo Sanwey</p>
    <div style="height:1px;background:#E5E0DA;margin:28px 0;"></div>
    <p style="margin:0;font-size:12px;color:#8A8680;line-height:1.6;">Este é um e-mail automático do processo seletivo. Por favor, não responda a esta mensagem.</p>`;
  return applyVars(shell(inner, "#8A8680"), vars);
}

function tplCandidaturaRecebida(vars: Record<string, string>): string {
  // Disparado pelo próprio formulário público de candidatura (sem login) —
  // achado da auditoria de fricção de 18/07: candidato enviava currículo e
  // não recebia nenhuma confirmação, só a tela do navegador.
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Recebemos sua candidatura!</h1>
    <p style="margin:0 0 18px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{CANDIDATE_NAME}}</strong>! Confirmamos o recebimento da sua candidatura pra vaga de <strong style="color:#2C2C2B;">{{VAGA_TITLE}}</strong> no Grupo Sanwey.</p>
    <p style="margin:0;font-size:15px;color:#8A8680;line-height:1.6;">Nosso time de RH vai analisar seu perfil com atenção e entraremos em contato caso haja fit com a posição. Agradecemos muito o seu interesse em fazer parte do nosso time!</p>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function tplVagaManagerLink(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Candidatos pra sua avaliação</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{MANAGER_NAME}}</strong>! O RH separou os candidatos da vaga <strong style="color:#2C2C2B;">{{VAGA_TITLE}}</strong> pra você avaliar e aprovar ou reprovar — não precisa de login, é só clicar no link abaixo e confirmar seu e-mail.</p>
    <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C7212B;border-radius:10px;"><a href="{{LINK_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Ver candidatos &rarr;</a></td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Este link expira em {{EXPIRES_DAYS}} dias e é de uso exclusivo seu — não encaminhe pra terceiros.</p>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function tplAvaliacaoProxima(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Avaliação de desempenho se aproximando</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá! A próxima avaliação de <strong style="color:#2C2C2B;">{{EMPLOYEE_NAME}}</strong> {{DUE_LABEL}}.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="40%" style="padding:5px 0;font-size:13px;color:#8A8680;">Cargo</td><td width="60%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{JOB_TITLE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Departamento</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{DEPARTMENT}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Tipo de ciclo</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{TIPO_CICLO}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Data prevista</td><td style="padding:5px 0;font-size:14px;color:#2C2C2B;font-weight:700;">{{DUE_DATE}}</td></tr>
    </table></td></tr></table>
    <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C7212B;border-radius:10px;"><a href="{{APP_URL}}/rh/avaliacao-de-desempenho" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Ver na plataforma &rarr;</a></td></tr></table>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function tplContratoFornecedorVencendo(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Contrato com fornecedor vencendo</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá! O contrato <strong style="color:#2C2C2B;">{{CONTRATO_TITULO}}</strong>, sob sua responsabilidade, {{DUE_LABEL}}.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="40%" style="padding:5px 0;font-size:13px;color:#8A8680;">Contrato</td><td width="60%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{CONTRATO_TITULO}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Fim da vigência</td><td style="padding:5px 0;font-size:14px;color:#2C2C2B;font-weight:700;">{{DUE_DATE}}</td></tr>
    </table></td></tr></table>
    <table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#C7212B;border-radius:10px;"><a href="{{APP_URL}}/rh/fornecedores" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Ver na plataforma &rarr;</a></td></tr></table>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function buildHtml(type: EmailType, vars: Record<string, string>): string {
  switch (type) {
    case "ferias_aprovadas":   return tplFeriasAprovadas(vars);
    case "ferias_rejeitadas":  return tplFeriasRejeitadas(vars);
    case "welcome":            return tplWelcome(vars);
    case "candidato_aprovado": return tplCandidatoAprovado(vars);
    case "candidato_reprovado":return tplCandidatoReprovado(vars);
    case "vaga_manager_link":  return tplVagaManagerLink(vars);
    case "candidatura_recebida": return tplCandidaturaRecebida(vars);
    case "avaliacao_proxima": return tplAvaliacaoProxima(vars);
    case "contrato_fornecedor_vencendo": return tplContratoFornecedorVencendo(vars);
  }
}

// ── Público: confirmação de candidatura ──────────────────────────────────────
// Disparado pelo próprio JobApplicationForm (sem login) — nunca aceita `to`/
// `variables` livres do cliente pra este tipo. Sempre re-deriva e-mail/nome/
// vaga do banco via vagaSlug+candidateId (usando o client service-role, que
// já ignora RLS), confirmando que o candidateId de fato se candidatou àquela
// vaga antes de disparar qualquer coisa — evita que a rota vire um relay de
// e-mail arbitrário só porque não exige JWT de usuário.
async function handlePublicCandidaturaRecebida(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<Response> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const noop = () => new Response(JSON.stringify({ success: true, sent: 0 }), { headers: jsonHeaders });

  const vagaSlug = typeof body.vagaSlug === "string" ? body.vagaSlug.trim() : "";
  const candidateId = typeof body.candidateId === "string" ? body.candidateId.trim() : "";
  if (!vagaSlug || !candidateId) {
    return new Response(JSON.stringify({ error: "vagaSlug e candidateId são obrigatórios" }), {
      status: 400, headers: jsonHeaders,
    });
  }

  const { data: vaga } = await supabase
    .from("rh_vagas")
    .select("id, title")
    .eq("link_slug", vagaSlug)
    .maybeSingle();
  if (!vaga) return noop();

  const { data: aplicacao } = await supabase
    .from("rh_aplicacoes")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("vaga_id", vaga.id)
    .maybeSingle();
  if (!aplicacao) return noop();

  const { data: candidato } = await supabase
    .from("rh_candidatos")
    .select("name, email")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidato?.email) return noop(); // e-mail é opcional na candidatura

  const html = buildHtml("candidatura_recebida", {
    CANDIDATE_NAME: candidato.name || "",
    VAGA_TITLE: vaga.title || "",
  });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[rh-send-email] RESEND_API_KEY não configurada. Confirmação de candidatura NÃO enviada.");
    return noop();
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "noreply@sanwey.com.br",
      to: candidato.email,
      subject: SUBJECTS.candidatura_recebida,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    console.error("[rh-send-email] Resend error (candidatura_recebida):", resendRes.status, errBody);
    // Não é motivo pra derrubar a candidatura em si — só loga e segue.
    return new Response(JSON.stringify({ success: false, sent: 0 }), { headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ success: true, sent: 1 }), { headers: jsonHeaders });
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse and validate body
    const body: SendEmailBody = await req.json();

    const validTypes: EmailType[] = [
      "ferias_aprovadas",
      "ferias_rejeitadas",
      "welcome",
      "candidato_aprovado",
      "candidato_reprovado",
      "vaga_manager_link",
      "candidatura_recebida",
      "avaliacao_proxima",
      "contrato_fornecedor_vencendo",
    ];

    if (!body?.type || !validTypes.includes(body.type)) {
      return new Response(
        JSON.stringify({ error: `'type' inválido. Use: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // "candidatura_recebida" é público — disparado pelo formulário de
    // candidatura sem login. Não passa pelo gate de JWT/role abaixo (ver
    // handlePublicCandidaturaRecebida pra como evita virar relay aberto).
    if (body.type === "candidatura_recebida") {
      return await handlePublicCandidaturaRecebida(supabase, body);
    }

    // Validate JWT — caller must be an authenticated Supabase user
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só RH/gerente_rh/admin podem disparar e-mail (evita relay de phishing a
    // partir do domínio da empresa). roles é array. Achado da 2ª auditoria.
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", userData.user.id)
      .maybeSingle();
    const callerRoles: string[] = Array.isArray(callerProfile?.roles) ? callerProfile.roles : [];
    if (!callerRoles.some((r) => ["rh", "gerente_rh", "admin"].includes(r))) {
      return new Response(JSON.stringify({ error: "Sem permissão para enviar e-mails de RH." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!body.to || !EMAIL_RE.test(body.to)) {
      return new Response(JSON.stringify({ error: "'to' deve ser um e-mail válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lote/BCC: valida e deduplica cada destinatário oculto.
    const bccList = Array.isArray(body.bcc)
      ? [...new Set(body.bcc.filter((e) => typeof e === "string" && EMAIL_RE.test(e)))]
      : [];

    const variables = body.variables || {};
    const subject   = SUBJECTS[body.type];
    const html      = buildHtml(body.type, variables);

    const resendKey = Deno.env.get("RESEND_API_KEY");

    // O Resend limita ~50 destinatários por chamada — quebra o BCC em blocos.
    const CHUNK = 45;
    const bccChunks: string[][] = [];
    for (let i = 0; i < bccList.length; i += CHUNK) bccChunks.push(bccList.slice(i, i + CHUNK));
    // Ao menos uma "rodada" mesmo sem BCC (envio simples pro `to`).
    if (bccChunks.length === 0) bccChunks.push([]);

    if (resendKey) {
      for (const chunk of bccChunks) {
        const payload: Record<string, unknown> = {
          from: "noreply@sanwey.com.br",
          to:   body.to,
          subject,
          html,
        };
        if (chunk.length > 0) payload.bcc = chunk;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          console.error("[rh-send-email] Resend error:", resendRes.status, errBody);
          return new Response(
            JSON.stringify({ error: `Falha ao enviar e-mail: ${resendRes.status}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const resendData = await resendRes.json();
        console.log("[rh-send-email] Sent via Resend:", resendData?.id, "bcc:", chunk.length);
      }
    } else {
      // Fallback: log only (no RESEND_API_KEY configured)
      console.warn(
        "[rh-send-email] RESEND_API_KEY não configurada. E-mail NÃO enviado.",
        { type: body.type, to: body.to, bcc: bccList.length, subject },
      );
    }

    return new Response(JSON.stringify({ success: true, sent: bccList.length || 1 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[rh-send-email] Unhandled error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
