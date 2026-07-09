// Stable local import for blocks-kit's URL-scoping hook.
// useScopedPath() returns (sub) => `/app/<itemId>/<sub>`, reading :itemId from the
// current route params. Valid for any component rendered under the /app/:itemId subtree.
export { useScopedPath } from "@seliseblocks/blocks-kit/hooks";
