import { requireAdminUser } from "@/server/authz";
import { AdminDashboard } from "./admin-dashboard";

export default async function AdminPage() {
  await requireAdminUser();
  return <AdminDashboard />;
}
