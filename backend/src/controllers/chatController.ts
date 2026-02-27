import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.ts";
import { streamChat, getCaseStats } from "../services/chatService.ts";

export async function chat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { messages, location } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Messages array is required" });
      return;
    }

    const userRole = req.user?.role || "CITIZEN";

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await streamChat(messages, userRole, location);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process chat" });
    } else {
      res.write(
        `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
      );
      res.end();
    }
  }
}

export async function chatStatistics(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const stats = await getCaseStats();
    res.json(stats);
  } catch (error) {
    console.error("Chat stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
