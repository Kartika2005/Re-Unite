import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

// Socket.IO event names
export const SocketEvents = {
  REQUEST_CREATED: "request:created",
  REQUEST_UPDATED: "request:updated",
  SCAN_COMPLETED: "scan:completed",
  NOTE_ADDED: "note:added",
  TIP_RECEIVED: "tip:received",
  DUPLICATE_DETECTED: "duplicate:detected",
} as const;

export function initSocket(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`⚡ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized — call initSocket(server) first");
  }
  return io;
}
