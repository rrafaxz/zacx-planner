import { ActivityFeed } from "@/components/activity/activity-feed";
import { AdminShell } from "@/components/layout/admin-shell";

export default function ActivitiesPage() {
  return (
    <AdminShell>
      <ActivityFeed />
    </AdminShell>
  );
}
