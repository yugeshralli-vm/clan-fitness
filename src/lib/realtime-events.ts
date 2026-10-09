/** Event names carried by realtime "changed" frames — shared by the publishers (src/lib/realtime.ts)
 * and the client subscribers (src/features/realtime). Frames never carry content, only which kind
 * of thing changed, so subscribers refetch through their usual server actions. */
export type RealtimeEvent =
  /** A clan chat message was sent. */
  | "chat_message"
  /** Someone reacted to a clan chat message. */
  | "chat_reaction"
  /** A check-in was logged/updated or a system post (weekly recap) was published. */
  | "feed_post"
  /** A comment or reaction on a feed card. */
  | "feed_engagement"
  /** A contract was claimed or the nightly cron resolved the day's claims. */
  | "contracts"
  /** A new notification for this user (user room only). */
  | "notifications"
  /** Someone claimed or live-completed a contract — carries a ContractMoment as `data`, the one
   * event with a payload, since it's shown as-is in a toast rather than triggering a refetch. */
  | "contract_moment";
