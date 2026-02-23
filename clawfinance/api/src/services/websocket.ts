import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";

let wss: WebSocketServer | null = null;

// Per-IP connection tracking for rate limiting
const connectionCount = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 10;

function getClientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? "unknown";
}

export function initWebSocket(server: import("http").Server): void {
  wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 64, // 64KB max message size
    verifyClient: ({ req }, done) => {
      const apiKey = process.env.CLAWFINANCE_API_KEY;

      // If API key is configured, require it via query param or header
      if (apiKey) {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const provided = url.searchParams.get("api_key") ?? req.headers["x-api-key"];
        if (provided !== apiKey) {
          done(false, 401, "Unauthorized");
          return;
        }
      }

      // Connection-level rate limiting
      const ip = getClientIp(req);
      const count = connectionCount.get(ip) ?? 0;
      if (count >= MAX_CONNECTIONS_PER_IP) {
        done(false, 429, "Too many connections");
        return;
      }

      done(true);
    },
  });

  wss.on("connection", (ws, req) => {
    const ip = getClientIp(req);
    connectionCount.set(ip, (connectionCount.get(ip) ?? 0) + 1);

    console.log("[ws] client connected from", ip);

    // Message rate limiting: max 30 messages per 10 seconds
    let messageCount = 0;
    const messageResetInterval = setInterval(() => { messageCount = 0; }, 10_000);

    ws.on("message", (data) => {
      messageCount++;
      if (messageCount > 30) {
        ws.send(JSON.stringify({ type: "error", data: { message: "Rate limited" } }));
        return;
      }

      // Validate message is valid JSON
      try {
        if (typeof data === "string" || Buffer.isBuffer(data)) {
          JSON.parse(data.toString());
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", data: { message: "Invalid JSON" } }));
      }
    });

    ws.on("close", () => {
      const current = connectionCount.get(ip) ?? 1;
      if (current <= 1) {
        connectionCount.delete(ip);
      } else {
        connectionCount.set(ip, current - 1);
      }
      clearInterval(messageResetInterval);
      console.log("[ws] client disconnected from", ip);
    });

    ws.on("error", (err) => console.error("[ws] error:", err));
  });

  console.log("[ws] WebSocket server ready on /ws (authenticated)");
}

export function broadcast(type: string, data: unknown): void {
  if (!wss) return;
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
