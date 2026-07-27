export const debounce = <A extends unknown[]>(
  fn: (...args: A) => unknown,
  ms = 300,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | null;
  const debounced = function (this: unknown, ...args: A) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
};
