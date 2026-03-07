"use client";

import { useEffect } from "react";
import {
  removeSubscription,
  subscribeResponses,
  subscribeSession,
} from "@/src/services/supabase/api";
import type { ResponseRow, Session } from "@/src/types/models";

interface SessionRealtimeOptions {
  sessionId: string | null;
  onSessionUpdate: (session: Session) => void;
  onResponseInsert: (response: ResponseRow) => void;
}

export function useSessionRealtime({
  sessionId,
  onSessionUpdate,
  onResponseInsert,
}: SessionRealtimeOptions) {
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const sessionChannel = subscribeSession(sessionId, onSessionUpdate);
    const responsesChannel = subscribeResponses(sessionId, onResponseInsert);

    return () => {
      removeSubscription(sessionChannel);
      removeSubscription(responsesChannel);
    };
  }, [onResponseInsert, onSessionUpdate, sessionId]);
}
