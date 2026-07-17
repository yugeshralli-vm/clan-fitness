export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type NotificationType =
  | "comment"
  | "mention"
  | "reaction"
  | "check_in"
  | "missed_log"
  | "nudge"
  | "feedback"
  | "broadcast"
  | "weekly_recap"
  | "clan_message";

export type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  checkInId?: string;
};
