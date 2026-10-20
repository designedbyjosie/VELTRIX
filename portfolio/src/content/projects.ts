export type ProjectId = "sailor" | "lightleak" | "ranch" | "margin";

export type Discipline = "brand" | "product" | "spatial" | "systems";

export interface ProjectMeta {
  id: ProjectId;
  title: string;
  kind: string;
  /** Route of the live concept. */
  route: string;
  /** The single question the project was built to answer. */
  question: string;
  summary: string;
  disciplines: Discipline[];
  /** Colour the expanding transition uses as it becomes the product. */
  portalColor: string;
  skill: string;
  signature: string;
}

export const projects: ProjectMeta[] = [
  {
    id: "sailor",
    title: "Sailor Springs",
    kind: "Beverage brand & storefront",
    route: "/work/sailor-springs",
    question: "Can a shop feel like a place you'd want to visit, not a catalogue?",
    summary:
      "A sparkling botanical water from the end of a coast road. Brand identity, six can designs, and a working storefront where each flavour repaints the page.",
    disciplines: ["brand", "product"],
    portalColor: "#173f73",
    skill: "Brand identity, packaging and conversion-focused commerce UX",
    signature: "Pick a flavour and the whole storefront takes on its weather.",
  },
  {
    id: "lightleak",
    title: "Lightleak",
    kind: "Photo-to-playlist mobile app",
    route: "/work/lightleak",
    question: "What does this picture sound like?",
    summary:
      "Upload a photo, read its colour and light in the browser, tune the mood, and get a playlist and a post preview you can export.",
    disciplines: ["product", "systems"],
    portalColor: "#1d1b20",
    skill: "Mobile product UX, personalisation and recommendation interfaces",
    signature: "The photo's own colours flow into the interface as it becomes a playlist.",
  },
  {
    id: "ranch",
    title: "Copper Wells Ranch",
    kind: "Immersive 3D destination site",
    route: "/work/copper-wells",
    question: "Can a website make you feel like you've arrived somewhere?",
    summary:
      "A fictional high-desert guest ranch. A WebGL landscape you ride into, eight places to explore, a day-to-night sky and a postcard archive.",
    disciplines: ["spatial", "brand"],
    portalColor: "#a2472a",
    skill: "3D and spatial UI, narrative design and destination branding",
    signature: "Ride the camera down the trail from the gate to the ranch house.",
  },
  {
    id: "margin",
    title: "Margin",
    kind: "Personal travel planner",
    route: "/work/margin",
    question: "What if a trip planner started with your life instead of a destination?",
    summary:
      "A budget-aware itinerary builder. Tell it what you can spend and how you like to move; change either and the trip rebuilds itself — and tells you what changed.",
    disciplines: ["product", "systems"],
    portalColor: "#f5f1e8",
    skill: "Complex forms, rule-based recommendations and adaptive itineraries",
    signature: "Drag the budget and watch the itinerary reshape itself.",
  },
];

export const disciplineLabels: Record<Discipline, string> = {
  brand: "Brand & art direction",
  product: "Product UX",
  spatial: "3D & spatial",
  systems: "Systems & logic",
};

export function projectById(id: string) {
  return projects.find((p) => p.id === id);
}
