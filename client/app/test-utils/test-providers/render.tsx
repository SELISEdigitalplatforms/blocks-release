import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

/**
 * Renders a component wrapped in the providers most app components expect:
 * a fresh React Query client (retries disabled for deterministic async) and a
 * MemoryRouter so router hooks (useLocation/useNavigate/useParams) work.
 */
export const renderWithProviders = (
  ui: React.ReactElement,
  options: { route?: string } & Omit<RenderOptions, "wrapper"> = {},
) => {
  const { route = "/", ...rest } = options;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...rest });
};
