import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export async function requireActiveUser() {
  const session = await auth.api.getSession();

  if (!session?.user) {
    redirect("/?auth=required");
  }

  const [user] = await db
    .select({ isActive: users.isActive, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.isActive && !user?.isAdmin) {
    redirect("/pending-activation");
  }

  return { session, user };
}

export async function requireAdminUser() {
  const { session, user } = await requireActiveUser();

  if (!user.isAdmin) {
    redirect("/hub");
  }

  return { session, user };
}
