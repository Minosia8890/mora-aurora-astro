/* ============================================================
 * test-customers.js — 客户资料库回归测试
 * 覆盖：
 *   1. customers.html：UI 新建客户（含出生地 Open-Meteo 联想选点）→ localStorage 持久化
 *   2. 编辑客户备注 → 更新生效
 *   3. 删除（两次点击确认）→ 列表与 localStorage 清空
 *   4. natal.html?customer=xxx 直达填充（昵称/日期/时间/出生地）
 *   5. natal.html「从客户库选择」弹窗选人填充
 *   6. synastry.html?side=b&customer=xxx 填充 B 方
 *   7. synastry.html 弹窗选人填充 A 方
 * 运行：node test-customers.js
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, 'public');
const PORT = 3178;
const BASE = 'http://localhost:' + PORT;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

// ---------- 静态服务器 ----------
const server = http.createServer(function (req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': (MIME[path.extname(file)] || 'text/plain') + '; charset=utf-8' });
  res.end(fs.readFileSync(file));
});

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- 虚拟控制台（收集真实错误） ----------
function makeVC(label, sink) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const msg = String((e && e.message) || e);
    if (msg.includes('Could not load') || msg.includes('Error: Could not load')) return; // CDN 网络波动容忍
    sink.push(`[${label}] jsdomError: ${msg}`);
  });
  vc.on('error', (...a) => sink.push(`[${label}] console.error: ${a.join(' ')}`));
  vc.on('warn', () => {});
  vc.on('log', () => {});
  return vc;
}

// ---------- stub fetch：仅模拟 Open-Meteo 地理编码 ----------
function stubFetch(window) {
  window.fetch = function (url) {
    url = String(url);
    if (url.indexOf('geocoding-api.open-meteo.com') >= 0) {
      return Promise.resolve({
        json: function () {
          return Promise.resolve({
            results: [
              { name: '杭州市', admin1: '浙江省', country: '中国', latitude: 30.27, longitude: 120.15, timezone: 'Asia/Shanghai' },
              { name: '深圳市', admin1: '广东省', country: '中国', latitude: 22.54, longitude: 114.06, timezone: 'Asia/Shanghai' }
            ]
          });
        }
      });
    }
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
  };
}

// ---------- 预置客户数据（注入到页面脚本执行前） ----------
function seedScript(customers) {
  return '<script>window.localStorage.setItem("cyber_astro_customers_guest", ' +
    JSON.stringify(JSON.stringify(customers)) + ');</script>';
}

const cust1 = {
  id: 'cu_test1', name: '王小明', note: 'n1', date: '1990-06-15', time: '08:30', timeUnknown: false,
  place: { name: '杭州市', admin: '浙江省 · 中国', lat: 30.27, lon: 120.15, tz: 'Asia/Shanghai' },
  createdAt: '2026/9/10 10:00', updatedAt: '2026/9/10 10:00'
};
const cust2 = {
  id: 'cu_test2', name: '赵小红', note: '', date: '1985-11-02', time: '22:10', timeUnknown: true,
  place: { name: '深圳市', admin: '广东省 · 中国', lat: 22.54, lon: 114.06, tz: 'Asia/Shanghai' },
  createdAt: '2026/9/10 10:05', updatedAt: '2026/9/10 10:05'
};

// ---------- 加载页面（可选：注入 seed 数据 / 查询串 / 等待条件） ----------
async function loadPage(file, label, opts) {
  opts = opts || {};
  const sink = opts.sink;
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (opts.injectBefore) {
    html = html.replace('<script src="js/theme.js"></script>', opts.injectBefore + '<script src="js/theme.js"></script>');
  }
  const dom = new JSDOM(html, {
    url: BASE + '/' + file + (opts.query || ''),
    resources: 'usable', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: makeVC(label, sink)
  });
  const window = dom.window;
  stubFetch(window);
  for (let i = 0; i < 60; i++) {
    await wait(300);
    const ready = window.document.readyState === 'complete' && (!opts.waitFor || opts.waitFor(window));
    if (ready) break;
  }
  await wait(200);
  return window;
}

// ---------- 断言 ----------
let passCount = 0, failCount = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  passCount++;
  console.log('  [PASS] ' + msg);
}

async function main() {
  const sink = [];
  console.log('== 场景 1：客户库页面 · 新建客户（含出生地联想） ==');
  {
    const w = await loadPage('customers.html', 'customers-new', { sink });
    const doc = w.document;
    assert(!!w.ClientLib, 'ClientLib 模块已加载');
    doc.getElementById('btnNew').click();
    doc.getElementById('custName').value = '李测试';
    doc.getElementById('custDate').value = '1992-03-08';
    doc.getElementById('custTime').value = '07:45';
    const placeInput = doc.getElementById('custPlace');
    placeInput.value = '上海';
    placeInput.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(900); // 防抖 350ms + fetch
    const item = doc.querySelector('.geo-item');
    assert(!!item, '出生地联想下拉出现');
    item.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await wait(120);
    assert(placeInput.value.indexOf('杭州市') >= 0, '出生地已回填选中项: ' + placeInput.value);
    doc.getElementById('btnSaveCustomer').click();
    await wait(200);
    const cards = doc.querySelectorAll('.cust-card');
    assert(cards.length === 1, '列表出现 1 位客户');
    assert(cards[0].textContent.indexOf('李测试') >= 0, '卡片显示姓名');
    assert(cards[0].textContent.indexOf('杭州市') >= 0, '卡片显示出生地');
    const saved = JSON.parse(w.localStorage.getItem('cyber_astro_customers_guest'));
    assert(saved.length === 1, 'localStorage 持久化 1 条');
    assert(saved[0].place.lat === 30.27 && saved[0].place.tz === 'Asia/Shanghai',
      '经纬度/时区来自 Open-Meteo 结果');
    assert(saved[0].time === '07:45' && saved[0].timeUnknown === false, '出生时间已存');

    console.log('== 场景 2：编辑客户 ==');
    cards[0].querySelector('[data-act="edit"]').click();
    await wait(100);
    assert(doc.getElementById('custModal').classList.contains('show'), '编辑弹窗打开');
    doc.getElementById('custNote').value = '新备注';
    doc.getElementById('btnSaveCustomer').click();
    await wait(200);
    const saved2 = JSON.parse(w.localStorage.getItem('cyber_astro_customers_guest'));
    assert(saved2[0].note === '新备注', '备注已更新');
    assert(doc.getElementById('custCount').textContent.indexOf('共 1') >= 0, '计数正确');

    console.log('== 场景 3：删除客户（两次点击确认） ==');
    const delBtn = doc.querySelector('.cust-card [data-act="del"]');
    delBtn.click();
    assert(delBtn.textContent.indexOf('确认删除') >= 0, '第一次点击进入确认态');
    delBtn.click();
    await wait(200);
    assert(doc.querySelectorAll('.cust-card').length === 0, '删除后列表为空');
    assert(w.localStorage.getItem('cyber_astro_customers_guest') === '[]', 'localStorage 已清空');
  }

  console.log('== 场景 4：本命盘 URL 直达填充（natal.html?customer=xxx） ==');
  {
    const w = await loadPage('natal.html', 'natal-url', {
      sink, query: '?customer=cu_test1', injectBefore: seedScript([cust1]),
      waitFor: win => !!win.AstroCalc
    });
    const doc = w.document;
    assert(doc.getElementById('nickName').value === '王小明', '昵称已填充');
    assert(doc.getElementById('birthDate').value === '1990-06-15', '出生日期已填充');
    assert(doc.getElementById('birthTime').value === '08:30', '出生时间已填充');
    assert(doc.getElementById('birthPlace').value.indexOf('杭州市') >= 0, '出生地显示已填充');
    assert(!doc.getElementById('timeUnknown').checked, '时间不详未勾选');
  }

  console.log('== 场景 5：本命盘「从客户库选择」弹窗 ==');
  {
    const w = await loadPage('natal.html', 'natal-picker', {
      sink, injectBefore: seedScript([cust1, cust2]), waitFor: win => !!win.AstroCalc
    });
    const doc = w.document;
    doc.getElementById('btnPickCustomer').click();
    await wait(150);
    const items = doc.querySelectorAll('.cust-picker-modal .picker-item');
    assert(items.length === 2, '弹窗列出 2 位客户');
    assert(items[0].textContent.indexOf('王小明') >= 0, '弹窗含客户姓名');
    items[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(150);
    assert(!doc.querySelector('.cust-picker-modal'), '选择后弹窗关闭');
    assert(doc.getElementById('nickName').value === '王小明', '弹窗选人填充昵称');
    assert(doc.getElementById('birthDate').value === '1990-06-15', '弹窗选人填充日期');
    assert(doc.getElementById('birthPlace').value.indexOf('杭州市') >= 0, '弹窗选人填充出生地');
  }

  console.log('== 场景 6：合盘 URL 直达填充 B 方（synastry.html?side=b&customer=xxx） ==');
  {
    const w = await loadPage('synastry.html', 'synastry-url', {
      sink, query: '?side=b&customer=cu_test1', injectBefore: seedScript([cust1]),
      waitFor: win => !!win.AstroCalc
    });
    const doc = w.document;
    assert(doc.getElementById('nameB').value === '王小明', 'B 方昵称已填充');
    assert(doc.getElementById('dateB').value === '1990-06-15', 'B 方日期已填充');
    assert(doc.getElementById('timeB').value === '08:30', 'B 方时间已填充');
    assert(doc.getElementById('placeB').value.indexOf('杭州市') >= 0, 'B 方出生地已填充');
    assert(doc.getElementById('nameA').value === '', 'A 方未被误填充');
  }

  console.log('== 场景 7：合盘「从客户库选择」弹窗填充 A 方 ==');
  {
    const w = await loadPage('synastry.html', 'synastry-picker', {
      sink, injectBefore: seedScript([cust1, cust2]), waitFor: win => !!win.AstroCalc
    });
    const doc = w.document;
    doc.getElementById('btnPickA').click();
    await wait(150);
    const items = doc.querySelectorAll('.cust-picker-modal .picker-item');
    assert(items.length === 2, '弹窗列出 2 位客户');
    items[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await wait(150);
    assert(doc.getElementById('nameA').value === '王小明', 'A 方昵称已填充');
    assert(doc.getElementById('dateA').value === '1990-06-15', 'A 方日期已填充');
    assert(doc.getElementById('placeA').value.indexOf('杭州市') >= 0, 'A 方出生地已填充');
    assert(doc.getElementById('dateB').value === '', 'B 方未被误填充');
  }

  // 页面真实 JS 错误检查
  const realErrors = sink.filter(s => !s.includes('Not implemented'));
  assert(realErrors.length === 0, '页面无真实 JS 错误' + (realErrors.length ? ' → ' + realErrors.join(' | ') : ''));

  console.log('\n==============================');
  console.log(`客户资料库回归测试: ${passCount} 通过, 0 失败`);
  console.log('==============================');
  server.close();
  process.exit(0);
}

server.listen(PORT, function () {
  main().catch(function (err) {
    console.error('\n[FATAL] ' + (err && err.stack || err));
    server.close();
    process.exit(1);
  });
});
