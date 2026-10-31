import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import type { Role } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface JwtUser {
  sub: number;
  role: Role;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { expiresIn: config.JWT_EXPIRES_IN } });

  // Verifies the JWT, then re-reads the role from MySQL so a role change or removal applies immediately.
  async function verify(req: FastifyRequest) {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized();
    }
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.user.sub));
    if (!u) throw unauthorized('Account not found, please log in again');
    req.user.role = u.role;
  }

  app.decorate('authenticate', async (req: FastifyRequest) => {
    await verify(req);
  });

  app.decorate('requireRole', (...roles: Role[]) => async (req: FastifyRequest) => {
    await verify(req);
    if (!roles.includes(req.user.role)) throw forbidden();
  });
});
