"""Build the eight badge PNGs from the pret/pokered trainer-card sheet.

The sheet is a 16x16 column of sixteen tiles on a white card. Cropping a tile
gives the badge with a white box around it, which is exactly what looked wrong
on the dark UI. This script flood-fills the white card away from the tile
borders (so white *inside* the badge survives as its highlight), then paints
the four grey levels with the gym's type colour:

    black outline -> deep shade, 85 -> shade, 170 -> colour, 255 -> highlight

Run from the repo root:  python3 scripts/build-badges.py
Writes public/badges/<badge>.png (16x16, nearest-neighbour art).
"""

from collections import deque
from pathlib import Path

from PIL import Image

SHEET = Path("/tmp/badges.png")
OUT = Path(__file__).resolve().parent.parent / "public" / "badges"

# tile index on the sheet -> (badge id, accent). Accents match src/typeColors.js.
BADGES = [
    (1, "boulder", "#8a7650"),
    (3, "cascade", "#3a86c4"),
    (5, "thunder", "#c79a12"),
    (7, "rainbow", "#4f9648"),
    (9, "soul", "#a052bd"),
    (11, "marsh", "#d24a86"),
    (13, "volcano", "#e0572a"),
    (15, "earth", "#a37a2c"),
]


def rgb(hex_value):
    value = hex_value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def mix(a, b, ratio):
    return tuple(round(a[i] + (b[i] - a[i]) * ratio) for i in range(3))


def build(tile_index, accent):
    sheet = Image.open(SHEET).convert("RGBA")
    tile = sheet.crop((0, tile_index * 16, 16, tile_index * 16 + 16))
    pixels = tile.load()

    # Flood-fill the white card from the tile border. Anything reachable is
    # background; white pixels enclosed by the badge stay as highlights.
    background = set()
    queue = deque()
    for x in range(16):
        for y in (0, 15):
            queue.append((x, y))
    for y in range(16):
        for x in (0, 15):
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        if (x, y) in background or not (0 <= x < 16 and 0 <= y < 16):
            continue
        if pixels[x, y][:3] != (255, 255, 255):
            continue
        background.add((x, y))
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    deep = mix(rgb(accent), rgb("#0b0f11"), 0.62)
    shade = mix(rgb(accent), rgb("#0b0f11"), 0.28)
    highlight = mix(rgb(accent), rgb("#ffffff"), 0.52)
    ramp = {0: deep, 85: shade, 170: rgb(accent), 255: highlight}

    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    target = out.load()
    for y in range(16):
        for x in range(16):
            if (x, y) in background:
                continue
            level = pixels[x, y][0]
            colour = ramp.get(level, rgb(accent))
            target[x, y] = (*colour, 255)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for tile, gym, accent in BADGES:
        build(tile, accent).save(OUT / f"{gym}.png")
    print(f"wrote {len(BADGES)} badges to {OUT}")


if __name__ == "__main__":
    main()
