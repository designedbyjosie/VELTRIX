# Four Worlds: an interactive design portfolio

A scrapbook folder that opens into four self-initiated concept products, plus a Creator's Desk about the person who made them.

```
portfolio/
  src/shell/        the folder entrance, the archive and the artifact-to-product transition
  src/cases/        case studies (copy in content.ts)
  src/desk/         the Creator's Desk (copy in content.ts)
  src/content/      owner.ts (your details) and projects.ts (archive metadata)
  src/projects/
    sailor/         Sailor Springs: beverage brand and storefront
    lightleak/      Lightleak: photo-to-playlist mobile app
    ranch/          Copper Wells Ranch: WebGL destination site (three.js)
    margin/         Margin: budget-aware travel planner
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
- The folder opens on a 3D hinge and closes again. You can skip the intro, and reduced motion is respected. The archive can be re-sorted by discipline (the cards move to their new places with a FLIP animation), sticky notes flip, layers react to the pointer, a borrower's card tracks which worlds you've visited, there's a 60-second recruiter summary, and each artifact grows into its product.
- **Sailor Springs**: picking a flavour repaints the whole page. Also working: mood filters and sorting, product pages with three image views, size and quantity controls, a bag that saves in the browser (merge, quantity, remove, subtotal, free-shipping threshold, empty state), and a three-question flavour finder that explains its pick.
- **Lightleak**: real image upload (file picker or drag and drop) with preview, replace and remove. Colour, brightness, contrast and warmth are read in the browser with a k-means palette, and nothing is uploaded. Moods are editable. Direction controls cover genre, energy, discovery, era, vocals and explicit content. There's a photo-to-playlist transition, live refinement, red-pencil picks, a story or square post preview, PNG export, copy to clipboard, and saved playlists (rename, reopen, remove with undo).
- **Copper Wells**: a three.js landscape with dawn, midday, dusk and night. Also working: the camera ride from the gate, eight explorable places as focusable HTML buttons, an illustrated non-WebGL fallback (switched on automatically when WebGL is missing or reduced motion is requested), opt-in generated ambient sound, a route planner, a photo box, flipping postcards, a scrolling timeline, a visit planner with sample availability, and an enquiry form with validation.
- **Margin**: four-step onboarding with a live summary, destination ranking with reasons, a deterministic itinerary generator, and a budget model that separates estimates, your own figures and confirmed costs. Changing the budget, days, pace, spending style or interests rebuilds the trip and lists what changed. The plan says plainly when a trip can't fit and offers options. You can star, add notes, replace, reorder, remove, change a day's pace and regenerate a single day. Also: mark costs as booked, a trip journal, packing and prep checklists, and a saved-trips dashboard.
- **Case studies**: each one embeds the working prototype, with desktop and phone sizes.
- **Creator's Desk**: ten objects, each opening in its own way. These include a sketch-to-final comparison slider, a flip-through sketchbook, a filterable moodboard, connections drawn to the pinboard, a sliding drawer, flipping sticky notes, a letter that unfolds, and an envelope that opens a pre-filled email. There's also a discovery trail, a draggable paperclip easter egg (it can also be clipped with the keyboard), and a mobile index.

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
- three.js loads only on the ranch page, and the scene pauses when it's off-screen or the tab is hidden. Each product is a lazy-loaded chunk.
- Saved data (bag, playlists, trips, desk progress) lives in `localStorage` and the app keeps working if storage is blocked.
