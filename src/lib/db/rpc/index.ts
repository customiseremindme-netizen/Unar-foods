import type { RpcHandler } from "../rest/handler";
import * as content from "./content";
import * as misc from "./misc";
import * as orders from "./orders";
import * as reports from "./reports";

/** Every function callable with db.rpc("name", args). */
export const RPCS: Record<string, RpcHandler> = {
  ...orders,
  ...content,
  ...misc,
  ...reports,
};
