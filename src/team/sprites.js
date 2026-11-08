/* Animated overworld sprites from PMDCollab's SpriteCollab.

   A Pokémon is three small requests — AnimData.xml, Walk-Anim.png and
   Idle-Anim.png — so they are fetched on demand, kept for the session and
   warmed ahead of the round that will need them. The XML carries the frame
   size and per-frame durations; the sheets are uniform strips. */

const ROOT = "https://cdn.jsdelivr.net/gh/PMDCollab/SpriteCollab@master/sprite";
const MIRROR =
  "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite";

const WANTED = ["Walk", "Run", "Idle"];

/* id -> resolved sprite, id -> the promise that resolves to it */
const done = new Map();
const pending = new Map();

const folder = (id) => String(id).padStart(4, "0");
const fileUrl = (base, id, file) => `${base}/${folder(id)}/${file}`;

function parseAnimData(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) return null;

  const anims = {};
  doc.querySelectorAll("Anims > Anim").forEach((node) => {
    const name = node.querySelector("Name")?.textContent?.trim();
    if (!name) return;
    const copy = node.querySelector("CopyOf")?.textContent?.trim();
    if (copy) {
      anims[name] = { copyOf: copy };
      return;
    }
    const durations = [...node.querySelectorAll("Durations > Duration")]
      .map((n) => Number(n.textContent))
      .filter((n) => Number.isFinite(n) && n > 0);
    anims[name] = {
      width: Number(node.querySelector("FrameWidth")?.textContent) || 32,
      height: Number(node.querySelector("FrameHeight")?.textContent) || 32,
      durations,
    };
  });

  /* "Strike" is "Attack", "Dance" is "Shake": resolve aliases in place. */
  Object.keys(anims).forEach((name) => {
    const anim = anims[name];
    if (!anim.copyOf) return;
    const source = anims[anim.copyOf];
    anims[name] = source
      ? { ...source, durations: [...source.durations] }
      : { ...anim, copyOf: undefined, width: 32, height: 32, durations: [4] };
  });

  return anims;
}

/* How many pixels of empty cell sit under the creature's feet. PMD frames
   keep a little transparent padding at the bottom, so a sprite pinned by its
   frame hangs above its shadow by that much once it is scaled up. */
function footOffset(image) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    for (let y = image.height - 1; y >= 0; y -= 1) {
      for (let x = 0; x < image.width; x += 1) {
        if (data[(y * image.width + x) * 4 + 3] > 12) {
          return image.height - 1 - y;
        }
      }
    }
  } catch {
    /* a tainted canvas just means the frame stays as it is */
  }
  return 0;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite sheet ${url}`));
    img.src = url;
  });
}

async function fetchText(id) {
  for (const base of [ROOT, MIRROR]) {
    try {
      const res = await fetch(fileUrl(base, id, "AnimData.xml"), {
        mode: "cors",
      });
      if (res.ok) return { text: await res.text(), base };
    } catch {
      /* try the mirror */
    }
  }
  throw new Error(`no AnimData for ${id}`);
}

/* Resolves to { anims, images, names } where names lists the animations that
   both exist in the XML and downloaded. Rejects only if nothing usable. */
export function fetchPmd(id) {
  if (done.has(id)) return Promise.resolve(done.get(id));
  if (pending.has(id)) return pending.get(id);

  const job = (async () => {
    const { text, base } = await fetchText(id);
    const anims = parseAnimData(text);
    if (!anims) throw new Error(`bad AnimData for ${id}`);

    const names = WANTED.filter((name) => anims[name]?.durations?.length);
    if (!names.length) throw new Error(`no animation for ${id}`);

    const images = {};
    await Promise.all(
      names.map(async (name) => {
        try {
          images[name] = await loadImage(
            fileUrl(base, id, `${name}-Anim.png`),
          );
        } catch {
          /* one missing sheet is not fatal */
        }
      }),
    );

    const usable = names.filter((name) => images[name]);
    if (!usable.length) throw new Error(`no sheets for ${id}`);
    const feet = {};
    usable.forEach((name) => {
      feet[name] = footOffset(images[name]);
    });
    return { id, anims, images, names: usable, feet };
  })();

  pending.set(id, job);
  job.then(
    (value) => {
      done.set(id, value);
      pending.delete(id);
    },
    () => pending.delete(id),
  );
  return job;
}

/* PMD sheets stack all eight facings, one row per animation direction, in
   the order south, south-east, east, north-east, north, north-west, west,
   south-west — counter-clockwise from the front view. Row 0 is the creature
   facing the camera. */
export const ROW_S = 0;

/* The row for a heading, where +x is to the right and +z is toward the
   viewer: 0 = facing the camera, 2 = facing right, 4 = facing away, 6 = left. */
export function facingRow(dx, dz) {
  if (!dx && !dz) return ROW_S;
  const turns = Math.round(Math.atan2(dz, dx) / (Math.PI / 4));
  /* Rows run 0 south, 1 south-east, 2 east, 3 north-east, 4 north,
     5 north-west, 6 west, 7 south-west. Measured, not guessed: on Pikachu's
     walk sheet the red cheek sits right of the silhouette's centre of mass on
     rows 1–3 and left on rows 5–7, so 2 is the right-facing profile and 6 the
     left-facing one, with 0 front and 4 back. */
  const table = [2, 1, 0, 7, 6, 5, 4, 3];
  return table[((turns % 8) + 8) % 8];
}

/* Registers the sheets as Phaser textures and returns playable animations:
   { walk, run, idle } with { key, durations, frames, rows, perRow } or null.
   Every row holds the same frame count, so a frame is row * perRow + step. */
export function installPmdTextures(scene, id, data) {
  const parts = {};
  data.names.forEach((name) => {
    const anim = data.anims[name];
    const image = data.images[name];
    if (!anim || !image) return;
    const key = `pmd-${id}-${name}`;

    /* The XML states the authored cell, but a few sheets are packed tighter
       than that, so the sheet's own height decides how many rows it has. */
    const guess = image.height / anim.height;
    const rows =
      Number.isFinite(guess) && guess >= 1 && Math.abs(guess - Math.round(guess)) < 0.06
        ? Math.round(guess)
        : 8;
    const frameW = anim.width;
    const frameH = Math.round(image.height / rows);
    const perRow = Math.max(1, Math.round(image.width / frameW));

    if (!scene.textures.exists(key)) {
      try {
        scene.textures.addSpriteSheet(key, image, {
          frameWidth: frameW,
          frameHeight: frameH,
        });
      } catch {
        /* a half-built texture is better than none */
      }
    }
    if (!scene.textures.exists(key)) return;

    const durations = anim.durations.slice(0, perRow);
    if (!durations.length) return;

    parts[name.toLowerCase()] = {
      key,
      durations,
      frames: durations.length,
      rows,
      perRow,
      foot: data.feet?.[name] || 0,
    };
  });

  return Object.keys(parts).length ? parts : null;
}
