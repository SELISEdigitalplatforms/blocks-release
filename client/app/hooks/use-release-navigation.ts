import { useMemo } from "react";
import { useParams } from "react-router";
import { useFilteredMenus, type PaletteNavSection } from "@seliseblocks/app-kit";
import { navigationMenus } from "@/constants/navigation-menus.constant";

/** The sidebar and command menu share the same filtered, URL-scoped destinations. */
export function useReleaseNavigation(): PaletteNavSection[] {
  const { itemId } = useParams();
  const menus = useFilteredMenus(navigationMenus);

  return useMemo(() => {
    if (!itemId) return [];
    const items = menus.flatMap((menu) =>
      menu.type === "menu"
        ? [{ ...menu, path: menu.path.replace(/^\/app\//, `/app/${itemId}/`) }]
        : [],
    );
    return [
      { id: "overview", items: items.filter((item) => item.id === "overview-project") },
      {
        id: "release",
        label: "Release",
        items: items.filter((item) => item.id !== "overview-project"),
      },
    ].filter((section) => section.items.length > 0);
  }, [itemId, menus]);
}
