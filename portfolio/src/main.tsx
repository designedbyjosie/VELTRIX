import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/pinyon-script/400.css";
import "@fontsource/silkscreen/400.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/600.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "./shell/base.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
