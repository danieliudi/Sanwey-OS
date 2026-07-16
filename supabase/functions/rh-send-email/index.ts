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
  | "vaga_manager_link";

interface SendEmailBody {
  type: EmailType;
  to: string;
  variables: Record<string, string>;
}

// ── Subjects ──────────────────────────────────────────────────────────────────

const SUBJECTS: Record<EmailType, string> = {
  ferias_aprovadas:    "Suas férias foram aprovadas — Grupo Sanwey",
  ferias_rejeitadas:   "Sobre sua solicitação de férias — Grupo Sanwey",
  welcome:             "Bem-vindo(a) ao Grupo Sanwey!",
  candidato_aprovado:  "Parabéns! Sua candidatura foi aprovada — Grupo Sanwey",
  vaga_manager_link:   "Candidatos pra sua avaliação — Grupo Sanwey",
};

// ── Template builders ─────────────────────────────────────────────────────────

// Escapa HTML dos valores antes de injetar no template — sem isso, uma
// variável (ex: nome do candidato) podia carregar markup/links de phishing
// direto no corpo do e-mail. Achado da 2ª auditoria.
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

function tplFeriasAprovadas(vars: Record<string, string>): string {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Férias aprovadas — Grupo Sanwey</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
              <div style="width:36px;height:3px;background:#C7212B;border-radius:2px;margin-bottom:28px;"></div>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Suas férias foram aprovadas ✓</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">
                Olá, <strong style="color:#2C2C2B;">{{EMPLOYEE_NAME}}</strong>. Sua solicitação de afastamento foi aprovada com sucesso.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding:5px 0;font-size:13px;color:#8A8680;">Tipo de licença</td>
                        <td width="50%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{LEAVE_TYPE}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Início</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{START_DATE}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Término</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{END_DATE}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Total de dias</td>
                        <td style="padding:5px 0;font-size:14px;color:#2C2C2B;font-weight:700;">{{DAYS_COUNT}} dias</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#C7212B;border-radius:10px;">
                    <a href="{{APP_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.01em;">Acessar plataforma &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Aprovado por <strong style="color:#2C2C2B;">{{APPROVED_BY}}</strong>.</p>
              <div style="height:1px;background:#E5E0DA;margin:28px 0;"></div>
              <p style="margin:0;font-size:12px;color:#8A8680;line-height:1.6;">
                Se o botão não funcionar, copie e cole o endereço abaixo no navegador:<br/>
                <a href="{{APP_URL}}" style="color:#C7212B;word-break:break-all;font-size:12px;">{{APP_URL}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#8A8680;line-height:1.6;">&copy; Grupo Sanwey &mdash; Commercial Intelligence Platform</p>
              <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do sistema de RH.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return applyVars(html, vars);
}

function tplFeriasRejeitadas(vars: Record<string, string>): string {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Solicitação de férias — Grupo Sanwey</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
              <div style="width:36px;height:3px;background:#E8920A;border-radius:2px;margin-bottom:28px;"></div>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Solicitação de férias não aprovada</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">
                Olá, <strong style="color:#2C2C2B;">{{EMPLOYEE_NAME}}</strong>. Infelizmente sua solicitação de afastamento não pôde ser aprovada no momento.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding:5px 0;font-size:13px;color:#8A8680;">Tipo de licença</td>
                        <td width="50%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{LEAVE_TYPE}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Período solicitado</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{START_DATE}} &rarr; {{END_DATE}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;vertical-align:top;padding-top:8px;">Motivo</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;padding-top:8px;line-height:1.5;">{{REASON}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#2C2C2B;border-radius:10px;">
                    <a href="{{APP_URL}}/rh/ferias" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.01em;">Ver minha solicitação &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Em caso de dúvidas, fale com <strong style="color:#2C2C2B;">{{MANAGER_NAME}}</strong>.</p>
              <div style="height:1px;background:#E5E0DA;margin:28px 0;"></div>
              <p style="margin:0;font-size:12px;color:#8A8680;line-height:1.6;">
                Se o botão não funcionar, copie e cole o endereço abaixo no navegador:<br/>
                <a href="{{APP_URL}}/rh/ferias" style="color:#E8920A;word-break:break-all;font-size:12px;">{{APP_URL}}/rh/ferias</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#8A8680;line-height:1.6;">&copy; Grupo Sanwey &mdash; Commercial Intelligence Platform</p>
              <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do sistema de RH.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return applyVars(html, vars);
}

function tplWelcome(vars: Record<string, string>): string {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo(a) ao Grupo Sanwey!</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
              <div style="width:36px;height:3px;background:#C7212B;border-radius:2px;margin-bottom:28px;"></div>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Bem-vindo(a) ao Grupo Sanwey!</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">
                Olá, <strong style="color:#2C2C2B;">{{EMPLOYEE_NAME}}</strong>! Estamos muito felizes em tê-la(o) como parte do time. Seu acesso à plataforma está pronto — explore os recursos e conte conosco nessa jornada.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding:5px 0;font-size:13px;color:#8A8680;">Cargo</td>
                        <td width="50%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{JOB_TITLE}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Departamento</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{DEPARTMENT}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Seu gestor</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{MANAGER_NAME}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Data de início</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{START_DATE}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#C7212B;border-radius:10px;">
                    <a href="{{APP_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.01em;">Acessar minha conta &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Qualquer dúvida sobre integração ou acesso, fale com <strong style="color:#2C2C2B;">{{MANAGER_NAME}}</strong>.</p>
              <div style="height:1px;background:#E5E0DA;margin:28px 0;"></div>
              <p style="margin:0;font-size:12px;color:#8A8680;line-height:1.6;">
                Se o botão não funcionar, copie e cole o endereço abaixo no navegador:<br/>
                <a href="{{APP_URL}}" style="color:#C7212B;word-break:break-all;font-size:12px;">{{APP_URL}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#8A8680;line-height:1.6;">&copy; Grupo Sanwey &mdash; Commercial Intelligence Platform</p>
              <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do sistema de RH. Bem-vindo(a) ao time!</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return applyVars(html, vars);
}

function tplCandidatoAprovado(vars: Record<string, string>): string {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Candidatura aprovada — Grupo Sanwey</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
              <div style="width:36px;height:3px;background:#C7212B;border-radius:2px;margin-bottom:28px;"></div>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Parabéns! Você foi aprovado(a)</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">
                Olá, <strong style="color:#2C2C2B;">{{CANDIDATE_NAME}}</strong>! Temos ótimas notícias: sua candidatura foi selecionada e estamos felizes em convidá-la(o) a fazer parte do Grupo Sanwey.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="40%" style="padding:5px 0;font-size:13px;color:#8A8680;">Vaga</td>
                        <td width="60%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{JOB_TITLE}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;">Departamento</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{DEPARTMENT}}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#8A8680;vertical-align:top;padding-top:8px;">Próximos passos</td>
                        <td style="padding:5px 0;font-size:13px;color:#2C2C2B;padding-top:8px;line-height:1.5;">{{NEXT_STEPS}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#C7212B;border-radius:10px;">
                    <a href="{{APP_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.01em;">Ver detalhes &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">
                Dúvidas? Entre em contato com <strong style="color:#2C2C2B;">{{CONTACT_NAME}}</strong> pelo e-mail
                <a href="mailto:{{CONTACT_EMAIL}}" style="color:#C7212B;text-decoration:none;">{{CONTACT_EMAIL}}</a>.
              </p>
              <div style="height:1px;background:#E5E0DA;margin:28px 0;"></div>
              <p style="margin:0;font-size:12px;color:#8A8680;line-height:1.6;">
                Se o botão não funcionar, copie e cole o endereço abaixo no navegador:<br/>
                <a href="{{APP_URL}}" style="color:#C7212B;word-break:break-all;font-size:12px;">{{APP_URL}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#8A8680;line-height:1.6;">&copy; Grupo Sanwey &mdash; Commercial Intelligence Platform</p>
              <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do processo seletivo do Grupo Sanwey.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return applyVars(html, vars);
}

function tplVagaManagerLink(vars: Record<string, string>): string {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Candidatos pra sua avaliação — Grupo Sanwey</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
              <div style="width:36px;height:3px;background:#C7212B;border-radius:2px;margin-bottom:28px;"></div>
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Candidatos pra sua avaliação</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">
                Olá, <strong style="color:#2C2C2B;">{{MANAGER_NAME}}</strong>! O RH separou os candidatos da vaga <strong style="color:#2C2C2B;">{{VAGA_TITLE}}</strong> pra você avaliar e aprovar ou reprovar — não precisa de login, é só clicar no link abaixo e confirmar seu e-mail.
              </p>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#C7212B;border-radius:10px;">
                    <a href="{{LINK_URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:0.01em;">Ver candidatos &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#8A8680;line-height:1.5;">
                Este link expira em {{EXPIRES_DAYS}} dias e é de uso exclusivo seu — não encaminhe pra terceiros.
              </p>
              <div style="height:1px;background:#E5E0DA;margin:28px 0;"></div>
              <p style="margin:0;font-size:12px;color:#8A8680;line-height:1.6;">
                Se o botão não funcionar, copie e cole o endereço abaixo no navegador:<br/>
                <a href="{{LINK_URL}}" style="color:#C7212B;word-break:break-all;font-size:12px;">{{LINK_URL}}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#8A8680;line-height:1.6;">&copy; Grupo Sanwey &mdash; Commercial Intelligence Platform</p>
              <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do processo seletivo do Grupo Sanwey.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return applyVars(html, vars);
}

function buildHtml(type: EmailType, vars: Record<string, string>): string {
  switch (type) {
    case "ferias_aprovadas":   return tplFeriasAprovadas(vars);
    case "ferias_rejeitadas":  return tplFeriasRejeitadas(vars);
    case "welcome":            return tplWelcome(vars);
    case "candidato_aprovado": return tplCandidatoAprovado(vars);
    case "vaga_manager_link":  return tplVagaManagerLink(vars);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate JWT — caller must be an authenticated Supabase user
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Achado da 2ª auditoria: faltava checar cargo (só validava sessão). Sem
    // isso, qualquer autenticado (inclusive uma conta "agencia" externa)
    // conseguia disparar e-mail de "noreply@sanwey.com.br" pra destinatário
    // arbitrário com variáveis controladas — relay de phishing/spam a partir
    // do domínio da empresa. As telas que usam esta função são todas RH-only.
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

    // Parse and validate body
    const body: SendEmailBody = await req.json();

    const validTypes: EmailType[] = [
      "ferias_aprovadas",
      "ferias_rejeitadas",
      "welcome",
      "candidato_aprovado",
      "vaga_manager_link",
    ];

    if (!body?.type || !validTypes.includes(body.type)) {
      return new Response(
        JSON.stringify({ error: `'type' inválido. Use: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
      return new Response(JSON.stringify({ error: "'to' deve ser um e-mail válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const variables = body.variables || {};
    const subject   = SUBJECTS[body.type];
    const html      = buildHtml(body.type, variables);

    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (resendKey) {
      // Send via Resend
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          from:    "noreply@sanwey.com.br",
          to:      body.to,
          subject,
          html,
        }),
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
      console.log("[rh-send-email] Sent via Resend:", resendData?.id);
    } else {
      // Fallback: log only (no RESEND_API_KEY configured)
      console.warn(
        "[rh-send-email] RESEND_API_KEY não configurada. E-mail NÃO enviado.",
        { type: body.type, to: body.to, subject },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[rh-send-email] Unhandled error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
