// ============================================
// API CONTRACT: Current session + role (drives admin gating and business-only widgets)
// Endpoint: GET /api/v1/me
// Owned by: Dev A (Phase 1 — auth & identity)
// Request shape: {} (bearer token in Authorization header)
// Response shape: { profile: Profile, roles: ("user"|"admin")[] }
// Currently: returns mockData/profiles.json[0] with a hardcoded role toggle below.
// NOTE: role here is for UI affordances ONLY. The backend MUST 403 every admin
// endpoint independently — hiding admin UI is not an authorization control.
// ============================================

import profiles from "../mockData/profiles.json";
import type { ApiResult, Profile } from "../types";
import { mock } from "./client";

export interface Session {
  profile: Profile;
  roles: Array<"user" | "admin">;
}

/** Mocked admin role. Flip in Settings > Developer to enter the admin stack. */
let mockIsAdmin = true;
export const setMockAdmin = (v: boolean) => {
  mockIsAdmin = v;
};
export const getMockAdmin = () => mockIsAdmin;

export async function getSession(): Promise<ApiResult<Session>> {
  return mock<Session>(
    () => ({
      profile: profiles[0] as Profile,
      roles: mockIsAdmin ? ["user", "admin"] : ["user"],
    }),
    350,
  );
}
