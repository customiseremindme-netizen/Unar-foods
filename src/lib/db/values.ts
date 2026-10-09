import type { Column } from "./schema";

/** ISO string / Date → 'YYYY-MM-DD HH:MM:SS.mmm' (UTC) for DATETIME(3) columns. */
export function toSqlDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else {
    const s = String(value).trim();
    // Date-times without a time zone are UTC (that's how the database stores them).
    const noZone = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s);
    date = new Date(noZone ? `${s.replace(" ", "T")}Z` : s);
  }
  if (Number.isNaN(date.getTime())) throw new DbValueError(`Invalid date: ${String(value)}`);
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/** 'YYYY-MM-DD HH:MM:SS(.mmm)' (UTC, from the driver) → ISO string. */
export function fromSqlDateTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? s : date.toISOString();
}

export class DbValueError extends Error {}

/** Converts an app value to what MySQL stores for this column. */
export function toDb(col: Column, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  switch (col.type) {
    case "bool":
      if (typeof value === "string") return value === "true" || value === "t" || value === "1" ? 1 : 0;
      return value ? 1 : 0;
    case "json":
      return JSON.stringify(value);
    case "datetime":
      return toSqlDateTime(value);
    case "int":
    case "bigint":
    case "serial": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) throw new DbValueError(`Invalid number: ${String(value)}`);
      return Math.trunc(n);
    }
    case "decimal": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) throw new DbValueError(`Invalid number: ${String(value)}`);
      return n;
    }
    case "blob":
      return value;
    default:
      return typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/** Converts a raw MySQL value into the shape the app expects (same as the old Postgres API). */
export function fromDb(col: Column, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (col.type) {
    case "bool":
      return value === true || value === 1 || value === "1" || (typeof value === "object" && value !== null && (value as Buffer)[0] === 1);
    case "json":
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    case "datetime":
      return fromSqlDateTime(value);
    case "int":
    case "bigint":
    case "serial":
    case "decimal":
      return typeof value === "number" ? value : Number(value);
    default:
      return value;
  }
}

/** Coerces a filter value from a query string ("true", "12", ISO date) for comparison with a column. */
export function filterValue(col: Column, raw: string): unknown {
  switch (col.type) {
    case "bool":
      return raw === "true" || raw === "t" || raw === "1" ? 1 : 0;
    case "int":
    case "bigint":
    case "serial":
    case "decimal": {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new DbValueError(`Invalid number filter: ${raw}`);
      return n;
    }
    case "datetime":
      return toSqlDateTime(raw);
    default:
      return raw;
  }
}
