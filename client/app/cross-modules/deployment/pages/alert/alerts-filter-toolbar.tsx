import { FilterToolbar, useSortQueryParams } from "@/components/filter-toolbar";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

type ALertFilter = { search: string; repositories: string[] };

export const useAlertFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    search: parseAsString.withDefault(""),
    repositories: parseAsArrayOf(parseAsString).withDefault([]),
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
  });
  return { queryParams, setQueryParams };
};
export const useAlertSortQueryParams = () =>
  useSortQueryParams({ initial: { property: "name", isDescending: false } });

type AlertFilterToolBarProps = {
  repositories: { value: string; label: string }[];
};

export function AlertsFilterToolbar({ repositories }: AlertFilterToolBarProps) {
  const { queryParams, setQueryParams } = useAlertFilterQueryParams();

  const changeHandler = (key: string, value: unknown) => {
    setQueryParams((params) => ({
      ...params,
      [key]: value,
      page: 0,
    }));
  };
  const resetHandler = () => setQueryParams(null);

  return (
    <FilterToolbar<ALertFilter>
      filters={[
        { key: "search", type: "SearchInput", label: "" },
        {
          key: "repositories",
          type: "MultiSelect",
          label: "Repositories",
          props: { options: repositories },
        },
      ]}
      values={{ search: queryParams.search, repositories: queryParams.repositories }}
      defaultValues={{ search: "", repositories: [] }}
      onChange={changeHandler}
      onReset={resetHandler}
    />
  );
}
