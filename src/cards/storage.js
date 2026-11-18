/* Binder persistence. */
const KEY = "kanto-packs-v1";

export const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, holo: 3, chroma: 4, fusion: 5, legend: 6 };

function empty() {
  return { packs: 0, owned: {}, rarest: null, shinies: 0, pulls: [] };
}

/* just the fields the card renderer needs, so the binder stays small */
function snapshot(card) {
  return {
    id: card.id, name: card.name, genus: card.genus, tcg: card.tcg, stage: card.stage,
    level: card.level, hp: card.hp, rarity: card.rarity, shiny: card.shiny, sprite: card.sprite,
    moves: card.moves, weakness: card.weakness, resistance: card.resistance,
    retreat: card.retreat, height: card.height, weight: card.weight, finish: card.finish,
    flavour: card.flavour || "",
    entry: card.entry || "",
    fusion: card.fusion ? { ...card.fusion } : null,
    variant: card.variant ? { key: card.variant.key, label: card.variant.label, tcg: card.variant.tcg, note: card.variant.note, hueMap: card.variant.hueMap } : null,
  };
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
      pulls: Array.isArray(parsed.pulls) ? parsed.pulls : [],
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
  binder.pulls = binder.pulls || [];
  for (const card of cards) {
    const id = String(card.id);
    /* a fusion is its own creature: it never fills one of the 151 slots */
    if (!card.fusion) {
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
    }
    binder.pulls.unshift({ card: snapshot(card), at: Date.now() });
    if (card.shiny) binder.shinies += 1;
    if (!binder.rarest || RARITY_RANK[card.rarity] > RARITY_RANK[binder.rarest.rarity]) {
      binder.rarest = { id, name: card.name, rarity: card.rarity, shiny: card.shiny };
    }
  }
  binder.pulls = binder.pulls.slice(0, 80);
  saveBinder(binder);
  return binder;
}

/* pulls saved before entries were kept get backfilled when the lore arrives */
export function backfillNote(binder, card) {
  let changed = false;
  for (const pull of binder.pulls || []) {
    const c = pull.card;
    if (!c || !c.variant) continue;
    if (c.id !== card.id) continue;
    if (c.variant.key !== card.variant.key) continue;
    c.variant.note = card.variant.note;
    changed = true;
  }
  if (changed) saveBinder(binder);
  return changed;
}

/* fusion entries arrive after the pack is stored, so the binder gets them late */
export function backfillEntry(binder, card) {
  let changed = false;
  for (const pull of binder.pulls || []) {
    const c = pull.card;
    if (!c || !c.fusion || !card.fusion) continue;
    if (c.fusion.head !== card.fusion.head || c.fusion.body !== card.fusion.body) continue;
    c.entry = card.entry;
    changed = true;
  }
  if (changed) saveBinder(binder);
  return changed;
}

export function resetBinder() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return empty();
}
