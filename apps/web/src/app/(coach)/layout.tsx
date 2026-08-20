import { CoachLayoutShell } from "@/components/coach/coach-layout-shell";
import { requireActiveUser } from "@/server/authz";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActiveUser();

  return <CoachLayoutShell>{children}</CoachLayoutShell>;
}
