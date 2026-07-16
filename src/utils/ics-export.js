function toICSDateFromString(str) {
  // str can be a date string "YYYY-MM-DD" or ISO datetime
  const d = new Date(str);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addOneDayToICSDate(str) {
  const d = new Date(str);
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function escapeICS(str) {
  return (str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line) {
  // ICS spec: lines max 75 octets, folded with CRLF + space
  const out = [];
  let pos = 0;
  while (pos < line.length) {
    if (pos === 0) {
      out.push(line.slice(0, 75));
      pos = 75;
    } else {
      out.push(" " + line.slice(pos, pos + 74));
      pos += 74;
    }
  }
  return out.join("\r\n");
}

export function generateICS({ campaigns = [], personalEvents = [], calendarName = "Sanwey CRM" } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sanwey CRM//Calendar 1.0//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];

  campaigns.forEach(c => {
    if (!c.launchDate) return;
    const dtstart = toICSDateFromString(c.launchDate);
    const dtend   = c.endDate
      ? addOneDayToICSDate(c.endDate)
      : addOneDayToICSDate(c.launchDate);

    const stageName = c.stage ? c.stage.replace(/_/g, " ") : "";
    const summary   = escapeICS(`[${stageName.toUpperCase()}] ${c.name}`);
    const desc      = escapeICS(
      [
        c.channel  ? `Canal: ${c.channel}` : "",
        c.kpi      ? `KPI: ${c.kpi}` : "",
        c.budget   ? `Orçamento: R$${c.budget}` : "",
        c.agencyName ? `Agência: ${c.agencyName}` : "",
      ].filter(Boolean).join("\\n")
    );

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:campaign-${c.id}@sanwey-crm`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${summary}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    lines.push("END:VEVENT");
  });

  personalEvents.forEach(e => {
    if (!e.date) return;
    const dtstart = toICSDateFromString(e.date);
    const dtend   = e.endDate
      ? addOneDayToICSDate(e.endDate)
      : addOneDayToICSDate(e.date);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:personal-${e.id}@sanwey-crm`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${escapeICS(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}

export function downloadICS(content, filename = "sanwey-calendario.ics") {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
