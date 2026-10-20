import {
  destinations,
  destinationById,
  interestLabels,
  type Activity,
  type Destination,
  type Interest,
  type Origin,
  type Slot,
  type Stay,
  type Tier,
} from "./data";

/* =====================================================================
   Margin's planning engine. Deterministic and rule-based: the same input
   always produces the same trip, and every decision is written down so
   the interface can explain it. No AI, no live prices.
   ===================================================================== */

export type Pace = "relaxed" | "balanced" | "packed";
export type Style = "shoestring" | "balanced" | "comfort";

export interface TripInput {
  origin: Origin;
  destination: string; // destination id or "suggest"
  month: number; // 0–11
  days: number;
  travelers: number;
  scope: "any" | "domestic" | "international";
  budget: number;
  budgetIncludesTravel: boolean;
  style: Style;
  contingency: 0 | 5 | 10;
  interests: Interest[];
  vacationDays: number | null;
  pace: Pace;
  maxWalk: number; // minutes per day
  structure: "structured" | "flexible";
  earlyStarts: boolean;
  stepFree: boolean;
  diet: ("vegetarian" | "vegan" | "gluten-free" | "halal")[];
  stayPref: "any" | Stay["kind"];
  transport: "transit" | "car";
  /** Things the traveller decided by hand; kept when the trip is rebuilt. */
  favorites: string[];
  excluded: string[];
  pinned: { id: string; day: number }[];
  notes: Record<string, string>;
  dayPace: Record<number, Pace>;
  confirmed: { travel?: number; stay?: number };
}

export const defaultInput: TripInput = {
  origin: "us-east",
  destination: "suggest",
  month: 4,
  days: 4,
  travelers: 2,
  scope: "any",
  budget: 3000,
  budgetIncludesTravel: true,
  style: "balanced",
  contingency: 5,
  interests: ["food", "culture"],
  vacationDays: null,
  pace: "balanced",
  maxWalk: 150,
  structure: "structured",
  earlyStarts: true,
  stepFree: false,
  diet: [],
  stayPref: "any",
  transport: "transit",
  favorites: [],
  excluded: [],
  pinned: [],
  notes: {},
  dayPace: {},
  confirmed: {},
};

export type Basis = "estimate" | "yours" | "confirmed";

export interface BudgetLine {
  key: "travel" | "stay" | "food" | "local" | "activities" | "misc" | "buffer";
  label: string;
  amount: number;
  basis: Basis;
  note: string;
}

export interface Item {
  uid: string;
  kind: "activity" | "rest" | "free";
  activityId?: string;
  title: string;
  detail: string;
  slot: Slot;
  start: string;
  hours: number;
  cost: number; // for the whole group
  walk: number;
  zone: string;
  open?: string;
  interests: Interest[];
  transport?: string;
  alternatives: string[];
}

export interface DayPlan {
  index: number;
  kind: "arrival" | "full" | "departure" | "single";
  pace: Pace;
  zone: string;
  items: Item[];
}

export interface Suggestion {
  kind: "shorten" | "destination" | "budget" | "style";
  label: string;
  apply: Partial<TripInput>;
}

export interface Plan {
  destinationId: string;
  effectiveDays: number;
  nights: number;
  rooms: number;
  stay: Stay | null;
  travelHours: number;
  days: DayPlan[];
  lines: BudgetLine[];
  total: number;
  budget: number;
  status: "fits" | "tight" | "over";
  notes: string[];
  suggestions: Suggestion[];
}

/* ------------------------------ helpers ------------------------------ */
const tierOrder: Record<Style, Tier[]> = {
  shoestring: ["budget", "mid", "comfort"],
  balanced: ["mid", "budget", "comfort"],
  comfort: ["comfort", "mid", "budget"],
};

const round = (n: number) => Math.round(n);
export const money = (n: number) => `$${round(n).toLocaleString("en-US")}`;

function zoneOf(dest: Destination, id: string) {
  return dest.zones.find((z) => z.id === id) ?? dest.zones[0];
}

function distance(dest: Destination, a: string, b: string) {
  const za = zoneOf(dest, a);
  const zb = zoneOf(dest, b);
  return Math.hypot(za.x - zb.x, za.y - zb.y);
}

export function transportNote(dest: Destination, from: string, to: string, mode: TripInput["transport"]) {
  if (from === to) return "Same neighbourhood — a few minutes on foot";
  const d = distance(dest, from, to);
  const walk = Math.round(d * 1.1);
  if (mode === "car") return `About ${Math.max(5, Math.round(d * 0.5))} min by car to ${zoneOf(dest, to).name}`;
  if (walk <= 25) return `${walk} min walk to ${zoneOf(dest, to).name}`;
  return `About ${Math.max(10, Math.round(d * 0.55))} min by public transport to ${zoneOf(dest, to).name}`;
}

function travelFor(input: TripInput, dest: Destination) {
  const [perPerson, hours] = dest.travel[input.origin];
  return { cost: perPerson * input.travelers, hours };
}

export function effectiveDays(input: TripInput) {
  if (input.vacationDays == null) return input.days;
  // vacation days plus one weekend
  return Math.max(1, Math.min(input.days, input.vacationDays + 2));
}

function isDomestic(input: TripInput, dest: Destination) {
  return dest.domesticFor.includes(input.origin);
}

function dietOk(a: Activity, input: TripInput) {
  if (!input.diet.length || !a.interests.includes("food")) return true;
  return input.diet.every((d) => a.diet?.includes(d));
}

function eligible(a: Activity, input: TripInput) {
  if (input.excluded.includes(a.id)) return false;
  if (input.stepFree && !a.stepFree) return false;
  if (!dietOk(a, input)) return false;
  return true;
}

function interestScore(a: Activity, input: TripInput) {
  let s = 0;
  for (const i of a.interests) s += input.interests.includes(i) ? 2 : 0.15;
  return s;
}

/* ------------------------------ budget ------------------------------ */
interface Fixed {
  travel: BudgetLine;
  food: BudgetLine;
  local: BudgetLine;
  buffer: BudgetLine;
  days: number;
  nights: number;
  rooms: number;
  travelHours: number;
}

function fixedCosts(input: TripInput, dest: Destination, styleOverride?: Style): Fixed {
  const days = effectiveDays(input);
  const nights = Math.max(0, days - 1);
  const rooms = Math.ceil(input.travelers / 2);
  const style = styleOverride ?? input.style;
  const t = travelFor(input, dest);
  const travel: BudgetLine = input.budgetIncludesTravel
    ? input.confirmed.travel != null
      ? { key: "travel", label: "Getting there & back", amount: input.confirmed.travel, basis: "confirmed", note: "You entered what you paid" }
      : { key: "travel", label: "Getting there & back", amount: t.cost, basis: "estimate", note: `Sample round-trip estimate from ${t.hours} h away, ${input.travelers} traveller${input.travelers > 1 ? "s" : ""}` }
    : { key: "travel", label: "Getting there & back", amount: 0, basis: "yours", note: "Not included — you said travel is covered separately" };
  const food: BudgetLine = {
    key: "food",
    label: "Food",
    amount: dest.food[style] * input.travelers * days,
    basis: "estimate",
    note: `${money(dest.food[style])} per person per day, ${style} style`,
  };
  const local: BudgetLine =
    input.transport === "car"
      ? { key: "local", label: "Local transport", amount: dest.carDay * Math.ceil(input.travelers / 5) * days, basis: "estimate", note: `Car hire & fuel, ${money(dest.carDay)} a day` }
      : { key: "local", label: "Local transport", amount: dest.transit * input.travelers * days, basis: "estimate", note: `Walking & public transport, ${money(dest.transit)} per person a day` };
  const buffer: BudgetLine = {
    key: "buffer",
    label: "Safety buffer",
    amount: round((input.budget * input.contingency) / 100),
    basis: "yours",
    note: input.contingency ? `${input.contingency}% of your budget, set aside` : "No buffer — you chose to skip it",
  };
  return { travel, food, local, buffer, days, nights, rooms, travelHours: t.hours };
}

function stayCost(stay: Stay, f: Fixed, input: TripInput) {
  if (input.confirmed.stay != null) return input.confirmed.stay;
  return stay.nightly * f.nights * f.rooms;
}

/** Cheapest realistic version of a trip: used to say honestly when it can't fit. */
export function minimumCost(input: TripInput, dest: Destination) {
  const f = fixedCosts({ ...input }, dest, "shoestring");
  const stays = dest.stays.filter((s) => !input.stepFree || s.stepFree);
  const cheapest = stays.length ? Math.min(...stays.map((s) => s.nightly)) * f.nights * f.rooms : 0;
  const misc = (f.food.amount + f.local.amount) * 0.05;
  return round(f.travel.amount + f.food.amount + f.local.amount + cheapest + misc + f.buffer.amount);
}

/* ------------------------------ destinations ------------------------------ */
export interface Ranked {
  dest: Destination;
  score: number;
  reasons: string[];
  estimate: number;
  minimum: number;
  fits: boolean;
}

export function rankDestinations(input: TripInput): Ranked[] {
  const out: Ranked[] = [];
  for (const dest of destinations) {
    const domestic = isDomestic(input, dest);
    if (input.scope === "domestic" && !domestic) continue;
    if (input.scope === "international" && domestic) continue;
    const reasons: string[] = [];
    const interests = input.interests.length ? input.interests : (["culture", "food"] as Interest[]);
    const fit = interests.reduce((s, i) => s + (dest.interests[i] ?? 0), 0) / interests.length;
    const strong = interests.filter((i) => (dest.interests[i] ?? 0) >= 0.85).map((i) => interestLabels[i].toLowerCase());
    if (strong.length) reasons.push(`Strong for ${strong.slice(0, 3).join(", ")}`);
    const season = dest.goodMonths.includes(input.month);
    if (season) reasons.push("Good time of year to go");
    else reasons.push("Off-season then — fewer crowds, less reliable weather");
    const days = effectiveDays(input);
    const { hours } = travelFor(input, dest);
    const travelShare = (hours * 2) / (days * 24);
    if (travelShare > 0.2) reasons.push(`Long journey for ${days} days (${hours} h each way)`);
    else if (hours <= 4) reasons.push(`Short trip to get there (${hours} h)`);
    const minimum = minimumCost(input, dest);
    const estimate = round(minimum * (input.style === "comfort" ? 1.7 : input.style === "balanced" ? 1.3 : 1.05));
    const fits = minimum <= input.budget;
    if (!fits) reasons.push(`Needs at least ${money(minimum)} for this trip`);
    else if (estimate <= input.budget) reasons.push("Fits your budget comfortably");
    else reasons.push("Fits if you keep costs down");
    const score = fit * 5 + (season ? 1.2 : 0) - Math.max(0, travelShare - 0.12) * 12 + (fits ? 2 : -3) + (estimate <= input.budget ? 1 : 0);
    out.push({ dest, score, reasons, estimate, minimum, fits });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ------------------------------ itinerary ------------------------------ */
function slotsFor(kind: DayPlan["kind"], pace: Pace, travelHours: number): Slot[] {
  if (kind === "arrival") return travelHours <= 3 ? ["afternoon", "evening"] : ["evening"];
  if (kind === "departure") return travelHours <= 3 ? ["morning", "afternoon"] : ["morning"];
  if (pace === "relaxed") return ["morning", "afternoon", "evening"];
  if (pace === "packed") return ["morning", "afternoon", "afternoon", "evening"];
  return ["morning", "afternoon", "evening"];
}

function startFor(slot: Slot, n: number, input: TripInput) {
  if (slot === "morning") return input.earlyStarts ? "08:30" : "10:00";
  if (slot === "afternoon") return n === 0 ? "13:30" : "16:00";
  return "19:30";
}

interface FillContext {
  input: TripInput;
  dest: Destination;
  used: Set<string>;
  avoid: Set<string>;
  activityBudget: number;
  spent: number;
}

function makeItem(a: Activity, slot: Slot, input: TripInput, start: string): Item {
  return {
    uid: `${a.id}@${slot}`,
    kind: "activity",
    activityId: a.id,
    title: a.name,
    detail: a.detail,
    slot,
    start,
    hours: a.hours,
    cost: a.cost * input.travelers,
    walk: a.walk,
    zone: a.zone,
    open: a.open,
    interests: a.interests,
    alternatives: [],
  };
}

function pickZone(ctx: FillContext, dayIndex: number) {
  const { dest, input } = ctx;
  const scores = dest.zones.map((z) => {
    const s = dest.activities
      .filter((a) => a.zone === z.id && !ctx.used.has(a.id) && eligible(a, input))
      .reduce((sum, a) => sum + interestScore(a, input), 0);
    return { id: z.id, s };
  });
  scores.sort((a, b) => b.s - a.s || a.id.localeCompare(b.id));
  // rotate gently so consecutive days explore different areas
  return scores[dayIndex % Math.min(2, scores.length)]?.id ?? dest.zones[0].id;
}

function fillDay(ctx: FillContext, index: number, kind: DayPlan["kind"], pace: Pace, travelHours: number): DayPlan {
  const { input, dest } = ctx;
  const zone = pickZone(ctx, index);
  const slots = slotsFor(kind, pace, travelHours);
  const items: Item[] = [];
  let walked = 0;
  let longUsed = false;
  const maxActivities = pace === "relaxed" ? 2 : slots.length;

  // pinned or favourite activities go first, on their chosen day
  const pins = input.pinned.filter((p) => p.day === index).map((p) => dest.activities.find((a) => a.id === p.id)).filter(Boolean) as Activity[];

  slots.forEach((slot, n) => {
    if (items.filter((i) => i.kind === "activity").length >= maxActivities) return;
    if (longUsed && slot === "afternoon") return;
    const lastZone = items.length ? items[items.length - 1].zone : zone;
    const pin = pins.find((p) => p.slots.includes(slot) && !ctx.used.has(p.id));
    let chosen: Activity | undefined = pin;
    if (!chosen) {
      const remaining = ctx.activityBudget - ctx.spent;
      const candidates = dest.activities.filter(
        (a) =>
          a.slots.includes(slot) &&
          !ctx.used.has(a.id) &&
          !ctx.avoid.has(a.id) &&
          eligible(a, input) &&
          a.cost * input.travelers <= Math.max(0, remaining) &&
          walked + a.walk <= input.maxWalk &&
          !(a.hours >= 5 && (kind !== "full" || slot !== "morning")),
      );
      const scored = candidates
        .map((a) => {
          let s = interestScore(a, input);
          if (a.zone === lastZone) s += 1.4;
          else if (distance(dest, a.zone, lastZone) < 35) s += 0.6;
          if (input.favorites.includes(a.id)) s += 3;
          const share = (a.cost * input.travelers) / Math.max(1, ctx.activityBudget);
          s -= share * (input.style === "shoestring" ? 6 : input.style === "balanced" ? 3 : 1.2);
          if (!input.earlyStarts && slot === "morning" && /sunrise|dawn|early/i.test(a.name + a.detail)) s -= 2;
          return { a, s };
        })
        .sort((x, y) => y.s - x.s || x.a.id.localeCompare(y.a.id));
      chosen = scored[0]?.a;
    }
    if (!chosen) return;
    if (input.structure === "flexible" && slot === "evening" && kind === "full" && !pin && !input.favorites.includes(chosen.id)) {
      const ideas = dest.activities.filter((a) => a.slots.includes("evening") && !ctx.used.has(a.id) && eligible(a, input)).slice(0, 3);
      items.push({
        uid: `free-${index}-evening`,
        kind: "free",
        title: "Free evening",
        detail: `Left open on purpose. Ideas nearby: ${ideas.map((i) => i.name.toLowerCase()).join("; ") || "wander and see"}.`,
        slot,
        start: startFor(slot, n, input),
        hours: 2,
        cost: 0,
        walk: 0,
        zone: lastZone,
        interests: [],
        alternatives: ideas.map((i) => i.id),
      });
      return;
    }
    ctx.used.add(chosen.id);
    ctx.spent += chosen.cost * input.travelers;
    walked += chosen.walk;
    if (chosen.hours >= 5) longUsed = true;
    items.push(makeItem(chosen, slot, input, startFor(slot, n, input)));
    if (pace === "relaxed" && slot === "morning" && kind === "full") {
      items.push({
        uid: `rest-${index}`,
        kind: "rest",
        title: "Long lunch & a rest",
        detail: "Nothing scheduled. Go back to the room, find a café, or keep wandering.",
        slot: "afternoon",
        start: "12:30",
        hours: 2,
        cost: 0,
        walk: 0,
        zone: chosen.zone,
        interests: [],
        alternatives: [],
      });
    }
  });

  if (walked > input.maxWalk * 0.75 && kind === "full" && !items.some((i) => i.kind === "rest")) {
    const at = items.findIndex((i) => i.slot !== "morning");
    const rest: Item = {
      uid: `rest-${index}`,
      kind: "rest",
      title: "Rest your feet",
      detail: `This day already has about ${walked} minutes on foot — take an hour off before the evening.`,
      slot: "afternoon",
      start: "17:30",
      hours: 1,
      cost: 0,
      walk: 0,
      zone: items[0]?.zone ?? zone,
      interests: [],
      alternatives: [],
    };
    if (at >= 0) items.splice(at + 1, 0, rest);
    else items.push(rest);
  }

  return { index, kind, pace, zone, items };
}

/** Fills in transport notes and alternatives after items are placed. */
function finishDay(day: DayPlan, ctx: FillContext) {
  const { dest, input } = ctx;
  let prevZone: string | null = null;
  day.items.forEach((item) => {
    if (prevZone && item.kind !== "rest") item.transport = transportNote(dest, prevZone, item.zone, input.transport);
    prevZone = item.zone;
    if (item.kind === "activity") {
      item.alternatives = dest.activities
        .filter((a) => a.id !== item.activityId && !ctx.used.has(a.id) && a.slots.includes(item.slot) && eligible(a, input) && a.interests.some((i) => item.interests.includes(i) || input.interests.includes(i)))
        .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
        .slice(0, 3)
        .map((a) => a.id);
    }
  });
  return day;
}

export function recomputeTimes(day: DayPlan, input: TripInput) {
  const counts: Record<Slot, number> = { morning: 0, afternoon: 0, evening: 0 };
  day.items.forEach((i) => {
    if (i.kind === "rest") return;
    i.start = startFor(i.slot, counts[i.slot]++, input);
  });
}

/* ------------------------------ the plan ------------------------------ */
export function generate(input: TripInput, opts: { destinationId?: string } = {}): Plan {
  const destId = opts.destinationId ?? (input.destination === "suggest" ? rankDestinations(input)[0]?.dest.id ?? destinations[0].id : input.destination);
  const dest = destinationById(destId)!;
  const notes: string[] = [];
  const f = fixedCosts(input, dest);

  if (input.vacationDays != null && f.days < input.days) {
    notes.push(`Shortened to ${f.days} days to fit ${input.vacationDays} vacation days plus a weekend.`);
  }

  // choose a stay: the most suitable tier that still leaves room for activities
  const kinds = input.stayPref === "any" ? null : input.stayPref;
  let pool = dest.stays.filter((s) => (!input.stepFree || s.stepFree) && (!kinds || s.kind === kinds));
  if (!pool.length) {
    pool = dest.stays.filter((s) => !input.stepFree || s.stepFree);
    if (kinds) notes.push(`No ${kinds} in the sample data for ${dest.name}, so a similar option was used.`);
  }
  if (!pool.length) pool = dest.stays;
  const base = f.travel.amount + f.food.amount + f.local.amount + f.buffer.amount;
  const reserve = 15 * input.travelers * f.days;
  const ordered = tierOrder[input.style].flatMap((t) => pool.filter((s) => s.tier === t).sort((a, b) => a.nightly - b.nightly));
  let stay: Stay | null = f.nights === 0 ? null : ordered[0] ?? null;
  if (f.nights > 0) {
    const affordable = ordered.find((s) => base + stayCost(s, f, input) * 1.04 + reserve <= input.budget);
    const cheapest = [...pool].sort((a, b) => a.nightly - b.nightly)[0];
    if (affordable) {
      if (affordable.id !== ordered[0].id) notes.push(`Chose “${affordable.name}” because “${ordered[0].name}” would leave too little for the rest of the trip.`);
      stay = affordable;
    } else {
      stay = cheapest;
      notes.push(`Using the cheapest sample stay (“${cheapest.name}”); even so the trip is over budget.`);
    }
  }
  const stayLine: BudgetLine = stay
    ? {
        key: "stay",
        label: "Places to stay",
        amount: stayCost(stay, f, input),
        basis: input.confirmed.stay != null ? "confirmed" : "estimate",
        note: input.confirmed.stay != null ? "You entered what you paid" : `${stay.name}, ${f.nights} night${f.nights === 1 ? "" : "s"} × ${f.rooms} room${f.rooms > 1 ? "s" : ""} at ${money(stay.nightly)}`,
      }
    : { key: "stay", label: "Places to stay", amount: 0, basis: "estimate", note: "Day trip — no overnight stay" };

  const committed = base + stayLine.amount;
  const misc = round((f.food.amount + f.local.amount) * 0.05);
  const activityBudget = Math.max(0, input.budget - committed - misc);
  const ctx: FillContext = { input, dest, used: new Set(), avoid: new Set(), activityBudget, spent: 0 };

  // favourites and pins are reserved before anything else is chosen
  const days: DayPlan[] = [];
  for (let i = 0; i < f.days; i++) {
    const kind: DayPlan["kind"] = f.days === 1 ? "single" : i === 0 && f.travelHours > 1.5 ? "arrival" : i === f.days - 1 && f.travelHours > 1.5 ? "departure" : "full";
    const pace = input.dayPace[i] ?? input.pace;
    days.push(fillDay(ctx, i, kind === "single" ? "full" : kind, pace, f.travelHours));
  }
  // favourites that didn't land anywhere get placed on the first day with a free matching slot
  for (const fav of input.favorites) {
    if (ctx.used.has(fav) || input.excluded.includes(fav)) continue;
    const a = dest.activities.find((x) => x.id === fav);
    if (!a) continue;
    const day = days.find((d) => d.kind === "full" && !d.items.some((i) => i.slot === a.slots[0] && i.kind === "activity"));
    if (day) {
      ctx.used.add(a.id);
      ctx.spent += a.cost * input.travelers;
      day.items.push(makeItem(a, a.slots[0], input, "—"));
      day.items.sort((x, y) => ["morning", "afternoon", "evening"].indexOf(x.slot) - ["morning", "afternoon", "evening"].indexOf(y.slot));
      recomputeTimes(day, input);
    }
  }
  days.forEach((d) => finishDay(d, ctx));

  const actTotal = days.flatMap((d) => d.items).reduce((s, i) => s + i.cost, 0);
  const lines: BudgetLine[] = [
    f.travel,
    stayLine,
    f.food,
    f.local,
    { key: "activities", label: "Activities & tickets", amount: actTotal, basis: "estimate", note: `${days.flatMap((d) => d.items).filter((i) => i.kind === "activity").length} planned, sample prices` },
    { key: "misc", label: "Everything else", amount: misc, basis: "estimate", note: "5% of food & transport for tips, snacks, small stuff" },
    f.buffer,
  ];
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const status: Plan["status"] = total > input.budget ? "over" : input.budget - total < input.budget * 0.05 ? "tight" : "fits";

  if (actTotal === 0 && activityBudget < 20) notes.push("There's almost no money left for paid activities, so the plan uses free ones.");
  const free = days.flatMap((d) => d.items).filter((i) => i.kind === "activity" && i.cost === 0).length;
  if (free >= 3) notes.push(`${free} of the activities are free.`);

  const suggestions: Suggestion[] = [];
  if (status === "over") {
    const min = minimumCost(input, dest);
    for (let d = f.days - 1; d >= 1; d--) {
      if (minimumCost({ ...input, days: d, vacationDays: null }, dest) <= input.budget) {
        suggestions.push({ kind: "shorten", label: `Make it ${d} day${d > 1 ? "s" : ""} instead of ${f.days}`, apply: { days: d } });
        break;
      }
    }
    if (input.style !== "shoestring") suggestions.push({ kind: "style", label: "Switch to a shoestring spending style", apply: { style: "shoestring" } });
    const cheaper = rankDestinations({ ...input })
      .filter((r) => r.dest.id !== dest.id && r.fits)
      .slice(0, 2);
    cheaper.forEach((r) => suggestions.push({ kind: "destination", label: `Go to ${r.dest.name} instead (from ${money(r.minimum)})`, apply: { destination: r.dest.id } }));
    suggestions.push({ kind: "budget", label: `Raise the budget to ${money(Math.max(min, total))}`, apply: { budget: Math.ceil(Math.max(min, total) / 50) * 50 } });
  }

  return {
    destinationId: dest.id,
    effectiveDays: f.days,
    nights: f.nights,
    rooms: f.rooms,
    stay,
    travelHours: f.travelHours,
    days,
    lines,
    total,
    budget: input.budget,
    status,
    notes,
    suggestions,
  };
}

/** Rebuilds the totals after a hand edit, without re-choosing anything. */
export function retotal(plan: Plan, input: TripInput): Plan {
  const act = plan.days.flatMap((d) => d.items).reduce((s, i) => s + i.cost, 0);
  const lines = plan.lines.map((l) =>
    l.key === "activities" ? { ...l, amount: act, note: `${plan.days.flatMap((d) => d.items).filter((i) => i.kind === "activity").length} planned, sample prices` } : l,
  );
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const status: Plan["status"] = total > input.budget ? "over" : input.budget - total < input.budget * 0.05 ? "tight" : "fits";
  return { ...plan, lines, total, status, budget: input.budget };
}

/** Rebuilds one day with fresh picks, leaving the others alone. */
export function regenerateDay(plan: Plan, input: TripInput, dayIndex: number, pace?: Pace): Plan {
  const dest = destinationById(plan.destinationId)!;
  const used = new Set(plan.days.filter((d) => d.index !== dayIndex).flatMap((d) => d.items.map((i) => i.activityId).filter(Boolean) as string[]));
  const current = plan.days[dayIndex];
  const avoid = new Set(current.items.map((i) => i.activityId).filter((id): id is string => !!id && !input.favorites.includes(id)));
  const spentElsewhere = plan.days.filter((d) => d.index !== dayIndex).flatMap((d) => d.items).reduce((s, i) => s + i.cost, 0);
  const fixed = plan.lines.filter((l) => l.key !== "activities").reduce((s, l) => s + l.amount, 0);
  const ctx: FillContext = { input, dest, used, avoid, activityBudget: Math.max(0, input.budget - fixed), spent: spentElsewhere };
  let day = fillDay(ctx, dayIndex, current.kind, pace ?? current.pace, plan.travelHours);
  if (!day.items.some((i) => i.kind === "activity")) {
    // nothing new left to suggest: allow repeats of what was there
    ctx.avoid.clear();
    day = fillDay(ctx, dayIndex, current.kind, pace ?? current.pace, plan.travelHours);
  }
  finishDay(day, ctx);
  const days = plan.days.map((d) => (d.index === dayIndex ? day : d));
  return retotal({ ...plan, days }, input);
}

/* ------------------------------ explaining changes ------------------------------ */
export interface Change {
  tone: "saving" | "adding" | "neutral" | "warning";
  text: string;
}

export function diffPlans(prev: Plan, next: Plan, prevInput: TripInput, nextInput: TripInput): Change[] {
  const out: Change[] = [];
  const name = (id: string) => destinationById(id)?.name ?? id;
  if (prev.destinationId !== next.destinationId) out.push({ tone: "neutral", text: `Destination changed from ${name(prev.destinationId)} to ${name(next.destinationId)}.` });
  if (prev.effectiveDays !== next.effectiveDays) out.push({ tone: "neutral", text: `Trip is now ${next.effectiveDays} days (was ${prev.effectiveDays}).` });
  if (prev.stay?.id !== next.stay?.id && next.stay && prev.destinationId === next.destinationId) {
    const a = prev.lines.find((l) => l.key === "stay")!.amount;
    const b = next.lines.find((l) => l.key === "stay")!.amount;
    out.push({
      tone: b < a ? "saving" : "adding",
      text: `${b < a ? "Moved" : "Upgraded"} from “${prev.stay?.name ?? "no stay"}” to “${next.stay.name}” — ${b < a ? "saves" : "adds"} ${money(Math.abs(a - b))}.`,
    });
  }
  if (prev.destinationId === next.destinationId) {
    const len = Math.min(prev.days.length, next.days.length);
    const dayOf = (p: Plan, id?: string) => p.days.findIndex((d) => d.items.some((x) => x.activityId === id));
    for (let i = 0; i < len; i++) {
      const before = prev.days[i].items.filter((x) => x.kind === "activity");
      const after = next.days[i].items.filter((x) => x.kind === "activity");
      const removed = before.filter((b) => !after.some((a) => a.activityId === b.activityId) && dayOf(next, b.activityId) < 0);
      const added = after.filter((a) => !before.some((b) => b.activityId === a.activityId) && dayOf(prev, a.activityId) < 0);
      before
        .filter((b) => dayOf(next, b.activityId) >= 0 && dayOf(next, b.activityId) !== i)
        .forEach((b) => out.push({ tone: "neutral", text: `Moved ${b.title} from day ${i + 1} to day ${dayOf(next, b.activityId) + 1}.` }));
      const pairs = Math.min(removed.length, added.length);
      for (let k = 0; k < pairs; k++) {
        const r = removed[k];
        const a = added[k];
        const delta = r.cost - a.cost;
        out.push({
          tone: delta > 0 ? "saving" : delta < 0 ? "adding" : "neutral",
          text: `Day ${i + 1}: swapped ${r.title} (${r.cost ? money(r.cost) : "free"}) for ${a.title} (${a.cost ? money(a.cost) : "free"})${delta ? ` — ${delta > 0 ? "saves" : "adds"} ${money(Math.abs(delta))}` : ""}.`,
        });
      }
      removed.slice(pairs).forEach((r) => out.push({ tone: "saving", text: `Day ${i + 1}: dropped ${r.title}${r.cost ? ` — saves ${money(r.cost)}` : ""}.` }));
      added.slice(pairs).forEach((a) => out.push({ tone: "adding", text: `Day ${i + 1}: added ${a.title}${a.cost ? ` (${money(a.cost)})` : " (free)"}.` }));
    }
  }
  if (prevInput.budget !== nextInput.budget) {
    out.push({
      tone: next.status === "over" ? "warning" : "neutral",
      text:
        next.status === "over"
          ? `At ${money(nextInput.budget)} this trip doesn't fit — it still needs about ${money(next.total)}. See the options below.`
          : `New estimated total ${money(next.total)} of your ${money(nextInput.budget)}.`,
    });
  }
  if (!out.length) out.push({ tone: "neutral", text: "Nothing needed to change — the trip already fits." });
  return out;
}

/* ------------------------------ packing ------------------------------ */
export function packingList(input: TripInput, plan: Plan) {
  const dest = destinationById(plan.destinationId)!;
  const temp = dest.climate[input.month];
  const list = ["Passport or ID", "Phone charger & adapter", "Reusable water bottle", "Comfortable walking shoes"];
  if (temp === "cold") list.push("Warm coat, hat & gloves", "Thermal layers");
  if (temp === "cool") list.push("Warm jumper", "Light jacket");
  if (temp === "mild") list.push("Layers for cool evenings");
  if (temp === "warm" || temp === "hot") list.push("Sunscreen", "Sunglasses & hat", "Light, breathable clothes");
  if (dest.rainyMonths.includes(input.month)) list.push("Rain jacket or umbrella");
  const acts = plan.days.flatMap((d) => d.items).flatMap((i) => i.interests);
  if (acts.includes("adventure") || acts.includes("nature")) list.push("Day pack", "Trail shoes");
  if (acts.includes("nightlife")) list.push("One going-out outfit");
  if (acts.includes("photo")) list.push("Camera & spare battery");
  if (input.transport === "car") list.push("Driving licence", "Offline maps");
  if (input.diet.length) list.push(`Snacks that suit your diet (${input.diet.join(", ")})`);
  if (input.stepFree) list.push("Accessibility details for each venue (confirm before you go)");
  return Array.from(new Set(list));
}
