import { readFileSync } from "node:fs";

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const src = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const clean = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
  if (clean.length === 0) return [];
  const header = clean[0].map((h) => h.trim());
  return clean.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

export function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(","));
  return lines.join("\n") + "\n";
}

function parseTimeToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
}

function localDateKey(shiftedMs) {
  const d = new Date(shiftedMs);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return y + "-" + mo + "-" + da;
}

// Business minutes between two ISO timestamps.
// All wall clock reasoning happens in a fixed UTC offset taken from config
// (utcOffsetMinutes). Timestamps are shifted by that offset, then read with
// UTC getters, so results are deterministic and do not depend on the host
// timezone or on daylight saving rules. Documented in the README.
export function businessMinutesBetween(startISO, endISO, config) {
  if (!startISO || !endISO) return null;
  const start = Date.parse(startISO);
  const end = Date.parse(endISO);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const offsetMs = (config.utcOffsetMinutes || 0) * 60000;
  const holidays = new Set(config.holidays || []);
  const hours = config.businessHours || {};
  let total = 0;
  const startShifted = start + offsetMs;
  const endShifted = end + offsetMs;
  const firstDay = new Date(startShifted);
  firstDay.setUTCHours(0, 0, 0, 0);
  for (let day = firstDay.getTime(); day <= endShifted; day += 86400000) {
    const d = new Date(day);
    const weekday = String(d.getUTCDay());
    const spec = hours[weekday];
    if (!spec) continue;
    if (holidays.has(localDateKey(day))) continue;
    const winStart = day + parseTimeToMinutes(spec.start) * 60000;
    const winEnd = day + parseTimeToMinutes(spec.end) * 60000;
    const overlapStart = Math.max(startShifted, winStart);
    const overlapEnd = Math.min(endShifted, winEnd);
    if (overlapEnd > overlapStart) total += Math.round((overlapEnd - overlapStart) / 60000);
  }
  return total;
}

export function calendarMinutesBetween(startISO, endISO) {
  if (!startISO || !endISO) return null;
  const start = Date.parse(startISO), end = Date.parse(endISO);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function loadConfig(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function evaluateTickets(tickets, config) {
  const targets = config.targets || {};
  return tickets.map((t) => {
    const target = targets[t.priority] || {};
    const firstBiz = businessMinutesBetween(t.created_at, t.first_reply_at, config);
    const firstCal = calendarMinutesBetween(t.created_at, t.first_reply_at);
    const resBiz = businessMinutesBetween(t.created_at, t.resolved_at, config);
    const resCal = calendarMinutesBetween(t.created_at, t.resolved_at);
    return {
      ...t,
      first_response_business_minutes: firstBiz ?? "",
      first_response_calendar_minutes: firstCal ?? "",
      first_response_breach: firstBiz === null || target.firstResponse === undefined ? "" : String(firstBiz > target.firstResponse),
      resolution_business_minutes: resBiz ?? "",
      resolution_calendar_minutes: resCal ?? "",
      resolution_breach: resBiz === null || target.resolution === undefined ? "" : String(resBiz > target.resolution)
    };
  });
}

function summariseGroup(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    const name = r[key] || "(blank)";
    if (!groups.has(name)) groups.set(name, { name, total: 0, firstEvaluated: 0, firstBreaches: 0, resEvaluated: 0, resBreaches: 0 });
    const g = groups.get(name);
    g.total += 1;
    if (r.first_response_breach !== "") { g.firstEvaluated += 1; if (r.first_response_breach === "true") g.firstBreaches += 1; }
    if (r.resolution_breach !== "") { g.resEvaluated += 1; if (r.resolution_breach === "true") g.resBreaches += 1; }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function rate(breaches, evaluated) {
  if (!evaluated) return "n/a";
  return (Math.round((breaches / evaluated) * 1000) / 10) + "%";
}

export function buildSummary(rows) {
  const lines = [];
  lines.push("# SLA summary");
  lines.push("");
  lines.push("Tickets processed: " + rows.length);
  lines.push("");
  const totalFirst = rows.filter((r) => r.first_response_breach === "true").length;
  const totalRes = rows.filter((r) => r.resolution_breach === "true").length;
  lines.push("First response breaches: " + totalFirst);
  lines.push("Resolution breaches: " + totalRes);
  lines.push("");
  for (const [title, key] of [["By priority", "priority"], ["By team", "team"]]) {
    lines.push("## " + title);
    lines.push("");
    lines.push("| Group | Tickets | First response breaches | First response breach rate | Resolution breaches | Resolution breach rate |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const g of summariseGroup(rows, key)) {
      lines.push("| " + g.name + " | " + g.total + " | " + g.firstBreaches + " | " + rate(g.firstBreaches, g.firstEvaluated) + " | " + g.resBreaches + " | " + rate(g.resBreaches, g.resEvaluated) + " |");
    }
    lines.push("");
  }
  lines.push("Business minutes count only time inside the configured business hours on business days, skipping holidays. Calendar minutes count every minute, so the gap between the two columns in the CSV is where a dashboard that uses calendar time, or the wrong business hours, misstates the SLA.");
  lines.push("");
  return lines.join("\n");
}

export const OUTPUT_COLUMNS = ["id","created_at","first_reply_at","resolved_at","priority","team","first_response_business_minutes","first_response_calendar_minutes","first_response_breach","resolution_business_minutes","resolution_calendar_minutes","resolution_breach"];
