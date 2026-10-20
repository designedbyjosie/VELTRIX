import type { ProjectId } from "../content/projects";

/**
 * Case-study copy. Written as the designer's own reflections — edit freely so
 * it sounds like you. Nothing here claims clients, users or results.
 */
export interface CaseContent {
  overview: string;
  audience: string[];
  challenge: string;
  direction: string;
  references: { label: string; note: string; swatch: string }[];
  type: { name: string; role: string; sample: string; family: string }[];
  colours: { hex: string; name: string }[];
  journeys: { title: string; steps: string[] }[];
  wireframe: { label: string; boxes: [number, number, number, number, string][] }[];
  states: { title: string; body: string }[];
  responsive: string;
  tradeoffs: string[];
  learned: string[];
  next: string[];
}

export const cases: Record<ProjectId, CaseContent> = {
  sailor: {
    overview:
      "Sailor Springs is a fictional sparkling botanical water named after the last town on a 36-mile coast road. I designed the brand, a six-flavour can system and a storefront where choosing a flavour changes the whole page's palette.",
    audience: [
      "People in their 20s and 30s who've swapped soda for something less sweet but still want a treat.",
      "Shoppers who buy drinks partly for how they look on a table or in a photo.",
      "Gift buyers looking for a mixed box rather than a single flavour.",
    ],
    challenge:
      "Beverage sites tend to be either a catalogue or a mood film. I wanted a shop with the atmosphere of a brand film where the buy button never moves and never hides.",
    direction:
      "A road trip, not a boat. Mile markers instead of anchors, faded postcard colour instead of navy and white, and a soft serif for flavour names paired with a hard-working grotesque for everything you need to read.",
    references: [
      { label: "Enamel road signs", note: "Simple numerals that read from a distance — they became the mile-marker badge.", swatch: "#173f73" },
      { label: "Fruit-stand lettering", note: "Hand-painted warmth, but I kept it to the flavour names only.", swatch: "#f8dc6c" },
      { label: "Sun-faded postcards", note: "The six palettes are pushed toward pastel, as if left in a car window.", swatch: "#f3c3b6" },
      { label: "Mineral-water labels", note: "Clean back-of-pack information hierarchy for the unwrapped label.", swatch: "#e4edf5" },
    ],
    type: [
      { name: "DM Serif Display", role: "Flavour names, headlines", sample: "Night Swim", family: "'DM Serif Display', serif" },
      { name: "Bricolage Grotesque", role: "Wordmark, prices, buttons", sample: "Add a 4-pack — $9", family: "'Bricolage Grotesque', sans-serif" },
    ],
    colours: [
      { hex: "#c8443b", name: "Low Tide red" },
      { hex: "#f8dc6c", name: "Lighthouse yellow" },
      { hex: "#4a2f62", name: "Night Swim plum" },
      { hex: "#b9d6c6", name: "Fog Line green" },
      { hex: "#f9c9a6", name: "Postcard peach" },
      { hex: "#173f73", name: "Spring blue" },
    ],
    journeys: [
      { title: "Browse to bag", steps: ["Land on the hero", "Tap flavours to compare — the page repaints", "Add a 4-pack from the hero card", "Review the bag, see free-shipping progress"] },
      { title: "Not sure what to buy", steps: ["Open the flavour finder", "Answer three questions", "Read why the match was chosen", "Add it or open its tasting notes"] },
    ],
    wireframe: [
      {
        label: "Hero — copy, can, card, picker",
        boxes: [
          [4, 10, 34, 40, "Headline"],
          [42, 6, 18, 62, "Can"],
          [66, 18, 30, 34, "Buy card"],
          [14, 76, 72, 16, "Six-flavour picker"],
        ],
      },
      {
        label: "Product page",
        boxes: [
          [4, 6, 44, 70, "Media + views"],
          [54, 6, 42, 22, "Name & story"],
          [54, 32, 42, 26, "Sizes"],
          [54, 62, 42, 14, "Qty + add"],
          [4, 82, 92, 12, "Further down the road"],
        ],
      },
    ],
    states: [
      { title: "Empty bag", body: "Suggests the unflavoured spring as a first step instead of a dead end." },
      { title: "Night Swim", body: "The only dark palette; text, borders and buttons all invert so contrast holds." },
      { title: "No matches", body: "Filtering to a mood with nothing in it offers a one-tap way back to all six." },
      { title: "Checkout", body: "Disabled with a plain explanation — this is a concept, so nothing pretends to take payment." },
    ],
    responsive:
      "On phones the hero stacks headline, can and buy card, and the flavour picker becomes a horizontal scroll with snap points. The road map hides and the six stops become a swipeable row.",
    tradeoffs: [
      "Animating the whole palette risks feeling gimmicky, so only colour moves — layout and controls stay perfectly still.",
      "Cans are drawn in SVG rather than photographed. They're crisp and recolourable, but less realistic than a real product shoot.",
    ],
    learned: [
      "Registering CSS custom properties with @property is what makes a whole-page colour change animate smoothly.",
      "A brand system is easier to extend when every flavour is defined as data (palette, motif, mile) rather than drawn one by one.",
    ],
    next: ["Real packaging renders or photography", "A subscription flow for the mixed box", "Test whether people understand the mile-marker idea without explanation"],
  },
  lightleak: {
    overview:
      "Lightleak is a mobile app concept that answers one question: what does this picture sound like? You add a photo, the app reads its colour and light in the browser, suggests a mood you can change, and builds a short playlist and a post preview.",
    audience: [
      "People who post photo dumps and stories and spend too long choosing the song.",
      "Music lovers who like discovering tracks through a feeling rather than a genre.",
    ],
    challenge:
      "Make a recommendation feel personal without pretending a computer knows how someone felt in a moment. The interpretation had to be visible, editable and honest.",
    direction:
      "A photographer's contact sheet: film-strip navigation, grease-pencil circles to mark the songs that fit, and an interface that borrows its accent colour from your photo.",
    references: [
      { label: "Contact sheets", note: "Frames marked in red pencil became the 'this fits' gesture.", swatch: "#d7362b" },
      { label: "Film rebate", note: "Sprocket holes and frame numbers for the step navigation.", swatch: "#1b191c" },
      { label: "Poster type", note: "Condensed, shouty track titles like gig posters.", swatch: "#151316" },
      { label: "Colour sampling", note: "Palette strips pulled straight from the image.", swatch: "#f0a77a" },
    ],
    type: [
      { name: "Anton", role: "Track titles, screen titles", sample: "WHAT DOES IT SOUND LIKE?", family: "Anton, Impact, sans-serif" },
      { name: "Manrope", role: "Body, controls, dreamy titles", sample: "Half asleep in amber", family: "Manrope, sans-serif" },
    ],
    colours: [
      { hex: "#ecebe5", name: "Photo paper" },
      { hex: "#1b191c", name: "Film" },
      { hex: "#d7362b", name: "Grease pencil" },
      { hex: "#e2e0d8", name: "Darkroom grey" },
    ],
    journeys: [
      { title: "Photo to post", steps: ["Add or pick a photo", "Read the mood and correct it", "Set energy and familiarity", "Watch the photo turn into a playlist", "Circle the songs that fit", "Preview, copy or download the post"] },
      { title: "Refine the feeling", steps: ["Open 'Refine the feeling'", "Swap dreamy for energetic", "The list rebuilds instantly", "Marks on songs you kept stay put"] },
    ],
    wireframe: [
      {
        label: "Mood screen",
        boxes: [
          [6, 6, 30, 34, "Photo"],
          [40, 6, 54, 34, "Palette"],
          [6, 46, 88, 8, "What we measured"],
          [6, 58, 42, 10, "Mood"],
          [52, 58, 42, 10, "Mood"],
          [6, 72, 42, 10, "Mood"],
          [52, 72, 42, 10, "Mood"],
          [6, 88, 88, 8, "Continue"],
        ],
      },
      {
        label: "Playlist",
        boxes: [
          [6, 6, 24, 26, "Photo"],
          [34, 10, 60, 18, "Generated name"],
          [6, 38, 88, 8, "Mood tags + refine"],
          [6, 50, 42, 20, "Frame"],
          [52, 50, 42, 20, "Frame"],
          [6, 74, 42, 20, "Frame"],
          [52, 74, 42, 20, "Frame"],
        ],
      },
    ],
    states: [
      { title: "Upload errors", body: "Non-images and huge files get a specific message and a way forward." },
      { title: "Nothing matches", body: "Over-tight filters offer a 'Loosen the filters' button rather than an empty list." },
      { title: "Explicit filter", body: "Off by default; the list tells you how many songs it hid." },
      { title: "No licensed audio", body: "Each track plays a generated 'mood sketch' and says clearly it isn't the song." },
    ],
    responsive:
      "Built mobile-first: on phones the film strip collapses into a compact step bar at the top and the contact sheet becomes one column. On desktop the strip becomes a side rail.",
    tradeoffs: [
      "No streaming API is connected, so the catalogue is a small hand-tagged list of real songs. It's honest, but small.",
      "Covers are generated stand-ins because real album art isn't licensed for a demo.",
    ],
    learned: [
      "Showing what was measured (bright, warm, low contrast) makes the suggestion feel like a conversation instead of a verdict.",
      "Canvas makes it possible to analyse and export images entirely on the device, which is a privacy feature, not just a technical choice.",
    ],
    next: ["Connect a music API with licensed previews and real search", "Usability-test the mood vocabulary with real posters", "Let people share a playlist link"],
  },
  ranch: {
    overview:
      "Copper Wells is a fictional high-desert guest ranch. The site opens on a WebGL landscape you ride into, then unfolds into eight places to explore, a scrolling history, a box of photographs and a visit planner.",
    audience: ["Travellers looking for a slow, unplugged few days.", "Families and friend groups planning a shared trip.", "Anyone who enjoys a destination site that feels like a place."],
    challenge:
      "Use 3D to create atmosphere, not to show off — and make sure the site still works and still feels special without it.",
    direction:
      "A vintage travel poster brought to life: slab-serif lettering with drop shadows, a limited ochre-rust-turquoise palette, typewriter notes, and a sky that changes from dawn to night.",
    references: [
      { label: "1930s travel posters", note: "Big flat landscapes, layered mesas, confident lettering.", swatch: "#a2472a" },
      { label: "Ranch ledgers", note: "Typewritten facts and hand-ruled tables.", swatch: "#efe2c8" },
      { label: "Desert at dusk", note: "Why the default time is dusk, not noon.", swatch: "#f07a4a" },
      { label: "Weathered copper", note: "The turquoise accent — the ranch's namesake.", swatch: "#5e9c97" },
    ],
    type: [
      { name: "Alfa Slab One", role: "Poster titles", sample: "COPPER WELLS", family: "'Alfa Slab One', serif" },
      { name: "Libre Caslon Text", role: "Story and body", sample: "A ranch that never stopped working", family: "'Libre Caslon Text', serif" },
      { name: "Special Elite", role: "Archive notes, facts", sample: "Rides leave 7 am and 4 pm", family: "'Special Elite', monospace" },
    ],
    colours: [
      { hex: "#a2472a", name: "Rust" },
      { hex: "#c98e3b", name: "Ochre" },
      { hex: "#5e9c97", name: "Copper patina" },
      { hex: "#efe2c8", name: "Postcard cream" },
      { hex: "#3b2418", name: "Saddle brown" },
    ],
    journeys: [
      { title: "Arrive and explore", steps: ["See the gate at dusk", "Ride in down the dirt road", "Choose a place", "Read its postcard and plan around it"] },
      { title: "Plan a stay", steps: ["Pick dates, guests and a room", "See sample availability night by night", "Add activities", "Hold dates in the demo"] },
    ],
    wireframe: [
      {
        label: "Entrance",
        boxes: [
          [0, 0, 100, 100, "3D scene"],
          [5, 46, 46, 34, "Poster title + Ride in"],
          [60, 88, 36, 8, "Time · sound · flat view"],
        ],
      },
      {
        label: "Location panel",
        boxes: [
          [4, 6, 44, 88, "Illustration"],
          [52, 6, 44, 24, "Name & hours"],
          [52, 34, 44, 30, "Story"],
          [52, 68, 44, 12, "Facts"],
          [52, 84, 44, 10, "Plan around it"],
        ],
      },
    ],
    states: [
      { title: "No WebGL", body: "Detected up front; the layered illustrated landscape takes over with the same eight places." },
      { title: "Reduced motion", body: "The ride is skipped; you arrive straight away." },
      { title: "Sold-out nights", body: "Struck through, with a suggestion to switch rooms or shift a day." },
      { title: "Sound", body: "Never autoplays. A clear on/off button; wind always, crickets after dusk." },
    ],
    responsive:
      "On phones the camera widens its field of view, the location list sits above the controls, and the photo box spreads into a two-column grid instead of a row.",
    tradeoffs: [
      "Everything in the 3D scene is built from simple shapes in code — no downloaded models — to keep it light. It reads as stylised rather than realistic.",
      "The scene pauses when it's off-screen or the tab is hidden to save battery.",
    ],
    learned: [
      "HTML buttons that follow 3D positions keep the scene accessible: everything you can click in 3D is a real, focusable button.",
      "A good fallback is a design, not an error message.",
    ],
    next: ["Hand-modelled buildings and horses", "An audio-described ride for screen-reader users", "Seasonal skies tied to the visit date"],
  },
  margin: {
    overview:
      "Margin is a travel planner that starts with your life — budget, days off, pace, walking, food and access — and builds a day-by-day trip around it. Change any of those and the trip rebuilds itself, explaining every swap.",
    audience: [
      "Students and young workers with fixed budgets and few days off.",
      "People who find planning overwhelming and want a realistic starting point.",
      "Travellers with access or dietary needs who are tired of filtering by hand.",
    ],
    challenge:
      "Make a genuinely complex set of decisions — money, time, distance, preferences — feel calm, and be honest when a trip doesn't fit.",
    direction:
      "A modern travel journal: clear sans-serif interface, a serif for the 'journal' moments, colour-coded interests, and a notebook margin line running down every working surface.",
    references: [
      { label: "Paper itineraries", note: "Times on the left, plans on the right, notes in the margin.", swatch: "#e3a5a5" },
      { label: "Boarding passes", note: "The live summary ticket during onboarding.", swatch: "#e8a33d" },
      { label: "Transit maps", note: "Simple zones and numbered stops for each day.", swatch: "#3d6fb6" },
      { label: "Budget envelopes", note: "Money set aside before anything is spent.", swatch: "#4f7a5a" },
    ],
    type: [
      { name: "Fraunces", role: "Titles, journal moments", sample: "Lisbon", family: "Fraunces, serif" },
      { name: "Public Sans", role: "Everything you operate", sample: "It fits, with $713 to spare.", family: "'Public Sans', sans-serif" },
    ],
    colours: [
      { hex: "#1f2a44", name: "Route ink" },
      { hex: "#f5f1e8", name: "Journal paper" },
      { hex: "#e8a33d", name: "Marigold" },
      { hex: "#e3a5a5", name: "Margin rule" },
      { hex: "#4f7a5a", name: "Fits" },
      { hex: "#b04a4a", name: "Over" },
    ],
    journeys: [
      { title: "From nothing to a plan", steps: ["Answer four short steps", "Compare places that fit, with reasons", "Get a day-by-day plan", "Star, replace, reorder, add notes", "Save it and work through the checklist"] },
      { title: "The budget drops", steps: ["Drag the budget down", "The stay moves down a tier", "Paid activities swap for free ones", "'What changed' lists each swap and saving", "If it still can't fit, options appear"] },
    ],
    wireframe: [
      {
        label: "Trip view",
        boxes: [
          [2, 2, 96, 14, "Cover + save"],
          [2, 19, 96, 14, "Budget · days · pace · spending"],
          [2, 36, 96, 7, "What changed"],
          [2, 46, 64, 50, "Day timeline + map"],
          [69, 46, 29, 50, "Budget panel"],
        ],
      },
      {
        label: "Onboarding",
        boxes: [
          [2, 4, 60, 8, "Steps"],
          [2, 16, 60, 10, "Question"],
          [2, 30, 60, 56, "Fields"],
          [2, 90, 60, 8, "Continue"],
          [66, 4, 32, 54, "Live ticket"],
        ],
      },
    ],
    states: [
      { title: "Over budget", body: "Says by how much, then offers shorter trips, cheaper places, a different style or a realistic budget." },
      { title: "Estimate vs confirmed", body: "Every cost is labelled. Mark a stay or flight as booked and it changes from estimate to confirmed." },
      { title: "Hand edits", body: "Stars and replacements are pinned, removals are remembered, so rebuilding never undoes your choices." },
      { title: "Too many steps on foot", body: "When a day's walking passes your limit, a rest block appears." },
    ],
    responsive:
      "On phones the budget panel moves under the day, the day timeline drops its time column, and onboarding puts the live ticket on top so you still see the effect of each answer.",
    tradeoffs: [
      "The data is a small set of sample destinations with illustrative prices. A real product needs live inventory and much more data.",
      "The rules are simple and explainable rather than clever. That's deliberate — people need to trust why something changed.",
    ],
    learned: [
      "Writing the planner as a pure function made it testable, and the tests caught bugs I'd never have spotted by clicking.",
      "Explaining a change is a design problem: comparing the old and new plan and writing the difference as sentences.",
    ],
    next: ["Real prices and opening hours from APIs", "Drag-and-drop reordering on touch screens", "Shared trips for travelling with friends"],
  },
};
