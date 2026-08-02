// Project/tenant selection state is owned by blocks-kit (identical API/shape)
// so that its impersonation guards (which read the selected project) and the
// deployment app share a single source of truth.
export { useProjectStore } from "@seliseblocks/genesis-os";
export type { ProjectStoreState } from "@seliseblocks/genesis-os";
