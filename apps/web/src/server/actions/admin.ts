"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdminUser } from "@/server/authz";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export async function setUserActivation(formData: FormData) {
  await requireAdminUser();

  const userId = String(formData.get("userId") ?? "");
  const isActive = formData.get("isActive") === "true";

  if (!userId) return;

  const [targetUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (targetUser?.isAdmin) {
    return;
  }

  await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, userId));

  revalidatePath("/admin");
}
