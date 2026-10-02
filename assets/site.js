/* Makan site runtime: nav, point-cloud canvases, tools. No dependencies. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rtl = document.documentElement.dir === 'rtl';

  // ── Mobile nav
  var b = document.querySelector('[data-burger]'), n = document.querySelector('[data-nav]');
  if (b && n) b.addEventListener('click', function () { var o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o); });

  // ── Point-cloud room (procedural): floor, walls with window + door, columns, table, sofa, kitchen block
  function buildRoom(seed) {
    var s = seed || 7; function r() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    var P = [], W = 10, D = 7, H = 3.1;
    function add(x, y, z) { P.push([x, y, z]); }
    var i, x, y, z;
    for (i = 0; i < 4200; i++) add(r() * W, 0, r() * D);                                // floor
    for (i = 0; i < 2600; i++) { x = r() * W; y = r() * H; if (!(x > 2 && x < 5.5 && y > .9 && y < 2.4)) add(x, y, 0); } // back wall + window
    for (i = 0; i < 1900; i++) { z = r() * D; y = r() * H; if (!(z > 4.6 && z < 5.6 && y < 2.2)) add(0, y, z); }        // left wall + door
    function box(x0, y0, z0, w, h, d, n) { for (var k = 0; k < n; k++) { var f = Math.floor(r() * 3), u = r(), v = r();
      if (f === 0) add(x0 + u * w, y0 + h, z0 + v * d); else if (f === 1) add(x0 + u * w, y0 + v * h, z0 + (r() < .5 ? 0 : d)); else add(x0 + (r() < .5 ? 0 : w), y0 + v * h, z0 + u * d); } }
    box(6.6, 0, 0, .45, H, .45, 380);       // column
    box(6.6, 0, 3.6, .45, H, .45, 380);
    box(3.2, .72, 3.0, 2.2, .06, 1.0, 420); // table top
    box(3.3, 0, 3.1, .06, .72, .06, 40); box(5.3, 0, 3.1, .06, .72, .06, 40); box(3.3, 0, 3.9, .06, .72, .06, 40); box(5.3, 0, 3.9, .06, .72, .06, 40);
    box(.2, 0, .6, .9, .85, 3.0, 700);      // sofa
    box(8.2, 0, .1, 1.7, .95, .7, 520);     // kitchen counter
    box(8.2, 1.6, .1, 1.7, .8, .4, 300);    // upper cabinet
    // put the walls on the far side so the camera looks into the room (dollhouse view)
    for (i = 0; i < P.length; i++) { P[i][0] = W - P[i][0]; P[i][2] = D - P[i][2]; }
    for (i = 0; i < P.length; i++) { P[i][0] += (r() - .5) * .025; P[i][1] += (r() - .5) * .025; P[i][2] += (r() - .5) * .025; }
    return { pts: P, W: W, D: D, H: H };
  }

  function cloudCanvas(cv, opts) {
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var room = buildRoom(opts.seed), pts = room.pts, dpr = Math.min(2, window.devicePixelRatio || 1);
    var w, h, t0 = performance.now(), visible = true;
    // reveal order: by angle from scanner position (like a rotating scanner)
    var sx = room.W * .55, sz = room.D * .55;
    var ang = pts.map(function (p) { return (Math.atan2(p[2] - sz, p[0] - sx) + Math.PI) / (2 * Math.PI); });
    function size() { var b = cv.getBoundingClientRect(); w = b.width; h = b.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(cv);
    var mx = 0, my = 0; window.addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
    function frame(now) {
      if (visible || reduce) {
        var t = (now - t0) / 1000, reveal = reduce ? 1.01 : Math.min(1.01, t / 3.2);
        var yaw = (reduce ? .65 : .65 + Math.sin(t * .12) * .35) + mx * .25, pitch = .52 + my * .08;
        var cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        var scale = Math.min(w / 21, h / 12.5) * (opts.zoom || 1);
        var ox = w * (opts.x != null ? opts.x : (rtl ? .32 : .68)), oy = h * (opts.y || .54);
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < pts.length; i++) {
          if (ang[i] > reveal) continue;
          var p = pts[i], x = p[0] - room.W / 2, y = p[1] - room.H / 2, z = p[2] - room.D / 2;
          var X = x * cy - z * syw, Z = x * syw + z * cy;
          var Y = y * cp + Z * sp, ZZ = -y * sp + Z * cp;
          var persp = 22 / (22 + ZZ);
          var px = ox + X * scale * persp, py = oy - Y * scale * persp;
          var hgt = p[1] / room.H;
          var fresh = reveal < 1 && reveal - ang[i] < .03;
          ctx.fillStyle = fresh ? '#ffffff' : 'hsl(' + (152 + hgt * 70) + ',72%,' + (48 + hgt * 8) + '%)';
          ctx.globalAlpha = Math.max(.15, Math.min(1, .95 * persp - .1));
          var sz2 = (fresh ? 2.2 : 1.35) * persp;
          ctx.fillRect(px, py, sz2, sz2);
        }
        ctx.globalAlpha = 1;
        if (reveal < 1) { // scanner beam
          var a = reveal * 2 * Math.PI - Math.PI, bx = sx - room.W / 2, bz = sz - room.D / 2;
          var X0 = bx * cy - bz * syw, Z0 = bx * syw + bz * cy, Y0 = -room.H / 2 * cp + Z0 * sp;
          ctx.strokeStyle = 'rgba(53,211,154,.5)'; ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo(ox + X0 * scale, oy - Y0 * scale);
          var ex = bx + Math.cos(a) * 9, ez = bz + Math.sin(a) * 9, X1 = ex * cy - ez * syw, Z1 = ex * syw + ez * cy, Y1 = -room.H / 2 * cp + Z1 * sp;
          ctx.lineTo(ox + X1 * scale, oy - Y1 * scale); ctx.stroke();
        }
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  // ── Hero: five real floor plans in turn (apartment, office, dental clinic, café, showroom).
  // Each starts as a solid dollhouse model, is laser-scanned into a point cloud, then fades to the next.
  function buildingCanvas(cv) {
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var dpr = Math.min(1.5, window.devicePixelRatio || 1), w, h, t0 = performance.now(), visible = true;
    var sd = 21; function r() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
    var LIGHT = norm([0.35, 0.9, -0.3]), WH = 2.6, CUT = 1.05;
    var ar = document.documentElement.lang === 'ar';
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

    // ---------- geometry primitives ----------
    var S; // scene under construction
    var C = { // materials [hue, sat, light]
      wall: [210, 6, 86], cap: [210, 4, 70], oak: [32, 38, 52], walnut: [24, 30, 30], tile: [200, 6, 80], stone: [36, 10, 72],
      carpet: [215, 10, 58], vinyl: [190, 10, 84], terrazzo: [30, 8, 78], concrete: [210, 4, 62],
      fabric: [215, 12, 42], fabric2: [30, 18, 62], white: [0, 0, 95], black: [210, 10, 14], steel: [205, 8, 72],
      wood: [28, 32, 46], green: [130, 30, 34], blue: [205, 45, 45], mint: [175, 35, 55], rug: [20, 25, 55],
    };
    // axis-aligned box; faces culled by winding; points sampled on its surfaces
    function box(x0, x1, y0, y1, z0, z1, col, opt) {
      opt = opt || {};
      var b = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: y0, y1: y1, z0: Math.min(z0, z1), z1: Math.max(z0, z1), col: col, glass: !!opt.glass, floor: !!opt.floor };
      S.boxes.push(b);
      var dens = (opt.dens != null ? opt.dens : opt.glass ? 3 : 55) * .7;
      var dx = b.x1 - b.x0, dy = y1 - y0, dz = b.z1 - b.z0;
      var faces = [[dx * dy, function (u, v) { return [b.x0 + u * dx, y0 + v * dy, b.z0]; }], [dx * dy, function (u, v) { return [b.x0 + u * dx, y0 + v * dy, b.z1]; }],
        [dz * dy, function (u, v) { return [b.x0, y0 + v * dy, b.z0 + u * dz]; }], [dz * dy, function (u, v) { return [b.x1, y0 + v * dy, b.z0 + u * dz]; }],
        [dx * dz, function (u, v) { return [b.x0 + u * dx, y1, b.z0 + v * dz]; }]];
      faces.forEach(function (f) { var n = Math.round(f[0] * dens); for (var i = 0; i < n; i++) { var p = f[1](r(), r()); p.push(opt.glass ? 1 : 0, r()); S.pts.push(p); } });
      // crisp edges
      if (opt.floor) return;
      var E = Math.round((dx + dy + dz) * (opt.glass ? 5 : 12));
      for (var i = 0; i < E; i++) { var k = Math.floor(r() * 3), u = r(), q;
        if (k === 0) q = [b.x0 + u * dx, r() < .5 ? y0 : y1, r() < .5 ? b.z0 : b.z1];
        else if (k === 1) q = [r() < .5 ? b.x0 : b.x1, y0 + u * dy, r() < .5 ? b.z0 : b.z1];
        else q = [r() < .5 ? b.x0 : b.x1, r() < .5 ? y0 : y1, b.z0 + u * dz];
        q.push(2, r()); S.pts.push(q); }
    }
    // wall along x (z fixed) or along z (x fixed), with openings [from, to, type, side]
    // types: door (leaf opens to side ±1), win (sill .9, head 2.2), glaze (full-height glass), open (gap)
    function wall(ax, fixed, a0, a1, ops, opt) {
      opt = opt || {};
      var th = opt.t || .14, H = opt.cut ? CUT : WH, half = th / 2;
      var seg = function (s0, s1, y0, y1, col, o) {
        // split long runs so the painter's sort stays correct
        var n = Math.max(1, Math.ceil((s1 - s0) / 1.2));
        for (var i = 0; i < n; i++) { var p0 = s0 + (s1 - s0) * i / n, p1 = s0 + (s1 - s0) * (i + 1) / n;
          if (ax === 'x') box(p0, p1, y0, y1, fixed - half, fixed + half, col, o); else box(fixed - half, fixed + half, y0, y1, p0, p1, col, o); }
      };
      var cur = a0; (ops || []).slice().sort(function (p, q) { return p[0] - q[0]; }).forEach(function (op) {
        if (op[0] > cur) seg(cur, op[0], 0, H, C.wall, { dens: 24 });
        var type = op[2];
        if (type === 'door') { if (H > 2.1) seg(op[0], op[1], 2.1, H, C.wall, { dens: 24 });
          var L = op[1] - op[0], sd = op[3] || 1; // open leaf, hinged at op[0]
          if (ax === 'x') box(op[0], op[0] + .045, 0, 2.05, fixed, fixed + sd * L, C.wood, { dens: 40 }); else box(fixed, fixed + sd * L, 0, 2.05, op[0], op[0] + .045, C.wood, { dens: 40 }); }
        else if (type === 'win') { seg(op[0], op[1], 0, Math.min(.9, H), C.wall, { dens: 24 }); if (H > 2.2) { seg(op[0], op[1], 2.2, H, C.wall, { dens: 24 }); seg(op[0], op[1], .9, 2.2, C.blue, { glass: true }); } else if (H > .9) seg(op[0], op[1], .9, H, C.blue, { glass: true }); }
        else if (type === 'glaze') { seg(op[0], op[1], 0, .05, C.black, { dens: 10 }); seg(op[0], op[1], .05, Math.min(H, 2.5), C.blue, { glass: true }); if (H > 2.5) seg(op[0], op[1], 2.5, H, C.wall, { dens: 24 }); }
        cur = op[1];
      });
      if (cur < a1) seg(cur, a1, 0, H, C.wall, { dens: 24 });
    }
    function floor(x0, x1, z0, z1, col) { // tiled so non-planar scans can dissolve it gradually
      var nx = Math.max(1, Math.round((x1 - x0) / 1.5)), nz = Math.max(1, Math.round((z1 - z0) / 1.5));
      for (var i = 0; i < nx; i++) for (var k = 0; k < nz; k++) box(x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx, -.06, 0, z0 + (z1 - z0) * k / nz, z0 + (z1 - z0) * (k + 1) / nz, col, { dens: 30, floor: true }); }
    function room(name, x0, x1, z0, z1, col, lx, lz) { floor(x0, x1, z0, z1, col); S.labels.push({ t: name[ar ? 1 : 0], a: Math.round((x1 - x0) * (z1 - z0)), x: lx != null ? lx : (x0 + x1) / 2, z: lz != null ? lz : (z0 + z1) / 2 }); }

    // ---------- furniture at real sizes (metres) ----------
    // d = direction the user faces: 'N' (+z), 'S' (−z), 'E' (+x), 'W' (−x)
    function sofa(x0, x1, z0, z1, d, col) { col = col || C.fabric;
      box(x0, x1, 0, .42, z0, z1, col);
      if (d === 'S') box(x0, x1, .42, .85, z1 - .22, z1, col); if (d === 'N') box(x0, x1, .42, .85, z0, z0 + .22, col);
      if (d === 'E') box(x0, x0 + .22, .42, .85, z0, z1, col); if (d === 'W') box(x1 - .22, x1, .42, .85, z0, z1, col);
      if (d === 'S' || d === 'N') { box(x0, x0 + .18, .42, .62, z0, z1, col); box(x1 - .18, x1, .42, .62, z0, z1, col); }
      else { box(x0, x1, .42, .62, z0, z0 + .18, col); box(x0, x1, .42, .62, z1 - .18, z1, col); } }
    function chair(x, z, d, col) { col = col || C.black; box(x - .22, x + .22, .44, .48, z - .22, z + .22, col);
      [[-.19, -.19], [.15, -.19], [-.19, .15], [.15, .15]].forEach(function (l) { box(x + l[0], x + l[0] + .04, 0, .44, z + l[1], z + l[1] + .04, C.black, { dens: 20 }); });
      if (d === 'S') box(x - .22, x + .22, .48, .9, z + .18, z + .22, col); if (d === 'N') box(x - .22, x + .22, .48, .9, z - .22, z - .18, col);
      if (d === 'E') box(x - .22, x - .18, .48, .9, z - .22, z + .22, col); if (d === 'W') box(x + .18, x + .22, .48, .9, z - .22, z + .22, col); }
    function table(x0, x1, z0, z1, hgt, col) { hgt = hgt || .75; box(x0, x1, hgt - .04, hgt, z0, z1, col || C.oak);
      [[x0 + .05, z0 + .05], [x1 - .1, z0 + .05], [x0 + .05, z1 - .1], [x1 - .1, z1 - .1]].forEach(function (l) { box(l[0], l[0] + .05, 0, hgt - .04, l[1], l[1] + .05, C.black, { dens: 20 }); }); }
    function bed(x0, x1, z0, z1, head) { // head: side of headboard 'N','S','E','W'
      box(x0, x1, 0, .3, z0, z1, C.walnut); box(x0 + .03, x1 - .03, .3, .52, z0 + .03, z1 - .03, C.white);
      if (head === 'N') { box(x0, x1, 0, 1.1, z1 - .08, z1, C.walnut); box(x0 + .15, (x0 + x1) / 2 - .05, .52, .64, z1 - .55, z1 - .15, C.white); box((x0 + x1) / 2 + .05, x1 - .15, .52, .64, z1 - .55, z1 - .15, C.white); box(x0 + .03, x1 - .03, .52, .56, z0 + .03, z0 + (z1 - z0) * .55, C.fabric2); }
      if (head === 'E') { box(x1 - .08, x1, 0, 1.1, z0, z1, C.walnut); box(x1 - .55, x1 - .15, .52, .64, z0 + .15, z1 - .15, C.white); box(x0 + .03, x0 + (x1 - x0) * .55, .52, .56, z0 + .03, z1 - .03, C.fabric2); } }
    function nightstand(x, z) { box(x - .23, x + .23, 0, .5, z - .2, z + .2, C.walnut); box(x - .08, x + .08, .5, .78, z - .08, z + .08, C.white, { dens: 30 }); }
    function wardrobe(x0, x1, z0, z1) { box(x0, x1, 0, 2.3, z0, z1, C.stone); }
    function counter(x0, x1, z0, z1, col, top) { box(x0, x1, 0, .86, z0, z1, col || C.white); box(x0, x1, .86, .9, z0 - .02, z1 + .02, top || C.stone); }
    function upper(x0, x1, z0, z1, col) { box(x0, x1, 1.5, 2.2, z0, z1, col || C.white); }
    function sink(x, z) { box(x - .3, x + .3, .88, .91, z - .2, z + .2, C.steel); }
    function hob(x, z) { box(x - .3, x + .3, .9, .92, z - .25, z + .25, C.black); }
    function fridge(x0, x1, z0, z1) { box(x0, x1, 0, 1.9, z0, z1, C.steel); }
    function wc(x, z, d) { // d = direction the user faces
      var bx = d === 'E' || d === 'W'; box(x - (bx ? .25 : .19), x + (bx ? .25 : .19), 0, .42, z - (bx ? .19 : .25), z + (bx ? .19 : .25), C.white);
      if (d === 'N') box(x - .2, x + .2, 0, .8, z - .42, z - .25, C.white); if (d === 'S') box(x - .2, x + .2, 0, .8, z + .25, z + .42, C.white);
      if (d === 'E') box(x - .42, x - .25, 0, .8, z - .2, z + .2, C.white); if (d === 'W') box(x + .25, x + .42, 0, .8, z - .2, z + .2, C.white); }
    function vanity(x0, x1, z0, z1) { box(x0, x1, 0, .82, z0, z1, C.walnut); box(x0, x1, .82, .86, z0, z1, C.white); }
    function shower(x0, x1, z0, z1, glassSide) { box(x0, x1, 0, .05, z0, z1, C.white);
      if (glassSide === 'S') box(x0, x1, 0, 2.0, z0, z0 + .02, C.blue, { glass: true }); if (glassSide === 'W') box(x0, x0 + .02, 0, 2.0, z0, z1, C.blue, { glass: true }); }
    function rug(x0, x1, z0, z1, col) { box(x0, x1, 0, .015, z0, z1, col || C.rug, { dens: 20 }); }
    function plant(x, z) { box(x - .18, x + .18, 0, .42, z - .18, z + .18, C.stone); box(x - .3, x + .3, .42, 1.25, z - .3, z + .3, C.green, { dens: 40 }); }
    function tvWall(x0, x1, z0, z1) { box(x0, x1, 0, .45, z0, z1, C.walnut); }
    function screen(x0, x1, y0, y1, z0, z1) { box(x0, x1, y0, y1, z0, z1, C.black); }
    function desk(x0, x1, z0, z1, monitorSide) { table(x0, x1, z0, z1, .74, C.white);
      if (monitorSide === 'N') box((x0 + x1) / 2 - .28, (x0 + x1) / 2 + .28, .78, 1.12, z1 - .12, z1 - .08, C.black);
      if (monitorSide === 'S') box((x0 + x1) / 2 - .28, (x0 + x1) / 2 + .28, .78, 1.12, z0 + .08, z0 + .12, C.black);
      if (monitorSide === 'E') box(x1 - .12, x1 - .08, .78, 1.12, (z0 + z1) / 2 - .28, (z0 + z1) / 2 + .28, C.black); }
    function column(x, z) { box(x - .25, x + .25, 0, WH, z - .25, z + .25, C.wall, { dens: 24 }); }
    function shelf(x0, x1, z0, z1, hgt) { box(x0, x1, 0, hgt || 2.0, z0, z1, C.steel, { dens: 30 }); }

    // ---------- five floor plans ----------
    var PLANS = [
      { name: ['Apartment · 108 m²', 'شقة · 108 م²'], build: function () {
        // 12 × 9 m two-bedroom apartment
        room(['LIVING & DINING', 'المعيشة والطعام'], -6, 1, -4.5, .6, C.oak, -3.2, -2.2);
        room(['KITCHEN', 'المطبخ'], 1, 6, -4.5, -.8, C.tile);
        room(['ENTRANCE', 'المدخل'], 1, 6, -.8, .6, C.stone);
        room(['MASTER BEDROOM', 'غرفة النوم الرئيسية'], -6, -1.2, .6, 4.5, C.oak, -3.6, 1.6);
        room(['HALL', 'الممر'], -1.2, 1.2, .6, 2.4, C.oak);
        room(['BATH', 'دورة المياه'], -1.2, 1.2, 2.4, 4.5, C.tile);
        room(['BEDROOM', 'غرفة النوم'], 1.2, 6, .6, 4.5, C.oak, 3.2, 2.2);
        wall('x', -4.5, -6, 6, [[-5.2, -3.2, 'win'], [-1.8, 0, 'win'], [3, 4.6, 'win']], { t: .2, cut: true });
        wall('z', -6, -4.5, 4.5, [[-3.4, -1.2, 'win'], [1.8, 3.4, 'win']], { t: .2, cut: true });
        wall('x', 4.5, -6, 6, [[-4.4, -2.6, 'win'], [-.4, .4, 'win'], [3, 4.6, 'win']], { t: .2 });
        wall('z', 6, -4.5, 4.5, [[-.5, .4, 'door', -1], [-3.6, -2, 'win'], [2, 3.6, 'win']], { t: .2 });
        wall('z', 1, -4.5, -.8, []);
        wall('x', -.8, 1, 6, [[2.1, 2.95, 'door', 1]]);
        wall('x', .6, -6, -1.2, []); wall('x', .6, 1.2, 6, []);
        wall('z', -1.2, .6, 4.5, [[.9, 1.75, 'door', -1]]);
        wall('z', 1.2, .6, 4.5, [[.9, 1.75, 'door', 1]]);
        wall('x', 2.4, -1.2, 1.2, [[-.45, .3, 'door', -1]]);
        // living & dining
        rug(-5.6, -2.4, -2.9, -.6); sofa(-5.4, -2.6, -.5, .45, 'S'); sofa(-5.95, -5.05, -2.6, -.9, 'E', C.fabric2);
        table(-4.6, -3.4, -2.0, -1.4, .4, C.walnut); tvWall(-5.2, -2.8, -4.38, -3.95); screen(-4.6, -3.4, .5, 1.2, -4.25, -4.2);
        table(-1.6, .2, -3.1, -2.1, .75, C.oak); [-1.3, -.7, -.1].forEach(function (x) { chair(x, -3.45, 'N', C.fabric); chair(x, -1.75, 'S', C.fabric); }); plant(.6, .2);
        // kitchen
        counter(1.15, 5.85, -4.4, -3.8); sink(3.8, -4.1); hob(2.2, -4.1); counter(5.25, 5.9, -3.8, -1.6);
        upper(5.55, 5.9, -3.8, -1.6); fridge(1.15, 1.85, -2.0, -1.3); table(2.6, 3.8, -2.6, -1.8, .75, C.white); chair(2.95, -1.45, 'S', C.wood); chair(3.45, -2.95, 'N', C.wood);
        box(4.8, 5.85, 0, 1.1, -.7, -.35, C.walnut); // shoe cabinet
        // master bedroom
        bed(-4.5, -2.7, 2.4, 4.4, 'N'); nightstand(-4.85, 4.1); nightstand(-2.35, 4.1); rug(-5, -2.2, 1.6, 2.7); wardrobe(-5.95, -5.35, .75, 2.9);
        // bath
        wc(-.8, 3.0, 'E'); vanity(.35, 1.1, 2.55, 3.4); shower(-.1, 1.1, 3.6, 4.4, 'W');
        // bedroom
        bed(4.2, 5.25, 2.4, 4.4, 'N'); nightstand(3.8, 4.15); desk(5.3, 5.9, .9, 2.0, 'E'); chair(5.0, 1.45, 'E', C.blue); wardrobe(1.35, 3.4, .7, 1.3);
      } },
      { name: ['Office · 126 m²', 'مكتب · 126 م²'], build: function () {
        // 14 × 9 m office suite
        room(['RECEPTION', 'الاستقبال'], -7, -2.5, -4.5, -.5, C.stone);
        room(['OPEN OFFICE', 'مساحة العمل'], -2.5, 7, -4.5, 1.5, C.carpet, 2.2, -.9);
        room(['MEETING ROOM', 'قاعة الاجتماعات'], -7, -2.5, -.5, 4.5, C.oak);
        room(['PANTRY', 'المطبخ'], -2.5, .5, 1.5, 4.5, C.tile);
        room(['WC', 'دورة المياه'], .5, 2.5, 1.5, 4.5, C.tile);
        room(['MANAGER', 'مكتب المدير'], 2.5, 7, 1.5, 4.5, C.oak);
        wall('x', -4.5, -7, 7, [[-5.3, -3.8, 'glaze'], [-1.5, 6, 'glaze']], { t: .2, cut: true });
        wall('z', -7, -4.5, 4.5, [[-4, -1.5, 'win'], [1, 3.5, 'win']], { t: .2, cut: true });
        wall('x', 4.5, -7, 7, [[-5.6, -3.9, 'win'], [3.4, 5.6, 'win']], { t: .2 });
        wall('z', 7, -4.5, 4.5, [[-3.8, .8, 'win'], [2.4, 3.8, 'win']], { t: .2 });
        wall('z', -2.5, -4.5, -.5, [[-3.4, -1.3, 'open']]);
        wall('x', -.5, -7, -2.5, [[-4.3, -3.4, 'door', 1]]);
        wall('z', -2.5, -.5, 4.5, [[-.4, 4.4, 'glaze']]);
        wall('x', 1.5, -2.5, 7, [[-1.6, -.75, 'door', 1], [1.0, 1.8, 'door', 1], [2.6, 3.4, 'door', 1], [3.5, 6.9, 'glaze']]);
        wall('z', .5, 1.5, 4.5, []); wall('z', 2.5, 1.5, 4.5, []);
        // reception
        counter(-5.6, -3.4, -2.6, -2.0, C.walnut, C.white); chair(-4.5, -1.6, 'S', C.black); sofa(-6.95, -6.1, -4.2, -2.6, 'E', C.fabric2); plant(-3, -4); plant(-6.6, -1);
        // open office: two clusters of four desks, two columns
        [[-1.6, -3.6], [2.6, -3.6]].forEach(function (c) { for (var i = 0; i < 2; i++) { var x = c[0] + i * 1.45;
          desk(x, x + 1.4, c[1], c[1] + .7, 'N'); desk(x, x + 1.4, c[1] + .72, c[1] + 1.42, 'S'); chair(x + .7, c[1] - .35, 'N', C.blue); chair(x + .7, c[1] + 1.78, 'S', C.blue); } });
        column(1.75, -2.1); column(5.75, -2.1); shelf(6.4, 6.85, -1.2, .9, 1.8); plant(-2.0, 1.0);
        [[-1.6, -.4], [2.6, -.4]].forEach(function (c) { for (var i = 0; i < 2; i++) { var x = c[0] + i * 1.45; desk(x, x + 1.4, c[1], c[1] + .7, 'N'); chair(x + .7, c[1] - .35, 'N', C.blue); } });
        // meeting room
        table(-6.0, -3.5, .9, 2.3, .75, C.walnut); [-5.6, -4.75, -3.9].forEach(function (x) { chair(x, .55, 'N', C.black); chair(x, 2.65, 'S', C.black); }); chair(-6.35, 1.6, 'E', C.black);
        screen(-6.95, -6.9, 1.0, 2.0, 1.0, 2.2); screen(-3.4, -3.3, 0, .9, .9, 2.3);
        // pantry
        counter(-2.35, .35, 3.8, 4.4); sink(-1.3, 4.1); fridge(-.3, .35, 2.9, 3.55); table(-2.1, -1.1, 2.0, 2.8, .75, C.white); chair(-1.6, 1.75, 'N', C.wood);
        // WC
        wc(1.0, 4.1, 'S'); vanity(1.9, 2.4, 2.4, 3.2);
        // manager
        desk(4.0, 5.8, 3.0, 3.8, 'S'); chair(4.9, 4.2, 'S', C.black); chair(4.5, 2.4, 'N', C.fabric); chair(5.3, 2.4, 'N', C.fabric); shelf(6.4, 6.85, 2.6, 4.3, 2.0);
      } },
      { name: ['Dental clinic · 130 m²', 'عيادة أسنان · 130 م²'], build: function () {
        // 13 × 10 m clinic
        room(['RECEPTION & WAITING', 'الاستقبال والانتظار'], -6.5, 1.5, -5, 0, C.vinyl, -3.4, -2.6);
        room(['STERILISATION', 'التعقيم'], 1.5, 4, -5, -2, C.tile);
        room(['WC', 'دورة المياه'], 4, 6.5, -5, -2, C.tile);
        room(['CORRIDOR', 'الممر'], 1.5, 6.5, -2, 0, C.vinyl);
        room(['TREATMENT 1', 'العلاج 1'], -6.5, -2.2, 0, 5, C.vinyl);
        room(['TREATMENT 2', 'العلاج 2'], -2.2, 2.1, 0, 5, C.vinyl);
        room(['DOCTOR', 'مكتب الطبيب'], 2.1, 6.5, 0, 5, C.oak);
        wall('x', -5, -6.5, 6.5, [[-3.4, -1.9, 'glaze'], [-1.5, -.4, 'door', 1], [-.2, 1.2, 'glaze'], [4.6, 5.6, 'win']], { t: .2, cut: true });
        wall('z', -6.5, -5, 5, [[-4.2, -1.2, 'win'], [1.5, 3.6, 'win']], { t: .2, cut: true });
        wall('x', 5, -6.5, 6.5, [[-5.4, -3.4, 'win'], [-1.2, .8, 'win'], [3.2, 5.3, 'win']], { t: .2 });
        wall('z', 6.5, -5, 5, [[1.4, 3.6, 'win']], { t: .2 });
        wall('z', 1.5, -5, -2, [[-3.5, -2.6, 'door', 1]]);
        wall('z', 4, -5, -2, []);
        wall('x', -2, 1.5, 6.5, [[2.2, 3.0, 'door', -1], [4.7, 5.5, 'door', -1]]);
        wall('x', 0, -6.5, 6.5, [[-3.4, -2.5, 'door', 1], [.4, 1.3, 'door', 1], [3.4, 4.2, 'door', 1], [1.5, 2.1, 'open']]);
        wall('z', -2.2, 0, 5, []); wall('z', 2.1, 0, 5, []);
        // reception & waiting
        counter(-1.8, .8, -1.6, -1.0, C.white, C.mint); counter(.2, .8, -1.0, -.25, C.white, C.mint); chair(-.6, -.6, 'S', C.black);
        for (var i = 0; i < 5; i++) chair(-6.1, -4.3 + i * .62, 'E', C.mint);
        for (i = 0; i < 4; i++) chair(-5.0 + i * .62, -.4, 'S', C.mint);
        table(-4.4, -3.6, -3.4, -2.6, .45, C.oak); plant(-6.1, -.4); plant(1.1, -4.5); screen(-3.2, -2.0, 1.3, 2.0, -.12, -.08);
        // sterilisation
        counter(1.65, 3.85, -4.85, -4.3, C.white, C.steel); counter(3.3, 3.85, -4.3, -2.3, C.white, C.steel); sink(2.3, -4.55); box(3.4, 3.8, .9, 1.35, -3.6, -2.9, C.steel); upper(1.65, 3.85, -4.85, -4.5);
        // WC
        wc(5.9, -4.4, 'W'); vanity(4.15, 4.65, -4.8, -4.0);
        // two treatment rooms: dental chair, cart, cabinets, stool
        [-4.35, -.05].forEach(function (cx) {
          box(cx - .35, cx + .35, 0, .4, 1.6, 3.6, C.steel); box(cx - .33, cx + .33, .4, .62, 2.1, 3.6, C.mint); box(cx - .33, cx + .33, .62, 1.15, 1.6, 1.85, C.mint);
          box(cx + .7, cx + .8, 0, 1.9, 3.2, 3.3, C.white, { dens: 30 }); box(cx + .15, cx + .8, 1.8, 1.9, 3.15, 3.35, C.white);
          box(cx - 1.1, cx - .6, 0, .78, 2.4, 2.9, C.white); chair(cx + .8, 2.2, 'W', C.black);
          counter(cx - 2.0, cx + 1.9, 4.3, 4.9, C.white, C.stone); upper(cx - 2.0, cx + 1.9, 4.55, 4.9); sink(cx + 1.3, 4.6); });
        // doctor's office
        desk(3.4, 5.2, 2.6, 3.4, 'S'); chair(4.3, 3.8, 'S', C.black); chair(3.9, 2.0, 'N', C.fabric); chair(4.7, 2.0, 'N', C.fabric); shelf(6.0, 6.4, 1.0, 3.0, 2.1); box(2.4, 2.9, 0, .6, 3.6, 4.7, C.white);
      } },
      { name: ['Café · 108 m²', 'مقهى · 108 م²'], build: function () {
        // 12 × 9 m café
        room(['SEATING', 'الجلسات'], -6, 1.8, -4.5, 1.5, C.terrazzo, -2.4, -2.6);
        room(['COFFEE BAR', 'ركن القهوة'], 1.8, 6, -4.5, 1.5, C.terrazzo, 3.8, -1.2);
        room(['KITCHEN', 'المطبخ'], .6, 6, 1.5, 4.5, C.tile);
        room(['STORE', 'المستودع'], -1.6, .6, 1.5, 4.5, C.concrete);
        room(['WC', 'دورة المياه'], -3.6, -1.6, 1.5, 4.5, C.tile);
        room(['WC', 'دورة المياه'], -6, -3.6, 1.5, 4.5, C.tile);
        wall('x', -4.5, -6, 6, [[-5.6, -2.0, 'glaze'], [-1.4, -.4, 'door', 1], [-.2, 4.8, 'glaze']], { t: .2, cut: true });
        wall('z', -6, -4.5, 4.5, [[-3.8, .8, 'glaze']], { t: .2, cut: true });
        wall('x', 4.5, -6, 6, [[3, 4.4, 'win']], { t: .2 });
        wall('z', 6, -4.5, 4.5, [[-3.5, -1.8, 'win'], [2.4, 3.8, 'win']], { t: .2 });
        wall('x', 1.5, -6, 6, [[-5.4, -4.6, 'door', 1], [-3.0, -2.2, 'door', 1], [-.9, -.1, 'door', 1], [1.3, 2.3, 'door', 1]]);
        wall('z', -3.6, 1.5, 4.5, []); wall('z', -1.6, 1.5, 4.5, []); wall('z', .6, 1.5, 4.5, []);
        // seating: banquette along the side wall, 2- and 4-top tables
        box(-5.95, -5.45, 0, .45, -3.9, .9, C.walnut); box(-5.95, -5.85, .45, 1.0, -3.9, .9, C.walnut);
        [-3.4, -1.9, -.4].forEach(function (z) { table(-5.25, -4.55, z - .35, z + .35, .75, C.white); chair(-4.15, z, 'W', C.wood); });
        [[-2.8, -3.2], [-2.8, -1.0], [-.6, -3.2], [-.6, -1.0]].forEach(function (p) { table(p[0] - .45, p[0] + .45, p[1] - .45, p[1] + .45, .75, C.white);
          chair(p[0] - .25, p[1] - .8, 'N', C.wood); chair(p[0] + .25, p[1] - .8, 'N', C.wood); chair(p[0] - .25, p[1] + .8, 'S', C.wood); chair(p[0] + .25, p[1] + .8, 'S', C.wood); });
        plant(1.3, -4.0); plant(-5.6, 1.1); rug(-3.6, .2, .3, 1.3, C.stone);
        // coffee bar
        counter(2.3, 4.6, -1.1, -.5, C.walnut, C.white); counter(2.3, 2.9, -3.6, -1.1, C.walnut, C.white); box(2.35, 2.85, .9, 1.25, -3.4, -2.4, C.blue, { glass: true });
        counter(3.6, 5.9, .55, 1.35, C.white, C.stone); box(4.3, 4.95, .9, 1.35, .8, 1.2, C.steel); box(5.1, 5.6, .9, 1.25, .85, 1.2, C.black); upper(3.6, 5.9, 1.05, 1.35);
        fridge(5.25, 5.9, -.8, -.1); [-3.0, -2.3].forEach(function (z) { chair(1.95, z, 'E', C.black); });
        // kitchen
        counter(.75, 5.9, 3.85, 4.4, C.steel, C.steel); hob(2.0, 4.12); hob(2.7, 4.12); sink(4.6, 4.12); counter(2.0, 4.2, 2.3, 2.9, C.steel, C.steel); shelf(5.4, 5.9, 1.65, 3.6, 1.8);
        // store, WCs
        shelf(-1.5, -.6, 3.9, 4.4, 2.1); shelf(-1.5, -1.0, 1.7, 3.6, 2.1); wc(-2.6, 4.1, 'S'); vanity(-3.45, -2.95, 1.7, 2.4); wc(-4.6, 4.1, 'S'); vanity(-5.85, -5.35, 1.7, 2.4);
      } },
      { name: ['Furniture showroom · 126 m²', 'معرض أثاث · 126 م²'], build: function () {
        // 14 × 9 m showroom
        room(['SHOWROOM', 'صالة العرض'], -7, 3, -4.5, 4.5, C.concrete, -2, -3.7);
        room(['MATERIAL LIBRARY', 'مكتبة الخامات'], 3, 7, -4.5, .5, C.oak);
        room(['SALES OFFICE', 'مكتب المبيعات'], 3, 7, .5, 4.5, C.carpet);
        wall('x', -4.5, -7, 7, [[-6.4, -.4, 'glaze'], [.2, 1.6, 'door', 1], [3.6, 6.4, 'glaze']], { t: .2, cut: true });
        wall('z', -7, -4.5, 4.5, [[-3.5, 3.5, 'glaze']], { t: .2, cut: true });
        wall('x', 4.5, -7, 7, [], { t: .2 }); wall('z', 7, -4.5, 4.5, [[1.5, 3.5, 'win']], { t: .2 });
        wall('z', 3, -4.5, 4.5, [[-2.4, -.4, 'open'], [2.0, 2.85, 'door', -1]]);
        wall('x', .5, 3, 7, [[4.4, 5.2, 'door', -1]]);
        // living set
        box(-6.6, -3.0, 0, .12, 1.0, 4.1, C.white, { dens: 25 }); rug(-6.2, -3.4, 1.4, 3.6, C.rug); sofa(-6.0, -3.6, 3.2, 4.0, 'S', C.fabric2);
        chair(-5.6, 1.6, 'N', C.blue); chair(-4.0, 1.6, 'N', C.blue); table(-5.3, -4.3, 2.2, 2.8, .4, C.walnut); plant(-3.3, 3.9);
        // dining set
        box(-2.3, 1.9, 0, .12, 1.0, 3.9, C.white, { dens: 25 }); table(-1.1, .9, 1.9, 3.0, .75, C.oak);
        [-.7, -.1, .5].forEach(function (x) { chair(x, 1.55, 'N', C.fabric); chair(x, 3.35, 'S', C.fabric); }); box(-.3, .1, 2.1, 2.15, 2.3, 2.6, C.white, { dens: 10 });
        // bedroom set
        box(-6.6, -2.6, 0, .12, -3.6, .2, C.white, { dens: 25 }); bed(-5.6, -3.8, -1.8, .1, 'N'); nightstand(-6.1, -.3); nightstand(-3.3, -.3); rug(-6.2, -3.2, -3.0, -1.6, C.stone);
        // accent pieces near the entrance
        sofa(-1.6, .2, -2.6, -1.8, 'S', C.green); table(-1.2, -.2, -3.6, -3.0, .45, C.walnut); chair(1.4, -2.4, 'W', C.fabric2); plant(2.4, -.8);
        // material library: sample panels on the wall and a table
        for (var i = 0; i < 6; i++) box(6.82, 6.88, .4, 2.0, -4.2 + i * .75, -3.6 + i * .75, [[30, 40, 60], [0, 0, 88], [200, 10, 45], [25, 30, 40], [0, 0, 60], [40, 25, 70]][i]);
        table(3.8, 5.6, -2.6, -1.4, .9, C.white); chair(4.2, -.9, 'S', C.black); chair(5.2, -.9, 'S', C.black); shelf(3.2, 3.6, -4.2, -2.6, 1.8);
        // sales office
        desk(4.4, 6.2, 2.8, 3.6, 'S'); chair(5.3, 4.0, 'S', C.black); chair(4.9, 2.3, 'N', C.fabric); chair(5.7, 2.3, 'N', C.fabric); shelf(6.4, 6.85, .8, 2.4, 2.0); plant(3.5, 4.0);
      } },
    ];
    // Each plan is captured a different way:
    //  sweep    – a laser sheet passes across the floor plan
    //  radar    – one tripod scanner turns 360° in the middle of the space
    //  rise     – the capture climbs from the floor to the ceiling
    //  stations – the camera hops between four tripod positions, each reaching outward
    //  walk     – a handheld scanner walks a path through the rooms
    var STYLES = [
      { mode: 'sweep' },
      { mode: 'radar', at: [2.2, -1.2], a0: -2.4 },
      { mode: 'rise' },
      { mode: 'stations', at: [[-3.2, -2.2], [3.6, -2.0], [3.4, 3.0], [-3.0, 3.0]], reach: 4.2 },
      { mode: 'walk', path: [[.9, -4.2], [-.8, -2.6], [-4.4, -2.2], [-4.9, 1.0], [-3.4, 2.6], [-.1, 2.6], [1.8, .4], [4.4, -1.8], [5.0, 1.6], [4.8, 3.4]], reach: 3.4 },
    ];
    function walkPts(path, n) { // evenly spaced samples along a polyline
      var seg = [], tot = 0; for (var i = 1; i < path.length; i++) { var l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); tot += l; }
      var out = []; for (var k = 0; k <= n; k++) { var d = tot * k / n, j = 0; while (j < seg.length - 1 && d > seg[j]) { d -= seg[j]; j++; } var u = Math.min(1, d / seg[j]);
        out.push([path[j][0] + (path[j + 1][0] - path[j][0]) * u, path[j][1] + (path[j + 1][1] - path[j][1]) * u]); }
      return out;
    }
    function revealFn(st) {
      if (st.mode === 'sweep') return function (x) { return (x + 8) / 16; };
      if (st.mode === 'rise') return function (x, y) { return Math.max(0, Math.min(1, (y + .06) / (WH + .1))); };
      if (st.mode === 'radar') return function (x, y, z) { var a = Math.atan2(z - st.at[1], x - st.at[0]) - st.a0; a = ((a % 6.2832) + 6.2832) % 6.2832; return a / 6.2832; };
      if (st.mode === 'stations') return function (x, y, z) { // captured by the first station whose reach covers the point
        var n = st.at.length, near = 0, nd = 1e9;
        for (var i = 0; i < n; i++) { var d = Math.hypot(x - st.at[i][0], z - st.at[i][1]); if (d < st.reach) return (i + d / st.reach) / n; if (d < nd) { nd = d; near = i; } }
        return (near + .98) / n; };
      if (st.mode === 'walk') { var W = st.samples = walkPts(st.path, 160);
        return function (x, y, z) { for (var k = 0; k < W.length; k++) if (Math.hypot(x - W[k][0], z - W[k][1]) < st.reach) return k / (W.length - 1);
          var bk = 0, bd = 1e9; W.forEach(function (q, k) { var d = Math.hypot(x - q[0], z - q[1]); if (d < bd) { bd = d; bk = k; } }); return bk / (W.length - 1); }; }
    }
    // scenes are built on demand (first one immediately, the rest when the browser is idle)
    function buildScene(i) { var pl = PLANS[i];
      S = { boxes: [], pts: [], labels: [], name: pl.name[ar ? 1 : 0], st: STYLES[i] }; pl.build();
      S.pts.forEach(function (p) { p[0] += (r() - .5) * .02; p[1] += (r() - .5) * .02; p[2] += (r() - .5) * .02; });
      var f = revealFn(S.st);
      S.pts.forEach(function (p) { p[5] = f(p[0], p[1], p[2]); });
      S.boxes.forEach(function (b) { b.f = f((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); });
      // group points by colour so each frame sets fillStyle a few dozen times, not thousands
      S.buckets = [];
      S.pts.forEach(function (p) { var hb = Math.max(0, Math.min(7, Math.floor(p[1] / WH * 8))), key = p[3] * 8 + hb;
        (S.buckets[key] = S.buckets[key] || { pts: [], type: p[3], h: (hb + .5) / 8 }).pts.push(p); });
      S.buckets = S.buckets.filter(Boolean).map(function (bk) { var hg = bk.h;
        bk.col = bk.type === 2 ? 'hsl(' + (150 + hg * 70) + ',85%,66%)' : 'hsl(' + (152 + hg * 72) + ',72%,' + (42 + hg * 14) + '%)';
        bk.alpha = bk.type === 1 ? .45 : .92; bk.size = bk.type === 2 ? 1.35 : 1.1; return bk; });
      return S;
    }
    var scenes = [], FIXED = cv.dataset.scene != null ? +cv.dataset.scene : null;
    function getScene(i) { return scenes[i] || (scenes[i] = buildScene(i)); }
    getScene(FIXED != null ? FIXED : 0);
    if (FIXED == null) { var later = window.requestIdleCallback ? function (f) { requestIdleCallback(f, { timeout: 2500 }); } : function (f) { setTimeout(f, 400); };
      var pre = 1, idleBuild = function () { if (pre < PLANS.length) { getScene(pre++); later(idleBuild); } }; setTimeout(function () { later(idleBuild); }, 1200); }

    function clip(poly, sx, ax) { // keep the part with coordinate[ax] >= sx
      ax = ax || 0; var out = [];
      for (var i = 0; i < poly.length; i++) {
        var A = poly[i], B = poly[(i + 1) % poly.length], ina = A[ax] >= sx, inb = B[ax] >= sx;
        if (ina) out.push(A);
        if (ina !== inb) { var q = (sx - A[ax]) / (B[ax] - A[ax]); out.push([A[0] + (B[0] - A[0]) * q, A[1] + (B[1] - A[1]) * q, A[2] + (B[2] - A[2]) * q]); }
      }
      return out;
    }
    function size() { var b = cv.getBoundingClientRect(); w = b.width; h = b.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(cv);
    var ease = function (x) { x = Math.max(0, Math.min(1, x)); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var SCENE = 10; // seconds per plan: 0–1.8 solid · 1.8–5.8 scan · 5.8–9.2 point cloud · 9.2–10 fade out

    // ---------- interaction: drag to orbit, pinch / wheel to zoom, two-finger or right-drag to pan ----------
    var V = { yaw: .38, pitch: .92, zoom: 1, panX: 0, panY: 0 }, HOME = { yaw: .38, pitch: .92, zoom: 1, panX: 0, panY: 0 };
    var TG = { yaw: .38, pitch: .92, zoom: 1, panX: 0, panY: 0 }, vel = { yaw: 0, pitch: 0 }; // targets + release momentum
    var swayAmt = 1, ptrs = {}, lastInteract = -1e9, sceneClock = 0, lastNow = null, forcedScene = null;
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    function touched() { lastInteract = performance.now(); hint.classList.add('gone'); }
    var host = cv.parentNode;
    // overlay UI
    var top = document.createElement('div'); top.className = 'v-top';
    var chips = (FIXED != null ? [] : PLANS).map(function (pl, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'v-chip'; b.textContent = pl.name[ar ? 1 : 0].split(' · ')[0];
      b.addEventListener('click', function () { sceneClock = i * SCENE + .01; touched(); }); top.appendChild(b); return b; });
    var bottom = document.createElement('div'); bottom.className = 'v-bottom';
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    var hint = document.createElement('span'); hint.className = 'v-hint';
    hint.textContent = ar ? (coarse ? 'اسحب بإصبعك للتدوير · قرّب بإصبعين' : 'اسحب للتدوير · استخدم العجلة للتكبير · زر الفأرة الأيمن للتحريك') : (coarse ? 'Drag to rotate · Pinch to zoom' : 'Drag to rotate · Scroll to zoom · Right-drag to pan');
    var btns = document.createElement('div'); btns.className = 'v-btns';
    [['+', ar ? 'تكبير' : 'Zoom in', function () { TG.zoom = clamp(TG.zoom * 1.25, .55, 3.5); }], ['−', ar ? 'تصغير' : 'Zoom out', function () { TG.zoom = clamp(TG.zoom / 1.25, .55, 3.5); }],
     ['⟲', ar ? 'إعادة العرض' : 'Reset view', function () { for (var k in HOME) TG[k] = HOME[k]; vel.yaw = vel.pitch = 0; }]].forEach(function (d) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'v-btn'; b.textContent = d[0]; b.setAttribute('aria-label', d[1]); b.title = d[1];
      b.addEventListener('click', function () { d[2](); touched(); }); btns.appendChild(b); });
    bottom.appendChild(hint); bottom.appendChild(btns);
    if (host && host.hasAttribute('data-viewer')) { if (FIXED == null) host.appendChild(top); host.appendChild(bottom); }

    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey }; touched(); });
    cv.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p) return;
      var ids = Object.keys(ptrs);
      if (ids.length === 1) {
        var dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (p.btn === 2 || p.shift) { TG.panX += dx; TG.panY += dy; }
        else { var dyw = dx * .008 * (rtl ? -1 : 1), dpt = -dy * .006; TG.yaw += dyw; TG.pitch = clamp(TG.pitch + dpt, .3, 1.45); vel.yaw = dyw; vel.pitch = dpt; }
      } else if (ids.length === 2) {
        var o = ptrs[ids[0] == e.pointerId ? ids[1] : ids[0]];
        var d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        if (d0 > 0) TG.zoom = clamp(TG.zoom * d1 / d0, .55, 3.5);
        TG.panX += (e.clientX - p.x) / 2; TG.panY += (e.clientY - p.y) / 2;
      }
      p.x = e.clientX; p.y = e.clientY; touched();
    });
    var up = function (e) { delete ptrs[e.pointerId]; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); TG.zoom = clamp(TG.zoom * Math.exp(-e.deltaY * .0015), .55, 3.5); touched(); }, { passive: false });
    cv.addEventListener('dblclick', function () { for (var k in HOME) TG[k] = HOME[k]; touched(); });
    cv.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowLeft') TG.yaw -= .12; else if (k === 'ArrowRight') TG.yaw += .12; else if (k === 'ArrowUp') TG.pitch = clamp(TG.pitch + .08, .3, 1.45); else if (k === 'ArrowDown') TG.pitch = clamp(TG.pitch - .08, .3, 1.45);
      else if (k === '+' || k === '=') TG.zoom = clamp(TG.zoom * 1.2, .55, 3.5); else if (k === '-') TG.zoom = clamp(TG.zoom / 1.2, .55, 3.5); else used = false;
      if (used) { e.preventDefault(); touched(); } });

    function frame(now) {
      if (!cv.isConnected) return;
      if (visible || reduce) {
        var dt = lastNow == null ? 0 : Math.min(.1, (now - lastNow) / 1000); lastNow = now;
        var idle = now - lastInteract > 5000;
        // the scene clock pauses while someone is exploring the model
        if (!reduce && idle) sceneClock += dt;
        var t = window.__mkT != null ? window.__mkT : sceneClock;
        var idx = FIXED != null ? FIXED : Math.floor(t / SCENE) % PLANS.length, ph = reduce ? 3.8 : t % SCENE, sc = getScene(idx);
        chips.forEach(function (b, i) { b.setAttribute('aria-pressed', i === idx ? 'true' : 'false'); });
        var st = sc.st, mode = st.mode;
        var prog = ph < 1.8 ? 0 : ph < 5.8 ? (mode === 'sweep' || mode === 'rise' ? ease((ph - 1.8) / 4) : (ph - 1.8) / 4) : 1.001;
        var scanning = ph > 1.8 && ph < 5.8;
        // planar modes cut the solid model exactly; the others dissolve it piece by piece
        var cutAx = mode === 'sweep' ? 0 : mode === 'rise' ? 1 : -1;
        var sweep = mode === 'sweep' ? -8 + 16 * Math.min(1, prog) : mode === 'rise' ? -.06 + (WH + .1) * Math.min(1, prog) : -1e9;
        var fade = ph < .9 ? ease(ph / .9) : ph > 9.0 ? ease(Math.max(0, (SCENE - ph) / 1.0)) : 1;
        var settle = ph < .9 ? (1 - ease(ph / .9)) * .06 : ph > 9.0 ? (1 - ease((SCENE - ph) / 1.0)) * -.04 : 0;
        var shimmer = ph > 5.8 ? Math.min(1, (ph - 5.8) / 1.5) : 0;

        if (!Object.keys(ptrs).length && (Math.abs(vel.yaw) > 1e-4 || Math.abs(vel.pitch) > 1e-4)) { TG.yaw += vel.yaw; TG.pitch = clamp(TG.pitch + vel.pitch, .3, 1.45); vel.yaw *= .92; vel.pitch *= .88; }
        var ek = 1 - Math.pow(.001, dt || .016); // frame-rate independent smoothing
        for (var key in TG) V[key] += (TG[key] - V[key]) * ek;
        var sway = reduce ? 0 : Math.sin((now - t0) / 1000 * .13) * .22 * swayAmt; swayAmt += ((idle ? 1 : 0) - swayAmt) * ek * .25;
        var yaw = V.yaw + sway, pitch = V.pitch;
        var cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
        var scale = (FIXED != null ? Math.min(w / (w < 600 ? 19 : 21), h / 15) : Math.min(w / (w < 600 ? 15 : 17), h / 13)) * V.zoom * (1 - settle);
        var ox = w * .5 + V.panX, oy = h * .57 + V.panY;
        function proj(p) {
          var x = p[0], y = p[1] - 1.0, z = p[2];
          var X = x * cy - z * syw, Z = x * syw + z * cy;
          var Y = y * cp + Z * sp, ZZ = -y * sp + Z * cp, q = 45 / (45 + ZZ);
          return [ox + X * scale * q, oy - Y * scale * q, ZZ, q];
        }
        function path(pr) { ctx.beginPath(); pr.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }
        ctx.clearRect(0, 0, w, h);

        ctx.save(); ctx.globalAlpha = fade;
        function drawSolid() {
          var list = [];
          sc.boxes.forEach(function (b) {
            if (cutAx === 0 && b.x1 <= sweep) return;
            if (cutAx === 1 && b.y1 <= sweep) return;
            var al = cutAx >= 0 ? 1 : Math.max(0, Math.min(1, (b.f - prog) / .045 + 1));
            if (al <= 0) return;
            var c = proj([cutAx === 0 ? (Math.max(b.x0, sweep) + b.x1) / 2 : (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2]);
            list.push({ b: b, al: al, d: b.floor ? c[2] + 1000 : c[2] - b.y1 * .02 });
          });
          list.sort(function (a, b) { return b.d - a.d; });
          list.forEach(function (it) {
            var b = it.b, x0 = b.x0, x1 = b.x1, y0 = b.y0, y1 = b.y1, z0 = b.z0, z1 = b.z1;
            var F = [
              [[[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]],
              [[[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1]],
              [[[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]],
              [[[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]],
              [[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
            ];
            ctx.globalAlpha = fade * it.al;
            F.forEach(function (f) {
              var poly = cutAx >= 0 ? clip(f[0], sweep, cutAx) : f[0]; if (poly.length < 3) return;
              var pr = poly.map(proj);
              var cr = 0; for (var i = 0; i < pr.length; i++) { var a = pr[i], c = pr[(i + 1) % pr.length]; cr += (c[0] - a[0]) * (c[1] + a[1]); }
              if (cr < 0) return; // back face
              var n = f[1], sh = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
              path(pr);
              if (b.glass) { ctx.fillStyle = 'rgba(150,200,235,.32)'; ctx.fill(); ctx.strokeStyle = 'rgba(220,240,255,.55)'; ctx.lineWidth = .7; ctx.stroke(); return; }
              var col = (b.col === C.wall && n[1] === 1) ? C.cap : b.col;
              ctx.fillStyle = 'hsl(' + col[0] + ',' + col[1] + '%,' + Math.min(97, col[2] * (.7 + sh * .38)) + '%)'; ctx.fill();
              ctx.strokeStyle = b.floor ? 'rgba(0,0,0,.12)' : 'rgba(20,26,32,.28)'; ctx.lineWidth = .6; ctx.stroke();
            });
          });
        }
        function drawPoints() {
          var zs = Math.min(2.4, Math.max(1, Math.sqrt(V.zoom))), fresh = [], win = mode === 'walk' ? .012 : .028;
          var pulse = shimmer ? .85 + .15 * Math.sin(t * 2.2) : 1;
          sc.buckets.forEach(function (bk, bi) {
            ctx.fillStyle = bk.col; ctx.globalAlpha = fade * bk.alpha * (bi % 2 ? pulse : 2 - pulse > 1 ? 1 : 2 - pulse);
            var sz = bk.size * zs, P = bk.pts;
            for (var i = 0; i < P.length; i++) {
              var p = P[i]; if (p[5] > prog) continue;
              if (scanning && prog - p[5] < win) { fresh.push(p); continue; }
              var x = p[0], y = p[1] - 1.0, z = p[2], X = x * cy - z * syw, Z = x * syw + z * cy, q = 45 / (45 - y * sp + Z * cp);
              ctx.fillRect(ox + X * scale * q, oy - (y * cp + Z * sp) * scale * q, sz, sz);
            }
          });
          if (fresh.length) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = fade; var fz = 2 * zs;
            fresh.forEach(function (p) { var pr = proj(p); ctx.fillRect(pr[0], pr[1], fz, fz); }); }
          ctx.globalAlpha = fade;
        }
        if (cutAx === 0 ? Math.sin(yaw) > 0 : cutAx === 1) { drawSolid(); drawPoints(); } else { drawPoints(); drawSolid(); }
        ctx.globalAlpha = fade;
        ctx.restore();

        if (scanning) drawScanner();
        function ring(cx, cz, rad, col, wdt) { ctx.beginPath(); for (var k = 0; k <= 48; k++) { var an = k / 48 * 6.2832, q = proj([cx + Math.cos(an) * rad, .02, cz + Math.sin(an) * rad]); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.stroke(); }
        function tripod(cx, cz) { var hd = proj([cx, 1.5, cz]); [[-.35, -.25], [.35, -.25], [0, .38]].forEach(function (l) { var f0 = proj([cx + l[0], 0, cz + l[1]]); ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(hd[0], hd[1]); ctx.strokeStyle = 'rgba(220,230,236,.9)'; ctx.lineWidth = 1.4; ctx.stroke(); });
          ctx.fillStyle = '#e9eef2'; ctx.fillRect(hd[0] - 5, hd[1] - 9, 10, 10); ctx.fillStyle = '#35d39a'; ctx.fillRect(hd[0] - 2, hd[1] - 6, 4, 4); return hd; }
        function sheet(c) { path(c); var g = ctx.createLinearGradient(c[0][0], c[0][1], c[3][0], c[3][1]); g.addColorStop(0, 'rgba(53,211,154,.24)'); g.addColorStop(1, 'rgba(47,123,255,.07)'); ctx.fillStyle = g; ctx.fill(); }
        function drawScanner() {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
          if (mode === 'sweep') {
            var c = [[sweep, -.1, -5.4], [sweep, -.1, 5.4], [sweep, WH + .7, 5.4], [sweep, WH + .7, -5.4]].map(proj); sheet(c);
            ctx.strokeStyle = 'rgba(120,255,200,.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); ctx.lineTo(c[1][0], c[1][1]); ctx.stroke();
          } else if (mode === 'rise') {
            var y = sweep, q = [[-7.6, y, -5.5], [7.6, y, -5.5], [7.6, y, 5.5], [-7.6, y, 5.5]].map(proj);
            path(q); ctx.fillStyle = 'rgba(53,211,154,.13)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,255,200,.85)'; ctx.lineWidth = 1.3; ctx.stroke();
          } else if (mode === 'radar') {
            var an = st.a0 + prog * 6.2832, R = 11, sx = st.at[0], sz = st.at[1];
            for (var k = 0; k < 6; k++) { var a2 = an - k * .05, c2 = [[sx, -.05, sz], [sx + Math.cos(a2) * R, -.05, sz + Math.sin(a2) * R], [sx + Math.cos(a2) * R, WH + .3, sz + Math.sin(a2) * R], [sx, WH + .3, sz]].map(proj);
              path(c2); ctx.fillStyle = 'rgba(53,211,154,' + (.16 - k * .025) + ')'; ctx.fill(); }
            ctx.restore(); ctx.save(); tripod(sx, sz); ring(sx, sz, .9, 'rgba(53,211,154,.8)', 1.2); ctx.restore(); return;
          } else if (mode === 'stations') {
            var n = st.at.length, i = Math.min(n - 1, Math.floor(prog * n)), loc = prog * n - i, cst = st.at[i];
            ring(cst[0], cst[1], Math.max(.05, loc * st.reach), 'rgba(120,255,200,.9)', 1.6); ring(cst[0], cst[1], Math.max(.05, loc * st.reach * .7), 'rgba(53,211,154,.35)', 1);
            for (var j = 0; j < i; j++) ring(st.at[j][0], st.at[j][1], .45, 'rgba(53,211,154,.55)', 1);
            ctx.restore(); ctx.save(); tripod(cst[0], cst[1]); ctx.restore(); return;
          } else if (mode === 'walk') {
            var W = st.samples, upto = Math.round(prog * (W.length - 1)), cur = W[Math.min(W.length - 1, upto)];
            ctx.beginPath(); for (var k2 = 0; k2 <= upto; k2++) { var q2 = proj([W[k2][0], .03, W[k2][1]]); k2 ? ctx.lineTo(q2[0], q2[1]) : ctx.moveTo(q2[0], q2[1]); }
            ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(120,255,200,.9)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
            ring(cur[0], cur[1], st.reach, 'rgba(53,211,154,.45)', 1);
            ctx.restore(); ctx.save();
            var hd = proj([cur[0], 1.25, cur[1]]), ft = proj([cur[0], 0, cur[1]]);
            ctx.strokeStyle = '#e9eef2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ft[0], ft[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
            ctx.fillStyle = '#35d39a'; ctx.beginPath(); ctx.arc(hd[0], hd[1], 5, 0, 6.2832); ctx.fill();
            ctx.fillStyle = 'rgba(53,211,154,.25)'; ctx.beginPath(); ctx.arc(hd[0], hd[1], 10 + 4 * Math.sin(now / 150), 0, 6.2832); ctx.fill();
            ctx.restore(); return;
          }
          ctx.restore();
        }
        // labels: room name + measured area, plan name and sequence
        ctx.save(); ctx.globalAlpha = fade; ctx.textAlign = 'center';
        var fs = clamp(Math.round(scale * .2), 9, 15), mono = '"IBM Plex Mono", monospace', body = ar ? '"IBM Plex Sans Arabic", system-ui' : mono;
        sc.labels.forEach(function (lb) {
          var p = proj([lb.x, .05, lb.z]);
          ctx.font = '600 ' + fs + 'px ' + body; var tw2 = ctx.measureText(lb.t).width;
          ctx.fillStyle = 'rgba(7,9,12,.55)'; ctx.fillRect(p[0] - tw2 / 2 - 5, p[1] - fs, tw2 + 10, fs * 2.25);
          ctx.fillStyle = 'rgba(240,244,247,.96)'; ctx.fillText(lb.t, p[0], p[1]);
          ctx.font = '500 ' + Math.round(fs * .9) + 'px ' + mono; ctx.fillStyle = 'rgba(53,211,154,1)'; ctx.fillText(lb.a + ' m²', p[0], p[1] + fs * 1.05);
        });
        var cap = proj([0, WH + 1.2, 5]);
        ctx.font = '500 ' + Math.round(fs * 1.1) + 'px ' + mono; ctx.fillStyle = 'rgba(139,152,164,.95)';
        if (FIXED == null) ctx.fillText('0' + (idx + 1) + ' / 0' + PLANS.length, cap[0], cap[1] - fs * 1.6);
        ctx.font = '600 ' + Math.round(fs * 1.5) + 'px ' + (ar ? body : '"Archivo", system-ui'); ctx.fillStyle = 'rgba(233,238,242,.96)';
        ctx.fillText(sc.name, cap[0], cap[1]);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('canvas.cloud').forEach(function (cv, k) {
    if (cv.dataset.mode === 'building') return buildingCanvas(cv);
    cloudCanvas(cv, { seed: 7 + k, zoom: +(cv.dataset.zoom || 1), x: cv.dataset.x ? +cv.dataset.x : null, y: cv.dataset.y ? +cv.dataset.y : null });
  });

  // ── Demo tour: load the embedded tour only when asked (keeps the page fast)
  document.querySelectorAll('[data-demo]').forEach(function (box) {
    var b = box.querySelector('[data-demo-play]'); if (!b) return;
    b.addEventListener('click', function () {
      var f = document.createElement('iframe'); f.src = box.getAttribute('data-src') + (box.hasAttribute('data-raw') ? '' : '&play=1&qs=1'); f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade'; f.allow = 'fullscreen; xr-spatial-tracking'; f.allowFullscreen = true; f.title = b.textContent;
      box.innerHTML = ''; box.appendChild(f);
    });
  });

  // ── Enquiry forms: post to the form relay, show a confirmation, fall back to WhatsApp/email on failure
  document.querySelectorAll('form[data-lead]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.elements._honey && f.elements._honey.value) return;
      var est = f.hasAttribute('data-attach-estimate') && document.querySelector('[data-est-out]');
      if (est && f.elements.estimate) f.elements.estimate.value = (est.querySelector('[data-lines]') || {}).innerText + '\nTotal: ' + (est.querySelector('[data-total]') || {}).textContent;
      var data = {}; Array.prototype.forEach.call(f.elements, function (el) { if (el.name && el.type !== 'submit') data[el.name] = el.value; });
      var btn = f.querySelector('button[type=submit]'); if (btn) { btn.disabled = true; btn.style.opacity = .6; }
      var ok = f.querySelector('.lead-ok'), err = f.querySelector('.lead-err');
      fetch(f.getAttribute('action'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function () { Array.prototype.forEach.call(f.children, function (c) { if (c !== ok) c.hidden = true; }); if (ok) ok.hidden = false; })
        .catch(function () { if (err) err.hidden = false; if (btn) { btn.disabled = false; btn.style.opacity = 1; } });
    });
  });

  // ── Tools
  var M = window.MAKAN; if (!M) return;
  var lang = document.documentElement.lang;
  var money = function (n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var dfmt = function (d) { return d.toLocaleDateString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function link(area, el) { var range = $('[data-area-range]', el), num = $('[data-area]', el); if (!range || !num) return;
    range.addEventListener('input', function () { num.value = range.value; num.dispatchEvent(new Event('input', { bubbles: true })); });
    num.addEventListener('input', function () { range.value = Math.min(+range.max, +num.value || 0); }); }

  // Estimator
  var est = $('[data-estimator]');
  if (est) {
    link(null, est);
    var out = $('[data-est-out]');
    var run = function () {
      var f = est.elements, v = function (n) { return f[n] && (f[n].type === 'checkbox' ? f[n].checked : f[n].value); };
      var travel = v('location') === 'riyadh' ? 0 : +v('km') || 0;
      $('[data-km-row]', est).hidden = v('location') === 'riyadh';
      var res = M.estimate({ area: v('area'), units: v('units'), annual: v('annual'), developer: v('developer'), rush: v('rush'), travelKm: travel, progressVisits: v('visits'),
        addons: { pointCloud: v('pointCloud'), floorPlan: v('floorPlan'), photos: v('photos'), video: v('video'), extraTags: v('extraTags') } }, M.P);
      var sch = M.schedule({ area: (+v('area') || 0) * Math.max(1, +v('units') || 1), rush: v('rush'), addons: { pointCloud: v('pointCloud'), floorPlan: v('floorPlan'), video: v('video'), bim: v('bim') } }, M.S);
      var T = M.i18n;
      $('[data-total]', out).textContent = money(res.total);
      $('[data-lines]', out).innerHTML = res.lines.map(function (l) {
        var lab = T.lines[l.key]; if (l.key === 'base') { lab = lab.replace('{a}', res.area).replace('{x}', l.meta.extraArea); if (l.meta.units > 1) lab += ' × ' + l.meta.units + ' ' + T.units; }
        if (l.meta && l.meta.visits) lab = lab.replace('{n}', l.meta.visits); if (l.meta && l.meta.tags) lab = lab.replace('{n}', l.meta.tags); if (l.meta && l.meta.km) lab = lab.replace('{n}', l.meta.km);
        return '<div><span>' + lab + '</span><span>' + money(l.amount) + '</span></div>';
      }).join('') + '<div class="sep sub"><span>' + T.subtotal + '</span><span>' + money(res.subtotal) + '</span></div><div class="sub"><span>' + T.vat + '</span><span>' + money(res.vat) + '</span></div>';
      $('[data-hosting]', out).textContent = T.hosting.replace('{m}', res.hosting.freeMonths).replace('{p}', res.hosting.monthly);
      $('[data-delivery]', out).textContent = dfmt(sch.delivery) + (v('bim') ? ' · BIM ' + dfmt(sch.bim) : '');
      $('[data-bimnote]', out).hidden = !v('bim');
      var summary = T.msg.replace('{a}', res.area + (res.units > 1 ? ' × ' + res.units + ' ' + T.units : '')).replace('{t}', money(res.total)) + ' ' + res.lines.map(function (l) { return T.short[l.key]; }).join(', ') + (v('annual') ? '. ' + T.annual : '') + (v('developer') ? '. ' + T.developer : '');
      $('[data-pref]', out).hidden = !res.preferential;
      $('[data-wa]', out).href = 'https://wa.me/' + M.phone + '?text=' + encodeURIComponent(summary);
      $('[data-mail]', out).href = 'mailto:' + M.email + '?subject=' + encodeURIComponent(T.subject) + '&body=' + encodeURIComponent(summary);
    };
    est.addEventListener('input', run); est.addEventListener('change', run); run();
  }

  // Turnaround
  var ta = $('[data-turnaround]');
  if (ta) {
    link(null, ta);
    var d0 = $('[name=start]', ta); if (d0 && !d0.value) { var dd = new Date(); dd.setDate(dd.getDate() + 1); d0.value = dd.toISOString().slice(0, 10); }
    var runT = function () {
      var f = ta.elements, v = function (n) { return f[n] && (f[n].type === 'checkbox' ? f[n].checked : f[n].value); };
      var s = M.schedule({ area: v('area'), start: v('start'), rush: v('rush'), addons: { pointCloud: v('pointCloud'), floorPlan: v('floorPlan'), video: v('video'), bim: v('bim') } }, M.S);
      var T = M.i18n.ta, o = $('[data-ta-out]');
      $('[data-ta-date]', o).textContent = dfmt(s.delivery);
      $('[data-ta-days]', o).textContent = T.days.replace('{n}', s.processDays);
      var steps = [[T.scan, s.scanDays > 1 ? dfmt(s.start) + ' – ' + dfmt(s.scanEnd) : dfmt(s.start), T.scanNote.replace('{n}', s.scanDays)], [T.process, '', T.processNote.replace('{n}', s.processDays)], [T.deliver, dfmt(s.delivery), T.deliverNote]];
      if (s.bim) steps.push([T.bim, dfmt(s.bim), T.bimNote]);
      $('[data-ta-steps]', o).innerHTML = steps.map(function (x) { return '<div class="tl"><i></i><span><b>' + x[0] + '</b><small>' + x[2] + '</small></span><span class="d">' + x[1] + '</span></div>'; }).join('');
    };
    ta.addEventListener('input', runT); ta.addEventListener('change', runT); runT();
  }

  // Area calculator
  var ar = $('[data-areacalc]');
  if (ar) {
    var list = $('[data-rooms]', ar), tot = $('[data-area-total]'), ft = $('[data-ft]'), m2 = $('[data-m2]');
    var row = function (n, l, w) { var d = document.createElement('div'); d.className = 'room'; d.innerHTML = '<input type="text" aria-label="' + M.i18n.ar.room + '" value="' + n + '"><input type="number" step="0.01" min="0" aria-label="L" value="' + l + '"><span>×</span><input type="number" step="0.01" min="0" aria-label="W" value="' + w + '"><output>0</output><button type="button" aria-label="' + M.i18n.ar.remove + '">×</button>'; list.appendChild(d); };
    var calc = function () { var s = 0; list.querySelectorAll('.room').forEach(function (r) { var i = r.querySelectorAll('input'); var a = (+i[1].value || 0) * (+i[2].value || 0); r.querySelector('output').textContent = a.toFixed(1); s += a; });
      tot.textContent = s.toFixed(1); var go = $('[data-area-go]'); if (go) go.href = go.dataset.base + '#a' + Math.round(s); };
    M.i18n.ar.sample.forEach(function (x) { row(x[0], x[1], x[2]); });
    $('[data-add-room]', ar).addEventListener('click', function () { row(M.i18n.ar.room + ' ' + (list.children.length + 1), 4, 3); calc(); });
    list.addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') { e.target.parentNode.remove(); calc(); } });
    list.addEventListener('input', calc); calc();
    if (ft && m2) { ft.addEventListener('input', function () { m2.value = ((+ft.value || 0) * 0.092903).toFixed(2); }); m2.addEventListener('input', function () { ft.value = ((+m2.value || 0) / 0.092903).toFixed(1); }); }
  }
  // Prefill estimator area from #a123
  if (est) { var m = /^#a(\d+)$/.exec(location.hash); if (m) { est.elements.area.value = m[1]; est.dispatchEvent(new Event('input')); } }
})();
