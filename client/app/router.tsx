import type { ExtractPaths } from "@/utils/type.util";
import { createBrowserRouter } from "react-router";
import { routes } from "./routes";

export const router = createBrowserRouter([...routes]);

export type RouterType = ExtractPaths<typeof routes>;
