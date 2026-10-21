import { asset } from "../lib/asset";
import type { ProjectId } from "../content/projects";

const alts: Record<ProjectId, string> = {
  sailor: "Sailor Springs cans on plaster blocks in palm-shadowed afternoon light",
  lightleak: "The Lightleak app turning a photo into a playlist",
  ranch: "Copper Wells Ranch at dusk, seen from the trail",
  margin: "A Margin itinerary laid out like a travel journal",
};

/** The cover image for a concept, used by the archive folders, case studies and the desk. */
export function ProjectCover({ id, className = "", decorative = false, eager = false }: { id: ProjectId; className?: string; decorative?: boolean; eager?: boolean }) {
  return (
    <img
      className={`project-cover ${className}`}
      src={asset(`img/covers/${id}.webp`)}
      alt={decorative ? "" : alts[id]}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      width={1600}
      height={1200}
    />
  );
}
