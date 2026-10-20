/**
 * Margin — sample planning data.
 * Every price, duration and opening time below is an ILLUSTRATIVE ESTIMATE
 * written for this prototype. Places are real cities, but activities are
 * described generically and nothing here comes from a live source.
 */
export type Interest =
  | "relax"
  | "adventure"
  | "culture"
  | "food"
  | "nature"
  | "nightlife"
  | "shopping"
  | "photo"
  | "history"
  | "local"
  | "road";

export const interestLabels: Record<Interest, string> = {
  relax: "Relaxation",
  adventure: "Adventure",
  culture: "Culture",
  food: "Food",
  nature: "Nature",
  nightlife: "Nightlife",
  shopping: "Shopping",
  photo: "Photography",
  history: "Historical places",
  local: "Local experiences",
  road: "Road trips",
};

export const interestColours: Record<Interest, string> = {
  relax: "#5ba8a0",
  adventure: "#2f8f6b",
  culture: "#3d6fb6",
  food: "#c2577a",
  nature: "#4f7a5a",
  nightlife: "#6b4fa0",
  shopping: "#d9822b",
  photo: "#8c6d46",
  history: "#7a5c3e",
  local: "#b04a4a",
  road: "#556070",
};

export type Origin = "us-east" | "us-west" | "us-central" | "uk" | "europe" | "mexico" | "east-asia";

export const originLabels: Record<Origin, string> = {
  "us-east": "US East Coast",
  "us-west": "US West Coast",
  "us-central": "Central US",
  uk: "UK & Ireland",
  europe: "Continental Europe",
  mexico: "Mexico & Central America",
  "east-asia": "East Asia",
};

export type Slot = "morning" | "afternoon" | "evening";
export type Tier = "budget" | "mid" | "comfort";
export type Temp = "cold" | "cool" | "mild" | "warm" | "hot";

export interface Activity {
  id: string;
  name: string;
  detail: string;
  interests: Interest[];
  cost: number; // per person, USD, estimate
  hours: number;
  slots: Slot[];
  walk: number; // minutes on foot
  zone: string;
  open?: string; // sample opening hours
  stepFree: boolean;
  diet?: ("vegetarian" | "vegan" | "gluten-free" | "halal")[];
}

export interface Stay {
  id: string;
  name: string;
  tier: Tier;
  kind: "hostel" | "hotel" | "apartment" | "cabin";
  nightly: number; // per room (2 guests), USD, estimate
  zone: string;
  stepFree: boolean;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  kind: "city" | "nature" | "coast";
  blurb: string;
  palette: [string, string, string];
  interests: Partial<Record<Interest, number>>; // 0–1 how well it serves each interest
  goodMonths: number[]; // 0–11
  climate: Temp[]; // per month
  rainyMonths: number[];
  /** Round-trip cost per person and one-way hours, by origin. Estimates. */
  travel: Record<Origin, [number, number]>;
  domesticFor: Origin[];
  food: Record<"shoestring" | "balanced" | "comfort", number>; // per person per day
  transit: number; // per person per day, walking + public transport
  carDay: number; // per car per day incl. fuel
  zones: { id: string; name: string; x: number; y: number }[];
  stays: Stay[];
  activities: Activity[];
}

const A = (
  id: string,
  name: string,
  detail: string,
  interests: Interest[],
  cost: number,
  hours: number,
  slots: Slot[],
  walk: number,
  zone: string,
  open?: string,
  stepFree = true,
  diet?: Activity["diet"],
): Activity => ({ id, name, detail, interests, cost, hours, slots, walk, zone, open, stepFree, diet });

export const destinations: Destination[] = [
  {
    id: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    kind: "city",
    blurb: "Hills, tiled façades, river light and long dinners.",
    palette: ["#e8a33d", "#3d6fb6", "#f3ead7"],
    interests: { culture: 0.9, food: 0.9, history: 0.9, photo: 0.9, nightlife: 0.7, local: 0.8, shopping: 0.5, relax: 0.5, nature: 0.3, adventure: 0.3, road: 0.3 },
    goodMonths: [2, 3, 4, 5, 8, 9],
    climate: ["cool", "cool", "mild", "mild", "warm", "warm", "hot", "hot", "warm", "mild", "mild", "cool"],
    rainyMonths: [0, 1, 10, 11],
    travel: { "us-east": [750, 8], "us-west": [950, 13], "us-central": [850, 11], uk: [180, 2.5], europe: [150, 2.5], mexico: [1000, 13], "east-asia": [1200, 17] },
    domesticFor: ["europe"],
    food: { shoestring: 30, balanced: 55, comfort: 95 },
    transit: 8,
    carDay: 60,
    zones: [
      { id: "alfama", name: "Alfama", x: 70, y: 40 },
      { id: "baixa", name: "Baixa & Chiado", x: 52, y: 52 },
      { id: "belem", name: "Belém", x: 12, y: 70 },
      { id: "bairro", name: "Bairro Alto", x: 44, y: 42 },
      { id: "sintra", name: "Sintra (day trip)", x: 8, y: 12 },
    ],
    stays: [
      { id: "l-hostel", name: "Hostel near the river", tier: "budget", kind: "hostel", nightly: 70, zone: "baixa", stepFree: true },
      { id: "l-guest", name: "Guesthouse in Alfama", tier: "mid", kind: "hotel", nightly: 130, zone: "alfama", stepFree: false },
      { id: "l-apt", name: "Apartment in Chiado", tier: "mid", kind: "apartment", nightly: 145, zone: "baixa", stepFree: true },
      { id: "l-hotel", name: "Boutique hotel, river view", tier: "comfort", kind: "hotel", nightly: 260, zone: "baixa", stepFree: true },
    ],
    activities: [
      A("l-tram", "Old-town tram ride & viewpoints", "Ride the vintage tram up through the old quarter and stop at two lookouts.", ["culture", "photo", "history"], 4, 2, ["morning", "afternoon"], 40, "alfama", "07:00–22:00", false),
      A("l-castle", "Hilltop castle walls", "Walk the ramparts above the city.", ["history", "photo"], 17, 2, ["morning", "afternoon"], 60, "alfama", "09:00–18:00", false),
      A("l-tiles", "Tile museum", "Five centuries of painted azulejo tiles in a former convent.", ["culture", "history"], 6, 2, ["morning", "afternoon"], 20, "alfama", "10:00–18:00 (closed Mon)"),
      A("l-market", "Food hall lunch", "Graze stalls from local cooks under one roof.", ["food", "local"], 22, 1.5, ["afternoon"], 15, "baixa", "10:00–24:00", true, ["vegetarian", "gluten-free"]),
      A("l-pastry", "Custard tart crawl", "Taste three bakeries' versions and pick a winner.", ["food", "local"], 8, 1.5, ["morning", "afternoon"], 30, "belem", "08:00–20:00", true, ["vegetarian"]),
      A("l-monastery", "Riverside monastery", "Ornate stone cloisters by the water.", ["history", "culture", "photo"], 12, 2, ["morning", "afternoon"], 30, "belem", "10:00–17:30 (closed Mon)"),
      A("l-river", "Sunset river walk", "Follow the waterfront west as the light drops.", ["photo", "relax", "nature"], 0, 1.5, ["evening"], 50, "belem"),
      A("l-fado", "Fado dinner", "Traditional sung music over a long supper.", ["culture", "nightlife", "food"], 55, 3, ["evening"], 10, "alfama", "20:00–late", false, ["vegetarian"]),
      A("l-bairro", "Bairro Alto bar hop", "Narrow lanes, tiny bars, people spilling into the street.", ["nightlife", "local"], 30, 3, ["evening"], 30, "bairro", "21:00–late"),
      A("l-garden", "Botanical garden picnic", "Shaded paths and a quiet lunch on the grass.", ["relax", "nature"], 8, 2, ["afternoon"], 25, "bairro", "09:00–19:00"),
      A("l-sintra", "Sintra palaces day trip", "Fairy-tale palaces in forested hills, by train.", ["history", "nature", "photo", "adventure"], 45, 7, ["morning"], 120, "sintra", "09:30–18:00", false),
      A("l-cook", "Home-cooking class", "Cook three dishes with a local host.", ["food", "local", "culture"], 75, 3, ["afternoon", "evening"], 5, "baixa", "by booking", true, ["vegetarian", "vegan", "gluten-free"]),
      A("l-shop", "Ceramics & tin-can shops", "Hunt for hand-painted plates and tinned-fish gifts.", ["shopping", "local"], 0, 1.5, ["afternoon"], 30, "baixa", "10:00–19:00"),
      A("l-free-walk", "Free neighbourhood walk", "A tip-based walking tour of the old town.", ["history", "local", "culture"], 0, 2.5, ["morning"], 80, "baixa", "10:00 & 14:00", false),
    ],
  },
  {
    id: "mexico-city",
    name: "Mexico City",
    country: "Mexico",
    kind: "city",
    blurb: "Murals, markets, and the best tacos of your life.",
    palette: ["#c2577a", "#2f8f6b", "#f6e3c6"],
    interests: { food: 1, culture: 0.95, history: 0.9, nightlife: 0.8, shopping: 0.8, local: 0.9, photo: 0.8, relax: 0.4, nature: 0.4, adventure: 0.4, road: 0.2 },
    goodMonths: [0, 1, 2, 3, 9, 10, 11],
    climate: ["mild", "mild", "warm", "warm", "warm", "mild", "mild", "mild", "mild", "mild", "mild", "mild"],
    rainyMonths: [5, 6, 7, 8],
    travel: { "us-east": [380, 5], "us-west": [350, 4.5], "us-central": [330, 3.5], uk: [900, 12], europe: [850, 13], mexico: [120, 2], "east-asia": [1100, 16] },
    domesticFor: ["mexico"],
    food: { shoestring: 18, balanced: 40, comfort: 80 },
    transit: 4,
    carDay: 55,
    zones: [
      { id: "centro", name: "Centro Histórico", x: 62, y: 38 },
      { id: "roma", name: "Roma & Condesa", x: 40, y: 58 },
      { id: "coyoacan", name: "Coyoacán", x: 52, y: 86 },
      { id: "chapultepec", name: "Chapultepec", x: 18, y: 46 },
      { id: "xochimilco", name: "Xochimilco", x: 74, y: 94 },
    ],
    stays: [
      { id: "m-hostel", name: "Hostel off the main square", tier: "budget", kind: "hostel", nightly: 45, zone: "centro", stepFree: false },
      { id: "m-apt", name: "Apartment in Roma", tier: "mid", kind: "apartment", nightly: 95, zone: "roma", stepFree: true },
      { id: "m-hotel", name: "Design hotel in Condesa", tier: "comfort", kind: "hotel", nightly: 210, zone: "roma", stepFree: true },
    ],
    activities: [
      A("m-zocalo", "Main square & cathedral", "Start where the city started.", ["history", "culture", "photo"], 0, 2, ["morning"], 40, "centro", "08:00–20:00"),
      A("m-murals", "Mural tour", "Revolutionary murals in public buildings.", ["culture", "history"], 5, 2, ["morning", "afternoon"], 40, "centro", "10:00–17:30"),
      A("m-tacos", "Street-taco tasting walk", "Six stands, six fillings, one guide.", ["food", "local"], 45, 3, ["evening", "afternoon"], 60, "roma", "by booking", true, ["vegetarian"]),
      A("m-market", "Covered market breakfast", "Fresh juice and a counter seat.", ["food", "local", "shopping"], 10, 1.5, ["morning"], 20, "coyoacan", "07:00–18:00", true, ["vegetarian", "vegan", "gluten-free"]),
      A("m-blue", "Blue-house museum", "An artist's home and studio.", ["culture", "history", "photo"], 18, 2, ["morning", "afternoon"], 20, "coyoacan", "10:00–18:00 (closed Mon)"),
      A("m-anthro", "Anthropology museum", "One of the great museums of the world.", ["history", "culture"], 6, 3, ["morning", "afternoon"], 50, "chapultepec", "09:00–18:00 (closed Mon)"),
      A("m-park", "Forest-park bike & picnic", "Shared bikes under old cypresses.", ["nature", "relax", "adventure"], 5, 2, ["afternoon", "morning"], 30, "chapultepec"),
      A("m-boats", "Canal boats", "Painted boats, floating musicians, slow afternoon.", ["local", "relax", "photo"], 30, 3, ["afternoon"], 15, "xochimilco", "09:00–18:00", false),
      A("m-mezcal", "Mezcal bar crawl", "Small bars and smoky tastings.", ["nightlife", "food"], 35, 3, ["evening"], 30, "roma", "19:00–late"),
      A("m-wrestling", "Masked wrestling night", "Loud, theatrical, unforgettable.", ["nightlife", "local", "culture"], 25, 2.5, ["evening"], 20, "centro", "Tue, Fri & Sun nights"),
      A("m-design", "Design shops of Roma", "Independent studios and bookshops.", ["shopping", "local"], 0, 2, ["afternoon"], 40, "roma", "11:00–20:00"),
      A("m-cook", "Market-to-table cooking class", "Shop with a chef, then make mole.", ["food", "culture", "local"], 85, 4, ["morning"], 20, "roma", "by booking", true, ["vegetarian", "gluten-free"]),
      A("m-pyramids", "Pyramids day trip", "Climb an ancient avenue an hour from the city.", ["history", "adventure", "photo"], 40, 7, ["morning"], 120, "centro", "09:00–17:00", false),
      A("m-sunset", "Rooftop sunset", "A terrace drink over the old town.", ["relax", "photo", "nightlife"], 15, 1.5, ["evening"], 10, "centro"),
    ],
  },
  {
    id: "kyoto",
    name: "Kyoto",
    country: "Japan",
    kind: "city",
    blurb: "Temples, gardens and quiet craft.",
    palette: ["#b04a4a", "#4f7a5a", "#f4efe6"],
    interests: { culture: 1, history: 1, food: 0.85, nature: 0.7, photo: 0.95, relax: 0.8, local: 0.8, shopping: 0.6, nightlife: 0.3, adventure: 0.4, road: 0.2 },
    goodMonths: [2, 3, 4, 9, 10],
    climate: ["cold", "cold", "cool", "mild", "warm", "warm", "hot", "hot", "warm", "mild", "cool", "cold"],
    rainyMonths: [5, 6],
    travel: { "us-east": [1300, 15], "us-west": [1000, 12], "us-central": [1200, 14], uk: [1100, 15], europe: [1050, 15], mexico: [1300, 16], "east-asia": [300, 3] },
    domesticFor: ["east-asia"],
    food: { shoestring: 28, balanced: 50, comfort: 110 },
    transit: 9,
    carDay: 80,
    zones: [
      { id: "higashiyama", name: "Higashiyama", x: 72, y: 44 },
      { id: "arashiyama", name: "Arashiyama", x: 10, y: 38 },
      { id: "downtown", name: "Downtown", x: 50, y: 52 },
      { id: "fushimi", name: "Fushimi", x: 62, y: 88 },
      { id: "north", name: "Northern hills", x: 48, y: 10 },
    ],
    stays: [
      { id: "k-hostel", name: "Capsule-style hostel", tier: "budget", kind: "hostel", nightly: 60, zone: "downtown", stepFree: true },
      { id: "k-machiya", name: "Townhouse stay", tier: "mid", kind: "apartment", nightly: 150, zone: "higashiyama", stepFree: false },
      { id: "k-hotel", name: "Business hotel by the station", tier: "mid", kind: "hotel", nightly: 120, zone: "downtown", stepFree: true },
      { id: "k-ryokan", name: "Traditional inn with dinner", tier: "comfort", kind: "hotel", nightly: 380, zone: "higashiyama", stepFree: false },
    ],
    activities: [
      A("k-gates", "Thousand-gates shrine hike", "Climb through tunnels of vermilion gates — go early.", ["history", "photo", "nature", "adventure"], 0, 3, ["morning"], 120, "fushimi", "always open", false),
      A("k-bamboo", "Bamboo grove & river", "Walk the grove, then the riverbank.", ["nature", "photo", "relax"], 0, 2.5, ["morning"], 70, "arashiyama"),
      A("k-temple", "Wooden-stage temple", "A hillside temple with a city view.", ["history", "culture", "photo"], 4, 2, ["morning", "afternoon"], 50, "higashiyama", "06:00–18:00", false),
      A("k-lanes", "Preserved lanes at dusk", "Stone streets and lanterns.", ["photo", "culture", "local"], 0, 1.5, ["evening"], 40, "higashiyama"),
      A("k-market", "Covered food market", "Pickles, skewers, tea and sweets.", ["food", "local", "shopping"], 20, 1.5, ["afternoon", "morning"], 20, "downtown", "09:00–18:00", true, ["vegetarian"]),
      A("k-tea", "Tea ceremony", "A guided, quiet hour.", ["culture", "relax", "local"], 35, 1, ["afternoon", "morning"], 5, "higashiyama", "by booking"),
      A("k-zen", "Zen rock garden", "Sit and look. That's the activity.", ["relax", "culture", "history"], 5, 1.5, ["morning", "afternoon"], 20, "north", "08:00–17:00"),
      A("k-golden", "Golden pavilion", "Famous for a reason.", ["history", "photo"], 4, 1.5, ["morning", "afternoon"], 30, "north", "09:00–17:00"),
      A("k-onsen", "Neighbourhood bathhouse", "A soak where locals go.", ["relax", "local"], 5, 1.5, ["evening"], 10, "downtown", "15:00–23:00", true),
      A("k-izakaya", "Izakaya evening", "Small plates and a counter seat.", ["food", "nightlife", "local"], 40, 2.5, ["evening"], 10, "downtown", "17:00–late", true, ["vegetarian"]),
      A("k-craft", "Indigo-dye workshop", "Make a scarf to take home.", ["culture", "shopping", "local"], 45, 2, ["afternoon"], 10, "downtown", "by booking"),
      A("k-shojin", "Temple vegetarian lunch", "Buddhist cuisine in a garden room.", ["food", "culture"], 35, 1.5, ["afternoon"], 10, "arashiyama", "11:00–14:00", true, ["vegetarian", "vegan"]),
      A("k-kaiseki", "Multi-course kaiseki dinner", "Seasonal, precise, expensive.", ["food", "culture"], 120, 2.5, ["evening"], 5, "higashiyama", "18:00–21:00", true),
      A("k-philo", "Philosopher's canal path", "A shaded two-kilometre stroll.", ["relax", "nature", "photo"], 0, 1.5, ["afternoon", "morning"], 50, "higashiyama"),
    ],
  },
  {
    id: "banff",
    name: "Banff & the Rockies",
    country: "Canada",
    kind: "nature",
    blurb: "Glacier lakes, big trails and very clean air.",
    palette: ["#2f8f6b", "#5ba8a0", "#eef1ec"],
    interests: { nature: 1, adventure: 0.95, photo: 1, relax: 0.8, road: 0.8, food: 0.4, culture: 0.3, history: 0.3, local: 0.4, shopping: 0.3, nightlife: 0.2 },
    goodMonths: [5, 6, 7, 8, 11, 0, 1],
    climate: ["cold", "cold", "cold", "cool", "cool", "mild", "warm", "warm", "mild", "cool", "cold", "cold"],
    rainyMonths: [5],
    travel: { "us-east": [550, 6], "us-west": [400, 3.5], "us-central": [450, 4.5], uk: [900, 11], europe: [950, 12], mexico: [650, 7], "east-asia": [1100, 13] },
    domesticFor: [],
    food: { shoestring: 35, balanced: 60, comfort: 110 },
    transit: 15,
    carDay: 85,
    zones: [
      { id: "town", name: "Banff town", x: 54, y: 62 },
      { id: "lake", name: "Lake Louise", x: 22, y: 22 },
      { id: "moraine", name: "Moraine Lake", x: 14, y: 36 },
      { id: "canmore", name: "Canmore", x: 86, y: 84 },
      { id: "parkway", name: "Icefields Parkway", x: 8, y: 6 },
    ],
    stays: [
      { id: "b-hostel", name: "Mountain hostel", tier: "budget", kind: "hostel", nightly: 90, zone: "town", stepFree: true },
      { id: "b-cabin", name: "Cabin in Canmore", tier: "mid", kind: "cabin", nightly: 190, zone: "canmore", stepFree: false },
      { id: "b-lodge", name: "Lodge with hot pools", tier: "comfort", kind: "hotel", nightly: 360, zone: "town", stepFree: true },
    ],
    activities: [
      A("b-louise", "Lake shore at sunrise", "Glassy water before the crowds.", ["nature", "photo", "relax"], 0, 2, ["morning"], 40, "lake", "always open"),
      A("b-teahouse", "Hike to a mountain teahouse", "A climb rewarded with tea and scones.", ["adventure", "nature", "photo"], 15, 5, ["morning"], 210, "lake", "June–Sept", false),
      A("b-moraine", "Ten-peaks lake walk", "Postcard view, short rockpile scramble.", ["nature", "photo"], 8, 2, ["morning", "afternoon"], 40, "moraine", "shuttle only", false),
      A("b-canoe", "Canoe rental", "An hour on the turquoise water.", ["adventure", "relax", "nature"], 75, 1, ["morning", "afternoon"], 5, "moraine", "summer"),
      A("b-gondola", "Summit gondola", "Ride up, boardwalk along the ridge.", ["nature", "photo"], 65, 2.5, ["afternoon", "morning"], 30, "town", "08:00–21:00"),
      A("b-springs", "Hot springs soak", "Mountain views from warm water.", ["relax"], 18, 1.5, ["evening", "afternoon"], 5, "town", "10:00–22:00", true),
      A("b-parkway", "Icefields Parkway drive", "Glaciers, viewpoints, wildlife — a full day on the road.", ["road", "nature", "photo", "adventure"], 0, 8, ["morning"], 40, "parkway", "best May–Oct"),
      A("b-canyon", "Canyon catwalk", "Bolted walkways above waterfalls.", ["adventure", "nature"], 0, 2.5, ["morning", "afternoon"], 90, "town", "always open", false),
      A("b-town", "Main street & museum", "Gear shops and a small natural-history museum.", ["shopping", "history", "local"], 10, 2, ["afternoon"], 30, "town", "10:00–18:00"),
      A("b-brew", "Brewpub dinner in Canmore", "Big plates after a big day.", ["food", "nightlife", "local"], 40, 2, ["evening"], 10, "canmore", "16:00–late", true, ["vegetarian", "gluten-free"]),
      A("b-stars", "Dark-sky stargazing", "Lie back on a lakeshore after midnight.", ["nature", "relax", "photo"], 0, 2, ["evening"], 15, "lake"),
      A("b-wildlife", "Dawn wildlife drive", "Elk, maybe bears, definitely coffee.", ["nature", "photo", "road"], 0, 2.5, ["morning"], 10, "town"),
      A("b-bike", "Legacy trail bike ride", "Paved path between towns, rentals in town.", ["adventure", "nature"], 45, 3, ["afternoon", "morning"], 10, "canmore", "May–Oct"),
    ],
  },
  {
    id: "new-orleans",
    name: "New Orleans",
    country: "United States",
    kind: "city",
    blurb: "Brass bands, balconies and beignets.",
    palette: ["#6b4fa0", "#e8a33d", "#f6efe2"],
    interests: { nightlife: 1, food: 1, culture: 0.9, history: 0.85, local: 0.9, photo: 0.8, shopping: 0.6, relax: 0.4, nature: 0.4, adventure: 0.3, road: 0.3 },
    goodMonths: [0, 1, 2, 3, 4, 9, 10, 11],
    climate: ["mild", "mild", "mild", "warm", "warm", "hot", "hot", "hot", "hot", "warm", "mild", "mild"],
    rainyMonths: [5, 6, 7, 8],
    travel: { "us-east": [300, 3], "us-west": [350, 4.5], "us-central": [250, 2.5], uk: [850, 11], europe: [800, 12], mexico: [400, 4], "east-asia": [1100, 18] },
    domesticFor: ["us-east", "us-west", "us-central"],
    food: { shoestring: 30, balanced: 60, comfort: 110 },
    transit: 6,
    carDay: 60,
    zones: [
      { id: "quarter", name: "French Quarter", x: 64, y: 50 },
      { id: "marigny", name: "Marigny", x: 82, y: 40 },
      { id: "garden", name: "Garden District", x: 30, y: 70 },
      { id: "treme", name: "Tremé", x: 56, y: 30 },
      { id: "bayou", name: "Bayou (day trip)", x: 10, y: 94 },
    ],
    stays: [
      { id: "n-hostel", name: "Hostel on the streetcar line", tier: "budget", kind: "hostel", nightly: 80, zone: "garden", stepFree: true },
      { id: "n-guest", name: "Creole cottage guesthouse", tier: "mid", kind: "hotel", nightly: 170, zone: "marigny", stepFree: false },
      { id: "n-hotel", name: "Historic hotel in the Quarter", tier: "comfort", kind: "hotel", nightly: 290, zone: "quarter", stepFree: true },
    ],
    activities: [
      A("n-beignet", "Beignets & coffee", "Powdered sugar everywhere.", ["food", "local"], 10, 1, ["morning"], 10, "quarter", "24 hours", true, ["vegetarian"]),
      A("n-walk", "French Quarter history walk", "Balconies, courtyards and stories.", ["history", "culture", "photo"], 25, 2, ["morning", "afternoon"], 70, "quarter", "10:00 & 14:00"),
      A("n-streetcar", "Streetcar to the Garden District", "Oak-lined avenue and grand houses.", ["photo", "history", "relax"], 3, 2.5, ["morning", "afternoon"], 50, "garden"),
      A("n-cemetery", "Above-ground cemetery tour", "Guided, respectful and fascinating.", ["history", "culture"], 25, 1.5, ["morning"], 30, "treme", "09:00–15:00"),
      A("n-jazz", "Live jazz on Frenchmen Street", "Three clubs within a block.", ["nightlife", "culture", "local"], 20, 3, ["evening"], 15, "marigny", "19:00–late"),
      A("n-preservation", "Traditional jazz hall", "Small room, standing only, pure sound.", ["culture", "nightlife"], 40, 1, ["evening"], 10, "quarter", "18:00–23:00", false),
      A("n-swamp", "Swamp boat tour", "Cypress trees, egrets, maybe an alligator.", ["nature", "adventure", "photo"], 60, 4, ["morning"], 15, "bayou", "08:00–15:00"),
      A("n-gumbo", "Gumbo cooking demo & lunch", "Learn the roux, eat the result.", ["food", "local", "culture"], 45, 2, ["afternoon"], 10, "quarter", "by booking", true, ["gluten-free"]),
      A("n-market", "Riverside market", "Hot sauces, pralines, souvenirs.", ["shopping", "food"], 0, 1.5, ["afternoon", "morning"], 20, "quarter", "09:00–18:00"),
      A("n-museum", "Second-line & Mardi Gras museum", "Costumes and the culture behind them.", ["culture", "history", "local"], 12, 1.5, ["afternoon"], 15, "treme", "11:00–16:00 (Thu–Sat)"),
      A("n-park", "City park & sculpture garden", "Shade, art and a lagoon.", ["relax", "nature", "culture"], 0, 2, ["afternoon"], 40, "garden"),
      A("n-oyster", "Oyster bar dinner", "Chargrilled and raw.", ["food", "nightlife"], 50, 2, ["evening"], 10, "quarter", "11:00–22:00"),
      A("n-magazine", "Magazine Street shops", "Six miles of antiques and boutiques.", ["shopping", "local"], 0, 2, ["afternoon"], 50, "garden", "10:00–18:00"),
    ],
  },
  {
    id: "big-sur",
    name: "Big Sur coast road",
    country: "United States",
    kind: "coast",
    blurb: "Cliffs, redwoods and a road that refuses to hurry.",
    palette: ["#3d6fb6", "#d9822b", "#eef2f4"],
    interests: { road: 1, nature: 1, photo: 1, relax: 0.9, adventure: 0.7, food: 0.5, local: 0.5, culture: 0.3, history: 0.3, shopping: 0.3, nightlife: 0.1 },
    goodMonths: [3, 4, 5, 8, 9],
    climate: ["cool", "cool", "mild", "mild", "mild", "mild", "warm", "warm", "warm", "mild", "mild", "cool"],
    rainyMonths: [0, 1, 11],
    travel: { "us-east": [450, 6.5], "us-west": [120, 3], "us-central": [380, 5], uk: [900, 12], europe: [950, 13], mexico: [450, 5], "east-asia": [900, 12] },
    domesticFor: ["us-east", "us-west", "us-central"],
    food: { shoestring: 35, balanced: 65, comfort: 120 },
    transit: 30,
    carDay: 75,
    zones: [
      { id: "monterey", name: "Monterey", x: 22, y: 8 },
      { id: "carmel", name: "Carmel", x: 28, y: 22 },
      { id: "bixby", name: "Bixby Bridge", x: 38, y: 40 },
      { id: "pfeiffer", name: "Pfeiffer & redwoods", x: 54, y: 60 },
      { id: "south", name: "Southern coast", x: 76, y: 88 },
    ],
    stays: [
      { id: "s-camp", name: "Campground cabin", tier: "budget", kind: "cabin", nightly: 110, zone: "pfeiffer", stepFree: false },
      { id: "s-motel", name: "Motel in Monterey", tier: "mid", kind: "hotel", nightly: 170, zone: "monterey", stepFree: true },
      { id: "s-inn", name: "Cliffside inn", tier: "comfort", kind: "hotel", nightly: 420, zone: "pfeiffer", stepFree: true },
    ],
    activities: [
      A("s-aquarium", "Bay aquarium", "Kelp forest tanks and sea otters.", ["nature", "culture"], 60, 3, ["morning", "afternoon"], 30, "monterey", "09:30–18:00"),
      A("s-17mile", "Coastal scenic drive", "Cypress trees and crashing surf.", ["road", "photo", "nature"], 12, 2, ["morning", "afternoon"], 10, "carmel"),
      A("s-carmel", "Carmel village & beach", "Fairytale cottages and white sand.", ["shopping", "relax", "local"], 0, 2.5, ["afternoon"], 40, "carmel"),
      A("s-bixby", "Bridge viewpoint", "The photo everyone takes, for good reason.", ["photo", "road"], 0, 0.5, ["morning", "afternoon", "evening"], 5, "bixby"),
      A("s-redwoods", "Redwood loop trail", "Tall trees, cool shade, a waterfall.", ["nature", "adventure", "relax"], 10, 2.5, ["morning", "afternoon"], 100, "pfeiffer", "08:00–sunset", false),
      A("s-beach", "Purple-sand beach", "Keyhole arch at sunset.", ["nature", "photo", "relax"], 10, 2, ["evening", "afternoon"], 30, "pfeiffer"),
      A("s-falls", "Waterfall to the sea", "A short walk to a famous cove fall.", ["nature", "photo"], 10, 1, ["morning", "afternoon"], 20, "south"),
      A("s-elephant", "Elephant seal overlook", "Hundreds of seals, very loud.", ["nature", "photo"], 0, 1, ["morning", "afternoon"], 10, "south"),
      A("s-kayak", "Sea-otter kayak", "Paddle the harbour with otters.", ["adventure", "nature"], 55, 2, ["morning"], 5, "monterey", "08:00–16:00"),
      A("s-cliff-dinner", "Clifftop dinner", "Sunset over the Pacific from a deck.", ["food", "relax"], 70, 2, ["evening"], 5, "pfeiffer", "17:00–21:00", true, ["vegetarian", "vegan", "gluten-free"]),
      A("s-bakery", "Roadside bakery stop", "Coffee and pastries with an ocean view.", ["food", "local", "road"], 15, 1, ["morning"], 5, "pfeiffer", "08:00–15:00", true, ["vegetarian"]),
      A("s-cannery", "Cannery Row stroll", "Old sardine canneries turned shops.", ["history", "shopping", "local"], 0, 1.5, ["afternoon", "evening"], 40, "monterey"),
      A("s-stars", "Coastal stargazing", "No towns, no lights, just a lot of stars.", ["nature", "relax"], 0, 1.5, ["evening"], 10, "south"),
    ],
  },
];

export function destinationById(id: string) {
  return destinations.find((d) => d.id === id);
}
