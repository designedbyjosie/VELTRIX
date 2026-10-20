/**
 * Copper Wells Ranch — a fictional guest ranch in the fictional Vara Valley.
 * All names, dates, people and prices are invented for this concept.
 */
export type LocationId = "gate" | "house" | "stables" | "trail" | "windmill" | "campfire" | "overlook" | "store";

export interface RanchLocation {
  id: LocationId;
  name: string;
  short: string;
  /** Position in the 3D world (x, y, z). */
  world: [number, number, number];
  /** Position on the illustrated map, in percent. */
  map: [number, number];
  /** Walking/riding minutes from the ranch house, for the route planner. */
  fromHouse: number;
  hours: string;
  body: string[];
  facts: [string, string][];
  related?: "stay" | "ride" | "evening" | "visit";
  colour: string;
}

export const locations: RanchLocation[] = [
  {
    id: "gate",
    name: "The Gate",
    short: "Where the county road ends and the ranch begins.",
    world: [0, 0, 34],
    map: [50, 92],
    fromHouse: 25,
    hours: "Check-in 2 – 7 pm",
    body: [
      "Two cottonwood posts and a sign that has been repainted every spring since 1936. Pull up here, ring the brass bell, and someone will ride down to meet you.",
      "The last mile is dirt. Drive it slowly — the road crosses Copper Wash twice and the cattle consider it theirs.",
    ],
    facts: [
      ["Elevation", "5,840 ft"],
      ["From the house", "1 mile by road"],
      ["Phone signal", "Patchy. That's the point."],
    ],
    related: "visit",
    colour: "#c98e3b",
  },
  {
    id: "house",
    name: "The Ranch House",
    short: "Adobe walls, a long porch, nine guest rooms.",
    world: [-4, 0, -6],
    map: [44, 48],
    fromHouse: 0,
    hours: "Breakfast 6:30 – 9, supper at 7",
    body: [
      "Built in stages between 1891 and 1938, the house is thick adobe on the north side and timber on the south, where a fire took the original porch in 1952.",
      "Nine rooms, a library of sun-faded paperbacks, and a dining table long enough for everyone. Meals are shared unless you'd rather take a plate to the porch.",
    ],
    facts: [
      ["Rooms", "9, each with its own bath"],
      ["Meals", "Three a day, included"],
      ["Quiet hours", "9 pm – 6 am"],
    ],
    related: "stay",
    colour: "#a2472a",
  },
  {
    id: "stables",
    name: "The Stables",
    short: "Fourteen horses, each matched to a rider.",
    world: [7, 0, -3],
    map: [63, 54],
    fromHouse: 3,
    hours: "Rides leave 7 am and 4 pm",
    body: [
      "The wranglers pair every guest with a horse on the first morning — nervous riders get Biscuit or June, who have seen everything twice.",
      "No experience needed. Lessons run in the round pen before every ride, and helmets are on the hooks by the door.",
    ],
    facts: [
      ["Horses", "14 quarter horses & mustangs"],
      ["Minimum age", "8 for trail rides"],
      ["Weight limit", "240 lb, for the horses' sake"],
    ],
    related: "ride",
    colour: "#3b2418",
  },
  {
    id: "trail",
    name: "Juniper Trail",
    short: "A four-mile loop through junipers and red rock.",
    world: [14, 0, -16],
    map: [76, 30],
    fromHouse: 40,
    hours: "Guided rides daily",
    body: [
      "The loop climbs gently through one-seed junipers to a saddle where you can see three mountain ranges on a clear day, then drops back along the dry wash.",
      "Most riders do it in two hours with a stop for water at Copper Spring, where the rocks are stained blue-green.",
    ],
    facts: [
      ["Length", "4.2 mile loop"],
      ["Time", "About 2 hours on horseback"],
      ["Difficulty", "Easy, two short climbs"],
    ],
    related: "ride",
    colour: "#5e9c97",
  },
  {
    id: "windmill",
    name: "The Copper Wells",
    short: "The wells that named the ranch.",
    world: [-12, 0, 4],
    map: [24, 62],
    fromHouse: 6,
    hours: "Always open",
    body: [
      "When the first well was dug in 1891, the water came up tasting faintly of pennies and stained the trough a pale turquoise. A seam of copper ore runs under the wash.",
      "The windmill still pumps the stock tank. The drinking water comes from a deeper well now — tested every season and perfectly ordinary.",
    ],
    facts: [
      ["First well", "1891, hand-dug, 60 ft"],
      ["Windmill", "Aermotor-style, rebuilt 1979"],
      ["Tank", "Swimmable in August, ask first"],
    ],
    related: "visit",
    colour: "#5e9c97",
  },
  {
    id: "campfire",
    name: "Campfire Circle",
    short: "Evenings end here.",
    world: [2, 0, 6],
    map: [56, 70],
    fromHouse: 4,
    hours: "Most nights from 8 pm",
    body: [
      "A ring of split-log benches around a fire pit, downhill from the house so the light doesn't wash out the stars.",
      "Someone usually brings a guitar. Someone else usually knows only one song. Marshmallows are in the tin by the woodpile.",
    ],
    facts: [
      ["Fire season", "Closed on red-flag days"],
      ["Stargazing", "Bortle class 2 sky"],
      ["Bring", "A jacket. Desert nights are cold."],
    ],
    related: "evening",
    colour: "#c98e3b",
  },
  {
    id: "overlook",
    name: "Mesa Overlook",
    short: "The best sunset on the property.",
    world: [-16, 6, -24],
    map: [18, 18],
    fromHouse: 50,
    hours: "Sunset rides Thursday & Saturday",
    body: [
      "A flat-topped mesa 600 feet above the valley floor, reached by a switchback trail or, for the less horse-inclined, the ranch truck.",
      "At sunset the whole valley turns the colour of the ranch's name. Bring a camera, then put it away for the last ten minutes.",
    ],
    facts: [
      ["Height", "600 ft above the valley"],
      ["Access", "Horseback or ranch truck"],
      ["Best light", "40 minutes before sunset"],
    ],
    related: "ride",
    colour: "#a2472a",
  },
  {
    id: "store",
    name: "The General Store",
    short: "Coffee, postcards and things you forgot.",
    world: [-16, 0, 17],
    map: [32, 78],
    fromHouse: 5,
    hours: "8 am – 6 pm",
    body: [
      "Once the post office for half the valley, the store now sells coffee by the cup, sunscreen, wool socks, and postcards printed from the ranch's own photo archive.",
      "The mail still goes out at noon. Postage is on the house if you write to someone who's never been.",
    ],
    facts: [
      ["Coffee", "From 6 am, honour jar"],
      ["Postcards", "Twelve designs from the archive"],
      ["Mail", "Out at noon, Monday – Saturday"],
    ],
    related: "visit",
    colour: "#3b2418",
  },
];

export const timeline = [
  { year: "1891", title: "A well in the wash", body: "Homesteaders dig sixty feet into Copper Wash and hit water that tastes of pennies. They build one adobe room and a corral." },
  { year: "1903", title: "The copper seam", body: "A surveyor finds a thin seam of copper ore under the wash. It's never worth mining, but it gives the place its name." },
  { year: "1936", title: "First paying guests", body: "Train travellers start arriving for 'a week of real ranch life'. The sign at the gate goes up and is painted every spring after." },
  { year: "1952", title: "The porch fire", body: "A lightning strike burns the south porch. It's rebuilt in timber, which is why the house has two personalities." },
  { year: "1979", title: "The windmill rebuilt", body: "The original windmill is replaced, bolt for bolt, by the family's youngest daughter and two patient neighbours." },
  { year: "Today", title: "Still a working ranch", body: "Forty head of cattle, fourteen horses and nine guest rooms. Fictional, all of it — but we'd love to go." },
];

export const activities = [
  { id: "trail", name: "Trail rides", time: "2 hrs", detail: "Morning and evening rides on the Juniper Trail. Lessons first if you need them.", price: 85 },
  { id: "sunset", name: "Sunset on the mesa", time: "3 hrs", detail: "Ride or drive to the overlook with a thermos and a blanket.", price: 95 },
  { id: "stars", name: "Stargazing", time: "1.5 hrs", detail: "A telescope, a star chart, and a wrangler who knows the constellations.", price: 0 },
  { id: "leather", name: "Leatherwork", time: "2 hrs", detail: "Make a belt or a camera strap in the tack room.", price: 45 },
  { id: "cookout", name: "Chuckwagon supper", time: "Evening", detail: "Beans, cornbread and grilled peaches at the campfire circle.", price: 0 },
  { id: "photo", name: "Golden-hour photo walk", time: "1 hr", detail: "The ranch's best light, and where to stand for it.", price: 25 },
];

export const stays = [
  { id: "room", name: "House room", sleeps: 2, nightly: 240, detail: "Adobe walls, quilt, porch access. Meals included." },
  { id: "cabin", name: "Juniper cabin", sleeps: 4, nightly: 380, detail: "A two-room cabin with a wood stove, five minutes' walk from the house." },
  { id: "bunk", name: "Bunkhouse", sleeps: 8, nightly: 520, detail: "For families and friends. Bunks, a big table and a very old piano." },
];

export const journal = [
  {
    date: "Spring",
    title: "Painting the sign",
    body: "Every year the first warm Saturday is sign day. The letters get traced, the rust gets sanded, and somebody always argues for a new font. It never changes.",
  },
  {
    date: "Summer",
    title: "Monsoon afternoons",
    body: "From July the clouds build every afternoon and break by four. The wash runs for an hour, the smell of wet creosote fills the valley, and the rides wait it out on the porch.",
  },
  {
    date: "Autumn",
    title: "Cottonwoods turn",
    body: "The two trees at the gate go gold in the second week of October. It's the most photographed week of the year and the coldest nights at the campfire.",
  },
  {
    date: "Winter",
    title: "The quiet season",
    body: "Snow on the mesa, frost on the troughs, half the rooms closed. Winter guests get the best horses and the longest breakfasts.",
  },
];
