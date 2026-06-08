#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');

const ROOT = path.resolve(__dirname);
const POSTS_DIR = path.join(ROOT, 'blog', 'posts');
const BLOG_INDEX = path.join(ROOT, 'blog', 'index.html');
const MAIN_INDEX = path.join(ROOT, 'index.html');
const RSS_FILE = path.join(ROOT, 'blog', 'rss.xml');

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

function buildPostHTML(fm, bodyHTML) {
  const d = parseDate(fm.date);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(fm.title)} / eliam</title>
  <meta name="description" content="${esc(fm.description || '')}">
  <link rel="alternate" type="application/rss+xml" title="eliam" href="/blog/rss.xml">
  <link rel="stylesheet" href="/css/main.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
</head>
<body>
<div class="layout">
  <aside id="sidebar"></aside>

  <main class="main">
    <div class="post-meta-block">
      <div class="post-meta-date">${fmtLong(d)}</div>
      <h1 class="post-meta-title">${esc(fm.title)}</h1>
      <div class="post-meta-desc">${esc(fm.description || '')}</div>
    </div>

    <div class="divider"></div>

    <div class="post-body">
${bodyHTML}    </div>

    <div class="post-footer">
      <a href="/blog" class="back-link">← all posts</a>
      <a href="/blog/rss.xml" class="rss-pill"><span class="rss-dot"></span>RSS</a>
    </div>
  </main>
</div>
<script src="/components/sidebar.js"></script>
</body>
</html>`;
}

function updateIndex(posts) {
  let html = fs.readFileSync(BLOG_INDEX, 'utf8');

  let replacement;
  if (posts.length === 0) {
    replacement = `<div class="divider"></div>

    <div class="empty-block">
      <div class="empty-title">Nothing yet.</div>
      <div class="empty-sub">Subscribe to the RSS feed to get notified when something drops.</div>
    </div>

  </main>`;
  } else {
    const items = posts.map(({ slug, fm, date }) => {
      const cats = (fm.categories || [])
        .map(c => `<span class="post-cat">${esc(c)}</span>`)
        .join('\n          ');
      return `    <a href="/blog/posts/${slug}.html" class="post-item">
      <div class="post-date">${fmtShort(date)}</div>
      <div class="post-right">
        <div class="post-cats">${cats}</div>
        <div class="post-title">${esc(fm.title)}</div>
        <div class="post-excerpt">${esc(fm.description || '')}</div>
      </div>
    </a>`;
    }).join('\n');
    replacement = `<div class="divider"></div>\n\n${items}\n\n  </main>`;
  }

  html = html.replace(/<div class="divider"><\/div>[\s\S]*<\/main>/, replacement);
  fs.writeFileSync(BLOG_INDEX, html);
  console.log('  updated blog/index.html');
}

function updateMainIndex(posts) {
  let html = fs.readFileSync(MAIN_INDEX, 'utf8');

  let postsBlock;
  if (posts.length === 0) {
    postsBlock = `<div class="empty-block">
      <div class="empty-title">Nothing yet.</div>
      <div class="empty-sub">Subscribe to the RSS feed to get notified when something drops.</div>
    </div>`;
  } else {
    postsBlock = posts.slice(0, 3).map(({ slug, fm, date }) => {
      const cats = (fm.categories || [])
        .map(c => `<span class="post-cat">${esc(c)}</span>`)
        .join('\n          ');
      return `    <a href="/blog/posts/${slug}.html" class="post-item">
      <div class="post-date">${fmtShort(date)}</div>
      <div class="post-right">
        <div class="post-cats">${cats}</div>
        <div class="post-title">${esc(fm.title)}</div>
        <div class="post-excerpt">${esc(fm.description || '')}</div>
      </div>
    </a>`;
    }).join('\n');
  }

  html = html.replace(
    /(<div class="section-head">writing[\s\S]*?<\/div>)\s*[\s\S]*?(\s*<div class="section-head">videos<\/div>)/,
    `$1\n    ${postsBlock}\n$2`
  );

  fs.writeFileSync(MAIN_INDEX, html);
  console.log('  updated index.html');
}

function updateRSS(posts) {
  let xml = fs.readFileSync(RSS_FILE, 'utf8');

  const now = fmtRFC822(new Date());

  const items = posts.map(({ slug, fm, date }) => {
    const url = `https://eliam.net/blog/posts/${slug}.html`;
    return `    <item>
      <title>${escXML(fm.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${fmtRFC822(date)}</pubDate>
      <description>${escXML(fm.description || '')}</description>
    </item>`;
  }).join('\n');

  xml = xml.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/, `<lastBuildDate>${now}</lastBuildDate>`);
  xml = xml.replace(
    /(<lastBuildDate>[^<]*<\/lastBuildDate>)[\s\S]*(<\/channel>)/,
    `$1\n\n${items}\n\n  $2`
  );

  fs.writeFileSync(RSS_FILE, xml);
  console.log('  updated blog/rss.xml');
}

function cleanOrphans(slugs) {
  const known = new Set(slugs);
  const htmlFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.html'));
  for (const f of htmlFiles) {
    const slug = f.slice(0, -5);
    if (!known.has(slug)) {
      fs.unlinkSync(path.join(POSTS_DIR, f));
      console.log(`  removed blog/posts/${f}`);
    }
  }
}

function main() {
  const files = fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  const posts = [];

  for (const filename of files) {
    const slug = filename.slice(0, -3);
    const mdPath = path.join(POSTS_DIR, filename);
    const htmlPath = path.join(POSTS_DIR, slug + '.html');

    const src = fs.readFileSync(mdPath, 'utf8');
    const { data: fm, content } = matter(src);

    if (!fm.title || !fm.date) {
      console.warn(`  warn   ${filename}: missing title or date, skipping`);
      continue;
    }

    const date = parseDate(fm.date);
    posts.push({ slug, fm, date });

    const mdMtime = fs.statSync(mdPath).mtimeMs;
    const htmlMtime = fs.existsSync(htmlPath) ? fs.statSync(htmlPath).mtimeMs : 0;

    if (htmlMtime > mdMtime) {
      console.log(`  skip   blog/posts/${slug}.html`);
    } else {
      const bodyHTML = marked.parse(content);
      fs.writeFileSync(htmlPath, buildPostHTML(fm, bodyHTML));
      console.log(`  built  blog/posts/${slug}.html`);
    }
  }

  posts.sort((a, b) => b.date - a.date);
  cleanOrphans(posts.map(p => p.slug));
  updateIndex(posts);
  updateMainIndex(posts);
  updateRSS(posts);
}

main();
