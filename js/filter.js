(function () {
  document.querySelectorAll('.cat-filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.cat-filter').forEach(function (b) {
        b.classList.remove('active');
      });
      this.classList.add('active');
      var cat = this.dataset.cat;
      document.querySelectorAll('.post-item[data-cats]').forEach(function (item) {
        var cats = item.dataset.cats ? item.dataset.cats.split(',') : [];
        item.style.display = (cat === 'all' || cats.indexOf(cat) !== -1) ? '' : 'none';
      });
    });
  });
})();
