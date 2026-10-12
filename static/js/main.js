(function () {
  "use strict";

  // ----- Header: mobile menu + solid background after scrolling -----
  var header = document.getElementById("site-header");
  var toggle = document.getElementById("nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
      toggle.textContent = open ? "Close" : "Menu";
    });
  }
  function onScroll() { header.classList.toggle("scrolled", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();


  document.documentElement.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ----- Home hero: menu + headline pour out of the wine stream -----
  (function () {
    var hero = document.querySelector(".hero");
    var root = document.documentElement;
    if (!hero) return;
    if (reduceMotion || !hero.animate) { root.classList.remove("js-pour"); return; }

    // Where the wine leaves the glass, as a fraction of the hero. Tune these two numbers
    // (data-pour-x / data-pour-y on the hero) until the text appears from the right spot.
    var hr = hero.getBoundingClientRect();
    var ox = hr.left + hr.width * parseFloat(hero.dataset.pourX || 0.8);
    var oy = hr.top + hr.height * parseFloat(hero.dataset.pourY || 0.02);

    var h1 = hero.querySelector("h1");
    var chars = [];
    if (h1) {
      h1.setAttribute("aria-label", h1.textContent.replace(/\s+/g, " ").trim());
      Array.prototype.forEach.call(h1.children, function (line) {
        var words = line.textContent.trim().split(" ");
        line.textContent = "";
        words.forEach(function (word, wi) {
          var w = document.createElement("span");
          w.className = "word"; w.setAttribute("aria-hidden", "true");
          word.split("").forEach(function (c) {
            var s = document.createElement("span");
            s.className = "ch"; s.textContent = c; w.appendChild(s); chars.push(s);
          });
          line.appendChild(w);
          if (wi < words.length - 1) line.appendChild(document.createTextNode(" "));
        });
      });
    }

    var anims = [];
    function pour(el, delay, duration, spread) {
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return 0;           // hidden (e.g. desktop nav on mobile)
      var dx = ox - (r.left + r.width / 2) + (Math.random() - .5) * spread;
      var dy = oy - (r.top + r.height / 2) + (Math.random() - .5) * spread * .4;
      var a = el.animate([
        { transform: "translate(" + dx + "px," + dy + "px) scale(.15) rotate(" + ((Math.random() - .5) * 90) + "deg)", opacity: 0, filter: "blur(12px)" },
        { opacity: 1, filter: "blur(3px)", offset: .3 },
        { transform: "none", opacity: 1, filter: "blur(0px)" }
      ], { duration: duration, delay: delay, easing: "cubic-bezier(.22,.8,.28,1)", fill: "both" });
      anims.push(a);
      return delay + duration;
    }

    var end = 0, t = 80;
    var menu = document.querySelectorAll("#site-header .logo, #site-header nav a, #site-header .nav-toggle");
    Array.prototype.forEach.call(menu, function (el, i) { end = Math.max(end, pour(el, t + i * 90, 1100, 40)); });
    t = 400;
    chars.forEach(function (el, i) { end = Math.max(end, pour(el, t + i * 45, 1200, 70)); });
    t += chars.length * 45 + 150;
    var lead = hero.querySelector(".lead");
    if (lead) { end = Math.max(end, pour(lead, t, 1100, 60)); t += 180; }
    Array.prototype.forEach.call(hero.querySelectorAll(".actions .btn"), function (el, i) {
      end = Math.max(end, pour(el, t + i * 140, 1000, 60));
    });

    setTimeout(function () {
      root.classList.remove("js-pour");
      anims.forEach(function (a) { a.cancel(); });
    }, end + 250);
  })();

  // ----- Home: "Open tonight" bottles turn a full 360 as you scroll past -----
  (function () {
    var spots = Array.prototype.slice.call(document.querySelectorAll(".spot"));
    if (!spots.length) return;

    if ("IntersectionObserver" in window) {
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } });
      }, { threshold: .25 });
      spots.forEach(function (s) { rio.observe(s); });
    } else { spots.forEach(function (s) { s.classList.add("in"); }); }

    function start() { if (window.THREE) buildBottles(spots); }
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('600 40px "Bodoni Moda"'), document.fonts.load('italic 500 30px "Bodoni Moda"')])
        .then(start, start);
    } else start();
  })();

  function buildBottles(spots) {
    var T = window.THREE;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // Soft studio reflections for the glass: warm light strips and bokeh on a dark room
    var ec = document.createElement("canvas"); ec.width = 1024; ec.height = 512;
    var eg = ec.getContext("2d");
    var bg = eg.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, "#1b0810"); bg.addColorStop(1, "#050205");
    eg.fillStyle = bg; eg.fillRect(0, 0, 1024, 512);
    [[.08, .08], [.3, .12], [.52, .07], [.78, .13]].forEach(function (s) {
      var x = s[0] * 1024, w = s[1] * 1024, g = eg.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, "rgba(255,214,150,0)"); g.addColorStop(.5, "rgba(255,226,180,.95)"); g.addColorStop(1, "rgba(255,214,150,0)");
      eg.fillStyle = g; eg.fillRect(x - w, 90, w * 2, 260);
    });
    for (var i = 0; i < 40; i++) {
      var bx = Math.random() * 1024, by = 200 + Math.random() * 250, br = 10 + Math.random() * 28;
      var rg = eg.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, "rgba(255,170,70,.7)"); rg.addColorStop(1, "rgba(255,170,70,0)");
      eg.fillStyle = rg; eg.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    var envTex = new T.CanvasTexture(ec);
    envTex.mapping = T.EquirectangularReflectionMapping; envTex.encoding = T.sRGBEncoding;
    var pm = new T.PMREMGenerator(renderer);
    var env = pm.fromEquirectangular(envTex).texture;

    var COLORS = { red: [0x1a0a10, 0x5a0f22], white: [0x4d5e1f, 0xc9b98a], rose: [0x9a5560, 0xe9a0ad], sparkling: [0x1c2814, 0xb79a66] };

    function profile(type) {
      var P = type === "champagne" ? { R: 1.12, bt: 3.3, se: 5.6, nr: .31, H: 7.8, foil: 2.35 }
            : type === "burgundy" ? { R: 1, bt: 3.5, se: 5.4, nr: .31, H: 7.08, foil: 1.42 }
            : type === "sparkling" ? { R: 1.12, bt: 3.9, se: 5.5, nr: .43, H: 7.8, foil: 2.2 }
            : type === "rose" ? { R: .96, bt: 4.7, se: 5.5, nr: .37, H: 8, foil: 1.3 }
            : { R: 1, bt: 4.3, se: 6.0, nr: .385, H: 8, foil: 1.3 };
      var pts = [new T.Vector2(0, .32), new T.Vector2(P.R * .45, .1), new T.Vector2(P.R * .86, 0), new T.Vector2(P.R * .97, .08), new T.Vector2(P.R, .3), new T.Vector2(P.R, P.bt)];
      if (type === "champagne") {
        // rounded champagne shoulder, traced from the photograph (radius, height)
        var sh = [[1.12, 3.3], [1.03, 3.81], [.82, 4.33], [.62, 4.6], [.47, 4.97], [.36, 5.35], [.31, 5.6]];
        new T.SplineCurve(sh.map(function (q) { return new T.Vector2(q[0], q[1]); })).getPoints(26).forEach(function (q, i) { if (i) pts.push(q); });
      } else {
        var n = 18;
        for (var i = 1; i <= n; i++) {
          var u = i / n, s = u * u * (3 - 2 * u);
          pts.push(new T.Vector2(P.R + (P.nr - P.R) * s, P.bt + (P.se - P.bt) * u));
        }
      }
      pts.push(new T.Vector2(P.nr, P.H - .45), new T.Vector2(P.nr + .05, P.H - .4), new T.Vector2(P.nr + .05, P.H - .05), new T.Vector2(P.nr, P.H), new T.Vector2(0, P.H));
      return { P: P, pts: pts };
    }

    function wrap(g, text, maxW) {
      var words = text.split(" "), lines = [], line = "";
      words.forEach(function (w) {
        var test = line ? line + " " + w : w;
        if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
      });
      if (line) lines.push(line);
      return lines;
    }

    function frontLabel(d) {
      var W = 512, H = 584, c = document.createElement("canvas"); c.width = W; c.height = H;
      var g = c.getContext("2d");
      g.fillStyle = "#efe4cf"; g.fillRect(0, 0, W, H);
      for (var i = 0; i < 1800; i++) { g.fillStyle = "rgba(90,60,30," + Math.random() * .05 + ")"; g.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6); }
      g.strokeStyle = "#a98a55"; g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44);
      g.lineWidth = 1; g.strokeRect(32, 32, W - 64, H - 64);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.beginPath(); g.arc(W / 2, 118, 42, 0, 6.2832); g.lineWidth = 2; g.stroke();
      g.fillStyle = "#7a2238"; g.font = '700 44px "Bodoni Moda", Georgia, serif'; g.fillText("O", W / 2, 120);
      g.fillStyle = "#2b1218"; g.font = '600 46px "Bodoni Moda", Georgia, serif';
      var lines = wrap(g, d.name.toUpperCase(), W - 120), y = 230;
      lines.forEach(function (l, k) { g.fillText(l, W / 2, y + k * 54); });
      y += lines.length * 54 + 6;
      g.fillStyle = "#a98a55"; g.fillRect(W / 2 - 40, y, 80, 2);
      g.fillStyle = "#5a4650"; g.font = 'italic 500 28px "Bodoni Moda", Georgia, serif';
      g.fillText(d.region, W / 2, y + 40);
      g.fillStyle = "#7a2238"; g.font = '500 52px "Bodoni Moda", Georgia, serif';
      g.fillText(d.year, W / 2, H - 100);
      var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
    }

    function backLabel(d) {
      var W = 384, H = 300, c = document.createElement("canvas"); c.width = W; c.height = H;
      var g = c.getContext("2d");
      g.fillStyle = "#efe4cf"; g.fillRect(0, 0, W, H);
      g.strokeStyle = "#a98a55"; g.lineWidth = 2; g.strokeRect(14, 14, W - 28, H - 28);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#2b1218"; g.font = '600 24px "Bodoni Moda", Georgia, serif'; g.fillText("Oriel Wine Room", W / 2, 52);
      g.fillStyle = "#5a4650"; g.font = '400 18px "DM Sans", system-ui, sans-serif';
      wrap(g, d.notes, W - 80).slice(0, 4).forEach(function (l, k) { g.fillText(l, W / 2, 100 + k * 28); });
      g.font = '500 15px "DM Sans", system-ui, sans-serif'; g.fillText("750 ml  \u00b7  contains sulphites", W / 2, H - 38);
      var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
    }

    function makeBottle(d) {
      var pr = profile(d.type), P = pr.P, col = COLORS[d.type] || COLORS.red;
      var group = new T.Group();
      var glass = new T.MeshStandardMaterial({ color: col[0], metalness: .2, roughness: .1, envMap: env, envMapIntensity: 1.5 });
      group.add(new T.Mesh(new T.LatheGeometry(pr.pts, 72), glass));

      var foil = new T.MeshStandardMaterial({ color: col[1], metalness: .65, roughness: .32, envMap: env, envMapIntensity: 1.2 });
      var fr = P.nr + .06;
      var cap = new T.Mesh(new T.CylinderGeometry(fr, fr + .01, P.foil, 48), foil);
      cap.position.y = P.H - P.foil / 2 + .02; group.add(cap);
      var top = new T.Mesh(new T.CylinderGeometry(fr + .03, fr + .03, .1, 48), foil);
      top.position.y = P.H + .02; group.add(top);

      var paper = function (map) { return new T.MeshStandardMaterial({ map: map, roughness: .85, metalness: 0, envMap: env, envMapIntensity: .25 }); };
      var lh = 2.4, la = 2.1, ly = P.bt * .52 + .35, lr = P.R + .012;
      var front = new T.Mesh(new T.CylinderGeometry(lr, lr, lh, 64, 1, true, -la / 2, la), paper(frontLabel(d)));
      front.position.y = ly; group.add(front);
      var ba = 1.3, back = new T.Mesh(new T.CylinderGeometry(lr, lr, 1.5, 48, 1, true, Math.PI - ba / 2, ba), paper(backLabel(d)));
      back.position.y = ly + .1; group.add(back);

      group.position.y = -P.H / 2;
      var pivot = new T.Group(); pivot.add(group);
      return { pivot: pivot, H: P.H, R: P.R };
    }

    // ===== Wine bottle with real glass, liquid that sloshes, bubbles, and the photographed label =====
    var redrawAll = function () {};
    var VERT = "varying vec3 vN; varying vec3 vW; varying vec3 vL;" +
      "void main(){ vL = position; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);" +
      "gl_Position = projectionMatrix * viewMatrix * w; }";
    var GLASS_FRAG = "uniform float uStrip; uniform vec3 uRim; varying vec3 vN; varying vec3 vW; varying vec3 vL;" +
      "void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN);" +
      "float nv = clamp(dot(N,V),0.,1.); float fres = pow(1.-nv, 3.);" +
      "vec3 R = reflect(-V,N); float az = atan(R.x, R.z);" +
      "float strip = (1.-smoothstep(0.,.32,abs(az-.55)))*.34 + (1.-smoothstep(0.,.2,abs(az+.95)))*.2;" +
      "strip *= smoothstep(.2,1.4,vL.y) * (1.-smoothstep(5.4,6.6,vL.y)*.6) * uStrip;" +
      "float k = clamp(fres*1.5 + strip, 0., 1.);" +
      "vec3 col = mix(vec3(.05,.035,.03), uRim, k);" +
      "gl_FragColor = vec4(col, clamp(.05 + fres*.8 + strip*.5, 0., .95)); }";
    // Per-wine look: bottle shape, liquid colours, capsule, label/crest placement, bubbles
    var STILL = { profile: "burgundy", level: 4.5, frAdd: .06, head: null, nb: 34, bubbleSize: .13, bubbleSpeed: 1,
                  label: { arc: 2.0, h: 2.18, y: 1.63 }, decal: { y: 6.05, h: .54, arc: 1.9 }, glassStrip: 1, glassRim: [1, .66, .32], foilEnv: 1.1 };
    function look(o) { var r = {}; for (var k in STILL) r[k] = STILL[k]; for (var j in o) r[j] = o[j]; return r; }
    var WINE_STYLES = {
      red:       look({ deep: [.105, .008, .03], light: [.52, .06, .12], swirl: [.07, .009, .02], capA: [.36, .04, .09], capB: [.85, .42, .36],
                        foil: 0x3d0818, foilMetal: .6, foilRough: .28, decalTint: 0xe8c890, bubble: ["255,200,200", "255,150,160", "255,120,130"] }),
      white:     look({ deep: [.40, .31, .04], light: [.93, .83, .38], swirl: [.06, .05, .008], capA: [.62, .52, .14], capB: [.97, .91, .60],
                        foil: 0xd9ccaa, foilMetal: .5, foilRough: .34, decalTint: 0xffffff, bubble: ["255,248,210", "255,236,160", "255,225,130"] }),
      rose:      look({ deep: [.42, .12, .15], light: [.92, .46, .52], swirl: [.07, .02, .03], capA: [.6, .22, .26], capB: [.97, .7, .72],
                        foil: 0x9a5560, foilMetal: .55, foilRough: .3, decalTint: 0xf2d9b0, bubble: ["255,220,220", "255,180,190", "255,150,160"] }),
      // Champagne: tall sloped shoulder, dark green glass, gold foil head and neck, fine fast bubbles
      sparkling: look({ profile: "champagne", level: 5.0, frAdd: .05, head: { r: .42, h: .87 }, nb: 90, bubbleSize: .095, bubbleSpeed: 1.7,
                        deep: [.03, .05, .014], light: [.34, .40, .06], swirl: [.014, .024, .005], capA: [.2, .22, .05], capB: [.55, .55, .2],
                        glassStrip: 2.1, glassRim: [.92, .95, .38], foilEnv: 1.5,
                        foil: 0xd4a13a, foilMetal: .8, foilRough: .3, decalTint: 0xffffff, bubble: ["255,250,215", "255,240,170", "255,230,140"],
                        label: { arc: 2.128, h: 1.699, y: 1.34 }, decal: { y: 6.04, h: .782, arc: 2.0 } })
    };
    var WINE_FRAG = "uniform float uTime; uniform float uLevel; uniform float uCap; uniform float uSwirl; uniform vec2 uTilt;" +
      "uniform vec3 uDeep; uniform vec3 uRuby; uniform vec3 uSwirlCol; uniform vec3 uCapA; uniform vec3 uCapB;" +
      "varying vec3 vN; varying vec3 vW; varying vec3 vL;" +
      "void main(){ if (uCap < .5 && (vW.y - dot(uTilt, vW.xz)) > uLevel) discard;" +
      "vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;" +
      "float nv = abs(dot(N,V)); float fres = pow(1.-nv, 2.2);" +
      "vec3 col = mix(uDeep, uRuby, fres);" +
      "float ang = atan(vL.z, vL.x);" +
      "float s1 = sin(vL.y*7. + ang*2. + uSwirl)*.5+.5; float s2 = sin(vL.y*13. - ang*3. + uSwirl*1.7)*.5+.5;" +
      "col += uSwirlCol * (s1*.7 + s2*.45);" +
      "vec3 L = normalize(vec3(-.5,.5,.8)); float sp = pow(max(dot(reflect(-L,N),V),0.), 22.);" +
      "col += vec3(1.,.72,.5) * sp * .5;" +
      "float a = gl_FrontFacing ? .92 : .82;" +
      "if (uCap > .5) { col = mix(uCapA, uCapB, pow(1.-nv,3.)*.6); a = .96; }" +
      "gl_FragColor = vec4(col, a); }";

    function makeWineBottle(d, scene) {
      var S = WINE_STYLES[d.type] || WINE_STYLES.red;
      var pr = profile(S.profile), P = pr.P, pts = pr.pts;
      var LEVEL = S.level, WY = -P.H / 2, loaded = 0, wanted = d.collar ? 3 : 2;
      var group = new T.Group(), loader = new T.TextureLoader();
      function load(url) {
        var t = loader.load(url, function () { loaded++; redrawAll(); });
        t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
      }

      // glass shell: nearly clear, warm rim light like the studio photograph
      var glass = new T.ShaderMaterial({ uniforms: { uStrip: { value: S.glassStrip }, uRim: { value: new T.Vector3().fromArray(S.glassRim) } },
                                         vertexShader: VERT, fragmentShader: GLASS_FRAG, transparent: true, depthWrite: false });
      var shell = new T.Mesh(new T.LatheGeometry(pts, 72), glass); shell.renderOrder = 3; group.add(shell);

      // wine: inner lathe, clipped by a tilting plane so the surface can slosh
      var inner = pts.map(function (p) { return new T.Vector2(p.x > 0 ? Math.max(.001, p.x - .09) : 0, p.y + .14); });
      var tab = inner.filter(function (p) { return p.y >= 3 && p.x > 0; });
      function rIn(y) {
        for (var i = 1; i < tab.length; i++) if (y <= tab[i].y) {
          var a = tab[i - 1], b = tab[i], t = Math.max(0, Math.min(1, (y - a.y) / ((b.y - a.y) || 1)));
          return a.x + (b.x - a.x) * t;
        }
        return tab[tab.length - 1].x;
      }
      var U = { uTime: { value: 0 }, uLevel: { value: LEVEL + WY }, uTilt: { value: new T.Vector2(0, 0) }, uSwirl: { value: 0 }, uCap: { value: 0 },
                uDeep: { value: new T.Vector3().fromArray(S.deep) }, uRuby: { value: new T.Vector3().fromArray(S.light) },
                uSwirlCol: { value: new T.Vector3().fromArray(S.swirl) }, uCapA: { value: new T.Vector3().fromArray(S.capA) },
                uCapB: { value: new T.Vector3().fromArray(S.capB) } };
      var wineMat = new T.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: WINE_FRAG, transparent: true, side: T.DoubleSide });
      var wine = new T.Mesh(new T.LatheGeometry(inner, 72), wineMat); wine.renderOrder = 1; group.add(wine);

      // wine surface (lives in the scene so it stays level while the bottle turns)
      var RN = 12, SN = 40, cpos = new Float32Array((RN + 1) * SN * 3), cnor = new Float32Array((RN + 1) * SN * 3), cidx = [];
      for (var q = 0; q < cnor.length; q += 3) { cnor[q] = 0; cnor[q + 1] = 1; cnor[q + 2] = 0; }
      for (var r = 0; r < RN; r++) for (var s = 0; s < SN; s++) {
        var a0 = r * SN + s, a1 = r * SN + (s + 1) % SN, b0 = (r + 1) * SN + s, b1 = (r + 1) * SN + (s + 1) % SN;
        cidx.push(a0, b0, a1, a1, b0, b1);
      }
      var cg = new T.BufferGeometry();
      cg.setAttribute("position", new T.BufferAttribute(cpos, 3)); cg.setAttribute("normal", new T.BufferAttribute(cnor, 3)); cg.setIndex(cidx);
      var capU = { uTime: U.uTime, uLevel: U.uLevel, uTilt: U.uTilt, uSwirl: U.uSwirl, uCap: { value: 1 },
                   uDeep: U.uDeep, uRuby: U.uRuby, uSwirlCol: U.uSwirlCol, uCapA: U.uCapA, uCapB: U.uCapB };
      var surface = new T.Mesh(cg, new T.ShaderMaterial({ uniforms: capU, vertexShader: VERT, fragmentShader: WINE_FRAG, transparent: true, side: T.DoubleSide }));
      surface.renderOrder = 1; surface.frustumCulled = false; scene.add(surface);

      // bubbles that drift up through the wine
      var NB = S.nb, bpos = new Float32Array(NB * 3), bub = [];
      for (var i = 0; i < NB; i++) bub.push({ y: .8 + Math.random() * (LEVEL - 1), a: Math.random() * 6.283, rr: Math.random() * .8, v: (.004 + Math.random() * .009) * S.bubbleSpeed, ph: Math.random() * 6.283 });
      var bg = new T.BufferGeometry(); bg.setAttribute("position", new T.BufferAttribute(bpos, 3));
      var dot = document.createElement("canvas"); dot.width = dot.height = 32; var dg = dot.getContext("2d");
      var rg = dg.createRadialGradient(16, 16, 0, 16, 16, 16); rg.addColorStop(0, "rgba(" + S.bubble[0] + ",.95)"); rg.addColorStop(.5, "rgba(" + S.bubble[1] + ",.35)"); rg.addColorStop(1, "rgba(" + S.bubble[2] + ",0)");
      dg.fillStyle = rg; dg.fillRect(0, 0, 32, 32);
      var bubbles = new T.Points(bg, new T.PointsMaterial({ map: new T.CanvasTexture(dot), size: S.bubbleSize, transparent: true, depthWrite: false, opacity: .8 }));
      bubbles.renderOrder = 2; bubbles.frustumCulled = false; group.add(bubbles);

      // foil capsule with the crest and lettering taken from the photograph
      var foil = new T.MeshStandardMaterial({ color: S.foil, metalness: S.foilMetal, roughness: S.foilRough, envMap: env, envMapIntensity: S.foilEnv });
      var fr = P.nr + S.frAdd;
      var cap = new T.Mesh(new T.CylinderGeometry(fr, fr + .01, P.foil, 48), foil); cap.position.y = P.H - P.foil / 2 + .02; group.add(cap);
      var topR = S.head ? S.head.r + .005 : fr + .03;
      var top = new T.Mesh(new T.CylinderGeometry(topR, topR, .1, 48), foil); top.position.y = P.H + .02; group.add(top);
      var rim = new T.Mesh(new T.CylinderGeometry(fr + .02, fr + .02, .08, 48), foil); rim.position.y = P.H - P.foil + .06; group.add(rim);
      if (S.head) {      // crimped foil head over the wire cage
        var headMat = new T.MeshStandardMaterial({ color: S.foil, metalness: S.foilMetal, roughness: S.foilRough + .05, envMap: env, envMapIntensity: S.foilEnv, flatShading: true });
        var head = new T.Mesh(new T.CylinderGeometry(S.head.r, S.head.r + .015, S.head.h, 18, 3), headMat);
        head.position.y = P.H - S.head.h / 2 + .02; group.add(head);
        var neckRing = new T.Mesh(new T.CylinderGeometry(S.head.r - .02, fr + .015, .16, 24), foil);
        neckRing.position.y = P.H - S.head.h - .05; group.add(neckRing);
      }
      var dc = S.decal;
      var decalMat = new T.MeshBasicMaterial({ map: load(d.capDecal), transparent: true, toneMapped: false, color: S.decalTint, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      var decal = new T.Mesh(new T.CylinderGeometry(fr + .016, fr + .016, dc.h, 40, 1, true, -dc.arc / 2, dc.arc), decalMat); decal.position.y = dc.y; group.add(decal);

      // seal collar around the neck (champagne): dark band plus the photographed crest on the front
      if (d.collar) {
        var cy = 5.0, ch = .865, crT = .52, crB = .68;
        var band = new T.Mesh(new T.CylinderGeometry(crT - .004, crB - .004, ch, 48, 1, true),
          new T.MeshStandardMaterial({ color: 0x0b0807, metalness: .2, roughness: .45, envMap: env, envMapIntensity: .3, side: T.DoubleSide }));
        band.position.y = cy; group.add(band);
        var collarMat = new T.MeshBasicMaterial({ map: load(d.collar), transparent: true, alphaTest: .04, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
        var collar = new T.Mesh(new T.CylinderGeometry(crT, crB, ch, 48, 1, true, -Math.PI / 2, Math.PI), collarMat);
        collar.position.y = cy; group.add(collar);
      }

      // labels (front label is the photographed one)
      var paper = function (map) { return new T.MeshStandardMaterial({ map: map, roughness: .85, metalness: 0, envMap: env, envMapIntensity: .25 }); };
      var lr = P.R + .014, lb = S.label, ly = lb.y;
      var front = new T.Mesh(new T.CylinderGeometry(lr, lr, lb.h, 64, 1, true, -lb.arc / 2, lb.arc), paper(load(d.label))); front.position.y = ly; group.add(front);
      var back = new T.Mesh(new T.CylinderGeometry(lr, lr, 1.5, 48, 1, true, Math.PI - .65, 1.3), paper(backLabel(d))); back.position.y = ly + .1; group.add(back);

      group.position.y = WY;
      var pivot = new T.Group(); pivot.add(group);

      var st = { A: .06, phi: 0, last: null };
      function update(it, t) {
        var dr = st.last == null ? 0 : it.rot - st.last; st.last = it.rot;
        st.A += (Math.min(.42, .06 + Math.abs(dr) * 9) - st.A) * .07;     // faster scroll = bigger slosh
        st.phi += .05 + dr * 2.2;
        var tx = st.A * Math.cos(st.phi), tz = st.A * Math.sin(st.phi);
        U.uTilt.value.set(tx, tz); U.uTime.value = t; U.uSwirl.value = st.phi * 1.3 + it.rot * .5;

        // liquid surface: tilted plane plus small ripples, radius follows the glass wall
        var lw = LEVEL + WY, k = 0;
        for (var rr = 0; rr <= RN; rr++) {
          var f = rr / RN;
          for (var s = 0; s < SN; s++) {
            var th = s / SN * 6.2832, c = Math.cos(th), sn = Math.sin(th), y = lw, rad = 0;
            for (var n = 0; n < 2; n++) {
              rad = f * rIn(y - WY);
              y = lw + tx * rad * c + tz * rad * sn + Math.sin(f * 11 - t * 3.2 + th * 2) * .012 * f * (1 + st.A * 8);
            }
            cpos[k++] = rad * c; cpos[k++] = y; cpos[k++] = rad * sn;
          }
        }
        cg.attributes.position.needsUpdate = true;

        for (var i = 0; i < NB; i++) {
          var p = bub[i]; p.y += p.v * (1 + st.A * 6);
          if (p.y > LEVEL - .12) { p.y = .8; p.a = Math.random() * 6.283; p.rr = Math.random() * .8; }
          var wob = Math.sin(t * 2 + p.ph) * .03, rd = rIn(p.y) * p.rr;
          bpos[i * 3] = Math.cos(p.a) * rd + wob; bpos[i * 3 + 1] = p.y; bpos[i * 3 + 2] = Math.sin(p.a) * rd;
        }
        bg.attributes.position.needsUpdate = true;
      }
      return { pivot: pivot, H: P.H, R: P.R, wine: true, update: update, ready: function () { return loaded >= wanted; } };
    }

    var items = spots.map(function (el) {
      var canvas = el.querySelector("canvas"), d = el.dataset;
      var scene = new T.Scene(); scene.environment = env;
      var key = new T.DirectionalLight(0xffcf8a, 1.3); key.position.set(-5, 6, 8); scene.add(key);
      var rim = new T.DirectionalLight(0xff8a5a, 1.1); rim.position.set(6, 3, -4); scene.add(rim);
      scene.add(new T.AmbientLight(0x442030, .6));
      var b = d.label ? makeWineBottle({ type: d.type, label: d.label, capDecal: d.capDecal, collar: d.collar, name: d.name, region: d.region, year: d.year, notes: d.notes }, scene)
                      : makeBottle({ type: d.type, name: d.name, region: d.region, year: d.year, notes: d.notes });
      scene.add(b.pivot);
      return { el: el, canvas: canvas, ctx: canvas.getContext("2d"), scene: scene, cam: new T.PerspectiveCamera(24, 1, 1, 100),
               b: b, rot: 0, target: 0, visible: false, w: 0, h: 0, baseFrac: 1, gl: false };
    });
    redrawAll = function () { items.forEach(function (it) { if (it.b.wine) draw(it); }); };

    function size(it) {
      var w = Math.round(it.canvas.clientWidth * DPR), h = Math.round(it.canvas.clientHeight * DPR);
      if (!w || !h) return false;
      if (w !== it.w || h !== it.h) {
        it.w = w; it.h = h; it.canvas.width = w; it.canvas.height = h;
        var half = Math.tan(12 * Math.PI / 180), asp = w / h;
        if (it.b.wine) {
          // bottle fills ~76% of the canvas height; the rest holds its reflection on the table
          var dist = Math.max((it.b.H / .83) / (2 * half), (it.b.R * 1.3) / (half * asp));
          var Hv = 2 * dist * half, yc = it.b.H / 2 - .48 * Hv;
          it.baseFrac = it.b.H / Hv + .02;
          it.cam.aspect = asp; it.cam.position.set(0, yc + dist * .1, dist); it.cam.lookAt(0, yc, 0); it.cam.updateProjectionMatrix();
        } else {
          var dist2 = Math.max((it.b.H / 2 * 1.12) / half, (it.b.R * 1.25) / (half * asp));
          it.cam.aspect = asp; it.cam.position.set(0, 0, dist2); it.cam.lookAt(0, 0, 0); it.cam.updateProjectionMatrix();
        }
      }
      return true;
    }

    // Front label faces you when the panel is centred; full turn from entering to leaving, lingering on the front
    function targetRot(el, wine) {
      var r = el.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      var x = (p - .5) * 2;
      if (wine) {                                   // the whole 360 happens while the bottle is on screen
        x = Math.max(-1, Math.min(1, x / .72));
        return Math.PI * (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), 1.35);
      }
      return Math.PI * (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), 1.5);
    }

    function draw(it) {
      if (!size(it)) return;
      renderer.setSize(it.w, it.h, false);
      it.b.pivot.rotation.y = it.rot + (it.b.wine ? Math.sin(performance.now() / 1900) * .07 : 0);   // full 360, plus a slow idle sway
      if (it.b.update) it.b.update(it, performance.now() / 1000);
      renderer.render(it.scene, it.cam);
      var g = it.ctx; g.clearRect(0, 0, it.w, it.h);
      g.drawImage(renderer.domElement, 0, 0);
      if (it.b.wine) {                                     // mirror-image on the table, fading out
        var yb = Math.round(it.baseFrac * it.h);
        g.save(); g.beginPath(); g.rect(0, yb, it.w, it.h - yb); g.clip();
        g.translate(0, 2 * yb); g.scale(1, -1); g.globalAlpha = .4; g.drawImage(renderer.domElement, 0, 0); g.restore();
        var fade = g.createLinearGradient(0, yb, 0, it.h);
        fade.addColorStop(0, "rgba(0,0,0,.15)"); fade.addColorStop(1, "rgba(0,0,0,1)");
        g.save(); g.globalCompositeOperation = "destination-out"; g.fillStyle = fade; g.fillRect(0, yb, it.w, it.h - yb); g.restore();
        if (!it.gl && it.b.ready()) { it.gl = true; it.el.classList.add("gl"); }
      }
    }

    if (reduceMotion) { items.forEach(draw); window.addEventListener("resize", function () { items.forEach(draw); }); return; }

    if ("IntersectionObserver" in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          items.forEach(function (it) { if (it.el === e.target) it.visible = e.isIntersecting; });
        });
      }, { rootMargin: "10% 0px" });
      items.forEach(function (it) { vio.observe(it.el); });
    } else items.forEach(function (it) { it.visible = true; });

    items.forEach(function (it) { it.rot = it.target = targetRot(it.el, it.b.wine); draw(it); });

    (function loop() {
      items.forEach(function (it) {
        if (!it.visible) return;
        it.target = targetRot(it.el, it.b.wine);
        it.rot += (it.target - it.rot) * .12;       // a little inertia so it feels weighty
        draw(it);
      });
      requestAnimationFrame(loop);
    })();
  }

  // ----- Home: background video -----
  var video = document.getElementById("hero-video");
  var vToggle = document.getElementById("video-toggle");
  if (video && vToggle) {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      video.pause();
      vToggle.textContent = "Play video";
      vToggle.setAttribute("aria-label", "Play background video");
    }
    vToggle.addEventListener("click", function () {
      if (video.paused) {
        video.play();
        vToggle.textContent = "Pause video";
        vToggle.setAttribute("aria-label", "Pause background video");
      } else {
        video.pause();
        vToggle.textContent = "Play video";
        vToggle.setAttribute("aria-label", "Play background video");
      }
    });
  }

  // ----- Pouring-wine videos: play only while on screen, stay still for reduced motion -----
  var pours = Array.prototype.slice.call(document.querySelectorAll(".pour"));
  if (pours.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { var p = en.target.play(); if (p && p.catch) p.catch(function () {}); }
          else en.target.pause();
        });
      });
      pours.forEach(function (v) { io.observe(v); });
    } else {
      pours.forEach(function (v) { v.play(); });
    }
  }

  // ----- Wine list: filter + expand -----
  var list = document.getElementById("wine-list");
  if (list) {
    var wines = Array.prototype.slice.call(list.querySelectorAll(".wine"));
    var chips = document.querySelectorAll(".chip");
    var count = document.getElementById("count");

    function applyFilter(type) {
      var shown = 0;
      wines.forEach(function (w) {
        var match = type === "all" || w.dataset.type === type;
        w.hidden = !match;
        if (match) {
          w.style.animation = "none";
          void w.offsetWidth; // restart the slide-in animation
          w.style.animation = "";
          w.style.animationDelay = (shown * 60) + "ms";
          shown++;
        }
      });
      count.textContent = shown + (shown === 1 ? " wine" : " wines");
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip); });
        applyFilter(chip.dataset.filter);
      });
    });

    wines.forEach(function (w) {
      var row = w.querySelector(".row");
      row.addEventListener("click", function () {
        var open = w.classList.toggle("open");
        row.setAttribute("aria-expanded", open);
      });
    });

    applyFilter("all");

    // Open a wine linked from another page, e.g. /wines#wine-4
    if (location.hash) {
      var target = document.querySelector(location.hash);
      if (target && target.classList.contains("wine")) {
        target.classList.add("open");
        target.querySelector(".row").setAttribute("aria-expanded", "true");
      }
    }
  }

  // ----- Reservation form -----
  var form = document.getElementById("resform");
  if (form) {
    var msg = document.getElementById("msg");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "";
      msg.textContent = "";
      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = v; });

      fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().then(function (out) { return { ok: res.ok, out: out }; });
        })
        .then(function (r) {
          msg.textContent = r.out.message;
          msg.className = r.ok ? "ok" : "err";
          if (r.ok) form.reset();
        })
        .catch(function () {
          msg.className = "err";
          msg.textContent = "We could not reach the server. Check your connection and try again.";
        });
    });
  }
})();