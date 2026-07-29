import { renderHook } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { useFilteredMenus } from "./use-filtered-menus";
import useRoutePathSegments from "./use-path-segments";
import type { Menu } from "@/models/menu.model";

const wrapperFor = (path: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

const menus: Menu[] = [
  { type: "menu", id: "overview-project", name: "Overview", path: "/o" },
  { type: "separator", id: "separator-overview" },
  { type: "menu", id: "deployment", name: "Deployment", path: "/d" },
  { type: "menu", id: "environments", name: "Env", path: "/e" },
  { type: "menu", id: "disabled-one", name: "Disabled", path: "/x", disabled: true },
  { type: "separator", id: "separator-tail" },
];

describe("useFilteredMenus", () => {
  it("hides project menus and keeps non-project menus off a project route", () => {
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/app/home"),
    });
    const ids = result.current.map((m) => m.id);
    expect(ids).toContain("deployment");
    expect(ids).not.toContain("environments");
  });

  it("hides non-project menus on a project overview route", () => {
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/app/project/tg1"),
    });
    const ids = result.current.map((m) => m.id);
    expect(ids).toContain("environments");
    expect(ids).not.toContain("deployment");
    expect(ids).not.toContain("separator-overview");
  });
});

describe("useRoutePathSegments", () => {
  it("builds breadcrumb segments with formatted labels", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/app/create-project"),
    });
    expect(result.current).toEqual([
      { href: "/app", label: "App" },
      { href: "/app/create-project", label: "Create Project" },
    ]);
  });

  it("returns an empty list at the root", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/"),
    });
    expect(result.current).toEqual([]);
  });
});
