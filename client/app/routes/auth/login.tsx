import { useState } from "react";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { showErrorToast } from "@/hooks/use-toast";
import { BlocksLoginPage } from "@/components/blocks-login-page";

export default function LoginPage() {
  const [isStarting, setIsStarting] = useState(false);

  const startLogin = async () => {
    try {
      if (isStarting) return;
      setIsStarting(true);

      const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
      const clientId = getRuntimeEnv("BLOCKS_OIDC_CLIENT_ID");
      const idpBaseUrl = getRuntimeEnv("BLOCKS_IDP_BASE_URL");
      const redirectUrlBase =
        getRuntimeEnv("BLOCKS_APP_URL", {
          stripPort: true,
          ensureTrailingSlash: true,
        }) || "https://dev-release.blocksdevelopers.com/";
      const redirectUri = `${redirectUrlBase}login/callback`;
      const initiateUrl = `${idpBaseUrl}/api/idp/initiate?x-blocks-key=${blocksKey}&clientId=${clientId}&redirectUri=${redirectUri}`;
      const headers: Record<string, string> = {};
      if (blocksKey) headers["X-Blocks-Key"] = blocksKey;

      const response = await fetch(initiateUrl.toString(), { headers });
      const data = await response.json();

      if (data.redirect_uri) {
        window.location.href = data.redirect_uri;
      } else {
        showErrorToast({ errors: "Failed to get authorization URL" });
        setIsStarting(false);
      }
    } catch (errors) {
      console.error("Login initiation error:", errors);
      showErrorToast({ errors: "Unable to start login. Please try again." });
      setIsStarting(false);
    }
  };

  return (
    <BlocksLoginPage
      name="blocks-release"
      onLogin={startLogin}
      isLoading={isStarting}
    />
  );
}
