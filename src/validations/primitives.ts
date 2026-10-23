export function parseEnum(s: unknown, set: Set<string>): string | null {
  if (typeof s !== "string" || !set.has(s)) return null;
  return s;
}

export function parseNonEmptyString(s: unknown): string | null {
  if (typeof s !== "string" || s.trim().length === 0) return null;
  return s;
}

export function parseDate(d: unknown): Date | null {
  if (typeof d !== "string") return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

export function parseLimit(n: unknown): number | null {
  if (typeof n !== "string" || !/^\d+$/.test(n)) return null;
  const value = Number(n);
  return value >= 1 && value <= 1000 ? value : null;
}

export function parseCursor(n: unknown): bigint | null {
  if (typeof n !== "string" || !/^\d+$/.test(n)) return null;
  return BigInt(n);
}


// export function parseBucket(s:unknown , BS: Set<string> ): string | null {

//   if(typeof s !== "string" || !BS.has(s) ) return null;
//   return s;

// }