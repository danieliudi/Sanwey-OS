#!/usr/bin/env node
// Faz upload dos templates de e-mail para o Supabase via Management API.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=<token> node supabase/upload-templates.js
//
// Obtenha seu token em:
//   https://supabase.com/dashboard/account/tokens

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = "adizvduyfzfftyswkijj";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("Erro: variável SUPABASE_ACCESS_TOKEN não definida.");
  console.error("Obtenha em: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const tpl = (file) =>
  readFileSync(join(__dirname, "templates", file), "utf8");

const payload = {
  mailer_templates_invite_subject:
    "Você foi convidado para o CRM Sanwey",
  mailer_templates_invite_content: tpl("invite.html"),

  mailer_templates_recovery_subject:
    "Redefinição de senha — CRM Sanwey",
  mailer_templates_recovery_content: tpl("recovery.html"),

  mailer_templates_confirmation_subject:
    "Confirme seu e-mail — CRM Sanwey",
  mailer_templates_confirmation_content: tpl("confirmation.html"),

  mailer_templates_magic_link_subject:
    "Seu link de acesso — CRM Sanwey",
  mailer_templates_magic_link_content: tpl("magic-link.html"),

  mailer_templates_email_change_subject:
    "Confirme seu novo e-mail — CRM Sanwey",
  mailer_templates_email_change_content: tpl("email-change.html"),
};

// Templates transacionais (serviço externo de e-mail — não são enviados ao Supabase GoTrue,
// mas ficam listados aqui para referência e validação de existência dos arquivos)
const TRANSACTIONAL_TEMPLATES = [
  "new-lead-assigned.html",
  "stage-change.html",
  "lead-won.html",
  "lead-lost.html",
  "stale-lead.html",
  "followup-reminder.html",
  "automation-alert.html",
  "weekly-digest.html",
];

// Valida que todos os arquivos transacionais existem
for (const file of TRANSACTIONAL_TEMPLATES) {
  try {
    tpl(file);
    console.log(`✓ ${file}`);
  } catch {
    console.error(`✗ Arquivo não encontrado: ${file}`);
    process.exit(1);
  }
}

console.log("\nEnviando templates Supabase (GoTrue)...");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }
);

if (!res.ok) {
  const body = await res.text();
  console.error(`Falhou (${res.status}):`, body);
  process.exit(1);
}

console.log("Templates enviados com sucesso!");
console.log("Verifique em: https://supabase.com/dashboard/project/" + PROJECT_REF + "/auth/templates");
