import type { Mood } from "./analyze";

/**
 * A small, hand-tagged demo catalogue. Titles, artists and years are real
 * songs; the mood, energy and popularity tags are subjective and were entered
 * by hand for this prototype. No audio, artwork or streaming data is included.
 */
export type Genre = "indie" | "pop" | "rnb" | "electronic" | "folk" | "hiphop" | "rock" | "jazz" | "classical";

export interface Track {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: Genre;
  moods: Mood[];
  energy: number; // 0–1
  popularity: number; // 0 undiscovered … 1 everyone knows it
  vocal: boolean;
  explicit: boolean;
}

export const genreLabels: Record<Genre, string> = {
  indie: "Indie",
  pop: "Pop",
  rnb: "R&B / soul",
  electronic: "Electronic",
  folk: "Folk & acoustic",
  hiphop: "Hip-hop",
  rock: "Rock",
  jazz: "Jazz",
  classical: "Classical & ambient",
};

const t = (
  title: string,
  artist: string,
  year: number,
  genre: Genre,
  moods: Mood[],
  energy: number,
  popularity: number,
  vocal = true,
  explicit = false,
): Track => ({
  id: (title + "-" + artist).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  title,
  artist,
  year,
  genre,
  moods,
  energy,
  popularity,
  vocal,
  explicit,
});

export const catalog: Track[] = [
  t("Space Song", "Beach House", 2015, "indie", ["dreamy", "melancholic", "nostalgic"], 0.35, 0.7),
  t("Myth", "Beach House", 2012, "indie", ["dreamy", "cinematic"], 0.45, 0.45),
  t("Dreams", "Fleetwood Mac", 1977, "rock", ["dreamy", "nostalgic", "carefree"], 0.5, 0.95),
  t("Go Your Own Way", "Fleetwood Mac", 1977, "rock", ["energetic", "carefree", "nostalgic"], 0.75, 0.85),
  t("Here Comes the Sun", "The Beatles", 1969, "rock", ["carefree", "peaceful", "playful"], 0.5, 0.97),
  t("Walking on Sunshine", "Katrina and the Waves", 1985, "pop", ["energetic", "playful", "carefree"], 0.9, 0.8),
  t("September", "Earth, Wind & Fire", 1978, "rnb", ["playful", "energetic", "nostalgic"], 0.85, 0.9),
  t("Dancing Queen", "ABBA", 1976, "pop", ["playful", "nostalgic", "carefree"], 0.75, 0.93),
  t("Mr. Blue Sky", "Electric Light Orchestra", 1977, "rock", ["playful", "carefree", "energetic"], 0.75, 0.8),
  t("Holocene", "Bon Iver", 2011, "folk", ["peaceful", "melancholic", "cinematic"], 0.25, 0.6),
  t("Skinny Love", "Bon Iver", 2007, "folk", ["melancholic", "nostalgic"], 0.35, 0.75),
  t("Liability", "Lorde", 2017, "pop", ["melancholic", "romantic"], 0.2, 0.65),
  t("Green Light", "Lorde", 2017, "pop", ["energetic", "carefree"], 0.8, 0.75),
  t("Ribs", "Lorde", 2013, "pop", ["nostalgic", "dreamy", "melancholic"], 0.55, 0.6),
  t("Video Games", "Lana Del Rey", 2011, "pop", ["romantic", "melancholic", "cinematic"], 0.25, 0.8),
  t("Young and Beautiful", "Lana Del Rey", 2013, "pop", ["cinematic", "romantic", "melancholic"], 0.3, 0.8),
  t("Sunflower", "Rex Orange County", 2017, "indie", ["carefree", "playful", "romantic"], 0.6, 0.55),
  t("Best Part", "Daniel Caesar & H.E.R.", 2017, "rnb", ["romantic", "peaceful"], 0.3, 0.75),
  t("Adorn", "Miguel", 2012, "rnb", ["romantic", "playful"], 0.55, 0.7),
  t("Redbone", "Childish Gambino", 2016, "rnb", ["mysterious", "romantic"], 0.45, 0.85),
  t("Feel Good Inc.", "Gorillaz", 2005, "hiphop", ["playful", "mysterious"], 0.65, 0.85),
  t("Nights", "Frank Ocean", 2016, "rnb", ["nostalgic", "mysterious", "melancholic"], 0.45, 0.75, true, true),
  t("Money Trees", "Kendrick Lamar", 2012, "hiphop", ["cinematic", "nostalgic", "mysterious"], 0.5, 0.8, true, true),
  t("Alright", "Kendrick Lamar", 2015, "hiphop", ["energetic", "cinematic"], 0.75, 0.8, true, true),
  t("Take Five", "The Dave Brubeck Quartet", 1959, "jazz", ["playful", "mysterious", "nostalgic"], 0.5, 0.75, false),
  t("So What", "Miles Davis", 1959, "jazz", ["mysterious", "peaceful", "cinematic"], 0.35, 0.7, false),
  t("Feeling Good", "Nina Simone", 1965, "jazz", ["cinematic", "energetic", "romantic"], 0.5, 0.85),
  t("At Last", "Etta James", 1960, "jazz", ["romantic", "nostalgic"], 0.3, 0.85),
  t("Lovely Day", "Bill Withers", 1977, "rnb", ["peaceful", "carefree", "playful"], 0.5, 0.85),
  t("Riptide", "Vance Joy", 2013, "folk", ["carefree", "playful"], 0.65, 0.8),
  t("Banana Pancakes", "Jack Johnson", 2005, "folk", ["peaceful", "carefree", "romantic"], 0.4, 0.7),
  t("Rivers and Roads", "The Head and the Heart", 2011, "folk", ["nostalgic", "melancholic", "cinematic"], 0.4, 0.4),
  t("Ho Hey", "The Lumineers", 2012, "folk", ["playful", "carefree", "romantic"], 0.6, 0.8),
  t("Bloom", "The Paper Kites", 2010, "folk", ["romantic", "peaceful", "dreamy"], 0.25, 0.35),
  t("Strobe", "deadmau5", 2009, "electronic", ["cinematic", "dreamy", "energetic"], 0.6, 0.55, false),
  t("Midnight City", "M83", 2011, "electronic", ["energetic", "cinematic", "nostalgic"], 0.8, 0.8),
  t("Innerbloom", "RÜFÜS DU SOL", 2015, "electronic", ["dreamy", "cinematic", "peaceful"], 0.45, 0.45),
  t("Breathe", "Télépopmusik", 2001, "electronic", ["dreamy", "melancholic", "peaceful"], 0.3, 0.4),
  t("Tadow", "Masego & FKJ", 2017, "jazz", ["romantic", "playful", "mysterious"], 0.4, 0.5),
  t("Electric Feel", "MGMT", 2007, "indie", ["playful", "energetic", "mysterious"], 0.7, 0.8),
  t("Kids", "MGMT", 2007, "indie", ["nostalgic", "playful", "energetic"], 0.75, 0.75),
  t("Mr. Brightside", "The Killers", 2003, "rock", ["energetic", "nostalgic"], 0.9, 0.95),
  t("Wonderwall", "Oasis", 1995, "rock", ["nostalgic", "romantic"], 0.55, 0.93),
  t("Do I Wanna Know?", "Arctic Monkeys", 2013, "rock", ["mysterious", "cinematic", "romantic"], 0.55, 0.9),
  t("505", "Arctic Monkeys", 2007, "rock", ["romantic", "melancholic", "cinematic"], 0.6, 0.8),
  t("Heroes", "David Bowie", 1977, "rock", ["cinematic", "romantic", "energetic"], 0.7, 0.85),
  t("Levitating", "Dua Lipa", 2020, "pop", ["energetic", "playful", "carefree"], 0.85, 0.9),
  t("Golden Hour", "JVKE", 2022, "pop", ["romantic", "dreamy", "cinematic"], 0.45, 0.85),
  t("Watermelon Sugar", "Harry Styles", 2019, "pop", ["carefree", "playful"], 0.7, 0.9),
  t("Ocean Eyes", "Billie Eilish", 2015, "pop", ["dreamy", "melancholic", "romantic"], 0.3, 0.8),
  t("Sweater Weather", "The Neighbourhood", 2012, "indie", ["mysterious", "nostalgic", "romantic"], 0.55, 0.9),
  t("Dog Days Are Over", "Florence + the Machine", 2008, "indie", ["energetic", "carefree", "cinematic"], 0.8, 0.75),
  t("Yellow", "Coldplay", 2000, "rock", ["romantic", "nostalgic", "dreamy"], 0.5, 0.95),
  t("Teardrop", "Massive Attack", 1998, "electronic", ["mysterious", "melancholic", "cinematic"], 0.4, 0.7),
  t("Intro", "The xx", 2009, "indie", ["mysterious", "cinematic", "energetic"], 0.55, 0.7, false),
  t("Svefn-g-englar", "Sigur Rós", 1999, "indie", ["dreamy", "melancholic", "cinematic"], 0.25, 0.35),
  t("An Ending (Ascent)", "Brian Eno", 1983, "classical", ["peaceful", "dreamy", "melancholic"], 0.1, 0.45, false),
  t("Weightless", "Marconi Union", 2011, "classical", ["peaceful", "dreamy"], 0.05, 0.3, false),
  t("Gymnopédie No. 1", "Erik Satie", 1888, "classical", ["peaceful", "melancholic", "nostalgic"], 0.1, 0.7, false),
  t("Clair de Lune", "Claude Debussy", 1905, "classical", ["dreamy", "romantic", "peaceful"], 0.15, 0.8, false),
  t("Nuvole Bianche", "Ludovico Einaudi", 2004, "classical", ["melancholic", "romantic", "cinematic"], 0.25, 0.65, false),
  t("Experience", "Ludovico Einaudi", 2013, "classical", ["cinematic", "energetic", "melancholic"], 0.45, 0.6, false),
  t("Time", "Hans Zimmer", 2010, "classical", ["cinematic", "melancholic", "mysterious"], 0.4, 0.75, false),
];
