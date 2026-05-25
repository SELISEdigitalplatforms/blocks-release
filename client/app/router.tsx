import type { ExtractPaths } from "@/utils/type.util";
import { createBrowserRouter } from "react-router-dom";
import { routes } from "./routes";

export const router = createBrowserRouter([...routes]);

export type RouterType = ExtractPaths<typeof routes>;
