export const getUniqueID = (): string => {
  const timestamp = Date.now();
  const randomLetters = Array.from({ length: 6 }, () =>
    String.fromCharCode(Math.floor(Math.random() * (90 - 65 + 1)) + 65),
  ).join("");
  return `BLK-${timestamp}-${randomLetters}`;
};
