// elishajkmiller.com: shared top tabs and footer.
// Edit this file once and all pages update automatically.

(function () {
  var path = window.location.pathname;

  var TABS = [
    ['/', 'Card'],
    ['/projects/', 'Projects'],
    ['/blog/', 'Writing'],
    ['/about', 'About'],
    ['/data-policy/', 'Data policy']
  ];

  function isActive(href) {
    if (href === '/') return path === '/' || path === '/index.html';
    return path.indexOf(href.replace(/\/$/, '')) === 0;
  }

  var tabs = TABS.map(function (t) {
    var on = isActive(t[0]);
    return '<a href="' + t[0] + '" class="tab' + (on ? ' active' : '') + '"' +
      (on ? ' aria-current="page"' : '') + '>' + t[1] + '</a>';
  }).join('');

  var top = document.getElementById('topbar');
  if (top) {
    top.className = 'topbar';
    top.innerHTML =
      '<div class="topbar-in">' +
        '<a href="/" class="brand">' +
          '<img src="https://github.com/elishajkmiller.png" alt="" width="32" height="32">' +
          '<span>Elisha JK Miller</span>' +
        '</a>' +
        '<nav class="tabs" aria-label="Main">' + tabs + '</nav>' +
      '</div>';
  }

  var foot = document.getElementById('foot');
  if (foot) {
    foot.className = 'foot';
    foot.innerHTML =
      '<div class="foot-in">' +
        '<div class="foot-row">' +
          '<div class="foot-links">' +
            '<a href="https://github.com/elishajkmiller" target="_blank" rel="noopener"><i class="ti ti-brand-github" aria-hidden="true"></i>GitHub</a>' +
            '<a href="mailto:elishajkmiller@proton.me"><i class="ti ti-mail" aria-hidden="true"></i>Email</a>' +
            '<a href="/blog/rss.xml"><i class="ti ti-rss" aria-hidden="true"></i>RSS</a>' +
          '</div>' +
          '<div class="foot-note">Joplin, MO &middot; no trackers &middot; no ads</div>' +
        '</div>' +
        '<p class="disclaimer">My opinions are my own and do not reflect those of my current employer.</p>' +
      '</div>';
  }
})();
