import { UserRound } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { Link } from "react-router";
import { LogOutButton } from "@/components/auth/log-out-button";
import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { useGetUser } from "@blocks-idp/iam/hooks/use-user";

function UserDropdownMenuLogo() {
  const { t } = useT("release.shared");
  const { data } = useGetUser({ enabled: true });
  const userData = data?.data || {
    firstName: "",
    lastName: "",
    profileImageUrl: "",
  };
  const initials =
    `${userData.firstName?.[0] || ""}${userData.lastName?.[0] || ""}`.toUpperCase();

  if (userData.profileImageUrl) {
    return (
      <img
        src={userData.profileImageUrl}
        alt={t("USER_DROPDOWN_MENU.PROFILE_ALT")}
        className="h-full w-full object-cover"
      />
    );
  }

  if (initials) {
    return <span>{initials}</span>;
  }

  return <UserRound className="h-4 w-4" />;
}

export function UserDropdownMenu() {
  const { t } = useT("release.shared");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="link"
          size="icon"
          className="relative h-10 w-10 overflow-hidden rounded-full bg-[hsl(var(--avatar-surface-default))] p-0 text-base font-normal text-[hsl(var(--avatar-text-high-emphasis))] hover:no-underline">
          <UserDropdownMenuLogo />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/app/profile">{t("USER_DROPDOWN_MENU.MY_PROFILE")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {t("USER_DROPDOWN_MENU.PRIVACY")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {t("USER_DROPDOWN_MENU.SUPPORT")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <LogOutButton />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
