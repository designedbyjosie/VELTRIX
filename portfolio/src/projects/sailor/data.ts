/**
 * Sailor Springs — the fictional range. Edit flavours, copy and prices here.
 * Every product carries its own "weather": the palette the storefront
 * takes on when the product is selected.
 */
export interface Weather {
  sky: string; // page background
  sea: string; // secondary band
  ink: string; // text on the page
  accent: string; // highlights, buttons
  sun: string; // the sun disc / glow
  label: string; // can label colour
  labelInk: string; // text on the label
  band: string; // can top band
}

export interface Flavour {
  id: string;
  name: string;
  line: string; // the flavour combination
  tasting: string[];
  story: string;
  place: string; // the fictional stop on the coast road it's named after
  mile: number; // mile marker on the coast road
  mood: ("bright" | "calm" | "deep" | "fresh" | "soft" | "pure")[];
  sweetness: number; // 0–3, from fruit only
  botanical: number; // 0–3 herbal intensity
  fizz: "fine" | "lively" | "big";
  occasions: string[];
  weather: Weather;
  motif: "grapefruit" | "lemon" | "plum" | "cucumber" | "peach" | "spring";
}

export const flavours: Flavour[] = [
  {
    id: "low-tide",
    name: "Low Tide",
    line: "Pink grapefruit, sea salt & rosemary",
    tasting: ["Sharp pink grapefruit", "A pinch of flake salt", "Resinous rosemary finish"],
    story:
      "Named for the hour the rock pools open up at Mile 4. Bitter, bright and a little salty — the drink for walking back up the beach with sand still on your ankles.",
    place: "Gull Rock pools",
    mile: 4,
    mood: ["bright", "fresh"],
    sweetness: 1,
    botanical: 2,
    fizz: "lively",
    occasions: ["After a swim", "Lunch outside", "Afternoon slump"],
    motif: "grapefruit",
    weather: {
      sky: "#f6d9cf",
      sea: "#e9a99a",
      ink: "#3a1d22",
      accent: "#c8443b",
      sun: "#ffb4a2",
      label: "#f3c3b6",
      labelInk: "#5a1f26",
      band: "#c8443b",
    },
  },
  {
    id: "lighthouse-lemon",
    name: "Lighthouse Lemon",
    line: "Meyer lemon, chamomile & honeyed hay",
    tasting: ["Soft Meyer lemon", "Chamomile flowers", "Warm, grassy close"],
    story:
      "For the keeper's cottage at Mile 11, painted the same yellow every spring. Gentle citrus that tastes like the first warm day of the year.",
    place: "Point Wren light",
    mile: 11,
    mood: ["bright", "soft"],
    sweetness: 2,
    botanical: 1,
    fizz: "fine",
    occasions: ["Morning", "Picnic", "Reading outside"],
    motif: "lemon",
    weather: {
      sky: "#fbefc4",
      sea: "#f3cf63",
      ink: "#2f2a12",
      accent: "#b27a00",
      sun: "#ffd84a",
      label: "#f8dc6c",
      labelInk: "#3b2f05",
      band: "#1f4f8a",
    },
  },
  {
    id: "night-swim",
    name: "Night Swim",
    line: "Blackberry, damson plum & bay leaf",
    tasting: ["Dark blackberry", "Tart damson skin", "Savoury bay leaf"],
    story:
      "Mile 19 is where the road dips to a cove nobody admits to swimming in after dark. Our deepest flavour — jammy fruit cut with something green and serious.",
    place: "Hollow Cove",
    mile: 19,
    mood: ["deep", "calm"],
    sweetness: 2,
    botanical: 2,
    fizz: "fine",
    occasions: ["Dinner", "Late evenings", "Instead of a nightcap"],
    motif: "plum",
    weather: {
      sky: "#1f1d3b",
      sea: "#3b2d5c",
      ink: "#efe8ff",
      accent: "#c9a3ff",
      sun: "#d9d3f5",
      label: "#4a2f62",
      labelInk: "#f4e9ff",
      band: "#c9a3ff",
    },
  },
  {
    id: "fog-line",
    name: "Fog Line",
    line: "Cucumber, juniper & garden mint",
    tasting: ["Cold cucumber", "Piney juniper", "Clean mint lift"],
    story:
      "Some mornings the fog sits exactly at Mile 23 and you drive out of it like a curtain. Cool, green, barely sweet — a reset button.",
    place: "Cypress turnout",
    mile: 23,
    mood: ["fresh", "calm"],
    sweetness: 0,
    botanical: 3,
    fizz: "big",
    occasions: ["After a run", "Hot afternoons", "Desk drink"],
    motif: "cucumber",
    weather: {
      sky: "#dfe8e2",
      sea: "#a9c7b7",
      ink: "#18302a",
      accent: "#2f6e5a",
      sun: "#f1f5f2",
      label: "#b9d6c6",
      labelInk: "#163229",
      band: "#2f6e5a",
    },
  },
  {
    id: "postcard-peach",
    name: "Postcard Peach",
    line: "White peach, yuzu & orange blossom",
    tasting: ["Juicy white peach", "Yuzu zest", "Orange blossom perfume"],
    story:
      "The fruit stand at Mile 30 sells postcards of itself. This is the one we'd send — soft, floral, a little sunburnt.",
    place: "Larkin's fruit stand",
    mile: 30,
    mood: ["soft", "bright"],
    sweetness: 3,
    botanical: 1,
    fizz: "lively",
    occasions: ["Celebrations", "Brunch", "Golden hour"],
    motif: "peach",
    weather: {
      sky: "#fde3cf",
      sea: "#f6b48b",
      ink: "#3d2316",
      accent: "#d0622f",
      sun: "#ffc59b",
      label: "#f9c9a6",
      labelInk: "#4a2414",
      band: "#3b8a85",
    },
  },
  {
    id: "spring-source",
    name: "Spring Source",
    line: "Unflavoured mineral spring water",
    tasting: ["Naturally soft minerals", "Fine, persistent bubbles", "Nothing else"],
    story:
      "The end of the road, Mile 36: the spring the whole company is named after. We add bubbles and nothing else. The baseline every other flavour is built on.",
    place: "Sailor Springs",
    mile: 36,
    mood: ["pure", "calm"],
    sweetness: 0,
    botanical: 0,
    fizz: "fine",
    occasions: ["Every day", "With food", "Mixing"],
    motif: "spring",
    weather: {
      sky: "#e4edf5",
      sea: "#9dbbd6",
      ink: "#12294a",
      accent: "#173f73",
      sun: "#ffffff",
      label: "#f6f3ea",
      labelInk: "#173f73",
      band: "#173f73",
    },
  },
];

export interface Format {
  id: string;
  name: string;
  detail: string;
  price: number;
}

export const formats: Format[] = [
  { id: "4", name: "4-pack", detail: "4 × 330 ml cans", price: 9 },
  { id: "12", name: "Coast box", detail: "12 × 330 ml cans", price: 24 },
  { id: "24", name: "Crate", detail: "24 × 330 ml cans · ships free", price: 44 },
];

/** A mixed box is the brand's "taste the whole road" product. */
export const roadTripBox = {
  id: "road-trip",
  name: "The Whole Road",
  detail: "12 cans, two of each flavour",
  price: 26,
};

export function flavourById(id: string) {
  return flavours.find((f) => f.id === id);
}

export function formatById(id: string) {
  return formats.find((f) => f.id === id);
}
