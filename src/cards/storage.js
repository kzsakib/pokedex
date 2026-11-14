/* Binder persistence. */
const KEY = "kanto-packs-v1";

export const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, holo: 3, legend: 4 };

function empty() {
  return { packs: 0, owned: {}, rarest: null, shinies: 0 };
}

export function loadBinder() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty();
    return {
      packs: parsed.packs || 0,
      owned: parsed.owned && typeof parsed.owned === "object" ? parsed.owned : {},
      rarest: parsed.rarest || null,
      shinies: parsed.shinies || 0,
    };
  } catch {
    return empty();
  }
}

export function saveBinder(binder) {
  try {
    localStorage.setItem(KEY, JSON.stringify(binder));
  } catch {
    /* storage may be unavailable; the session still works */
  }
}

export function recordPack(binder, cards) {
  binder.packs += 1;
  for (const card of cards) {
    const id = String(card.id);
    const current = binder.owned[id];
    const better =
      !current ||
      (card.shiny && !current.shiny) ||
      (card.shiny === current.shiny && RARITY_RANK[card.rarity] > RARITY_RANK[current.rarity]);
    if (better) {
      binder.owned[id] = {
        rarity: card.rarity,
        shiny: card.shiny,
        name: card.name,
        count: (current?.count || 0) + 1,
      };
    } else {
      current.count = (current.count || 0) + 1;
    }
    if (card.shiny) binder.shinies += 1;
    if (!binder.rarest || RARITY_RANK[card.rarity] > RARITY_RANK[binder.rarest.rarity]) {
      binder.rarest = { id, name: card.name, rarity: card.rarity, shiny: card.shiny };
    }
  }
  saveBinder(binder);
  return binder;
}

export function resetBinder() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return empty();
}
