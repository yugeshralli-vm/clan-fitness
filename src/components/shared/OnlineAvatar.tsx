"use client";

import { useIsOnline } from "@/features/realtime";
import { Avatar } from "./Avatar";

/** Avatar with a live green dot while `userId` has the app open in any clan the viewer shares. A
 * client wrapper so server-rendered pages can show presence too; renders a plain Avatar when
 * presence isn't known (no realtime connection). */
export function OnlineAvatar({ userId, ...props }: { userId: string } & Omit<Parameters<typeof Avatar>[0], "online">) {
  return <Avatar {...props} online={useIsOnline(userId)} />;
}
