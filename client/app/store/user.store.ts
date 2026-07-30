// DEADCODE 2026-07-29: unreachable from main.tsx/router tree; whole file commented pending review
// import { User } from "@blocks-idp/iam/models/user";
// import { create } from "zustand";
// import { persist } from "zustand/middleware";
//
// interface UserState {
//   user: User | null;
//   setUser: (user: User | null) => void;
//   reset: () => void;
// }
//
// export const useUserStore = create<UserState>()(
//   persist(
//     (set) => ({
//       user: null,
//       setUser: (user: User | null) => set((state) => ({ ...state, user })),
//       reset: () => set((state) => ({ ...state, user: null })),
//     }),
//     {
//       name: "user-storage",
//     },
//   ),
// );
