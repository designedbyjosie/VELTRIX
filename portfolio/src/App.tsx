import { lazy, Suspense, useEffect } from "react";
import { useRoute } from "./lib/router";
import { PortalProvider } from "./shell/Portal";
import { FolderStage } from "./shell/FolderStage";
import { ExitTab } from "./shell/ExitTab";
import { markVisited } from "./shell/visits";

const SailorSprings = lazy(() => import("./projects/sailor/SailorSprings"));
const Lightleak = lazy(() => import("./projects/lightleak/Lightleak"));
const CopperWells = lazy(() => import("./projects/ranch/CopperWells"));
const Margin = lazy(() => import("./projects/margin/Margin"));
const CaseStudy = lazy(() => import("./cases/CaseStudy"));
const Desk = lazy(() => import("./desk/Desk"));

const titles: Record<string, string> = {
  "sailor-springs": "Sailor Springs — concept storefront",
  lightleak: "Lightleak — what does this picture sound like?",
  "copper-wells": "Copper Wells Ranch — concept destination site",
  margin: "Margin — trips that fit your life",
};

function Loading({ tone = "#fbf7f2" }: { tone?: string }) {
  return (
    <div className="route-loading" style={{ background: tone }} role="status">
      <span>Unfolding…</span>
    </div>
  );
}

export function App() {
  const [section, slug, ...rest] = useRoute();

  useEffect(() => {
    if (section === "work" && slug) {
      document.title = titles[slug] ?? "Four Worlds";
      markVisited(slug);
    } else if (section === "case") document.title = "Case study — Four Worlds";
    else if (section === "desk") document.title = "The Creator's Desk — Four Worlds";
    else document.title = "Four Worlds — an interactive portfolio";
    window.scrollTo(0, 0);
  }, [section, slug]);

  let view: React.ReactNode;
  if (section === "work") {
    const sub = rest;
    view = (
      <>
        <Suspense fallback={<Loading tone="#1a1a1a" />}>
          {slug === "sailor-springs" && <SailorSprings path={sub} />}
          {slug === "lightleak" && <Lightleak path={sub} />}
          {slug === "copper-wells" && <CopperWells path={sub} />}
          {slug === "margin" && <Margin path={sub} />}
        </Suspense>
        <ExitTab project={slug} />
      </>
    );
  } else if (section === "case" && slug) {
    view = (
      <Suspense fallback={<Loading />}>
        <CaseStudy id={slug} />
      </Suspense>
    );
  } else if (section === "desk") {
    view = (
      <Suspense fallback={<Loading tone="#2a2326" />}>
        <Desk />
      </Suspense>
    );
  } else {
    view = <FolderStage openOnLoad={section === "archive"} />;
  }

  return <PortalProvider>{view}</PortalProvider>;
}
