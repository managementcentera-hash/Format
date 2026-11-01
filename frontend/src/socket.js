// socket.js
import { io } from "socket.io-client";

export const socket = io("https://websocket-i9hd.onrender.com", {
  autoConnect: false,
  reconnection: false,
});