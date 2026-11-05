import { pool } from "./api";

/* ------------------------------------------------------------------
   Stat census — base stats for every species PokéAPI knows about, so a
   specimen's bar can say "faster than 74% of Pokémon" instead of only
   ranking it against the first 151.

   The walk is ~1300 small requests, so it runs in the background once,
   is cached in localStorage, and everything falls back to the loaded
   registry until it lands.
   ------------------------------------------------------------------ */

const API_ROOT = "https://pokeapi.co/api/v2";
const STORAGE_KEY = "pokedex.statCensus.v1";
const MIN_ROWS = 400;

export const STAT_KEYS = [
  "hp",
  "attack",
  "defense",
  "special-attack",
  "special-defense",
  "speed",
];

const indexes = new WeakMap();

export function readCachedCensus() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.rows) || parsed.rows.length < MIN_ROWS) {
      return null;
    }
    return parsed.rows;
  } catch {
    return null;
  }
}

/* Sorted columns per stat, computed once per dataset. */
export function buildIndex(rows) {
  if (!rows?.length) return null;
  if (indexes.has(rows)) return indexes.get(rows);
  const columns = STAT_KEYS.map((_, position) =>
    rows.map((row) => row[position]).sort((a, b) => a - b),
  );
  const index = { columns, size: rows.length };
  indexes.set(rows, index);
  return index;
}

export function percentileFor(index, statName, value) {
  if (!index) return null;
  const position = STAT_KEYS.indexOf(statName);
  if (position < 0) return null;
  const column = index.columns[position];
  let low = 0;
  let high = column.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (column[middle] < value) low = middle + 1;
    else high = middle;
  }
  return Math.round((low / column.length) * 100);
}

export async function buildCensus(onProgress) {
  const response = await fetch(`${API_ROOT}/pokemon?limit=1600`);
  if (!response.ok) throw new Error("census list failed");
  const list = await response.json();
  const rows = [];
  let done = 0;

  await pool(
    list.results ?? [],
    async (item) => {
      try {
        const answer = await fetch(item.url);
        if (!answer.ok) return;
        const data = await answer.json();
        const row = STAT_KEYS.map(
          (key) =>
            data.stats?.find((slot) => slot.stat.name === key)?.base_stat ?? 0,
        );
        if (row.every((value) => value > 0)) rows.push(row);
      } catch {
        /* one missing species must not stop the census */
      }
    },
    6,
    (finished) => {
      done = finished;
      onProgress?.(done, list.results?.length ?? 0);
    },
  );

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ at: Date.now(), rows }),
    );
  } catch {
    /* private mode or a full quota: the census still works this session */
  }
  return rows;
}
