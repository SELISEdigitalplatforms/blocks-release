/**
 * Test double for `@seliseblocks/genesis-os/observability`.
 *
 * The real module constructs a Rollbar client, which installs window handlers and telemetry
 * instrumentation at import time. Nothing under test asserts on reporting, so the stub keeps the
 * shapes and does nothing.
 */
import React from "react";

export const getRollbar = () => ({}) as never;

export const createHttpFailureReporter = () => () => {};

export const attachQueryErrorReporting = () => () => {};

export const RollbarProvider = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);
