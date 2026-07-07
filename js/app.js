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
let activeRoleFilter = 'all';

// ── DATA LOAD ────────────────────────────────────────────────

async function loadData() {
  try {
    const [pRes, sRes, mRes] = await Promise.all([
      fetch('data/people.json'),
      fetch('data/site-content.json'),
      fetch('data/media.json'),
    ]);
    people = await pRes.json();
    siteContent = await sRes.json();
    mediaContent = await mRes.json();
  } catch (e) {
    console.error('Could not load CES site data:', e);
    people = people || [];
    siteContent = siteContent || null;
    mediaContent = mediaContent || null;
  }
  init();
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
        <h3 class="person-card__name">${escHtml(p.name)}</h3>
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
    btn.classList.toggle('is-active', btn.dataset.roleFilter === role);
  });
  buildPeopleGrid();
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
    root.innerHTML = `
      <div class="container" style="padding-block: var(--band-pad);">
        <p class="page-head__eyebrow eyebrow eyebrow--teal">Scholar not found</p>
        <h2 class="page-head__title">We couldn't find that scholar</h2>
        <p class="page-head__intro">They may have moved or the link may be out of date.</p>
        <a class="btn btn--pill" href="people.html">Back to all scholars<span class="btn__arrow">→</span></a>
      </div>
    `;
    return;
  }

  document.title = `${p.name} | Center on Economy and Society`;

  const focusTags = (p.topics || []).map(t => `<span class="tag tag--focus">${escHtml(t)}</span>`).join('');

  const linkChips = [
    p.personal_website ? `<a class="link-chip" href="${escAttr(p.personal_website)}" target="_blank" rel="noopener">Website ↗</a>` : '',
    p.directory_url ? `<a class="link-chip" href="${escAttr(p.directory_url)}" target="_blank" rel="noopener">Directory ↗</a>` : '',
    p.substack ? `<a class="link-chip" href="${escAttr(p.substack.url)}" target="_blank" rel="noopener">${escHtml(p.substack.name || 'Newsletter')} ↗</a>` : '',
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
  return 'Scholar';
}

// Builds the work-section centerpiece: curated publications/media if present,
// else a single --link degradation row to the scholar's website/directory.
// Never renders "Publications coming soon" — always at least one row.
function workSectionHtml(p) {
  const pubs = p.publications || [];
  const media = p.media || [];
  const items = [];

  pubs.forEach(pub => items.push(workItemHtml(pub, pub.type || 'article')));
  media.forEach(m => items.push(workItemHtml(
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
          <span class="work-item__cue">↗</span>
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
        <p class="work-section__eyebrow eyebrow" id="work-h-${escAttr(p.id)}">Selected Work &amp; Writing</p>
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
  return `
    <a class="work-item work-item--${modifier}" href="${escAttr(item.url)}" target="_blank" rel="noopener">
      <span class="work-item__badge">${escHtml(badge)}</span>
      <div class="work-item__content">
        <h3 class="work-item__title">${escHtml(item.title)}</h3>
        ${meta ? `<p class="work-item__meta">${escHtml(meta)}</p>` : ''}
        ${item.note ? `<p class="work-item__note">${escHtml(item.note)}</p>` : ''}
        ${cover}
      </div>
      <span class="work-item__cue">↗</span>
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
          <span class="person-aside__head">About</span>
          <p class="person-aside__bio">${escHtml(p.bio)}</p>
        </div>
      ` : ''}
      ${topics.length ? `
        <div class="person-aside__section">
          <span class="person-aside__head">Focus Areas</span>
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
  flat.sort((a, b) => (b.year || 0) - (a.year || 0));

  let cardsHtml;
  if (flat.length) {
    cardsHtml = flat.slice(0, 8).map(pub => {
      const modifier = ['book', 'article', 'newsletter'].includes(pub.type) ? pub.type : 'article';
      const badge = WORK_BADGE_LABEL[modifier] || 'Article';
      return `
        <a class="pub-card work-item--${modifier}" href="${personLink(pub.personId)}">
          <span class="pub-card__badge">${escHtml(badge)}</span>
          <h3 class="pub-card__title">${escHtml(pub.title)}</h3>
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
        <h3 class="pub-card__title">${escHtml(p.name)}</h3>
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
      <h3 class="focus-card__title">${escHtml(area.title)}</h3>
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
      <h3 class="activity-card__title">${escHtml(item.name)}</h3>
      <p class="activity-card__desc">${escHtml(item.description || '')}</p>
      ${item.url ? `<a class="activity-card__cta btn btn--pill--ghost" href="${escAttr(item.url)}" target="_blank" rel="noopener">Learn more<span class="btn__arrow">→</span></a>` : ''}
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
      <span class="person-aside__head">Leadership</span>
      <div class="person-aside__list">
        ${about.director ? `<p class="person-aside__list-item">Director: ${escHtml(about.director)}</p>` : ''}
        ${about.associate_director ? `<p class="person-aside__list-item">Associate Director: ${escHtml(about.associate_director)}</p>` : ''}
        ${about.advisory_board_chair ? `<p class="person-aside__list-item">Advisory Board Chair: ${escHtml(about.advisory_board_chair)}</p>` : ''}
      </div>
    </div>
    ${about.funding_sources?.length ? `
      <div class="person-aside__section">
        <span class="person-aside__head">Funding</span>
        <div class="person-aside__list">
          ${about.funding_sources.map(f => `<p class="person-aside__list-item">${escHtml(f)}</p>`).join('')}
        </div>
      </div>
    ` : ''}
    ${about.connected_networks?.length ? `
      <div class="person-aside__section">
        <span class="person-aside__head">Connected Networks</span>
        <div class="person-aside__list">
          ${about.connected_networks.map(n => `<p class="person-aside__list-item">${escHtml(n)}</p>`).join('')}
        </div>
      </div>
    ` : ''}
    ${about.parent_institute ? `
      <div class="person-aside__section">
        <span class="person-aside__head">Parent Institute</span>
        <p class="person-aside__bio">${escHtml(about.parent_institute)}</p>
      </div>
    ` : ''}
  `;
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
  const meta = [talk.venue].filter(Boolean).join(' · ');
  return `
    <div class="work-item work-item--talk">
      <span class="work-item__badge">Talk</span>
      <div class="work-item__content">
        <h3 class="work-item__title"><a href="${escAttr(talk.url)}" target="_blank" rel="noopener">${escHtml(talk.title)}</a></h3>
        <p class="work-item__meta">
          ${scholar ? `<a href="${personLink(scholar.id)}">${escHtml(scholarName)}</a>` : escHtml(scholarName)}
          ${meta ? ` · ${escHtml(meta)}` : ''}
        </p>
      </div>
      <a class="work-item__cue" href="${escAttr(talk.url)}" target="_blank" rel="noopener" aria-label="Watch ${escAttr(talk.title)}">↗</a>
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
        <h3 class="work-item__title"><a href="${escAttr(nl.url)}" target="_blank" rel="noopener">${escHtml(nl.name)}</a></h3>
        <p class="work-item__meta">
          ${scholar ? `<a href="${personLink(scholar.id)}">${escHtml(scholarName)}</a>` : escHtml(scholarName)}
        </p>
      </div>
      <a class="work-item__cue" href="${escAttr(nl.url)}" target="_blank" rel="noopener" aria-label="Read ${escAttr(nl.name)}">↗</a>
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
    const talks = mediaContent.talks || [];
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
    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      nav.setAttribute('data-open', String(!isOpen));
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        nav.setAttribute('data-open', 'false');
      });
    });
  }
}

// ── START ────────────────────────────────────────────────────

loadData();
