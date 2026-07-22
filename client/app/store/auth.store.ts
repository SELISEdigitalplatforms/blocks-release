import type { StoreApi, UseBoundStore } from "zustand";
import { useAuthStore as useBlocksAuthStore } from "@seliseblocks/blocks-kit";
import { User } from "@blocks-idp/iam/models/user";

// Auth state is owned by blocks-kit so that its guards (AuthResolver,
// ProtectedGuard, PublicGuard) and the rest of the deployment app share a
// single source of truth. blocks-kit types `user` loosely as `BaseUser`;
// deployment works with the richer IDP `User` shape, so we re-expose the same
// store instance with that type.
type BlocksAuthState = ReturnType<typeof useBlocksAuthStore.getState>;

export interface AuthState extends Omit<BlocksAuthState, "user" | "setUser"> {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = useBlocksAuthStore as unknown as UseBoundStore<
  StoreApi<AuthState>
>;
