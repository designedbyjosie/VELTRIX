import type { ProjectId } from "../content/projects";

/**
 * EDIT ME — the desk's contents. Every entry is placeholder or illustrative
 * until you replace it with your own sketches, notes and references.
 * Anything marked `placeholder: true` is labelled as such on the desk.
 */
export type ObjectId = "laptop" | "sketchbook" | "moodboard" | "headphones" | "notes" | "drawer" | "letter" | "pinboard" | "photos" | "envelope";

export interface DeskObject {
  id: ObjectId;
  title: string;
  teaser: string;
  /** How it opens — each one behaves differently. */
  interaction: "screen" | "flip" | "filter" | "player" | "notes" | "slide" | "unfold" | "connect" | "inspect" | "seal";
  label: string; // accessible description
  related?: ProjectId[];
  major: boolean; // counts toward the discovery trail
}

export const deskObjects: DeskObject[] = [
  { id: "letter", title: "A letter", teaser: "Start here, if you like.", interaction: "unfold", label: "Open the letter: a short introduction from the designer", major: true },
  { id: "laptop", title: "The laptop", teaser: "How an idea becomes an interface.", interaction: "screen", label: "Open the laptop: the design process behind each project", related: ["sailor", "lightleak", "ranch", "margin"], major: true },
  { id: "sketchbook", title: "Sketchbook", teaser: "Ideas before they were products.", interaction: "flip", label: "Flip through the sketchbook", major: true },
  { id: "moodboard", title: "Moodboard", teaser: "What I look at.", interaction: "filter", label: "Open the moodboard of design references", major: true },
  { id: "pinboard", title: "Pinboard", teaser: "How the four worlds connect.", interaction: "connect", label: "Open the pinboard connecting the four projects", related: ["sailor", "lightleak", "ranch", "margin"], major: true },
  { id: "headphones", title: "Headphones", teaser: "What's on while I work.", interaction: "player", label: "Put on the headphones: a small music corner", related: ["lightleak"], major: true },
  { id: "notes", title: "Sticky notes", teaser: "Things I'm learning.", interaction: "notes", label: "Read the sticky notes about what I'm learning", major: true },
  { id: "drawer", title: "The drawer", teaser: "Unfinished experiments.", interaction: "slide", label: "Open the drawer of unfinished experiments", major: true },
  { id: "photos", title: "Photographs", teaser: "Things I noticed.", interaction: "inspect", label: "Look through the photographs and colour studies", major: false },
  { id: "envelope", title: "Sealed envelope", teaser: "For potential collaborators.", interaction: "seal", label: "Open the sealed envelope: how to work with me", major: false },
];

export const process = [
  { step: "Question", body: "Every project starts as one sentence I can't answer yet: what does a photo sound like?" },
  { step: "Collect", body: "I gather references into a board and write down why each one matters — a picture alone teaches me nothing." },
  { step: "Structure", body: "Boxes on paper. Where does the eye land, what's the one action, what can wait?" },
  { step: "Make it real", body: "I build early, in code, because interfaces only reveal their problems when you touch them." },
  { step: "Break it", body: "Empty states, wrong inputs, tiny screens, no motion. If it survives those, it's a design." },
];

export const evolutions: Record<ProjectId, { idea: string; sketch: string; final: string; decision: string }> = {
  sailor: {
    idea: "“A drink shop where the flavour is the weather.”",
    sketch: "Can in the centre, everything else changes colour around it.",
    final: "Six registered colour variables animate together; layout and buy button never move.",
    decision: "I cut animated waves and boats early — the colour change alone carried the idea.",
  },
  lightleak: {
    idea: "“What does this picture sound like?”",
    sketch: "Photo on top, mood words in the middle, songs below.",
    final: "A contact sheet you mark with a red pencil, with mood words you can overrule.",
    decision: "I stopped pretending the app 'knew' the feeling and made the reading editable.",
  },
  ranch: {
    idea: "“A website you arrive at, not land on.”",
    sketch: "A poster, then a camera move down a road.",
    final: "A WebGL ride from the gate, with an illustrated fallback that feels designed, not broken.",
    decision: "Default time is dusk — the sky does half the art direction.",
  },
  margin: {
    idea: "“Start with what your life allows.”",
    sketch: "Budget slider at the top; the itinerary underneath reacts.",
    final: "A rule-based planner that explains every swap and says plainly when a trip can't fit.",
    decision: "Explaining changes mattered more than clever recommendations.",
  },
};

export interface SketchPage {
  title: string;
  kind: "idea" | "layout" | "type" | "colour" | "interaction";
  note: string;
  finished: boolean;
  related?: ProjectId;
}

/** Illustrative concept sketches drawn for this portfolio. Replace with scans of your own sketchbook. */
export const sketches: SketchPage[] = [
  { title: "Can as weather vane", kind: "idea", note: "What if the product changed the page instead of the page showcasing the product?", finished: true, related: "sailor" },
  { title: "Contact sheet UI", kind: "layout", note: "Songs as film frames. Red pencil circles = keep. Felt obvious the moment I drew it.", finished: true, related: "lightleak" },
  { title: "Slab serif tests", kind: "type", note: "Too cowboy. Too circus. Third try: a heavy slab with a drop shadow, like a poster.", finished: false, related: "ranch" },
  { title: "Budget as a horizon", kind: "interaction", note: "A line across the trip — anything above it gets pushed down. Didn't work; became the budget marker instead.", finished: false, related: "margin" },
  { title: "Five pastels, one ink", kind: "colour", note: "Testing whether six flavours can share one type colour. They can't. Each got its own.", finished: true, related: "sailor" },
  { title: "A calendar that breathes", kind: "idea", note: "Unbuilt: a calendar that shrinks busy weeks and expands empty ones. Still thinking about it.", finished: false },
];

export interface MoodItem {
  id: string;
  title: string;
  category: "Typography" | "Editorial" | "Digital" | "Packaging" | "Photography" | "Motion" | "Colour" | "Environments";
  note: string;
  art: string; // CSS background for the original swatch artwork
  related?: ProjectId;
}

/** Original swatch artwork describing types of references — swap in properly credited images of your own. */
export const moodItems: MoodItem[] = [
  { id: "m1", title: "Wood-type posters", category: "Typography", note: "Letters cut for distance: heavy, tight, unapologetic. Taught me how far a drop shadow can go.", art: "linear-gradient(#efe2c8 0 0) padding-box, repeating-linear-gradient(0deg,#a2472a 0 12px,#efe2c8 12px 20px)", related: "ranch" },
  { id: "m2", title: "Swiss timetables", category: "Editorial", note: "Dense information that's still calm — alignment does the work, not decoration.", art: "repeating-linear-gradient(180deg,#1f2a44 0 2px,#f5f1e8 2px 14px)", related: "margin" },
  { id: "m3", title: "Interfaces that explain themselves", category: "Digital", note: "Products that tell you what just happened. The opposite of a silent spinner.", art: "linear-gradient(135deg,#e8a33d 0 50%,#1f2a44 50%)", related: "margin" },
  { id: "m4", title: "Mineral-water labels", category: "Packaging", note: "A tiny amount of space and a lot of rules, still somehow charming.", art: "radial-gradient(circle at 50% 40%,#f8dc6c 0 22%,transparent 23%),#173f73", related: "sailor" },
  { id: "m5", title: "Film contact sheets", category: "Photography", note: "Choosing is part of making. The rejects are as interesting as the picks.", art: "repeating-linear-gradient(90deg,#1b191c 0 6px,#bbb 6px 30px,#1b191c 30px 36px)", related: "lightleak" },
  { id: "m6", title: "Hinges and lids", category: "Motion", note: "Physical motion has weight and a pivot. Interfaces feel better when they borrow both.", art: "conic-gradient(from 200deg,#b9a6cf,#5b3a5e,#b9a6cf)" },
  { id: "m7", title: "Sun-bleached colour", category: "Colour", note: "Colour that has lived a little. Softer, warmer, more forgiving.", art: "linear-gradient(90deg,#f3c3b6,#f8dc6c,#b9d6c6,#9dbbd6)", related: "sailor" },
  { id: "m8", title: "Desert at dusk", category: "Environments", note: "Three colours, endless variation. The best example I know of a limited palette.", art: "linear-gradient(180deg,#3b3a73,#f07a4a 60%,#a2472a 61%)", related: "ranch" },
  { id: "m9", title: "Handwritten margins", category: "Editorial", note: "Notes in the margin make a document feel owned. That's where Margin got its name.", art: "linear-gradient(90deg,#fffdf8 0 20%,#e3a5a5 20% 22%,#fffdf8 22%)", related: "margin" },
  { id: "m10", title: "Condensed gig posters", category: "Typography", note: "Track titles should shout. Body copy shouldn't.", art: "repeating-linear-gradient(0deg,#151316 0 18px,#ecebe5 18px 22px)", related: "lightleak" },
];

export const notes = [
  { front: "Stillness is a design choice", back: "Not everything should move. One moving thing reads louder than ten.", related: "sailor" as ProjectId, colour: "#f6d9d4" },
  { front: "Say what changed", back: "Every time an interface rearranges itself, it owes you a sentence.", related: "margin" as ProjectId, colour: "#f3e6c8" },
  { front: "Design the fallback", back: "The no-WebGL version of the ranch is my favourite part. Constraints made it better.", related: "ranch" as ProjectId, colour: "#e9c4c8" },
  { front: "Question I'm chasing", back: "Can recommendation feel like a conversation instead of a verdict?", related: "lightleak" as ProjectId, colour: "#fbefe9" },
  { front: "Get better at…", back: "Usability testing with real people. Building is easy to hide in.", colour: "#f6d9d4" },
  { front: "Reminder", back: "Clarity first. Then personality. Never the other way round.", colour: "#f3e6c8" },
];

export const experiments = [
  { title: "Weather-powered type", status: "Abandoned", body: "A headline whose weight follows the local wind speed. Fun for ten seconds, useless after.", lesson: "Novelty needs a job." },
  { title: "Brand for a library of tools", status: "Half-finished", body: "A logo system for a community tool-lending shed. Stuck on the name.", lesson: "Naming is design too." },
  { title: "Scroll that resists", status: "Prototype", body: "A page that gets heavier the faster you scroll. Strange, and kind of calming.", lesson: "Friction can be a feature — rarely." },
  { title: "Interfaces made of paper", status: "Ongoing", body: "Collecting folds, tabs and pockets that could work as UI patterns. This portfolio is the first result.", lesson: "Metaphors help when they also behave." },
];

export const photoStudies = [
  { title: "Laundromat, 7 pm", palette: ["#9dc3c1", "#f3e3c3", "#e07a5f", "#3d405b"], note: "Placeholder study — the fluorescent green against warm skin tones." },
  { title: "Bus window", palette: ["#6d597a", "#b56576", "#e56b6f", "#eaac8b"], note: "Placeholder study — streetlights smeared into a gradient." },
  { title: "Market awning", palette: ["#264653", "#2a9d8f", "#e9c46a", "#f4a261"], note: "Placeholder study — stripes and shadows doing the composition." },
  { title: "Snow on concrete", palette: ["#e5e5e5", "#b8c0c8", "#7d8590", "#2b2d42"], note: "Placeholder study — almost monochrome, so the one red sign shouts." },
];

/** A small demo playlist — not real listening history. Replace with your own. */
export const deskPlaylist = [
  { title: "Gymnopédie No. 1", artist: "Erik Satie", when: "Sketching", mood: "peaceful" as const },
  { title: "Teardrop", artist: "Massive Attack", when: "Late-night layout", mood: "mysterious" as const },
  { title: "Here Comes the Sun", artist: "The Beatles", when: "When something finally works", mood: "carefree" as const },
  { title: "Strobe", artist: "deadmau5", when: "Long build sessions", mood: "cinematic" as const },
];
