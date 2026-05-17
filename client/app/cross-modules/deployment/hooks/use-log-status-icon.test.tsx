import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStatusIcon } from "./use-log-status-icon";
import React from "react";

describe("useStatusIcon", () => {
  it("should return correct icon for success status", () => {
    const { result } = renderHook(() => useStatusIcon());
    const icon = result.current.getStatusIcon("success");
    
    expect(icon).not.toBeNull();
    // Check if it's a div with green bg (standard way to verify React nodes in unit tests)
    const iconElement = icon as React.ReactElement;
    expect(iconElement.props.className).toContain("bg-green-600");
  });

  it("should return correct icon for error status", () => {
    const { result } = renderHook(() => useStatusIcon());
    const icon = result.current.getStatusIcon("error");
    
    expect(icon).not.toBeNull();
    const iconElement = icon as React.ReactElement;
    expect(iconElement.props.className).toContain("bg-red-600");
  });

  it("should return loader for running status", () => {
    const { result } = renderHook(() => useStatusIcon());
    const icon = result.current.getStatusIcon("running");
    
    expect(icon).not.toBeNull();
    const iconElement = icon as React.ReactElement;
    expect(iconElement.props.className).toContain("animate-spin");
  });

  it("should return null for unknown status", () => {
    const { result } = renderHook(() => useStatusIcon());
    const icon = result.current.getStatusIcon("unknown");
    
    expect(icon).toBeNull();
  });
});
