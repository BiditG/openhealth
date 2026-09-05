import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

function isExpectedLocalDbError(error: unknown) {
  if (process.env.NODE_ENV === "production") return false;

  const errorText = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
  return ["EACCES", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].some((code) => errorText.includes(code));
}

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

    if (process.env.NODE_ENV !== "production") {
      const session = await auth.api.getSession().catch(() => null);

      if (session?.user) {
        if (!isExpectedLocalDbError(error)) {
          console.warn(
            "Protected route DB check failed; allowing authenticated user in local development.",
            error
          );
        }

        return {
          session,
          user: {
            isActive: true,
            isAdmin: false,
          },
        };
      }
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
