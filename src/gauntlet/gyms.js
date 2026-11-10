/* The eight Red/Blue gyms, in badge order.

   Parties come from pret/pokered data/trainers/parties.asm. Members marked
   `canonical` are exactly as the cartridge lists them; members marked `pad`
   are added only because this mode runs six-on-six, using species of the
   gym's own type. Set PAD_TO_SIX to false to fall back to the exact Red/Blue
   parties (two to five members). Every member fights at the gym's level cap
   so neither side starts with a free level lead; the filler is tuned so the
   leaders stay beatable without the old 100% scouting readings.

   Special moves come from data/trainers/special_moves.asm; `specialSlot` is
   the 0-based party index that receives it. */

export const PARTY_SIZE = 6;
export const PAD_TO_SIX = true;

export const LEVEL_CAPS = [14, 21, 24, 29, 43, 43, 47, 50];

export const GYMS = [
  {
    id: "pewter",
    gym: "Pewter Gym",
    town: "Pewter City",
    leader: "Brock",
    type: "rock",
    badge: "boulder",
    badgeName: "Boulder Badge",
    badgeTile: 1,
    faceTile: 0,
    levelCap: 14,
    specialMove: { move: "bide", specialSlot: 1 },
    team: [
      { id: 74, name: "Geodude", level: 12, canonical: true },
      { id: 95, name: "Onix", level: 14, canonical: true },
      { id: 75, name: "Graveler", level: 12, pad: true },
      { id: 28, name: "Sandslash", level: 12, pad: true },
      { id: 105, name: "Marowak", level: 12, pad: true },
      { id: 111, name: "Rhyhorn", level: 12, pad: true },
    ],
  },
  {
    id: "cerulean",
    gym: "Cerulean Gym",
    town: "Cerulean City",
    leader: "Misty",
    type: "water",
    badge: "cascade",
    badgeName: "Cascade Badge",
    badgeTile: 3,
    faceTile: 2,
    levelCap: 21,
    specialMove: { move: "bubble-beam", specialSlot: 1 },
    team: [
      { id: 120, name: "Staryu", level: 18, canonical: true },
      { id: 121, name: "Starmie", level: 21, canonical: true },
      { id: 119, name: "Seaking", level: 18, pad: true },
      { id: 86, name: "Seel", level: 18, pad: true },
      { id: 60, name: "Poliwag", level: 18, pad: true },
      { id: 116, name: "Horsea", level: 18, pad: true },
    ],
  },
  {
    id: "vermilion",
    gym: "Vermilion Gym",
    town: "Vermilion City",
    leader: "Lt. Surge",
    type: "electric",
    badge: "thunder",
    badgeName: "Thunder Badge",
    badgeTile: 5,
    faceTile: 4,
    levelCap: 24,
    specialMove: { move: "thunderbolt", specialSlot: 2 },
    team: [
      { id: 100, name: "Voltorb", level: 21, canonical: true },
      { id: 25, name: "Pikachu", level: 18, canonical: true },
      { id: 26, name: "Raichu", level: 24, canonical: true },
      { id: 101, name: "Electrode", level: 21, pad: true },
      { id: 82, name: "Magneton", level: 21, pad: true },
      { id: 125, name: "Electabuzz", level: 21, pad: true },
    ],
  },
  {
    id: "celadon",
    gym: "Celadon Gym",
    town: "Celadon City",
    leader: "Erika",
    type: "grass",
    badge: "rainbow",
    badgeName: "Rainbow Badge",
    badgeTile: 7,
    faceTile: 6,
    levelCap: 29,
    specialMove: { move: "mega-drain", specialSlot: 2 },
    team: [
      { id: 71, name: "Victreebel", level: 29, canonical: true },
      { id: 114, name: "Tangela", level: 24, canonical: true },
      { id: 45, name: "Vileplume", level: 29, canonical: true },
      { id: 103, name: "Exeggutor", level: 29, pad: true },
      { id: 47, name: "Parasect", level: 29, pad: true },
      { id: 102, name: "Exeggcute", level: 29, pad: true },
    ],
  },
  {
    id: "fuchsia",
    gym: "Fuchsia Gym",
    town: "Fuchsia City",
    leader: "Koga",
    type: "poison",
    badge: "soul",
    badgeName: "Soul Badge",
    badgeTile: 9,
    faceTile: 8,
    levelCap: 43,
    specialMove: { move: "toxic", specialSlot: 3 },
    team: [
      { id: 109, name: "Koffing", level: 37, canonical: true },
      { id: 89, name: "Muk", level: 39, canonical: true },
      { id: 109, name: "Koffing", level: 37, canonical: true },
      { id: 110, name: "Weezing", level: 43, canonical: true },
      { id: 49, name: "Venomoth", level: 39, pad: true },
      { id: 42, name: "Golbat", level: 39, pad: true },
    ],
  },
  {
    id: "saffron",
    gym: "Saffron Gym",
    town: "Saffron City",
    leader: "Sabrina",
    type: "psychic",
    badge: "marsh",
    badgeName: "Marsh Badge",
    badgeTile: 11,
    faceTile: 10,
    levelCap: 43,
    specialMove: { move: "psywave", specialSlot: 3 },
    team: [
      { id: 64, name: "Kadabra", level: 38, canonical: true },
      { id: 122, name: "Mr. Mime", level: 37, canonical: true },
      { id: 49, name: "Venomoth", level: 38, canonical: true },
      { id: 65, name: "Alakazam", level: 43, canonical: true },
      { id: 80, name: "Slowbro", level: 38, pad: true },
      { id: 103, name: "Exeggutor", level: 38, pad: true },
    ],
  },
  {
    id: "cinnabar",
    gym: "Cinnabar Gym",
    town: "Cinnabar Island",
    leader: "Blaine",
    type: "fire",
    badge: "volcano",
    badgeName: "Volcano Badge",
    badgeTile: 13,
    faceTile: 12,
    levelCap: 47,
    specialMove: { move: "fire-blast", specialSlot: 3 },
    team: [
      { id: 58, name: "Growlithe", level: 42, canonical: true },
      { id: 77, name: "Ponyta", level: 40, canonical: true },
      { id: 78, name: "Rapidash", level: 42, canonical: true },
      { id: 59, name: "Arcanine", level: 47, canonical: true },
      { id: 38, name: "Ninetales", level: 42, pad: true },
      { id: 126, name: "Magmar", level: 42, pad: true },
    ],
  },
  {
    id: "viridian",
    gym: "Viridian Gym",
    town: "Viridian City",
    leader: "Giovanni",
    type: "ground",
    badge: "earth",
    badgeName: "Earth Badge",
    badgeTile: 15,
    faceTile: 14,
    levelCap: 50,
    specialMove: { move: "fissure", specialSlot: 4 },
    team: [
      { id: 111, name: "Rhyhorn", level: 45, canonical: true },
      { id: 51, name: "Dugtrio", level: 42, canonical: true },
      { id: 31, name: "Nidoqueen", level: 44, canonical: true },
      { id: 34, name: "Nidoking", level: 45, canonical: true },
      { id: 112, name: "Rhydon", level: 50, canonical: true },
      { id: 76, name: "Golem", level: 45, pad: true },
    ],
  },
];

/* Pads are dropped when PAD_TO_SIX is off, leaving the cartridge parties.

   Both rosters then fight at the gym's cap: the cartridge levels gave the
   player a free two-to-six level lead on top of a full heal, which is why the
   scouting meter used to read 100% almost everywhere. Parity makes typing,
   team quality and the badge boosts decide the fight instead. */
export function gymTeam(gym) {
  const party = PAD_TO_SIX ? gym.team : gym.team.filter((member) => !member.pad);
  return party.map((member) => ({ ...member, level: gym.levelCap }));
}

export const BADGE_TILES = {
  boulder: 1,
  cascade: 3,
  thunder: 5,
  rainbow: 7,
  soul: 9,
  marsh: 11,
  volcano: 13,
  earth: 15,
};
