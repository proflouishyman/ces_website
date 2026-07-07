# Center on Economy and Society — Website

**Live site:** https://proflouishyman.github.io/ces_website/

A static site (plain HTML/CSS/JS, no build step) for the CES at the SNF Agora Institute, Johns Hopkins University. All content is data-driven: the pages are rendered at runtime by `js/app.js` from two JSON files in `data/`.

See `DESIGN_SPEC.md` for the design system and component contract (CSS classes, layout rules, etc.) — that document is for anyone touching the visual design or JS. This section is for content-only edits.

## Site structure & routing

The site is seven real, separately-loadable HTML pages — **not** one long scrolling page with hash-fragment navigation:

- `index.html` — Home (hero, recent-work teaser, mission, Research Pillars teaser)
- `people.html` — Full scholar roster with role filters
- `person.html?id={id}` — Scholar detail page, e.g. `person.html?id=louis-hyman`
- `focus-areas.html` — Full Research Pillars grid (nav label "Research Pillars"; the filename stays `focus-areas.html` from the earlier 8-area version to avoid churn)
- `programs.html` — Programs, ongoing activities, and opportunities
- `media.html` — Talks & Appearances and Newsletters from our scholars
- `about.html` — Mission, funding, advisory board, connected networks

Scholar detail pages are **query-parameter routed, not per-person static files**: `person.html` reads `id` from `new URLSearchParams(location.search).get('id')`, looks that up in the already-fetched `data/people.json` array, and renders the profile client-side. There is no `#/people/{id}` hash route anymore (that was the old single-page scheme) — link to a scholar with `person.html?id=jane-doe`. This is why adding, removing, or editing a scholar only ever requires editing `data/people.json`: no new HTML file is ever created per person.

Nav links across all seven pages are plain relative `<a href="people.html">`-style links (no leading slash, since the site is hosted at a GitHub Pages subpath) — there is no client-side router. `js/app.js` is shared by every page; it detects which page it's on by checking for that page's root element (e.g. `#person-grid` on `people.html`, `#person-detail-root` on `person.html`, `#talks-list`/`#newsletters-list` on `media.html`) and only runs the render function(s) for elements that exist on the current page.

**Maintenance tradeoff — header/footer are copy-pasted, not templated:** because this is a plain static site with no build step, the shared header and footer markup is duplicated verbatim across all seven HTML files rather than templated/included. If you change the nav links, the header brand, or the footer columns, you must make the same edit in all seven files (`index.html`, `people.html`, `person.html`, `focus-areas.html`, `programs.html`, `media.html`, `about.html`). This is a deliberate simplicity-over-DRY tradeoff for a no-build-tool site; if the page count grows much further, introducing a static-site generator (or a tiny build step that inlines a shared partial) would be worth revisiting.

## Updating Media (talks & newsletters)

Talks/appearances and newsletters on `media.html` live in **`data/media.json`**, an object with two flat arrays: `talks` (`{ scholar_id, title, venue, url }`) and `newsletters` (`{ scholar_id, name, url }`). `venue` is optional. `scholar_id` must match an `id` in `data/people.json` so the item can link back to that scholar's profile — adding a new talk or newsletter is a JSON-only edit, no HTML/JS/CSS change needed. A scholar's `substack` field in `data/people.json` (used on their own `person.html` profile) is separate from the `newsletters` list here; keep both in sync if a scholar's newsletter changes.

## Updating the People Roster

All scholar/staff info lives in **`data/people.json`**. It's a JSON list — one object per person. You do not need to touch any HTML, CSS, or JS file to add, remove, or edit a person; the site rebuilds itself from this file automatically the next time the page loads.

**Before editing:** make a copy of the file first, or edit carefully — a single missing comma or quote will break the whole site (all scholars, not just one), because the file must be valid JSON.

### To add a new person

1. Copy an existing person's entry (the `{ ... }` block for one scholar) and paste it as a new entry in the list — anywhere in the file works, but people are grouped and displayed by `role`, so put the new entry near others with the same role.
2. Fill in the fields:

   **Required:**
   - `id` — a short, unique, URL-safe slug, lowercase with hyphens (e.g. `"jane-doe"`). This becomes part of the person's page link (`person.html?id=jane-doe`), so once published, avoid changing it.
   - `name` — full display name.
   - `title` — their role/title as it should appear on the site.
   - `role` — must be exactly one of: `"leadership"`, `"postdoc"`, or `"visiting"`. This controls which filter group and section they show up in (Leadership / Postdoctoral Fellows / Visiting Fellows). Any other value will cause them to not appear when a filter is selected.
   - `institution` — e.g. `"Johns Hopkins University"`.

   **Optional (use `null` or `[]`/`{}` if unknown — do not delete the field):**
   - `bio` — one or two sentences, plain text.
   - `photo` — path to their photo, see below. Use `null` if there is no photo yet (the site automatically shows a colored initials tile instead — this is a supported, intentional fallback, not a placeholder to fix).
   - `directory_url` — link to their JHU/SNF Agora directory page, or `null`.
   - `personal_website` — their personal/academic website, or `null`.
   - `topics` — a list of topic strings (e.g. `["Economic History", "Political Economy"]`). Use `[]` if none.
   - `publications` — a list of works. Each entry: `{ "type": "book"/"article"/etc., "title": "...", "venue": "...", "year": 2024, "url": "..." }`. If year or url aren't known/confirmed, use `null` for that field rather than guessing or omitting it.
   - `substack` — `{ "name": "...", "url": "..." }` or `null` if they have no newsletter.
   - `media` — a list of press/media mentions: `{ "outlet": "...", "title": "...", "url": "...", "year": ... }`. Use `[]` if none.

3. Save the file, then validate it (see "Checking your edit" below).

### Adding a photo

- Photos live in `images/people/`.
- **Filename convention:** must exactly match the person's `id`, with a `.jpg` extension — e.g. `id: "jane-doe"` → `images/people/jane-doe.jpg`.
- **Size/format convention:** most existing photos are JPEG, roughly **1440×810 pixels** (landscape, 16:9). The site displays photos cropped into squares/tiles automatically (it crops to fill, so it's forgiving of the exact aspect ratio) — but for a consistent look, export a landscape photo around that size rather than a tall portrait if you have a choice.
- In `people.json`, set `"photo": "images/people/jane-doe.jpg"` (relative path, no leading slash).
- If you don't have a photo yet, set `"photo": null` — the site will automatically show a nice colored tile with the person's initials instead of a broken image.

### To remove someone

- Delete their entire `{ ... }` object from the list in `data/people.json` (including the surrounding curly braces, and make sure the commas between the remaining entries are still correct — no trailing comma after the last entry, and a comma between every other pair of entries).
- Optionally delete their photo from `images/people/`, though leaving an unused photo file does no harm.

### To change someone's role or title

- Open `data/people.json`, find their entry (search for their name or `id`), and edit the `"title"` and/or `"role"` field directly.
- Remember `"role"` must be exactly `"leadership"`, `"postdoc"`, or `"visiting"` — any other spelling will not show up under any filter.

### Checking your edit

After saving `data/people.json`, validate it before publishing. From the site's root folder, run:

```
python3 -m json.tool data/people.json > /dev/null && echo "valid JSON"
```

If this prints an error instead of "valid JSON", it will point at the line with the mistake (usually a missing comma or quote) — fix that and run it again. Do not publish the site with invalid JSON; it will break the entire roster, not just the one entry you edited.
