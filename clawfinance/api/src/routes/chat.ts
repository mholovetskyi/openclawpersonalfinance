import { Router } from "express";
import { pool } from "../services/db.js";
import { broadcast } from "../services/websocket.js";
import { randomUUID } from "crypto";
import { validate } from "../middleware/validate.js";
import { chatPostSchema, chatHistoryParamsSchema } from "../schemas.js";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  agent?: string;
  metadata?: Record<string, unknown>;
}

// POST /api/chat — submit a message; streams back via WebSocket, returns session_id
router.post("/", validate({ body: chatPostSchema }), async (req, res) => {
  const { message, session_id } = req.body;

  const sessionId = session_id ?? randomUUID();

  try {
    // Persist user message
    await pool.query(
      "INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)",
      [sessionId, message]
    );

    // Return session_id immediately; the actual response comes via WebSocket
    // In production this would trigger an OpenClaw sessions_spawn call.
    // For now we do a simple rule-based routing to let the UI function standalone.
    res.json({ session_id: sessionId, status: "processing" });

    // Route to appropriate skill based on keywords (simplified orchestration)
    const lower = message.toLowerCase();
    let agent = "skill-finance-orchestrator";
    if (/budget|spend|transaction|categor|receipt/.test(lower)) agent = "skill-budget";
    else if (/portfolio|holding|stock|invest|return|allocation/.test(lower)) agent = "skill-investment";
    else if (/tax|w-2|1099|deduct|irs|withhold/.test(lower)) agent = "skill-tax";
    else if (/news|research|sentiment|filing|insider|sec|trend/.test(lower)) agent = "skill-research";

    // Simulate agent thinking (in production, this is where sessions_spawn fires)
    const reply = buildStaticReply(message, agent);

    // Persist assistant message
    await pool.query(
      "INSERT INTO chat_messages (session_id, role, content, agent) VALUES ($1, 'assistant', $2, $3)",
      [sessionId, reply, agent]
    );

    // Broadcast to WebSocket clients
    broadcast("chat_message", {
      session_id: sessionId,
      role: "assistant",
      content: reply,
      agent,
    });
  } catch (err) {
    console.error("[chat] error:", err);
    // Don't throw — response already sent
  }
});

// GET /api/chat/history/:session_id
router.get("/history/:sessionId", validate({ params: chatHistoryParamsSchema }), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, role, content, agent, metadata, created_at
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [req.params.sessionId]
    );
    res.json({ data: result.rows, session_id: req.params.sessionId });
  } catch (err) {
    console.error("[chat/history] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/chat/sessions — list recent chat sessions
router.get("/sessions", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT session_id,
             MIN(created_at) AS started_at,
             MAX(created_at) AS last_message_at,
             COUNT(*) AS message_count,
             (SELECT content FROM chat_messages m2
              WHERE m2.session_id = m.session_id AND m2.role = 'user'
              ORDER BY created_at ASC LIMIT 1) AS first_user_message
      FROM chat_messages m
      GROUP BY session_id
      ORDER BY MAX(created_at) DESC
      LIMIT 20
    `);
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[chat/sessions] error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function buildStaticReply(message: string, agent: string): string {
  const lower = message.toLowerCase();

  if (/hello|hi|hey/.test(lower)) {
    return "Hey! I'm your ClawFinance AI assistant. I can help with your budget, portfolio, taxes, and investment research. What would you like to know?";
  }

  const agentLabels: Record<string, string> = {
    "skill-budget": "Budget Agent",
    "skill-investment": "Investment Agent",
    "skill-tax": "Tax Agent",
    "skill-research": "Research Agent",
    "skill-finance-orchestrator": "Finance Orchestrator",
  };

  return [
    `I've routed your question to the **${agentLabels[agent] ?? agent}**.`,
    "",
    "To get a full AI-powered response, make sure OpenClaw is running with the ClawFinance skills loaded:",
    "```",
    "openclaw start",
    "```",
    "Then ask me anything about your finances — spending, portfolio performance, tax estimates, or company research.",
  ].join("\n");
}

export default router;
