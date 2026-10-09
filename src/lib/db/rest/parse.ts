/**
 * Parses the query format the data API speaks (the same one PostgREST uses,
 * so existing code like `.from("orders").select("id, order_items(*)")` keeps
 * working): select lists with embedded relations, filters, ordering.
 */

export class QueryParseError extends Error {}

export type SelectNode =
  | { kind: "star" }
  | { kind: "column"; name: string; alias: string }
  | { kind: "embed"; relation: string; alias: string; hint?: string; inner: boolean; children: SelectNode[] };

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in";

export type Filter =
  | { kind: "cond"; column: string; op: FilterOp; negate: boolean; value: string | string[] }
  | { kind: "or" | "and"; negate: boolean; items: Filter[] };

export type OrderTerm = { column: string; ascending: boolean; nulls?: "first" | "last" };

const IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Splits on top-level commas, respecting parentheses and double quotes. */
export function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "\\" && quoted && i + 1 < input.length) {
      current += ch + input[++i];
      continue;
    }
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "(") depth++;
    else if (!quoted && ch === ")") depth--;
    if (depth < 0) throw new QueryParseError("Unbalanced parentheses");
    if (ch === "," && depth === 0 && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (depth !== 0 || quoted) throw new QueryParseError("Unbalanced parentheses or quotes");
  if (current !== "" || out.length) out.push(current);
  return out;
}

function stripWhitespace(input: string): string {
  let out = "";
  let quoted = false;
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && /\s/.test(ch)) continue;
    out += ch;
  }
  return out;
}

export function parseSelect(raw: string | null | undefined): SelectNode[] {
  const input = stripWhitespace(raw ?? "*");
  if (input === "" || input === "*") return [{ kind: "star" }];
  return splitTopLevel(input).map(parseSelectItem);
}

function parseSelectItem(item: string): SelectNode {
  if (item === "*") return { kind: "star" };
  const open = item.indexOf("(");
  if (open !== -1) {
    if (!item.endsWith(")")) throw new QueryParseError(`Invalid select item "${item}"`);
    let head = item.slice(0, open);
    const body = item.slice(open + 1, -1);
    let alias: string | undefined;
    const colon = head.indexOf(":");
    if (colon !== -1) {
      alias = head.slice(0, colon);
      head = head.slice(colon + 1);
    }
    const [relation, ...mods] = head.split("!");
    let inner = false;
    let hint: string | undefined;
    for (const mod of mods) {
      if (mod === "inner") inner = true;
      else if (mod === "left") inner = false;
      else hint = mod;
    }
    if (!IDENT.test(relation) || (alias && !IDENT.test(alias)) || (hint && !IDENT.test(hint))) {
      throw new QueryParseError(`Invalid embedded resource "${head}"`);
    }
    return { kind: "embed", relation, alias: alias ?? relation, hint, inner, children: parseSelect(body) };
  }
  let name = item;
  let alias: string | undefined;
  const colon = name.indexOf(":");
  if (colon !== -1 && name[colon + 1] !== ":") {
    alias = name.slice(0, colon);
    name = name.slice(colon + 1);
  }
  name = name.replace(/::[a-z0-9_]+$/i, ""); // casts are ignored
  if (!IDENT.test(name) || (alias && !IDENT.test(alias))) throw new QueryParseError(`Invalid column "${item}"`);
  return { kind: "column", name, alias: alias ?? name };
}

const OPS = new Set<FilterOp>(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"]);

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(.)/g, "$1");
  }
  return value;
}

/** Parses "not.in.(a,b)" / "eq.5" for a given column. */
export function parseCondition(column: string, expr: string): Filter {
  let rest = expr;
  let negate = false;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  if (dot === -1) throw new QueryParseError(`Invalid filter "${expr}"`);
  const op = rest.slice(0, dot) as FilterOp;
  const value = rest.slice(dot + 1);
  if (!OPS.has(op)) throw new QueryParseError(`Unsupported filter operator "${op}"`);
  if (op === "in") {
    if (!value.startsWith("(") || !value.endsWith(")")) throw new QueryParseError(`Invalid list "${value}"`);
    const inner = value.slice(1, -1);
    const items = inner === "" ? [] : splitTopLevel(inner).map(unquote);
    return { kind: "cond", column, op, negate, value: items };
  }
  return { kind: "cond", column, op, negate, value: op === "like" || op === "ilike" ? value.replace(/\*/g, "%") : unquote(value) };
}

/** Parses the inside of or=(...) / and=(...). */
export function parseLogic(kind: "or" | "and", negate: boolean, expr: string): Filter {
  if (!expr.startsWith("(") || !expr.endsWith(")")) throw new QueryParseError(`Invalid ${kind} filter "${expr}"`);
  const items = splitTopLevel(expr.slice(1, -1)).map((part): Filter => {
    const logic = /^(not\.)?(or|and)(\([\s\S]*\))$/.exec(part);
    if (logic) return parseLogic(logic[2] as "or" | "and", !!logic[1], logic[3]);
    const dot = part.indexOf(".");
    if (dot === -1) throw new QueryParseError(`Invalid filter "${part}"`);
    const column = part.slice(0, dot);
    if (!IDENT.test(column)) throw new QueryParseError(`Invalid column "${column}"`);
    return parseCondition(column, part.slice(dot + 1));
  });
  return { kind, negate, items };
}

export function parseOrder(raw: string): OrderTerm[] {
  return splitTopLevel(stripWhitespace(raw)).map((term) => {
    const [column, ...mods] = term.split(".");
    if (!IDENT.test(column)) throw new QueryParseError(`Invalid order column "${column}"`);
    const out: OrderTerm = { column, ascending: true };
    for (const mod of mods) {
      if (mod === "asc") out.ascending = true;
      else if (mod === "desc") out.ascending = false;
      else if (mod === "nullsfirst") out.nulls = "first";
      else if (mod === "nullslast") out.nulls = "last";
      else throw new QueryParseError(`Invalid order "${term}"`);
    }
    return out;
  });
}

export type ParsedQuery = {
  select: SelectNode[];
  /** filters keyed by embed path ("" = the main table, "orders" = embedded orders) */
  filters: Map<string, Filter[]>;
  order: Map<string, OrderTerm[]>;
  limit: Map<string, number>;
  offset: Map<string, number>;
  columns?: string[];
  onConflict?: string[];
};

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function toInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new QueryParseError(`Invalid number "${value}"`);
  return n;
}

export function parseQuery(params: URLSearchParams): ParsedQuery {
  const parsed: ParsedQuery = {
    select: parseSelect(params.get("select")),
    filters: new Map(),
    order: new Map(),
    limit: new Map(),
    offset: new Map(),
  };
  for (const [key, value] of params) {
    if (key === "columns") {
      parsed.columns = splitTopLevel(stripWhitespace(value)).map((c) => unquote(c));
      continue;
    }
    if (key === "on_conflict") {
      parsed.onConflict = splitTopLevel(stripWhitespace(value));
      continue;
    }
    if (key === "select") continue;
    const parts = key.split(".");
    const last = parts.at(-1)!;
    const path = parts.slice(0, -1).join(".");
    if (last === "order") {
      parsed.order.set(path, parseOrder(value));
    } else if (last === "limit") {
      parsed.limit.set(path, toInt(value));
    } else if (last === "offset") {
      parsed.offset.set(path, toInt(value));
    } else if (last === "or" || last === "and") {
      push(parsed.filters, path, parseLogic(last, false, value));
    } else {
      if (!IDENT.test(last)) throw new QueryParseError(`Invalid column "${last}"`);
      push(parsed.filters, path, parseCondition(last, value));
    }
  }
  return parsed;
}
