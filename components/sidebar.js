// elishajkmiller.com — shared sidebar
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
        <img src="https://github.com/elishajkmiller.png" alt="Elisha JK Miller" class="sidebar-avatar">
      </a>

      <div class="nav-section">
        <div class="nav-label">pages</div>
        ${link('/', 'home')}
        ${link('/blog', 'writing')}
        ${link('/about', 'about me')}
        ${link('/ai', 'AI policy')}
        ${link('/card', 'card')}
      </div>

      <div class="nav-section">
        <div class="nav-label">projects</div>
        <a href="https://github.com/elishajkmiller/ROBIN" class="nav-link" target="_blank">Robin</a>
        <a href="https://pow417.com" class="nav-link" target="_blank">POW417</a>
        <a href="https://github.com/elishajkmiller/tdeck-pro-nav" class="nav-link" target="_blank">T-Deck Pro</a>
        <a href="https://github.com/elishajkmiller/watchy-firmware" class="nav-link" target="_blank">Watchy</a>
      </div>

      <div class="nav-section">
        <div class="nav-label">links</div>
        <div class="social-links">
          <a href="https://github.com/elishajkmiller" class="social-link" target="_blank">
            <i class="ti ti-brand-github" aria-hidden="true"></i>GitHub
          </a>
          <a href="mailto:elishajkmiller@proton.me" class="social-link">
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

  // site-wide disclaimer at the bottom of every page's main column
  const main = document.querySelector('.main');
  if (main) {
    const note = document.createElement('p');
    note.className = 'disclaimer';
    note.textContent = 'My opinions are my own and do not reflect those of my current employer.';
    main.appendChild(note);
  }
})();
