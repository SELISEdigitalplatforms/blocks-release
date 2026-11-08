import { Button } from "@/components/ui-kits/button/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui-kits/card/card";
import { Link } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
import { useState, useEffect, useRef } from "react";
import { useOIDCContext } from "@/layouts/oidc-layout/oidc-layout";
import { userAcknowledgement } from "@blocks-idp/authentication/services/oidc-auth-flow.service";

export const OIDCPermissionScreen = () => {
  const { t } = useT("release.idp");
  const contextValues = useOIDCContext();
  const { userName, themeColor, state, nonce, scope, redirectUri } =
    contextValues;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contextRef = useRef(contextValues);

  useEffect(() => {
    contextRef.current = contextValues;
  }, [contextValues, state, scope, redirectUri, nonce]);

  const handleDeny = () => {
    const currentContext = contextRef.current;

    if (!currentContext.redirectUri) {
      console.error("No redirect URI available");
      return;
    }

    const redirectUrl = new URL(currentContext.redirectUri);
    redirectUrl.searchParams.set("error", "access_denied");
    redirectUrl.searchParams.set(
      "error_description",
      "User denied the authorization request",
    );

    if (currentContext.state) {
      redirectUrl.searchParams.set("state", currentContext.state);
    }

    window.location.href = redirectUrl.toString();
  };

  const handleAllow = async () => {
    const currentContext = contextRef.current;

    if (!currentContext.clientId || !currentContext.projectKey) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await userAcknowledgement({
        scope: currentContext.scope || "",
        redirectUri: currentContext.redirectUri || "",
        clientId: currentContext.clientId || "",
        state: currentContext.state || "",
        nonce: currentContext.nonce || "",
        isAcknowledged: true,
        username: currentContext.userName || "",
        projectKey: currentContext.projectKey,
      });

      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        console.error("No redirect URL in acknowledgement response:", result);
      }
    } catch (error) {
      console.error("Error during acknowledgement:", error);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Card className="flex h-full flex-col rounded border-solid border-background shadow-none md:min-w-[448px] md:border-[#95ADC4] lg:max-w-md">
      <CardHeader className="text-center">
        <div className="space-y-1">
          <div className="text-3xl font-semibold">{t("OIDC_PERMISSION.HELLO")}</div>
          {userName && (
            <div className="wrap-break-word text-xl font-medium text-muted-foreground">
              {userName}
            </div>
          )}
        </div>
        <CardDescription className="mt-3 text-lg text-foreground">
          {t("OIDC_PERMISSION.INTRO")}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-2 flex flex-1 flex-col justify-between">
        <div className="space-y-4">
          <div className="text-left text-sm text-foreground">
            <p className="font-semibold">{t("OIDC_PERMISSION.WOULD_LIKE_TO")}</p>
            <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
              <li>{t("OIDC_PERMISSION.ITEM_AUTHENTICATE")}</li>
              <li>{t("OIDC_PERMISSION.ITEM_PROFILE")}</li>
              <li>{t("OIDC_PERMISSION.ITEM_PROJECTS")}</li>
            </ul>
          </div>
          <div className="my-4 text-left text-sm text-foreground">
            {t("OIDC_PERMISSION.CONSENT_PREFIX")}{" "}
            <Link
              to="https://selisegroup.com/software-development-terms/"
              className="underline"
              style={{ color: themeColor }}
              target="_blank">
              {t("OIDC_PERMISSION.TERMS")}{" "}
            </Link>
            {t("OIDC_PERMISSION.AND")}{" "}
            <Link
              to="https://selisegroup.com/privacy-policy/"
              className="underline"
              style={{ color: themeColor }}
              target="_blank">
              {t("OIDC_PERMISSION.PRIVACY")}
            </Link>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center">
          <div className="mt-4 flex w-full gap-2 text-medium-emphasis">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
              onClick={handleDeny}>
              {t("OIDC_PERMISSION.DENY")}
            </Button>
            <Button
              className="flex-1"
              disabled={isSubmitting}
              onClick={handleAllow}
              style={{ backgroundColor: themeColor }}>
              {t("OIDC_PERMISSION.ALLOW")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
