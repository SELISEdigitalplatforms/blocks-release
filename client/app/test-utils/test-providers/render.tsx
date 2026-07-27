import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

/**
 * Renders a component wrapped in the providers most app components expect:
 * a fresh React Query client (retries disabled for deterministic async) and a
 * MemoryRouter so router hooks (useLocation/useNavigate/useParams) work.
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  options: { route?: string; nuqs?: boolean } & Omit<RenderOptions, "wrapper"> = {},
) => {
  const { route = "/", nuqs = false, ...rest } = options;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const inner = nuqs ? (
      <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
    ) : (
      children
    );
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{inner}</MemoryRouter>
      </QueryClientProvider>
    );
  };
  return render(ui, { wrapper: Wrapper, ...rest });
};
