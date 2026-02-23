import "dotenv/config";
import http from "http";
import { createApp } from "./app.js";
import { initWebSocket } from "./services/websocket.js";

const PORT = Number(process.env.API_PORT ?? 3001);
const app = createApp();
const server = http.createServer(app);

initWebSocket(server);

server.listen(PORT, () => {
  console.log(`[api] ClawFinance API listening on http://localhost:${PORT}`);
  console.log(`[api] WebSocket available at ws://localhost:${PORT}/ws`);
});
