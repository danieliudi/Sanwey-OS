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
  | "contrato_fornecedor_vencendo"
  | "bemestar_confirmado"
  | "bemestar_lembrete"
  | "comunicado";

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
  // público, sem login) — ver handlePublicCandidaturaRecebida. `candidateId`
  // também é reaproveitado por "candidato_aprovado" (autenticado) — ver
  // hardenCandidatoAprovado.
  vagaSlug?: string;
  candidateId?: string;
  // Usado por "bemestar_confirmado" (público, sem login — ver
  // handlePublicBemEstarConfirmado) E por "bemestar_lembrete" (autenticado —
  // ver hardenBemEstarLembrete): mesma tabela (rh_bemestar_fila), mesmo id.
  agendamentoId?: string;
  // Auditoria de segurança de 08/08/2026: os campos abaixo re-derivam
  // destinatário/identidade do banco pros tipos que antes confiavam 100% em
  // `to`/`variables` do client — ver hardenX() logo acima do handler
  // principal. Cada um é obrigatório apenas para o tipo correspondente.
  feriasRequestId?: string;   // ferias_aprovadas / ferias_rejeitadas → rh_ferias.id
  profileId?: string;         // welcome → profiles.id
  aplicacaoIds?: string[];    // candidato_reprovado (lote) → rh_aplicacoes.id[]
  managerLinkId?: string;     // vaga_manager_link → rh_vaga_manager_links.id
  colaboradorId?: string;     // avaliacao_proxima → rh_colaboradores.id
  contratoId?: string;        // contrato_fornecedor_vencendo → rh_fornecedor_contratos.id
  comunicadoId?: string;      // comunicado → rh_comunicados.id
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
  bemestar_confirmado: "Agendamento confirmado — Grupo Sanwey",
  bemestar_lembrete:   "Seu horário de bem-estar está chegando — Grupo Sanwey",
  // Comunicado é o único tipo com assunto variável: quem lê precisa ver o
  // título do comunicado na caixa de entrada, não um rótulo genérico. Este
  // valor existe só pra satisfazer o Record<EmailType, string> — o envio
  // real usa o título do registro (ver handleComunicado).
  comunicado:          "Comunicado interno — Grupo Sanwey",
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

function tplBemEstarConfirmado(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Agendamento confirmado ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{NOME}}</strong>! Seu horário em <strong style="color:#2C2C2B;">{{SESSAO_TITULO}}</strong> está reservado.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="40%" style="padding:5px 0;font-size:13px;color:#8A8680;">Data</td><td width="60%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{DATA}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Horário</td><td style="padding:5px 0;font-size:14px;color:#2C2C2B;font-weight:700;">{{HORARIO}}</td></tr>
    </table></td></tr></table>
    <p style="margin:0;font-size:13px;color:#8A8680;line-height:1.5;">Chegue com alguns minutos de antecedência. Vamos te avisar de novo quando o horário estiver próximo.</p>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

function tplBemEstarLembrete(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Seu horário está chegando</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{NOME}}</strong>! Seu horário em <strong style="color:#2C2C2B;">{{SESSAO_TITULO}}</strong> é às <strong style="color:#2C2C2B;">{{HORARIO}}</strong> — está chegando a hora.</p>
    <p style="margin:0;font-size:13px;color:#8A8680;line-height:1.5;">Fique por perto do local combinado.</p>`;
  return applyVars(shell(inner, "#C7212B"), vars);
}

// Comunicado interno. Único template que NÃO passa por applyVars: o corpo vem
// de um textarea livre do RH, e as quebras de linha que a pessoa digitou
// precisam virar <br> pra não chegar tudo grudado. Por isso o escape é feito
// aqui, à mão, ANTES de injetar o <br> — que fica sendo a única tag que
// sobrevive no corpo. Texto colado de qualquer lugar não vira HTML.
function tplComunicado(vars: Record<string, string>): string {
  const titulo     = escapeHtml(vars.TITULO || "");
  const corpo      = escapeHtml(vars.CORPO || "").replace(/\r?\n/g, "<br />");
  const importante = vars.IMPORTANTE === "1";
  const selo = importante
    ? `<div style="display:inline-block;background:#FDF3E2;color:#9A6205;border:1px solid #F0D9A8;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:16px;">Importante</div>`
    : "";
  const inner = `${selo}
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">${titulo}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#2C2C2B;line-height:1.7;">${corpo}</p>
    <p style="margin:0;font-size:13px;color:#8A8680;line-height:1.5;">Este comunicado também está no sino de notificações da plataforma.</p>`;
  return shell(inner, importante ? "#E8920A" : "#C7212B");
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
    case "bemestar_confirmado": return tplBemEstarConfirmado(vars);
    case "bemestar_lembrete": return tplBemEstarLembrete(vars);
    case "comunicado": return tplComunicado(vars);
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

// Disparado pelo próprio formulário público de agendamento de bem-estar (sem
// login) — mesmo cuidado de handlePublicCandidaturaRecebida: nunca aceita
// `to` livre do cliente, sempre re-deriva e-mail/nome/horário do banco via
// agendamentoId (client service-role, ignora RLS).
async function handlePublicBemEstarConfirmado(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<Response> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const noop = () => new Response(JSON.stringify({ success: true, sent: 0 }), { headers: jsonHeaders });

  const agendamentoId = typeof body.agendamentoId === "string" ? body.agendamentoId.trim() : "";
  if (!agendamentoId) {
    return new Response(JSON.stringify({ error: "agendamentoId é obrigatório" }), { status: 400, headers: jsonHeaders });
  }

  const { data: agendamento } = await supabase
    .from("rh_bemestar_fila")
    .select("nome, email, horario, sessao_id")
    .eq("id", agendamentoId)
    .maybeSingle();
  if (!agendamento?.email) return noop(); // e-mail é opcional no agendamento

  const { data: sessao } = await supabase
    .from("rh_bemestar_sessoes")
    .select("titulo, data")
    .eq("id", agendamento.sessao_id)
    .maybeSingle();
  if (!sessao) return noop();

  const html = buildHtml("bemestar_confirmado", {
    NOME: agendamento.nome || "",
    SESSAO_TITULO: sessao.titulo || "",
    DATA: sessao.data ? new Date(sessao.data + "T00:00:00").toLocaleDateString("pt-BR") : "—",
    HORARIO: (agendamento.horario || "").slice(0, 5),
  });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[rh-send-email] RESEND_API_KEY não configurada. Confirmação de bem-estar NÃO enviada.");
    return noop();
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "noreply@sanwey.com.br",
      to: agendamento.email,
      subject: SUBJECTS.bemestar_confirmado,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    console.error("[rh-send-email] Resend error (bemestar_confirmado):", resendRes.status, errBody);
    return new Response(JSON.stringify({ success: false, sent: 0 }), { headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ success: true, sent: 1 }), { headers: jsonHeaders });
}

// ── Derivação obrigatória de destinatário/identidade a partir do banco ────────
// Achado de segurança (08/08/2026): os 9 tipos abaixo passavam `to`/
// `variables` do client direto pro Resend sem checar contra o registro real
// — qualquer rh/gerente_rh/admin conseguia mandar e-mail com a cara oficial
// do Grupo Sanwey pra QUALQUER endereço, com conteúdo arbitrário. Cada
// hardenX() aqui resolve o `to` (e o máximo praticável de `variables`) a
// partir de um id de registro, nunca do valor cru do body — ver
// handlePublicCandidaturaRecebida/handlePublicBemEstarConfirmado acima pro
// mesmo princípio já aplicado às rotas públicas.

const DEFAULT_APP_URL = "https://sanwey-crm.netlify.app";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ferias: "Férias",
  licenca_medica: "Licença Médica",
  licenca_maternidade: "Licença Maternidade",
  licenca_paternidade: "Licença Paternidade",
  folga: "Folga Compensatória",
  luto: "Licença Luto",
  outros: "Outros",
};

function fmtDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

type HardenResult =
  | { to: string; bcc?: string[]; variables: Record<string, string> }
  | { error: string };

async function hardenFerias(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
  expectStatus: "aprovado" | "recusado",
  callerName: string,
): Promise<HardenResult> {
  const feriasRequestId = typeof body.feriasRequestId === "string" ? body.feriasRequestId.trim() : "";
  if (!feriasRequestId) return { error: "feriasRequestId é obrigatório para este tipo de e-mail." };

  const { data: req } = await supabase
    .from("rh_ferias")
    .select("user_id, type, start_date, end_date, status, approved_by")
    .eq("id", feriasRequestId)
    .maybeSingle();
  if (!req) return { error: "Solicitação de férias não encontrada." };
  if (req.status !== expectStatus) {
    return { error: `Solicitação não está no status esperado ("${expectStatus}") — e-mail não enviado.` };
  }

  const { data: colaborador } = await supabase
    .from("rh_colaboradores")
    .select("full_name, email, profile_id")
    .eq("id", req.user_id)
    .maybeSingle();
  let toEmail: string | null = colaborador?.email || null;
  if (!toEmail && colaborador?.profile_id) {
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", colaborador.profile_id).maybeSingle();
    toEmail = profile?.email || null;
  }
  if (!toEmail) return { error: "Colaborador não encontrado ou sem e-mail cadastrado." };

  const days = req.start_date && req.end_date
    ? Math.max(0, Math.round((new Date(req.end_date).getTime() - new Date(req.start_date).getTime()) / 86400000) + 1)
    : 0;

  const variables: Record<string, string> = {
    EMPLOYEE_NAME: colaborador?.full_name || "",
    LEAVE_TYPE: LEAVE_TYPE_LABELS[req.type as string] || req.type || "—",
    START_DATE: fmtDateBR(req.start_date),
    END_DATE: fmtDateBR(req.end_date),
    DAYS_COUNT: String(days),
    APP_URL: typeof body.variables?.APP_URL === "string" ? body.variables.APP_URL : DEFAULT_APP_URL,
  };

  if (expectStatus === "aprovado") {
    let approvedByName = callerName;
    if (req.approved_by) {
      const { data: approver } = await supabase.from("profiles").select("name, email").eq("id", req.approved_by).maybeSingle();
      approvedByName = approver?.name || approver?.email || callerName;
    }
    variables.APPROVED_BY = approvedByName;
  } else {
    // MOTIVO é texto livre digitado pelo próprio gestor autenticado nesta
    // ação (não é identidade de terceiro) — segue confiável do client.
    // MANAGER_NAME, por sinalizar QUEM recusou, vem de quem está logado.
    variables.MANAGER_NAME = callerName;
    variables.REASON = typeof body.variables?.REASON === "string" ? body.variables.REASON : "";
  }

  return { to: toEmail, variables };
}

async function hardenWelcome(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<HardenResult> {
  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : "";
  if (!profileId) return { error: "profileId é obrigatório para este tipo de e-mail." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, job_title, department, admission_date")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile?.email) return { error: "Colaborador não encontrado ou sem e-mail cadastrado." };

  return {
    to: profile.email,
    variables: {
      EMPLOYEE_NAME: profile.name || profile.email,
      JOB_TITLE: profile.job_title || "—",
      DEPARTMENT: profile.department || "—",
      MANAGER_NAME: "RH Grupo Sanwey",
      START_DATE: fmtDateBR(profile.admission_date),
      APP_URL: typeof body.variables?.APP_URL === "string" ? body.variables.APP_URL : DEFAULT_APP_URL,
    },
  };
}

async function hardenCandidatoAprovado(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
  callerName: string,
  callerEmail: string,
): Promise<HardenResult> {
  const candidateId = typeof body.candidateId === "string" ? body.candidateId.trim() : "";
  if (!candidateId) return { error: "candidateId é obrigatório para este tipo de e-mail." };

  const { data: candidato } = await supabase
    .from("rh_candidatos")
    .select("name, email, vaga_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidato?.email) return { error: "Candidato não encontrado ou sem e-mail cadastrado." };

  let vagaTitle = "—";
  let vagaDept = "—";
  if (candidato.vaga_id) {
    const { data: vaga } = await supabase.from("rh_vagas").select("title, department").eq("id", candidato.vaga_id).maybeSingle();
    vagaTitle = vaga?.title || "—";
    vagaDept = vaga?.department || "—";
  }

  return {
    to: candidato.email,
    variables: {
      CANDIDATE_NAME: candidato.name || "",
      JOB_TITLE: vagaTitle,
      DEPARTMENT: vagaDept,
      // Texto livre não identifica terceiro — confiável do client.
      NEXT_STEPS: typeof body.variables?.NEXT_STEPS === "string" ? body.variables.NEXT_STEPS : "",
      // Quem contatar é sempre quem está logado disparando o e-mail, nunca
      // um nome/e-mail arbitrário do body.
      CONTACT_NAME: callerName,
      CONTACT_EMAIL: callerEmail,
    },
  };
}

async function hardenCandidatoReprovado(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<HardenResult> {
  const ids = Array.isArray(body.aplicacaoIds)
    ? [...new Set(body.aplicacaoIds.filter((x) => typeof x === "string" && x))]
    : [];
  if (!ids.length) return { error: "aplicacaoIds é obrigatório (lista não vazia) para este tipo de e-mail." };

  const { data: aplicacoes } = await supabase.from("rh_aplicacoes").select("candidate_id").in("id", ids);
  const candidateIds = [...new Set((aplicacoes || []).map((a) => a.candidate_id).filter(Boolean))];
  if (!candidateIds.length) return { error: "Nenhuma aplicação válida encontrada pra esses ids." };

  const { data: candidatos } = await supabase.from("rh_candidatos").select("email").in("id", candidateIds);
  const bcc = [...new Set((candidatos || []).map((c) => c.email).filter(Boolean))] as string[];
  if (!bcc.length) return { error: "Nenhum candidato com e-mail cadastrado nesse lote." };

  // `to` sempre o próprio remetente (mesmo padrão de antes) — nunca vindo do
  // client; o BCC real é 100% derivado das aplicações, não do array que o
  // client mandar.
  return { to: "noreply@sanwey.com.br", bcc, variables: {} };
}

async function hardenVagaManagerLink(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<HardenResult> {
  const managerLinkId = typeof body.managerLinkId === "string" ? body.managerLinkId.trim() : "";
  if (!managerLinkId) return { error: "managerLinkId é obrigatório para este tipo de e-mail." };

  const { data: link } = await supabase
    .from("rh_vaga_manager_links")
    .select("vaga_id, manager_name, manager_email, token, expires_at, revoked_at")
    .eq("id", managerLinkId)
    .maybeSingle();
  if (!link?.manager_email) return { error: "Link de gestor não encontrado." };
  if (link.revoked_at) return { error: "Link de gestor já foi revogado." };

  let vagaTitle = "—";
  if (link.vaga_id) {
    const { data: vaga } = await supabase.from("rh_vagas").select("title").eq("id", link.vaga_id).maybeSingle();
    vagaTitle = vaga?.title || "—";
  }

  const expiresDays = link.expires_at
    ? Math.max(0, Math.ceil((new Date(link.expires_at).getTime() - Date.now()) / 86400000))
    : 7;

  return {
    to: link.manager_email,
    variables: {
      MANAGER_NAME: link.manager_name || "",
      VAGA_TITLE: vagaTitle,
      // LINK_URL é o "bearer token" de acesso sem login — NUNCA aceito do
      // client (seria o vetor de phishing mais óbvio pra esse tipo). Sempre
      // reconstruído a partir do token real na tabela.
      LINK_URL: `${DEFAULT_APP_URL}/gestor-vaga/${link.token}`,
      EXPIRES_DAYS: String(expiresDays),
    },
  };
}

async function hardenAvaliacaoProxima(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<HardenResult> {
  const colaboradorId = typeof body.colaboradorId === "string" ? body.colaboradorId.trim() : "";
  if (!colaboradorId) return { error: "colaboradorId é obrigatório para este tipo de e-mail." };

  const { data: colaborador } = await supabase
    .from("rh_colaboradores")
    .select("full_name, job_title, department")
    .eq("id", colaboradorId)
    .maybeSingle();
  if (!colaborador) return { error: "Colaborador não encontrado." };

  // Diferente dos outros tipos, o destinatário aqui não é UM registro — é
  // escolhido entre N gerente_rh/admin elegíveis a receber o lembrete (ver
  // App.jsx, loop sobre `destinatarios`). Sem um id de registro único pra
  // amarrar o `to`, a mitigação é validar-e-rejeitar: `to` só passa se for
  // o e-mail de um profile com papel gerente_rh/admin — fecha a via de
  // mandar pra endereço externo arbitrário, mesmo sem eliminar 100% a
  // liberdade de "pra qual desses admins".
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to) return { error: "'to' é obrigatório." };
  const { data: destProfile } = await supabase.from("profiles").select("roles").eq("email", to).maybeSingle();
  const destRoles: string[] = Array.isArray(destProfile?.roles) ? destProfile.roles : [];
  if (!destProfile || !destRoles.some((r) => ["gerente_rh", "admin"].includes(r))) {
    return { error: "'to' precisa ser o e-mail de um usuário com papel gerente_rh/admin." };
  }

  return {
    to,
    variables: {
      EMPLOYEE_NAME: colaborador.full_name || "",
      JOB_TITLE: colaborador.job_title || "—",
      DEPARTMENT: colaborador.department || "—",
      // TIPO_CICLO/DUE_DATE/DUE_LABEL continuam vindo do client: são uma
      // PROJEÇÃO calculada em App.jsx (avaliacaoDiasParaProxima) — nesse
      // momento não existe linha em rh_feedback pra re-derivar server-side
      // sem duplicar essa lógica de negócio aqui. Risco residual (deixado
      // documentado, não corrigido por completo — ver relatório).
      TIPO_CICLO: typeof body.variables?.TIPO_CICLO === "string" ? body.variables.TIPO_CICLO : "",
      DUE_DATE: typeof body.variables?.DUE_DATE === "string" ? body.variables.DUE_DATE : "",
      DUE_LABEL: typeof body.variables?.DUE_LABEL === "string" ? body.variables.DUE_LABEL : "",
    },
  };
}

async function hardenContratoVencendo(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<HardenResult> {
  const contratoId = typeof body.contratoId === "string" ? body.contratoId.trim() : "";
  if (!contratoId) return { error: "contratoId é obrigatório para este tipo de e-mail." };

  const { data: contrato } = await supabase
    .from("rh_fornecedor_contratos")
    .select("titulo, vigencia_fim, responsavel_id")
    .eq("id", contratoId)
    .maybeSingle();
  if (!contrato) return { error: "Contrato não encontrado." };
  if (!contrato.responsavel_id) return { error: "Contrato sem responsável cadastrado." };

  const { data: responsavel } = await supabase.from("profiles").select("email").eq("id", contrato.responsavel_id).maybeSingle();
  if (!responsavel?.email) return { error: "Responsável pelo contrato sem e-mail cadastrado." };

  const dias = contrato.vigencia_fim
    ? Math.round((new Date(`${contrato.vigencia_fim}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
    : null;
  const dueLabel = dias == null ? "" : dias < 0 ? `venceu há ${Math.abs(dias)} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`;

  return {
    to: responsavel.email,
    variables: {
      CONTRATO_TITULO: contrato.titulo || "",
      DUE_DATE: fmtDateBR(contrato.vigencia_fim),
      DUE_LABEL: dueLabel,
    },
  };
}

async function hardenBemEstarLembrete(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
): Promise<HardenResult> {
  const agendamentoId = typeof body.agendamentoId === "string" ? body.agendamentoId.trim() : "";
  if (!agendamentoId) return { error: "agendamentoId é obrigatório para este tipo de e-mail." };

  const { data: agendamento } = await supabase
    .from("rh_bemestar_fila")
    .select("nome, email, horario, sessao_id")
    .eq("id", agendamentoId)
    .maybeSingle();
  if (!agendamento?.email) return { error: "Agendamento não encontrado ou sem e-mail cadastrado." };

  let sessaoTitulo = "—";
  if (agendamento.sessao_id) {
    const { data: sessao } = await supabase.from("rh_bemestar_sessoes").select("titulo").eq("id", agendamento.sessao_id).maybeSingle();
    sessaoTitulo = sessao?.titulo || "—";
  }

  return {
    to: agendamento.email,
    variables: {
      NOME: agendamento.nome || "",
      SESSAO_TITULO: sessaoTitulo,
      HORARIO: (agendamento.horario || "").slice(0, 5),
    },
  };
}

// ── Envio ────────────────────────────────────────────────────────────────────

// O loop de envio (blocos de BCC + chamada ao Resend + fallback sem chave)
// estava inline no handler principal. Foi extraído porque o comunicado é o
// segundo chamador — e a alternativa era a 2ª cópia da mesma quebra em blocos,
// que é exatamente como as duas divergem depois (regra 1/4 do CLAUDE.md).
// Devolve ok/erro em vez de uma Response: o comunicado precisa gravar o status
// no banco ANTES de responder, o handler genérico não.
async function enviarViaResend(
  { to, bcc, subject, html, tipo }:
  { to: string; bcc: string[]; subject: string; html: string; tipo: string },
): Promise<{ ok: true; enviados: number; simulado: boolean } | { ok: false; error: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");

  // O Resend limita ~50 destinatários por chamada — quebra o BCC em blocos.
  const CHUNK = 45;
  const bccChunks: string[][] = [];
  for (let i = 0; i < bcc.length; i += CHUNK) bccChunks.push(bcc.slice(i, i + CHUNK));
  // Ao menos uma "rodada" mesmo sem BCC (envio simples pro `to`).
  if (bccChunks.length === 0) bccChunks.push([]);

  if (!resendKey) {
    // Fallback: log only (no RESEND_API_KEY configured)
    console.warn(
      "[rh-send-email] RESEND_API_KEY não configurada. E-mail NÃO enviado.",
      { type: tipo, to, bcc: bcc.length, subject },
    );
    // `simulado` existe pra quem grava o resultado no banco não registrar
    // "enviado" quando nada saiu — ver handleComunicado.
    return { ok: true, enviados: 0, simulado: true };
  }

  for (const chunk of bccChunks) {
    const payload: Record<string, unknown> = { from: "noreply@sanwey.com.br", to, subject, html };
    if (chunk.length > 0) payload.bcc = chunk;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("[rh-send-email] Resend error:", resendRes.status, errBody);
      return { ok: false, error: `Falha ao enviar e-mail: ${resendRes.status}` };
    }

    const resendData = await resendRes.json();
    console.log("[rh-send-email] Sent via Resend:", resendData?.id, "bcc:", chunk.length);
  }
  return { ok: true, enviados: bcc.length || 1, simulado: false };
}

// ── Comunicado interno por e-mail ────────────────────────────────────────────
//
// Tipo autenticado, mas com caminho próprio em vez de um hardenX(): ele é o
// único que precisa de assunto variável (o título do comunicado, pra caixa de
// entrada não mostrar rótulo genérico) e que grava o resultado do envio de
// volta no banco. Segue o mesmo princípio dos hardenX(), que é o que importa:
// o client manda SÓ o id do registro; destinatário, título e corpo são
// re-derivados aqui, com service_role. O client não escolhe quem recebe.
async function handleComunicado(
  supabase: ReturnType<typeof createClient>,
  body: SendEmailBody,
  callerRoles: string[],
): Promise<Response> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const falha = (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: jsonHeaders });

  // Mais restrito que o gate geral da função (que aceita `rh` simples): espelha
  // exatamente quem broadcast_announcement deixa enviar. Se divergisse, alguém
  // com `rh` não conseguiria criar o comunicado mas conseguiria mandar o e-mail
  // de um comunicado alheio.
  if (!callerRoles.some((r) => ["gerente_rh", "admin"].includes(r))) {
    return falha("Só RH gerencial ou admin pode enviar comunicado por e-mail.", 403);
  }

  const comunicadoId = typeof body.comunicadoId === "string" ? body.comunicadoId.trim() : "";
  if (!comunicadoId) return falha("comunicadoId é obrigatório para este tipo de e-mail.", 400);

  const { data: com } = await supabase
    .from("rh_comunicados")
    .select("id, titulo, corpo, scope_type, scope_value, importante, canais, enviado_por, email_status")
    .eq("id", comunicadoId)
    .maybeSingle();
  if (!com) return falha("Comunicado não encontrado.", 404);

  const canais: string[] = Array.isArray(com.canais) ? com.canais : [];
  if (!canais.includes("email")) return falha("Esse comunicado não pediu envio por e-mail.", 400);
  // Idempotente: reenviar o mesmo comunicado é erro operacional caro (todo
  // mundo recebe duas vezes), então repetir a chamada não faz nada.
  if (com.email_status === "enviado") {
    return new Response(JSON.stringify({ success: true, sent: 0, ja_enviado: true }), { headers: jsonHeaders });
  }

  const { data: dests, error: destErr } = await supabase.rpc("comunicado_destinatarios", {
    p_scope_type: com.scope_type,
    p_scope_value: com.scope_value,
    p_excluir: com.enviado_por,
  });
  if (destErr) return falha(`Não foi possível montar a lista de destinatários: ${destErr.message}`, 500);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const bcc = [...new Set(
    (dests || [])
      .map((d: { email?: string | null }) => (d.email || "").trim())
      .filter((e: string) => EMAIL_RE.test(e)),
  )] as string[];

  if (!bcc.length) {
    await supabase.from("rh_comunicados")
      .update({ email_status: "falhou", email_erro: "Nenhum destinatário do escopo tem e-mail cadastrado." })
      .eq("id", comunicadoId);
    return falha("Nenhum destinatário do escopo tem e-mail cadastrado.", 400);
  }

  // Marca ANTES de chamar o Resend, e só a partir de 'pendente'/'falhou': dois
  // cliques rápidos no botão viram uma tentativa só. A troca é consciente — se
  // a função morrer entre esta linha e o envio, o comunicado fica marcado como
  // enviado sem ter saído, e o RH reenvia a partir de um comunicado novo.
  // Mandar dois e-mails pra empresa inteira é o erro mais caro dos dois.
  const { data: claim } = await supabase
    .from("rh_comunicados")
    .update({ email_status: "enviado", email_erro: null })
    .eq("id", comunicadoId)
    .in("email_status", ["pendente", "falhou"])
    .select("id");
  if (!claim || claim.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0, ja_enviado: true }), { headers: jsonHeaders });
  }

  const html = buildHtml("comunicado", {
    TITULO: com.titulo || "",
    CORPO: com.corpo || "",
    IMPORTANTE: com.importante ? "1" : "0",
  });

  const envio = await enviarViaResend({
    to: "noreply@sanwey.com.br",   // destinatários reais vão só em BCC — ninguém vê a lista
    bcc,
    subject: `${com.titulo} — Grupo Sanwey`,
    html,
    tipo: "comunicado",
  });

  if (!envio.ok) {
    await supabase.from("rh_comunicados")
      .update({ email_status: "falhou", email_erro: envio.error })
      .eq("id", comunicadoId);
    return falha(envio.error, 500);
  }

  // Sem RESEND_API_KEY o envio é simulado (só log). Desfaz a marca de
  // "enviado": senão o histórico do RH diria que o comunicado saiu por e-mail
  // pra N pessoas quando não saiu pra ninguém — número que mente é pior que
  // número que falta (regra 14).
  if (envio.simulado) {
    const erro = "E-mail não configurado no servidor (RESEND_API_KEY ausente) — nada foi enviado.";
    await supabase.from("rh_comunicados")
      .update({ email_status: "falhou", email_erro: erro, alcance_email: 0 })
      .eq("id", comunicadoId);
    return falha(erro, 500);
  }

  // Regra 14: o alcance gravado é o MEDIDO no envio, não a prévia calculada na
  // hora de criar o comunicado — entre as duas pode ter entrado ou saído gente.
  await supabase.from("rh_comunicados")
    .update({ alcance_email: bcc.length })
    .eq("id", comunicadoId);

  return new Response(JSON.stringify({ success: true, sent: bcc.length }), { headers: jsonHeaders });
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
      "bemestar_confirmado",
      "bemestar_lembrete",
      "comunicado",
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

    // "candidatura_recebida" e "bemestar_confirmado" são públicos —
    // disparados pelos próprios formulários sem login. Não passam pelo gate
    // de JWT/role abaixo (ver handlePublicCandidaturaRecebida/
    // handlePublicBemEstarConfirmado pra como evitam virar relay aberto).
    if (body.type === "candidatura_recebida") {
      return await handlePublicCandidaturaRecebida(supabase, body);
    }
    if (body.type === "bemestar_confirmado") {
      return await handlePublicBemEstarConfirmado(supabase, body);
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
      .select("roles, name, email")
      .eq("id", userData.user.id)
      .maybeSingle();
    const callerRoles: string[] = Array.isArray(callerProfile?.roles) ? callerProfile.roles : [];
    if (!callerRoles.some((r) => ["rh", "gerente_rh", "admin"].includes(r))) {
      return new Response(JSON.stringify({ error: "Sem permissão para enviar e-mails de RH." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Os 9 tipos "genéricos" (tudo que não é candidatura_recebida/
    // bemestar_confirmado, tratados acima como público) tinham `to`/
    // `variables` confiados 100% do client — achado de segurança de
    // 08/08/2026. Cada um agora resolve `to`/`variables`/`bcc` a partir de
    // um id de registro (ver hardenX() acima), sobrescrevendo o que veio no
    // body antes de seguir pro envio genérico abaixo. `avaliacao_proxima` é
    // o único sem 100% de amarração no destinatário — ver comentário em
    // hardenAvaliacaoProxima.
    if (body.type === "comunicado") {
      return await handleComunicado(supabase, body, callerRoles);
    }

    const HARDENED_TYPES: EmailType[] = [
      "ferias_aprovadas", "ferias_rejeitadas", "welcome", "candidato_aprovado",
      "candidato_reprovado", "vaga_manager_link", "avaliacao_proxima",
      "contrato_fornecedor_vencendo", "bemestar_lembrete",
    ];
    if (HARDENED_TYPES.includes(body.type)) {
      const callerName = callerProfile?.name || callerProfile?.email || userData.user.email || "";
      const callerEmail = callerProfile?.email || userData.user.email || "";
      let hardened: HardenResult;
      switch (body.type) {
        case "ferias_aprovadas":  hardened = await hardenFerias(supabase, body, "aprovado", callerName); break;
        case "ferias_rejeitadas": hardened = await hardenFerias(supabase, body, "recusado", callerName); break;
        case "welcome":           hardened = await hardenWelcome(supabase, body); break;
        case "candidato_aprovado":  hardened = await hardenCandidatoAprovado(supabase, body, callerName, callerEmail); break;
        case "candidato_reprovado": hardened = await hardenCandidatoReprovado(supabase, body); break;
        case "vaga_manager_link":   hardened = await hardenVagaManagerLink(supabase, body); break;
        case "avaliacao_proxima":   hardened = await hardenAvaliacaoProxima(supabase, body); break;
        case "contrato_fornecedor_vencendo": hardened = await hardenContratoVencendo(supabase, body); break;
        case "bemestar_lembrete":   hardened = await hardenBemEstarLembrete(supabase, body); break;
        default: hardened = { error: "Tipo não suportado." };
      }
      if ("error" in hardened) {
        return new Response(JSON.stringify({ error: hardened.error }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      body.to = hardened.to;
      body.variables = hardened.variables;
      // Zera qualquer bcc que o client tenha mandado pra um tipo que não é
      // de lote — só candidato_reprovado (via hardenCandidatoReprovado)
      // devolve um bcc, e é 100% derivado do banco, nunca do client.
      body.bcc = hardened.bcc;
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

    const envio = await enviarViaResend({ to: body.to, bcc: bccList, subject, html, tipo: body.type });
    if (!envio.ok) {
      return new Response(JSON.stringify({ error: envio.error }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
