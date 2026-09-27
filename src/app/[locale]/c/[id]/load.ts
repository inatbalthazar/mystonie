import { cache } from "react";
import { isUuidV7 } from "@/core/ids";
import { sharedCard } from "@/data/cards";
import { userClient } from "@/data/supabase-server";

/** The shared card for `/c/[id]`, its metadata and OG image (one read per request). */
export const loadCard = cache(async (id: string): Promise<Awaited<ReturnType<typeof sharedCard>>> => {
  if (!isUuidV7(id)) return null;
  const db = await userClient();
  if (!db) return null;
  try {
    return await sharedCard(db, id);
  } catch (error) {
    console.error(error);
    return null;
  }
});
