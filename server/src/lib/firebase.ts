// Firebase Admin: verifies Phone Auth ID tokens and sends push notifications.
// If FIREBASE_SERVICE_ACCOUNT_PATH is empty, push is a no-op and only AUTH_DEV_MODE login works.
import { readFileSync } from 'node:fs';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { config } from '../config.js';
import { unauthorized } from './errors.js';

let app: App | null = null;
if (config.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const sa = JSON.parse(readFileSync(config.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  app = initializeApp({ credential: cert(sa) });
}

export interface VerifiedPhone {
  phone: string;
  firebaseUid: string | null;
}

const E164 = /^\+[1-9]\d{7,14}$/;

/** Turns a Firebase ID token (or "dev:+91..." in dev mode) into a verified phone number. */
export async function verifyPhoneToken(idToken: string): Promise<VerifiedPhone> {
  if (config.AUTH_DEV_MODE && idToken.startsWith('dev:')) {
    const phone = idToken.slice(4);
    if (!E164.test(phone)) throw unauthorized('Dev token must look like dev:+919876543210');
    return { phone, firebaseUid: null };
  }
  if (!app) throw unauthorized('Phone login is not configured on the server');
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    if (!decoded.phone_number) throw new Error('no phone');
    return { phone: decoded.phone_number, firebaseUid: decoded.uid };
  } catch {
    throw unauthorized('Invalid or expired OTP session, please log in again');
  }
}

export async function sendPush(token: string | null | undefined, title: string, body: string, data: Record<string, string> = {}) {
  if (!app || !token) return;
  try {
    await getMessaging(app).send({
      token,
      notification: { title, body },
      data,
      android: { priority: 'high', notification: { channelId: 'orders' } },
    });
  } catch (err) {
    console.warn('Push failed:', (err as Error).message);
  }
}
