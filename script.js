/* Cosmos — vanilla JS interactions (no framework) */
(function () {
  'use strict';

  /* ---------- Starfield ---------- */
  var canvas = document.getElementById('starfield');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    var stars = [];
    function resize() {
      var hero = canvas.parentElement;
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    }
    function init() {
      resize();
      stars = [];
      var n = Math.min(220, Math.floor(canvas.width / 6));
      for (var i = 0; i < n; i++) {
        stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.4 + .3, s: Math.random() * .4 + .05, tw: Math.random() * Math.PI * 2 });
      }
    }
    function tick(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.y += st.s; st.tw += .02;
        if (st.y > canvas.height) { st.y = 0; st.x = Math.random() * canvas.width; }
        var a = .35 + Math.abs(Math.sin(st.tw)) * .65;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#F5F7FA';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    }
    init(); requestAnimationFrame(tick);
    window.addEventListener('resize', init);
  }

  /* ---------- Navbar / mobile menu ---------- */
  var burger = document.getElementById('hamburger');
  var menu = document.getElementById('mobileMenu');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.classList.remove('open'); });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ---------- Phone tilt ---------- */
  var tilt = document.getElementById('phoneTilt');
  var phone = tilt ? tilt.querySelector('.phone') : null;
  if (tilt && phone && window.innerWidth > 640) {
    tilt.addEventListener('mousemove', function (e) {
      var r = tilt.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - .5;
      var dy = (e.clientY - r.top) / r.height - .5;
      phone.style.transform = 'rotateY(' + (-14 + dx * 16) + 'deg) rotateX(' + (4 - dy * 12) + 'deg)';
    });
    tilt.addEventListener('mouseleave', function () { phone.style.transform = ''; });
  }

  /* ---------- Jobs (ISSUE.md data) ---------- */
  function formatRupiah(n) {
    return 'Rp' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  var JOBS = [
    { emoji: '⛏️', name: 'Coal Miner', base: 233333, cooldown: '24 hours', req: 'Pickaxe', desc: 'Daily shift in the Coal Mine. Steady ore, steady pay.', risk: 'High variance', riskCls: 'med' },
    { emoji: '⛏️', name: 'Iron Miner', base: 166666, cooldown: '24 hours', req: 'Pickaxe', desc: 'Daily shift. Lower base, reliable veins.', risk: 'Medium', riskCls: 'med' },
    { emoji: '🪙', name: 'Gold Miner', base: 333333, cooldown: '24 hours', req: 'Pickaxe', desc: 'Daily shift. Rich veins, higher competition.', risk: 'High variance', riskCls: 'high' },
    { emoji: '💎', name: 'Diamond Miner', base: 666666, cooldown: '24 hours', req: 'Pickaxe', desc: 'Diamond Cave expedition. Highest mining payout.', risk: 'Very high risk', riskCls: 'high' },
    { emoji: '💻', name: 'Office Work', base: 250000, cooldown: '24 hours', req: 'MacBook', desc: 'Stable daily salary. The reliable 9-to-5 path.', risk: 'Low risk', riskCls: 'low' },
    { emoji: '🚕', name: 'Taxi Driving', base: 133333, cooldown: '24 hours', req: "Driver's License", desc: 'Daily shift ferrying passengers across town.', risk: 'Low risk', riskCls: 'low' },
    { emoji: '🍳', name: 'Cooking', base: 150000, cooldown: '24 hours', req: 'No item', desc: 'Daily kitchen shift. No tools required.', risk: 'Low risk', riskCls: 'low' },
    { emoji: '🛵', name: 'Gojek', base: 2500, cooldown: '1 hour (gig)', req: 'No item', desc: 'Gig economy: ~Rp2.500/hour, claim every hour (~Rp60.000/day).', risk: 'Flexible', riskCls: 'low' },
    { emoji: '📊', name: 'Entrepreneurship', base: 1250000, cooldown: '7 days (weekly)', req: 'Investment + MacBook/iPhone', desc: 'Weekly dividends. Huge upside, chance to fail or lose.', risk: 'Very high risk', riskCls: 'high' }
  ];
  var grid = document.getElementById('jobsGrid');
  var mult = 1.0;
  function renderJobs() {
    if (!grid) return;
    grid.innerHTML = JOBS.map(function (j) {
      return '<div class="card job-card reveal visible">' +
        '<div class="job-top"><span class="job-emoji">' + j.emoji + '</span>' +
        '<span class="cooldown">' + j.cooldown + '</span></div>' +
        '<h3>' + j.name + '</h3>' +
        '<div class="job-salary" data-base="' + j.base + '">' + formatRupiah(j.base * mult) + '</div>' +
        '<div class="job-req">Requires: <b>' + j.req + '</b> + ID Card</div>' +
        '<p class="job-desc muted">' + j.desc + '</p>' +
        '<span class="risk ' + j.riskCls + '">● ' + j.risk + '</span></div>';
    }).join('');
  }
  renderJobs();

  var slider = document.getElementById('multSlider');
  var multVal = document.getElementById('multVal');
  if (slider) {
    slider.addEventListener('input', function () {
      mult = slider.value / 100;
      if (multVal) multVal.textContent = mult.toFixed(2) + '×';
      document.querySelectorAll('.job-salary').forEach(function (el) {
        el.textContent = formatRupiah(parseFloat(el.getAttribute('data-base')) * mult);
      });
      updateDemo();
    });
  }

  /* Demo .work reply */
  var demoJob = document.getElementById('demoJob');
  var demoReply = document.getElementById('demoReply');
  var demoBtn = document.getElementById('demoWork');
  function updateDemo() {
    if (!demoJob || !demoReply) return;
    var job = JOBS.find(function (j) { return j.name === demoJob.value; }) || JOBS[4];
    var label = job.name === 'Taxi Driving' ? 'Taxi Driver' : job.name;
    demoReply.textContent = 'You have successfully completed your shift as a ' + label +
      ' and earned ' + formatRupiah(job.base * mult) + '.';
  }
  if (demoJob) demoJob.addEventListener('change', updateDemo);
  if (demoBtn) demoBtn.addEventListener('click', updateDemo);
  updateDemo();

  /* ---------- Changelog ---------- */
  var LOG = [
    { date: 'Sep 2026', ver: 'v2.4.0', cats: ['Economy'], title: 'Job & Salary System', desc: 'Alternative non-gambling income: 6 jobs with dynamic IDR-based payouts.', changes: ['+ .job list / .job join / .work commands', '+ JobCatalog model + EconomyMultiplier payout', '~ Salaries track USD/IDR via ExchangeRateLog'] },
    { date: 'Sep 2026', ver: 'v2.3.1', cats: ['Bug Fixes'], title: 'Work cooldown hotfix', desc: 'Cooldown edge-cases around midnight shifts resolved.', changes: ['fix lastWorkedAt timezone comparison', 'perf cache ExchangeRateLog lookups'] },
    { date: 'Aug 2026', ver: 'v2.3.0', cats: ['Commands'], title: 'Virtual ID Card', desc: 'ID cards now gate every economy action.', changes: ['+ IdCard registration flow', '~ .work requires ID card'] },
    { date: 'Aug 2026', ver: 'v2.2.0', cats: ['Economy'], title: 'Live IDR economy feed', desc: 'EODHD USD/IDR integration with inflation multiplier.', changes: ['+ services/inflation.ts + ExchangeRateLog', '+ formatRupiah currency utility'] },
    { date: 'Jul 2026', ver: 'v2.1.0', cats: ['Infrastructure'], title: 'Sub-bot pairing', desc: 'Multiple numbers, one shared economy database.', changes: ['+ OTP linking for secondary numbers', '+ per-number custom prefixes'] },
    { date: 'Jul 2026', ver: 'v2.0.0', cats: ['Commands'], title: 'Item shop launch', desc: 'Pickaxes, MacBooks and licenses unlock careers.', changes: ['+ UserInventory + shop commands', '- legacy giveaway command'] },
    { date: 'Jun 2026', ver: 'v1.9.2', cats: ['Bug Fixes'], title: 'Balance precision fix', desc: 'BigInt balances no longer lose precision.', changes: ['fix BigInt serialization in replies'] },
    { date: 'Jun 2026', ver: 'v1.9.0', cats: ['Infrastructure'], title: 'Prismausmigrate baseline', desc: 'Production-safe migration pipeline.', changes: ['~ migrate dev → db push per env', 'perf connection pooling'] }
  ];
  var PAGE = 5, shown = PAGE, activeFilter = 'All';
  var timeline = document.getElementById('timeline');
  var loadMore = document.getElementById('loadMore');
  function filtered() {
    return LOG.filter(function (e) { return activeFilter === 'All' || e.cats.indexOf(activeFilter) > -1; });
  }
  function renderLog() {
    if (!timeline) return;
    var list = filtered().slice(0, shown);
    timeline.innerHTML = list.map(function (e) {
      return '<article class="entry"><div class="entry-top">' +
        '<span class="date-badge">' + e.date + '</span><span class="ver">' + e.ver + '</span>' +
        e.cats.map(function (c) { return '<span class="tag ' + c.replace(/ /g, '') + '">' + c + '</span>'; }).join('') +
        '</div><h3>' + e.title + '</h3><p>' + e.desc + '</p><ul>' +
        e.changes.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul></article>';
    }).join('') || '<p class="muted center">No updates in this category yet.</p>';
    if (loadMore) loadMore.style.display = filtered().length > shown ? '' : 'none';
  }
  document.getElementById('filters').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
    b.classList.add('active'); activeFilter = b.getAttribute('data-filter'); shown = PAGE; renderLog();
  });
  if (loadMore) loadMore.addEventListener('click', function () { shown += PAGE; renderLog(); });
  renderLog();

  /* ---------- Footer USD/IDR ticker ---------- */
  var ticker = document.getElementById('idrTicker');
  var rate = 16240;
  function paint() { if (ticker) ticker.textContent = formatRupiah(rate).replace('Rp', 'Rp'); }
  paint();
  // Gentle live simulation (real feed: EODHD USDIDR — plug API key here).
  setInterval(function () {
    rate = Math.max(15000, Math.min(17500, rate + (Math.random() - .5) * 24));
    paint();
  }, 4000);

  /* ---------- Animated hero counter ---------- */
  var sg = document.getElementById('statGroups');
  if (sg) {
    var target = 500, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / 1400);
      sg.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))) + '+';
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
})();
