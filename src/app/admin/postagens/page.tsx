import { AdminShell } from "@/components/layout/admin-shell";
import { PostingsDashboard } from "@/components/postings/postings-dashboard";

export default function PostingsPage() {
  return (
    <AdminShell>
      <PostingsDashboard />
    </AdminShell>
  );
}
