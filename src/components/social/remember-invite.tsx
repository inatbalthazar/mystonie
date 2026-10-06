"use client";

import { useEffect } from "react";
import { INVITE_KEY, storeInvite } from "@/core/invites";

/** `/join/<username>` for a visitor: remembers the inviter on this device until an account accepts it (ADR 0098). */
export function RememberInvite({ username }: { username: string }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(INVITE_KEY, storeInvite(username, Date.now()));
    } catch {
      // storage blocked: the invite is simply lost
    }
  }, [username]);
  return null;
}
