import "server-only";

import { Resend } from "resend";
import { logNotificationDelivery } from "./delivery-log";
import type { NotificationPayload } from "./types";

let resendClient: Resend | null = null;

/**
 * Configures Resend lazily, on first send, rather than at module load — same reasoning as
 * ensureVapidConfigured() in ./send: RESEND_API_KEY lives in per-environment config, so
 * validating it at import time would fail the build for every route that transitively imports
 * this module, even ones that never send an email.
 */
function getResendClient(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  resendClient = new Resend(apiKey);
  return resendClient;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sends a notification email to a single address. Silently no-ops if Resend isn't configured. */
export async function sendEmailNotification(userId: string, to: string, payload: NotificationPayload) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Email notifications are not configured (missing RESEND_API_KEY); skipping.");
    await logNotificationDelivery(userId, "email", "skipped", "RESEND_API_KEY missing");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "Clan Fitness <onboarding@resend.dev>";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = payload.url ? `${appUrl}${payload.url}` : appUrl;

  const title = escapeHtml(payload.title);
  const body = escapeHtml(payload.body);

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: payload.title,
      text: `${payload.title}\n\n${payload.body}\n\n${link}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <p style="font-size: 16px; font-weight: 600; color: #0d0d0d; margin: 0 0 8px;">${title}</p>
          <p style="font-size: 14px; color: #444; margin: 0 0 20px;">${body}</p>
          <a href="${link}" style="display: inline-block; font-size: 14px; font-weight: 600; color: #0d0d0d; background: #3bffad; padding: 10px 20px; text-decoration: none;">
            Open Clan Fitness
          </a>
        </div>
      `,
    });
    if (error) {
      console.error("Failed to send email notification:", error);
      await logNotificationDelivery(userId, "email", "failed", error.message);
    } else {
      await logNotificationDelivery(userId, "email", "sent");
    }
  } catch (error) {
    console.error("Failed to send email notification:", error);
    await logNotificationDelivery(userId, "email", "failed", (error as Error).message ?? String(error));
  }
}
