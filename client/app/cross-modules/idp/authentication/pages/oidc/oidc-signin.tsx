import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { useT } from "@seliseblocks/genesis-os";
import { OidcSigninForm } from "./oidc-signin-form";

export const OIDCSignin = () => {
  const { t } = useT("release.idp");
  return (
    <Card className="flex h-full flex-col rounded border-solid border-background shadow-none md:min-w-[448px] md:border-[#95ADC4] lg:max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl">{t("OIDC_SIGNIN.TITLE")}</CardTitle>
        <CardDescription className="text-xl text-foreground">
          {t("OIDC_SIGNIN.LOG_IN")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between">
        <div className="flex flex-1 flex-col justify-center">
          <OidcSigninForm />
        </div>
        <div className="mb-3 flex items-center justify-center"></div>
      </CardContent>
    </Card>
  );
};
