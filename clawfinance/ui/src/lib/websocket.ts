type WsHandler = (data: unknown) => void;

const handlers = new Map<string, WsHandler[]>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  const url = import.meta.env.VITE_WS_URL ?? "ws://localhost:3001/ws";

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log("[ws] connected");
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  socket.onmessage = (event) => {
    try {
      const { type, data } = JSON.parse(event.data);
      handlers.get(type)?.forEach((h) => h(data));
    } catch {
      // ignore malformed messages
    }
  };

  socket.onclose = () => {
    console.log("[ws] disconnected — reconnecting in 3s");
    reconnectTimer = setTimeout(connect, 3000);
  };

  socket.onerror = () => socket?.close();
}

export function on(type: string, handler: WsHandler) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type)!.push(handler);
}

export function off(type: string, handler: WsHandler) {
  const list = handlers.get(type);
  if (list) handlers.set(type, list.filter((h) => h !== handler));
}

// Auto-connect on import
connect();

// Named object for components that prefer method-style usage
export const wsClient = { on, off };
