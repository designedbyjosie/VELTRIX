import { flavours, type Flavour } from "./data";

export interface FinderAnswers {
  when: "morning" | "afternoon" | "dinner" | "night" | "active";
  sweet: 0 | 1 | 2 | 3;
  taste: "citrus" | "herbal" | "fruit" | "plain";
}

const tasteMotifs: Record<FinderAnswers["taste"], Flavour["motif"][]> = {
  citrus: ["grapefruit", "lemon"],
  herbal: ["cucumber", "grapefruit"],
  fruit: ["peach", "plum"],
  plain: ["spring"],
};

const whenMoods: Record<FinderAnswers["when"], Flavour["mood"][number][]> = {
  morning: ["bright", "soft"],
  afternoon: ["fresh", "bright"],
  dinner: ["deep", "calm", "pure"],
  night: ["deep", "calm"],
  active: ["fresh", "pure"],
};

/** Scores every flavour against the answers and explains the top match. */
export function recommend(a: FinderAnswers) {
  const scored = flavours.map((f) => {
    const reasons: string[] = [];
    let score = 0;
    if (tasteMotifs[a.taste].includes(f.motif)) {
      score += a.taste === "plain" ? 6 : 4;
      reasons.push(a.taste === "plain" ? "it's just the spring, no flavour" : `it's built on ${a.taste === "herbal" ? "herbs and green notes" : a.taste}`);
    }
    if (a.taste === "herbal") {
      score += f.botanical;
    }
    const moodHits = f.mood.filter((m) => whenMoods[a.when].includes(m)).length;
    if (moodHits) {
      score += moodHits * 2;
      reasons.push(`its ${f.mood[0]} character suits ${a.when === "active" ? "after exercise" : a.when === "night" ? "late evenings" : `the ${a.when}`}`);
    }
    const diff = Math.abs(f.sweetness - a.sweet);
    score += 3 - diff;
    if (diff === 0) reasons.push(f.sweetness === 0 ? "it's completely dry, like you asked" : "the sweetness is exactly where you set it");
    return { flavour: f, score, reasons };
  });
  scored.sort((x, y) => y.score - x.score || x.flavour.mile - y.flavour.mile);
  return { best: scored[0], runnerUp: scored[1], all: scored };
}
