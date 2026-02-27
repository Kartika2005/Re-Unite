import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_WS_URL || "http://localhost:3001";

// Shared singleton so every component reuses one connection
let socket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

/**
 * Returns the shared Socket.IO client instance.
 * Connects on first mount, disconnects when the last consumer unmounts.
 */
export function useSocket(): Socket {
  const s = useRef(getSocket()).current;

  useEffect(() => {
    refCount++;
    if (!s.connected) s.connect();

    return () => {
      refCount--;
      if (refCount <= 0) {
        s.disconnect();
        socket = null;
        refCount = 0;
      }
    };
  }, []);

  return s;
}

// Mirror backend event names
export const SocketEvents = {
  REQUEST_CREATED: "request:created",
  REQUEST_UPDATED: "request:updated",
  SCAN_COMPLETED: "scan:completed",
  NOTE_ADDED: "note:added",
  TIP_RECEIVED: "tip:received",
  DUPLICATE_DETECTED: "duplicate:detected",
} as const;
