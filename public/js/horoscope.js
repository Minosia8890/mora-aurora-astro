/* ============================================================
 * horoscope.js — 运势分析（日运 / 月运 / 年运）
 * 基于真实天象（月亮星座、月相、新月满月、行星逆行、木土行经）
 * 生成十二星座运势内容；同日期同星座结果确定性稳定（djb2 + LCG）
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var SIGN_NAMES = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'];
  var SIGN_GLYPHS = ['\u2648', '\u2649', '\u264A', '\u264B', '\u264C', '\u264D', '\u264E', '\u264F', '\u2650', '\u2651', '\u2652', '\u2653'];
  var ELEMENT_OF = ['fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water'];
  var ELEMENT_NAME = { fire: '火象', earth: '土象', air: '风象', water: '水象' };

  /* ---------------- 天象计算 ---------------- */
  function moonPhaseName(date) {
    var angle = Astronomy.MoonPhase(Astronomy.MakeTime(date));
    var names = ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
    return names[Math.round(angle / 45) % 8];
  }
  function moonIllumPercent(date) {
    try {
      var illum = Astronomy.Illumination(Astronomy.Body.Moon, Astronomy.MakeTime(date));
      return Math.round(illum.fraction * 100);
    } catch (e) { return null; }
  }

  function moonAspectsOf(transits) {
    var defs = AstroCalc.ASPECT_DEFS;
    var out = [];
    var moon = transits.list[1];
    transits.list.forEach(function (p) {
      if (p.key === 'moon') return;
      var d = Math.abs(((moon.lon - p.lon) % 360 + 360) % 360);
      if (d > 180) d = 360 - d;
      defs.forEach(function (asp) {
        if (Math.abs(d - asp.angle) <= asp.orb) {
          out.push({ planet: p.name, type: asp.key, name: asp.name, orb: Math.round(Math.abs(d - asp.angle) * 10) / 10 });
        }
      });
    });
    out.sort(function (a, b) { return a.orb - b.orb; });
    return out.slice(0, 4);
  }

  function searchPhaseInMonth(targetLon, year, month) {
    var start = new Date(year, month - 1, 1);
    var t = Astronomy.SearchMoonPhase(targetLon, Astronomy.MakeTime(start), 31);
    if (!t) return null;
    var d = t.date;
    if (d.getFullYear() !== year || d.getMonth() !== month - 1) return null;
    return d;
  }

  function fmtDate(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function signIdxOfLon(lon) { return Math.floor(((lon % 360) + 360) % 360 / 30); }

  /* ---------------- 确定性伪随机（同一天同一星座结果稳定） ---------------- */
  function seedOf(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }

  var LUCKY_COLORS = ['朱红', '墨绿', '藏蓝', '米白', '鹅黄', '烟灰', '酒红', '薄荷绿', '燕麦色', '雾紫'];
  var LUCKY_THINGS = ['早点睡', '多喝水', '散个步', '整理桌面', '给朋友打个电话', '听一首老歌', '吃顿好的', '写三行日记', '晒十分钟太阳', '提前十分钟出门'];

  function stars(r) { return 3 + Math.floor(r() * 3); } // 3-5 星
  function starHtml(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '\u2605';
    return '<span class="stars">' + s + '</span>';
  }

  /* ---------------- 日运内容 ---------------- */
  var MOON_MATRIX = {
    'fire|fire': '情绪燃点和行动力同频：想做的事立刻动手，热情是今天的燃料。',
    'fire|earth': '心里有火但节奏偏稳：适合把冲动落成具体计划，稳步推进。',
    'fire|air': '灵感来得很勤：多聊多交流，想法会在对话里越擦越亮。',
    'fire|water': '情绪有点上头：先安顿心情再行动，别让火苗烧到亲近的人。',
    'earth|fire': '稳静的表面藏着干劲：适合给生活定个小目标并开个头。',
    'earth|earth': '情绪和节奏都在地上：踏实做事、吃顿好饭，就是最好的一天。',
    'earth|air': '头脑清醒务实：处理文件、账目、沟通事务效率极高。',
    'earth|water': '感受力渗进日常：整理房间、下厨、亲近自然都能安顿心绪。',
    'air|fire': '脑子转得飞快：适合头脑风暴、社交破冰，新点子层出不穷。',
    'air|earth': '想法偏多但落地要紧：把清单写下来，一件件划掉。',
    'air|air': '信息量爆炸的一天：社交运旺，注意别被消息流牵着走。',
    'air|water': '理性与感性打架：别急着下判断，先听完自己心里的声音。',
    'water|fire': '情绪来得快去得也快：运动和表达是出口，写下来会轻松很多。',
    'water|earth': '情绪沉静温和：适合处理家事、修复关系，做些滋养自己的小事。',
    'water|air': '感受丰富又想倾诉：找信得过的人聊聊，一吐为快。',
    'water|water': '直觉与共情满格：适合独处、创作、疗愈，少刷让你emo的东西。'
  };

  var DAILY_TIPS = [
    '上午适合推进要事，下午适合沟通协调。',
    '今天答应别人之前先看一眼自己的日程。',
    '把最不想做的那件事排在最前面，做完会轻松一整天。',
    '遇到争执先复述对方的话，再表达自己的。',
    '花钱之前多想十秒，今晚你会感谢自己。',
    '今天适合主动一点：想联系的人就去联系。',
    '别急着给事情下定论，晚上的信息会更全。',
    '身体是今天的重点：久坐记得起来走两步。',
    '今天的直觉挺准，但重要决定还是等睡一觉再说。',
    '把感谢说出口，今天的人缘会有正反馈。'
  ];

  function renderDaily(dateStr) {
    var parts = dateStr.split('-');
    var date = new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0);
    var t = AstroCalc.currentTransits(date);
    var byKey = {};
    t.list.forEach(function (p) { byKey[p.key] = p; });
    var moon = byKey.moon, sun = byKey.sun;
    var moonEl = ELEMENT_OF[signIdxOfLon(moon.lon)];

    // 天象面板
    var retroNames = t.list.filter(function (p) { return p.retro; }).map(function (p) { return p.name; });
    var mAsp = moonAspectsOf(t);
    var aspDesc = mAsp.map(function (a) {
      var tense = a.type === 'square' || a.type === 'opp';
      return '月亮 ' + a.name + ' ' + a.planet + (tense ? '（有点紧）' : '（顺畅）');
    }).join('；');

    $('#skyPanel').innerHTML =
      panelItem('月亮星座', moon.sign + ' ' + moon.deg + '\u00B0') +
      panelItem('月相', moonPhaseName(date) + (moonIllumPercent(date) != null ? '（月面 ' + moonIllumPercent(date) + '%）' : '')) +
      panelItem('太阳位置', sun.sign + ' ' + sun.deg + '\u00B0') +
      panelItem('逆行中', retroNames.length ? retroNames.join('、') : '无') +
      panelItem('月亮今日相位', aspDesc || '月亮今天没有形成紧密相位，情绪走平线');

    // 十二星座卡
    var html = '';
    for (var i = 0; i < 12; i++) {
      var r = rng(seedOf(dateStr + '#' + i));
      var signEl = ELEMENT_OF[i];
      var vibe = MOON_MATRIX[moonEl + '|' + signEl];
      var tip = pick(DAILY_TIPS, r);
      html += '<div class="horo-card">' +
        '<div class="hc-head"><span class="hc-glyph">' + SIGN_GLYPHS[i] + '</span><b>' + SIGN_NAMES[i] + '</b><span class="hc-ele">' + ELEMENT_NAME[signEl] + '</span></div>' +
        '<div class="hc-stars">' +
        '<span>综合 ' + starHtml(stars(r)) + '</span><span>爱情 ' + starHtml(stars(r)) + '</span>' +
        '<span>事业 ' + starHtml(stars(r)) + '</span><span>财运 ' + starHtml(stars(r)) + '</span></div>' +
        '<p class="hc-text">' + vibe + '</p>' +
        '<p class="hc-tip">' + tip + '</p>' +
        '<div class="hc-lucky">幸运色 ' + pick(LUCKY_COLORS, r) + ' · 幸运数字 ' + (1 + Math.floor(r() * 9)) + '</div>' +
        '</div>';
    }
    $('#signGrid').innerHTML = html;

    $('#horoNote').textContent = '天象数据为真实星历计算；十二星座运势为通用娱乐向解读（基于月亮天象 + 星座元素）。想要专属于你的精准运势，请先在「本命星盘」生成个人盘面。';
  }

  /* ---------------- 月运内容 ---------------- */
  var MONTH_KW = {
    fire: ['破局', '冲刺', '点火', '亮牌'],
    earth: ['扎根', '盘点', '蓄力', '兑现'],
    air: ['联动', '破圈', '学习', '表达'],
    water: ['沉淀', '修复', '滋养', '直觉']
  };
  var MONTH_LINE = {
    fire: '行动力是这个月的主题，先动起来，路会越走越宽。',
    earth: '稳扎稳打是这个月的主旋律，慢一点反而快。',
    air: '信息和人际是这个月的杠杆，多聊多问多链接。',
    water: '向内看是这个月的功课，感觉对了再出手。'
  };
  var MERCURY_RETRO_TIPS = {
    fire: '沟通容易过火，重要消息发出去前多读一遍。',
    earth: '合同与细节多留个心眼，备份和复述都别省。',
    air: '消息容易错漏，会议和行程提前双确认。',
    water: '旧人旧事容易回潮，念旧可以，别急着复合或复购。'
  };

  function renderMonthly(ymStr) {
    var y = +ymStr.slice(0, 4), m = +ymStr.slice(5, 7);
    var start = new Date(y, m - 1, 1, 12, 0);

    var sunT = AstroCalc.currentTransits(start).list[0];
    var nm = searchPhaseInMonth(0, y, m);
    var fm = searchPhaseInMonth(180, y, m);
    var nmSign = nm ? AstroCalc.currentTransits(nm).list[1].sign : null;
    var fmSign = fm ? AstroCalc.currentTransits(fm).list[1].sign : null;

    // 本月逆行（取月初/月中/月末三点采样）
    var mid = new Date(y, m - 1, 15, 12, 0), end = new Date(y, m - 1, 27, 12, 0);
    var samples = [AstroCalc.currentTransits(start), AstroCalc.currentTransits(mid), AstroCalc.currentTransits(end)];
    var retroNames = [];
    samples[0].list.forEach(function (p, idx) {
      if (samples[1].list[idx].retro || samples[2].list[idx].retro) retroNames.push(p.name);
    });
    var hasMercuryRetro = retroNames.indexOf('水星') >= 0;

    $('#skyPanel').innerHTML =
      panelItem('月份', y + ' 年 ' + m + ' 月') +
      panelItem('太阳行经', sunT.sign) +
      panelItem('新月', nm ? fmtDate(nm) + '（' + nmSign + '）· 适合开启与播种' : '本月没有新月') +
      panelItem('满月', fm ? fmtDate(fm) + '（' + fmSign + '）· 适合收尾与释放' : '本月没有满月') +
      panelItem('本月逆行', retroNames.length ? retroNames.join('、') : '无主要行星逆行');

    var html = '';
    for (var i = 0; i < 12; i++) {
      var r = rng(seedOf(ymStr + '#' + i));
      var el = ELEMENT_OF[i];
      var kw = pick(MONTH_KW[el], r);
      var line2 = '新月与满月是本月两个节奏点：新月（' + (nm ? fmtDate(nm) + ' ' + nmSign : '下月') + '）前后适合启动新计划；满月（' + (fm ? fmtDate(fm) + ' ' + fmSign : '月底') + '）前后适合收尾、复盘和放手。';
      var line3 = hasMercuryRetro ? '水星本月部分时间逆行：' + MERCURY_RETRO_TIPS[el] : '本月没有主要行星逆行，节奏相对清爽，适合正常推进计划。';
      var lucky = '开运方式：' + pick(LUCKY_THINGS, r) + '；幸运色 ' + pick(LUCKY_COLORS, r);

      html += '<div class="horo-card wide">' +
        '<div class="hc-head"><span class="hc-glyph">' + SIGN_GLYPHS[i] + '</span><b>' + SIGN_NAMES[i] + '</b><span class="hc-ele">' + ELEMENT_NAME[el] + '</span><span class="hc-kw">本月关键词「' + kw + '」</span></div>' +
        '<div class="hc-stars"><span>事业 ' + starHtml(stars(r)) + '</span><span>感情 ' + starHtml(stars(r)) + '</span><span>财运 ' + starHtml(stars(r)) + '</span></div>' +
        '<p class="hc-text">' + MONTH_LINE[el] + '</p>' +
        '<p class="hc-tip">' + line2 + '</p>' +
        '<p class="hc-tip">' + line3 + '</p>' +
        '<div class="hc-lucky">' + lucky + '</div>' +
        '</div>';
    }
    $('#signGrid').innerHTML = html;

    $('#horoNote').textContent = '新月 / 满月 / 逆行时间为真实星历推算；十二星座月运为通用娱乐向解读。想看贴合你个人星盘的流年分析，请先在「本命星盘」生成个人盘面。';
  }

  /* ---------------- 年运内容 ---------------- */
  var YEAR_KW = {
    fire: ['破局之年', '加速之年', '点火之年', '亮牌之年'],
    earth: ['扎根之年', '丰收之年', '筑基之年', '兑现之年'],
    air: ['破圈之年', '连接之年', '表达之年', '学习之年'],
    water: ['深耕之年', '疗愈之年', '滋养之年', '向内之年']
  };
  var YEAR_LINE = {
    fire: '这一年主旋律是行动与突破：想清楚就去做，全年最大的红利来自"先开枪再瞄准"。',
    earth: '这一年主旋律是积累与兑现：把根基打深，年底回头看，你会感谢每一步踏实。',
    air: '这一年主旋律是连接与表达：人脉、信息、学习是新一年的杠杆，多走出去。',
    water: '这一年主旋律是感受与修复：向内扎根、处理情绪与关系，内在稳了外面就顺了。'
  };
  var JUPITER_TIPS = {
    fire: '木星点亮你的行动力：大胆立项、主动争取，机会偏爱冲在前面的人。',
    earth: '木星加持你的务实积累：升职加薪、资产增值的概率上调，稳中能进。',
    air: '木星放大你的社交与学习运：考试、签约、传播、出海都有顺风。',
    water: '木星滋养你的情感与直觉：感情升温、家庭议题推进、创作灵感旺盛。'
  };
  var SATURN_TIPS = {
    fire: '土星给你的冲动装上方向盘：计划先行、留足余量，反而跑得更快。',
    earth: '土星加压你的责任区：活会变多，但扛过去就是实打实的资历。',
    air: '土星考验你的沟通承诺：少说漂亮话，多交付确定的结果。',
    water: '土星让你直面情绪课题：给关系立边界，是这一年最重要的功课。'
  };

  // 木星 / 土星在一年内行经的星座（季度采样）
  function signPathInYear(key, year) {
    var seen = [];
    [0, 3, 6, 9].forEach(function (m) {
      var t = AstroCalc.currentTransits(new Date(year, m, 15, 12, 0));
      var p = null;
      t.list.forEach(function (x) { if (x.key === key) p = x; });
      if (p && seen.indexOf(p.sign) < 0) seen.push(p.sign);
    });
    return seen;
  }

  function renderYearly(yearStr) {
    var y = +yearStr;
    var jup = signPathInYear('jupiter', y);
    var sat = signPathInYear('saturn', y);
    var jupEl = jup.length ? ELEMENT_OF[SIGN_NAMES.indexOf(jup[0])] : 'fire';
    var satEl = sat.length ? ELEMENT_OF[SIGN_NAMES.indexOf(sat[0])] : 'earth';

    $('#skyPanel').innerHTML =
      panelItem('年份', y + ' 年') +
      panelItem('木星行经（幸运区）', jup.join(' → ')) +
      panelItem('土星行经（考验区）', sat.join(' → ')) +
      panelItem('年度基调', '木星在' + ELEMENT_NAME[jupEl] + ' · 土星在' + ELEMENT_NAME[satEl]) +
      panelItem('年运提示', '机会看木星、功课看土星，两头都照顾到就是顺年');

    var html = '';
    for (var i = 0; i < 12; i++) {
      var r = rng(seedOf(yearStr + '#y#' + i));
      var el = ELEMENT_OF[i];
      var kw = pick(YEAR_KW[el], r);
      var q1 = '上半年：' + pick(['适合布局与试错，别怕小失败', '重点是把节奏稳住，不追高不冒进', '人脉和信息是关键变量，多见人', '先处理情绪与关系，再处理事情'], r) + '。';
      var q2 = '下半年：' + pick(['进入收获期，之前的铺垫开始见效', '适合收尾、复盘和结算，落袋为安', '新机会浮现，敢接住就有惊喜', '把学到的东西输出成作品或收入'], r) + '。';
      var lucky = '年度幸运色 ' + pick(LUCKY_COLORS, r) + ' · 年度数字 ' + (1 + Math.floor(r() * 9)) + ' · 开运物：' + pick(LUCKY_THINGS, r);

      html += '<div class="horo-card wide">' +
        '<div class="hc-head"><span class="hc-glyph">' + SIGN_GLYPHS[i] + '</span><b>' + SIGN_NAMES[i] + '</b><span class="hc-ele">' + ELEMENT_NAME[el] + '</span><span class="hc-kw">' + y + ' 关键词「' + kw + '」</span></div>' +
        '<div class="hc-stars"><span>事业 ' + starHtml(stars(r)) + '</span><span>感情 ' + starHtml(stars(r)) + '</span><span>财运 ' + starHtml(stars(r)) + '</span></div>' +
        '<p class="hc-text">' + YEAR_LINE[el] + '</p>' +
        '<p class="hc-tip">' + JUPITER_TIPS[jupEl] + '</p>' +
        '<p class="hc-tip">' + SATURN_TIPS[satEl] + '</p>' +
        '<p class="hc-tip">' + q1 + q2 + '</p>' +
        '<div class="hc-lucky">' + lucky + '</div>' +
        '</div>';
    }
    $('#signGrid').innerHTML = html;

    $('#horoNote').textContent = '木星 / 土星行经星座为真实星历推算（季度采样）；十二星座年运为通用娱乐向解读。想要贴合你本命盘的流年分析，请先在「本命星盘」生成个人盘面后向 AI 提问。';
  }

  function panelItem(k, v) {
    return '<div class="qs-item"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    var today = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    $('#dailyDate').value = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    $('#monthlyMonth').value = today.getFullYear() + '-' + pad(today.getMonth() + 1);
    $('#yearlyYear').value = String(today.getFullYear());

    renderDaily($('#dailyDate').value);

    $('#dailyDate').addEventListener('change', function () {
      if (this.value) renderDaily(this.value);
      else renderDaily(new Date().toISOString().slice(0, 10));
    });
    $('#monthlyMonth').addEventListener('change', function () {
      if (this.value) renderMonthly(this.value);
    });
    $('#yearlyYear').addEventListener('change', function () {
      if (this.value) renderYearly(this.value);
    });

    // Tab：切换时同步切换工具栏并重渲染对应内容
    function activateTab(mode) {
      document.querySelectorAll('.tab').forEach(function (x) {
        x.classList.toggle('active', x.dataset.tab === mode);
      });
      $('#toolbarDaily').style.display = mode === 'daily' ? 'flex' : 'none';
      $('#toolbarMonthly').style.display = mode === 'monthly' ? 'flex' : 'none';
      $('#toolbarYearly').style.display = mode === 'yearly' ? 'flex' : 'none';
      if (mode === 'daily') renderDaily($('#dailyDate').value || new Date().toISOString().slice(0, 10));
      else if (mode === 'monthly') renderMonthly($('#monthlyMonth').value);
      else renderYearly($('#yearlyYear').value || String(new Date().getFullYear()));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { activateTab(t.dataset.tab); });
    });

    // 支持 URL 参数直达：horoscope.html?tab=daily|monthly|yearly（导航下拉使用）
    var params = new URLSearchParams(location.search);
    var tab = params.get('tab');
    if (tab === 'monthly' || tab === 'yearly') activateTab(tab);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
