import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dbPath = path.join(dataDir, "ticket-watch-db.json");

const {
  PORT = "8790",
  HOST = "0.0.0.0",
  TICKET_WATCH_API_KEY = "",
  TWILIO_ACCOUNT_SID = "",
  TWILIO_AUTH_TOKEN = "",
  TWILIO_FROM = "",
  TWILIO_TO = "",
  TWILIO_CONTENT_SID = ""
} = process.env;

const DEFAULT_DB = {
  bookings: [],
  sentAlerts: {},
  updatedAt: null
};

function send(res, status, body, contentType = "application/json") {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Ticket-Watch-Key",
    "Content-Type": contentType
  });
  res.end(contentType === "application/json" ? JSON.stringify(body) : body);
}

function xml(res, body) {
  send(res, 200, body, "text/xml; charset=utf-8");
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 250_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function loadDb() {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(dbPath, "utf8"));
  } catch {
    await saveDb(DEFAULT_DB);
    return structuredClone(DEFAULT_DB);
  }
}

async function saveDb(db) {
  db.updatedAt = new Date().toISOString();
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

function authorized(req) {
  if (!TICKET_WATCH_API_KEY) return true;
  return req.headers["x-ticket-watch-key"] === TICKET_WATCH_API_KEY;
}

function cleanPassengers(passengers) {
  return Array.from(new Set((passengers || [])
    .map((name) => String(name || "").trim().toUpperCase())
    .filter(Boolean)));
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function bookingKey(item) {
  return [
    item.pnr || "",
    item.deadlineIso || "",
    normalizeText(item.rawDeadlineText || "")
  ].join("|");
}

function minutesUntil(deadlineIso) {
  if (!deadlineIso) return Number.POSITIVE_INFINITY;
  return Math.ceil((new Date(deadlineIso).getTime() - Date.now()) / 60000);
}

function risk(item) {
  if (item.status === "ticketed") return "ticketed";
  const minutes = minutesUntil(item.deadlineIso);
  if (!Number.isFinite(minutes)) return "unknown";
  if (minutes <= 0) return "expired";
  if (minutes <= 60) return "urgent";
  if (minutes <= 360) return "soon";
  if (minutes <= 1440) return "today";
  return "open";
}

function formatDeadline(deadlineIso) {
  if (!deadlineIso) return "unknown";
  const date = new Date(deadlineIso);
  if (Number.isNaN(date.getTime())) return deadlineIso;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function htmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderDashboard(db) {
  const rows = db.bookings
    .filter((item) => item.status !== "ticketed")
    .sort((a, b) => minutesUntil(a.deadlineIso) - minutesUntil(b.deadlineIso))
    .map((item) => {
      const itemRisk = risk(item);
      const passengers = cleanPassengers(item.passengers).join(", ") || "Passenger unknown";
      const mins = minutesUntil(item.deadlineIso);
      const remaining = !Number.isFinite(mins) ? "unknown" : mins <= 0 ? "expired" : `${mins}m`;
      return `
        <tr>
          <td><strong>${htmlEscape(item.pnr)}</strong></td>
          <td>${htmlEscape(passengers)}</td>
          <td>${htmlEscape(formatDeadline(item.deadlineIso))}</td>
          <td><span class="badge ${itemRisk}">${htmlEscape(itemRisk)}</span></td>
          <td>${htmlEscape(remaining)}</td>
          <td><code>${htmlEscape(item.rawDeadlineText)}</code></td>
        </tr>
      `;
    }).join("");

  return `<!doctype html>
  <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Ticket Watch Server</title>
      <style>
        body { margin: 0; font: 14px system-ui, sans-serif; background: #f6f7f9; color: #17202a; }
        main { max-width: 1200px; margin: 0 auto; padding: 24px; }
        h1 { margin: 0 0 8px; font-size: 28px; }
        p { color: #637083; }
        table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #dfe4ea; }
        th, td { border-bottom: 1px solid #dfe4ea; padding: 10px; text-align: right; vertical-align: top; }
        th { background: #f1f4f7; }
        code { direction: ltr; display: block; white-space: normal; overflow-wrap: anywhere; }
        .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; color: white; background: #637083; }
        .urgent, .expired { background: #c83f28; }
        .soon { background: #b76a09; }
        .today, .open { background: #247847; }
      </style>
    </head>
    <body>
      <main>
        <h1>Ticket Watch</h1>
        <p>${db.bookings.length} bookings · updated ${htmlEscape(db.updatedAt || "never")}</p>
        <table>
          <thead>
            <tr>
              <th>PNR</th>
              <th>Passenger</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Remaining</th>
              <th>Raw</th>
            </tr>
          </thead>
          <tbody>${rows || "<tr><td colspan='6'>No bookings yet.</td></tr>"}</tbody>
        </table>
      </main>
    </body>
  </html>`;
}

function twilioVariables(item) {
  return JSON.stringify({
    "1": item.pnr || "unknown",
    "2": formatDeadline(item.deadlineIso)
  });
}

async function sendTwilio(item) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM || !TWILIO_TO) return false;

  const params = new URLSearchParams({
    From: TWILIO_FROM,
    To: TWILIO_TO
  });

  if (TWILIO_CONTENT_SID) {
    params.set("ContentSid", TWILIO_CONTENT_SID);
    params.set("ContentVariables", twilioVariables(item));
  } else {
    params.set("Body", `Ticket limit\nPNR: ${item.pnr}\nDeadline: ${formatDeadline(item.deadlineIso)}`);
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) throw new Error(await response.text());
  return true;
}

async function checkAlerts() {
  const db = await loadDb();
  const thresholds = [1440, 360, 60, 0];
  for (const item of db.bookings) {
    if (item.status === "ticketed") continue;
    const remaining = minutesUntil(item.deadlineIso);
    if (!Number.isFinite(remaining)) continue;
    for (const threshold of thresholds) {
      const shouldSend = threshold === 0 ? remaining <= 0 : remaining > 0 && remaining <= threshold;
      if (!shouldSend) continue;
      const key = `${bookingKey(item)}|${threshold}`;
      if (db.sentAlerts[key]) continue;
      try {
        await sendTwilio(item);
        db.sentAlerts[key] = new Date().toISOString();
      } catch (error) {
        console.error("Twilio alert failed:", error.message);
      }
    }
  }
  await saveDb(db);
}

function listText(bookings, filter) {
  const filtered = bookings
    .filter((item) => item.status !== "ticketed")
    .filter((item) => !filter || filter(item))
    .sort((a, b) => minutesUntil(a.deadlineIso) - minutesUntil(b.deadlineIso))
    .slice(0, 8);

  if (!filtered.length) return "אין הזמנות פתוחות מתאימות.";

  return filtered.map((item) => {
    const passengers = cleanPassengers(item.passengers).join(", ") || "ללא שם";
    const minutes = minutesUntil(item.deadlineIso);
    const remaining = minutes <= 0 ? "עבר" : `${minutes} דקות`;
    return `${item.pnr} · ${passengers} · ${formatDeadline(item.deadlineIso)} · ${remaining}`;
  }).join("\n");
}

async function handleInbound(req, res) {
  const body = await readBody(req);
  const params = new URLSearchParams(body);
  const text = String(params.get("Body") || "").trim().toLowerCase();
  const db = await loadDb();
  let reply;

  if (/^(open|פתוח|פתוחות)$/i.test(text)) {
    reply = listText(db.bookings);
  } else if (/^(urgent|דחוף|דחופות)$/i.test(text)) {
    reply = listText(db.bookings, (item) => ["expired", "urgent", "soon"].includes(risk(item)));
  } else if (/^(today|היום)$/i.test(text)) {
    reply = listText(db.bookings, (item) => minutesUntil(item.deadlineIso) <= 1440);
  } else if (/^(help|עזרה)$/i.test(text)) {
    reply = "פקודות: פתוח, דחוף, היום, pnr 94YMAY";
  } else {
    const pnr = (text.match(/\b[A-Z0-9]{6}\b/i) || [])[0];
    if (pnr) reply = listText(db.bookings, (item) => item.pnr === pnr.toUpperCase());
    else reply = "לא הבנתי. אפשר לכתוב: פתוח / דחוף / היום / pnr 94YMAY";
  }

  xml(res, `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${htmlEscape(reply)}</Message></Response>`);
}

async function upsertBookings(req, res) {
  if (!authorized(req)) {
    send(res, 401, { ok: false, error: "unauthorized" });
    return;
  }

  const payload = JSON.parse(await readBody(req) || "{}");
  const incoming = Array.isArray(payload.bookings) ? payload.bookings : [];
  const db = await loadDb();
  const map = new Map(db.bookings.map((item) => [bookingKey(item), item]));
  for (const item of incoming) {
    if (!item.pnr || !item.deadlineIso) continue;
    const normalized = {
      ...item,
      passengers: cleanPassengers(item.passengers),
      rawDeadlineText: normalizeText(item.rawDeadlineText),
      status: item.status || "open",
      updatedAt: new Date().toISOString()
    };
    map.set(bookingKey(normalized), {
      ...(map.get(bookingKey(normalized)) || {}),
      ...normalized
    });
  }
  db.bookings = Array.from(map.values());
  await saveDb(db);
  send(res, 200, { ok: true, count: db.bookings.length });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" && req.url === "/") {
      send(res, 200, renderDashboard(await loadDb()), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && req.url === "/api/bookings") {
      send(res, 200, await loadDb());
      return;
    }
    if (req.method === "POST" && req.url === "/api/bookings/upsert") {
      await upsertBookings(req, res);
      return;
    }
    if (req.method === "POST" && req.url === "/twilio/inbound") {
      await handleInbound(req, res);
      return;
    }
    send(res, 404, { ok: false, error: "not_found" });
  } catch (error) {
    console.error(error);
    send(res, 500, { ok: false, error: error.message });
  }
});

server.listen(Number(PORT), HOST, () => {
  console.log(`Ticket Watch Server: http://${HOST}:${PORT}`);
  console.log(`Twilio inbound webhook: http://${HOST}:${PORT}/twilio/inbound`);
  setInterval(checkAlerts, 60_000);
  setTimeout(checkAlerts, 5_000);
});
