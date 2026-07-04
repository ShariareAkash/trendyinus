/* TrendyinUS — public site engine.
 * Applies the theme, mounts shared chrome (header / footer / side-nav),
 * and renders post-driven content from the JSON API. */
(function () {
  'use strict';

  var DEFAULT_NAV = [
    { label: 'Live Scores', href: 'live-scores.html' },
    { label: 'World Cup', href: 'world-cup.html' },
    { label: 'Transfers', href: 'transfers.html' },
    { label: 'Leagues', href: 'leagues.html' },
    { label: 'Features', href: 'features.html' },
    { label: 'News', href: 'news.html' },
    { label: 'Podcasts', href: 'podcasts.html' }
  ];
  // Nav comes from Site Settings (Menu builder); falls back to the defaults above.
  function navItems() {
    var src = (settings && settings.nav && settings.nav.length) ? settings.nav : DEFAULT_NAV;
    return src.map(function (n) { return { label: n.label, href: n.href, key: String(n.href || '').replace(/\.html.*$/, '') }; });
  }

  var STATIC_PAGES = {
    about: { title: 'About TrendyinUS', body: '<p>TrendyinUS is a premium football news portal delivering authoritative, energetic and instant coverage of the global game. From the Champions League to the World Cup, our correspondents bring you the stories, tactics and transfers that matter.</p><p>Founded for World Class fans, we combine long-form editorial with breaking-news urgency.</p>' },
    contact: { title: 'Contact Us', body: '<p>Have a tip, a question, or a partnership enquiry? Reach the newsroom at <a class="text-primary font-bold" href="mailto:newsroom@trendyin.us">newsroom@trendyin.us</a>.</p><p>For advertising and media kits, email <a class="text-primary font-bold" href="mailto:ads@trendyin.us">ads@trendyin.us</a>.</p>' },
    privacy: { title: 'Privacy Policy', body: '<p>We respect your privacy. TrendyinUS collects only the information necessary to deliver our newsletter and improve your reading experience. We never sell your personal data.</p><p>This is a demonstration policy for the TrendyinUS portal.</p>' },
    terms: { title: 'Terms of Service', body: '<p>By using TrendyinUS you agree to use the site for lawful, personal, non-commercial purposes. All editorial content is provided for informational purposes.</p><p>This is a demonstration terms-of-service document for the TrendyinUS portal.</p>' }
  };

  var settings = null;
  var pagesList = [];

  /* ---------- utilities ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Allowlist-based sanitizer for stored rich HTML (article/page bodies) so a
  // malicious <script>, event handler, or javascript: URL can't execute on render.
  var ALLOWED_TAGS = { P: 1, BR: 1, HR: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, SMALL: 1, MARK: 1, SUB: 1, SUP: 1, BLOCKQUOTE: 1, CITE: 1, UL: 1, OL: 1, LI: 1, A: 1, IMG: 1, FIGURE: 1, FIGCAPTION: 1, TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TH: 1, TD: 1, CAPTION: 1, COLGROUP: 1, COL: 1, SPAN: 1, DIV: 1, CODE: 1, PRE: 1 };
  var ALLOWED_ATTRS = { href: 1, src: 1, alt: 1, title: 1, class: 1, colspan: 1, rowspan: 1, target: 1, rel: 1, width: 1, height: 1 };
  function sanitizeHTML(html) {
    var doc = new DOMParser().parseFromString('<div id="__root">' + (html || '') + '</div>', 'text/html');
    var root = doc.getElementById('__root');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 8) { n.parentNode.removeChild(n); return; } // comments
        if (n.nodeType !== 1) return;                                   // keep text nodes
        if (!ALLOWED_TAGS[n.tagName]) { n.parentNode.removeChild(n); return; }
        Array.prototype.slice.call(n.attributes).forEach(function (a) {
          var name = a.name.toLowerCase(), val = String(a.value || '').trim();
          if (!ALLOWED_ATTRS[name]) { n.removeAttribute(a.name); return; }
          if ((name === 'href' || name === 'src') && /^\s*(javascript|data:text|vbscript):/i.test(val)) { n.removeAttribute(a.name); }
        });
        walk(n);
      });
    })(root);
    return root.innerHTML;
  }
  function api(p) { return fetch(p, { headers: { 'Accept': 'application/json' } }).then(function (r) { return r.json(); }); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function articleHref(p) { return 'article.html?id=' + p.id; }
  function timeAgo(iso) {
    var d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.round(s / 86400) + 'd ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function fullDate(iso) { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.classList.toggle('dark', t === 'dark');
    try { localStorage.setItem('ti-theme', t); } catch (e) {}
    var btn = el('themeToggle');
    if (btn) btn.querySelector('.material-symbols-outlined').textContent = t === 'dark' ? 'light_mode' : 'dark_mode';
  }
  function currentTheme() { try { return localStorage.getItem('ti-theme') || 'light'; } catch (e) { return 'light'; } }
  // apply ASAP to avoid a flash
  if (currentTheme() === 'dark') document.documentElement.classList.add('dark');

  /* ---------- chrome ---------- */
  function mountHeader(active) {
    var host = el('site-header'); if (!host) return;
    var name = settings.siteName;
    var items = navItems();
    var links = items.map(function (n) {
      var on = n.key === active;
      return '<a class="font-label-sm text-base md:text-lg font-bold ' + (on ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-background') + ' hover:text-primary transition-colors duration-200" href="' + n.href + '">' + esc(n.label) + '</a>';
    }).join('');
    var mlinks = items.map(function (n) { return '<a class="font-label-sm text-base font-bold py-2 ' + (n.key === active ? 'text-primary' : 'text-on-background') + '" href="' + n.href + '">' + esc(n.label) + '</a>'; }).join('');
    host.innerHTML =
      '<header class="bg-background/95 backdrop-blur border-b border-outline-variant sticky top-0 z-50">' +
        '<div class="flex justify-between items-center h-20 px-gutter max-w-container-max mx-auto gap-4">' +
          '<div class="flex items-center gap-gutter">' +
            '<button id="mobileMenuBtn" class="md:hidden p-2 text-on-background"><span class="material-symbols-outlined">menu</span></button>' +
            '<a href="index.html" class="flex items-center shrink-0" title="' + esc(name) + '"><img src="' + esc(settings.logo || '/assets/logo.svg') + '" alt="' + esc(name) + '" class="w-auto" style="height:' + (parseInt(settings.logoHeight, 10) || 44) + 'px"/></a>' +
          '</div>' +
          '<div class="flex items-center gap-6">' +
            '<nav class="hidden md:flex gap-5 lg:gap-7 items-center">' + links + '</nav>' +
            '<div class="hidden lg:flex items-center bg-surface-container rounded-full px-4 py-2 border border-outline-variant">' +
              '<span class="material-symbols-outlined text-on-surface-variant text-sm mr-2">search</span>' +
              '<input id="searchInput" class="bg-transparent border-none focus:ring-0 text-label-sm text-on-surface placeholder:text-on-surface-variant w-40" placeholder="Search football news..." type="text"/>' +
            '</div>' +
            '<button id="themeToggle" title="Toggle theme" class="w-10 h-10 flex items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:text-primary transition-colors"><span class="material-symbols-outlined">dark_mode</span></button>' +
          '</div>' +
        '</div>' +
        '<nav id="mobileNav" class="md:hidden hidden flex-col border-t border-outline-variant px-gutter py-3 bg-background">' + mlinks + '</nav>' +
      '</header>';
    el('themeToggle').addEventListener('click', function () { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark'); });
    el('mobileMenuBtn').addEventListener('click', function () {
      var m = el('mobileNav'); m.classList.toggle('hidden'); m.classList.toggle('flex');
    });
    var si = el('searchInput');
    if (si) si.addEventListener('keydown', function (e) { if (e.key === 'Enter' && si.value.trim()) location.href = 'news.html?q=' + encodeURIComponent(si.value.trim()); });
    applyTheme(currentTheme());
  }

  function mountSideNav(active) {
    var host = el('site-sidenav'); if (!host) return;
    function item(href, icon, title, on) {
      return '<a class="w-10 h-10 flex items-center justify-center rounded-full ' + (on ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container') + ' transition-all duration-300" href="' + href + '" title="' + title + '"><span class="material-symbols-outlined">' + icon + '</span></a>';
    }
    host.innerHTML =
      '<aside class="hidden lg:flex fixed left-6 top-1/2 -translate-y-1/2 flex-col gap-stack-md z-40 bg-card/90 backdrop-blur-md p-3 rounded-full border border-outline-variant shadow-xl">' +
        item('index.html', 'home', 'Home', active === 'home') +
        item('live-scores.html', 'sports_soccer', 'Live Scores', active === 'live-scores') +
        item('world-cup.html', 'emoji_events', 'World Cup Hub', active === 'world-cup') +
        item('admin.html', 'settings', 'Admin', false) +
      '</aside>';
  }

  function mountFooter() {
    var host = el('site-footer'); if (!host) return;
    var name = settings.siteName, year = new Date().getFullYear();
    function col(title, items) {
      return '<div class="space-y-4"><h5 class="text-label-sm font-black uppercase text-on-background tracking-widest">' + title + '</h5><ul class="space-y-2 text-on-surface-variant font-label-sm">' +
        items.map(function (i) { return '<li><a class="hover:text-primary hover:underline transition-colors" href="' + i[1] + '">' + i[0] + '</a></li>'; }).join('') + '</ul></div>';
    }
    // Footer menu mirrors the live site nav; the pages column is built only
    // from pages that actually exist (deleted pages/links never linger).
    var menuCol = navItems().map(function (n) { return [n.label, n.href]; });
    var footerPages = pagesList.filter(function (p) { return p.showInFooter; });
    var pagesCol = footerPages.map(function (p) { return [p.title, 'page.html?p=' + p.slug]; });
    var bottomLinks = footerPages.map(function (p) { return '<a class="text-on-surface-variant font-label-sm hover:text-primary" href="page.html?p=' + esc(p.slug) + '">' + esc(p.title) + '</a>'; }).join('');
    host.innerHTML =
      '<footer class="bg-surface-container-low border-t border-outline-variant w-full mt-stack-lg">' +
        '<div class="max-w-container-max mx-auto px-gutter py-stack-lg">' +
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-gutter py-stack-lg">' +
            '<div class="col-span-2"><a href="index.html" class="inline-flex"><img src="' + esc(settings.logo || '/assets/logo.svg') + '" alt="' + esc(name) + '" class="h-10 w-auto"/></a><p class="mt-4 text-on-surface-variant text-body-md max-w-sm">' + esc(settings.footerAbout || settings.tagline) + '</p></div>' +
            col('Menu', menuCol) +
            (pagesCol.length ? col('Information', pagesCol) : '') +
          '</div>' +
          '<div class="border-t border-outline-variant pt-stack-md mt-stack-md flex flex-col md:flex-row justify-between items-center gap-4">' +
            '<p class="text-on-surface-variant font-label-sm">&copy; ' + year + ' ' + esc(name) + '. All Rights Reserved. FIFA World Cup Coverage.</p>' +
            (bottomLinks ? '<div class="flex gap-stack-md flex-wrap">' + bottomLinks + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  /* ---------- card templates ---------- */
  function heroCard(p) {
    return '<a href="' + articleHref(p) + '" class="group relative overflow-hidden rounded-xl bg-card border border-outline-variant block h-full fadein">' +
      '<div class="relative aspect-video lg:aspect-auto lg:h-[600px] overflow-hidden"><img class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="' + esc(p.image) + '" alt=""/><div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div></div>' +
      '<div class="absolute bottom-0 left-0 p-stack-lg w-full">' +
        '<div class="flex items-center gap-3 mb-4"><img class="w-10 h-10 rounded-full border border-primary object-cover" src="' + esc(p.authorAvatar) + '" alt=""/><div><p class="text-label-sm font-bold text-white">' + esc(p.author) + '</p><p class="text-[10px] text-white/70 uppercase tracking-widest">' + esc(p.authorRole || '') + '</p></div></div>' +
        '<h1 class="font-headline-xl text-headline-xl text-white mb-4 group-hover:text-primary transition-colors">' + esc(p.title) + '</h1>' +
        '<div class="flex items-center gap-4"><span class="text-primary font-bold text-label-sm">' + esc(p.category) + '</span><span class="text-white/70 text-label-sm">&bull; ' + p.readTime + ' minute read</span></div>' +
      '</div></a>';
  }
  function sideStory(p) {
    return '<a href="' + articleHref(p) + '" class="flex-1 bg-card rounded-xl p-4 border border-outline-variant hover:border-primary/50 transition-colors shadow-sm block fadein"><div class="flex gap-4"><div class="flex-1">' +
      '<h3 class="font-headline-md text-on-surface mb-2 leading-tight">' + esc(p.title) + '</h3>' +
      '<p class="text-body-md text-on-surface-variant line-clamp-2 mb-3">' + esc(p.excerpt) + '</p>' +
      '<span class="text-primary font-bold text-label-sm">' + esc(p.category) + ' &bull; ' + p.readTime + ' min read</span></div>' +
      '<div class="w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-outline-variant"><img class="w-full h-full object-cover" src="' + esc(p.image) + '" alt=""/></div></div></a>';
  }
  function highlightCard(p) {
    return '<a href="' + articleHref(p) + '" class="relative group h-96 rounded-xl overflow-hidden border border-outline-variant shadow-sm block fadein"><img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="' + esc(p.image) + '" alt=""/><div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div><div class="absolute bottom-0 left-0 p-6"><span class="text-primary font-bold text-label-sm mb-2 block">' + esc(p.category) + '</span><h2 class="font-headline-lg text-white">' + esc(p.title) + '</h2></div></a>';
  }
  function newsCard(p) {
    return '<a href="' + articleHref(p) + '" class="group bento-card block bg-card rounded-xl overflow-hidden border border-outline-variant hover:shadow-lg transition-all duration-300 fadein">' +
      '<div class="h-48 overflow-hidden"><img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="' + esc(p.image) + '" alt=""/></div>' +
      '<div class="p-4"><div class="flex items-center gap-2 mb-3"><img class="w-6 h-6 rounded-full object-cover" src="' + esc(p.authorAvatar) + '" alt=""/><span class="text-[10px] text-on-surface-variant font-bold uppercase">' + esc(p.author) + ' &bull; ' + timeAgo(p.date) + '</span></div>' +
      '<h4 class="font-headline-md text-on-surface mb-3 group-hover:text-primary transition-colors">' + esc(p.title) + '</h4>' +
      '<span class="text-primary font-bold text-label-sm">' + esc(p.category) + ' | ' + p.readTime + ' min read</span></div></a>';
  }
  function trendingItem(p) {
    return '<a href="' + articleHref(p) + '" class="flex gap-4 group cursor-pointer block fadein"><div class="flex-grow"><h4 class="font-body-md font-bold text-on-surface group-hover:text-primary transition-colors leading-tight mb-2">' + esc(p.title) + '</h4><div class="flex gap-3 font-label-sm text-xs text-on-surface-variant"><span class="text-primary font-bold">' + esc(p.category) + '</span><span>' + p.readTime + ' min read</span></div></div><div class="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant"><img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="' + esc(p.image) + '" alt=""/></div></a>';
  }
  function moreCard(p) {
    return '<a href="' + articleHref(p) + '" class="group cursor-pointer block fadein"><div class="aspect-[4/3] rounded-xl overflow-hidden border border-outline-variant mb-3 relative shadow-sm"><img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="' + esc(p.image) + '" alt=""/><div class="absolute top-3 left-3 bg-card/90 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-primary uppercase tracking-widest border border-outline-variant">' + esc(p.category) + '</div></div><h4 class="font-body-md font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 mb-2">' + esc(p.title) + '</h4><div class="flex items-center gap-3"><img class="w-6 h-6 rounded-full border border-outline-variant object-cover" src="' + esc(p.authorAvatar) + '" alt=""/><span class="font-label-sm text-[11px] text-on-surface-variant">' + esc(p.author) + ' &bull; ' + p.readTime + ' min read</span></div></a>';
  }

  /* ---------- breaking bar ---------- */
  function mountBreaking() {
    var host = el('breaking'); if (!host) return;
    if (settings.breakingEnabled === false) { host.innerHTML = ''; return; }
    // Scrolling ticker of the latest posts (plus the manual breaking text, if set).
    api('/api/posts?limit=15').then(function (posts) {
      posts = posts || [];
      var parts = [];
      if (settings.breaking) parts.push('<span class="ticker-item font-bold text-error">' + esc(settings.breaking) + '</span>');
      posts.forEach(function (p) {
        parts.push('<a href="' + articleHref(p) + '" class="ticker-item"><span class="text-primary font-bold">' + esc(p.category) + '</span> <span class="text-on-surface">' + esc(p.title) + '</span></a>');
      });
      if (!parts.length) { host.innerHTML = ''; return; }
      var seq = parts.join('<span class="ticker-sep">•</span>');
      host.innerHTML = '<div class="mb-stack-lg flex items-stretch gap-0 bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">' +
        '<span class="flex items-center gap-2 bg-error text-on-error text-xs font-black uppercase px-4 rounded-l-lg shrink-0 z-10"><span class="w-2 h-2 rounded-full bg-white pulse-dot"></span> Breaking</span>' +
        '<div class="ticker-wrap flex-1"><div class="ticker-track">' + seq + '<span class="ticker-sep">•</span>' + seq + '<span class="ticker-sep">•</span></div></div>' +
        '</div>';
    }).catch(function () { host.innerHTML = ''; });
  }

  /* ---------- page renderers ---------- */
  function renderHome(posts) {
    if (!posts.length) {
      if (el('hero')) el('hero').innerHTML = '<div class="bg-card border border-dashed border-outline-variant rounded-xl p-12 text-center text-on-surface-variant">No stories have been published yet. Add posts from the admin panel.</div>';
      ['side-stories', 'highlights', 'news-grid'].forEach(function (id) { if (el(id)) el(id).innerHTML = ''; });
      return;
    }
    var featured = posts.filter(function (p) { return p.featured; })[0] || posts[0];
    var rest = posts.filter(function (p) { return p !== featured; });
    var side = posts.filter(function (p) { return p.trending && p !== featured; }).slice(0, 3);
    if (side.length < 3) side = rest.slice(0, 3);
    var highlights = posts.filter(function (p) { return p.highlight; }).slice(0, 2);
    if (highlights.length < 2) highlights = rest.slice(3, 5);
    var grid = rest.filter(function (p) { return side.indexOf(p) === -1 && highlights.indexOf(p) === -1; }).slice(0, 4);

    if (el('hero')) el('hero').innerHTML = heroCard(featured);
    if (el('side-stories')) el('side-stories').innerHTML = side.map(sideStory).join('');
    if (el('highlights')) el('highlights').innerHTML = highlights.map(highlightCard).join('');
    if (el('news-grid')) el('news-grid').innerHTML = grid.map(newsCard).join('');
  }

  function renderSection(page, posts) {
    var q = (qs('q') || '').toLowerCase();
    var list = posts;
    if (page.section) list = posts.filter(function (p) { return p.section === page.section; });
    if (q) list = posts.filter(function (p) { return (p.title + ' ' + p.category + ' ' + p.excerpt).toLowerCase().indexOf(q) !== -1; });
    if (el('section-title')) el('section-title').textContent = q ? 'Search: "' + q + '"' : page.title;
    if (el('section-subtitle')) el('section-subtitle').textContent = page.subtitle || '';
    var host = el('section-grid');
    if (!host) return;
    if (!list.length) { host.innerHTML = '<p class="col-span-full text-on-surface-variant font-body-md py-stack-lg">No stories here yet. Check back soon.</p>'; return; }
    host.innerHTML = list.map(moreCard).join('');
  }

  function renderArticle(posts) {
    var id = parseInt(qs('id'), 10);
    var post = posts.filter(function (p) { return p.id === id; })[0] || posts.filter(function (p) { return p.section === 'leagues'; })[0] || posts[0];
    var set = function (idn, html) { var n = el(idn); if (n) n.innerHTML = html; };
    if (!post) {
      if (el('a-title')) el('a-title').textContent = 'Article not found';
      set('a-body', '<p class="text-on-surface-variant">This article is unavailable or has been removed.</p>');
      return;
    }
    document.title = post.title + ' — ' + settings.siteName;
    set('a-category', esc(post.category));
    set('a-meta', post.readTime + ' minute read &nbsp;&bull;&nbsp; ' + fullDate(post.date));
    set('a-title', esc(post.title));
    var img = el('a-image'); if (img) img.src = post.image;
    set('a-caption', esc(post.caption || (post.author + ' reports for TrendyinUS.')));
    var av = el('a-avatar'); if (av) av.src = post.authorAvatar;
    set('a-author', esc(post.author));
    set('a-author-role', esc(post.authorRole || 'TrendyinUS'));
    set('a-body', sanitizeHTML(post.body || ('<p>' + esc(post.excerpt) + '</p>')));
    var tags = (post.tags && post.tags.length) ? post.tags : ['#' + post.section, '#Football'];
    set('a-tags', tags.map(function (t) { return '<span class="bg-surface-container px-3 py-1 rounded font-label-sm text-on-surface-variant">' + esc(t) + '</span>'; }).join(''));

    // live match widget
    var lm = settings.liveMatch || {};
    set('a-live-home', esc(lm.home || '')); set('a-live-away', esc(lm.away || ''));
    set('a-live-home-score', esc(lm.homeScore || '')); set('a-live-away-score', esc(lm.awayScore || ''));
    set('a-live-status', esc(lm.status || ''));

    // trending + more
    var trending = posts.filter(function (p) { return p.trending && p.id !== post.id; }).slice(0, 3);
    if (trending.length < 3) trending = posts.filter(function (p) { return p.id !== post.id; }).slice(0, 3);
    set('a-trending', trending.map(trendingItem).join(''));
    var more = posts.filter(function (p) { return p.id !== post.id; }).slice(0, 4);
    set('a-more', more.map(moreCard).join(''));
  }

  function renderStatic(slug) {
    return api('/api/pages/' + encodeURIComponent(slug)).then(function (pg) {
      if (!pg || pg.error) pg = STATIC_PAGES[slug] || STATIC_PAGES.about;
      if (el('static-title')) el('static-title').textContent = pg.title;
      if (el('static-body')) el('static-body').innerHTML = sanitizeHTML(pg.body);
      document.title = pg.title + ' — ' + settings.siteName;
    });
  }

  /* ---------- live scores ---------- */
  function crest(url, name, cls) {
    return url ? '<img src="' + esc(url) + '" class="' + cls + ' object-contain" alt="" loading="lazy"/>'
      : '<div class="' + cls + ' rounded-full bg-surface-container flex items-center justify-center font-bold text-on-surface-variant">' + esc((name || '?').slice(0, 1)) + '</div>';
  }
  function liveLabel(m) { return m.progress ? ('LIVE ' + m.progress) : (m.status || 'LIVE'); }
  function scorerList(list, right) {
    if (!list || !list.length) return '';
    return '<div class="space-y-1 ' + (right ? 'text-right' : '') + '">' + list.map(function (s) {
      var ball = '<span class="material-symbols-outlined text-[15px] text-primary">sports_soccer</span>';
      return '<div class="text-xs md:text-sm text-on-surface-variant flex items-center gap-1.5 ' + (right ? 'justify-end' : '') + '">' + (right ? '' : ball) + '<span>' + esc(s) + '</span>' + (right ? ball : '') + '</div>';
    }).join('') + '</div>';
  }
  function liveCard(m) {
    var hasScorers = (m.homeScorers && m.homeScorers.length) || (m.awayScorers && m.awayScorers.length);
    return '<div class="bg-card rounded-2xl border border-outline-variant p-6 md:p-10 shadow-sm fadein">' +
      '<div class="flex items-center justify-between mb-6 md:mb-8 gap-2">' +
        '<span class="text-label-sm md:text-sm font-bold text-on-surface-variant uppercase tracking-wide truncate">' + esc(m.league) + '</span>' +
        '<span class="flex items-center gap-1.5 bg-error/10 text-error px-3 py-1.5 rounded-full text-xs md:text-sm font-black uppercase shrink-0"><span class="w-2.5 h-2.5 bg-error rounded-full pulse-dot"></span>' + esc(liveLabel(m)) + '</span>' +
      '</div>' +
      '<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-12">' +
        '<div class="flex flex-col items-center gap-3 text-center min-w-0">' + crest(m.homeBadge, m.home, 'w-16 h-16 md:w-28 md:h-28') + '<span class="font-headline-md font-bold text-xl md:text-4xl text-on-surface leading-tight">' + esc(m.home) + '</span></div>' +
        '<div class="text-center px-1"><div class="font-headline-md font-black text-6xl md:text-8xl leading-none text-on-surface tabular-nums">' + esc(m.homeScore || '0') + '<span class="text-on-surface-variant/40 mx-3 md:mx-6">-</span>' + esc(m.awayScore || '0') + '</div></div>' +
        '<div class="flex flex-col items-center gap-3 text-center min-w-0">' + crest(m.awayBadge, m.away, 'w-16 h-16 md:w-28 md:h-28') + '<span class="font-headline-md font-bold text-xl md:text-4xl text-on-surface leading-tight">' + esc(m.away) + '</span></div>' +
      '</div>' +
      (hasScorers ? '<div class="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-outline-variant"><div>' + scorerList(m.homeScorers, false) + '</div><div>' + scorerList(m.awayScorers, true) + '</div></div>' : '') +
      '</div>';
  }
  function upcomingRow(m) {
    var d = m.kickoff ? new Date(m.kickoff) : null;
    return '<div class="bg-card rounded-xl border border-outline-variant p-4 flex items-center gap-3 fadein">' +
      '<div class="text-center w-16 sm:w-20 shrink-0"><div class="text-primary font-black text-base sm:text-lg leading-none">' + (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD') + '</div><div class="text-[10px] sm:text-[11px] text-on-surface-variant uppercase">' + (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '') + '</div></div>' +
      '<div class="flex-1 flex items-center justify-end gap-2 min-w-0"><span class="font-bold text-on-surface truncate text-right">' + esc(m.home) + '</span>' + crest(m.homeBadge, m.home, 'w-7 h-7') + '</div>' +
      '<span class="text-xs font-bold text-on-surface-variant px-1 shrink-0">vs</span>' +
      '<div class="flex-1 flex items-center gap-2 min-w-0">' + crest(m.awayBadge, m.away, 'w-7 h-7') + '<span class="font-bold text-on-surface truncate">' + esc(m.away) + '</span></div>' +
      '<span class="hidden lg:block text-[11px] text-on-surface-variant uppercase tracking-wide w-36 truncate text-right shrink-0">' + esc(m.league) + '</span>' +
      '</div>';
  }
  function resultCard(m) {
    return '<div class="bg-card rounded-xl border border-outline-variant p-4 flex items-center gap-3 fadein">' +
      '<div class="flex-1 flex items-center justify-end gap-2 min-w-0"><span class="font-bold text-on-surface truncate text-right">' + esc(m.home) + '</span>' + crest(m.homeBadge, m.home, 'w-7 h-7') + '</div>' +
      '<div class="px-3 text-center shrink-0"><div class="font-headline-md font-black text-xl text-on-surface">' + esc(m.homeScore || '0') + ' - ' + esc(m.awayScore || '0') + '</div><div class="text-[10px] font-bold text-on-surface-variant uppercase">' + esc(m.status || 'FT') + '</div></div>' +
      '<div class="flex-1 flex items-center gap-2 min-w-0">' + crest(m.awayBadge, m.away, 'w-7 h-7') + '<span class="font-bold text-on-surface truncate">' + esc(m.away) + '</span></div>' +
      '</div>';
  }
  function lsEmpty(t) { return '<div class="col-span-full bg-card border border-dashed border-outline-variant rounded-xl p-8 text-center text-on-surface-variant">' + esc(t) + '</div>'; }
  var lsTimer = null, lsLoading = false;
  function renderLiveScores() {
    if (lsLoading) return; lsLoading = true;
    api('/api/livescores').then(function (d) {
      d = d || {};
      if (el('ls-updated')) el('ls-updated').textContent = 'Updated ' + new Date(d.updated || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (el('ls-live')) el('ls-live').innerHTML = (d.live && d.live.length) ? d.live.map(liveCard).join('') : lsEmpty('No matches are live right now — see the upcoming fixtures below.');
      if (el('ls-upcoming')) el('ls-upcoming').innerHTML = (d.upcoming && d.upcoming.length) ? d.upcoming.map(upcomingRow).join('') : lsEmpty('No upcoming games scheduled at the moment.');
      if (el('ls-results')) el('ls-results').innerHTML = (d.results && d.results.length) ? d.results.map(resultCard).join('') : lsEmpty('No recent results to show.');
    }).catch(function () {}).then(function () { lsLoading = false; });
  }

  function injectFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    var l = document.createElement('link');
    l.rel = 'icon'; l.type = 'image/svg+xml'; l.href = '/assets/favicon.svg';
    document.head.appendChild(l);
  }

  /* ---------- public helpers ---------- */
  window.TI = {
    subscribe: function (e) { e.preventDefault(); e.target.reset(); alert('Thanks for subscribing to TrendyinUS!'); return false; }
  };

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    injectFavicon();
    var page = window.TI_PAGE || { type: 'home' };
    Promise.all([api('/api/settings'), api('/api/pages').catch(function () { return []; })]).then(function (r) {
      settings = r[0] || {};
      pagesList = r[1] || [];
      if (settings.favicon) { var fav = document.querySelector('link[rel="icon"]'); if (fav) { fav.href = settings.favicon; fav.type = /\.svg$/i.test(settings.favicon) ? 'image/svg+xml' : ''; } }
      mountHeader(page.active || page.section || (page.type === 'home' ? 'home' : ''));
      mountSideNav(page.active || (page.type === 'home' ? 'home' : page.section) || '');
      mountFooter();
      mountBreaking();
      if (page.type === 'static') { return renderStatic(qs('p') || 'about'); }
      if (page.type === 'livescores') {
        renderLiveScores();
        var rb = el('ls-refresh'); if (rb) rb.addEventListener('click', renderLiveScores);
        if (lsTimer) clearInterval(lsTimer); lsTimer = setInterval(renderLiveScores, 60000);
        return;
      }
      return api('/api/posts').then(function (posts) {
        posts = posts || [];
        if (page.type === 'home') renderHome(posts);
        else if (page.type === 'section') renderSection(page, posts);
        else if (page.type === 'article') renderArticle(posts);
      });
    }).catch(function (err) { console.error('TrendyinUS load error', err); });
  });
})();
