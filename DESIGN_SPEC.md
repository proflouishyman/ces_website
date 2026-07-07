# Center on Economy and Society — Design Specification

**Version:** 2.0 (data-grounded revision)
**Purpose:** Binding design contract for a new, free-standing CES website. Every CSS class name below is a fixed contract; downstream build agents implement these verbatim.

> **v2.0 changelog (why this exists):** v1.0 designed the scholar profile around a rich `publications` array (`{type, title, venue, year, url, cover, note}`). **That field does not exist in the source data** — 0 occurrences across all 414 people in `data/individuals.json`; CES scholars carry only `topics_current`, `website`, `connected_networks`, and free-text `problems`/`opportunities`/`notes`. Shipping v1.0 verbatim would have rendered "Publications coming soon" on **every** profile — reproducing the exact complaint it set out to fix. v2.0 keeps publications as the centerpiece but grounds it in a **new, explicitly hand-authored `works.json` content layer** with a **real (never-empty) degradation path** built from data we actually have. It also corrects the center name, the scholar count (15, not 16), and binds programs to the real `current_projects`/`opportunities` fields.

---

## 0. Design Thesis

The current CES page reads as an afterthought sub-page of SNF Agora: mission text runs long, activities are undifferentiated paragraphs, and the scholars are dumped into a flat name-plus-one-line list at the very bottom **with no view of the books, articles, and newsletters that are the whole point of a research center.**

This site inverts that. **The writing is the product; the center is the frame.** The design is *editorial-academic* — it reads like the contributor pages and long-form index of a serious magazine. It shares the parent brand's exact palette, three-tier type system, and pill-button affordance (those are the brand contract), but it expresses them through a **distinct CES signature** — a numbered editorial masthead, folio-style section indices, and its own headline treatment — so it never reads as a reskinned sub-page.

Three non-negotiables, each answering a specific complaint:

1. **A scholar's writing is the visual centerpiece of their profile** — pinned directly beneath their name, larger than everything else on the page, and *never an empty placeholder* (§3.6, §7).
2. **Programs and activities get real card hierarchy** — bound to actual `current_projects`/`opportunities` data, not prose (§3.11).
3. **It is unmistakably its own site** — full home/nav/footer chrome plus a distinct masthead identity, while remaining legibly part of the Johns Hopkins SNF Agora family (§3.1, §3.13).

---

## 1. Canonical facts (verified against source data — do not drift)

| Fact | Value | Source |
|---|---|---|
| Canonical name | **Center on Economy and Society** | `centers.json#ces-jhu.name` |
| Permitted short mark | **CES** (never invent "+"-style variants) | — |
| Parent | SNF Agora Institute at Johns Hopkins University | `connected_networks` |
| Established | **2022** | `year_established` |
| Director | Louis Hyman | `director` |
| Scholar count | **15** (not 16) | 15 records with `center_id: "ces-jhu"` |
| Funders | William and Flora Hewlett Foundation; Omidyar Network; Johns Hopkins University; Stavros Niarchos Foundation (via SNF Agora endowment) | `funding_sources` |
| Real programs | **enCOREage** (open-access intro-economics e-textbook), **AI and the Economy**, **BA in Moral and Political Economy** | `current_projects` |
| Real opportunities | Undergraduate/graduate research via the MPE major; visiting scholar positions | `opportunities` |
| Research Pillars (4, 2026 revision) | Progress & Abundance · Artificial Intelligence · Security · Work & Care | `focus_areas` (site page: `focus-areas.html`, nav label "Research Pillars") |

> "District Dinners" and any per-scholar book/article lists are **content-to-be-authored**, not present in the data. They live in the new `works.json` / `programs.json` content layer (§7) and must be flagged as author-supplied, never asserted as if scraped.

---

## 2. Brand Tokens (VERIFIED — do not invent new ones)

### Colors

```css
:root {
  --navy:      #001b44;
  --blue:      #002d72;
  --skyblue:   #68ace5;
  --olive:     #d2d857;
  --teal:      #00a98e;
  --darkteal:  #093d49;
  --offwhite:  #f0f3f7;
  --lightgray: #eaeaea;
  --white:     #ffffff;
  --ink:       #1a1a1a;
}
```

**Usage discipline:** Navy/blue dominate. Teal and skyblue are accents. **Olive is a highlighter used on 1–3 words per screen, never a large fill.** Avatar fallback tiles rotate through `--blue`, `--teal`, `--darkteal`, `--navy` (never olive/skyblue).

### Type system (three tiers — matches parent exactly)

```css
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Work+Sans:wght@400;500;600;700&display=swap');
:root {
  --font-display: 'Source Serif 4', Georgia, serif;      /* large, often ITALIC — headlines, mission words, scholar names, work titles; never uppercase */
  --font-label:   'Oswald', 'Arial Narrow', sans-serif;  /* condensed, UPPERCASE, letter-spaced — eyebrows, nav, section labels, folio numbers, avatar initials */
  --font-body:    'Work Sans', system-ui, sans-serif;    /* body copy, buttons, UI, metadata */
}
```

### Type scale

| Token | size / line-height | font | use |
|---|---|---|---|
| `--fs-hero` | clamp(2.75rem, 6vw, 5rem) / 1.05 | display | home hero |
| `--fs-h1` | clamp(2rem, 4vw, 3.25rem) / 1.1 | display | page titles, mission words, **scholar name (detail)** |
| `--fs-work` | clamp(1.4rem, 2.4vw, 2rem) / 1.15 | display | **work titles — the loudest recurring text on a profile** |
| `--fs-h2` | clamp(1.5rem, 2.5vw, 2.25rem) / 1.15 | display | section headings |
| `--fs-h3` | 1.25rem / 1.25 | display | card titles |
| `--fs-eyebrow` | 0.8125rem / 1 | label | eyebrows |
| `--fs-nav` | 0.9375rem / 1 | label | nav |
| `--fs-body` | 1.0625rem / 1.6 | body | running copy |
| `--fs-small` | 0.875rem / 1.5 | body | metadata, tags |

> `--fs-work` is intentionally larger than `--fs-h2` card titles and the profile bio. On a scholar page, the *only* text that outranks a work title is the scholar's own name.

### Spacing & shape

```css
:root {
  --maxw: 1200px; --maxw-read: 680px;
  --gutter: clamp(1.25rem, 4vw, 3rem);
  --radius-pill: 999px; --radius-card: 10px;
  --band-pad: clamp(3.5rem, 8vw, 7rem);
  --shadow-card: 0 2px 4px rgba(0,27,68,.04), 0 12px 28px rgba(0,27,68,.08);
  --rule-accent: 3px;   /* left accent rule on the works centerpiece */
}
```

---

## 3. Component Library (binding CSS-class contracts)

### 3.1 `.site-header` — Sticky white masthead (CES's own identity)
`.site-header__inner`; `.site-header__brand` = `.site-header__superlabel` ("SNF AGORA · JOHNS HOPKINS") **+** `.site-header__wordmark` ("CENTER ON ECONOMY AND SOCIETY"). `.site-header__nav` › `.site-header__link` / `--active` (olive underline) — nav links are **real relative hrefs to separate HTML pages** (`index.html`, `people.html`, `focus-areas.html`, `programs.html`, `about.html`), not hash fragments; each page marks its own nav link `--active`. `.site-header__cta` (uses `.btn--pill`, "Get involved →"). `.site-header__toggle` (mobile <900px, `aria-expanded`). Canonical wordmark string is fixed by §1 — do not render "+".

> **Removed at the site owner's request (2026):** the header previously carried a `.site-header__folio` span ("CES · Est. 2022") as a small standalone-masthead flourish. It has been deleted from the shared header markup on every page. The establishment year (2022) still appears as real content on `about.html`.

### 3.2 `.hero` — Home only (distinct from parent, not a clone)
Full-bleed; `.hero__bg` (CSS-only gradient mesh + diagonal hairlines, aria-hidden). `.hero__eyebrow`, `.hero__headline` (display italic) with **one** inline `.hero__mark` (olive highlighter, `box-decoration-break: clone`). Headline copy is CES-original (e.g. "We reopen the debates that decide the economy") — **do not reuse the parent's "in modern times" line.** `.hero__lede`, `.hero__actions` (pill + ghost pill).

> **Removed at the site owner's request (2026):** the hero previously carried `.hero__folio`, an oversized faint Oswald "01 / THE CENTER" masthead index bleeding off the left edge. This numbered folio-index device has been deleted (markup, CSS, and animation delay) — see the note at the end of §3.3.

### 3.3 `.section-divider` — Full-bleed band
Variants `--navy` (blue→navy gradient, white text) / `--light` (offwhite) / `--teal` (darkteal). `.section-divider__inner/__eyebrow/__title(.is-italic)/__intro`. **Mission specialization:** `--navy` wrapper + repeated `.mission-row` (`__word` big italic display, `__subtitle` skyblue, `__desc`, `__link` ghost pill). CES mission verbs are its own — **Discovery / Education / Connection** — *not* the parent's Discovery/Design/Dialogue. Same editorial rhythm, different words.

> **Folio-index concept removed (2026 site-owner feedback):** earlier revisions of this spec defined a recurring "NN / LABEL" folio-index device (`.folio` primitive, `.section-divider__folio`, `.hero__folio`, `.page-head__folio`, `.pub-grid__folio`, and the numbered `.site-header__folio` "Est. 2022" mark) as the CES signature, appearing on the hero, every section divider, and every page-head. The site owner asked for the numbered section labels ("01 /", "02 /", etc.) to be removed site-wide, and for the header's "CES · Est. 2022" mark to go with it. All of that markup, its dedicated CSS, and its scroll-reveal animation delays have been deleted — there is no folio index anywhere on the site anymore, and no replacement device is planned. Section identity is now carried by the eyebrow + title pairing alone.

### 3.4 `.focus-card` (in `.focus-grid`) — 4 Research Pillars, from data
Rendered on `focus-areas.html` (page label: "Research Pillars") and as a home-page teaser. `__title` (display), `__desc`, `__scholars` (overlapping `.avatar--xs` + "+N", built from each pillar's `scholar_ids` in `data/site-content.json`), `__cue` (hover arrow-circle). Auto-fill `minmax(300px,1fr)` — the grid degrades gracefully to any item count, so 4 pillars need no layout change from the previous 8-area version. **No numeric index badge**: `.focus-card__index` was removed site-wide per the folio-index removal (see §3.3) — it had briefly survived on this one card type because an earlier verification pass only grepped for "01 /" with a trailing slash, not the bare digits actually rendered here. The four canonical pillar titles (2026 revision, replacing the earlier 8 granular focus areas) are: **Progress & Abundance**, **Artificial Intelligence**, **Security**, **Work & Care** — each with a fixed "why this matters now" description authored by the site owner; do not paraphrase.

### 3.5 `.person-card` (in `.person-grid`) — output surfaced at grid level
`.person-card__media` (photo or fallback tile), `__body` › `__name` (display), `__title` (clamp 2 lines), `__tags` (`.tag--focus` from `topics_current`, max 2 + "+N"), **`__workcue`** (Oswald teal — the anti-afterthought signal at grid level). The cue text is **data-driven and honest**: if the scholar has curated works → `"{n} WORKS →"`; else if they have a `website` → `"READ THEIR WORK →"`; it is never a fake count. Role groups separated by `.section-divider--light` headers (LEADERSHIP · POSTDOCTORAL FELLOWS · VISITING FELLOWS — real roles inferred from `title`).

### 3.6 Person detail — `.person-profile` layout (THE fix for complaint #1)
The profile is a **two-zone layout, not a stack.** The works centerpiece is *pinned high and made dominant*; the bio is demoted to a narrow rail so it can never precede or outweigh the writing.

```
┌─────────────────────────────────────────────┐
│ .person-hero  (identity band, full-bleed)     │  name + title + focus tags + link-chips
├──────────────────────────┬────────────────────┤
│ .work-section            │ .person-aside       │  ← two columns on ≥900px
│  (PRIMARY, ~2fr,          │  (SECONDARY, ~1fr)   │
│   the visual centerpiece) │  bio (short) +       │
│                           │  focus areas +       │
│  Selected Work & Writing  │  connected networks  │
│  [work-item, work-item…]  │                      │
└──────────────────────────┴────────────────────┘
```

- **`.person-hero`** — asymmetric 1:2 band: `__media` (photo/`avatar--tile` lg), `__identity` › `__eyebrow` (teal role), `__name` (display h1, `--fs-h1`), `__title` (full academic title), `__tags`, `__links` (`.link-chip`: Website, and Newsletter/Substack when present in `works.json`).
- **`.work-section`** — the centerpiece. Column order in source **and** visual order places it *first / left / dominant*; on mobile it stacks **above** the aside. Left accent rule (`--rule-accent` teal), the page's largest vertical rhythm, `.work-section__head` (`__eyebrow` "SELECTED WORK & WRITING" + `__count`), `.work-list` of `.work-item`. Work titles render at `--fs-work` — larger than the bio and every card title on the site.
- **`.person-aside`** — bio (`--maxw-read`, intentionally short), a focus-area list, and connected networks. Visually quieter (smaller, `--offwhite` panel). The bio is *support*, never the lead.

### 3.7 `.avatar` + fallback (REQUIRED)
Sizes `--xs/--sm/--md/--lg`; `.avatar__img`. **Fallback `.avatar--tile`** rendered *instead of* img when no photo: `.avatar__initials` (Oswald, white). Contract: (1) initials = first+last initial ("Mustafa Yavas"→"MY"); (2) tile color deterministic per id via `(sum char codes of id) % 4` → {blue, teal, darkteal, navy}, stable across site, never olive/skyblue; (3) `role="img"` + `aria-label="{name}"`. Data-driven: any scholar lacking `photo` gets the tile — it must look intentional, not degraded. (As of the current `data/people.json`, all 16 scholars have a `photo` field, so the tile path is dormant-but-required in production; it activates the moment a new scholar is added without a photo, so it must stay correct and should be smoke-tested whenever `people.json` is edited.)

### 3.8 `.work-item` — atomic unit of the centerpiece
Grid `[badge][content][cue]`, hairline bottom border. Modifiers `--book` (navy badge) / `--article` (blue) / `--newsletter` (teal, for Substacks/newsletters) / `--link` (skyblue, the degradation variant — a plain external link to the scholar's site). `.work-item__badge` (Oswald tiny pill "BOOK/ARTICLE/NEWSLETTER/PROFILE" — **text, not color-only**, for accessibility), `__content` › `__title` (`--fs-work`, display serif — biggest recurring text), `__meta` (venue · year, optional), `__note` (optional blurb); optional `__cover` (book jacket if supplied); `__cue` (external ↗). Hover: title→blue, cue fills skyblue.

### 3.9 `.btn` — pill-with-arrow (shared affordance, CES tuning)
`.btn` base + `.btn__arrow` (trailing circle). `--pill` (blue/white, olive arrow circle), `--pill--ghost` (outline), `--pill--olive` (olive/navy, rare). Hover: arrow +3px x, circle brightens toward skyblue. Global focus-visible: 3px skyblue outline, offset 2px. (The affordance is the brand contract; CES differentiates through the masthead/folio system, not by altering the button.)

### 3.10 Primitives
`.eyebrow` (Oswald uppercase, `--teal/--olive/--sky/--navy` color mods). `.tag--focus` (from `topics_current`) / `.tag--role`. `.link-chip` (external site / newsletter / CV, icon + ↗). `.page-head` (`__folio` index + `__eyebrow/__title/__intro`). `.folio` (shared Oswald index primitive: `NN / LABEL` — the CES signature used in header, hero, dividers, page-heads).

### 3.11 `.activity-card` (in `.activity-grid`) — bound to real data (complaint #2)
Category-colored left accent bar: `--program` (blue), `--activity` (teal), `--opportunity` (olive). `__eyebrow` (category), `__title` (display), `__desc`, `__meta` (cadence/location/contact, teal), `__cta` (optional ghost pill). **Content is the real data:** Programs = *enCOREage*, *AI and the Economy*, *BA in Moral and Political Economy* (`current_projects`); Opportunities = MPE research positions, visiting scholarships (`opportunities`, with an apply CTA). Any Ongoing-Activity card not backed by data (e.g. District Dinners) is sourced from `programs.json` and marked author-supplied — never fabricated inline.

### 3.12 `.pub-grid` (Home) — "Recent work" strip, first content block
First content block under the hero — cements that output leads. `.pub-grid__head` (eyebrow "RECENT FROM OUR SCHOLARS" + "All scholars →"), `.pub-card` (compact variant of `.work-item`: `__badge/__title/__author/__meta/__cue`). Populated from the flattened `publications` arrays across `data/people.json`, sorted by year descending, each card linking to `person.html?id={id}`. If no scholar has any publications, this block renders the **five most link-rich scholars as `--link` cards** (title = scholar name, meta = institution) linking to their `person.html?id=` page, so the home page still leads with people-and-work, never an empty rail.

### 3.14 Site structure — real multi-page site, not a single scrolling page (2026 revision)
Per site-owner feedback, the site is **seven separate HTML documents**, not one long scrolling page with hash-fragment navigation:

| Page | Content |
|---|---|
| `index.html` | Home: hero, "Recent work" teaser (top publications across all scholars), mission pillars, compact Research Pillars teaser (first 3 pillars) |
| `people.html` | Full scholar roster + role filter (leadership/postdoc/visiting/all) |
| `person.html?id={id}` | Scholar detail, driven by the `id` query parameter — reads `data/people.json` client-side and looks up the matching record. **Never generate a static file per person**; this stays data-driven so adding/removing a scholar requires editing only `data/people.json`. |
| `focus-areas.html` | Full Research Pillars grid (nav/page label "Research Pillars"; filename kept as `focus-areas.html` to avoid churn), from `site-content.json`'s `focus_areas` — now **4** pillars, not 8 (see §3.4) |
| `programs.html` | Programs + Ongoing Activities + Opportunities sections (formerly three separate sections on the long page) |
| `media.html` | Talks & Appearances + Newsletters, from `data/media.json` (see §7.5). Added 2026; not a claim that CES produces its own video — talks are real, third-party-hosted links. |
| `about.html` | Mission statement, funding/advisory-board/connected-networks, "Established 2022" |

All seven pages share identical header/footer markup (copied verbatim into each file — see README.md's maintenance notes for the tradeoff) and load the same `css/style.css` and `js/app.js`. `js/app.js` detects which page it's on by checking for that page's root element (`#person-grid`, `#person-detail-root`, `#focus-grid`, `#talks-list`, etc.) and only renders the matching section(s); there is no client-side router and no `hashchange` listener.

### 3.13 `.site-footer` — SNF Agora text attribution (do NOT redesign JHU shield)
Dark-teal. `__inner`, `__brand` ("Center on Economy and Society"), `__col` (`__col-head` sky eyebrow + `__link`), **`__attribution`** (required plain text: names "SNF Agora Institute at Johns Hopkins University" + `__attribution-link` → `https://snfagora.jhu.edu`, address "3100 Wyman Park Dr, Baltimore, MD 21218", funding "William and Flora Hewlett Foundation and Omidyar Network"), `__legal` (© line). **Text-and-link credit only; no shield reproduction or modification.**

---

## 4. Layout & Composition
`.container` = `max-width:var(--maxw); margin-inline:auto; padding-inline:var(--gutter)`. Prose uses `--maxw-read`. Full-bleed bands span viewport; `__inner` re-applies container. Editorial asymmetry (1:2) on `person-hero` and mission rows; the profile body is a **2fr : 1fr** work-primary / bio-secondary split (§3.6) collapsing to a single column (**work first**) below 900px. Grids `auto-fill minmax(...)`, single column below ~560px. The `.folio` index device recurs at every major section to carry the standalone-magazine identity.

## 5. Motion (restrained, editorial)
One orchestrated home load: hero folio → eyebrow → headline → lede → actions stagger (`animation-delay` 60ms steps). Scroll-reveal `.is-in` (fade + 12px rise, staggered) on focus/person/activity cards and **work-items** (the work list reveals row-by-row, reinforcing it as the main event). Hover only on arrow circles (translate/fill), easing `cubic-bezier(.2,.6,.2,1)`. `@media (prefers-reduced-motion: reduce)` disables all.

## 6. Accessibility
AA contrast (white on blue/navy/darkteal; ink on white). **Olive = background highlighter with navy text only — never olive text on white.** Card links wrap one `<a>`; global focus-visible ring. Avatar tiles `role="img"` + `aria-label`. Work/activity badges are text, not color-only. Nav toggle `aria-expanded` below 900px. Work-section carries `aria-labelledby` pointing at its heading so assistive tech announces it as the profile's primary region.

## 7. Data-shape (downstream contract — GROUNDED IN REAL SOURCES)

### 7.1 Scholar (existing — read from `data/individuals.json`, filter `center_id == "ces-jhu"`)
`id`, `name`, `title`, `center_id`, `institution`, `website`, `email`, `topics_current` (→ focus tags), `connected_networks`, plus free-text `problems`/`opportunities`/`notes`. **There is no `photo` and no `publications` field.** Role (`leadership` | `postdoc` | `visiting`) is derived from `title` (e.g. "Postdoctoral Fellow" → postdoc, "Visiting Fellow" → visiting, else leadership/faculty).

### 7.2 `works.json` — NEW hand-authored content layer (this is a deliverable, not a scrape)
The publications-centerpiece is only real if the content exists. Create `data/works.json`, an object keyed by scholar `id`:
```json
{
  "louis-hyman": [
    { "type": "book",       "title": "Temp: How American Work…", "venue": "Viking", "year": 2018, "url": "…", "note": "…", "cover": "images/covers/temp.jpg" },
    { "type": "newsletter", "title": "…", "venue": "Substack", "year": 2024, "url": "…" }
  ]
}
```
`type ∈ {book, article, newsletter}`. `title`, `url` required; `venue`, `year`, `note`, `cover` optional. This file is authored/curated (from each scholar's `website`), not machine-populated from `individuals.json`.

### 7.3 Non-empty guarantee for the centerpiece (the core v2.0 fix)
`.work-section` **must never render an empty placeholder.** Resolution order per scholar:
1. If `works.json[id]` exists → render those as `--book/--article/--newsletter` items. Set count.
2. Else if the scholar has a `website` → render a single `.work-item--link` ("Read {name}'s work ↗" → `website`) plus any `connected_networks` as secondary `--link` chips. Count cue = "READ THEIR WORK →".
3. The literal string "Publications coming soon" is **banned** — an empty writing block on a research center is the exact failure this spec exists to prevent.

### 7.4 `programs.json` — NEW content layer for §3.11
Seeded from `centers.json#ces-jhu`: `current_projects` → program cards (enCOREage, AI and the Economy, BA in MPE); `opportunities` → opportunity cards. Any card without a data source (District Dinners, etc.) carries `"source": "author"` and is only shown once content is confirmed — never asserted as scraped fact.

### 7.5 `data/media.json` — NEW content layer for `media.html` (2026)
An object with two arrays, `talks` and `newsletters`, each a flat list (not keyed by scholar id) so the page can render in a fixed, curated order while still linking every item back to a scholar via `person.html?id={id}`:
```json
{
  "talks": [
    { "scholar_id": "louis-hyman", "title": "The Workers of Silicon Valley", "venue": "Google", "url": "https://youtube.com/watch?v=…" }
  ],
  "newsletters": [
    { "scholar_id": "louis-hyman", "name": "Computational History", "url": "https://computationalhistory.substack.com/" }
  ]
}
```
`scholar_id`, `title`/`name`, and `url` are required; `venue` is optional (omit or `null` when there isn't a natural "hosted by" label). `scholar_id` is looked up against `data/people.json` at render time (`js/app.js#talkItemHtml`/`newsletterItemHtml`); an unrecognized id still renders (falls back to showing the raw id as plain text) rather than breaking the page. **Flexible-by-design**: adding a new talk or newsletter is a JSON edit only — no HTML/JS/CSS change required, matching the same principle already used for `data/people.json` (see README.md). Rendered with the existing `.work-item` card pattern (`--talk` modifier, teal-adjacent badge; `--newsletter` modifier, reused as-is from §3.8) rather than a new component. Newsletters here are the definitive list; the redundant `substack` field on each person in `data/people.json` remains the source for the link-chip on that scholar's own `person.html` profile (§3.6) — keep both in sync when a scholar's newsletter changes.
