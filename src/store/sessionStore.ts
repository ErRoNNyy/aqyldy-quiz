"use client";

import { create } from "zustand";
import type { SessionParticipant } from "@/src/types/models";

interface SessionStore {
  leaderboard: SessionParticipant[];
  setLeaderboard: (rows: SessionParticipant[]) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  leaderboard: [],
  setLeaderboard: (rows) => {
    set({ leaderboard: rows });
  },
}));
