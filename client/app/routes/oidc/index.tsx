import { useEffect, useEffectEvent } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { OIDCPermissionWrapper } from "@blocks-idp/authentication/pages/oidc/permission-wrapper";
import { OIDCSignin } from "@blocks-idp/authentication/pages/oidc/oidc-signin";
import { authService } from "@blocks-idp/authentication/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { Loader } from "lucide-react";

export default function OidcIndexPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthenticated, setTokens } = useAuthStore();

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const userName = searchParams.get("userName");

  // The outcome handlers are effect events: they always see the current store setters and
  // navigate, yet are not dependencies, so the exchange below runs only when code/state change.
  const onExchangeSucceeded = useEffectEvent(
    (res: Awaited<ReturnType<typeof authService.verifyOidc>>) => {
      const isLocalDevelopment =
        import.meta.env.DEV ||
        globalThis.window.location.hostname === "localhost" ||
        globalThis.window.location.hostname === "127.0.0.1";

      if (isLocalDevelopment && res.access_token && res.refresh_token) {
        setTokens(res.access_token, res.refresh_token);
      }
      setAuthenticated();

      globalThis.window.location.href = `${globalThis.window.location.origin}/console`;
    },
  );
  const onExchangeFailed = useEffectEvent(() => {
    navigate("/oidc/error");
  });

  // While code+state are present the loader below is rendered, so no separate
  // "exchanging" flag is needed.
  useEffect(() => {
    if (!code || !state) return;

    authService
      .verifyOidc({ code, state })
      .then((res) => {
        onExchangeSucceeded(res);
      })
      .catch(() => {
        onExchangeFailed();
      });
  }, [code, state]);

  if (code && state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="h-12 w-12 animate-spin text-gray-500" />
      </div>
    );
  }

  if (userName && userName.trim() !== "") {
    return <OIDCPermissionWrapper />;
  }

  return <OIDCSignin />;
}
