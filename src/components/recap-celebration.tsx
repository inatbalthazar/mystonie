"use client";

import { Celebration } from "@/components/celebration";
import type { CardData } from "@/core/cards/types";
import { useRouter } from "@/i18n/navigation";

/** The recap page's content: the celebration with the week's card; closing it goes to the collection. */
export function RecapCelebration({ data, recapId, username, host }: { data: CardData; recapId: string; username: string | null; host: string }) {
  const router = useRouter();
  return (
    <Celebration
      data={data}
      source={{ kind: "weekly_recap", recapId, ready: true }}
      animate
      username={username}
      host={host}
      onClose={() => router.push("/home")}
    />
  );
}
