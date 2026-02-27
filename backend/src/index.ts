import express from "express";
import { createServer } from "http";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.ts";
import citizenRoutes from "./routes/citizenRoutes.ts";
import policeRoutes from "./routes/policeRoutes.ts";
import publicRoutes from "./routes/publicRoutes.ts";
import chatRoutes from "./routes/chatRoutes.ts";
import bountyRoutes from "./routes/bountyRoutes.ts";
import { initSocket } from "./socket.ts";

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/reunite";

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/requests", citizenRoutes);
app.use("/api/police", policeRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/bounty", bountyRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Initialise Socket.IO
initSocket(server);

// Connect to MongoDB and start server
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✓ Connected to MongoDB");

    server.listen(PORT, () => {
      console.log(`✓ REUNITE API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
