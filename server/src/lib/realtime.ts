// Socket.IO: pushes live order updates to the student who owns the order and to the staff board.
// Clients connect with { auth: { token: <JWT> } }. Students join room user:<id>; staff and admins also join "staff".
import type { Server as HttpServer } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { config } from '../config.js';
import type { JwtUser } from '../plugins/auth.js';

let io: Server | null = null;

export function attachRealtime(app: FastifyInstance, server: HttpServer) {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : true },
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      socket.data.user = app.jwt.verify<JwtUser>(token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const user = socket.data.user as JwtUser;
    socket.join(`user:${user.sub}`);
    if (user.role === 'staff' || user.role === 'admin') socket.join('staff');
  });
  return io;
}

export const realtime = {
  /** An order changed: tell its owner and the staff board. */
  orderUpdated(order: { id: number; userId: number } & Record<string, unknown>) {
    io?.to(`user:${order.userId}`).to('staff').emit('order:updated', order);
  },
  /** A new order arrived: staff board plays a sound. */
  orderCreated(order: { id: number; userId: number } & Record<string, unknown>) {
    io?.to('staff').emit('order:new', order);
    io?.to(`user:${order.userId}`).emit('order:updated', order);
  },
  /** Menu availability or prices changed: every client refetches the menu. */
  menuChanged() {
    io?.emit('menu:changed', { at: Date.now() });
  },
  /** Ordering paused or resumed. */
  settingsChanged(payload: Record<string, unknown>) {
    io?.emit('settings:changed', payload);
  },
};
