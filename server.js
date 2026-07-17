/*
 * TrendyinUS — zero-dependency Node.js server.
 * Serves the static football-news site AND a JSON REST API used by the
 * public pages (read) and the admin panel (create / edit / delete).
 * Data lives in db.json next to this file; uploads land in /uploads.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const ROOT = __dirname;
// DATA_DIR lets a host mount a persistent disk so db.json + uploads survive
// restarts/redeploys (defaults to the app folder for local use).
const DATA_DIR = process.env.DATA_DIR || ROOT;
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PORT = process.env.PORT || 5503;

/* ------------------------------------------------------------------ *
 * Storage back-ends. On a serverless host (Vercel) there is no writable
 * disk or shared memory, so:
 *   - data     -> Vercel KV (Upstash Redis REST) when KV_REST_API_URL is set
 *   - uploads  -> Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 *   - auth     -> stateless JWT (below)
 * Locally none of those env vars exist, so it falls back to db.json + /uploads.
 * ------------------------------------------------------------------ */
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const USE_KV = !!(KV_URL && KV_TOKEN);
const SESSION_SECRET = process.env.SESSION_SECRET || 'trendyinus-local-dev-secret';
let blobApi = null;
try { blobApi = require('@vercel/blob'); } catch (_e) { /* not installed locally */ }
const USE_BLOB = !!(blobApi && process.env.BLOB_READ_WRITE_TOKEN);

async function kvCommand(cmd) {
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  return j.result;
}

/* ------------------------------------------------------------------ *
 * Seed data — written to db.json on first run only.
 * ------------------------------------------------------------------ */
const IMG = {
  hero: 'https://lh3.googleusercontent.com/aida/AP1WRLu-wFRfL9mQmqqscO-V_GT-DAz1jGLqeTDev7EediGun145BL2NO8XxRDaX0FpZC56k5TuZS_rFg3I2x1-pcBy8gop0yO3obU4blrID9vRpgQCbSjbh2F_B71XhyvpZG7MwEO_lYBnMtopJ4fO61S-Ff6P5cPZCh9TiEJt9N9VuOmfrHJd49DYy0bOEHQZux7XTiUwfmwR6a5-3kpNyHUdYqSEwMBfhYo1yc7gFG2bOaES4e3TTWtc_Kjgc',
  boot: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUW5fd8AN1KfNLToejcU69OyazjSSYPGg_g-z2mYTF6G-5YquNBgx5qYdWtty3_ATbMR0C8kUhsjnIMsvYp-q9rNR3Q7sUEfW9nlGBZ5q0XOjw4m4zJSNUxlPmeMe5FZFoRRVer6VmoGEv64Begj1ACoKDf4ShHSJUgac-gBqDUZ3fzEbUExzADYDUEKN4aFizZRfX7ecq3Ig6TrqacnCz1oqhnh5EaU3jmc50pxw_GJROnfxA3rE1Bg',
  alonso: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAGYBF2X42B72HcZYsDbAU2RU64BeuMKI2kbAgu90kOrUS_FtVU6GLOOriIHPF8mIs6nXTyDBDGwgaFohygvS3cwVhKBoLVugusTfKHGhC-l1PBUgE76mCvDEWGmwAVIfzIjT_N3ePa47nlwszFCV3WmJC2VIO0SAlELLZZn6swg8ncNBlg0wYWDvyeLhcC3O_OmO2OVxzijKNan4qoR9MoxCgh3jupWeVi37tFjZRWDuKAQypzKa6liA',
  stadium: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAu6ypsZhmoLbDrFvzNWg_I1frgEdBcMD8Lak-ZQj_tb1udvgC2512OV1uY3g-unU-KKen0b8HNaSZT7_itG44YphcGYb6pp079WK7cwoxmW2ZsJQPgtdxi4ECpoSQl7Ls6aEcPumqLg0yXGvGv3UdCpnz_iL8RFoNRKyBUGA4zQedXZXpQgx6u2LdXX5ecfPdczEHqt9fJOOWJT49g4hXTsNy7R4fpkJi1bx2ZnJdCIZabMrPAUT_I0g',
  keeper: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2Y2yFEPGxIA_OeFjaweSw-os1CMDzUa4omoKnjiSkOfSFwDLUbeBtkQrT6i4r02ZSaslSlprBc7l0UbvbjmWCEe-veo_JlnbFH4eFNw1j-0Ho29OeWiJNkeuocDAawCc_HNLysPnO8ezsfSzofThrFByDB08kCzM-Kq4Xx3acZUiI0hI8HiYA6TaUOS3-ofqwbkgGe9-uRiTcbyJlo9w9LozGCsrmthPa5i9VU6hmLkF7GXwzQit3Aw',
  corner: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQ20lWLaYyipjCRBLC8-XMAaAVh3mJvuySsEEs_K7i85v-UHvfEd6_89SanaCsvDo5PYCIDrzIV_mCNDmjDY8ZUaLLJ6uWxXhY7OJD-16wZ4VczS6byA29EFs2hPISp1NvMixsX6IW-cdiF0s7Do6QByaYruNud9DODBUf0svDmdUqo38xl7DOHU890b6a75OAc7OS_zDddhHIoarGoIQDzXbqnrY-3qnp65qSHFceKY67y-2Bkhep8g',
  anfield: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmfBHU8rU68doAVT8ewTCzw2h1N1mkNBJ_IsRiAGRaB0QmYfxgOqHWf9ZX_Ck3ToTwdYVtRwhbmQCbo1RLXfmkrdXGiAPa_7jGIGeMjCJyCbmHwBWa9UCi9tov4MZsnQcE8Po2FFEI6xXzwz4hRZeY-TKn7jIMRU_hjcgPw44_x89h6prLl-ys_ggDkJeikIEUitjltwIh8tsaGqr7J6DfbujgHUkNtLHc8klXhud9MaZITX9ORqDCZg',
  jersey: 'https://lh3.googleusercontent.com/aida/AP1WRLsxKffLB13f8CenJpJiSkJ_ZPcG8vmxR9Ss0Ele9uFiIk0bJ4RuUuv6f4CRgzx8JqlXBkqW-jX8eEdWw58fYQRyccjKqJyGqi30XfTtZBVKiLjpQrKPuQutvwoi3sEFlS0IZtfOwMIP1wuDrVP85l0M3Rf1WL-fM0OADwZgdeaHmM_7t-sFfEUGao-H-MIE2kHyfnwxP0siyblpzOtzWsAQrRgPj8KuP5ZJiTlQzHLMIO-mpCSRnXpqt1ca',
  ball: 'https://lh3.googleusercontent.com/aida/AP1WRLui_wcf3KNl8VfV1R5aVGujhmF_GNnI8xvMv9pvmzZ3LJIQ4kGnRGxDzo930a7d9ztRuohuj4_j_KQp3RBfaBWLSLHHXK9O19sZ0bIAxfx4QirFlX122fqCAihGevd880MlNfy-zetQhlwIWBYxQxQK9zHwv1OA2skDDxnKgN9bd81JO6_bv-ChscsHscL8JWqodFJaRBnhgpEqYCZ0RxAnnB0MIq-UWptUOZXDJGQ1SkSffFWn3ZmFGHc',
  lights: 'https://lh3.googleusercontent.com/aida/AP1WRLvaTQOryRpY8xy9zcEXhzFaoBTcWQSNBVDl2yFNBUi4NBuaeWiJ_KQ8fln1BsgJUfK1_IIQ5k5kZYNsZddvsHJ9JJpbI9hVgwMUvEQcrrDUaO2TyaxC5n1kDksq5sCDLnA6JGY_BohEryllCU5L4wDAtna47yqKGl2gGFO1Y6U5azHsmf10BQ6nGT7XBzF_w9UtNneYibRBZjfFKtbD_3ARMX5Vl2Pp1ITgqkHX29xIMx3iI4_ga3WcSyj5',
  avatarSilva: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBx5eJdhHSyBltaCCeIde6G-d3yLT-Kz-dPR9wf-2at8cdhvuZYGBJeErh9nKCVmZ7-caqDcLppOZYnJonE3fURmaL7bEfenJDQ4Uga3tIIAAJuAj3hwsR6cnDgQuvUF4QYZ8TOsQVq2kdK1W-DQUMQBWYQ0ZkpsvT7hphpXO_ZxointHscfk5nO86UPWdvsbuDdEfnEbQUtcERF_YpTBzJwRiSFRtG2d9p6FaDRDdEkbJSx1JcJ6LFjg',
  avatarRossi: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAnARpbPKi2mgwcnbJyhSw36H35NlfwELgeBu6wdpXU3TmWx8d9pE_pEjODAKNAqkKbvaQmFlLtLVDmYThfF8LJmRITgiA7On0Zc6FBgtluq3k8G_1iZHGtWz2UKdWyIiHQCY9-2KOKqG_So1rabyRmCyIUnPgZ8wCRcTtce9OC0E_g8yKld3MfseMh629E8AWErnCUngFewX76U6ySY9fJhPgqe8shXMP7hw7TFVfPbG-KAtrlJYBow'
};

function daysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString(); }

// Password hashing — scrypt (deliberately slow + salted). No plaintext admin
// password exists in code or in db.json; only a per-user salt + hash are stored.
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return { salt: salt, hash: crypto.scryptSync(String(password), salt, 64).toString('hex') };
}
function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const computed = Buffer.from(crypto.scryptSync(String(password), salt, 64).toString('hex'), 'hex');
  const stored = Buffer.from(String(hash), 'hex');
  return computed.length === stored.length && crypto.timingSafeEqual(computed, stored);
}
function seedAdmin() {
  const u = process.env.ADMIN_USERNAME || 'admin';
  const p = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64');
  const hp = hashPassword(p);
  if (!process.env.ADMIN_PASSWORD) console.log('[TrendyinUS] No ADMIN_PASSWORD env set — generated one-time admin password: ' + p);
  return { username: u, passSalt: hp.salt, passHash: hp.hash };
}

const SEED = {
  admin: null, // filled by seedAdmin() only when a brand-new database is created
  settings: {
    siteName: 'TrendyinUS',
    tagline: 'World Class reporting for World Class fans.',
    breaking: 'Transfer Deadline Day Live: Major Premier League deal expected within the hour.',
    breakingEnabled: true,
    footerAbout: 'Premium football coverage for the global fan. Authoritative, energetic, and instant.',
    liveMatch: { home: 'Real Madrid', away: 'Dortmund', homeScore: '2', awayScore: '0', status: "88' - Full Time" },
    nav: [
      { label: 'Live Scores', href: 'live-scores.html' },
      { label: 'Soccer', href: 'soccer.html' },
      { label: 'MLB', href: 'mlb.html' },
      { label: 'NFL', href: 'nfl.html' },
      { label: 'WNBA', href: 'wnba.html' },
      { label: 'Tennis', href: 'tennis.html' },
      { label: 'WWE', href: 'wwe.html' },
      { label: 'Others', href: 'others.html' }
    ]
  },
  nextId: 19,
  nextCatId: 8,
  nextPageId: 5,
  categories: [
    { id: 1, name: 'Soccer', slug: 'soccer' },
    { id: 2, name: 'MLB', slug: 'mlb' },
    { id: 3, name: 'NFL', slug: 'nfl' },
    { id: 4, name: 'WNBA', slug: 'wnba' },
    { id: 5, name: 'Tennis', slug: 'tennis' },
    { id: 6, name: 'WWE', slug: 'wwe' },
    { id: 7, name: 'Others', slug: 'others' }
  ],
  pages: [
    { id: 1, slug: 'about', title: 'About TrendyinUS', showInFooter: true, body: '<p>TrendyinUS is a premium football news portal delivering authoritative, energetic and instant coverage of the global game. From the Champions League to the World Cup, our correspondents bring you the stories, tactics and transfers that matter.</p><p>Founded for World Class fans, we combine long-form editorial with breaking-news urgency.</p>' },
    { id: 2, slug: 'contact', title: 'Contact Us', showInFooter: true, body: '<p>Have a tip, a question, or a partnership enquiry? Reach the newsroom at <a class="text-primary font-bold" href="mailto:newsroom@trendyin.us">newsroom@trendyin.us</a>.</p><p>For advertising and media kits, email <a class="text-primary font-bold" href="mailto:ads@trendyin.us">ads@trendyin.us</a>.</p>' },
    { id: 3, slug: 'privacy', title: 'Privacy Policy', showInFooter: true, body: '<p>We respect your privacy. TrendyinUS collects only the information necessary to deliver our newsletter and improve your reading experience. We never sell your personal data.</p>' },
    { id: 4, slug: 'terms', title: 'Terms of Service', showInFooter: true, body: '<p>By using TrendyinUS you agree to use the site for lawful, personal, non-commercial purposes. All editorial content is provided for informational purposes.</p>' }
  ],
  posts: [
    { id: 1, title: 'The New Era Begins: Real Madrid Unveils Record Signing', category: 'La Liga', section: 'news', author: 'Fabrizio Rossi', authorRole: 'Chief Correspondent', authorAvatar: IMG.avatarRossi, image: IMG.hero, readTime: 8, date: daysAgo(0), featured: true, highlight: false, trending: false, excerpt: 'Los Blancos complete a marquee capture that reshapes the balance of power in European football for the coming decade.', body: '<p>Real Madrid have once again announced their intent to dominate world football, unveiling a record-breaking signing to a packed Santiago Bernabeu. The transfer, months in the making, signals the dawn of a new galactico era at the Spanish capital.</p><p>Club president Florentino Perez described the move as "a statement of ambition," while the manager confirmed the new arrival would be integrated immediately into the first-team setup ahead of a demanding league and Champions League schedule.</p><p>Analysts across the continent agree: this is the kind of acquisition that not only sells shirts, but tilts title races. The rest of La Liga has been put on notice.</p>' },
    { id: 2, title: "Pep's Tactical Masterclass: How City Neutralized Arsenal", category: 'Premier League', section: 'features', author: 'Michael Cox', authorRole: 'Tactics Writer', authorAvatar: IMG.corner, image: IMG.boot, readTime: 5, date: daysAgo(0), featured: false, highlight: false, trending: true, excerpt: 'An in-depth analysis of the tactical shift that saw Manchester City dominate the midfield battle...', body: '<p>Manchester City delivered a midfield masterclass that suffocated Arsenal from the first whistle. By inverting the full-backs and overloading the half-spaces, Pep Guardiola turned a title six-pointer into a controlled procession.</p><p>The key was positional discipline: City rarely committed numbers forward without securing the rest-defence behind the ball, neutralising Arsenal\'s counter-attacking threat entirely.</p>' },
    { id: 3, title: 'Injury Blow: Jude Bellingham Ruled Out for Three Weeks', category: 'Injury Update', section: 'news', author: 'Sarah Jenkins', authorRole: 'News Reporter', authorAvatar: IMG.corner, image: IMG.boot, readTime: 3, date: daysAgo(0), featured: false, highlight: false, trending: true, excerpt: 'The English midfielder suffered a calf strain during training, putting his upcoming Champions League start at risk...', body: '<p>Real Madrid have confirmed that Jude Bellingham will miss the next three weeks with a calf strain sustained in training. The England international will undergo a rehabilitation programme with the club\'s medical staff.</p><p>The timing is a concern with a congested fixture list ahead, though sources close to the player insist there is no long-term damage.</p>' },
    { id: 4, title: "Exclusive: Xabi Alonso on Leverkusen's Winning Mentality", category: 'Interview', section: 'features', author: 'Marco Silva', authorRole: 'European Football Correspondent', authorAvatar: IMG.avatarSilva, image: IMG.alonso, readTime: 10, date: daysAgo(1), featured: false, highlight: false, trending: true, excerpt: 'The manager sits down with TrendyinUS to discuss his coaching philosophy and the road ahead...', body: '<p>In a rare and revealing sit-down, Xabi Alonso opens up about the culture he has built at Bayer Leverkusen — one rooted in relentless work, tactical intelligence, and an unshakeable belief.</p><p>"We don\'t talk about limits," Alonso says. "We talk about standards. The moment you accept less, you\'ve already lost."</p>' },
    { id: 5, title: 'North America Gears Up for the Biggest World Cup in History', category: 'World Cup 2026', section: 'world-cup', author: 'Dave Hytner', authorRole: 'Senior Writer', authorAvatar: IMG.keeper, image: IMG.stadium, readTime: 6, date: daysAgo(1), featured: false, highlight: true, trending: false, excerpt: 'The United States, Canada and Mexico prepare to host an expanded 48-team tournament on the road to glory.', body: '<p>The 2026 World Cup will be the largest in the tournament\'s history, with 48 teams and 104 matches spread across three nations. Infrastructure, logistics and security are being scaled to an unprecedented level.</p><p>For fans, it promises a festival of football unlike anything seen before — a continent-wide celebration of the global game.</p>' },
    { id: 6, title: 'The Best of the Best: Champions League Power Rankings', category: 'Champions League', section: 'leagues', author: 'Sid Lowe', authorRole: 'European Analyst', authorAvatar: IMG.keeper, image: IMG.keeper, readTime: 7, date: daysAgo(2), featured: false, highlight: true, trending: false, excerpt: 'We rank the continent\'s elite as the group stage delivers drama, upsets and statement wins.', body: '<p>The Champions League group stage rarely disappoints, and this season has already served up its share of shocks. Our power rankings weigh form, squad depth and knockout pedigree.</p><p>At the top, the usual suspects — but there are challengers emerging who could yet crash the party come the spring.</p>' },
    { id: 7, title: 'Manchester Derby Preview: Form vs. History', category: 'Premier League', section: 'news', author: 'Sarah Jenkins', authorRole: 'News Reporter', authorAvatar: IMG.corner, image: IMG.corner, readTime: 4, date: daysAgo(0), featured: false, highlight: false, trending: false, excerpt: 'City arrive in imperious form, but derby day has a way of tearing up the script.', body: '<p>Form book, meet the Manchester derby. City may be flying, but United have history and home advantage — and in fixtures like these, momentum can shift in a single moment.</p><p>We break down the key battles, the team news, and the tactical chess match that will decide bragging rights.</p>' },
    { id: 8, title: 'Every Confirmed Transfer This Window', category: 'Transfers', section: 'transfers', author: 'David Ornstein', authorRole: 'Transfer Insider', authorAvatar: IMG.ball, image: IMG.ball, readTime: 12, date: daysAgo(0), featured: false, highlight: false, trending: false, excerpt: 'Your definitive, continuously updated log of every done deal across Europe\'s major leagues.', body: '<p>The window is in full swing and the deals are coming thick and fast. This is our live, verified log of every confirmed transfer — fees, contract lengths and the story behind each move.</p><p>Bookmark this page: we update it the moment a deal is signed and sealed.</p>' },
    { id: 9, title: 'Milan Giants Target Young French Defender', category: 'Serie A', section: 'transfers', author: 'Luca Di Marzio', authorRole: 'Serie A Correspondent', authorAvatar: IMG.lights, image: IMG.lights, readTime: 3, date: daysAgo(0), featured: false, highlight: false, trending: false, excerpt: 'Rossoneri scouts have been impressed by the 19-year-old\'s composure and reading of the game.', body: '<p>AC Milan are pushing to sign one of Ligue 1\'s brightest defensive talents, with negotiations said to be at an advanced stage. The 19-year-old fits the club\'s strategy of investing in young, high-ceiling players.</p><p>A fee is yet to be agreed, but sources indicate personal terms would not be an obstacle.</p>' },
    { id: 10, title: 'The Evolution of the Modern Sweeper-Keeper', category: 'Analysis', section: 'features', author: 'Sid Lowe', authorRole: 'European Analyst', authorAvatar: IMG.keeper, image: IMG.keeper, readTime: 7, date: daysAgo(0), featured: false, highlight: false, trending: false, excerpt: 'From shot-stopper to playmaker: how the goalkeeper became the first line of attack.', body: '<p>The goalkeeper\'s job description has been rewritten. Today\'s elite keepers are as comfortable stepping out to start attacks as they are pulling off point-blank saves.</p><p>We trace the tactical evolution that turned the last line of defence into the first line of attack.</p>' },
    { id: 11, title: 'Kings of Europe: Real Madrid Secure 15th Champions League Title', category: 'Champions League', section: 'leagues', author: 'Marco Silva', authorRole: 'European Football Correspondent', authorAvatar: IMG.avatarSilva, image: IMG.hero, readTime: 8, date: daysAgo(30), featured: false, highlight: false, trending: false, caption: "Vinicius Junior celebrates after doubling Real Madrid's lead in the Champions League final. (Photo by Action Images)", tags: ['#UCLFinal', '#HalaMadrid', '#Football', '#ChampionsLeague'], excerpt: 'At a packed Wembley Stadium, Real Madrid once again proved why they are the undisputed masters of European football.', body: '<p class="first-letter:text-5xl first-letter:font-bold first-letter:text-primary first-letter:mr-3 first-letter:float-left">The aura of invincibility remains unbroken. At a packed Wembley Stadium, Real Madrid once again proved why they are the undisputed masters of European football. Despite a spirited first-half performance from Borussia Dortmund, the Spanish giants weathered the storm to secure a clinical 2-0 victory.</p><p>Dortmund will rue their missed opportunities, with Karim Adeyemi and Niclas Fullkrug both coming agonisingly close to breaking the deadlock in the opening forty-five minutes. However, as has become custom in this competition, Madrid found a way to shift gears when it mattered most. Dani Carvajal\'s towering header from a corner broke the resistance, before Vinicius Junior capitalized on a defensive error to seal the result.</p><blockquote class="border-l-4 border-primary pl-6 my-8 italic text-headline-md font-body-md text-primary bg-surface-container-low py-4 rounded-r-xl">"This club has a special relationship with this trophy. We don\'t play finals, we win them. Tonight was about suffering together and finishing strong."<cite class="block mt-2 font-label-sm not-italic text-on-surface-variant">— Carlo Ancelotti</cite></blockquote><p>The victory marks a historic sixth Champions League title for veterans Luka Modric, Toni Kroos, Dani Carvajal, and Nacho — a feat that cements their status as legends of the modern game. For Kroos, it was the perfect swan song to an illustrious club career, departing as a champion of Europe for the final time.</p><h2 class="font-headline-lg text-headline-lg text-on-surface mt-8 mb-2">Match Statistics</h2><div class="bg-card rounded-xl overflow-hidden border border-outline-variant shadow-sm"><table class="w-full text-left border-collapse"><thead><tr class="bg-surface-container-high"><th class="px-6 py-4 font-label-sm text-on-surface-variant uppercase">Metric</th><th class="px-6 py-4 font-label-sm text-on-surface-variant uppercase text-center">Real Madrid</th><th class="px-6 py-4 font-label-sm text-on-surface-variant uppercase text-right">Dortmund</th></tr></thead><tbody class="divide-y divide-outline-variant"><tr><td class="px-6 py-4 font-body-md font-bold text-on-surface">Possession</td><td class="px-6 py-4 font-label-sm text-center font-mono text-on-surface">58%</td><td class="px-6 py-4 font-label-sm text-right font-mono text-on-surface">42%</td></tr><tr><td class="px-6 py-4 font-body-md font-bold text-on-surface">Total Shots</td><td class="px-6 py-4 font-label-sm text-center font-mono text-on-surface">13</td><td class="px-6 py-4 font-label-sm text-right font-mono text-on-surface">12</td></tr><tr><td class="px-6 py-4 font-body-md font-bold text-on-surface">Shots on Target</td><td class="px-6 py-4 font-label-sm text-center font-mono text-on-surface">6</td><td class="px-6 py-4 font-label-sm text-right font-mono text-on-surface">3</td></tr><tr><td class="px-6 py-4 font-body-md font-bold text-on-surface">Corners</td><td class="px-6 py-4 font-label-sm text-center font-mono text-on-surface">8</td><td class="px-6 py-4 font-label-sm text-right font-mono text-on-surface">9</td></tr></tbody></table></div>' },
    { id: 12, title: 'Southgate Faces Selection Dilemma Ahead of Opener', category: 'Euro 2024', section: 'world-cup', author: 'Dave Hytner', authorRole: 'Senior Writer', authorAvatar: IMG.keeper, image: IMG.keeper, readTime: 4, date: daysAgo(2), featured: false, highlight: false, trending: false, excerpt: 'An embarrassment of attacking riches leaves the England boss with tough calls to make.', body: '<p>Gareth Southgate has a good problem: too much talent. With his forward line overflowing with options, someone world-class is going to miss out.</p><p>We assess the likely starting XI and the players who could feel unlucky come the tournament opener.</p>' },
    { id: 13, title: 'Premier League Clubs Vote on Spending Cap Proposal', category: 'Financials', section: 'news', author: 'Sarah Jones', authorRole: 'Finance Correspondent', authorAvatar: IMG.jersey, image: IMG.jersey, readTime: 7, date: daysAgo(3), featured: false, highlight: false, trending: false, excerpt: 'A landmark vote could reshape the financial landscape of English football for a generation.', body: '<p>Premier League clubs gathered to vote on a proposed spending cap tied to broadcast revenue — a move that could fundamentally alter competitive balance in the world\'s richest league.</p><p>The proposal has divided opinion, with some clubs championing sustainability and others warning of unintended consequences.</p>' },
    { id: 14, title: 'Five Breakout Stars to Watch in the Eredivisie', category: 'Scouting', section: 'features', author: 'Lars Bakker', authorRole: 'Scouting Editor', authorAvatar: IMG.corner, image: IMG.corner, readTime: 5, date: daysAgo(3), featured: false, highlight: false, trending: false, excerpt: 'The Dutch top flight remains a conveyor belt of elite young talent. Here are the names to know.', body: '<p>The Eredivisie has long been Europe\'s finest finishing school for young footballers. This season\'s crop is as exciting as any in recent memory.</p><p>From silky playmakers to ruthless finishers, these five are already on the radar of the continent\'s biggest clubs.</p>' },
    { id: 15, title: 'The Evolution of the Inverted Wing-Back', category: 'Tactics', section: 'features', author: 'Michael Cox', authorRole: 'Tactics Writer', authorAvatar: IMG.keeper, image: IMG.keeper, readTime: 10, date: daysAgo(4), featured: false, highlight: false, trending: false, excerpt: 'How a single positional tweak rewired the way elite teams build and defend.', body: '<p>The inverted wing-back is one of modern football\'s defining tactical innovations. By stepping infield, the full-back becomes an extra midfielder — controlling the game and protecting against the counter.</p><p>We chart the idea\'s rise from a Guardiola experiment to a leaguewide standard.</p>' },
    { id: 16, title: 'Mbappe Announcement Expected Within 48 Hours', category: 'Transfers', section: 'transfers', author: 'David Ornstein', authorRole: 'Transfer Insider', authorAvatar: IMG.keeper, image: IMG.keeper, readTime: 3, date: daysAgo(0), featured: false, highlight: false, trending: true, excerpt: 'All parties are aligned and an official statement is imminent, sources say.', body: '<p>The saga is nearing its end. Sources indicate an official announcement regarding Kylian Mbappe\'s future is expected within the next 48 hours, with all sides now aligned on terms.</p>' },
    { id: 17, title: 'Manchester City Reveal New Home Kit for 2024/25 Season', category: 'Premier League', section: 'news', author: 'Sarah Jenkins', authorRole: 'News Reporter', authorAvatar: IMG.jersey, image: IMG.jersey, readTime: 5, date: daysAgo(1), featured: false, highlight: false, trending: true, excerpt: 'A modern reinterpretation of a classic sky-blue design has divided the fanbase.', body: '<p>Manchester City have unveiled their home kit for the new campaign, pairing the iconic sky blue with subtle design nods to the club\'s history. Reaction among supporters has been characteristically split.</p>' },
    { id: 18, title: 'Hansi Flick Sets Sights on Barcelona Rebuild', category: 'La Liga', section: 'leagues', author: 'Sid Lowe', authorRole: 'European Analyst', authorAvatar: IMG.corner, image: IMG.corner, readTime: 4, date: daysAgo(1), featured: false, highlight: false, trending: true, excerpt: 'The German coach arrives with a clear plan to restore identity and youth to the Camp Nou.', body: '<p>Hansi Flick has wasted no time outlining his vision for a Barcelona rebuild centred on pressing intensity and academy talent. The German is under no illusions about the scale of the task.</p>' }
  ]
};

/* ------------------------------------------------------------------ *
 * Persistence (KV on serverless, db.json locally). `db` is loaded per
 * request via ensureDB() so it works statelessly on Vercel.
 * ------------------------------------------------------------------ */
let db = null;
let dbLoadedAt = 0;
// ponytail: re-read the shared Blob/KV DB at most once per DB_TTL_MS. Without this, warm
// serverless instances load the DB once and serve stale data forever after another instance
// writes (a published post 404s on every instance except the writer). 3s trades a tiny blob
// read for near-real-time consistency; raise it if blob reads ever get costly.
const DB_TTL_MS = 3000;
function migrate(d) {
  let changed = false;
  if (!d.admin || (!d.admin.passHash && !d.admin.password)) { d.admin = seedAdmin(); changed = true; }
  if (!d.categories) { d.categories = JSON.parse(JSON.stringify(SEED.categories)); changed = true; }
  if (!d.pages) { d.pages = JSON.parse(JSON.stringify(SEED.pages)); changed = true; }
  if (d.nextCatId == null) { d.nextCatId = SEED.nextCatId; changed = true; }
  if (d.nextPageId == null) { d.nextPageId = SEED.nextPageId; changed = true; }
  if (!d.settings) { d.settings = JSON.parse(JSON.stringify(SEED.settings)); changed = true; }
  if (!d.settings.nav) { d.settings.nav = JSON.parse(JSON.stringify(SEED.settings.nav)); changed = true; }
  if (!Array.isArray(d.posts)) { d.posts = []; changed = true; }
  if (d.nextId == null) { d.nextId = SEED.nextId; changed = true; }
  // Convert any legacy plaintext admin password into a scrypt hash, then drop it.
  if (d.admin && d.admin.password) {
    const hp = hashPassword(d.admin.password);
    d.admin.passSalt = hp.salt; d.admin.passHash = hp.hash; delete d.admin.password; changed = true;
  }
  d.posts.forEach(function (p) {
    if (!p.status) { p.status = 'published'; changed = true; }
    if (!Array.isArray(p.categories)) { p.categories = p.category ? [p.category] : []; changed = true; }
  });
  return changed;
}
// When there's no KV but there IS a Blob store (typical Vercel setup here),
// the whole database is stored as a single JSON object in Blob. Admin secrets
// are stripped before writing, since the Blob store is public.
const USE_BLOB_DB = USE_BLOB && !USE_KV;
const BLOB_DB_PATH = 'data/trendyinus-db.json';
async function readRawDB() {
  if (USE_KV) { try { return await kvCommand(['GET', 'db']); } catch (_e) { return null; } }
  if (USE_BLOB_DB) {
    try {
      const listed = await blobApi.list({ prefix: BLOB_DB_PATH, token: process.env.BLOB_READ_WRITE_TOKEN });
      const hit = (listed.blobs || []).find((b) => b.pathname === BLOB_DB_PATH) || (listed.blobs || [])[0];
      if (!hit) return null;
      const r = await fetch(hit.url + (hit.url.indexOf('?') === -1 ? '?' : '&') + 'cb=' + Date.now(), { cache: 'no-store' });
      return await r.text();
    } catch (_e) { return null; }
  }
  try { return fs.readFileSync(DB_PATH, 'utf8'); } catch (_e) { return null; }
}
async function ensureDB() {
  if (db && (Date.now() - dbLoadedAt) < DB_TTL_MS) return; // serve from memory within the TTL, then re-read
  const raw = await readRawDB();
  let obj = null;
  try { obj = raw ? JSON.parse(raw) : null; } catch (_e) { obj = null; }
  let fresh = false;
  if (!obj) { obj = JSON.parse(JSON.stringify(SEED)); obj.posts = []; fresh = true; }
  const changed = migrate(obj);
  db = obj;
  dbLoadedAt = Date.now();
  if (fresh || changed) await saveDB();
}
async function saveDB() {
  dbLoadedAt = Date.now(); // just-written in-memory db is the freshest copy; don't re-read over it within the TTL
  if (USE_KV) { try { await kvCommand(['SET', 'db', JSON.stringify(db)]); } catch (_e) {} return; }
  if (USE_BLOB_DB) {
    const persist = Object.assign({}, db); delete persist.admin; // never write admin creds to a public Blob
    try { await blobApi.put(BLOB_DB_PATH, JSON.stringify(persist), { access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0, allowOverwrite: true, token: process.env.BLOB_READ_WRITE_TOKEN }); } catch (_e) {}
    return;
  }
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB_PATH, JSON.stringify(db)); } catch (_e) {}
}

/* ------------------------------------------------------------------ *
 * Auth — stateless JWT (HMAC-SHA256), so it works across serverless
 * invocations with no shared memory.
 * ------------------------------------------------------------------ */
const MAX_LOGIN_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginState = {}; // local fallback for the lockout counter
function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function signToken(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(crypto.createHmac('sha256', SESSION_SECRET).update(body).digest());
  return body + '.' + sig;
}
function verifyToken(t) {
  if (!t) return null;
  const i = t.lastIndexOf('.'); if (i < 1) return null;
  const body = t.slice(0, i), sig = t.slice(i + 1);
  const expect = b64u(crypto.createHmac('sha256', SESSION_SECRET).update(body).digest());
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); if (p.exp && Date.now() > p.exp) return null; return p; } catch (_e) { return null; }
}
function isAuthed(req) {
  const h = req.headers['authorization'] || '';
  return !!verifyToken(h.replace(/^Bearer\s+/i, ''));
}
async function getLock(key) {
  if (USE_KV) { try { const v = await kvCommand(['GET', 'lock:' + key]); return v ? JSON.parse(v) : { fails: 0, lockUntil: 0 }; } catch (_e) { return { fails: 0, lockUntil: 0 }; } }
  return loginState[key] || (loginState[key] = { fails: 0, lockUntil: 0 });
}
async function setLock(key, st) {
  if (USE_KV) { try { await kvCommand(['SET', 'lock:' + key, JSON.stringify(st), 'EX', String(Math.ceil(LOGIN_LOCK_MS / 1000) * 2)]); } catch (_e) {} return; }
  loginState[key] = st;
}

/* ------------------------------------------------------------------ *
 * HTTP helpers
 * ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2'
};
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
// Reject payloads that are too deeply nested or have oversized arrays/objects,
// so a malicious body can't exhaust CPU/memory during traversal.
function checkJsonLimits(v, depth) {
  if (depth > 40) throw Object.assign(new Error('JSON nested too deep'), { httpCode: 413 });
  if (Array.isArray(v)) {
    if (v.length > 5000) throw Object.assign(new Error('Array exceeds 5000-item limit'), { httpCode: 413 });
    for (let i = 0; i < v.length; i++) checkJsonLimits(v[i], depth + 1);
  } else if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length > 500) throw Object.assign(new Error('Object exceeds 500-key limit'), { httpCode: 413 });
    for (let i = 0; i < keys.length; i++) checkJsonLimits(v[keys[i]], depth + 1);
  }
}
function readBody(req, maxBytes) {
  maxBytes = maxBytes || 1048576; // 1 MB default for JSON API bodies
  // Some serverless runtimes (Vercel) pre-buffer/parse the body onto req.body.
  if (req.body !== undefined && req.body !== null) {
    let parsed = req.body;
    if (Buffer.isBuffer(parsed)) parsed = parsed.toString('utf8');
    if (typeof parsed === 'string') { try { parsed = parsed ? JSON.parse(parsed) : {}; } catch (_e) { parsed = {}; } }
    try { checkJsonLimits(parsed, 0); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(parsed || {});
  }
  return new Promise((resolve, reject) => {
    let len = 0; const chunks = []; let done = false;
    req.on('data', (c) => {
      if (done) return;
      len += c.length;
      if (len > maxBytes) { done = true; try { req.pause(); } catch (_e) {} reject(Object.assign(new Error('Request body too large'), { httpCode: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (done) return; done = true;
      const data = Buffer.concat(chunks).toString('utf8');
      if (!data) return resolve({});
      let parsed; try { parsed = JSON.parse(data); } catch (_e) { return resolve({}); }
      try { checkJsonLimits(parsed, 0); } catch (e) { return reject(e); }
      resolve(parsed);
    });
    req.on('error', () => { if (!done) { done = true; resolve({}); } });
  });
}

/* ------------------------------------------------------------------ *
 * Live scores — proxied from free, keyless football APIs (TheSportsDB
 * test key "3" for today's fixtures/results, cached to respect limits).
 * ------------------------------------------------------------------ */
const TSDB = 'https://www.thesportsdb.com/api/v1/json/3/';
const LS_LEAGUES = [4328, 4335, 4332, 4331, 4334, 4480, 4346]; // EPL, LaLiga, SerieA, Bundesliga, Ligue1, UCL, MLS
const lsCache = { time: 0, data: null };

function httpsJSON(u) {
  return new Promise((resolve) => {
    const req = https.get(u, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 TrendyinUS' } }, (x) => {
      let d = ''; x.on('data', (c) => { d += c; }); x.on('end', () => { try { resolve(JSON.parse(d)); } catch (_e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
function classifyStatus(s) {
  s = String(s || '').trim().toUpperCase();
  if (['FT', 'AET', 'PEN', 'FT_PEN', 'MATCH FINISHED', 'AWARDED', 'FINISHED'].indexOf(s) !== -1) return 'finished';
  if (['NS', 'NOT STARTED', '', 'TBD', 'POSTP', 'PPD', 'CANC', 'ABD', 'SUSP', 'SCHEDULED'].indexOf(s) !== -1) return 'upcoming';
  return 'live'; // 1H, 2H, HT, ET, BT, P, LIVE, or a minute
}
function normEvent(e) {
  return {
    home: e.strHomeTeam || '', away: e.strAwayTeam || '',
    homeScore: e.intHomeScore != null ? String(e.intHomeScore) : '',
    awayScore: e.intAwayScore != null ? String(e.intAwayScore) : '',
    status: e.strStatus || '', progress: e.strProgress || '',
    league: e.strLeague || '', leagueBadge: e.strLeagueBadge || '',
    homeBadge: e.strHomeTeamBadge || '', awayBadge: e.strAwayTeamBadge || '',
    kickoff: e.strTimestamp || (e.dateEvent ? e.dateEvent + 'T' + (e.strTime || '00:00:00') : ''),
    venue: e.strVenue || '', homeScorers: [], awayScorers: []
  };
}
function ymd(d) { return d.toISOString().slice(0, 10); }
async function buildLiveScores() {
  if (lsCache.data && Date.now() - lsCache.time < 60000) return lsCache.data;
  const now = new Date();
  const days = [ymd(now), ymd(new Date(now.getTime() + 864e5))];
  let events = [];
  for (const d of days) {
    const j = await httpsJSON(TSDB + 'eventsday.php?d=' + d + '&s=Soccer');
    if (j && j.events) events = events.concat(j.events);
  }
  const live = [], results = [], upcoming = [];
  events.forEach((e) => {
    const n = normEvent(e), c = classifyStatus(e.strStatus);
    if (c === 'live') live.push(n); else if (c === 'finished') results.push(n); else upcoming.push(n);
  });
  // Add curated upcoming fixtures from top leagues.
  for (const id of LS_LEAGUES) {
    const j = await httpsJSON(TSDB + 'eventsnextleague.php?id=' + id);
    if (j && j.events) j.events.forEach((e) => upcoming.push(normEvent(e)));
  }
  // De-dupe + sort.
  const seen = {};
  const uniqUp = upcoming.filter((m) => { const k = m.home + '|' + m.away + '|' + m.kickoff; if (seen[k]) return false; seen[k] = 1; return true; })
    .filter((m) => m.kickoff && new Date(m.kickoff) >= new Date(Date.now() - 36e5))
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const data = {
    updated: new Date().toISOString(),
    live: live.sort((a, b) => (a.league || '').localeCompare(b.league || '')),
    results: results.slice(0, 20),
    upcoming: uniqUp.slice(0, 30)
  };
  lsCache.time = Date.now(); lsCache.data = data;
  return data;
}

/* ------------------------------------------------------------------ *
 * API
 * ------------------------------------------------------------------ */
async function handleApi(req, res, pathname) {
  const method = req.method.toUpperCase();

  // --- auth ---
  if (pathname === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    const key = (b.deviceId && String(b.deviceId).slice(0, 64)) ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    const st = await getLock(key);
    if (st.lockUntil > now) {
      const mins = Math.ceil((st.lockUntil - now) / 60000);
      return sendJSON(res, 429, { error: 'Too many failed attempts. This device is locked for ' + mins + ' more minute' + (mins === 1 ? '' : 's') + '.', locked: true });
    }
    const inUser = String(b.username || '').trim();
    const inPass = String(b.password || '').trim();
    if (inUser.toLowerCase() === String(db.admin.username).toLowerCase() && verifyPassword(inPass, db.admin.passSalt, db.admin.passHash)) {
      await setLock(key, { fails: 0, lockUntil: 0 });
      const token = signToken({ u: db.admin.username, exp: Date.now() + 8 * 3600 * 1000 });
      return sendJSON(res, 200, { token, username: db.admin.username });
    }
    st.fails++;
    const left = MAX_LOGIN_FAILS - st.fails;
    if (left <= 0) {
      await setLock(key, { fails: 0, lockUntil: now + LOGIN_LOCK_MS });
      return sendJSON(res, 429, { error: 'Too many failed attempts. This device is locked for ' + Math.ceil(LOGIN_LOCK_MS / 60000) + ' minutes.', locked: true });
    }
    await setLock(key, st);
    return sendJSON(res, 401, { error: 'Invalid username or password. ' + left + ' attempt' + (left === 1 ? '' : 's') + ' left before this device is locked.' });
  }
  if (pathname === '/api/logout' && method === 'POST') {
    // Stateless JWT — the client discards the token; nothing to invalidate server-side.
    return sendJSON(res, 200, { ok: true });
  }
  if (pathname === '/api/me' && method === 'GET') {
    return sendJSON(res, 200, { authed: isAuthed(req), username: db.admin.username });
  }

  // --- public reads ---
  if (pathname === '/api/settings' && method === 'GET') {
    return sendJSON(res, 200, db.settings);
  }
  if (pathname === '/api/livescores' && method === 'GET') {
    try {
      const data = await buildLiveScores();
      const lm = db.settings.liveMatch || {};
      let live = (data.live || []).slice();
      // Admin can pin a featured LIVE match (Settings → Live Match Widget).
      if (lm.live && lm.home && lm.away) {
        live.unshift({
          home: lm.home, away: lm.away,
          homeScore: lm.homeScore != null ? String(lm.homeScore) : '', awayScore: lm.awayScore != null ? String(lm.awayScore) : '',
          status: lm.status || 'LIVE', progress: '', league: lm.league || 'Featured Match',
          leagueBadge: '', homeBadge: lm.homeBadge || '', awayBadge: lm.awayBadge || '', kickoff: '', venue: '',
          homeScorers: Array.isArray(lm.homeScorers) ? lm.homeScorers : [], awayScorers: Array.isArray(lm.awayScorers) ? lm.awayScorers : []
        });
      }
      return sendJSON(res, 200, Object.assign({}, data, { live: live }));
    } catch (_e) { return sendJSON(res, 200, { updated: new Date().toISOString(), live: [], results: [], upcoming: [], error: 'unavailable' }); }
  }
  if (pathname === '/api/posts' && method === 'GET') {
    const q = url.parse(req.url, true).query;
    const authed = isAuthed(req);
    let list = db.posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!authed) list = list.filter(isVisible); // hide drafts + not-yet-due scheduled posts publicly
    if (q.section) list = list.filter((p) => p.section === q.section);
    if (q.trending) list = list.filter((p) => p.trending);
    if (q.featured) list = list.filter((p) => p.featured);
    if (q.highlight) list = list.filter((p) => p.highlight);
    if (q.limit) list = list.slice(0, parseInt(q.limit, 10) || list.length);
    return sendJSON(res, 200, list);
  }
  const single = pathname.match(/^\/api\/posts\/(\d+)$/);
  if (single && method === 'GET') {
    const post = db.posts.find((p) => p.id === parseInt(single[1], 10));
    return post ? sendJSON(res, 200, post) : sendJSON(res, 404, { error: 'Not found' });
  }
  if (pathname === '/api/categories' && method === 'GET') {
    return sendJSON(res, 200, db.categories);
  }
  if (pathname === '/api/pages' && method === 'GET') {
    return sendJSON(res, 200, db.pages);
  }
  const pageSlug = pathname.match(/^\/api\/pages\/([a-z0-9-]+)$/i);
  if (pageSlug && method === 'GET' && !/^\d+$/.test(pageSlug[1])) {
    const pg = db.pages.find((p) => p.slug === pageSlug[1]);
    return pg ? sendJSON(res, 200, pg) : sendJSON(res, 404, { error: 'Not found' });
  }

  // --- everything below requires auth ---
  if (!isAuthed(req)) return sendJSON(res, 401, { error: 'Unauthorized' });

  if (pathname === '/api/settings' && method === 'PUT') {
    const b = await readBody(req);
    db.settings = Object.assign({}, db.settings, b);
    await saveDB();
    return sendJSON(res, 200, db.settings);
  }
  if (pathname === '/api/account' && method === 'PUT') {
    const b = await readBody(req);
    if (b.username) db.admin.username = String(b.username).trim();
    if (b.password) { const hp = hashPassword(String(b.password).trim()); db.admin.passSalt = hp.salt; db.admin.passHash = hp.hash; delete db.admin.password; }
    await saveDB();
    return sendJSON(res, 200, { ok: true });
  }
  if (pathname === '/api/posts' && method === 'POST') {
    const b = await readBody(req);
    const post = normalizePost(b, { id: db.nextId++ });
    db.posts.push(post);
    await saveDB();
    return sendJSON(res, 201, post);
  }
  if (single && method === 'PUT') {
    const id = parseInt(single[1], 10);
    const idx = db.posts.findIndex((p) => p.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    const b = await readBody(req);
    db.posts[idx] = normalizePost(Object.assign({}, db.posts[idx], b), { id });
    await saveDB();
    return sendJSON(res, 200, db.posts[idx]);
  }
  if (single && method === 'DELETE') {
    const id = parseInt(single[1], 10);
    const before = db.posts.length;
    db.posts = db.posts.filter((p) => p.id !== id);
    await saveDB();
    return sendJSON(res, 200, { deleted: before - db.posts.length });
  }
  if (pathname === '/api/upload' && method === 'POST') {
    const b = await readBody(req, 12 * 1024 * 1024); // allow up to ~12 MB request for base64 images
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(b.dataUrl || '');
    if (!m) return sendJSON(res, 400, { error: 'Expected a base64 image data URL' });
    const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' }[m[1]];
    if (!ext) return sendJSON(res, 400, { error: 'Unsupported image type' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) return sendJSON(res, 413, { error: 'Image exceeds the 8 MB limit' });
    const name = crypto.randomBytes(8).toString('hex') + ext;
    if (USE_BLOB) {
      const put = await blobApi.put('uploads/' + name, buf, { access: 'public', contentType: m[1], token: process.env.BLOB_READ_WRITE_TOKEN });
      return sendJSON(res, 201, { url: put.url });
    }
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return sendJSON(res, 201, { url: '/uploads/' + name });
  }

  // --- categories (auth) ---
  if (pathname === '/api/categories' && method === 'POST') {
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    if (!name) return sendJSON(res, 400, { error: 'Name required' });
    const cat = { id: db.nextCatId++, name: name, slug: slugify(b.slug || name) };
    db.categories.push(cat); await saveDB();
    return sendJSON(res, 201, cat);
  }
  const catId = pathname.match(/^\/api\/categories\/(\d+)$/);
  if (catId && method === 'PUT') {
    const c = db.categories.find((x) => x.id === parseInt(catId[1], 10));
    if (!c) return sendJSON(res, 404, { error: 'Not found' });
    const b = await readBody(req);
    if (b.name != null) c.name = String(b.name).trim();
    c.slug = slugify(b.slug || c.slug || c.name);
    await saveDB();
    return sendJSON(res, 200, c);
  }
  if (catId && method === 'DELETE') {
    const id = parseInt(catId[1], 10);
    const before = db.categories.length;
    db.categories = db.categories.filter((c) => c.id !== id);
    await saveDB();
    return sendJSON(res, 200, { deleted: before - db.categories.length });
  }

  // --- pages (auth) ---
  if (pathname === '/api/pages' && method === 'POST') {
    const b = await readBody(req);
    const page = normalizePage(b, { id: db.nextPageId++ });
    db.pages.push(page); await saveDB();
    return sendJSON(res, 201, page);
  }
  const pageId = pathname.match(/^\/api\/pages\/(\d+)$/);
  if (pageId && method === 'PUT') {
    const idx = db.pages.findIndex((p) => p.id === parseInt(pageId[1], 10));
    if (idx === -1) return sendJSON(res, 404, { error: 'Not found' });
    const b = await readBody(req);
    db.pages[idx] = normalizePage(Object.assign({}, db.pages[idx], b), { id: db.pages[idx].id });
    await saveDB();
    return sendJSON(res, 200, db.pages[idx]);
  }
  if (pageId && method === 'DELETE') {
    const id = parseInt(pageId[1], 10);
    const before = db.pages.length;
    db.pages = db.pages.filter((p) => p.id !== id);
    await saveDB();
    return sendJSON(res, 200, { deleted: before - db.pages.length });
  }

  // --- media library (auth) ---
  if (pathname === '/api/media' && method === 'GET') {
    let files = [];
    if (USE_BLOB) {
      try {
        const listed = await blobApi.list({ prefix: 'uploads/', token: process.env.BLOB_READ_WRITE_TOKEN });
        files = (listed.blobs || []).map((b) => ({ url: b.url, name: (b.pathname || '').replace(/^uploads\//, ''), del: b.url, mtime: +new Date(b.uploadedAt || Date.now()) })).sort((a, b) => b.mtime - a.mtime);
      } catch (_e) {}
    } else {
      try {
        files = fs.readdirSync(UPLOAD_DIR)
          .map((f) => ({ url: '/uploads/' + f, name: f, del: f, mtime: fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
      } catch (_e) {}
    }
    return sendJSON(res, 200, files);
  }
  if (pathname === '/api/media' && method === 'DELETE') {
    const del = String((url.parse(req.url, true).query.del) || '');
    if (/^https?:/i.test(del)) { if (USE_BLOB) { try { await blobApi.del(del, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch (_e) {} } }
    else if (del) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(del))); } catch (_e) {} }
    return sendJSON(res, 200, { ok: true });
  }

  return sendJSON(res, 404, { error: 'Unknown endpoint' });
}

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}
function normalizePage(input, over) {
  const p = Object.assign({ title: 'Untitled Page', slug: '', body: '', showInFooter: false }, input, over);
  p.slug = slugify(p.slug || p.title);
  p.showInFooter = !!p.showInFooter;
  return p;
}

function normalizePost(input, over) {
  const p = Object.assign({
    title: 'Untitled', category: 'News', section: 'news', author: 'TrendyinUS Staff',
    authorRole: 'Staff Writer', authorAvatar: '', image: '', readTime: 5, date: new Date().toISOString(),
    featured: false, highlight: false, trending: false, excerpt: '', body: '', caption: '', tags: [],
    status: 'published', categories: []
  }, input, over);
  p.readTime = parseInt(p.readTime, 10) || 5;
  p.featured = !!p.featured; p.highlight = !!p.highlight; p.trending = !!p.trending;
  if (typeof p.tags === 'string') p.tags = p.tags.split(',').map((s) => s.trim()).filter(Boolean);
  if (typeof p.categories === 'string') p.categories = p.categories.split(',').map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(p.categories)) p.categories = [];
  if (!p.categories.length && p.category) p.categories = [p.category];
  p.category = p.categories[0] || p.category || 'News'; // primary = badge label
  if (['published', 'draft', 'scheduled'].indexOf(p.status) === -1) p.status = 'published';
  return p;
}

// A post is publicly visible unless it's a draft or a scheduled/future-dated post whose time hasn't arrived.
function isVisible(p) {
  if ((p.status || 'published') === 'draft') return false;
  return new Date(p.date).getTime() <= Date.now();
}

/* ------------------------------------------------------------------ *
 * Static files
 * ------------------------------------------------------------------ */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  let filePath, baseDir;
  if (rel.indexOf('/uploads/') === 0) { baseDir = UPLOAD_DIR; filePath = path.normalize(path.join(UPLOAD_DIR, rel.slice('/uploads/'.length))); }
  else { baseDir = ROOT; filePath = path.normalize(path.join(ROOT, rel)); }
  if (!filePath.startsWith(baseDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA-ish fallback: unknown non-file paths -> home
      if (!path.extname(filePath)) {
        return fs.readFile(path.join(ROOT, 'index.html'), (e, buf) => {
          if (e) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(buf);
        });
      }
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ------------------------------------------------------------------ *
 * robots.txt + sitemap.xml (generated live from the current content)
 * ------------------------------------------------------------------ */
function siteBase(req) {
  const host = req.headers['host'] || 'trendyinus.com';
  const proto = req.headers['x-forwarded-proto'] || (/^localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https');
  return proto + '://' + host;
}
function buildRobots(base) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin.html',
    'Disallow: /api/',
    'Disallow: /uploads/',
    '',
    'Sitemap: ' + base + '/sitemap.xml',
    ''
  ].join('\n');
}
function buildSitemap(base) {
  const now = new Date().toISOString();
  const urls = [];
  const add = (loc, freq, pri) => urls.push({ loc: loc, freq: freq, pri: pri });
  add(base + '/', 'daily', '1.0');
  ['live-scores', 'soccer', 'mlb', 'nfl', 'wnba', 'tennis', 'wwe', 'others'].forEach((s) => add(base + '/' + s + '.html', 'daily', '0.7'));
  db.pages.forEach((p) => add(base + '/page.html?p=' + encodeURIComponent(p.slug), 'monthly', '0.4'));
  db.posts.filter(isVisible).forEach((p) => add(base + '/article.html?id=' + p.id, 'weekly', '0.6'));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url><loc>' + u.loc + '</loc><lastmod>' + now + '</lastmod><changefreq>' + u.freq + '</changefreq><priority>' + u.pri + '</priority></url>').join('\n') +
    '\n</urlset>\n';
}

/* ------------------------------------------------------------------ *
 * Request handler — exported for Vercel (serverless) and used by the
 * local http server below. Loads the DB per request so it is stateless.
 * ------------------------------------------------------------------ */
async function requestHandler(req, res) {
  const pathname = url.parse(req.url).pathname;
  const dynamic = pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname.startsWith('/api/');
  try {
    if (dynamic) await ensureDB();
    if (pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(buildRobots(siteBase(req)));
    }
    if (pathname === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      return res.end(buildSitemap(siteBase(req)));
    }
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    return serveStatic(req, res, pathname); // local only; on Vercel static files are served by the platform
  } catch (e) {
    const code = (e && e.httpCode) || 500;
    if (!res.headersSent) sendJSON(res, code, { error: String(e && e.message || e) });
  }
}

// Ensure Vercel's file tracer (@vercel/nft) bundles the static files that
// serveStatic reads at runtime — each literal path below is picked up statically.
try {
  fs.statSync(path.join(__dirname, 'index.html'));
  fs.statSync(path.join(__dirname, 'admin.html'));
  fs.statSync(path.join(__dirname, 'article.html'));
  fs.statSync(path.join(__dirname, 'news.html'));
  fs.statSync(path.join(__dirname, 'transfers.html'));
  fs.statSync(path.join(__dirname, 'world-cup.html'));
  fs.statSync(path.join(__dirname, 'leagues.html'));
  fs.statSync(path.join(__dirname, 'features.html'));
  fs.statSync(path.join(__dirname, 'live-scores.html'));
  fs.statSync(path.join(__dirname, 'podcasts.html'));
  fs.statSync(path.join(__dirname, 'page.html'));
  fs.statSync(path.join(__dirname, 'soccer.html'));
  fs.statSync(path.join(__dirname, 'mlb.html'));
  fs.statSync(path.join(__dirname, 'nfl.html'));
  fs.statSync(path.join(__dirname, 'wnba.html'));
  fs.statSync(path.join(__dirname, 'tennis.html'));
  fs.statSync(path.join(__dirname, 'wwe.html'));
  fs.statSync(path.join(__dirname, 'others.html'));
  fs.statSync(path.join(__dirname, 'assets/site.js'));
  fs.statSync(path.join(__dirname, 'assets/admin.js'));
  fs.statSync(path.join(__dirname, 'assets/theme.css'));
  fs.statSync(path.join(__dirname, 'assets/tw-config.js'));
  fs.statSync(path.join(__dirname, 'assets/logo.svg'));
  fs.statSync(path.join(__dirname, 'assets/favicon.svg'));
} catch (_e) {}

module.exports = requestHandler;

// Run a real HTTP server only when executed directly (local dev / Node hosts).
if (require.main === module) {
  http.createServer(requestHandler).listen(PORT, () => {
    console.log('TrendyinUS running at http://localhost:' + PORT);
    console.log('Admin panel:            http://localhost:' + PORT + '/admin.html');
    console.log('Storage: ' + (USE_KV ? 'Vercel KV' : 'local db.json') + ' | Uploads: ' + (USE_BLOB ? 'Vercel Blob' : 'local /uploads'));
  });
}
