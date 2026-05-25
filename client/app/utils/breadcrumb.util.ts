import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title.constant";
import type { RouterType } from "@/router";

export function clearBreadCrumbTitleEntry(pathName: RouterType) {
  BREADCRUMB_CUSTOM_TITLES[pathName] = null;
}
