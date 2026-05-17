export type JoinPaths<
  P extends string,
  C extends string,
> = C extends `/${string}` ? C : P extends "" | "/" ? `/${C}` : `${P}/${C}`;

export type ExtractPaths<
  T,
  Parent extends string = "",
> = T extends readonly (infer R)[]
  ? ExtractPaths<R, Parent>
  : T extends { path: infer P extends string; children?: infer C }
    ?
        | JoinPaths<Parent, P>
        | (C extends readonly unknown[]
            ? ExtractPaths<C, JoinPaths<Parent, P>>
            : never)
    : T extends { children?: infer C }
      ? C extends readonly unknown[]
        ? ExtractPaths<C, Parent>
        : never
      : never;

export type PartialOnly<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
