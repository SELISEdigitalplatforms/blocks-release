type ApiErrorItem = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

export type FastAPIError = string | ApiErrorItem | ApiErrorItem[];
