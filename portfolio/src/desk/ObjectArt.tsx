import { asset } from "../lib/asset";
import type { ObjectId } from "./content";

/**
 * Each object is a photograph from the desk render (src/render/scenes/desk.ts),
 * cut out with its own shadow. The sticky notes stay live HTML.
 */
export function ObjectArt({ id, drawerOpen = false }: { id: ObjectId; drawerOpen?: boolean }) {
  if (id === "notes") {
    return (
      <span className="oa oa-notes">
        <i style={{ background: "#f6d9d4" }} />
        <i style={{ background: "#f3e6c8" }} />
        <i style={{ background: "#e9c4c8" }} />
      </span>
    );
  }
  const file = id === "drawer" && drawerOpen ? "drawer-open" : id;
  return <img className="oa-img" src={asset(`img/desk/${file}.webp`)} alt="" loading="lazy" decoding="async" draggable={false} />;
}
