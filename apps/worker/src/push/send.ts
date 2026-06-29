import { sendPushNotification, deserializeVapidKeys } from "web-push-browser";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
}

export interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export async function sendPush(
  target: PushTarget,
  message: PushMessage,
  vapid: VapidDetails,
): Promise<{ dead: boolean }> {
  const keyPair = await deserializeVapidKeys({
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
  });

  // Extract email from "mailto:email" or use subject directly
  const email = vapid.subject.startsWith("mailto:") ? vapid.subject.slice(7) : vapid.subject;

  let res: Response;
  try {
    res = await sendPushNotification(
      keyPair,
      {
        endpoint: target.endpoint,
        keys: {
          p256dh: target.p256dh,
          auth: target.auth,
        },
      },
      email,
      JSON.stringify(message),
    );
  } catch (err) {
    // Some push services signal gone subscriptions via exceptions in certain implementations
    // Re-throw — callers should not swallow unknown errors
    throw err;
  }

  return { dead: res.status === 404 || res.status === 410 };
}
