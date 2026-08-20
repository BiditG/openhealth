"use server";

import { getSession } from "@/server/lib/get-session";
import { db } from "@/server/db";
import { chatSessions } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createChatSession({ title }: { title: string }) {
  const user = await getSession();

  const [session] = await db
    .insert(chatSessions)
    .values({
      userId: user.id,
      title: title.slice(0, 50) || "New conversation",
    })
    .returning({ id: chatSessions.id });

  return { id: session.id };
}

export async function deleteChatSession(sessionId: string) {
  const user = await getSession();

  await db
    .delete(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, user.id))
    );

  revalidatePath("/hub/chat");
  return { success: true };
}
