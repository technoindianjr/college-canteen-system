import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { userDto } from '../lib/dto.js';
import { verifyPhoneToken } from '../lib/firebase.js';
import { notFound } from '../lib/errors.js';

const loginBody = z.object({ idToken: z.string().min(1) });
const profileBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  rollNo: z.string().trim().max(32).nullable().optional(),
  fcmToken: z.string().max(255).nullable().optional(),
});

const routes: FastifyPluginAsync = async (app) => {
  /** Exchange a Firebase Phone Auth ID token for an API JWT. Creates the account on first login. */
  app.post('/auth/otp-login', async (req) => {
    const { idToken } = loginBody.parse(req.body);
    const { phone, firebaseUid } = await verifyPhoneToken(idToken);
    const isAdminPhone = config.ADMIN_PHONES.includes(phone);

    let [user] = await db.select().from(users).where(eq(users.phone, phone));
    if (!user) {
      await db.insert(users).values({ phone, firebaseUid, role: isAdminPhone ? 'admin' : 'student' });
      [user] = await db.select().from(users).where(eq(users.phone, phone));
    } else if ((isAdminPhone && user.role !== 'admin') || (firebaseUid && user.firebaseUid !== firebaseUid)) {
      await db
        .update(users)
        .set({ ...(isAdminPhone ? { role: 'admin' as const } : {}), ...(firebaseUid ? { firebaseUid } : {}) })
        .where(eq(users.id, user.id));
      [user] = await db.select().from(users).where(eq(users.id, user.id));
    }

    const token = app.jwt.sign({ sub: user.id, role: user.role });
    return { token, user: userDto(user) };
  });

  app.get('/me', { preHandler: app.authenticate }, async (req) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.user.sub));
    if (!u) throw notFound('User');
    return userDto(u);
  });

  /** Set name / roll number (required before the first order) and the device's push token. */
  app.patch('/me', { preHandler: app.authenticate }, async (req) => {
    const body = profileBody.parse(req.body);
    if (Object.keys(body).length) await db.update(users).set(body).where(eq(users.id, req.user.sub));
    const [u] = await db.select().from(users).where(eq(users.id, req.user.sub));
    return userDto(u);
  });
};

export default routes;
