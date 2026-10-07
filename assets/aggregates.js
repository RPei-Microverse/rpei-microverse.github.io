// Watercolor bacteria that gather into one round granule, turn slowly, then loosen and start over.
// Purely illustrative: no organisms, scales or processes are implied.
(function () {
  var canvas = document.getElementById('aggregates');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var W = 680, H = 320;            // logical size of the scene
  var CX = W / 2, CY = H / 2;      // where the granule forms
  var CYCLE = 34;                  // simulated seconds for one loop
  var SPEED = 2;                   // simulated seconds per real second (one loop takes 17 s)
  var PALETTE = ['#3466AE', '#3466AE', '#CF9230', '#A8474D', '#1F6F5C', '#E57C56'];

  // Seeded random numbers so the scene starts the same way on every visit
  var seed = 7;
  function rand() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function rr(a, b) { return a + (b - a) * rand(); }
  function gauss() { return (rand() + rand() + rand() - 1.5) * 1.15; }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

  // Cells: rods, cocci and pairs of cocci, scattered across the scene
  var cells = [];
  function scatter(c) { c.x = rr(20, W - 20); c.y = rr(20, H - 20); c.vx = c.vy = 0; }
  for (var i = 0; i < 230; i++) {
    var kind = rand() < 0.5 ? 'rod' : (rand() < 0.75 ? 'coccus' : 'pair');
    var c = { kind: kind, a: rr(0, Math.PI), va: 0, color: pick(PALETTE) };
    if (kind === 'rod') { c.len = rr(11, 16); c.wid = rr(4.8, 5.8); c.r = c.len * 0.4; }
    else if (kind === 'coccus') { c.len = c.wid = rr(7, 9.5); c.r = c.len * 0.5; }
    else { c.len = rr(6.5, 8); c.wid = c.len; c.r = c.len * 0.9; }
    scatter(c);
    cells.push(c);
  }
  // A few long filaments that meander, then wrap around the granule
  var filaments = [];
  for (var f = 0; f < 3; f++) {
    var fl = { color: pick(['#3466AE', '#1F6F5C', '#CF9230']), heading: rr(0, Math.PI * 2), turn: 0, dir: f % 2 ? 1 : -1, segs: [] };
    var fx = rr(80, W - 80), fy = rr(60, H - 60), n = Math.floor(rr(14, 22));
    for (var k = 0; k < n; k++) fl.segs.push({ x: fx - k * 6 * Math.cos(fl.heading), y: fy - k * 6 * Math.sin(fl.heading) });
    filaments.push(fl);
  }

  function smooth(a, b, v) { var x = Math.min(1, Math.max(0, (v - a) / (b - a))); return x * x * (3 - 2 * x); }
  // Phases of one loop: drifting, gathering, a finished granule that turns, then loosening
  function phase(t) {
    var u = (t % CYCLE) / CYCLE;
    return {
      gather: u < 0.84 ? smooth(0.06, 0.5, u) : 1 - smooth(0.84, 0.97, u),
      settled: u < 0.84 ? smooth(0.48, 0.62, u) : 1 - smooth(0.84, 0.9, u),
      release: u >= 0.84 && u < 0.98
    };
  }

  var granuleR = 0;   // current radius of the gathered mass, used for the matrix wash and the filaments

  function step(dt, t) {
    var f = dt * 60, ph = phase(t), g = ph.gather, st = ph.settled;
    var R = 26, R2 = R * R;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var brown = 0.05 + 0.16 * (1 - g);
      c.vx += gauss() * brown * f; c.vy += gauss() * brown * f;
      c.va += gauss() * (0.012 - 0.008 * st) * f;
      var dx = CX - c.x, dy = CY - c.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (g > 0) {
        // pulled toward the center; strong enough to pack into one round body
        var pull = 0.05 * g * Math.min(1, 0.35 + d / 160);
        c.vx += dx / d * pull * f; c.vy += dy / d * pull * f;
      }
      if (st > 0) {
        // the finished granule turns slowly
        var omega = 0.0035 * st;
        c.vx += -dy * omega * 0.08 * f; c.vy += dx * omega * 0.08 * f;
      }
      if (ph.release) {
        // drift outward, stopping well inside the frame so the cells spread over the scene again
        var ex = dx / 290, ey = dy / 125, inside = 1 - Math.sqrt(ex * ex + ey * ey);
        if (inside > 0) {
          var k = 0.0006 * Math.min(1, inside * 3);
          c.vx += (-dx * k + gauss() * 0.05) * f; c.vy += (-dy * k * 0.9 + gauss() * 0.05) * f;
        }
      }
    }
    // neighbors cling together and never overlap
    for (var a = 0; a < cells.length; a++) {
      var p = cells[a];
      for (var b = a + 1; b < cells.length; b++) {
        var q = cells[b], ex = q.x - p.x, ey = q.y - p.y, d2 = ex * ex + ey * ey;
        if (d2 > R2) continue;
        var dd = Math.sqrt(d2) || 0.01, nx = ex / dd, ny = ey / dd, contact = (p.r + q.r) * 0.9;
        if (dd < contact) {
          var push = (contact - dd) * 0.22 * f;
          p.vx -= nx * push; p.vy -= ny * push; q.vx += nx * push; q.vy += ny * push;
        } else if (g > 0) {
          var att = 0.02 * g * (1 - dd / R) * f;
          p.vx += nx * att; p.vy += ny * att; q.vx -= nx * att; q.vy -= ny * att;
        }
      }
    }
    var ds = [];
    for (var m = 0; m < cells.length; m++) {
      var e = cells[m], damp = 0.9 - 0.12 * st;
      e.vx *= Math.pow(damp, f); e.vy *= Math.pow(damp, f); e.va *= Math.pow(0.9, f);
      e.x += e.vx * f; e.y += e.vy * f; e.a += e.va * f;
      var mx = 30, my = 26;
      if (e.x < mx) e.vx += (mx - e.x) * 0.02 * f; if (e.x > W - mx) e.vx -= (e.x - W + mx) * 0.02 * f;
      if (e.y < my) e.vy += (my - e.y) * 0.02 * f; if (e.y > H - my) e.vy -= (e.y - H + my) * 0.02 * f;
      ds.push(Math.sqrt((e.x - CX) * (e.x - CX) + (e.y - CY) * (e.y - CY)));
    }
    ds.sort(function (x, y) { return x - y; });
    granuleR = Math.min(ds[Math.floor(ds.length * 0.88)] + 6, 96);

    filaments.forEach(function (fl) {
      var h = fl.segs[0], hx = h.x - CX, hy = h.y - CY, hd = Math.sqrt(hx * hx + hy * hy) || 1;
      fl.turn = fl.turn * 0.95 + gauss() * 0.0025 * (1 - g);
      fl.heading += fl.turn * f;
      if (g > 0.2) {
        // steer onto a path just outside the granule and follow its edge
        var target = granuleR + 4, ang = Math.atan2(hy, hx);
        var tangent = ang + fl.dir * Math.PI / 2, inward = Math.atan2(-hy, -hx);
        var want = hd > target + 30 ? inward : tangent + fl.dir * (hd - target) * 0.02;
        var diff = Math.atan2(Math.sin(want - fl.heading), Math.cos(want - fl.heading));
        fl.heading += diff * 0.06 * g * f;
      } else if (h.x < 50 || h.x > W - 50 || h.y < 40 || h.y > H - 40) {
        var back = Math.atan2(CY - h.y, CX - h.x), df = Math.atan2(Math.sin(back - fl.heading), Math.cos(back - fl.heading));
        fl.heading += df * 0.02 * f;
      }
      var speed = 0.22 + 0.2 * g;
      h.x += Math.cos(fl.heading) * speed * f; h.y += Math.sin(fl.heading) * speed * f;
      for (var k = 1; k < fl.segs.length; k++) {
        var pr = fl.segs[k - 1], sg = fl.segs[k], sx = sg.x - pr.x, sy = sg.y - pr.y, sd = Math.sqrt(sx * sx + sy * sy) || 1;
        sg.x = pr.x + sx / sd * 6; sg.y = pr.y + sy / sd * 6;
      }
    });
  }

  // Painted ground: a few faint overlapping washes that dissolve into the paper at the edges
  var wash = document.createElement('canvas'), scale = 1, dpr = 1;
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function paintWash() {
    wash.width = canvas.width; wash.height = canvas.height;
    var g = wash.getContext('2d'), wr = mulberry(11);
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    for (var i = 0; i < 9; i++) {
      var cx = 60 + wr() * (W - 120), cy = 40 + wr() * (H - 80), rx = 110 + wr() * 170, ry = 60 + wr() * 80;
      g.save();
      g.translate(cx, cy); g.rotate((wr() - 0.5) * 0.6); g.scale(1, ry / rx);
      var grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0, 'rgba(150, 188, 228, 0.13)');
      grd.addColorStop(0.6, 'rgba(150, 188, 228, 0.07)');
      grd.addColorStop(1, 'rgba(150, 188, 228, 0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.globalCompositeOperation = 'destination-in';
    var fx = g.createLinearGradient(0, 0, W, 0);
    fx.addColorStop(0, 'rgba(0,0,0,0)'); fx.addColorStop(0.12, 'rgba(0,0,0,1)');
    fx.addColorStop(0.88, 'rgba(0,0,0,1)'); fx.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fx; g.fillRect(0, 0, W, H);
    var fy = g.createLinearGradient(0, 0, 0, H);
    fy.addColorStop(0, 'rgba(0,0,0,0)'); fy.addColorStop(0.15, 'rgba(0,0,0,1)');
    fy.addColorStop(0.85, 'rgba(0,0,0,1)'); fy.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fy; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }

  // The granule's body: a soft round wash that appears as the cells pack together,
  // with pigment pooled at its rim the way watercolor dries
  function drawMatrix(strength, t) {
    if (strength <= 0.01) return;
    var k = scale * dpr, r = granuleR;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = strength;
    var grd = ctx.createRadialGradient(CX, CY, r * 0.1, CX, CY, r * 1.08);
    grd.addColorStop(0, 'rgba(214, 196, 150, 0.30)');
    grd.addColorStop(0.75, 'rgba(160, 190, 225, 0.30)');
    grd.addColorStop(0.95, 'rgba(110, 150, 205, 0.42)');
    grd.addColorStop(1, 'rgba(110, 150, 205, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    for (var s = 0; s <= 72; s++) {
      var th = s / 72 * Math.PI * 2;
      var rr2 = r * 1.08 * (1 + 0.025 * Math.sin(3 * th + t * 0.15) + 0.015 * Math.sin(7 * th - t * 0.1));
      var x = CX + rr2 * Math.cos(th), y = CY + rr2 * Math.sin(th);
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function blob(x, y, len, wid, ang, color) {
    var cs = Math.cos(ang), sn = Math.sin(ang), k = scale * dpr;
    ctx.setTransform(k * cs, k * sn, -k * sn, k * cs, k * x, k * y);
    ctx.fillStyle = color; ctx.strokeStyle = color;
    var dk = isDark();
    ctx.globalAlpha = dk ? 0.2 : 0.14;
    ctx.beginPath(); ctx.ellipse(0, 0, len / 2 + 1.4, wid / 2 + 1.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = dk ? 0.92 : 0.6;
    ctx.beginPath(); ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = dk ? 0.8 : 0.55; ctx.lineWidth = 0.7; ctx.stroke();
  }

  var simTime = 0;
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(wash, 0, 0);
    ctx.globalCompositeOperation = isDark() ? 'source-over' : 'multiply';
    drawMatrix(phase(simTime).settled, simTime);
    filaments.forEach(function (fl) {
      for (var k = 0; k < fl.segs.length; k++) {
        var sg = fl.segs[k], nx = fl.segs[Math.min(k + 1, fl.segs.length - 1)], pv = fl.segs[Math.max(k - 1, 0)];
        blob(sg.x, sg.y, 6.4, 4, Math.atan2(nx.y - pv.y, nx.x - pv.x), fl.color);
      }
    });
    cells.forEach(function (c) {
      if (c.kind === 'pair') {
        var ox = Math.cos(c.a) * c.len * 0.45, oy = Math.sin(c.a) * c.len * 0.45;
        blob(c.x - ox, c.y - oy, c.len, c.wid, c.a, c.color);
        blob(c.x + ox, c.y + oy, c.len, c.wid, c.a, c.color);
      } else {
        blob(c.x, c.y, c.len, c.wid, c.a, c.color);
      }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function resize() {
    var w = canvas.clientWidth || W;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = w / W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * H / W * dpr);
    paintWash();
    draw();
  }

  function advance(seconds) {
    var steps = Math.round(seconds * 60);
    for (var n = 0; n < steps; n++) { simTime += 1 / 60; step(1 / 60, simTime); }
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Reduced motion shows one still frame of the finished granule
  advance(reduce ? CYCLE * 0.72 : 1);
  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('themechange', function () { draw(); });
  if (reduce) return;
  var running = false, visible = false, last = 0;
  function frame(ts) {
    if (!running) return;
    var dt = Math.min(0.05, (ts - last) / 1000 || 1 / 60); last = ts;
    // the scene develops at twice real time: two simulation steps per frame
    for (var sp = 0; sp < SPEED; sp++) { simTime += dt; step(dt, simTime); }
    draw();
    requestAnimationFrame(frame);
  }
  function update() {
    var should = visible && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!should) running = false;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries.some(function (e) { return e.isIntersecting; });
      if (visible && canvas.width !== Math.round((canvas.clientWidth || W) * dpr)) resize();
      update();
    }).observe(canvas);
  } else { visible = true; }
  document.addEventListener('visibilitychange', update);
  update();
})();
