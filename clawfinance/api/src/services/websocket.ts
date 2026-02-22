import { WebSocket, WebSocketServer } from "ws";

let wss: WebSocketServer | null = null;

export function initWebSocket(server: import("http").Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("[ws] client connected");
    ws.on("close", () => console.log("[ws] client disconnected"));
    ws.on("error", (err) => console.error("[ws] error:", err));
  });

  console.log("[ws] WebSocket server ready on /ws");
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
