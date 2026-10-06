import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";

export type PushPayload = { title: string; body: string; url: string };

let configured = false;
function configure() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:homebase@example.com", publicKey, privateKey);
  configured = true;
  return true;
}

export function pushConfigured() {
  return configure();
}

/**
 * Sends a notification to every phone/browser a user has switched them on for.
 * Registrations the push service says are gone (404/410) are removed. Returns
 * how many devices it reached.
 */
export async function sendToUser(prisma: PrismaClient, userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
  return sent;
}
