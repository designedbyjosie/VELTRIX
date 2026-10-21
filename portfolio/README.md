# Four Worlds: an interactive design portfolio

A rose bookcloth portfolio folder that opens into four self-initiated concept products, plus a Creator's Desk about the person who made them.

```
portfolio/
  src/shell/        the folder entrance, the archive, the shared tokens and the folder-to-product transition
  src/lib/scroll.tsx  the shared motion kit (Reveal, SplitWords, scroll progress, parallax)
  src/render/       dev-only three.js scenes that bake the product photography and the desk
  src/cases/        case studies (copy in content.ts)
  src/desk/         the Creator's Desk (copy in content.ts)
  src/content/      owner.ts (your details) and projects.ts (archive metadata)
  src/projects/
    sailor/         Sailor Springs: beverage brand and storefront
    lightleak/      Lightleak: photo-to-playlist mobile app
    ranch/          Copper Wells Ranch: WebGL destination site (three.js)
    margin/         Margin: budget-aware travel planner
  tools/            render-assets.mjs and render-covers.mjs (Playwright asset bakers)
```

It's a standalone Vite + React 19 + TypeScript app that sits beside the existing VELTRIX code and doesn't touch it.

## Run it

```bash
cd portfolio
npm install          # .npmrc sets legacy-peer-deps for the test runner
npm run dev          # http://localhost:5173
npm test             # 25 unit tests: bag, flavour finder, image analysis, recommendations, trip planner
npm run build        # type-check and build static files into dist/
npm run preview      # serve the production build
```

The site uses hash routing (`#/archive`, `#/work/margin`, …), so `dist/` can be hosted on any static host without rewrite rules.

## Identity and motion

- **Portfolio palette** (in `src/shell/base.css`): ivory `#FBF7F2`, paper `#F4EDE6`, linen `#EADFD4`, blush `#F3D9D6`, dusty rose `#D8A1A8`, rose `#C7798A` and rosewood `#8E3B4D` for text accents, with ink `#241D1F`. Rose-gold foil is a gradient token (`--foil`).
- **Type**: Instrument Serif for display, Hanken Grotesk for interface text, and Caveat only for handwritten notes. Each concept keeps its own palette and type.
- **Motion**: one easing family (`--ease-out` for arrivals, `--ease-in-out` for state changes) and three durations (`--t-fast` 240ms, `--t-base` 700ms, `--t-slow` 1100ms). `src/lib/scroll.tsx` gives every world the same reveal, split-word, parallax and pinned-scroll tools. All of it switches off under `prefers-reduced-motion`.

## Images: how they were made

There are no stock photos and no placeholder images. Every picture is either rendered or captured from the site itself:

| Images | Source | Rebuild with |
| --- | --- | --- |
| `public/img/sailor/*`: product photography, cut-outs and the variety box | three.js studio scenes in `src/render/scenes/sailor.ts` | `node tools/render-assets.mjs sailor` |
| `public/img/desk/*`, plus `src/desk/layout.json` | the desk scene in `src/render/scenes/desk.ts`: each object is rendered on its own with a contact shadow, and its position (and the laptop's screen corners) is exported | `node tools/render-assets.mjs desk` |
| `public/img/ranch/*` | frames of the ranch's own three.js scene | captured from the ranch page |
| `public/img/covers/*` | Lightleak, Margin and Copper Wells: their live heroes. Sailor Springs: a crop of its hero render. The desk: the desk layers composited | `node tools/render-covers.mjs` |

Both tools need the dev server running (`npm run dev`) and the `playwright` package installed locally (it isn't a project dependency). Re-render the desk after changing the covers, because the pinboard and Polaroids show them.

## Make it yours

| What | Where |
| --- | --- |
| Name, bio, email, socials, tools, learning goals, availability, the letter on the desk | `src/content/owner.ts` |
| Project titles, questions, summaries and archive colours | `src/content/projects.ts` |
| Archive sticky notes | `notes` in `src/shell/Archive.tsx` |
| Case-study copy (audience, decisions, trade-offs, what you learned) | `src/cases/content.ts` |
| Desk: process steps, sketchbook pages, moodboard, sticky notes, drawer experiments, photo studies, playlist | `src/desk/content.ts` |

The case-study and desk text is written in the first person as the designer's own thinking. Rewrite it in your own words. Swap the illustrative sketches, moodboard swatches and colour studies for your real work, and credit any references you add.

## Edit the four concepts

- **Sailor Springs**: flavours, palettes, prices and sizes live in `projects/sailor/data.ts`. Every can, palette and road stop is generated from that file.
- **Lightleak**: the hand-tagged song catalogue is in `catalog.ts`, the scoring rules in `recommend.ts`, the colour/mood reading in `analyze.ts`, and the painted demo photos in `demoPhotos.ts`.
- **Copper Wells Ranch**: places, timeline, activities, stays and journal are in `ranch/data.ts`. The 3D world is built in `scene3d.ts`.
- **Margin**: sample destinations, stays, activities and prices are in `margin/data.ts`. The planner is a pure function in `engine.ts` (`generate`, `regenerateDay`, `diffPlans`) with tests in `engine.test.ts`.

## What's real and what's demo

**Fully working**
- The folder: hovering lifts it and catches the foil. Opening it slips the elastic off, swings the cover on its hinge and lifts the top sheet out into the archive; closing reverses it. You can skip the intro, and reduced motion is respected. The archive holds four project folders. On hover the pocket tips forward and the cover photo slides out. The front flap drops open as the concept launches. The archive can be re-sorted by discipline (the folders move to their new places with a FLIP animation). Sticky notes flip, a borrower's card tracks which worlds you've visited, and there's a 60-second recruiter summary.
- **Sailor Springs**: an editorial brand site. It has a rendered hero, a pinned scroll story down the coast road (one stop per flavour), a horizontal shop rail and a sunset footer that sets as you scroll. Picking a flavour repaints the whole page. Also working: mood filters and sorting, product pages with three image views, size and quantity controls, a bag that saves in the browser (merge, quantity, remove, subtotal, free-shipping threshold, empty state), and a three-question flavour finder that explains its pick.
- **Lightleak**: a darkroom landing (drying-line prints, a pinned "four baths" story driven by the real analysis code, a contact sheet), then real image upload (file picker or drag and drop) with preview, replace and remove. Colour, brightness, contrast and warmth are read in the browser with a k-means palette, and nothing is uploaded. Moods are editable. Direction controls cover genre, energy, discovery, era, vocals and explicit content. There's a photo-to-playlist transition, live refinement, red-pencil picks, a story or square post preview, PNG export, copy to clipboard, and saved playlists (rename, reopen, remove with undo).
- **Copper Wells**: a poster hero over the 3D scene, a pinned "last thirty miles" sunset, a "four lights" gallery of frames from the scene, and a three.js landscape with dawn, midday, dusk and night. Also working: the camera ride from the gate, eight explorable places as focusable HTML buttons, an illustrated non-WebGL fallback (switched on automatically when WebGL is missing or reduced motion is requested), opt-in generated ambient sound, a route planner, a photo box, flipping postcards, a scrolling timeline, a visit planner with sample availability, and an enquiry form with validation.
- **Margin**: a travel-journal landing with notes in the margin and a pinned "how a trip gets written" story that runs the real planner. Also four-step onboarding with a live summary, destination ranking with reasons, a deterministic itinerary generator, and a budget model that separates estimates, your own figures and confirmed costs. Changing the budget, days, pace, spending style or interests rebuilds the trip and lists what changed. The plan says plainly when a trip can't fit and offers options. You can star, add notes, replace, reorder, remove, change a day's pace and regenerate a single day. Also: mark costs as booked, a trip journal, packing and prep checklists, and a saved-trips dashboard.
- **Case studies**: editorial pages with the cover, numbered sections and the working prototype embedded at desktop and phone sizes (it loads on request).
- **Creator's Desk**: a rendered oak desk with a blush felt mat. On it are a MacBook-style laptop whose screen plays the four covers live and navy over-ear headphones in the AirPods Max style. Each object is a separate layer that lifts on hover. There are ten objects, each opening in its own way. These include a sketch-to-final comparison slider, a flip-through sketchbook, a filterable moodboard, connections drawn to the pinboard, a sliding drawer, flipping sticky notes, a letter that unfolds, and an envelope that opens a pre-filled email. There's also a discovery trail, a draggable paperclip easter egg (it can also be clipped with the keyboard), and a mobile index.

**Demo or sample data (labelled in the interface)**
- Every brand, place, product, price, availability figure and historical detail is fictional or illustrative.
- Lightleak's catalogue is about 60 real songs with hand-entered mood tags. There's no audio: "mood sketches" are short synthesised loops, and the album covers are generated stand-ins.
- Margin's destinations are real cities with illustrative costs, generic activity descriptions and sample opening hours.
- Desk sketches, moodboard swatches, photo studies and the playlist are placeholders.

**Needs external services or your own assets**
- Real checkout (Sailor Springs). It's intentionally disabled.
- Licensed song previews, search and artwork (Lightleak). This needs a music API such as Spotify or Apple Music with proper licensing.
- Live flight, hotel and opening-hour data (Margin).
- Real reservations and enquiry delivery (Copper Wells).
- Sending messages from the desk envelope: it opens the visitor's email app, and nothing is sent from the site.
- Your photographs, sketches and real project content.

## Accessibility and performance notes

- Keyboard: every interaction is a real button, link or form control. Dialogs keep focus inside, close with Escape and return focus when closed. Focus outlines are visible.
- `prefers-reduced-motion`: the folder and portal transitions are skipped, the ranch starts on its still landscape and skips the ride, and CSS animations are shortened.
- three.js loads only on the ranch page (and only once the 3D view is shown), and the scene pauses when it's off-screen or the tab is hidden. Each product is a lazy-loaded chunk. Render code in `src/render/` is never shipped; only its WebP output is.
- No layout shift: images have fixed aspect ratios or explicit sizes, and pinned sections reserve their scroll length up front.
- Saved data (bag, playlists, trips, desk progress) lives in `localStorage` and the app keeps working if storage is blocked.
