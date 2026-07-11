import { Tabs, type TabItem } from "@/components/ui/tabs";
import { ConfigForm, getAppConfig, getNotificationDeliveryStats, NotificationHealthSection } from "@/features/admin";
import { FeedbackThreadsList } from "@/features/feedback";

export default async function AdminPage() {
  const [config, notificationStats] = await Promise.all([getAppConfig(), getNotificationDeliveryStats()]);

  const tabs: TabItem[] = [
    { id: "config", label: "Config", content: <ConfigForm config={config} /> },
    {
      id: "notifications",
      label: "Notifications",
      content: <NotificationHealthSection stats={notificationStats} />,
    },
    { id: "feedback", label: "Feedback", content: <FeedbackThreadsList /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Admin</h1>
      <Tabs tabs={tabs} />
    </div>
  );
}
