// Clan chat "something changed" signal server, deployed to Railway.
//
// Deliberately dumb: it never touches the database or Clerk and never carries message content.
// The Next.js app stays the only thing that reads/writes chat (auth, validation, notifications);
// this just tells connected clients "clan X changed, refetch" so they can stop polling every 2s.
//
// - Browsers connect over WebSocket with a short-lived token the Next.js app signed (HMAC with
//   REALTIME_SECRET) that says which user/clan it's for — see src/lib/realtime.ts.
// - The Next.js app POSTs /publish with the same secret after a write; every socket in that
//   clan's room gets a "changed" frame.

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = process.env.REALTIME_SECRET;
const HEARTBEAT_MS = 30_000;
const MAX_PUBLISH_BODY_BYTES = 1024;

if (!SECRET) {
  console.error("REALTIME_SECRET is not set");
  process.exit(1);
}

/** clanId -> sockets currently in that clan's chat */
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
    if (typeof payload.c !== "string" || typeof payload.u !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function joinRoom(clanId, socket) {
  let room = rooms.get(clanId);
  if (!room) rooms.set(clanId, (room = new Set()));
  room.add(socket);
}

function leaveRoom(clanId, socket) {
  const room = rooms.get(clanId);
  if (!room) return;
  room.delete(socket);
  if (room.size === 0) rooms.delete(clanId);
}

function broadcast(clanId) {
  const room = rooms.get(clanId);
  if (!room) return 0;
  const frame = JSON.stringify({ type: "changed", clanId });
  for (const socket of room) {
    if (socket.readyState === socket.OPEN) socket.send(frame);
  }
  return room.size;
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
        const { clanId } = JSON.parse(body);
        if (typeof clanId !== "string") return sendJson(res, 400, { error: "clanId required" });
        sendJson(res, 200, { delivered: broadcast(clanId) });
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
    ws.clanId = payload.c;
    ws.isAlive = true;
    joinRoom(payload.c, ws);
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    // Clients never need to send anything; ignore whatever arrives.
    ws.on("close", () => leaveRoom(ws.clanId, ws));
    ws.on("error", () => leaveRoom(ws.clanId, ws));
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
