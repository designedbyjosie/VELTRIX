import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/600.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/hanken-grotesk/600.css";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { sailorScenes, type Output } from "./scenes/sailor";
import { deskScenes } from "./scenes/desk";

/**
 * Dev-only entry used by tools/render-assets.mjs. Loads one scene from the
 * query string, renders it and exposes the encoded images on window.
 */
const registry: Record<string, (p: URLSearchParams) => Promise<Output[]>> = {
  ...sailorScenes,
  ...deskScenes,
};

declare global {
  interface Window {
    __render?: { done: boolean; outputs?: Output[]; error?: string };
  }
}

RectAreaLightUniformsLib.init();
void THREE;

async function run() {
  window.__render = { done: false };
  try {
    const params = new URLSearchParams(location.search);
    const name = params.get("scene") ?? "";
    const scene = registry[name];
    if (!scene) throw new Error(`Unknown scene “${name}”. Known: ${Object.keys(registry).join(", ")}`);
    await document.fonts.ready;
    await Promise.all(["800 74px 'Bricolage Grotesque'", "600 40px 'Bricolage Grotesque'", "200px 'DM Serif Display'", "600 60px Caveat", "400 60px Caveat", "400 100px 'Instrument Serif'", "italic 400 100px 'Instrument Serif'", "600 30px 'Hanken Grotesk'"].map((f) => document.fonts.load(f)));
    window.__render = { done: true, outputs: await scene(params) };
  } catch (e) {
    window.__render = { done: true, error: String((e as Error).stack ?? e) };
  }
}
run();
