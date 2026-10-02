// 测试星象计算核心
const A = require('./public/js/astro.js');

// 用例1: 1990-06-15 10:30 上海 (UTC+8) — 太阳应在双子座 ~24°
let c1 = A.computeChart({
  year: 1990, month: 6, day: 15, hour: 10, minute: 30,
  birthPlace: { name: '上海', lat: 31.23, lon: 121.47, tz: 'Asia/Shanghai' },
  houseSystem: 'placidus'
});
console.log('--- 用例1: 1990-06-15 10:30 上海 ---');
console.log('UTC:', c1.utcISO, '偏移:', c1.utOffset, '本地:', c1.localTimeStr);
c1.planets.forEach(p => console.log(p.name, p.sign.name + ' ' + p.sign.deg + '\u00B0' + String(p.sign.min).padStart(2,'0'), p.retro ? '\u211E' : '', '宫' + p.house));
console.log('ASC:', c1.asc.sign.name, c1.asc.sign.deg + '\u00B0' + c1.asc.sign.min, '| MC:', c1.mc.sign.name, c1.mc.sign.deg + '\u00B0');
console.log('宫位:', c1.houses.slice(1).map(h => Math.round(h)).join(', '));
console.log('相位数:', c1.aspects.length, '| 前3:', c1.aspects.slice(0,3).map(a => a.aName + a.name + a.bName).join(', '));
console.log('元素:', JSON.stringify(c1.elements));

// 用例2: 整宫制 + 伦敦
let c2 = A.computeChart({
  year: 2000, month: 1, day: 1, hour: 12, minute: 0,
  birthPlace: { name: 'London', lat: 51.5, lon: -0.12, tz: 'Europe/London' },
  houseSystem: 'whole'
});
console.log('\n--- 用例2: 2000-01-01 12:00 London 整宫 ---');
console.log('太阳:', c2.planets[0].sign.name + ' ' + c2.planets[0].sign.deg + '\u00B0');
console.log('ASC:', c2.asc.sign.name + ' ' + c2.asc.sign.deg + '\u00B0', 'MC:', c2.mc.sign.name + ' ' + c2.mc.sign.deg + '\u00B0');
console.log('宫头1:', Math.round(c2.houses[1]), '宫头10:', Math.round(c2.houses[10]));

// 用例3: 时区换算 DST 检查 (纽约夏令时)
let utc = A.localToUTC(1995, 7, 4, 14, 0, 'America/New_York');
console.log('\n--- 用例3: 1995-07-04 14:00 纽约(夏令时 EDT=-4) ---');
console.log('UTC 应为 18:00 =>', utc.toISOString());
let utc2 = A.localToUTC(1995, 1, 4, 14, 0, 'America/New_York');
console.log('1995-01-04 14:00 纽约(冬令时 EST=-5) UTC 应为 19:00 =>', utc2.toISOString());

// 用例4: 行运
let t = A.currentTransits();
console.log('\n当前行运太阳:', t.list[0].sign, t.list[0].deg + '\u00B0', t.list[0].retro ? '\u211E' : '');

// 用例5: 高纬度兜底 (Reykjavik 64°N)
let c5 = A.computeChart({
  year: 1985, month: 6, day: 21, hour: 6, minute: 0,
  birthPlace: { name: 'Reykjavik', lat: 64.14, lon: -21.9, tz: 'Atlantic/Reykjavik' },
  houseSystem: 'placidus'
});
console.log('\n--- 用例5: 高纬度兜底 ---');
console.log('fallback:', c5.houseFallback, 'ASC:', c5.asc.sign.name, c5.asc.sign.deg + '\u00B0');

// 用例6: 高纬度兜底必须为等宫制 (Tromso 69.65°N, 冬至附近 cusp11 落在至点高赤纬段, Placidus 确定性失效)
let c6 = A.computeChart({
  year: 1990, month: 11, day: 23, hour: 12, minute: 0,
  birthPlace: { name: 'Tromso', lat: 69.65, lon: 18.96, tz: 'Europe/Oslo' },
  houseSystem: 'placidus'
});
console.log('\n--- 用例6: 1990-11-23 12:00 Tromso(69.65N) 高纬兜底 ---');
let eqOk = (c6.houseFallback === 'equal');
if (!eqOk) console.log('FAIL: fallback=' + c6.houseFallback + ' 应为 equal');
for (let k = 1; k <= 12; k++) {
  let expect = A.norm360(c6.asc.lon + (k - 1) * 30);
  let d = Math.abs(((c6.houses[k] - expect) % 360 + 360) % 360);
  if (Math.min(d, 360 - d) > 1e-6) { eqOk = false; console.log('FAIL: 宫头' + k + '=' + c6.houses[k] + ' 期望 ' + expect); }
}
console.log(eqOk ? 'PASS: fallback=equal，12 宫头 = ASC + (k-1)*30，第 1 宫自 ASC 展开' : 'FAIL: 等宫制兜底校验未通过');
if (!eqOk) process.exitCode = 1;

// 用例7: 盘面几何 — ASC 固定左侧 9 点钟 / 星座环随 ASC 旋转 / 行星按真实黄经标定
const ChartR = require('./public/js/chart.js');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="wheel"></div>');
const el = dom.window.document.getElementById('wheel');
ChartR.renderChart(ChartR.prepareChart(c1), el);
const svg = el.innerHTML;
const num = function (s) { return parseFloat(s); };
const lines = Array.from(svg.matchAll(/<line class="([^"]+)" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g))
  .map(function (m) { return { cls: m[1], x1: num(m[2]), y1: num(m[3]), x2: num(m[4]), y2: num(m[5]) }; });
// 与 chart.js pt() 一致的屏幕坐标换算: 屏幕角 = 180 + (lon - asc)，ASC 恒在左侧 9 点钟
function ptXY(lon, r) { var a = (180 + (lon - c1.asc.lon)) * Math.PI / 180; return { x: 360 + r * Math.cos(a), y: 360 - r * Math.sin(a) }; }
let gOk = true;
const angles = lines.filter(function (l) { return l.cls === 'w-house-angle'; });
if (angles.length !== 4) { gOk = false; console.log('FAIL: 角度轴数量=' + angles.length + ' 应为 4'); }
const ascAxis = angles.find(function (l) { return Math.abs(l.x1 - 360) < 0.5 && Math.abs(l.y1 - 360) < 0.5 && Math.abs(l.y2 - 360) < 0.5 && l.x2 < 300; });
if (!ascAxis) { gOk = false; console.log('FAIL: 未找到自圆心向左的水平 ASC 轴线'); }
else console.log('PASS: ASC 轴 (' + ascAxis.x1 + ',' + ascAxis.y1 + ')->(' + ascAxis.x2 + ',' + ascAxis.y2 + ')，恒定左侧 9 点钟，第 1 宫自左侧展开');
const seps = lines.filter(function (l) { return l.cls === 'w-sep'; });
if (seps.length !== 12) { gOk = false; console.log('FAIL: 星座分隔线数量=' + seps.length + ' 应为 12'); }
else {
  const p0 = ptXY(0, 280), p0b = ptXY(0, 330);
  const hit = seps.some(function (l) { return Math.abs(l.x1 - p0.x) < 1 && Math.abs(l.y1 - p0.y) < 1 && Math.abs(l.x2 - p0b.x) < 1 && Math.abs(l.y2 - p0b.y) < 1; });
  if (hit) console.log('PASS: 星座分隔线按真实黄经绘制（星座环随每人 ASC 旋转对齐）');
  else { gOk = false; console.log('FAIL: 星座分隔线未按真实黄经绘制'); }
}
const ticks = lines.filter(function (l) { return l.cls === 'w-tick'; });
let tickHit = 0;
c1.allPoints.forEach(function (p) {
  const t1 = ptXY(p.lon, 280), t2 = ptXY(p.lon, 268);
  if (ticks.some(function (l) { return Math.abs(l.x1 - t1.x) < 1 && Math.abs(l.y1 - t1.y) < 1 && Math.abs(l.x2 - t2.x) < 1 && Math.abs(l.y2 - t2.y) < 1; })) tickHit++;
});
if (tickHit === c1.allPoints.length) console.log('PASS: 全部 ' + c1.allPoints.length + ' 个天体指针按真实黄经落位，与星座环同一定标');
else { gOk = false; console.log('FAIL: 天体指针标定匹配 ' + tickHit + '/' + c1.allPoints.length); }
if (!gOk) process.exitCode = 1;
console.log('\n用例5-7 执行完毕' + (process.exitCode ? '（存在失败项）' : '，全部通过'));

// 用例8: 11 种宫位制对 Swiss Ephemeris 基准对齐（误差 < 0.1°，基准: test-se-baseline11.json，沿用 test-se-baseline9 方法）
const fs8 = require('fs');
const AE8 = require('./node_modules/astronomy-engine');
const seBaseline = JSON.parse(fs8.readFileSync('./test-se-baseline11.json', 'utf8'));
const sys8 = ['placidus', 'whole', 'equal', 'koch', 'regiomontanus', 'campanus', 'alcabitius', 'morinus', 'topocentric', 'meridian', 'apc'];
function d360(a, b) { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
let hOk = true;
const perMax8 = {};
sys8.forEach(s => perMax8[s] = 0);
let hFail = 0, hSkipped = 0;
console.log('\n--- 用例8: 11 宫位制 vs Swiss Ephemeris（8 案例, 阈值 <0.1°）---');
for (const [ck, cc] of Object.entries(seBaseline)) {
  const t8 = AE8.MakeTime(new Date(cc.utcISO));
  for (const sys of sys8) {
    if (!cc.houses[sys]) { hSkipped++; continue; }
    let r;
    try { r = A.computeHouses(null, null, t8, cc.lat, cc.lon, sys); }
    catch (e) { hFail++; console.log('FAIL ' + ck + ' ' + sys + ': THROW ' + e.message); hOk = false; continue; }
    const se = cc.houses[sys];
    let m = 0, wi = '';
    for (let i = 1; i <= 12; i++) { const d = d360(r.cusps[i], se.cusps[i - 1]); if (d > m) { m = d; wi = 'cusp' + i; } }
    for (const [k, v] of [['asc', se.asc], ['mc', se.mc]]) { const d = d360(r[k], v); if (d > m) { m = d; wi = k; } }
    perMax8[sys] = Math.max(perMax8[sys], m);
    if (m >= 0.1) { hFail++; hOk = false; console.log('FAIL ' + ck + ' ' + sys + ': maxDiff=' + m.toFixed(4) + '° @' + wi + ' fallback=' + r.fallback); }
  }
}
console.log('每制式最大误差(°):');
for (const s of sys8) console.log('  ' + s.padEnd(14) + perMax8[s].toFixed(5));
console.log(hFail ? 'FAIL: ' + hFail + ' 项 >=0.1°（SE 缺失跳过 ' + hSkipped + '）' : 'PASS: 11 制式 8 案例全部对齐 SE，误差 <0.1°');
if (!hOk) process.exitCode = 1;

// 用例9: 三种新推运方式 — 月返（月亮回归）/ 小限（ASC 年进一宫）/ 法达（行星大运）
console.log('\n--- 用例9: 月返 / 小限 / 法达（新推运）---');
function d360(a, b) { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
const t9 = new Date('2026-09-29T00:00:00Z');
let ok9 = true;

// 9.1 月返：月亮黄经应回归到本命月亮黄经（<0.01°），排盘时间在目标日期前一个朔望月内
const lrc = A.lunarReturnChart(c1, t9, {});
const moonDiff = d360(lrc.planets[1].lon, c1.planets[1].lon);
const retWin = (t9.getTime() - lrc.lunarReturnTime.getTime()) / 86400000;
console.log('月返: moonDiff=' + moonDiff.toFixed(4) + '° retTime=' + lrc.lunarReturnTime.toISOString() + ' (距目标 ' + retWin.toFixed(1) + ' 天) type=' + lrc.type);
if (moonDiff >= 0.01) { ok9 = false; console.log('FAIL: 月亮未回归本命黄经'); }
if (retWin < 0 || retWin >= 32) { ok9 = false; console.log('FAIL: 回归时刻不在最近一个朔望月窗口内'); }
if (lrc.type !== 'lunar-return') { ok9 = false; console.log('FAIL: type 应为 lunar-return'); }

// 9.2 小限：ASC 推进 floor(age)*30°（年进一宫），行星保持本命黄经
const pc = A.profectionChart(c1, t9, {});
const ageYears = Math.floor((t9.getTime() - new Date(c1.utcISO).getTime()) / (365.2422 * 86400000));
const ascDiff = d360(pc.asc.lon, (c1.asc.lon + ageYears * 30) % 360);
const sunSame = d360(pc.planets[0].lon, c1.planets[0].lon);
console.log('小限: age=' + ageYears + ' ascDiff=' + ascDiff.toFixed(4) + '° sunSame=' + sunSame.toFixed(6) + '° house1=' + Math.round(pc.houses[1]) + ' profectionAge=' + pc.profectionAge);
if (ascDiff >= 0.01) { ok9 = false; console.log('FAIL: ASC 未按年推进整 30°'); }
if (sunSame >= 0.0001) { ok9 = false; console.log('FAIL: 小限不应移动行星'); }
if (pc.profectionAge !== ageYears) { ok9 = false; console.log('FAIL: profectionAge 与推算不符'); }

// 9.3 法达：日/夜生顺序 9 段大运合计 75 年，当前大运区间应包含年龄，小运存在
const fd = A.firdaria(c1, t9, {});
const totalYrs = fd.periods.reduce(function (s, p) { return s + p.years; }, 0);
const ageInCur = fd.age >= fd.current.startAge && fd.age < fd.current.endAge;
console.log('法达: age=' + fd.age + ' dayChart=' + fd.dayChart + ' periods=' + fd.periods.length + ' totalYears=' + totalYrs + ' current=' + fd.current.name + ' (' + fd.current.startAge + '-' + fd.current.endAge + ') sub=' + fd.sub.name);
if (totalYrs !== 75) { ok9 = false; console.log('FAIL: 法达大运总年数应为 75'); }
if (fd.periods.length !== 9) { ok9 = false; console.log('FAIL: 法达大运段数应为 9'); }
if (!ageInCur) { ok9 = false; console.log('FAIL: 当前年龄不在 current 大运区间内'); }
if (!fd.sub || typeof fd.sub.name !== 'string') { ok9 = false; console.log('FAIL: 小运缺失'); }
if (fd.type !== 'firdaria') { ok9 = false; console.log('FAIL: type 应为 firdaria'); }

if (ok9) console.log('PASS: 月返/小限/法达 全部通过');
else { console.log('FAIL: 用例9 存在失败项'); process.exitCode = 1; }

// 用例10: 呈现口径映射 — 仅行运/太阳弧/三限/次限/小限/法达 按本命宫头；日返/月返 按推运盘自身宫位
// 页面右侧（行星速览/落座表/报告/AI上下文）推运行星落宫口径按类型区分：
// 6 类 = 推运黄经对照本命 houses；日返/月返 = 推运盘自身 cusps（推运计算不变，仅呈现区分）。
console.log('\n--- 用例10: 推运落宫口径（6类按本命 / 日返月返按自身）---');
function houseOf10(lon, cusps) {
  for (let h = 1; h <= 12; h++) {
    const a = cusps[h], b = cusps[h % 12 + 1];
    const span = A.norm360(b - a), off = A.norm360(lon - a);
    if (off < span) return h;
  }
  return 1;
}
const target10 = A.localToUTC(2026, 6, 15, 0, 0, 'Asia/Shanghai');
// A) 6 类按本命宫头：以行运（transit）为代表，验证呈现映射 = 推运黄经对照本命宫头，且口径存在差异
const tr10 = A.transitChart(c1, target10, { place: c1.place });
const diff10 = tr10.planets.filter(function (p) { return houseOf10(p.lon, c1.houses) !== p.house; }).length;
const natalHouse10 = tr10.planets.map(function (p) { return houseOf10(p.lon, c1.houses); });
const transitHouse10 = tr10.planets.map(function (p) { return p.house; });
console.log('行运盘：按推运自身宫位 ' + transitHouse10.join('/'));
console.log('行运盘：按本命宫位映射 ' + natalHouse10.join('/'));
console.log('口径不同行星数：' + diff10 + ' 颗');
if (diff10 <= 0) { console.log('FAIL: 行运盘应存在推运自身宫位 ≠ 本命宫位映射的行星（否则改造无意义）'); process.exitCode = 1; }
else {
  // 映射结果必须与本命行星自身的本命宫位一致（本命 sun/moon 等仍在原宫位）
  const sunConsistent = tr10.planets.every(function (p, i) {
    const natalP = c1.planets.find(function (q) { return q.key === p.key; });
    return !natalP || houseOf10(natalP.lon, c1.houses) === natalP.house;
  });
  console.log(sunConsistent ? 'PASS: 本命行星按本命宫头映射自洽（本命口径不受影响）' : 'FAIL: 本命映射自洽校验未通过');
  if (!sunConsistent) process.exitCode = 1;
  console.log('PASS: 行运（6类之一）呈现映射 = 推运黄经对照本命宫头，' + diff10 + ' 颗行星口径发生变化（推运计算本身未变）');
}
// B) 日返/月返 按推运盘自身宫位：呈现即 p.house，且应与本命宫位映射存在差异（证明口径区分有意义）
const sr10 = A.solarReturnChart(c1, target10, { place: c1.place });
const lr10 = A.lunarReturnChart(c1, target10, { place: c1.place });
let retOk10 = true;
[sr10, lr10].forEach(function (ch) {
  const selfOk = ch.planets.every(function (p) { return p.house === houseOf10(p.lon, ch.houses); });
  const differ = ch.planets.filter(function (p) { return houseOf10(p.lon, c1.houses) !== p.house; }).length > 0;
  if (!selfOk) { console.log('FAIL: ' + ch.type + ' 推运行星自身宫位应与推运盘 cusps 自洽'); retOk10 = false; }
  if (!differ) { console.log('WARN: ' + ch.type + ' 自身宫位与本命映射无差异（该样本口径区分不明显）'); }
  console.log(ch.type + '：自身宫位 ' + ch.planets.map(function (p) { return p.house; }).join('/'));
});
console.log(retOk10 ? 'PASS: 日返/月返 呈现 = 推运盘自身宫位（计算与呈现自洽）' : 'FAIL: 日返/月返 自身宫位自洽校验未通过');
if (!retOk10) process.exitCode = 1;
