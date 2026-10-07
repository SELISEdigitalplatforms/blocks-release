import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuthStore } from "@/store/auth.store";

// One flag per component instance. It stays false through the first render and commit, and
// flips when React subscribes (a passive effect after that commit), which re-renders the
// component with `true` - the same one-render delay as setting state in a mount effect.
const createMountedStore = () => {
  let mounted = false;
  return {
    subscribe: (onChange: () => void) => {
      if (!mounted) {
        mounted = true;
        onChange();
      }
      return () => {};
    },
    getSnapshot: () => mounted,
  };
};

export const useAppState = () => {
  const [mountedStore] = useState(createMountedStore);
  const isMounted = useSyncExternalStore(
    mountedStore.subscribe,
    mountedStore.getSnapshot,
    mountedStore.getSnapshot,
  );

  return { isMounted };
};

export function PublicGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const { isMounted } = useAppState();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // When an SSO provider (e.g. Apple) posts back to /login with code+state,
  // the middleware converts it to a GET redirect with these params in the URL.
  // We must NOT redirect away while the token exchange is still in progress,
  // otherwise the guard loop: /login → /console → /login → ...
  const isSSOCallback = !!(
    searchParams.get("code") && searchParams.get("state")
  );

  useEffect(() => {
    if (!isMounted) return;
    if (isSSOCallback) return;
    if (isAuthenticated) {
      navigate("/app/console", { replace: true });
      return;
    }
  }, [isAuthenticated, isMounted, isSSOCallback, navigate]);

  if (!isMounted || (isAuthenticated && !isSSOCallback)) return null;
  return <>{children}</>;
}
