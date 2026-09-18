// Center on Economy and Society — app.js
// Vanilla JS, no build step, no framework. Fetches data/people.json and
// data/site-content.json (relative paths) and renders whichever data-driven
// section(s) are present on the current page. Each real HTML page includes
// this same script; render functions no-op (via a root-element existence
// check) when their target section isn't on the page. Person detail is a
// real page (person.html) driven by the ?id= query parameter — there is no
// hash routing.

let people = [];
let siteContent = null;
let mediaContent = null;
let dataLoadFailed = false;
const failedData = { people: false, site: false, media: false };
let activeRoleFilter = 'all';

// ── DATA LOAD ────────────────────────────────────────────────

// Each dataset loads independently: a failure in one must not blank the others.
// (With a single Promise.all + shared catch, media.json 404ing also wiped the
// scholar roster, because the catch reset `people` to [].)
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function loadData() {
  const [pRes, sRes, mRes] = await Promise.allSettled([
    fetchJson('data/people.json'),
    fetchJson('data/site-content.json'),
    fetchJson('data/media.json'),
  ]);

  if (pRes.status === 'fulfilled') people = pRes.value;
  else { console.error('Could not load people.json:', pRes.reason); people = []; failedData.people = true; }

  if (sRes.status === 'fulfilled') siteContent = sRes.value;
  else { console.error('Could not load site-content.json:', sRes.reason); siteContent = null; failedData.site = true; }

  if (mRes.status === 'fulfilled') mediaContent = mRes.value;
  else { console.error('Could not load media.json:', mRes.reason); mediaContent = null; failedData.media = true; }

  dataLoadFailed = failedData.people || failedData.site || failedData.media;

  init();
  if (dataLoadFailed) renderLoadError();
}

// A failed fetch otherwise renders as the ordinary empty state ("No scholars
// match this filter."), which tells the reader the center has no scholars
// rather than that the page is broken. This replaces any still-empty container
// with a real error message and announces it once (WCAG 4.1.3).
function renderLoadError() {
  const msg = 'Sorry — this content could not be loaded. Please refresh the page or try again later.';
  // Every container a builder fills, on every page — an omission here is worse than
  // no handling at all, because the page then shows either nothing (about.html) or
  // an affirmatively wrong answer ("We couldn't find that scholar" on person.html,
  // when in fact the roster never loaded).
  const SELECTORS = [
    '[data-loading]', '.person-grid', '.work-list', '.focus-grid', '.activity-grid',
    '.pub-grid__track', '#about-meta', '#person-detail-root',
  ].join(', ');

  document.querySelectorAll(SELECTORS).forEach(el => {
    // A container counts as filled only if it holds something OTHER than an empty
    // state — and not merely an empty wrapper div, which buildPublicationsFeed
    // writes even when it has no cards (that rendered as a silent 0px blank).
    const real = [...el.children].some(
      c => !c.classList.contains('empty-state') && c.textContent.trim() !== ''
    );
    if (real) return;
    el.removeAttribute('data-loading');
    el.innerHTML = `<p class="empty-state">${msg}</p>`;
  });

  announce(msg);
}

// Posts a message to this page's polite live region, if it has one.
function announce(msg) {
  const status = document.getElementById('page-status') ||
                 document.getElementById('person-grid-status');
  if (status) status.textContent = msg;
}

function init() {
  // Safety net for the scroll-reveal no-JS fallback (see each page's inline
  // script + css/style.css .js-reveal rules): if any builder below throws
  // partway through, fall back to fully-visible rather than leaving cards
  // that already got their opacity:0 starting state stuck invisible forever.
  try {
    // Each builder checks for its own root element and no-ops if absent, so
    // it's safe to call all of them on every page — only the ones matching
    // the current page's markup actually render anything.
    buildPeopleGrid();
    buildPersonDetail();
    buildPublicationsFeed();
    buildFocusAreas();
    buildFocusAreasTeaser();
    buildPrograms();
    buildActivities();
    buildOpportunities();
    buildAbout();
    buildMedia();
    buildFooterNewsletter();
    setupEventListeners();
    initScrollReveal();
  } catch (e) {
    console.error('CES site init failed partway through; disabling scroll-reveal so content stays visible:', e);
    document.documentElement.classList.remove('js-reveal');
    document.querySelectorAll('.focus-card, .person-card, .activity-card, .work-item, .pub-card')
      .forEach(el => el.classList.add('is-in'));
  }
}

// ── HELPERS ──────────────────────────────────────────────────

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str == null ? '' : str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Builds a relative link to a scholar's detail page: person.html?id={id}.
function personLink(id) {
  return `person.html?id=${encodeURIComponent(id)}`;
}

// Deterministic avatar tile color per scholar id, per the design contract:
// (sum of char codes of id) % 4 -> {blue, teal, darkteal, navy}.
function avatarTileColor(id) {
  const palette = ['blue', 'teal', 'darkteal', 'navy'];
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return palette[sum % 4];
}

// First + last initials, e.g. "Mustafa Yavas" -> "MY".
function initialsOf(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0] || '';
  const last = parts[parts.length - 1][0] || '';
  return (first + last).toUpperCase();
}

// Screen-reader-only "(opens in a new tab)" hint for links that leave the site
// (WCAG 3.2.5). Returned as a node so it survives textContent rewrites.
function newTabHint() {
  const s = document.createElement('span');
  s.className = 'visually-hidden';
  s.textContent = ' (opens in a new tab)';
  return s;
}

// Returns the same hint as an HTML string, for template-literal markup.
function newTabHintHtml() {
  return '<span class="visually-hidden"> (opens in a new tab)</span>';
}

// Renders the .avatar element (img or fallback tile) for a person, at a given size class.
function avatarHtml(person, sizeClass) {
  const initials = initialsOf(person.name);
  if (person.photo) {
    return `<span class="avatar ${sizeClass}"><img class="avatar__img" src="${escAttr(person.photo)}" alt="${escAttr(person.name)}" loading="lazy"></span>`;
  }
  const color = avatarTileColor(person.id);
  return `<span class="avatar ${sizeClass} avatar--tile avatar--${color}" role="img" aria-label="${escAttr(person.name)}" data-no-photo data-initials="${escAttr(initials)}"><span class="avatar__initials">${escHtml(initials)}</span></span>`;
}

// Up to two focus tags for a person, drawn from their topics.
function focusTagsHtml(person, max = 2) {
  const topics = (person.topics || []).slice(0, max);
  return topics.map(t => `<span class="tag tag--focus">${escHtml(t)}</span>`).join('');
}

// Pulls a 4-digit year out of a publication/media "year" field, which may be
// a number, a string, or a range like "2021/2025" (takes the later year).
// Returns null when nothing parseable is present — never fabricated.
function extractYear(val) {
  if (val == null) return null;
  const matches = String(val).match(/\d{4}/g);
  return matches ? parseInt(matches[matches.length - 1], 10) : null;
}

// De-emphasis threshold: anything more than 2 years old relative to today.
function isDated(val) {
  const year = extractYear(val);
  return year != null && (new Date().getFullYear() - year) > 2;
}

// Derives a thumbnail image URL for a talk: explicit item.cover wins (for
// non-YouTube sources where we've verified a real image), else a YouTube
// video ID is extracted from watch/shorts/youtu.be URLs and its standard
// thumbnail (img.youtube.com/vi/{id}/...) is used — no API key needed, and
// it degrades to no image (never a fabricated/guessed one) for playlist
// links or non-YouTube URLs.
function talkThumbnail(item) {
  if (item.cover) return item.cover;
  const url = item.url || '';
  const match = url.match(/(?:[?&]v=|youtube\.com\/shorts\/|youtu\.be\/)([\w-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
}

// Honest, data-driven work cue: never a fabricated count.
function workCue(person) {
  const n = (person.publications || []).length;
  if (n > 0) return `${n} work${n === 1 ? '' : 's'} →`;
  if (person.personal_website || person.directory_url) return 'Read their work →';
  return '';
}

// ── PEOPLE GRID (people.html) ────────────────────────────────

function buildPeopleGrid() {
  const grid = document.getElementById('person-grid');
  if (!grid) return;
  grid.removeAttribute('data-loading');

  const filtered = activeRoleFilter === 'all'
    ? people
    : people.filter(p => p.role === activeRoleFilter);

  if (!filtered.length) {
    grid.innerHTML = '<p class="empty-state">No scholars match this filter.</p>';
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <a class="person-card" href="${personLink(p.id)}" data-id="${escAttr(p.id)}">
      <div class="person-card__media">
        ${avatarHtml(p, 'avatar--md')}
      </div>
      <div class="person-card__body">
        <h2 class="person-card__name">${escHtml(p.name)}</h2>
        <p class="person-card__title">${escHtml(p.title || '')}</p>
        <div class="person-card__tags">${focusTagsHtml(p)}</div>
        ${workCue(p) ? `<p class="person-card__workcue">${escHtml(workCue(p))}</p>` : ''}
      </div>
    </a>
  `).join('');

  observeRevealTargets(grid.querySelectorAll('.person-card'));
}

function setRoleFilter(role) {
  activeRoleFilter = role;
  document.querySelectorAll('[data-role-filter]').forEach(btn => {
    const isActive = btn.dataset.roleFilter === role;
    btn.classList.toggle('is-active', isActive);
    // .is-active is styling only; aria-pressed is what conveys the selected
    // state to assistive tech (WCAG 4.1.2).
    btn.setAttribute('aria-pressed', String(isActive));
  });
  buildPeopleGrid();
  announcePeopleCount();
}

// The grid is swapped out silently on filter, so screen reader users get no
// signal that anything changed. This posts the new result count to a polite
// live region (WCAG 4.1.3).
function announcePeopleCount() {
  const status = document.getElementById('person-grid-status');
  if (!status) return;
  const count = activeRoleFilter === 'all'
    ? people.length
    : people.filter(p => p.role === activeRoleFilter).length;
  const label = document.querySelector(`[data-role-filter="${activeRoleFilter}"]`);
  const name = label ? label.textContent.trim() : activeRoleFilter;
  status.textContent = `${count} ${count === 1 ? 'scholar' : 'scholars'} shown in ${name}.`;
}

// ── PERSON DETAIL (person.html) ──────────────────────────────

// Renders the scholar detail view into #person-detail-root on person.html,
// driven entirely by the ?id= query parameter — never a per-person static
// file, so adding/removing/editing a scholar only ever requires editing
// data/people.json.
function buildPersonDetail() {
  const root = document.getElementById('person-detail-root');
  if (!root) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const p = people.find(x => x.id === id);

  if (!p) {
    // Distinguish "this id isn't in the roster" from "the roster never loaded" —
    // the second is a site error, and telling the reader the person doesn't exist
    // is an affirmatively wrong answer (WCAG 4.1.3).
    const rosterMissing = failedData.people || !people.length;
    root.innerHTML = rosterMissing
      ? `
      <div class="container" style="padding-block: var(--band-pad);">
        <p class="page-head__eyebrow eyebrow eyebrow--teal">Something went wrong</p>
        <h1 class="page-head__title">This page could not be loaded</h1>
        <p class="page-head__intro">Sorry — our scholar directory could not be loaded just now. Please refresh the page or try again later.</p>
        <a class="btn btn--pill" href="people.html">Back to all scholars<span class="btn__arrow">→</span></a>
      </div>
    `
      : `
      <div class="container" style="padding-block: var(--band-pad);">
        <p class="page-head__eyebrow eyebrow eyebrow--teal">Scholar not found</p>
        <h1 class="page-head__title">We couldn't find that scholar</h1>
        <p class="page-head__intro">They may have moved or the link may be out of date.</p>
        <a class="btn btn--pill" href="people.html">Back to all scholars<span class="btn__arrow">→</span></a>
      </div>
    `;
    announce(rosterMissing
      ? 'Sorry — this page could not be loaded. Please refresh the page or try again later.'
      : 'Scholar not found.');
    return;
  }

  document.title = `${p.name} | Center on Economy and Society`;

  const focusTags = (p.topics || []).map(t => `<span class="tag tag--focus">${escHtml(t)}</span>`).join('');

  const linkChips = [
    p.personal_website ? `<a class="link-chip" href="${escAttr(p.personal_website)}" target="_blank" rel="noopener">Website ↗${newTabHintHtml()}</a>` : '',
    p.directory_url ? `<a class="link-chip" href="${escAttr(p.directory_url)}" target="_blank" rel="noopener">Directory ↗${newTabHintHtml()}</a>` : '',
    p.substack ? `<a class="link-chip" href="${escAttr(p.substack.url)}" target="_blank" rel="noopener">${escHtml(p.substack.name || 'Newsletter')} ↗${newTabHintHtml()}</a>` : '',
  ].filter(Boolean).join('');

  root.innerHTML = `
    <div class="person-profile">
      <section class="person-hero">
        <div class="person-hero__media">
          ${avatarHtml(p, 'avatar--lg')}
        </div>
        <div class="person-hero__identity">
          <p class="person-hero__eyebrow eyebrow eyebrow--teal">${escHtml(roleLabel(p.role))} · Center on Economy and Society</p>
          <h1 class="person-hero__name">${escHtml(p.name)}</h1>
          <p class="person-hero__title">${escHtml([p.title, p.institution].filter(Boolean).join(' · '))}</p>
          <div class="person-hero__tags">${focusTags}</div>
          <div class="person-hero__links">${linkChips}</div>
        </div>
      </section>
      <div class="person-profile__body container">
        ${workSectionHtml(p)}
        ${personAsideHtml(p)}
      </div>
    </div>
  `;

  observeRevealTargets(root.querySelectorAll('.work-item'));
}

function roleLabel(role) {
  if (role === 'leadership') return 'Leadership';
  if (role === 'postdoc') return 'Postdoctoral Fellow';
  if (role === 'visiting') return 'Visiting Fellow';
  if (role === 'alumni') return 'Alum';
  if (role === 'affiliate') return 'Affiliate';
  return 'Scholar';
}

// Builds the work-section centerpiece: curated publications/media if present,
// else a single --link degradation row to the scholar's website/directory.
// Never renders "Publications coming soon" — always at least one row.
function workSectionHtml(p) {
  const pubs = p.publications || [];
  const media = p.media || [];
  const items = [];

  // Newest first within each group, so de-emphasized (>2yr old) work sinks
  // toward the bottom rather than just sitting dimmed in its original spot.
  const byYearDesc = (a, b) => (extractYear(b.year) || 0) - (extractYear(a.year) || 0);

  [...pubs].sort(byYearDesc).forEach(pub => items.push(workItemHtml(pub, pub.type || 'article')));
  [...media].sort(byYearDesc).forEach(m => items.push(workItemHtml(
    { title: m.title, venue: m.outlet, year: m.year, url: m.url }, 'article'
  )));
  if (p.substack) {
    items.push(workItemHtml(
      { title: p.substack.name, venue: 'Newsletter', url: p.substack.url }, 'newsletter'
    ));
  }

  let count = pubs.length + media.length + (p.substack ? 1 : 0);

  if (!items.length) {
    const link = p.personal_website || p.directory_url;
    if (link) {
      items.push(`
        <a class="work-item work-item--link" href="${escAttr(link)}" target="_blank" rel="noopener">
          <span class="work-item__badge">Profile</span>
          <div class="work-item__content">
            <h3 class="work-item__title">Read ${escHtml(p.name)}'s work</h3>
            <p class="work-item__meta">${escHtml(p.institution || '')}</p>
          </div>
          <span class="work-item__cue">↗</span>${newTabHintHtml()}
        </a>
      `);
      count = 1;
    } else {
      items.push(`
        <div class="work-item work-item--link">
          <span class="work-item__badge">Profile</span>
          <div class="work-item__content">
            <h3 class="work-item__title">${escHtml(p.name)}</h3>
            <p class="work-item__meta">${escHtml(p.institution || '')}</p>
          </div>
        </div>
      `);
    }
  }

  return `
    <section class="work-section" aria-labelledby="work-h-${escAttr(p.id)}">
      <div class="work-section__head">
        <h2 class="work-section__eyebrow eyebrow" id="work-h-${escAttr(p.id)}">Selected Work &amp; Writing</h2>
        <span class="work-section__count">${count} work${count === 1 ? '' : 's'}</span>
      </div>
      <div class="work-list">${items.join('')}</div>
    </section>
  `;
}

const WORK_BADGE_LABEL = { book: 'Book', article: 'Article', newsletter: 'Newsletter', link: 'Profile', talk: 'Talk' };

function workItemHtml(item, type) {
  const modifier = ['book', 'article', 'newsletter', 'talk'].includes(type) ? type : 'article';
  const badge = WORK_BADGE_LABEL[modifier] || 'Article';
  const meta = [item.venue, item.year].filter(Boolean).join(' · ');
  const cover = item.cover ? `<img class="work-item__cover" src="${escAttr(item.cover)}" alt="" loading="lazy">` : '';
  const dated = isDated(item.year) ? ' is-dated' : '';
  const inner = `
      <span class="work-item__badge">${escHtml(badge)}</span>
      <div class="work-item__content">
        <h3 class="work-item__title">${escHtml(item.title)}</h3>
        ${meta ? `<p class="work-item__meta">${escHtml(meta)}</p>` : ''}
        ${item.note ? `<p class="work-item__note">${escHtml(item.note)}</p>` : ''}
        ${cover}
      </div>`;

  // Several records in people.json have "url": null. Rendering those as <a href="">
  // produced a focusable link that reloaded the current page (WCAG 2.4.4 / 2.1.1),
  // so an entry without a URL is rendered as a plain, non-interactive row.
  if (!item.url) {
    return `
    <div class="work-item work-item--${modifier}${dated}">${inner}
    </div>
  `;
  }

  return `
    <a class="work-item work-item--${modifier}${dated}" href="${escAttr(item.url)}" target="_blank" rel="noopener">${inner}
      <span class="work-item__cue">↗</span>${newTabHintHtml()}
    </a>
  `;
}

// Secondary rail: short bio + focus areas.
function personAsideHtml(p) {
  const topics = (p.topics || []);
  return `
    <aside class="person-aside">
      ${p.bio ? `
        <div class="person-aside__section">
          <h2 class="person-aside__head">About</h2>
          <p class="person-aside__bio">${escHtml(p.bio)}</p>
        </div>
      ` : ''}
      ${topics.length ? `
        <div class="person-aside__section">
          <h2 class="person-aside__head">Focus Areas</h2>
          <div class="person-aside__list">
            ${topics.map(t => `<p class="person-aside__list-item">${escHtml(t)}</p>`).join('')}
          </div>
        </div>
      ` : ''}
    </aside>
  `;
}

// ── AGGREGATED PUBLICATIONS FEED (index.html "Recent work" teaser) ──

function buildPublicationsFeed() {
  const track = document.getElementById('pub-grid-track');
  if (!track) return;
  track.removeAttribute('data-loading');

  // Flatten publications across all people, sort by year descending.
  const flat = [];
  people.forEach(p => {
    (p.publications || []).forEach(pub => {
      flat.push({ ...pub, personId: p.id, personName: p.name });
    });
  });
  flat.sort((a, b) => (extractYear(b.year) || 0) - (extractYear(a.year) || 0));

  let cardsHtml;
  if (flat.length) {
    cardsHtml = flat.slice(0, 8).map(pub => {
      const modifier = ['book', 'article', 'newsletter'].includes(pub.type) ? pub.type : 'article';
      const badge = WORK_BADGE_LABEL[modifier] || 'Article';
      const dated = isDated(pub.year) ? ' is-dated' : '';
      return `
        <a class="pub-card work-item--${modifier}${dated}" href="${personLink(pub.personId)}">
          <span class="pub-card__badge">${escHtml(badge)}</span>
          <h2 class="pub-card__title">${escHtml(pub.title)}</h2>
          <p class="pub-card__author">${escHtml(pub.personName)}</p>
          <p class="pub-card__meta">${escHtml([pub.venue, pub.year].filter(Boolean).join(' · '))}</p>
          <span class="pub-card__cue">Read →</span>
        </a>
      `;
    }).join('');
  } else {
    // Degradation path: five most link-rich scholars, never an empty rail.
    const linkRich = [...people]
      .filter(p => p.personal_website || p.directory_url)
      .slice(0, 5);
    cardsHtml = linkRich.map(p => `
      <a class="pub-card work-item--link" href="${personLink(p.id)}">
        <span class="pub-card__badge">Profile</span>
        <h2 class="pub-card__title">${escHtml(p.name)}</h2>
        <p class="pub-card__author">${escHtml(p.institution || '')}</p>
        <p class="pub-card__meta">Read their work ↗</p>
      </a>
    `).join('');
  }

  track.innerHTML = `<div class="pub-grid__cards">${cardsHtml}</div>`;
  observeRevealTargets(track.querySelectorAll('.pub-card'));
}

// ── FOCUS AREAS (focus-areas.html — full grid) ──────────────

function buildFocusAreas() {
  const grid = document.getElementById('focus-grid');
  if (!grid || !siteContent) return;
  grid.removeAttribute('data-loading');

  const areas = siteContent.focus_areas || [];
  grid.innerHTML = areas.map((area, i) => focusCardHtml(area, i)).join('');

  observeRevealTargets(grid.querySelectorAll('.focus-card'));
}

// ── FOCUS AREAS TEASER (index.html — compact preview) ───────

function buildFocusAreasTeaser() {
  const grid = document.getElementById('focus-grid-teaser');
  if (!grid || !siteContent) return;
  grid.removeAttribute('data-loading');

  const areas = (siteContent.focus_areas || []).slice(0, 3);
  grid.innerHTML = areas.map((area, i) => focusCardHtml(area, i)).join('');

  observeRevealTargets(grid.querySelectorAll('.focus-card'));
}

// Shared focus-card renderer used by both the full grid (focus-areas.html)
// and the home teaser (index.html) — scholar chips link to person.html?id=.
// Rendered as a <div> (not <a>) because the scholar avatars are themselves
// links and nested <a> elements are invalid HTML; the card carries its own
// explicit cue link instead of being one big anchor.
function focusCardHtml(area, i) {
  const scholars = (area.scholar_ids || [])
    .map(id => people.find(p => p.id === id))
    .filter(Boolean);
  const shown = scholars.slice(0, 4);
  const extra = scholars.length - shown.length;
  return `
    <div class="focus-card" data-focus-index="${i}">
      <h2 class="focus-card__title">${escHtml(area.title)}</h2>
      <p class="focus-card__desc">${escHtml(area.description || '')}</p>
      <div class="focus-card__scholars">
        ${shown.map(s => `<a href="${personLink(s.id)}">${avatarHtml(s, 'avatar--xs avatar--tile')}</a>`).join('')}
        ${extra > 0 ? `<span class="focus-card__scholars-more">+${extra}</span>` : ''}
      </div>
      <a class="focus-card__cue" href="people.html" aria-label="View scholars in ${escAttr(area.title)}">→</a>
    </div>
  `;
}

// ── PROGRAMS / ACTIVITIES / OPPORTUNITIES (programs.html) ───

function activityCardHtml(item, modifier, eyebrowLabel) {
  return `
    <article class="activity-card activity-card--${modifier}">
      <p class="activity-card__eyebrow eyebrow eyebrow--sky">${escHtml(eyebrowLabel)}</p>
      <h2 class="activity-card__title">${escHtml(item.name)}</h2>
      <p class="activity-card__desc">${escHtml(item.description || '')}</p>
      ${item.url ? `<a class="activity-card__cta btn btn--pill--ghost" href="${escAttr(item.url)}" target="_blank" rel="noopener">Learn more<span class="btn__arrow">→</span>${newTabHintHtml()}</a>` : ''}
    </article>
  `;
}

function buildPrograms() {
  const grid = document.getElementById('programs-grid');
  if (!grid || !siteContent) return;
  grid.removeAttribute('data-loading');
  const programs = siteContent.programs || [];
  grid.innerHTML = programs.map(p => activityCardHtml(p, 'program', 'Program')).join('');
  observeRevealTargets(grid.querySelectorAll('.activity-card'));
}

function buildActivities() {
  const grid = document.getElementById('activities-grid');
  if (!grid || !siteContent) return;
  grid.removeAttribute('data-loading');
  const activities = siteContent.activities || [];
  grid.innerHTML = activities.map(a => activityCardHtml(a, 'activity', 'Activity')).join('');
  observeRevealTargets(grid.querySelectorAll('.activity-card'));
}

function buildOpportunities() {
  const grid = document.getElementById('opportunities-grid');
  if (!grid || !siteContent) return;
  grid.removeAttribute('data-loading');
  const opportunities = siteContent.opportunities || [];
  grid.innerHTML = opportunities.map(o => activityCardHtml(o, 'opportunity', 'Opportunity')).join('');
  observeRevealTargets(grid.querySelectorAll('.activity-card'));
}

// ── ABOUT (about.html) ───────────────────────────────────────

function buildAbout() {
  const el = document.getElementById('about-meta');
  if (!el || !siteContent) return;
  const about = siteContent.about || {};

  el.innerHTML = `
    <div class="person-aside__section">
      <h2 class="person-aside__head">Leadership</h2>
      <div class="person-aside__list">
        ${about.director ? `<p class="person-aside__list-item">Director: ${escHtml(about.director)}</p>` : ''}
        ${about.associate_director ? `<p class="person-aside__list-item">Associate Director: ${escHtml(about.associate_director)}</p>` : ''}
        ${about.advisory_board_chair ? `<p class="person-aside__list-item">Advisory Board Chair: ${escHtml(about.advisory_board_chair)}</p>` : ''}
      </div>
    </div>
    ${about.funding_sources?.length ? `
      <div class="person-aside__section">
        <h2 class="person-aside__head">Funding</h2>
        <div class="person-aside__list">
          ${about.funding_sources.map(f => `<p class="person-aside__list-item">${escHtml(f)}</p>`).join('')}
        </div>
      </div>
    ` : ''}
    ${about.connected_networks?.length ? `
      <div class="person-aside__section">
        <h2 class="person-aside__head">Connected Networks</h2>
        <div class="person-aside__list">
          ${about.connected_networks.map(n => `<p class="person-aside__list-item">${escHtml(n)}</p>`).join('')}
        </div>
      </div>
    ` : ''}
    ${about.parent_institute ? `
      <div class="person-aside__section">
        <h2 class="person-aside__head">Parent Institute</h2>
        <p class="person-aside__bio">${escHtml(about.parent_institute)}</p>
      </div>
    ` : ''}
  `;
}

// ── FOOTER NEWSLETTER (all pages) ────────────────────────────

// Fills in the footer's "Join our mailing list" link from
// data/site-content.json.newsletter, so updating the form URL is a JSON-only
// edit (see README's "content-only edit" pattern) and never touches the
// 7 copy-pasted footer markups directly.
function buildFooterNewsletter() {
  const link = document.getElementById('footer-newsletter-link');
  if (!link || !siteContent) return;
  const nl = siteContent.newsletter;
  if (!nl) return;
  // textContent would wipe the visually-hidden "(opens in a new tab)" span that
  // the static markup carries for WCAG 3.2.5, so rebuild the label and re-append it.
  link.textContent = `${nl.label || 'Join our mailing list'} →`;
  link.appendChild(newTabHint());
  if (nl.form_url) link.href = nl.form_url;
}

// ── MEDIA (media.html — talks & appearances, newsletters) ────

// Renders a single row in the "Talks & Appearances" list. Reuses the
// .work-item card pattern (see workItemHtml) but, unlike a person's own
// work-section, each row spans scholars, so the scholar's name is shown as
// a link back to their person.html?id= page rather than assumed from page
// context.
function talkItemHtml(talk) {
  const scholar = people.find(p => p.id === talk.scholar_id);
  const scholarName = scholar ? scholar.name : talk.scholar_id;
  const meta = [talk.venue, talk.year].filter(Boolean).join(' · ');
  const dated = isDated(talk.year) ? ' is-dated' : '';
  const thumb = talkThumbnail(talk);
  const cover = thumb
    ? `<a class="work-item__cover-link" href="${escAttr(talk.url)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img class="work-item__cover" src="${escAttr(thumb)}" alt="" loading="lazy"></a>`
    : '';
  return `
    <div class="work-item work-item--talk${dated}">
      <span class="work-item__badge">Talk</span>
      <div class="work-item__content">
        <h2 class="work-item__title"><a href="${escAttr(talk.url)}" target="_blank" rel="noopener">${escHtml(talk.title)}${newTabHintHtml()}</a></h2>
        <p class="work-item__meta">
          ${scholar ? `<a href="${personLink(scholar.id)}">${escHtml(scholarName)}</a>` : escHtml(scholarName)}
          ${meta ? ` · ${escHtml(meta)}` : ''}
        </p>
        ${cover}
      </div>
      <a class="work-item__cue" href="${escAttr(talk.url)}" target="_blank" rel="noopener" aria-label="Watch ${escAttr(talk.title)} (opens in a new tab)">↗</a>
    </div>
  `;
}

// Renders a single row in the "Newsletters" list — same pattern, linking
// both to the newsletter itself and back to the scholar's profile.
function newsletterItemHtml(nl) {
  const scholar = people.find(p => p.id === nl.scholar_id);
  const scholarName = scholar ? scholar.name : nl.scholar_id;
  return `
    <div class="work-item work-item--newsletter">
      <span class="work-item__badge">Newsletter</span>
      <div class="work-item__content">
        <h2 class="work-item__title"><a href="${escAttr(nl.url)}" target="_blank" rel="noopener">${escHtml(nl.name)}${newTabHintHtml()}</a></h2>
        <p class="work-item__meta">
          ${scholar ? `<a href="${personLink(scholar.id)}">${escHtml(scholarName)}</a>` : escHtml(scholarName)}
        </p>
      </div>
      <a class="work-item__cue" href="${escAttr(nl.url)}" target="_blank" rel="noopener" aria-label="Read ${escAttr(nl.name)} (opens in a new tab)">↗</a>
    </div>
  `;
}

// Featured coverage renders as a pop-out card, not a list row: these are the
// prestige outlets and the page leads with them. The whole card is one link,
// so the outlet, headline and byline are all part of its accessible name.
function featuredPressHtml(item) {
  const names = (item.scholar_ids || [])
    .map(id => {
      const p = people.find(x => x.id === id);
      return p ? p.name : null;
    })
    .filter(Boolean);
  return `
    <a class="feature-card" href="${escAttr(item.url)}" target="_blank" rel="noopener">
      <span class="feature-card__source">${escHtml(item.source || '')}</span>
      <span class="feature-card__title">${escHtml(item.title)}</span>
      <span class="feature-card__foot">
        ${names.length ? `<span class="feature-card__who">${escHtml(names.join(', '))}</span>` : ''}
        <span class="feature-card__date">${escHtml(formatPressDate(item.date))}</span>
      </span>
      <span class="feature-card__cue" aria-hidden="true">↗</span>${newTabHintHtml()}
    </a>
  `;
}

// Renders one press-mention row. Unlike talks (curated by hand), these come
// from the daily media digest export, so a story can name several CES
// scholars — each gets its own link back to their page.
function pressItemHtml(item) {
  const names = (item.scholar_ids || [])
    .map(id => {
      const p = people.find(x => x.id === id);
      return p
        ? `<a href="${escAttr(personLink(p.id))}">${escHtml(p.name)}</a>`
        : null;
    })
    .filter(Boolean);
  const year = item.date ? Number(String(item.date).slice(0, 4)) : null;
  const meta = [item.source, formatPressDate(item.date)].filter(Boolean).join(' · ');
  const dated = isDated(year) ? ' is-dated' : '';
  return `
    <div class="work-item work-item--press${dated}">
      <span class="work-item__badge">Press</span>
      <div class="work-item__content">
        <h2 class="work-item__title"><a href="${escAttr(item.url)}" target="_blank" rel="noopener">${escHtml(item.title)}${newTabHintHtml()}</a></h2>
        ${meta ? `<p class="work-item__meta">${escHtml(meta)}</p>` : ''}
        ${names.length ? `<p class="work-item__note">${names.join(', ')}</p>` : ''}
      </div>
      <a class="work-item__cue" href="${escAttr(item.url)}" target="_blank" rel="noopener" aria-label="Read ${escAttr(item.title)} (opens in a new tab)">↗</a>
    </div>
  `;
}

// "2026-09-14" -> "14 September 2026". Parsed as parts, not via Date(), so a
// bare YYYY-MM-DD is not shifted a day by UTC-vs-local interpretation.
function formatPressDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return String(iso);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return String(iso);
  return `${Number(m[3])} ${month} ${m[1]}`;
}

// Renders one post from a scholar's own Substack. Distinct from a press row:
// this is our scholar's writing, not coverage of them, so the scholar's name
// and newsletter carry the byline rather than an outlet.
function substackPostHtml(post) {
  const scholar = people.find(p => p.id === post.scholar_id);
  const byline = scholar
    ? `<a href="${escAttr(personLink(scholar.id))}">${escHtml(scholar.name)}</a>`
    : escHtml(post.scholar_id || '');
  const meta = [post.newsletter, formatPressDate(post.date)].filter(Boolean).join(' · ');
  const year = post.date ? Number(String(post.date).slice(0, 4)) : null;
  const dated = isDated(year) ? ' is-dated' : '';
  return `
    <div class="work-item work-item--substack${dated}">
      <span class="work-item__badge">Newsletter</span>
      <div class="work-item__content">
        <h2 class="work-item__title"><a href="${escAttr(post.url)}" target="_blank" rel="noopener">${escHtml(post.title)}${newTabHintHtml()}</a></h2>
        ${meta ? `<p class="work-item__meta">${escHtml(meta)}</p>` : ''}
        ${byline ? `<p class="work-item__note">${byline}</p>` : ''}
      </div>
      <a class="work-item__cue" href="${escAttr(post.url)}" target="_blank" rel="noopener" aria-label="Read ${escAttr(post.title)} (opens in a new tab)">↗</a>
    </div>
  `;
}

// Builds both media.html sections from data/media.json. Kept flexible per
// the site owner's "edit JSON, not code" principle: adding a new talk or
// newsletter later only requires a new object in data/media.json, in the
// same shape as the existing entries.
function buildMedia() {
  const talksList = document.getElementById('talks-list');
  const newslettersList = document.getElementById('newsletters-list');
  if (!talksList && !newslettersList) return;
  if (!mediaContent) return;

  if (talksList) {
    talksList.removeAttribute('data-loading');
    // Most recent first; talks with no verified year (extractYear -> null,
    // treated as 0) sink to the bottom rather than being guessed at.
    const talks = [...(mediaContent.talks || [])]
      .sort((a, b) => (extractYear(b.year) || 0) - (extractYear(a.year) || 0));
    talksList.innerHTML = talks.length
      ? talks.map(talkItemHtml).join('')
      : '<p class="empty-state">No talks or appearances yet.</p>';
    observeRevealTargets(talksList.querySelectorAll('.work-item'));
  }

  if (newslettersList) {
    newslettersList.removeAttribute('data-loading');
    const newsletters = mediaContent.newsletters || [];
    newslettersList.innerHTML = newsletters.length
      ? newsletters.map(newsletterItemHtml).join('')
      : '<p class="empty-state">No newsletters yet.</p>';
    observeRevealTargets(newslettersList.querySelectorAll('.work-item'));
  }

  // Recent posts from scholars' own Substacks, written by
  // scripts/export_ces_substack.py (a separate step from the press export).
  const posts = [...(mediaContent.substack_posts || [])]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  renderWorkList(
    document.getElementById('substack-posts-list'),
    posts,
    substackPostHtml,
    'No recent newsletter posts.'
  );

  // Press coverage, written by scripts/export_ces_press.py in the agora_media
  // repo after each daily digest run. Split into a featured band (major
  // national/international outlets, flagged `featured` by the exporter's
  // editable PRESTIGE_SOURCES list) and everything else. Newest first in both.
  const byDate = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  const allPress = [...(mediaContent.press || [])].sort(byDate);

  renderWorkList(
    document.getElementById('press-featured-list'),
    allPress.filter(p => p.featured),
    featuredPressHtml,
    'No featured coverage yet.'
  );
  renderWorkList(
    document.getElementById('press-more-list'),
    allPress.filter(p => !p.featured),
    pressItemHtml,
    'No further coverage yet.'
  );
}

// Fills one .work-list container, or shows an empty state, and registers the
// new rows with the scroll-reveal observer.
function renderWorkList(el, items, renderer, emptyMsg) {
  if (!el) return;
  el.removeAttribute('data-loading');
  el.innerHTML = items.length
    ? items.map(renderer).join('')
    : `<p class="empty-state">${emptyMsg}</p>`;
  observeRevealTargets(el.querySelectorAll('.work-item, .feature-card'));
}

// ── SCROLL REVEAL ────────────────────────────────────────────

let revealObserver = null;

function initScrollReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.focus-card, .person-card, .activity-card, .work-item, .pub-card')
      .forEach(el => el.classList.add('is-in'));
    return;
  }
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  observeRevealTargets(document.querySelectorAll('.focus-card, .person-card, .activity-card, .work-item, .pub-card'));
}

// Registers newly-rendered cards with the scroll-reveal observer (or reveals
// them immediately if reduced-motion / no observer support).
function observeRevealTargets(nodeList) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodeList.forEach(el => el.classList.add('is-in'));
    return;
  }
  if (!revealObserver) return;
  nodeList.forEach(el => revealObserver.observe(el));
}

// ── EVENT LISTENERS ──────────────────────────────────────────

function setupEventListeners() {
  document.querySelectorAll('[data-role-filter]').forEach(btn => {
    btn.addEventListener('click', () => setRoleFilter(btn.dataset.roleFilter));
  });

  const toggle = document.querySelector('.site-header__toggle');
  const nav = document.querySelector('.site-header__nav');
  if (toggle && nav) {
    const setNav = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.setAttribute('data-open', String(open));
      // The nav sits BEFORE the toggle in DOM order, so after opening the menu a
      // forward Tab would skip straight past every link into the page body. Move
      // focus to the first link so the menu is actually traversable (WCAG 2.4.3).
      if (open) {
        const first = nav.querySelector('a');
        if (first) first.focus();
      }
    };
    // Closes the menu and puts focus back on the toggle. Without the focus
    // return, dismissing the menu strands keyboard focus on a now-hidden
    // link and the user restarts from the top of the document (WCAG 2.4.3).
    const closeNav = ({ refocus = false } = {}) => {
      setNav(false);
      if (refocus) toggle.focus();
    };

    toggle.addEventListener('click', () => {
      setNav(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Tabbing past the last link (or Shift+Tabbing before the first) used to leave
    // focus on page content while this opaque full-width overlay stayed open on top
    // of it — the focused element's ring ended up partly behind the panel, and focus
    // could leave the document entirely with the menu still open. Closing as soon as
    // focus leaves the header keeps focus and the visible overlay in sync
    // (WCAG 2.4.3 Focus Order, 2.4.7 Focus Visible).
    const headerInner = toggle.closest('.site-header__inner') || nav.parentElement;
    headerInner.addEventListener('focusout', (e) => {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      // relatedTarget is where focus is going; null means it left the document.
      if (e.relatedTarget && headerInner.contains(e.relatedTarget)) return;
      closeNav();
    });

    nav.querySelectorAll('a').forEach(link => {
      // Navigating away: don't steal focus from the destination page.
      link.addEventListener('click', () => closeNav());
    });

    // Escape dismisses the open menu from anywhere inside the header (WCAG 2.1.1).
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      closeNav({ refocus: true });
    });
  }
}

// ── START ────────────────────────────────────────────────────

loadData();
