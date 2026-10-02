/* ============================================================
 * astro.js — 星盘天文计算核心
 * 依赖: astronomy-engine (浏览器通过 CDN 全局 Astronomy)
 * 精度: 行星位置误差 < 1 角分 (JPL 高精度星历)
 * ============================================================ */
(function (root) {
  'use strict';

  var A = (typeof Astronomy !== 'undefined')
    ? Astronomy
    : (typeof require !== 'undefined' ? require('astronomy-engine') : null);

  if (!A) throw new Error('astronomy-engine 未加载');

  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  // ---------- 行星定义 ----------
  var BODIES = [
    { key: 'sun',     body: A.Body.Sun,     name: '太阳', glyph: '\u2609', color: '#f5b942' },
    { key: 'moon',    body: A.Body.Moon,    name: '月亮', glyph: '\u263D', color: '#cfd8e3' },
    { key: 'mercury', body: A.Body.Mercury, name: '水星', glyph: '\u263F', color: '#a8d8b9' },
    { key: 'venus',   body: A.Body.Venus,   name: '金星', glyph: '\u2640', color: '#f2a6c0' },
    { key: 'mars',    body: A.Body.Mars,    name: '火星', glyph: '\u2642', color: '#e86a5e' },
    { key: 'jupiter', body: A.Body.Jupiter, name: '木星', glyph: '\u2643', color: '#e0b56a' },
    { key: 'saturn',  body: A.Body.Saturn,  name: '土星', glyph: '\u2644', color: '#b0a48c' },
    { key: 'uranus',  body: A.Body.Uranus,  name: '天王星', glyph: '\u2645', color: '#8fd0dd' },
    { key: 'neptune', body: A.Body.Neptune, name: '海王星', glyph: '\u2646', color: '#7fa8dd' },
    { key: 'pluto',   body: A.Body.Pluto,   name: '冥王星', glyph: '\u2647', color: '#b48ead' }
  ];

  var SIGNS = [
    { name: '白羊座', glyph: '\u2648', element: 'fire' },
    { name: '金牛座', glyph: '\u2649', element: 'earth' },
    { name: '双子座', glyph: '\u264A', element: 'air' },
    { name: '巨蟹座', glyph: '\u264B', element: 'water' },
    { name: '狮子座', glyph: '\u264C', element: 'fire' },
    { name: '处女座', glyph: '\u264D', element: 'earth' },
    { name: '天秤座', glyph: '\u264E', element: 'air' },
    { name: '天蝎座', glyph: '\u264F', element: 'water' },
    { name: '射手座', glyph: '\u2650', element: 'fire' },
    { name: '摩羯座', glyph: '\u2651', element: 'earth' },
    { name: '水瓶座', glyph: '\u2652', element: 'air' },
    { name: '双鱼座', glyph: '\u2653', element: 'water' }
  ];

  function signOf(lon) {
    var idx = Math.floor(norm360(lon) / 30);
    var deg = norm360(lon) - idx * 30;
    var d = Math.floor(deg);
    var m = Math.floor((deg - d) * 60);
    return { index: idx, name: SIGNS[idx].name, glyph: SIGNS[idx].glyph, deg: d, min: m, text: d + '\u00B0' + (m < 10 ? '0' + m : m) + '\'' };
  }

  // ---------- 黄道经度（黄道分点，占星标准） ----------
  function eclipticOfDate(body, time) {
    var vec = (body === A.Body.Moon) ? A.GeoMoon(time) : A.GeoVector(body, time, true);
    var rot = A.Rotation_EQJ_ECT(time);
    var v = A.RotateVector(rot, vec);
    var sph = A.SphereFromVector(v);
    return { lon: norm360(sph.lon), lat: sph.lat };
  }

  function meanNodeLon(time) {
    // 平均月亮北交点 (Meeus): Ω = 125.0445479° − 0.05295376483°·d
    // d = 自 J2000.0 起的儒略日数。注意 astronomy-engine 的 time.tt 单位是“天”。
    var d = time.tt;
    return norm360(125.0445479 - 0.05295376483 * d);
  }

  // 真实（瞬时轨道）月亮北交点 —— 与 Swiss Ephemeris TRUE_NODE / 主流排盘软件一致。
  // 做法: 月球地心状态向量(EQJ)旋到当日真黄道(ECT)，轨道角动量 h = r × v，
  // 升交点方向 n = k̂ × h (k̂ 为黄道北极)，其方位角即升交点黄经。
  function trueNodeLon(time) {
    var st = A.GeoMoonState(time);
    var rot = A.Rotation_EQJ_ECT(time);
    var r = A.RotateVector(rot, { x: st.x, y: st.y, z: st.z });
    var v = A.RotateVector(rot, { x: st.vx, y: st.vy, z: st.vz });
    var hx = r.y * v.z - r.z * v.y;
    var hy = r.z * v.x - r.x * v.z;
    // n = (0,0,1) × h = (−hy, hx, 0)
    return norm360(Math.atan2(hx, -hy) * RAD);
  }

  // 单个天体: 位置 + 逆行 + 速度
  function bodyPosition(key, time) {
    var def = BODIES.find(function (b) { return b.key === key; });
    var p = eclipticOfDate(def.body, time);
    // 用 +0.25 天差分求速度
    var later = A.MakeTime(time.ut + 0.25);
    var p2 = eclipticOfDate(def.body, later);
    var diff = p2.lon - p.lon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    var speed = diff / 0.25; // 度/天
    return {
      key: key, name: def.name, glyph: def.glyph, color: def.color,
      lon: p.lon, lat: p.lat, speed: speed, retro: speed < 0,
      sign: signOf(p.lon)
    };
  }

  // ---------- 时间 / 时区 ----------
  function tzOffsetMinutes(utcDate, tz) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var parts = dtf.formatToParts(utcDate);
    var get = function (t) { var p = parts.find(function (x) { return x.type === t; }); return Number(p.value); };
    var asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    return (asUTC - utcDate.getTime()) / 60000;
  }

  // 本地出生时间 -> UTC Date（迭代两次处理跨午夜/DST）
  function localToUTC(y, mo, d, h, mi, tz) {
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    var off = tzOffsetMinutes(new Date(guess), tz);
    var utc = guess - off * 60000;
    off = tzOffsetMinutes(new Date(utc), tz);
    utc = guess - off * 60000;
    return new Date(utc);
  }

  function utcToLocalString(utcDate, tz) {
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(utcDate);
    } catch (e) { return utcDate.toISOString(); }
  }

  // ---------- 黄赤交角 ----------
  // 优先用 astronomy-engine 的 e_tilt 真黄赤交角(含章动，与 Swiss Ephemeris 宫位一致)；
  // 兜底 IAU 1980 多项式。注意 time.tt 是“日数”，须 /36525 化为儒略世纪数。
  function obliquity(time) {
    if (A.e_tilt) {
      var t = A.e_tilt(time);
      if (t && typeof t.tobl === 'number') return t.tobl;
    }
    var T = time.tt / 36525;
    var sec = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813));
    return 23.439291111 + sec / 3600;
  }

  // 格林尼治视恒星时(小时) -> 本地恒星时(度) = RAMC
  function ramc(time, lonEast) {
    var gast = A.SiderealTime(time); // hours
    return norm360(gast * 15 + lonEast);
  }

  // ---------- 上升点 / 中天 ----------
  function ascendantAndMC(time, lat, lonEast) {
    var eps = obliquity(time) * DEG;
    var ramcDeg = ramc(time, lonEast) * DEG;
    var phi = lat * DEG;

    var mc = Math.atan2(Math.sin(ramcDeg), Math.cos(ramcDeg) * Math.cos(eps));
    var asc = Math.atan2(Math.cos(ramcDeg), -(Math.sin(ramcDeg) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)));
    return { asc: norm360(asc * RAD), mc: norm360(mc * RAD), ramc: norm360(ramcDeg * RAD), eps: norm360(eps * RAD) };
  }

  // ---------- Placidus 宫位 ----------
  // 基于半天弧 (Semi-Diurnal Arc) 的标准迭代:
  //   cusp11: R = RAMC + SD/3     cusp12: R = RAMC + 2SD/3
  //   cusp2 : R = RAMC + 60 + 2SD/3   cusp3: R = RAMC + 120 + SD/3
  //   SD = arccos(-tan(lat) * tan(delta)), delta 为黄道点赤纬, 迭代收敛
  var PLACIDUS_SPEC = { 11: [0, 1 / 3], 12: [0, 2 / 3], 2: [60, 2 / 3], 3: [120, 1 / 3] };

  function placidusCusp(ramcDeg, lat, eps, which) {
    var spec = PLACIDUS_SPEC[which];
    var R = norm360(ramcDeg + spec[0] + spec[1] * 90); // 初值 SD=90°
    for (var i = 0; i < 30; i++) {
      var lam = raToEclLon(R, eps);
      var delta = Math.asin(Math.sin(eps * DEG) * Math.sin(lam * DEG)) * RAD;
      var t = -Math.tan(lat * DEG) * Math.tan(delta * DEG);
      if (Math.abs(t) > 1) return null; // 极圈内 Placidus 失效
      var SD = Math.acos(t) * RAD;
      var Rn = norm360(ramcDeg + spec[0] + spec[1] * SD);
      var d = Math.abs(Rn - R); if (d > 180) d = 360 - d;
      R = Rn;
      if (d < 1e-9) break;
    }
    return R;
  }

  function raToEclLon(R, eps) {
    return norm360(Math.atan2(Math.sin(R * DEG), Math.cos(R * DEG) * Math.cos(eps * DEG)) * RAD);
  }

  // ============================================================
  // 宫位制扩展：9 种制式（与 Swiss Ephemeris swehouse.c 逐行对齐）
  // 移植自 pyswisseph 2.10.3.1 源码 libswe/swehouse.c
  // 基准: pyswisseph swe.houses() 输出，误差 < 0.1°
  // ============================================================
  var VERY_SMALL = 1e-12;

  function _sind(x) { return Math.sin(x * DEG); }
  function _cosd(x) { return Math.cos(x * DEG); }
  function _tand(x) { return Math.tan(x * DEG); }
  function _clamp1(x) { return x > 1 ? 1 : (x < -1 ? -1 : x); }
  function _asind(x) { return Math.asin(_clamp1(x)) * RAD; }
  function _acosd(x) { return Math.acos(_clamp1(x)) * RAD; }
  function _atand(x) { return Math.atan(x) * RAD; }
  // swe_difdeg2n: (a - b) 归一到 (-180, 180]
  function _difdeg2n(a, b) { var d = norm360(a - b); return d > 180 ? d - 360 : d; }

  // Asc2: great circle 与黄道的交点（pole height f，赤道坐标系 x）
  function _asc2(x, f, sine, cose) {
    var ass = -_tand(f) * sine + cose * _cosd(x);
    if (Math.abs(ass) < VERY_SMALL) ass = 0;
    var sinx = _sind(x);
    if (Math.abs(sinx) < VERY_SMALL) sinx = 0;
    if (sinx === 0) {
      ass = ass < 0 ? -VERY_SMALL : VERY_SMALL;
    } else if (ass === 0) {
      ass = sinx < 0 ? -90 : 90;
    } else {
      ass = _atand(sinx / ass);
    }
    if (ass < 0) ass = 180 + ass;
    return ass;
  }

  // Asc1: 对 Asc2 做象限处理，返回黄道交点经度
  function _asc1(x1, f, sine, cose) {
    x1 = norm360(x1);
    var n = Math.floor(x1 / 90) + 1; // quadrant 1..4
    var ass;
    if (Math.abs(90 - f) < VERY_SMALL) return 180; // near north pole
    if (Math.abs(90 + f) < VERY_SMALL) return 0;   // near south pole
    if (n === 1) ass = _asc2(x1, f, sine, cose);
    else if (n === 2) ass = 180 - _asc2(180 - x1, -f, sine, cose);
    else if (n === 3) ass = 180 + _asc2(x1 - 180, -f, sine, cose);
    else ass = 360 - _asc2(360 - x1, f, sine, cose);
    ass = norm360(ass);
    if (Math.abs(ass - 90) < VERY_SMALL) ass = 90;
    if (Math.abs(ass - 180) < VERY_SMALL) ass = 180;
    if (Math.abs(ass - 270) < VERY_SMALL) ass = 270;
    if (Math.abs(ass - 360) < VERY_SMALL) ass = 0;
    return ass;
  }

  // 赤道->黄道正变换（swe_cotrans +ekl，赤纬=0），Morinus 专用
  function _raToEclLonSE(a, eps) {
    return norm360(Math.atan2(_sind(a) * _cosd(eps), _cosd(a)) * RAD);
  }

  // Porphyry 回退（SE 在极圈对 Placidus/Koch 的行为）
  function _porphyryCusps(ac, mc) {
    var cusps = new Array(13).fill(0);
    var acmc = _difdeg2n(ac, mc);
    if (acmc < 0) { ac = norm360(ac + 180); acmc = _difdeg2n(ac, mc); }
    cusps[1] = ac; cusps[10] = mc;
    cusps[2] = norm360(ac + (180 - acmc) / 3);
    cusps[3] = norm360(ac + (180 - acmc) / 3 * 2);
    cusps[11] = norm360(mc + acmc / 3);
    cusps[12] = norm360(mc + acmc / 3 * 2);
    cusps[4] = norm360(cusps[10] + 180); cusps[5] = norm360(cusps[11] + 180);
    cusps[6] = norm360(cusps[12] + 180); cusps[7] = norm360(cusps[1] + 180);
    cusps[8] = norm360(cusps[2] + 180); cusps[9] = norm360(cusps[3] + 180);
    return cusps;
  }

  // 极圈处理（R/C/T/Y）：MC 沉入地平线以下时全部 cusp 加 180（4-9 为对宫除外）
  function _polarFix(system, info, cusps) {
    if (Math.abs(info.lat) < 90 - info.eps) return;
    var acmc = _difdeg2n(info.asc, info.mc);
    if (acmc >= 0) return;
    info.asc = norm360(info.asc + 180);
    info.mc = norm360(info.mc + 180);
    var i;
    if (system === 'topocentric' || system === 'apc') {
      for (i = 1; i <= 12; i++) cusps[i] = norm360(cusps[i] + 180);
    } else { // regiomontanus / campanus
      for (i = 1; i <= 12; i++) if (i < 4 || i >= 10) cusps[i] = norm360(cusps[i] + 180);
    }
  }

  // 象限制式（K/R/C/B/T）对宫填充：cusp1=ASC、cusp10=MC，4-9 为 1-3/10-12 的对宫
  function _fillOpposites(info, cusps) {
    cusps[1] = info.asc;
    cusps[10] = info.mc;
    cusps[4] = norm360(cusps[10] + 180);
    cusps[5] = norm360(cusps[11] + 180);
    cusps[6] = norm360(cusps[12] + 180);
    cusps[7] = norm360(cusps[1] + 180);
    cusps[8] = norm360(cusps[2] + 180);
    cusps[9] = norm360(cusps[3] + 180);
  }

  // 单制式宫头计算：返回 {cusps[1..12], fallback}
  function housesForSystem(info, system) {
    var th = info.ramc, fi = info.lat, eps = info.eps;
    var sine = _sind(eps), cose = _cosd(eps);
    var tanfi = _tand(fi);
    var cusps = new Array(13).fill(0);
    var fh1, fh2, xh1, xh2, cosfi, acmc, dek, r, sda, sna, sd3, sn3, a, j, i, k, sina, cosa, c, ad3;
    var fallback = null;

    switch (system) {
      case 'koch': {
        if (Math.abs(fi) >= 90 - eps) { // SE: within polar circle -> Porphyry
          cusps = _porphyryCusps(info.asc, info.mc);
          fallback = 'porphyry';
          break;
        }
        sina = _sind(info.mc) * sine / _cosd(fi);
        if (sina > 1) sina = 1; if (sina < -1) sina = -1;
        cosa = Math.sqrt(1 - sina * sina);
        c = _atand(tanfi / cosa);
        ad3 = _asind(_sind(c) * sina) / 3.0;
        cusps[11] = _asc1(th + 30 - 2 * ad3, fi, sine, cose);
        cusps[12] = _asc1(th + 60 - ad3, fi, sine, cose);
        cusps[2] = _asc1(th + 120 + ad3, fi, sine, cose);
        cusps[3] = _asc1(th + 150 + 2 * ad3, fi, sine, cose);
        _fillOpposites(info, cusps);
        break;
      }
      case 'regiomontanus': {
        fh1 = _atand(tanfi * 0.5);
        fh2 = _atand(tanfi * _cosd(30));
        cusps[11] = _asc1(30 + th, fh1, sine, cose);
        cusps[12] = _asc1(60 + th, fh2, sine, cose);
        cusps[2] = _asc1(120 + th, fh2, sine, cose);
        cusps[3] = _asc1(150 + th, fh1, sine, cose);
        _polarFix('regiomontanus', info, cusps);
        _fillOpposites(info, cusps);
        break;
      }
      case 'campanus': {
        fh1 = _asind(_sind(fi) / 2);
        fh2 = _asind(Math.sqrt(3.0) / 2 * _sind(fi));
        cosfi = _cosd(fi);
        if (Math.abs(cosfi) === 0) {
          xh1 = xh2 = fi > 0 ? 90 : 270;
        } else {
          xh1 = _atand(Math.sqrt(3.0) / cosfi);
          xh2 = _atand(1 / Math.sqrt(3.0) / cosfi);
        }
        cusps[11] = _asc1(th + 90 - xh1, fh1, sine, cose);
        cusps[12] = _asc1(th + 90 - xh2, fh2, sine, cose);
        cusps[2] = _asc1(th + 90 + xh2, fh2, sine, cose);
        cusps[3] = _asc1(th + 90 + xh1, fh1, sine, cose);
        _polarFix('campanus', info, cusps);
        _fillOpposites(info, cusps);
        break;
      }
      case 'alcabitius': {
        acmc = _difdeg2n(info.asc, info.mc);
        if (acmc < 0) {
          info.asc = norm360(info.asc + 180);
          acmc = _difdeg2n(info.asc, info.mc);
        }
        dek = _asind(_sind(info.asc) * sine); // declination of Ascendant
        r = -tanfi * _tand(dek);
        if (r > 1) r = 1; if (r < -1) r = -1;
        sda = _acosd(r);  // semidiurnal arc
        sna = 180 - sda;  // seminocturnal arc
        sd3 = sda / 3; sn3 = sna / 3;
        cusps[11] = _asc1(norm360(th + sd3), 0, sine, cose);
        cusps[12] = _asc1(norm360(th + 2 * sd3), 0, sine, cose);
        cusps[2] = _asc1(norm360(th + 180 - 2 * sn3), 0, sine, cose);
        cusps[3] = _asc1(norm360(th + 180 - sn3), 0, sine, cose);
        _fillOpposites(info, cusps);
        break;
      }
      case 'morinus': {
        a = th;
        for (i = 1; i <= 12; i++) {
          j = i + 10; if (j > 12) j -= 12;
          a = norm360(a + 30);
          cusps[j] = _raToEclLonSE(a, eps);
        }
        acmc = _difdeg2n(info.asc, info.mc);
        if (acmc < 0) info.asc = norm360(info.asc + 180);
        break;
      }
      case 'topocentric': {
        fh1 = _atand(tanfi / 3.0);
        fh2 = _atand(tanfi * 2.0 / 3.0);
        cusps[11] = _asc1(30 + th, fh1, sine, cose);
        cusps[12] = _asc1(60 + th, fh2, sine, cose);
        cusps[2] = _asc1(120 + th, fh2, sine, cose);
        cusps[3] = _asc1(150 + th, fh1, sine, cose);
        _polarFix('topocentric', info, cusps);
        _fillOpposites(info, cusps);
        break;
      }
      case 'meridian': {
        a = th;
        for (i = 1; i <= 12; i++) {
          j = i + 10; if (j > 12) j -= 12;
          a = norm360(a + 30);
          cusps[j] = norm360(Math.atan2(_sind(a), _cosd(a) * cose) * RAD); // SE: atand(tand(a)/cose)+象限修正
        }
        acmc = _difdeg2n(info.asc, info.mc);
        if (acmc < 0) info.asc = norm360(info.asc + 180);
        break;
      }
      case 'apc': {
        // apc_sector: n=1..12, ph=lat(rad), e=eps(rad), az=ramc(rad)
        var ph = fi * DEG, e = eps * DEG, az = th * DEG;
        var kv, dasc;
        if (Math.abs(ph * RAD) > 90 - VERY_SMALL) { kv = 0; dasc = 0; }
        else {
          kv = Math.atan(_tand(fi) * _tand(eps) * Math.cos(az) / (1 + _tand(fi) * _tand(eps) * Math.sin(az)));
          if (Math.abs(ph * RAD) < VERY_SMALL) {
            dasc = (90 - VERY_SMALL) * DEG;
            if (ph < 0) dasc = -dasc;
          } else {
            dasc = Math.atan(Math.sin(kv) / Math.tan(ph));
          }
        }
        for (i = 1; i <= 12; i++) {
          var isBelow, kk;
          if (i < 8) { isBelow = 1; kk = i - 1; } else { isBelow = 0; kk = i - 13; }
          var aa = isBelow
            ? kv + az + Math.PI / 2 + kk * (Math.PI / 2 - kv) / 3
            : kv + az + Math.PI / 2 + kk * (Math.PI / 2 + kv) / 3;
          aa = ((aa % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          var dret = Math.atan2(
            Math.tan(dasc) * Math.tan(ph) * Math.sin(az) + Math.sin(aa),
            Math.cos(e) * (Math.tan(dasc) * Math.tan(ph) * Math.cos(az) + Math.cos(aa)) + Math.sin(e) * Math.tan(ph) * Math.sin(az - aa));
          cusps[i] = norm360(dret * RAD);
        }
        cusps[10] = info.mc;
        cusps[4] = norm360(info.mc + 180);
        _polarFix('apc', info, cusps);
        break;
      }
      default: break;
    }
    return { cusps: cusps, fallback: fallback };
  }

  var HOUSE_SYSTEMS = [
    { key: 'placidus', code: 'P', name: '普拉西德制（波氏）', short: 'Placidus' },
    { key: 'whole', code: 'W', name: '整宫制 (Whole Sign)', short: 'Whole Sign' },
    { key: 'equal', code: 'E', name: '等宫制 (Equal)', short: 'Equal' },
    { key: 'koch', code: 'K', name: '柯赫 (Koch)', short: 'Koch' },
    { key: 'regiomontanus', code: 'R', name: '芮氏 (Regiomontanus)', short: 'Regiomontanus' },
    { key: 'campanus', code: 'C', name: '坎氏 (Campanus)', short: 'Campanus' },
    { key: 'alcabitius', code: 'B', name: '阿卡比特 (Alcabitius)', short: 'Alcabitius' },
    { key: 'morinus', code: 'M', name: '莫氏 (Morinus)', short: 'Morinus' },
    { key: 'topocentric', code: 'T', name: '锥心 (Topocentric)', short: 'Topocentric' },
    { key: 'meridian', code: 'X', name: '子午线 (Meridian)', short: 'Meridian' },
    { key: 'apc', code: 'Y', name: 'APC', short: 'APC' }
  ];

  function computeHouses(asc, mc, time, lat, lonEast, system) {
    var info = ascendantAndMC(time, lat, lonEast);
    info.lat = lat;
    var cusps = new Array(13).fill(0);
    if (system === 'whole') {
      var start = Math.floor(info.asc / 30) * 30;
      for (var i = 1; i <= 12; i++) cusps[i] = norm360(start + (i - 1) * 30);
      return { cusps: cusps, asc: info.asc, mc: info.mc, fallback: null };
    }
    if (system === 'equal') {
      for (var j = 1; j <= 12; j++) cusps[j] = norm360(info.asc + (j - 1) * 30);
      return { cusps: cusps, asc: info.asc, mc: info.mc, fallback: null };
    }
    if (system === 'placidus') {
      var eps = info.eps;
      var c11 = placidusCusp(info.ramc, lat, eps, 11);
      var c12 = placidusCusp(info.ramc, lat, eps, 12);
      var c2 = placidusCusp(info.ramc, lat, eps, 2);
      var c3 = placidusCusp(info.ramc, lat, eps, 3);
      if (c11 === null || c12 === null || c2 === null || c3 === null) {
        // 高纬度兜底: 等宫制（ASC 起始每 30° 一宫，保持第 1 宫自 ASC 展开）
        for (var k = 1; k <= 12; k++) cusps[k] = norm360(info.asc + (k - 1) * 30);
        return { cusps: cusps, asc: info.asc, mc: info.mc, fallback: 'equal' };
      }
      cusps[10] = info.mc; cusps[11] = raToEclLon(c11, eps); cusps[12] = raToEclLon(c12, eps);
      cusps[1] = info.asc; cusps[2] = raToEclLon(c2, eps); cusps[3] = raToEclLon(c3, eps);
      cusps[4] = norm360(cusps[10] + 180); cusps[5] = norm360(cusps[11] + 180);
      cusps[6] = norm360(cusps[12] + 180); cusps[7] = norm360(cusps[1] + 180);
      cusps[8] = norm360(cusps[2] + 180); cusps[9] = norm360(cusps[3] + 180);
      return { cusps: cusps, asc: info.asc, mc: info.mc, fallback: null };
    }
    // 扩展制式（koch/regiomontanus/campanus/alcabitius/morinus/topocentric/meridian/apc）
    var h = housesForSystem(info, system);
    return { cusps: h.cusps, asc: info.asc, mc: info.mc, fallback: h.fallback };
  }

  // ---------- 合成盘宫位：由给定 ASC/MC 黄经直接求 11 种宫位制 ----------
  // 用于合盘页组合盘/马盘/时空盘等：盘面基准不是真实地理-时刻，
  // 而是双方中点得出的 ASC/MC。utcDate 仅用于计算黄赤交角。
  function housesFromAscMc(asc, mc, lat, utcDate, system) {
    var time = A.MakeTime(utcDate);
    var epsDeg = obliquity(time);              // 黄赤交角（度）
    var epsRad = epsDeg * DEG;
    var mcRad = mc * DEG;
    // MC 黄经反解 RAMC：mc = atan2(sin(ramc), cos(ramc)·cos(eps)) 的逆
    var ramcRad = Math.atan2(Math.sin(mcRad) * Math.cos(epsRad), Math.cos(mcRad));
    var ramc = norm360(ramcRad * RAD);         // 度
    var info = { asc: asc, mc: mc, ramc: ramc, eps: epsDeg, lat: lat };
    var cusps = new Array(13).fill(0);
    if (system === 'whole') {
      var start = Math.floor(norm360(asc) / 30) * 30;
      for (var i = 1; i <= 12; i++) cusps[i] = norm360(start + (i - 1) * 30);
      return { cusps: cusps, asc: asc, mc: mc, fallback: null };
    }
    if (system === 'equal') {
      for (var j = 1; j <= 12; j++) cusps[j] = norm360(asc + (j - 1) * 30);
      return { cusps: cusps, asc: asc, mc: mc, fallback: null };
    }
    if (system === 'placidus') {
      var c11 = placidusCusp(ramc, lat, epsDeg, 11);
      var c12 = placidusCusp(ramc, lat, epsDeg, 12);
      var c2 = placidusCusp(ramc, lat, epsDeg, 2);
      var c3 = placidusCusp(ramc, lat, epsDeg, 3);
      if (c11 === null || c12 === null || c2 === null || c3 === null) {
        for (var k = 1; k <= 12; k++) cusps[k] = norm360(asc + (k - 1) * 30);
        return { cusps: cusps, asc: asc, mc: mc, fallback: 'equal' };
      }
      cusps[10] = mc; cusps[11] = raToEclLon(c11, epsDeg); cusps[12] = raToEclLon(c12, epsDeg);
      cusps[1] = asc; cusps[2] = raToEclLon(c2, epsDeg); cusps[3] = raToEclLon(c3, epsDeg);
      cusps[4] = norm360(cusps[10] + 180); cusps[5] = norm360(cusps[11] + 180);
      cusps[6] = norm360(cusps[12] + 180); cusps[7] = norm360(cusps[1] + 180);
      cusps[8] = norm360(cusps[2] + 180); cusps[9] = norm360(cusps[3] + 180);
      return { cusps: cusps, asc: asc, mc: mc, fallback: null };
    }
    var h = housesForSystem(info, system);
    return { cusps: h.cusps, asc: asc, mc: mc, fallback: h.fallback };
  }

  function houseOf(lon, cusps) {
    for (var h = 1; h <= 12; h++) {
      var a = cusps[h], b = cusps[h % 12 + 1];
      var span = norm360(b - a), off = norm360(lon - a);
      if (off < span) return h;
    }
    return 1;
  }

  // ---------- 元素 / 模式统计 ----------
  var MODE_MAP = ['cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable', 'cardinal', 'fixed', 'mutable'];
  function statElements(planets) {
    var elements = { fire: 0, earth: 0, air: 0, water: 0 };
    var modalities = { cardinal: 0, fixed: 0, mutable: 0 };
    planets.forEach(function (p) {
      elements[SIGNS[p.sign.index].element]++;
      modalities[MODE_MAP[p.sign.index]]++;
    });
    return { elements: elements, modalities: modalities };
  }

  // ---------- 相位 ----------
  var ASPECT_DEFS = [
    { key: 'conj', name: '合相', angle: 0, orb: 8, glyph: '\u260C' },
    { key: 'sextile', name: '六分相', angle: 60, orb: 5, glyph: '\u2731' },
    { key: 'square', name: '四分相', angle: 90, orb: 7, glyph: '\u25A1' },
    { key: 'trine', name: '三分相', angle: 120, orb: 7, glyph: '\u25B3' },
    { key: 'opp', name: '对分相', angle: 180, orb: 8, glyph: '\u260D' }
  ];

  function computeAspects(points) {
    var out = [];
    for (var i = 0; i < points.length; i++) {
      for (var j = i + 1; j < points.length; j++) {
        var a = points[i], b = points[j];
        var d = Math.abs(norm360(a.lon - b.lon)); if (d > 180) d = 360 - d;
        for (var k = 0; k < ASPECT_DEFS.length; k++) {
          var asp = ASPECT_DEFS[k];
          var orb = asp.orb + ((a.key === 'sun' || a.key === 'moon' || b.key === 'sun' || b.key === 'moon') ? 1 : 0);
          var diff = Math.abs(d - asp.angle);
          if (diff <= orb) {
            out.push({ a: a.key, b: b.key, aName: a.name, bName: b.name, type: asp.key, name: asp.name, glyph: asp.glyph, angle: asp.angle, orb: Math.round(diff * 10) / 10 });
            break;
          }
        }
      }
    }
    out.sort(function (x, y) { return x.orb - y.orb; });
    return out;
  }

  // ---------- 由 UTC 时刻直接排盘（本命 / 换置 / 推运共用） ----------
  function computeChartFromUTC(utc, bp, houseSystem, timeUnknown, livePlace) {
    var time = A.MakeTime(utc);
    var planets = BODIES.map(function (b) { return bodyPosition(b.key, time); });
    // 北交点 (真实交点，与主流排盘软件/Swiss Ephemeris TRUE_NODE 一致)；速度用 ±0.25 天差分
    var nodeLon = trueNodeLon(time);
    var nodeLon2 = trueNodeLon(A.MakeTime(time.ut + 0.25));
    var nodeDiff = nodeLon2 - nodeLon;
    if (nodeDiff > 180) nodeDiff -= 360;
    if (nodeDiff < -180) nodeDiff += 360;
    var node = {
      key: 'node', name: '北交点', glyph: '\u260A', color: '#9db4c0',
      lon: nodeLon, lat: 0, speed: nodeDiff / 0.25, retro: nodeDiff < 0, sign: signOf(nodeLon)
    };
    var allPoints = planets.concat([node]);

    var hs = houseSystem || 'placidus';
    var hh = computeHouses(null, null, time, bp.lat, bp.lon, hs);

    var ascPoint = { key: 'asc', name: '上升点', glyph: 'ASC', color: '#e8c66a', lon: hh.asc, sign: signOf(hh.asc) };
    var mcPoint = { key: 'mc', name: '中天点', glyph: 'MC', color: '#e8c66a', lon: hh.mc, sign: signOf(hh.mc) };

    var aspectsPoints = allPoints.concat([ascPoint, mcPoint]);
    var aspects = computeAspects(aspectsPoints);

    allPoints.forEach(function (p) { p.house = houseOf(p.lon, hh.cusps); });

    var stat = statElements(planets);

    var relocated = null;
    if (livePlace && (livePlace.lat !== bp.lat || livePlace.lon !== bp.lon)) {
      var hh2 = computeHouses(null, null, time, livePlace.lat, livePlace.lon, hs);
      relocated = { asc: hh2.asc, mc: hh2.mc, ascSign: signOf(hh2.asc) };
    }

    return {
      utc: utc, utcISO: utc.toISOString(),
      localTimeStr: utcToLocalString(utc, bp.tz),
      utOffset: tzOffsetMinutes(utc, bp.tz),
      place: bp, livePlace: livePlace || null,
      timeUnknown: !!timeUnknown,
      planets: planets, node: node, allPoints: allPoints,
      asc: ascPoint, mc: mcPoint,
      houses: hh.cusps, houseFallback: hh.fallback,
      houseSystem: hs,
      aspects: aspects,
      elements: stat.elements, modalities: stat.modalities,
      relocated: relocated
    };
  }

  // ---------- 主入口 ----------
  function computeChart(opts) {
    // opts: { year, month, day, hour, minute, timeUnknown, birthPlace:{lat,lon,tz,name}, livePlace, houseSystem }
    var utc = localToUTC(opts.year, opts.month, opts.day, opts.hour, opts.minute, opts.birthPlace.tz);
    return computeChartFromUTC(utc, opts.birthPlace, opts.houseSystem || 'placidus', !!opts.timeUnknown, opts.livePlace);
  }

  // 当前行运 (用于 AI 问答上下文 / 运势页)。可传入 Date 计算任意日期
  function currentTransits(date) {
    var now = date ? new Date(date.getTime()) : new Date();
    var time = A.MakeTime(now);
    var planets = BODIES.map(function (b) { return bodyPosition(b.key, time); });
    return {
      time: now.toISOString(),
      list: planets.map(function (p) { return { key: p.key, name: p.name, lon: p.lon, sign: p.sign.name, deg: p.sign.deg, retro: p.retro }; })
    };
  }

  // ============================================================
  // 推运（个人运势页）：太阳弧 / 日返 / 次限 / 三限 / 行运
  // ============================================================
  var DAY_MS = 86400000;
  var TROPICAL_YEAR = 365.2422;
  var SYNODIC_MONTH = 29.5306;

  function utcDate(v) { return v instanceof Date ? new Date(v.getTime()) : new Date(v); }

  // 从起始时刻开始（必要时向前倒一年），二分定位太阳黄经 == targetLon 的回归时刻
  function searchSunLon(targetLon, startDate) {
    function f(ms) { return norm360(eclipticOfDate(A.Body.Sun, A.MakeTime(new Date(ms))).lon - targetLon); }
    var lo = startDate.getTime();
    if (f(lo) < 180) lo -= TROPICAL_YEAR * DAY_MS;
    var hi = lo + TROPICAL_YEAR * DAY_MS + 2 * DAY_MS;
    for (var i = 0; i < 90; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) < 180) hi = mid; else lo = mid;
    }
    return new Date(hi);
  }

  // 太阳弧：所有行星与四轴统一推进 arc = (目标日太阳黄经 − 本命太阳黄经)
  function solarArcChart(natal, targetDate, opts) {
    var target = utcDate(targetDate);
    // 太阳弧推进弧长 = 次限太阳黄经 - 本命太阳黄经（次限 1 天 = 1 年）
    // 此前误用"目标日行运太阳 - 本命太阳"，同日黄经差约 0°，导致太阳弧盘几乎不推进
    var base = utcDate(natal.utc);
    var days = (target.getTime() - base.getTime()) / DAY_MS;
    var progSunDate = new Date(base.getTime() + (days / TROPICAL_YEAR) * DAY_MS);
    var arc = norm360(eclipticOfDate(A.Body.Sun, A.MakeTime(progSunDate)).lon - natal.planets[0].lon);
    var hs = natal.houseSystem || 'placidus';
    var cusps = natal.houses.map(function (c) { return norm360(c + arc); });
    var ascLon = norm360(natal.asc.lon + arc);
    var mcLon = norm360(natal.mc.lon + arc);
    var planets = natal.planets.map(function (p) {
      var lon = norm360(p.lon + arc);
      return { key: p.key, name: p.name, glyph: p.glyph, color: p.color, lon: lon, lat: p.lat, speed: p.speed, retro: false, sign: signOf(lon), house: houseOf(lon, cusps) };
    });
    var nodeLon = norm360(natal.node.lon + arc);
    var node = { key: 'node', name: '北交点', glyph: '\u260A', color: '#9db4c0', lon: nodeLon, lat: 0, speed: 0, retro: false, sign: signOf(nodeLon), house: houseOf(nodeLon, cusps) };
    var ascPoint = { key: 'asc', name: '上升点', glyph: 'ASC', color: '#e8c66a', lon: ascLon, sign: signOf(ascLon), house: 1 };
    var mcPoint = { key: 'mc', name: '中天点', glyph: 'MC', color: '#e8c66a', lon: mcLon, sign: signOf(mcLon), house: 10 };
    var allPoints = planets.concat([node]);
    var aspects = computeAspects(allPoints.concat([ascPoint, mcPoint]));
    var stat = statElements(planets);
    return {
      type: 'solar-arc', utc: target, utcISO: target.toISOString(),
      localTimeStr: utcToLocalString(target, natal.place.tz),
      utOffset: tzOffsetMinutes(target, natal.place.tz),
      place: natal.place, livePlace: null, timeUnknown: false,
      planets: planets, node: node, allPoints: allPoints,
      asc: ascPoint, mc: mcPoint,
      houses: cusps, houseFallback: natal.houseFallback, houseSystem: hs,
      aspects: aspects, elements: stat.elements, modalities: stat.modalities,
      relocated: null,
      solarArcDeg: Math.round(arc * 100) / 100, baseChart: natal
    };
  }

  // 日返：取目标日期之前最近一次太阳回归本命太阳黄经的时刻，在指定地点排盘
  // （主流软件口径：查看某日时显示"该日之前的最近一次日返"，而非所选年份的当年日返）
  function searchSunLonBefore(targetLon, targetDate) {
    // 在 [target-367d, target] 内太阳黄经单调完成一周，f 从 ~358° 增至 f(target)，
    // 唯一一次 f 跨 180 下降沿即最近一次回归；粗扫定位后二分精化
    // （此前 f(hi)>=180 分支把窗口误推到上上一年，导致目标在当年回归前时返回两年前的日返盘）
    function f(ms) { return norm360(eclipticOfDate(A.Body.Sun, A.MakeTime(new Date(ms))).lon - targetLon); }
    var end = targetDate.getTime();
    var start = end - TROPICAL_YEAR * DAY_MS - 2 * DAY_MS;
    var step = DAY_MS / 4;
    var prev = null, prevMs = 0;
    for (var ms = start; ms <= end; ms += step) {
      var fv = f(ms);
      if (prev !== null && prev > 180 && fv < 180) {
        var lo = prevMs, hi = ms;
        for (var i = 0; i < 90; i++) {
          var mid = (lo + hi) / 2;
          if (f(mid) < 180) hi = mid; else lo = mid;
        }
        return new Date(hi);
      }
      prev = fv; prevMs = ms;
    }
    return new Date(end);
  }
  function solarReturnChart(natal, targetDate, opts) {
    var targetLon = natal.planets[0].lon;
    var retTime = searchSunLonBefore(targetLon, utcDate(targetDate));
    var place = (opts && opts.place) || natal.place;
    var chart = computeChartFromUTC(retTime, place, natal.houseSystem || 'placidus', false, null);
    chart.type = 'solar-return';
    // 回归年份按回归地本地年份计（避免 UTC 跨年导致周年号偏差）
    chart.solarReturnYear = new Date(retTime.getTime() + tzOffsetMinutes(retTime, place.tz) * 60000).getUTCFullYear();
    chart.solarReturnTime = retTime;
    chart.baseChart = natal;
    return chart;
  }

  // 通用推进：以 factor 天 = 1 年换算推进时刻（次限 365.2422，三限 29.5306）
  function progressedByFactor(natal, targetDate, factor) {
    var base = utcDate(natal.utc);
    var target = utcDate(targetDate);
    var days = (target.getTime() - base.getTime()) / DAY_MS;
    var prog = new Date(base.getTime() + (days / factor) * DAY_MS);
    return computeChartFromUTC(prog, natal.place, natal.houseSystem || 'placidus', !!natal.timeUnknown, null);
  }
  function secondaryProgressedChart(natal, targetDate, opts) {
    var chart = progressedByFactor(natal, targetDate, TROPICAL_YEAR);
    chart.type = 'secondary';
    chart.baseChart = natal;
    return chart;
  }
  function tertiaryProgressedChart(natal, targetDate, opts) {
    var chart = progressedByFactor(natal, targetDate, SYNODIC_MONTH);
    chart.type = 'tertiary';
    chart.baseChart = natal;
    return chart;
  }

  // 行运：目标时刻天象盘（可指定现居地）
  function transitChart(natal, targetDate, opts) {
    var t = utcDate(targetDate);
    var place = (opts && opts.place) || natal.place;
    var chart = computeChartFromUTC(t, place, natal.houseSystem || 'placidus', false, null);
    chart.type = 'transit';
    chart.baseChart = natal;
    return chart;
  }

  // 月返：找目标日期之前最近一次月亮黄经 == 本命月亮黄经 的回归时刻，在该时刻排盘
  function moonLonAt(ms) {
    return norm360(eclipticOfDate(A.Body.Moon, A.MakeTime(new Date(ms))).lon);
  }
  function searchMoonReturn(targetLon, targetDate) {
    var end = targetDate.getTime();
    var start = end - SYNODIC_MONTH * DAY_MS - DAY_MS;
    var step = DAY_MS / 5;
    var prev = null, prevMs = 0;
    for (var ms = start; ms <= end; ms += step) {
      var f = norm360(moonLonAt(ms) - targetLon);
      if (prev !== null && prev > 180 && f < 180) {
        var lo = prevMs, hi = ms;
        for (var i = 0; i < 60; i++) {
          var mid = (lo + hi) / 2;
          if (norm360(moonLonAt(mid) - targetLon) < 180) hi = mid; else lo = mid;
        }
        return new Date(hi);
      }
      prev = f; prevMs = ms;
    }
    return utcDate(targetDate);
  }
  function lunarReturnChart(natal, targetDate, opts) {
    var targetLon = natal.planets[1].lon;
    var target = utcDate(targetDate);
    var retTime = searchMoonReturn(targetLon, target);
    var place = (opts && opts.place) || natal.place;
    var chart = computeChartFromUTC(retTime, place, natal.houseSystem || 'placidus', false, null);
    chart.type = 'lunar-return';
    chart.lunarReturnTime = retTime;
    chart.lunarReturnLon = targetLon;
    chart.baseChart = natal;
    return chart;
  }

  // 小限（Profection）：每年上升推进一宫（30°），行星保持本命黄经，宫位整体旋转
  function profectionChart(natal, targetDate, opts) {
    var base = utcDate(natal.utc);
    var target = utcDate(targetDate);
    var age = (target.getTime() - base.getTime()) / (TROPICAL_YEAR * DAY_MS);
    var years = Math.max(0, Math.floor(age));
    var arc = years * 30;
    var ascLon = norm360(natal.asc.lon + arc);
    var mcLon = norm360(natal.mc.lon + arc);
    // 小限采用整宫制（主流口径）：宫位自推进上升所在星座 0° 起每宫 30°，行星按整宫定位
    var hs = 'whole';
    var cusps = {};
    var wholeBase = Math.floor(ascLon / 30) * 30;
    for (var h = 1; h <= 12; h++) cusps[h] = norm360(wholeBase + (h - 1) * 30);
    var planets = natal.planets.map(function (p) {
      return { key: p.key, name: p.name, glyph: p.glyph, color: p.color, lon: p.lon, lat: p.lat, speed: p.speed, retro: p.retro, sign: p.sign, house: houseOf(p.lon, cusps) };
    });
    var nodeLon = natal.node.lon;
    var node = { key: 'node', name: '北交点', glyph: '\u260A', color: '#9db4c0', lon: nodeLon, lat: 0, speed: 0, retro: natal.node.retro, sign: natal.node.sign, house: houseOf(nodeLon, cusps) };
    var ascPoint = { key: 'asc', name: '上升点', glyph: 'ASC', color: '#e8c66a', lon: ascLon, sign: signOf(ascLon), house: 1 };
    var mcPoint = { key: 'mc', name: '中天点', glyph: 'MC', color: '#e8c66a', lon: mcLon, sign: signOf(mcLon), house: 10 };
    var allPoints = planets.concat([node]);
    var aspects = computeAspects(allPoints.concat([ascPoint, mcPoint]));
    var stat = statElements(planets);
    return {
      type: 'profection', utc: target, utcISO: target.toISOString(),
      localTimeStr: utcToLocalString(target, natal.place.tz),
      utOffset: tzOffsetMinutes(target, natal.place.tz),
      place: natal.place, livePlace: null, timeUnknown: false,
      planets: planets, node: node, allPoints: allPoints,
      asc: ascPoint, mc: mcPoint,
      houses: cusps, houseFallback: null, houseSystem: hs,
      aspects: aspects, elements: stat.elements, modalities: stat.modalities,
      relocated: null,
      profectionAge: years, profectionArc: arc, baseChart: natal
    };
  }

  // 法达（Firdaria）：波斯年运，按年龄分配行星大运，返回运程上下文结构（非行星盘）
  var FIRDARIA_ORDER_DAY = ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars', 'nnode', 'snode'];
  var FIRDARIA_ORDER_NIGHT = ['moon', 'saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'nnode', 'snode'];
  var FIRDARIA_YEARS = { sun: 10, moon: 9, mercury: 13, venus: 8, mars: 7, jupiter: 12, saturn: 11, nnode: 3, snode: 2 };
  var FIRDARIA_NAMES = { sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星', nnode: '北交点', snode: '南交点' };

  function firdaria(natal, targetDate, opts) {
    var base = utcDate(natal.utc);
    var target = utcDate(targetDate);
    var age = (target.getTime() - base.getTime()) / (TROPICAL_YEAR * DAY_MS);
    // 日生/夜生：太阳位于盘面上半部（从 ASC 顺行到 DESC 的弧段，即地平线上）为日生
    var sunLon = eclipticOfDate(A.Body.Sun, A.MakeTime(base)).lon;
    var dayChart = norm360(sunLon - natal.asc.lon) < 180;
    var order = dayChart ? FIRDARIA_ORDER_DAY : FIRDARIA_ORDER_NIGHT;
    var periods = [];
    var startAge = 0;
    for (var i = 0; i < order.length; i++) {
      var key = order[i];
      var yrs = FIRDARIA_YEARS[key];
      periods.push({ key: key, name: FIRDARIA_NAMES[key], years: yrs, startAge: Math.round(startAge * 100) / 100, endAge: Math.round((startAge + yrs) * 100) / 100 });
      startAge += yrs;
    }
    var current = null;
    for (var i = 0; i < periods.length; i++) {
      if (age >= periods[i].startAge && age < periods[i].endAge) { current = periods[i]; break; }
    }
    if (!current) current = periods[periods.length - 1];
    var sub = null, subList = [];
    if (current) {
      var ageIn = Math.max(0, age - current.startAge);
      subList = order.map(function (k) {
        return { key: k, name: FIRDARIA_NAMES[k], years: (current.years * FIRDARIA_YEARS[k]) / 75 };
      });
      var acc = 0;
      for (var j = 0; j < subList.length; j++) {
        if (ageIn < acc + subList[j].years) { sub = subList[j]; sub.offset = Math.round((ageIn - acc) * 100) / 100; break; }
        acc += subList[j].years;
      }
      if (!sub) sub = subList[subList.length - 1];
    }
    return {
      type: 'firdaria', utc: target, utcISO: target.toISOString(),
      localTimeStr: utcToLocalString(target, natal.place.tz),
      utOffset: tzOffsetMinutes(target, natal.place.tz),
      place: natal.place, livePlace: null, timeUnknown: false,
      age: Math.round(age * 100) / 100, dayChart: dayChart,
      order: order, periods: periods, current: current, sub: sub, subList: subList,
      // 无独立行星盘：字段对齐推运盘结构，供渲染复用本命盘（前端对 firdaria 特判不画外圈）
      planets: natal.planets, node: natal.node, allPoints: natal.allPoints,
      asc: natal.asc, mc: natal.mc, houses: natal.houses,
      houseFallback: natal.houseFallback, houseSystem: natal.houseSystem,
      aspects: natal.aspects, elements: natal.elements, modalities: natal.modalities,
      relocated: null, baseChart: natal
    };
  }

  // A 盘对 B 盘跨盘相位（行星 + 四轴，供推运解读 / 上下文）
  function crossAspects(aChart, bChart) {
    var pa = aChart.planets.concat([aChart.asc, aChart.mc]);
    var pb = bChart.planets.concat([bChart.asc, bChart.mc]);
    var out = [];
    for (var i = 0; i < pa.length; i++) {
      for (var j = 0; j < pb.length; j++) {
        var a = pa[i], b = pb[j];
        var d = Math.abs(norm360(a.lon - b.lon)); if (d > 180) d = 360 - d;
        for (var k = 0; k < ASPECT_DEFS.length; k++) {
          var asp = ASPECT_DEFS[k];
          var orb = asp.orb + ((a.key === 'sun' || a.key === 'moon' || b.key === 'sun' || b.key === 'moon') ? 1 : 0);
          var diff = Math.abs(d - asp.angle);
          if (diff <= orb) {
            out.push({ a: a.key, b: b.key, aName: a.name, bName: b.name, aLon: a.lon, bLon: b.lon, type: asp.key, name: asp.name, glyph: asp.glyph, angle: asp.angle, orb: Math.round(diff * 10) / 10 });
            break;
          }
        }
      }
    }
    out.sort(function (x, y) { return x.orb - y.orb; });
    return out;
  }

  var api = {
    SIGNS: SIGNS, BODIES: BODIES, ASPECT_DEFS: ASPECT_DEFS,
    computeChart: computeChart, computeChartFromUTC: computeChartFromUTC,
    currentTransits: currentTransits,
    localToUTC: localToUTC, signOf: signOf, norm360: norm360,
    meanNodeLon: meanNodeLon, trueNodeLon: trueNodeLon, obliquity: obliquity,
    computeHouses: computeHouses, housesFromAscMc: housesFromAscMc, HOUSE_SYSTEMS: HOUSE_SYSTEMS,
    solarArcChart: solarArcChart, solarReturnChart: solarReturnChart,
    secondaryProgressedChart: secondaryProgressedChart, tertiaryProgressedChart: tertiaryProgressedChart,
    transitChart: transitChart, lunarReturnChart: lunarReturnChart,
    profectionChart: profectionChart, firdaria: firdaria,
    crossAspects: crossAspects
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AstroCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
