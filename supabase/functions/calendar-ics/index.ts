import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ICS helpers
function toICSDate(str: string): string {
  const d = new Date(str);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addOneDayICS(str: string): string {
  const d = new Date(str);
  d.setUTCDate(d.getUTCDate() + 1);
  return toICSDate(d.toISOString());
}

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  const out: string[] = [];
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) { out.push(line.slice(0, 75)); pos = 75; }
    else { out.push(" " + line.slice(pos, pos + 74)); pos += 74; }
  }
  return out.join("\r\n");
}

function buildICS(name: string, veventBlocks: string[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sanwey CRM//Calendar 1.0//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    ...veventBlocks,
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n");
}

const dtstamp = () => new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

Deno.serve(async (req: Request) => {
  // Allow browsers / calendar apps (GET only, no CORS needed for calendar subscriptions)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  const url    = new URL(req.url);
  const token  = url.searchParams.get("token");
  const type   = url.searchParams.get("type") ?? "marketing"; // personal | marketing | all

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Look up user by calendar_token — token vive em `profile_secrets` desde
  // a migration 20260819_sec_profile_secrets_split.sql (segurança: tirar
  // segredo de coluna lida por linha inteira em profiles).
  const { data: secret } = await db
    .from("profile_secrets")
    .select("id, profiles(id, name, companies, role, roles)")
    .eq("calendar_token", token)
    .maybeSingle();

  const profile = secret?.profiles;
  if (!profile) {
    return new Response("Invalid token", { status: 401 });
  }

  const veventBlocks: string[] = [];

  // ── Personal events ────────────────────────────────────────────────────────
  if (type === "personal" || type === "all") {
    const { data: personalRows } = await db
      .from("personal_events")
      .select("*")
      .eq("user_id", profile.id);

    (personalRows ?? []).forEach((e: Record<string, unknown>) => {
      if (!e.date) return;
      const dtstart = toICSDate(e.date as string);
      const dtend   = e.end_date ? addOneDayICS(e.end_date as string) : addOneDayICS(e.date as string);
      veventBlocks.push([
        "BEGIN:VEVENT",
        `UID:personal-${e.id}@sanwey-crm`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${esc(e.title as string)}`,
        e.description ? `DESCRIPTION:${esc(e.description as string)}` : null,
        `DTSTAMP:${dtstamp()}`,
        "END:VEVENT",
      ].filter(Boolean).join("\r\n"));
    });
  }

  // ── Marketing campaigns ────────────────────────────────────────────────────
  if (type === "marketing" || type === "all") {
    let query = db.from("marketing_campaigns").select("id,name,stage,channel,kpi,budget,launch_date,end_date,company_ids");

    // Non-admin / non-gerente_marketing: scope by companies.
    // Achado da 2ª auditoria: antes o filtro só era aplicado quando companies
    // era um array NÃO vazio — com companies = '{}' (default e valor comum pós
    // convite) NENHUM filtro entrava e a query devolvia TODAS as campanhas de
    // todas as empresas (fail-open). Agora escopo vazio = zero campanhas, e a
    // checagem de papel usa roles[] (não o escalar legado).
    const fullAccessRoles = ["admin", "gerente_marketing"];
    const userRoles = Array.isArray(profile.roles) && profile.roles.length
      ? (profile.roles as string[])
      : (profile.role ? [profile.role as string] : []);
    const hasFullAccess = userRoles.some((r) => fullAccessRoles.includes(r));
    if (!hasFullAccess) {
      // comps vazio não casa nada — sempre aplica o overlaps.
      const comps = Array.isArray(profile.companies) ? (profile.companies as string[]) : [];
      query = query.overlaps("company_ids", comps);
    }

    const { data: campaignRows } = await query;

    (campaignRows ?? []).forEach((c: Record<string, unknown>) => {
      if (!c.launch_date) return;
      const dtstart = toICSDate(c.launch_date as string);
      const dtend   = c.end_date ? addOneDayICS(c.end_date as string) : addOneDayICS(c.launch_date as string);
      const stageName = ((c.stage as string) ?? "").replace(/_/g, " ").toUpperCase();
      const desc = [
        c.channel ? `Canal: ${c.channel}` : "",
        c.kpi     ? `KPI: ${c.kpi}` : "",
        c.budget  ? `Budget: R$${c.budget}` : "",
      ].filter(Boolean).join("\\n");

      veventBlocks.push([
        "BEGIN:VEVENT",
        `UID:campaign-${c.id}@sanwey-crm`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${esc(`[${stageName}] ${c.name as string}`)}`,
        desc ? `DESCRIPTION:${desc}` : null,
        `DTSTAMP:${dtstamp()}`,
        "END:VEVENT",
      ].filter(Boolean).join("\r\n"));
    });
  }

  const calName = type === "personal"  ? `Sanwey – Pessoal (${profile.name})`
                : type === "marketing" ? "Sanwey – Campanhas de Marketing"
                : `Sanwey – Calendário (${profile.name})`;

  const icsContent = buildICS(calName, veventBlocks);

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=sanwey-calendar.ics",
      "Cache-Control": "no-cache, no-store",
    },
  });
});
