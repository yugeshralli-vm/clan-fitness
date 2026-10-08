// "Something changed" signal server for Clan Fitness, deployed to Railway.
//
// Deliberately dumb: it never touches the database or Clerk and never carries content. The
// Next.js app stays the only thing that reads/writes data (auth, validation, notifications); this
// just tells connected clients "X changed in clan Y" / "you have a new notification" so they
// refetch instead of polling.
//
// - Browsers connect over WebSocket with a short-lived token the Next.js app signed (HMAC with
//   REALTIME_SECRET) listing the user and their clans — see src/lib/realtime.ts. Each socket joins
//   a `user:<id>` room plus one `clan:<id>` room per clan.
// - The Next.js app POSTs /publish with the same secret after a write; every socket in the target
//   room gets a `changed` frame with the event name (and who caused it, so UIs can ignore their own).

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = process.env.REALTIME_SECRET;
const HEARTBEAT_MS = 30_000;
const MAX_PUBLISH_BODY_BYTES = 64 * 1024;

if (!SECRET) {
  console.error("REALTIME_SECRET is not set");
  process.exit(1);
}

/** room ("clan:<id>" / "user:<id>") -> sockets in it */
const rooms = new Map();

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Token format (mirrors src/lib/realtime.ts): base64url(JSON payload) + "." + base64url(HMAC). */
function verifyToken(token) {
  if (typeof token !== "string") return null;
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) return null;
  const expected = createHmac("sha256", SECRET).update(payloadPart).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (typeof payload.u !== "string") return null;
    // Older tokens (before the per-user room) carried a single clan id as a string.
    if (typeof payload.c === "string") payload.c = [payload.c];
    if (!Array.isArray(payload.c) || !payload.c.every((id) => typeof id === "string")) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function joinRoom(name, socket) {
  let room = rooms.get(name);
  if (!room) rooms.set(name, (room = new Set()));
  room.add(socket);
}

function leaveRooms(socket) {
  for (const name of socket.rooms ?? []) {
    const room = rooms.get(name);
    if (!room) continue;
    room.delete(socket);
    if (room.size === 0) rooms.delete(name);
  }
}

/** `room` is "clan:<id>" or "user:<id>"; the frame echoes the clan id (if any) so a client in
 * several clans' rooms can tell which one changed. */
function broadcast({ room: name, event, actor }) {
  const room = rooms.get(name);
  if (!room) return 0;
  const clanId = name.startsWith("clan:") ? name.slice("clan:".length) : undefined;
  const frame = JSON.stringify({ type: "changed", event, clanId, actor });
  for (const socket of room) {
    if (socket.readyState === socket.OPEN) socket.send(frame);
  }
  return room.size;
}

/** Accepts one event or a batch; the original `{ clanId }` shape still means a chat change, so an
 * app deploy that predates per-event publishing keeps working against this server. */
function parsePublishBody(body) {
  const parsed = JSON.parse(body);
  if (typeof parsed.clanId === "string") return [{ room: `clan:${parsed.clanId}`, event: "chat_message" }];
  const events = Array.isArray(parsed.events) ? parsed.events : [parsed];
  return events.every((e) => typeof e.room === "string" && typeof e.event === "string") ? events : null;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, rooms: rooms.size });
  }

  if (req.method === "POST" && req.url === "/publish") {
    const auth = req.headers.authorization ?? "";
    if (!safeEqual(auth, `Bearer ${SECRET}`)) return sendJson(res, 401, { error: "unauthorized" });

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_PUBLISH_BODY_BYTES) req.destroy();
    });
    req.on("end", () => {
      try {
        const events = parsePublishBody(body);
        if (!events) return sendJson(res, 400, { error: "room and event required" });
        sendJson(res, 200, { delivered: events.reduce((sum, e) => sum + broadcast(e), 0) });
      } catch {
        sendJson(res, 400, { error: "invalid json" });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "not found" });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const token = new URL(req.url ?? "/", "http://localhost").searchParams.get("token");
  const payload = verifyToken(token);
  if (!payload) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.rooms = [`user:${payload.u}`, ...payload.c.map((clanId) => `clan:${clanId}`)];
    ws.isAlive = true;
    for (const name of ws.rooms) joinRoom(name, ws);
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    // Clients never need to send anything; ignore whatever arrives.
    ws.on("close", () => leaveRooms(ws));
    ws.on("error", () => leaveRooms(ws));
  });
});

// Railway's proxy (and mobile networks) drop idle connections — ping keeps them open and reaps
// sockets whose client vanished without a close frame.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.close(1012, "restarting");
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(PORT, () => console.log(`realtime listening on :${PORT}`));
