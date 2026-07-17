import { Tabs, type TabItem } from "@/components/ui/tabs";
import {
  BroadcastComposer,
  BroadcastHistory,
  ConfigForm,
  getAllClansForAdmin,
  getAllUsersForAdmin,
  getAppConfig,
  getBroadcastHistory,
  getNotificationDeliveryStats,
  NotificationHealthSection,
} from "@/features/admin";

export default async function AdminPage() {
  const [config, notificationStats, clans, allUsers, broadcasts] = await Promise.all([
    getAppConfig(),
    getNotificationDeliveryStats(),
    getAllClansForAdmin(),
    getAllUsersForAdmin(),
    getBroadcastHistory(),
  ]);

  const tabs: TabItem[] = [
    { id: "config", label: "Config", content: <ConfigForm config={config} /> },
    {
      id: "broadcast",
      label: "Broadcast",
      content: (
        <div className="flex flex-col gap-6">
          <BroadcastComposer clans={clans} users={allUsers} />
          <BroadcastHistory broadcasts={broadcasts} />
          <NotificationHealthSection stats={notificationStats} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Admin</h1>
      <Tabs tabs={tabs} />
    </div>
  );
}
