// eliam.net — shared sidebar
// Edit this file once and all pages update automatically.

(function () {
  const currentPath = window.location.pathname;

  function isActive(href) {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  }

  function link(href, label) {
    const active = isActive(href) ? ' active' : '';
    return `<a href="${href}" class="nav-link${active}">${label}</a>`;
  }

  const html = `
    <div class="sidebar-inner">
      <a href="/" class="sidebar-avatar-link">
        <img src="https://github.com/elishajkmiller.png" alt="eliam" class="sidebar-avatar">
      </a>

      <div class="nav-section">
        <div class="nav-label">pages</div>
        ${link('/', 'home')}
        ${link('/blog', 'writing')}
        ${link('/about', 'about me')}
      </div>

      <div class="nav-section">
        <div class="nav-label">projects</div>
        <a href="https://github.com/elishajkmiller/ROBIN" class="nav-link" target="_blank">Robin</a>
        <a href="https://pow417.com" class="nav-link" target="_blank">POW417</a>
        <a href="/projects/kei-truck" class="nav-link">kei truck EV</a>
        <a href="https://github.com/elishajkmiller" class="nav-link" target="_blank">Creds</a>
      </div>

      <div class="nav-section">
        <div class="nav-label">links</div>
        <div class="social-links">
          <a href="https://github.com/elishajkmiller" class="social-link" target="_blank">
            <i class="ti ti-brand-github" aria-hidden="true"></i>GitHub
          </a>
          <a href="https://mastodon.social/@Eli_M" class="social-link" target="_blank">
            <i class="ti ti-brand-mastodon" aria-hidden="true"></i>Mastodon
          </a>
          <a href="#" class="social-link">
            <i class="ti ti-brand-bluesky" aria-hidden="true"></i>Bluesky
          </a>
          <a href="#" class="social-link">
            <i class="ti ti-video" aria-hidden="true"></i>MakerTube
          </a>
          <a href="mailto:emiller2@cssmo.org" class="social-link">
            <i class="ti ti-mail" aria-hidden="true"></i>email
          </a>
        </div>
      </div>

      <div class="sidebar-note">
        Joplin, MO<br>
        no trackers &middot; no ads
      </div>
    </div>
  `;

  const el = document.getElementById('sidebar');
  if (el) el.innerHTML = html;
})();
