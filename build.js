#!/usr/bin/env node
// Builds the Projects section and every post page.
//
// Posts are markdown files in a writing/ folder. This repo has one, and every project listed in
// projects.json with a "repo" is read from that GitHub repo's writing/ folder too (public repos only).
// Front matter: title, date (required), description, categories, project (a slug from projects.json;
// posts pulled from a project's repo belong to that project automatically).
//
// Writes: blog/posts/<slug>.html, projects/index.html, projects/<slug>/index.html, blog/rss.xml.

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname);
const WRITING_DIR = path.join(ROOT, 'writing');
const POSTS_OUT = path.join(ROOT, 'blog', 'posts');
const PROJECTS_OUT = path.join(ROOT, 'projects');
const RSS_FILE = path.join(ROOT, 'blog', 'rss.xml');
const SITE = 'https://elishajkmiller.com';

const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function parseDate(val) {
  if (val instanceof Date) return val;
  return new Date(String(val).slice(0, 10) + 'T00:00:00Z');
}

function fmtLong(d) {
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function fmtShort(d) {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}, ${d.getUTCFullYear()}`;
}

function fmtRFC822(d) {
  return `${DAYS_SHORT[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()} 00:00:00 +0000`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escXML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
  fs.writeFileSync(file, text);
  return true;
}

// ---------- shared page shell ----------

function shell({ title, desc, body, cls = 'read', scripts = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="alternate" type="application/rss+xml" title="Elisha JK Miller" href="/blog/rss.xml">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
</head>
<body>
<header id="topbar"></header>

  <main class="main ${cls}">
${body}
  </main>
<footer id="foot"></footer>
<script src="/components/nav.js"></script>
${scripts}</body>
</html>
`;
}

// ---------- gathering posts ----------

const isPostFile = (name) =>
  /^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(name) && name.toLowerCase() !== 'readme.md';

async function gh(url) {
  const headers = { 'User-Agent': 'elishajkmiller-site-build', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(url, { headers });
}

// A missing folder in a repo that exists means no writing yet. Anything else (the repo is gone or
// private, rate limits, network errors) stops the build, so posts can never silently disappear.
async function remotePosts(project) {
  const dir = project.writingPath || 'writing';
  const res = await gh(`https://api.github.com/repos/${project.repo}/contents/${dir}`);
  if (res.status === 404) {
    const repo = await gh(`https://api.github.com/repos/${project.repo}`);
    if (!repo.ok) throw new Error(`${project.repo}: repo not reachable (GitHub answered ${repo.status})`);
    return [];
  }
  if (!res.ok) throw new Error(`${project.repo}: GitHub answered ${res.status}`);
  const items = (await res.json()).filter((i) => i.type === 'file' && isPostFile(i.name));
  const out = [];
  for (const item of items) {
    const raw = await fetch(item.download_url, { headers: { 'User-Agent': 'elishajkmiller-site-build' } });
    if (!raw.ok) throw new Error(`${project.repo}/${item.name}: ${raw.status}`);
    out.push({ file: item.name, src: await raw.text(), project: project.slug });
  }
  return out;
}

function localPosts() {
  if (!fs.existsSync(WRITING_DIR)) return [];
  return fs.readdirSync(WRITING_DIR)
    .filter(isPostFile)
    .map((file) => ({ file, src: fs.readFileSync(path.join(WRITING_DIR, file), 'utf8'), project: null }));
}

async function gatherPosts(projects) {
  const raw = localPosts();
  for (const p of projects) {
    if (p.repo) raw.push(...(await remotePosts(p)));
  }
  const slugs = new Set(projects.map((p) => p.slug));
  const seen = new Set();
  const posts = [];
  for (const r of raw) {
    const slug = r.file.slice(0, -3);
    const { data: fm, content } = matter(r.src);
    if (!fm.title || !fm.date) {
      console.warn(`  warn   ${r.file}: missing title or date, skipping`);
      continue;
    }
    if (seen.has(slug)) {
      console.warn(`  warn   ${r.file}: another post already uses this name, skipping`);
      continue;
    }
    seen.add(slug);
    const project = fm.project || r.project;
    if (project && !slugs.has(project)) {
      console.warn(`  warn   ${r.file}: unknown project "${project}", leaving it unassigned`);
    }
    posts.push({ slug, fm, content, date: parseDate(fm.date), project: slugs.has(project) ? project : null });
  }
  posts.sort((a, b) => (b.date - a.date) || a.slug.localeCompare(b.slug));
  return posts;
}

// ---------- pieces ----------

function postItem(post, byProject) {
  const cats = (post.fm.categories || []).map((c) => `<span class="post-cat">${esc(c)}</span>`);
  const proj = post.project && byProject[post.project]
    ? [`<span class="post-cat of-proj">${esc(byProject[post.project].title)}</span>`] : [];
  return `    <a href="/blog/posts/${post.slug}.html" class="post-item" data-cats="${esc((post.fm.categories || []).join(','))}">
      <div class="post-date">${fmtShort(post.date)}</div>
      <div class="post-right">
        <div class="post-cats">${[...proj, ...cats].join('\n          ')}</div>
        <div class="post-title">${esc(post.fm.title)}</div>
        <div class="post-excerpt">${esc(post.fm.description || '')}</div>
      </div>
    </a>`;
}

function catFilters(posts) {
  const cats = [...new Set(posts.flatMap((p) => p.fm.categories || []))];
  if (!cats.length) return '';
  const buttons = cats.map((c) => `    <button class="cat-filter" data-cat="${esc(c)}">${esc(c)}</button>`).join('\n');
  return `    <div class="cat-filters">
    <button class="cat-filter active" data-cat="all">all</button>
${buttons}
    </div>\n`;
}

const emptyBlock = (title, sub) => `    <div class="empty-block">
      <div class="empty-title">${title}</div>
      <div class="empty-sub">${sub}</div>
    </div>`;

function chips(project) {
  return (project.cats || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('');
}

function statusPill(project) {
  return project.status ? `<span class="pill${project.warn ? ' warn' : ''}">${esc(project.status)}</span>` : '';
}

// ---------- pages ----------

function postPage(post, byProject) {
  const fm = post.fm;
  const proj = post.project ? byProject[post.project] : null;
  const projLink = proj
    ? `\n      <a class="chip post-project" href="/projects/${proj.slug}/">${esc(proj.title)}</a>` : '';
  return shell({
    title: `${fm.title} / Elisha JK Miller`,
    desc: fm.description || '',
    body: `    <div class="post-meta-block">
      <div class="post-meta-date">${fmtLong(post.date)}</div>
      <h1 class="post-meta-title">${esc(fm.title)}</h1>
      <div class="post-meta-desc">${esc(fm.description || '')}</div>${projLink}
    </div>

    <div class="divider"></div>

    <div class="post-body">
${marked.parse(post.content)}    </div>

    <div class="post-footer">
      <a href="/projects/#writing" class="back-link">← all writing</a>
      <a href="/blog/rss.xml" class="rss-pill"><span class="rss-dot"></span>RSS</a>
    </div>`,
  });
}

function projectsIndex(projects, posts, byProject) {
  const count = (slug) => posts.filter((p) => p.project === slug).length;
  const cards = projects.map((p) => {
    const n = count(p.slug);
    const note = n ? `${n} ${n === 1 ? 'post' : 'posts'}` : 'Details';
    return `    <a class="proj" href="/projects/${p.slug}/">
      <div class="proj-top"><div class="proj-cats">${chips(p)}</div>${statusPill(p)}</div>
      <div class="proj-title">${esc(p.title)}</div>
      <div class="proj-tag">${esc(p.tagline || '')}</div>
      <p class="proj-desc">${esc(p.desc || '')}</p>
      <span class="proj-go">${note}<i class="ti ti-arrow-right" aria-hidden="true"></i></span>
    </a>`;
  }).join('\n');

  const list = posts.length
    ? `${catFilters(posts)}\n${posts.map((p) => postItem(p, byProject)).join('\n')}`
    : emptyBlock('Nothing yet.', 'Subscribe to the RSS feed to get notified when something drops.');

  return shell({
    title: 'Projects / Elisha JK Miller',
    desc: 'Open source software, hardware and firmware, and community projects by Elisha JK Miller, with the writing about them.',
    cls: '',
    body: `  <div class="page-title">Projects</div>
  <p class="page-desc">Software, hardware and community work, and what I write about it. Most of it is open source.</p>

  <div class="divider"></div>

  <div class="proj-grid">
${cards}
  </div>

  <div class="section-head" id="writing">Writing <a href="/blog/rss.xml" class="rss-pill"><span class="rss-dot"></span>RSS</a></div>
${list}`,
    scripts: '<script src="/js/filter.js"></script>\n',
  });
}

function projectPage(project, posts, byProject) {
  const mine = posts.filter((p) => p.project === project.slug);
  const link = project.url
    ? `\n    <p class="proj-links"><a class="btn" href="${esc(project.url)}" target="_blank" rel="noopener">${esc(project.go || 'Visit')}<i class="ti ti-arrow-up-right" aria-hidden="true"></i></a></p>`
    : '';
  const list = mine.length
    ? mine.map((p) => postItem(p, byProject)).join('\n')
    : emptyBlock('Nothing written yet.', 'Posts about this project will show up here.');
  return shell({
    title: `${project.title} / Elisha JK Miller`,
    desc: project.tagline || project.desc || '',
    cls: 'mid',
    body: `    <a href="/projects/" class="back-link">← all projects</a>
    <div class="page-title proj-page-title">${esc(project.title)}</div>
    <p class="page-desc">${esc(project.tagline || '')}</p>
    <div class="proj-meta">${chips(project)}${statusPill(project)}</div>

    <div class="divider"></div>

    <div class="post-body">
      <p>${esc(project.desc || '')}</p>
    </div>${link}

    <div class="section-head">Writing</div>
${list}`,
  });
}

function rss(posts) {
  const newest = posts.length ? posts[0].date : new Date('2026-01-01T00:00:00Z');
  const items = posts.map((p) => {
    const url = `${SITE}/blog/posts/${p.slug}.html`;
    return `    <item>
      <title>${escXML(p.fm.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${fmtRFC822(p.date)}</pubDate>
      <description>${escXML(p.fm.description || '')}</description>
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Elisha JK Miller</title>
    <link>${SITE}/projects/</link>
    <description>Thinking out loud on open source, civic tech, and building things that matter.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${fmtRFC822(newest)}</lastBuildDate>

${items}

  </channel>
</rss>
`;
}

// ---------- cleanup ----------

function removeStale(posts, projects) {
  const known = new Set(posts.map((p) => p.slug));
  for (const f of fs.readdirSync(POSTS_OUT).filter((f) => f.endsWith('.html'))) {
    if (!known.has(f.slice(0, -5))) {
      fs.unlinkSync(path.join(POSTS_OUT, f));
      console.log(`  removed blog/posts/${f}`);
    }
  }
  const slugs = new Set(projects.map((p) => p.slug));
  for (const d of fs.readdirSync(PROJECTS_OUT, { withFileTypes: true })) {
    if (d.isDirectory() && !slugs.has(d.name)) {
      fs.rmSync(path.join(PROJECTS_OUT, d.name), { recursive: true });
      console.log(`  removed projects/${d.name}/`);
    }
  }
}

async function main() {
  const projects = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects.json'), 'utf8'));
  const byProject = Object.fromEntries(projects.map((p) => [p.slug, p]));
  fs.mkdirSync(POSTS_OUT, { recursive: true });
  fs.mkdirSync(PROJECTS_OUT, { recursive: true });

  const posts = await gatherPosts(projects);

  for (const post of posts) {
    if (write(path.join(POSTS_OUT, `${post.slug}.html`), postPage(post, byProject))) {
      console.log(`  built  blog/posts/${post.slug}.html`);
    }
  }
  write(path.join(PROJECTS_OUT, 'index.html'), projectsIndex(projects, posts, byProject));
  for (const p of projects) {
    write(path.join(PROJECTS_OUT, p.slug, 'index.html'), projectPage(p, posts, byProject));
  }
  write(RSS_FILE, rss(posts));
  removeStale(posts, projects);
  console.log(`  ${posts.length} posts, ${projects.length} projects`);
}

main().catch((err) => {
  console.error(`build failed: ${err.message}`);
  process.exit(1);
});
