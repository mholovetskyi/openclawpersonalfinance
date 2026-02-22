import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Bot, User, ChevronDown } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { wsClient } from "../../lib/websocket";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
}

const AGENT_LABELS: Record<string, string> = {
  "skill-budget": "Budget",
  "skill-investment": "Portfolio",
  "skill-tax": "Tax",
  "skill-research": "Research",
  "skill-finance-orchestrator": "Orchestrator",
};

function formatContent(content: string) {
  // Simple markdown-lite: bold, code blocks, line breaks
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-xs text-emerald-300">$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 rounded p-2 text-xs text-emerald-300 overflow-x-auto my-1">$1</pre>')
    .replace(/\n/g, "<br />");
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for WebSocket chat messages
  useEffect(() => {
    const handler = (data: Record<string, unknown>) => {
      if (data.session_id !== sessionId) return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: data.role as "user" | "assistant",
          content: data.content as string,
          agent: data.agent as string | undefined,
        },
      ]);
      setLoading(false);
    };
    wsClient.on("chat_message", handler);
    return () => wsClient.off("chat_message", handler);
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, session_id: sessionId }),
      }) as { session_id: string; status: string };

      if (!sessionId) setSessionId(res.session_id);

      // If no WS response within 3s, fall back to polling history
      setTimeout(async () => {
        setLoading((still) => {
          if (still) {
            // Poll for the assistant reply
            apiFetch(`/api/chat/history/${res.session_id}`).then((h: { data: Array<{ id: string; role: string; content: string; agent: string }> }) => {
              const assistantMsgs = (h.data ?? []).filter((m) => m.role === "assistant");
              if (assistantMsgs.length > 0) {
                const last = assistantMsgs[assistantMsgs.length - 1];
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === last.id);
                  if (exists) return prev;
                  return [...prev, { id: last.id, role: "assistant", content: last.content, agent: last.agent }];
                });
              }
            });
            return false;
          }
          return still;
        });
      }, 3000);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Sorry, I couldn't reach the API. Make sure the ClawFinance server is running on port 3001." },
      ]);
      setLoading(false);
    }
  }, [input, loading, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => { setMessages([]); setSessionId(null); };

  const SUGGESTIONS = [
    "How am I doing on my budget this month?",
    "What's my portfolio performance?",
    "Do I owe estimated taxes this quarter?",
    "Any news on my holdings?",
  ];

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-claw-600 hover:bg-claw-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        aria-label="Toggle chat"
      >
        {open ? <ChevronDown className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-22 right-6 z-50 w-96 max-h-[600px] flex flex-col bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-claw-600 rounded-full flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white">ClawFinance AI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button onClick={clearChat} className="text-xs text-gray-500 hover:text-gray-300">
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 text-center pt-2">
                  Ask me anything about your finances.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="text-left text-xs text-gray-400 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-claw-600 rounded-lg px-3 py-2 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${msg.role === "user" ? "bg-claw-700" : "bg-gray-700"}`}>
                  {msg.role === "user"
                    ? <User className="w-3 h-3 text-white" />
                    : <Bot className="w-3 h-3 text-white" />
                  }
                </div>
                <div className={`flex-1 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {msg.agent && msg.role === "assistant" && (
                    <span className="text-xs text-claw-400 font-medium">
                      {AGENT_LABELS[msg.agent] ?? msg.agent}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-claw-700 text-white rounded-tr-sm"
                        : "bg-gray-800 text-gray-200 rounded-tl-sm"
                    }`}
                    dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                  />
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances…"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-claw-500"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-8 h-8 bg-claw-600 hover:bg-claw-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
