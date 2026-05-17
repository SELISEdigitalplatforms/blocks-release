export const clearQueryString = (options?: { except?: string[] }) => {
  const url = new URL(window.location.href);
  const newParams = new URLSearchParams();

  const keysToKeep = options?.except ?? [];

  keysToKeep.forEach((key) => {
    const value = url.searchParams.get(key);
    if (value !== null) {
      newParams.set(key, value);
    }
  });

  url.search = newParams.toString();
  window.history.replaceState(null, "", url.toString());
};
