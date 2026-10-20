/**
 * EDIT ME — everything personal about the portfolio lives here.
 * Replace the placeholder values with your own details. Anything left as a
 * placeholder is shown with a dashed "fill me in" outline so you can spot it.
 */
export const owner = {
  name: "Your Name",
  /** Shown handwritten on the folder label and the letter signature. */
  signature: "Your Name",
  age: 18,
  role: "Aspiring UI/UX & web designer",
  location: "Your city",
  email: "hello@example.com",
  availability: "Open to internships, apprenticeships and small freelance collaborations",
  /** One or two sentences, used in the archive and for recruiters. */
  shortBio:
    "I'm 18 and teaching myself to design and build digital products. These four worlds are self-initiated concepts — each one a question I wanted to answer by making something.",
  socials: [
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "LinkedIn", url: "https://linkedin.com/" },
    { label: "Behance", url: "https://behance.net/" },
    { label: "GitHub", url: "https://github.com/" },
  ],
  /** Tools you actually use. Keep this honest — remove anything you haven't touched. */
  tools: ["Figma", "HTML & CSS", "React (learning)", "Photoshop", "After Effects (learning)"],
  learning: ["Design systems", "Motion for interfaces", "Usability testing", "TypeScript"],
  /** The letter on the Creator's Desk. Each string is one paragraph. */
  letter: [
    "Hi — thank you for opening this.",
    "I'm [your name], I'm 18, and I'm at the very start of a design career. I don't have years of client work to show you yet, so I made the evidence instead: four small worlds, each built to answer a different design question.",
    "What I love about interface design is that it's half picture, half behaviour. A layout can look right and still feel wrong the moment you touch it. I want to get good at the touching part.",
    "Right now I'm learning [what you're learning]. I'd love to spend the next year somewhere I can watch experienced designers work, ask too many questions, and ship things real people use.",
    "If anything here made you curious, write to me. I reply to everything.",
  ],
  /** Placeholder flags let the UI highlight fields you still need to edit. */
  placeholders: ["name", "signature", "location", "email", "letter"],
} as const;

export function isPlaceholder(field: string) {
  return (owner.placeholders as readonly string[]).includes(field);
}
