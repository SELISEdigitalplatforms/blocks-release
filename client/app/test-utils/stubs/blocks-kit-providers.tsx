/**
 * Test double for `@seliseblocks/blocks-kit/providers`.
 */
import React from "react";

export const ThemeProvider = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);
