import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export async function requireActiveUser() {
  try {
    const session = await auth.api.getSession();

    if (!session?.user) {
      redirect("/login");
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
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("Protected route setup error:", error);
    redirect("/setup-error");
  }
}

export async function requireAdminUser() {
  const { session, user } = await requireActiveUser();

  if (!user.isAdmin) {
    redirect("/hub");
  }

  return { session, user };
}
