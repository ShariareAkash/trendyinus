/* TrendyinUS — WordPress-style admin console. */
(function () {
  'use strict';
  var TOKEN_KEY = 'ti-admin-token';
  var token = null; try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
  function deviceId() {
    try {
      var d = localStorage.getItem('ti-device-id');
      if (!d) { d = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(16).slice(2)); localStorage.setItem('ti-device-id', d); }
      return d;
    } catch (e) { return 'nodevice'; }
  }
  var posts = [], categories = [], pages = [], media = [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var TITLES = { dashboard: 'Dashboard', posts: 'Posts', editor: 'Edit Post', categories: 'Categories', pages: 'Pages', 'page-editor': 'Edit Page', media: 'Media Library', menu: 'Navigation Menu', settings: 'Settings', account: 'Account' };
  var settingsCache = {};

  /* ---- theme ---- */
  function theme() { try { return localStorage.getItem('ti-theme') || 'light'; } catch (e) { return 'light'; } }
  function applyTheme(t) {
    document.documentElement.classList.toggle('dark', t === 'dark');
    try { localStorage.setItem('ti-theme', t); } catch (e) {}
    var b = $('#admin-theme'); if (b) b.querySelector('.material-symbols-outlined').textContent = t === 'dark' ? 'light_mode' : 'dark_mode';
  }
  if (theme() === 'dark') document.documentElement.classList.add('dark');

  /* ---- api ---- */
  function api(method, path, body) {
    var opt = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (token) opt.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) opt.body = JSON.stringify(body);
    return fetch(path, opt).then(function (r) {
      if (r.status === 401 && path !== '/api/login') { logout(); throw new Error('Unauthorized'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Request failed'); return j; });
    });
  }
  function uploadFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { api('POST', '/api/upload', { dataUrl: reader.result }).then(function (r) { resolve(r.url); }).catch(reject); };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  /* ---- auth ---- */
  function showLogin() { $('#login-view').classList.remove('hidden'); $('#admin-view').classList.add('hidden'); }
  function showApp() {
    $('#login-view').classList.add('hidden'); $('#admin-view').classList.remove('hidden'); applyTheme(theme());
    api('GET', '/api/me').then(function (m) { $('#whoami').textContent = m.username || 'admin'; });
    Promise.all([loadPosts(), loadCategories(), loadPages()]).then(renderDashboard);
    loadSettings(); loadAccount();
    show('dashboard');
  }
  function logout() {
    if (token) fetch('/api/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
    token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    showLogin();
  }
  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#login-error'); err.classList.add('hidden');
    api('POST', '/api/login', { username: $('#login-user').value, password: $('#login-pass').value, deviceId: deviceId() })
      .then(function (res) { token = res.token; try { localStorage.setItem(TOKEN_KEY, token); } catch (x) {} showApp(); })
      .catch(function (x) { err.textContent = x.message; err.classList.remove('hidden'); });
  });
  $('#logout-btn').addEventListener('click', logout);
  $('#admin-theme').addEventListener('click', function () { applyTheme(theme() === 'dark' ? 'light' : 'dark'); });

  /* ---- navigation ---- */
  function show(screen, title) {
    $$('[data-panel]').forEach(function (p) { p.classList.toggle('hidden', p.dataset.panel !== screen); });
    $$('.wp-item').forEach(function (i) { i.classList.toggle('active', i.dataset.screen === screen); });
    $('#screen-title').textContent = title || TITLES[screen] || screen;
    closeSidebar();
    window.scrollTo(0, 0);
  }
  $$('.wp-item[data-screen]').forEach(function (item) {
    item.addEventListener('click', function () {
      var s = item.dataset.screen;
      if (s === 'editor' && item.dataset.new) return openPostEditor(null);
      if (s === 'posts') loadPosts().then(renderPosts);
      if (s === 'categories') { loadCategories().then(renderCategories); resetCatForm(); }
      if (s === 'pages') loadPages().then(renderPages);
      if (s === 'media') loadMedia().then(renderMedia);
      if (s === 'menu') renderMenu();
      show(s);
    });
  });
  $$('.dash-link').forEach(function (b) { b.addEventListener('click', function () { var s = b.dataset.goto; if (s === 'categories') loadCategories().then(renderCategories); if (s === 'pages') loadPages().then(renderPages); show(s); }); });
  $$('.quick-new').forEach(function (b) { b.addEventListener('click', function () { openPostEditor(null); }); });

  /* ---- sidebar (mobile) ---- */
  function openSidebar() { $('#wp-sidebar').classList.remove('-translate-x-full'); $('#sidebar-scrim').classList.remove('hidden'); }
  function closeSidebar() { if (window.innerWidth < 1024) { $('#wp-sidebar').classList.add('-translate-x-full'); $('#sidebar-scrim').classList.add('hidden'); } }
  $('#sidebar-toggle').addEventListener('click', openSidebar);
  $('#sidebar-scrim').addEventListener('click', closeSidebar);

  /* ---- data loaders ---- */
  function loadPosts() { return api('GET', '/api/posts').then(function (l) { posts = l; return l; }); }
  function loadCategories() { return api('GET', '/api/categories').then(function (l) { categories = l; return l; }); }
  function loadPages() { return api('GET', '/api/pages').then(function (l) { pages = l; return l; }); }
  function loadMedia() { return api('GET', '/api/media').then(function (l) { media = l; return l; }); }

  /* ---- dashboard ---- */
  function renderDashboard() {
    var cards = [
      ['Posts', posts.length, 'push_pin', 'posts'],
      ['Categories', categories.length, 'sell', 'categories'],
      ['Pages', pages.length, 'description', 'pages'],
      ['Media', '—', 'photo_library', 'media']
    ];
    $('#dash-stats').innerHTML = cards.map(function (c) {
      return '<button data-goto="' + c[3] + '" class="dash-stat wp-box p-4 text-left hover:border-primary transition"><div class="flex items-center justify-between"><span class="material-symbols-outlined text-primary">' + c[2] + '</span><span class="text-3xl font-headline-md font-bold text-on-background">' + c[1] + '</span></div><p class="text-on-surface-variant text-sm mt-1">' + c[0] + '</p></button>';
    }).join('');
    $$('#dash-stats .dash-stat').forEach(function (b) { b.addEventListener('click', function () { var s = b.dataset.goto; if (s === 'posts') loadPosts().then(renderPosts); if (s === 'categories') loadCategories().then(renderCategories); if (s === 'pages') loadPages().then(renderPages); if (s === 'media') loadMedia().then(renderMedia); show(s); }); });
    var recent = posts.slice(0, 6);
    $('#dash-recent').innerHTML = recent.map(function (p) {
      return '<div class="flex items-center gap-3 p-3 hover:bg-surface-container/40 cursor-pointer" data-edit="' + p.id + '"><img src="' + esc(p.image) + '" class="w-10 h-10 rounded object-cover border border-outline-variant"/><div class="min-w-0"><p class="font-bold text-on-surface truncate">' + esc(p.title) + '</p><p class="text-xs text-on-surface-variant">' + esc(p.category) + ' • ' + new Date(p.date).toLocaleDateString() + '</p></div></div>';
    }).join('');
    $$('#dash-recent [data-edit]').forEach(function (r) { r.addEventListener('click', function () { openPostEditor(byId(posts, r.dataset.edit)); }); });
  }
  function byId(arr, id) { id = parseInt(id, 10); return arr.filter(function (x) { return x.id === id; })[0]; }

  /* ---- posts list ---- */
  function renderPosts() {
    var q = ($('#posts-search').value || '').toLowerCase();
    var list = posts.filter(function (p) { return !q || (p.title + ' ' + p.category + ' ' + p.author + ' ' + p.section).toLowerCase().indexOf(q) !== -1; });
    if (!list.length) { $('#posts-list').innerHTML = '<div class="p-8 text-center text-on-surface-variant">No posts found.</div>'; return; }
    $('#posts-list').innerHTML = list.map(function (p) {
      var flags = [p.featured && 'Featured', p.highlight && 'Highlight', p.trending && 'Trending'].filter(Boolean).map(function (f) { return '<span class="text-[10px] font-bold uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">' + f + '</span>'; }).join(' ');
      var st = p.status || 'published';
      var scheduled = st === 'scheduled' && new Date(p.date) > new Date();
      var statusBadge = st === 'draft' ? '<span class="text-[10px] font-bold uppercase bg-error/15 text-error px-1.5 py-0.5 rounded">Draft</span>'
        : (scheduled ? '<span class="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded">Scheduled</span>' : '');
      return '<div class="wp-row grid grid-cols-1 md:grid-cols-[1fr_140px_150px_120px] gap-1 md:gap-2 px-4 py-3 border-b border-outline-variant hover:bg-surface-container/40">' +
        '<div><a class="font-bold text-on-surface hover:text-primary cursor-pointer" data-edit="' + p.id + '">' + esc(p.title) + '</a> ' + statusBadge + ' ' + flags +
          '<div class="row-actions text-xs mt-1 flex gap-2 text-on-surface-variant"><a class="text-primary cursor-pointer font-bold" data-edit="' + p.id + '">Edit</a>|<a class="text-primary cursor-pointer" href="article.html?id=' + p.id + '" target="_blank">View</a>|<a class="text-error cursor-pointer" data-del="' + p.id + '">Trash</a></div></div>' +
        '<div class="text-sm text-on-surface-variant">' + esc(p.author) + '</div>' +
        '<div class="text-sm"><span class="text-primary font-bold">' + esc(p.category) + '</span> <span class="text-on-surface-variant text-xs">/ ' + esc(p.section) + '</span></div>' +
        '<div class="text-sm text-on-surface-variant">' + new Date(p.date).toLocaleDateString() + '</div>' +
        '</div>';
    }).join('');
  }
  $('#posts-search').addEventListener('input', renderPosts);
  $('#posts-list').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (dl) { e.preventDefault(); return delPost(parseInt(dl.dataset.del, 10)); }
    if (ed && ed.tagName === 'A' && ed.dataset.edit) { e.preventDefault(); openPostEditor(byId(posts, ed.dataset.edit)); }
  });
  $('#dash-recent') && null;

  /* ---- rich text editor factory ---- */
  function makeRTE(bodyEl, htmlEl, toolbarEl, opt) {
    opt = opt || {};
    var code = false;
    function exec(cmd, val) { bodyEl.focus(); try { document.execCommand(cmd, false, val || null); } catch (e) {} }
    $$('button[data-cmd]', toolbarEl).forEach(function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        var cmd = b.dataset.cmd, val = b.dataset.val || null;
        if (cmd === 'formatBlock') exec('formatBlock', val);
        else exec(cmd, val);
      });
    });
    if (opt.linkBtn) opt.linkBtn.addEventListener('click', function () { var u = prompt('Enter URL', 'https://'); if (u) exec('createLink', u); });
    if (opt.imageBtn) opt.imageBtn.addEventListener('click', function () {
      var u = prompt('Image URL (leave blank to upload a file)', '');
      if (u === null) return;
      if (u.trim()) { exec('insertImage', u.trim()); return; }
      pickFile(function (file) { uploadFile(file).then(function (url) { bodyEl.focus(); exec('insertImage', url); }); });
    });
    if (opt.codeBtn) opt.codeBtn.addEventListener('click', function () {
      code = !code;
      if (code) { htmlEl.value = bodyEl.innerHTML; htmlEl.classList.remove('hidden'); bodyEl.classList.add('hidden'); opt.codeBtn.classList.add('text-primary'); }
      else { bodyEl.innerHTML = htmlEl.value; htmlEl.classList.add('hidden'); bodyEl.classList.remove('hidden'); opt.codeBtn.classList.remove('text-primary'); }
    });
    return {
      get: function () { return code ? htmlEl.value : bodyEl.innerHTML; },
      set: function (html) { code = false; htmlEl.classList.add('hidden'); bodyEl.classList.remove('hidden'); if (opt.codeBtn) opt.codeBtn.classList.remove('text-primary'); bodyEl.innerHTML = html || ''; htmlEl.value = html || ''; }
    };
  }
  var _picker = null;
  function pickFile(cb) {
    if (!_picker) { _picker = document.createElement('input'); _picker.type = 'file'; _picker.accept = 'image/*'; _picker.style.display = 'none'; document.body.appendChild(_picker); }
    _picker.value = ''; _picker.onchange = function () { if (_picker.files[0]) cb(_picker.files[0]); };
    _picker.click();
  }

  /* ---- post editor ---- */
  var postForm = $('#post-form');
  var bodyRTE = makeRTE($('#rte-body'), $('#rte-html'), $('#rte-toolbar'), { linkBtn: $('#rte-link'), imageBtn: $('#rte-image'), codeBtn: $('#rte-code') });

  function renderCatChecklist(selected) {
    selected = selected || [];
    $('#cat-checklist').innerHTML = categories.map(function (c) {
      return '<label class="flex items-center gap-2 text-sm text-on-surface"><input type="checkbox" name="__cat" value="' + esc(c.name) + '" class="w-4 h-4 rounded text-primary"' + (selected.indexOf(c.name) !== -1 ? ' checked' : '') + '/> ' + esc(c.name) + '</label>';
    }).join('') || '<p class="text-xs text-on-surface-variant">No categories yet.</p>';
  }
  function checkedCats() { return $$('#cat-checklist input[name="__cat"]:checked').map(function (i) { return i.value; }); }
  function openPostEditor(post) {
    postForm.reset();
    var isNew = !post;
    show('editor', isNew ? 'Add New Post' : 'Edit Post');
    $('#publish-label').textContent = isNew ? 'Publish' : 'Update';
    $('#editor-delete').classList.toggle('hidden', isNew);
    $('#editor-preview').classList.toggle('hidden', isNew);
    post = post || { section: 'news', readTime: 5, date: new Date().toISOString(), status: 'published', categories: (categories[0] ? [categories[0].name] : []) };
    postForm.id.value = post.id || '';
    ['title', 'section', 'author', 'authorRole', 'readTime', 'image', 'authorAvatar', 'excerpt', 'caption'].forEach(function (k) { if (postForm[k]) postForm[k].value = post[k] != null ? post[k] : ''; });
    postForm.status.value = post.status || 'published';
    postForm.tags.value = (post.tags || []).join(', ');
    postForm.date.value = post.date ? new Date(post.date).toISOString().slice(0, 10) : '';
    ['featured', 'highlight', 'trending'].forEach(function (k) { postForm[k].checked = !!post[k]; });
    renderCatChecklist(post.categories && post.categories.length ? post.categories : (post.category ? [post.category] : []));
    syncStatusUI();
    bodyRTE.set(post.body || '');
    setPreview('#pe-image-preview', post.image);
    setPreview('#pe-avatar-preview', post.authorAvatar);
    $('#pe-permalink').textContent = post.id ? '/article.html?id=' + post.id : '/article.html?id=(new)';
  }
  function setPreview(sel, url) { var n = $(sel); if (!n) return; if (url) { n.src = url; n.classList.remove('hidden'); } else n.classList.add('hidden'); }
  function syncStatusUI() {
    var st = postForm.status.value;
    var isNew = !postForm.id.value;
    $('#pe-date-label').textContent = st === 'scheduled' ? 'Publish on (date)' : 'Date';
    $('#publish-label').textContent = st === 'draft' ? 'Save Draft' : (st === 'scheduled' ? 'Schedule' : (isNew ? 'Publish' : 'Update'));
  }
  postForm.status.addEventListener('change', syncStatusUI);

  postForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var cats = checkedCats();
    var data = {
      title: postForm.title.value, section: postForm.section.value,
      categories: cats, category: cats[0] || (categories[0] || {}).name || 'News',
      status: postForm.status.value,
      author: postForm.author.value, authorRole: postForm.authorRole.value, readTime: postForm.readTime.value,
      image: postForm.image.value, authorAvatar: postForm.authorAvatar.value,
      excerpt: postForm.excerpt.value, caption: postForm.caption.value, body: bodyRTE.get(),
      tags: postForm.tags.value, date: postForm.date.value ? new Date(postForm.date.value).toISOString() : new Date().toISOString(),
      featured: postForm.featured.checked, highlight: postForm.highlight.checked, trending: postForm.trending.checked
    };
    var id = postForm.id.value;
    (id ? api('PUT', '/api/posts/' + id, data) : api('POST', '/api/posts', data)).then(function () {
      loadPosts().then(function () { renderPosts(); renderDashboard(); show('posts'); });
    }).catch(function (x) { alert('Error: ' + x.message); });
  });
  $('#editor-delete').addEventListener('click', function () { if (postForm.id.value) delPost(parseInt(postForm.id.value, 10)); });
  $('#editor-preview').addEventListener('click', function () { if (postForm.id.value) window.open('article.html?id=' + postForm.id.value, '_blank'); });
  function delPost(id) {
    var p = byId(posts, id);
    if (!confirm('Move "' + (p ? p.title : 'this post') + '" to trash? This permanently deletes it.')) return;
    api('DELETE', '/api/posts/' + id).then(function () { loadPosts().then(function () { renderPosts(); renderDashboard(); show('posts'); }); }).catch(function (x) { alert('Error: ' + x.message); });
  }

  // featured image / avatar uploads inside editor
  $$('[data-upload]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (!input.files[0]) return;
      uploadFile(input.files[0]).then(function (url) {
        var f = input.dataset.upload; postForm[f].value = url;
        if (f === 'image') setPreview('#pe-image-preview', url);
        if (f === 'authorAvatar') setPreview('#pe-avatar-preview', url);
      }).catch(function (x) { alert('Upload failed: ' + x.message); });
    });
  });
  // live image preview on URL typing
  postForm.image.addEventListener('input', function () { setPreview('#pe-image-preview', postForm.image.value); });
  postForm.authorAvatar.addEventListener('input', function () { setPreview('#pe-avatar-preview', postForm.authorAvatar.value); });

  // quick add category from editor
  $('#cat-quick-add').addEventListener('click', function () {
    var name = $('#cat-quick').value.trim(); if (!name) return;
    var keep = checkedCats(); keep.push(name);
    api('POST', '/api/categories', { name: name }).then(function () {
      $('#cat-quick').value = '';
      loadCategories().then(function () { renderCatChecklist(keep); });
    }).catch(function (x) { alert('Error: ' + x.message); });
  });

  /* ---- categories ---- */
  var catForm = $('#cat-form');
  function renderCategories() {
    if (!categories.length) { $('#cat-list').innerHTML = '<div class="p-6 text-center text-on-surface-variant">No categories yet.</div>'; return; }
    $('#cat-list').innerHTML = categories.map(function (c) {
      var count = posts.filter(function (p) { return (p.categories && p.categories.length ? p.categories : [p.category]).indexOf(c.name) !== -1; }).length;
      return '<div class="wp-row grid grid-cols-[1fr_1fr_80px] gap-2 px-4 py-3 border-b border-outline-variant hover:bg-surface-container/40 items-center">' +
        '<div><a class="font-bold text-on-surface hover:text-primary cursor-pointer" data-cedit="' + c.id + '">' + esc(c.name) + '</a>' +
          '<div class="row-actions text-xs mt-1 flex gap-2 text-on-surface-variant"><a class="text-primary cursor-pointer font-bold" data-cedit="' + c.id + '">Edit</a>|<a class="text-error cursor-pointer" data-cdel="' + c.id + '">Delete</a></div></div>' +
        '<div class="text-sm text-on-surface-variant font-mono">' + esc(c.slug) + '</div>' +
        '<div class="text-sm text-on-surface-variant">' + count + '</div></div>';
    }).join('');
  }
  function resetCatForm() { catForm.reset(); catForm.id.value = ''; $('#cat-form-title').textContent = 'Add New Category'; $('#cat-submit').textContent = 'Add Category'; $('#cat-cancel').classList.add('hidden'); }
  catForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = catForm.id.value, data = { name: catForm.name.value, slug: catForm.slug.value };
    (id ? api('PUT', '/api/categories/' + id, data) : api('POST', '/api/categories', data)).then(function () {
      resetCatForm(); loadCategories().then(function () { renderCategories(); renderDashboard(); });
    }).catch(function (x) { alert('Error: ' + x.message); });
  });
  $('#cat-cancel').addEventListener('click', resetCatForm);
  $('#cat-list').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-cedit]'), dl = e.target.closest('[data-cdel]');
    if (dl) { var c = byId(categories, dl.dataset.cdel); if (confirm('Delete category "' + (c ? c.name : '') + '"?')) api('DELETE', '/api/categories/' + dl.dataset.cdel).then(function () { loadCategories().then(function () { renderCategories(); renderDashboard(); }); }); return; }
    if (ed) { var cat = byId(categories, ed.dataset.cedit); catForm.id.value = cat.id; catForm.name.value = cat.name; catForm.slug.value = cat.slug; $('#cat-form-title').textContent = 'Edit Category'; $('#cat-submit').textContent = 'Update'; $('#cat-cancel').classList.remove('hidden'); window.scrollTo(0, 0); }
  });

  /* ---- pages ---- */
  var pageForm = $('#page-form');
  var pageRTE = makeRTE($('#prte-body'), $('#prte-html'), $('#prte-toolbar'), { linkBtn: $('#prte-link'), codeBtn: $('#prte-code') });
  function renderPages() {
    if (!pages.length) { $('#pages-list').innerHTML = '<div class="p-6 text-center text-on-surface-variant">No pages yet.</div>'; return; }
    $('#pages-list').innerHTML = pages.map(function (p) {
      return '<div class="wp-row grid grid-cols-[1fr_160px_90px] gap-2 px-4 py-3 border-b border-outline-variant hover:bg-surface-container/40 items-center">' +
        '<div><a class="font-bold text-on-surface hover:text-primary cursor-pointer" data-pedit="' + p.id + '">' + esc(p.title) + '</a>' +
          '<div class="row-actions text-xs mt-1 flex gap-2 text-on-surface-variant"><a class="text-primary cursor-pointer font-bold" data-pedit="' + p.id + '">Edit</a>|<a class="text-primary cursor-pointer" href="page.html?p=' + esc(p.slug) + '" target="_blank">View</a>|<a class="text-error cursor-pointer" data-pdel="' + p.id + '">Trash</a></div></div>' +
        '<div class="text-sm text-on-surface-variant font-mono">' + esc(p.slug) + '</div>' +
        '<div class="text-sm text-on-surface-variant">' + (p.showInFooter ? 'Yes' : '—') + '</div></div>';
    }).join('');
  }
  function openPageEditor(page) {
    pageForm.reset();
    var isNew = !page;
    show('page-editor', isNew ? 'Add New Page' : 'Edit Page');
    $('#page-publish-label').textContent = isNew ? 'Publish' : 'Update';
    $('#page-delete').classList.toggle('hidden', isNew);
    page = page || { title: '', slug: '', body: '', showInFooter: false };
    pageForm.id.value = page.id || '';
    pageForm.title.value = page.title || ''; pageForm.slug.value = page.slug || '';
    pageForm.showInFooter.checked = !!page.showInFooter;
    pageRTE.set(page.body || '');
  }
  $('#page-new').addEventListener('click', function () { openPageEditor(null); });
  $('#pages-list').addEventListener('click', function (e) {
    var ed = e.target.closest('[data-pedit]'), dl = e.target.closest('[data-pdel]');
    if (dl) { e.preventDefault(); var pg = byId(pages, dl.dataset.pdel); if (confirm('Trash page "' + (pg ? pg.title : '') + '"?')) api('DELETE', '/api/pages/' + dl.dataset.pdel).then(function () { loadPages().then(function () { renderPages(); renderDashboard(); }); }); return; }
    if (ed && ed.dataset.pedit) { e.preventDefault(); openPageEditor(byId(pages, ed.dataset.pedit)); }
  });
  pageForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = pageForm.id.value, data = { title: pageForm.title.value, slug: pageForm.slug.value, showInFooter: pageForm.showInFooter.checked, body: pageRTE.get() };
    (id ? api('PUT', '/api/pages/' + id, data) : api('POST', '/api/pages', data)).then(function () {
      loadPages().then(function () { renderPages(); renderDashboard(); show('pages'); });
    }).catch(function (x) { alert('Error: ' + x.message); });
  });
  $('#page-delete').addEventListener('click', function () {
    if (!pageForm.id.value) return;
    if (confirm('Trash this page?')) api('DELETE', '/api/pages/' + pageForm.id.value).then(function () { loadPages().then(function () { renderPages(); renderDashboard(); show('pages'); }); });
  });

  /* ---- menu builder ---- */
  function menuRowHTML(item) {
    return '<div class="menu-row flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-on-surface-variant text-[18px]">drag_indicator</span>' +
      '<input class="ad-input py-1.5 flex-1 mi-label" placeholder="Label" value="' + esc(item.label || '') + '"/>' +
      '<input class="ad-input py-1.5 flex-1 mi-href" placeholder="URL (e.g. news.html)" value="' + esc(item.href || '') + '"/>' +
      '<button type="button" class="mi-up w-8 h-8 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">arrow_upward</span></button>' +
      '<button type="button" class="mi-down w-8 h-8 rounded-lg border border-outline-variant text-on-surface-variant hover:text-primary flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">arrow_downward</span></button>' +
      '<button type="button" class="mi-del w-8 h-8 rounded-lg text-error hover:bg-error/10 flex items-center justify-center"><span class="material-symbols-outlined text-[18px]">close</span></button>' +
      '</div>';
  }
  function renderMenu() {
    loadSettings().then(function () {
      var nav = (settingsCache.nav && settingsCache.nav.length) ? settingsCache.nav : [];
      $('#menu-items').innerHTML = nav.map(menuRowHTML).join('') || '<p class="text-sm text-on-surface-variant">No menu items. Add one below.</p>';
    });
  }
  $('#menu-add').addEventListener('click', function () {
    if ($('#menu-items p')) $('#menu-items').innerHTML = '';
    $('#menu-items').insertAdjacentHTML('beforeend', menuRowHTML({ label: '', href: '' }));
  });
  $('#menu-items').addEventListener('click', function (e) {
    var row = e.target.closest('.menu-row'); if (!row) return;
    if (e.target.closest('.mi-del')) row.remove();
    else if (e.target.closest('.mi-up') && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
    else if (e.target.closest('.mi-down') && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
  });
  $('#menu-save').addEventListener('click', function () {
    var nav = $$('#menu-items .menu-row').map(function (r) {
      return { label: $('.mi-label', r).value.trim(), href: $('.mi-href', r).value.trim() };
    }).filter(function (i) { return i.label && i.href; });
    api('PUT', '/api/settings', { nav: nav }).then(function () {
      settingsCache.nav = nav;
      var s = $('#menu-saved'); s.classList.remove('hidden'); setTimeout(function () { s.classList.add('hidden'); }, 2000);
    }).catch(function (x) { alert('Error: ' + x.message); });
  });

  /* ---- media ---- */
  function renderMedia() {
    $('#media-count').textContent = media.length + ' item' + (media.length === 1 ? '' : 's');
    if (!media.length) { $('#media-grid').innerHTML = '<p class="col-span-full text-on-surface-variant py-8 text-center">No media yet. Upload an image to get started.</p>'; return; }
    $('#media-grid').innerHTML = media.map(function (m) {
      return '<div class="group relative rounded-lg overflow-hidden border border-outline-variant bg-card"><img src="' + esc(m.url) + '" class="w-full h-28 object-cover"/><div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5"><button data-copy="' + esc(m.url) + '" class="text-white text-xs bg-primary text-on-primary px-2 py-1 rounded font-bold">Copy URL</button><button data-delm="' + esc(m.name) + '" class="text-white text-xs bg-error px-2 py-1 rounded font-bold">Delete</button></div></div>';
    }).join('');
  }
  $('#media-grid').addEventListener('click', function (e) {
    var cp = e.target.closest('[data-copy]'), dl = e.target.closest('[data-delm]');
    if (cp) { navigator.clipboard.writeText(location.origin + cp.dataset.copy); cp.textContent = 'Copied!'; setTimeout(function () { cp.textContent = 'Copy URL'; }, 1200); }
    if (dl) { if (confirm('Delete this file?')) api('DELETE', '/api/media/' + encodeURIComponent(dl.dataset.delm)).then(function () { loadMedia().then(renderMedia); }); }
  });
  $('#media-upload').addEventListener('change', function () {
    if (!this.files[0]) return;
    uploadFile(this.files[0]).then(function () { loadMedia().then(renderMedia); }).catch(function (x) { alert('Upload failed: ' + x.message); });
  });

  /* ---- settings ---- */
  function loadSettings() {
    return api('GET', '/api/settings').then(function (s) {
      settingsCache = s || {};
      var f = $('#settings-form');
      f.siteName.value = s.siteName || ''; f.tagline.value = s.tagline || '';
      f.footerAbout.value = s.footerAbout || ''; f.breaking.value = s.breaking || '';
      f.logo.value = s.logo || ''; f.favicon.value = s.favicon || '';
      setPreview('#logo-preview', s.logo); setPreview('#favicon-preview', s.favicon);
      var lh = parseInt(s.logoHeight, 10) || 44;
      if (f.logoHeight) { f.logoHeight.value = lh; $('#logoHeight-val').textContent = lh; var szp = $('#logo-size-preview'); if (szp) { szp.style.height = lh + 'px'; szp.src = s.logo || '/assets/logo.svg'; } }
      $('#breakingEnabled').checked = !!s.breakingEnabled;
      var lm = s.liveMatch || {};
      f.lm_home.value = lm.home || ''; f.lm_away.value = lm.away || '';
      f.lm_homeScore.value = lm.homeScore || ''; f.lm_awayScore.value = lm.awayScore || ''; f.lm_status.value = lm.status || '';
      f.lm_league.value = lm.league || ''; $('#lm_live').checked = !!lm.live;
      f.lm_homeScorers.value = (lm.homeScorers || []).join(', '); f.lm_awayScorers.value = (lm.awayScorers || []).join(', ');
    });
  }
  $('#settings-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    api('PUT', '/api/settings', {
      siteName: f.siteName.value, tagline: f.tagline.value, footerAbout: f.footerAbout.value,
      logo: f.logo.value, favicon: f.favicon.value, logoHeight: parseInt(f.logoHeight.value, 10) || 44,
      breaking: f.breaking.value, breakingEnabled: $('#breakingEnabled').checked,
      liveMatch: { home: f.lm_home.value, away: f.lm_away.value, homeScore: f.lm_homeScore.value, awayScore: f.lm_awayScore.value, status: f.lm_status.value, league: f.lm_league.value, live: $('#lm_live').checked, homeScorers: f.lm_homeScorers.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean), awayScorers: f.lm_awayScorers.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) }
    }).then(function () { var s = $('#settings-saved'); s.classList.remove('hidden'); setTimeout(function () { s.classList.add('hidden'); }, 2000); }).catch(function (x) { alert('Error: ' + x.message); });
  });
  // Branding uploads (logo / favicon) + live URL preview
  $$('[data-supload]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (!input.files[0]) return;
      uploadFile(input.files[0]).then(function (url) {
        var f = input.dataset.supload; $('#settings-form')[f].value = url; setPreview('#' + f + '-preview', url);
        if (f === 'logo') { var szp = $('#logo-size-preview'); if (szp) szp.src = url; }
      }).catch(function (x) { alert('Upload failed: ' + x.message); });
    });
  });
  $('#settings-form').logo.addEventListener('input', function () { setPreview('#logo-preview', this.value); var p = $('#logo-size-preview'); if (p) p.src = this.value || '/assets/logo.svg'; });
  $('#settings-form').favicon.addEventListener('input', function () { setPreview('#favicon-preview', this.value); });
  $('#logoHeight').addEventListener('input', function () { $('#logoHeight-val').textContent = this.value; var p = $('#logo-size-preview'); if (p) p.style.height = this.value + 'px'; });

  /* ---- account ---- */
  function loadAccount() { api('GET', '/api/me').then(function (m) { $('#account-form').username.value = m.username || ''; }); }
  $('#account-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, body = {};
    if (f.username.value) body.username = f.username.value;
    if (f.password.value) body.password = f.password.value;
    api('PUT', '/api/account', body).then(function () { f.password.value = ''; $('#whoami').textContent = f.username.value; var s = $('#account-saved'); s.classList.remove('hidden'); setTimeout(function () { s.classList.add('hidden'); }, 2000); }).catch(function (x) { alert('Error: ' + x.message); });
  });

  /* ---- boot ---- */
  if (token) api('GET', '/api/me').then(function (m) { m.authed ? showApp() : showLogin(); }).catch(showLogin);
  else showLogin();
})();
