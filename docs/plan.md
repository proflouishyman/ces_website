# CES Website — Architecture

How this site is built and why. `README.md` covers *how to edit content*;
`DESIGN_SPEC.md` covers *what things must look like*. This file covers
*how it works*, and the constraints a change has to respect.

Live: https://proflouishyman.github.io/ces_website/
Repo: `proflouishyman/ces_website`, GitHub Pages from `main` root.

---

## 1. The thesis: static files, no build step

Seven hand-written HTML pages, one stylesheet, one script, three JSON files.
No framework, no bundler, no `npm install`, no CI. Open a file, edit it,
push — the live site is literally these bytes.

This is a deliberate trade, and it is the single most important thing to
preserve:

- **The people who maintain this are not full-time front-end developers.**
  A content change must never require a toolchain that has to be installed,
  updated, or debugged first.
- **It has to still work in two years** with nobody having touched it. A
  build step is a dependency tree that rots; a `.html` file is not.
- **Pages deploys the repo root as-is.** There is no build to fail.

The cost is accepted duplication: the header and footer markup are
copy-pasted into all seven pages. **Change one nav link or footer column and
you must change all seven.** That is the tax for having no templating layer,
and it is cheaper than the alternative at this size. `.nojekyll` is present
so Pages serves files verbatim rather than running Jekyll over them.

## 2. Page inventory

| File | Role | Rendered by |
|---|---|---|
| `index.html` | Home: hero, publications feed, mission, focus-area teaser | static + JS |
| `people.html` | Scholar roster with role filter | JS from `people.json` |
| `person.html?id={id}` | One scholar's detail page | JS, entirely |
| `focus-areas.html` | Research pillars | JS from `site-content.json` |
| `programs.html` | Programs, activities, opportunities | JS from `site-content.json` |
| `media.html` | Featured press, more coverage, newsletter posts, talks, Substacks | JS from `media.json` |
| `about.html` | Institute context | static + JS aside |

**There is no per-scholar HTML file.** `person.html` reads `?id=` and renders
from `people.json`, so adding or removing a scholar is a JSON edit only —
never a new file, never a nav change. This is why `data/people.json` is the
roster's single source of truth and why ids must stay stable: they appear in
URLs, in the media pipeline's exports, and in `scholar_ids` cross-references.

## 3. Data flow

```
data/people.json  ──┐
data/site-content.json ─┼──  fetch() on DOMContentLoaded  ──  js/app.js  ──  DOM
data/media.json   ──┘         (3 independent requests)        (~45 builders)
```

Everything is client-side. `app.js` fetches the three JSON files, then each
page's builder functions populate the containers that page happens to have;
a builder whose container is absent returns immediately, which is why one
script serves all seven pages without routing.

**The three fetches are independent** (`Promise.allSettled`, not
`Promise.all`). This matters: a single shared `catch` used to reset *every*
dataset, so `media.json` 404ing also emptied the scholar roster. Each
dataset now fails on its own and the others still render.

### Content ownership — who writes what

| Data | Owner | Edited how |
|---|---|---|
| `people.json` | humans | by hand (see README) |
| `site-content.json` | humans | by hand |
| `media.json` → `talks`, `newsletters` | humans | by hand |
| `media.json` → `press` | **automated** | `agora_media/scripts/export_ces_press.py` |
| `media.json` → `substack_posts` | **automated** | `agora_media/scripts/export_ces_substack.py` |

The two automated arrays are rewritten daily by the SNF Agora media digest
(`~/coding/agora_media`, launchd 7:03am, runbook **step 8**), which commits
and pushes this repo. **Both scripts write only their own array** — hand-
curated `talks` and `newsletters` are never touched. Do not hand-edit
`press` or `substack_posts`: the next run overwrites them.

Because an unattended job pushes here, this repo uses a keychain-free,
repo-local git credential helper. `osxkeychain` hangs a headless push on an
unanswerable prompt — see that repo's `SOLUTIONS.md` (2026-08-02, 2026-09-18).

## 4. Rendering conventions in `js/app.js`

The file is flat and deliberately boring: no classes, no modules, no state
container. Roughly:

- **`loadData` → `init`** — fetch, then call every builder. `init` is wrapped
  in a try/catch that force-reveals all cards if any builder throws, so a bug
  in one section cannot leave the rest of the page invisible.
- **Builders** (`buildPeopleGrid`, `buildMedia`, `buildPersonDetail`, …) —
  one per page region, each a no-op when its container is missing.
- **`*Html` helpers** (`workItemHtml`, `featuredPressHtml`, `avatarHtml`, …)
  — pure functions returning template-literal strings.
- **`renderWorkList(el, items, renderer, emptyMsg)`** — the shared path for
  filling a list container, including the empty state and registering new
  rows with the scroll-reveal observer. Prefer it over hand-rolling.

**Escaping is not optional.** All interpolated data goes through `escHtml`
(text) or `escAttr` (attribute values). Adding a template that interpolates
raw JSON into `innerHTML` without one of these is a bug.

**No `<img>` without `alt`.** Headshots derive it from the person's name;
decorative covers and thumbnails use `alt=""` and, where the thumbnail
duplicates an adjacent real link, `aria-hidden="true" tabindex="-1"` so it
isn't a second tab stop announcing the same thing.

## 5. Accessibility is a hard constraint, not a polish pass

The site was brought to **WCAG 2.1 AA** in September 2026 — the standard the
DOJ Title II rule and US courts use as the ADA benchmark, and what JHU policy
requires. A change that regresses it is a bug, not a style preference.

Contracts a change must keep:

- **One `<h1>` per page, no skipped heading levels** — including in
  JS-injected markup, which is where this broke last time. Listing-page cards
  are `<h2>` because they sit directly under the page `<h1>`; `person.html`
  work items are `<h3>` because they nest under a real `<h2>`.
- **Colour comes from the ten brand tokens only.** `DESIGN_SPEC.md` §2 records
  which tokens are safe as text on which grounds — `--teal` and `--skyblue`
  fail on white and are for dark grounds and accents. Do not invent a hex to
  fix a contrast problem; use `--teal-text` (an alias of `--darkteal`).
- **The focus ring is two-tone on purpose** (`--focus-ring` navy core +
  `--focus-ring-halo` white). No single palette colour clears the 3:1 non-text
  minimum against every ground this site uses. Don't "simplify" it.
- **Opacity is not a safe way to dim text.** It composites toward the
  background *and* compounds with any ancestor's opacity. Use a darker token.
- **Hover states need a keyboard equivalent.** Anything revealed on `:hover`
  needs `:focus-visible` / `:focus-within` too, or keyboard users focus an
  invisible control.
- **External links** carry a visually-hidden "(opens in a new tab)" hint, via
  `newTabHintHtml()` or an extended `aria-label` for glyph-only links.
- **Every page has a `role="status"` live region** so asynchronous failures
  are announced, not silent. Six pages use `#page-status`; `people.html` uses
  `#person-grid-status`, which also announces filter result counts. `announce()`
  in `app.js` resolves whichever is present.

Verify with axe-core plus a keyboard pass; axe alone catches roughly a third
of WCAG issues and structurally cannot evaluate text over a gradient — which
is exactly how the hero eyebrow failure survived an all-green automated run.

## 6. Graceful degradation

- **JS disabled** — an inline script in each `<head>` sets `.js-reveal` on
  `<html>`. The scroll-reveal `opacity: 0` start state is scoped to that
  class, so with JS off nothing is stuck invisible; the JS-rendered sections
  are simply empty rather than blank-and-broken.
- **`prefers-reduced-motion`** — disables reveal animation and forces
  `opacity: 1`, in both CSS and the observer setup.
- **A data file fails to load** — the affected containers show a real error
  message ("this content could not be loaded"), announced via the live
  region. This deliberately does *not* fall through to the ordinary empty
  state: "No scholars match this filter" is a wrong answer when the truth is
  that the fetch failed.
- **No `IntersectionObserver`** — all cards are revealed immediately.

## 7. Known constraints and deliberate non-features

- **Header/footer duplication across 7 pages** — accepted, see §1.
- **`.is-dated` is dormant.** The rule that dims work older than two years
  is overridden by `.is-in` from the scroll-reveal (equal specificity, later
  in the file). Reviving it is a design decision; its value is kept at an
  accessible level so doing so wouldn't reintroduce a contrast failure.
- **`person.html` has no static `<h1>`** — it is injected. That is correct,
  not an oversight.
- **The footer newsletter link is a placeholder**
  (`https://forms.gle/REPLACE-WITH-YOUR-GOOGLE-FORM-URL`) in all seven files,
  overridden at runtime from `site-content.json.newsletter.form_url`.
- **No analytics, no cookies, no third-party JS.** Fonts come from Google
  Fonts; everything else is same-origin.

## 8. Making a change safely

1. Content only? Edit the JSON. Nothing else.
2. New page? Copy an existing one for the header/footer, add the nav link to
   **all seven** pages, give it one `<h1>`, and add a `#page-status` region.
3. New rendered section? Add a builder + an `*Html` helper, render through
   `renderWorkList`, and escape everything.
4. Before pushing: run axe-core on the changed pages at desktop and mobile
   width, tab through the new UI, and check 320px for horizontal scroll.
