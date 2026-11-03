import { useMemo } from "react";
import { useT } from "@seliseblocks/genesis-os";
import { getNavigationMenus } from "@/constants/navigation-menus.constant";
import type { Menu } from "@/models/menu.model";

/** Sidebar menus with names in the language the UI shows now. */
export function useNavigationMenus(): Menu[] {
  const { language } = useT("release.shared");
  // `language` is a dependency on purpose: names must be rebuilt when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getNavigationMenus(), [language]);
}
