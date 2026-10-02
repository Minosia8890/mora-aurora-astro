/* ============================================================
 * cities-henan.js — 河南省出生地/现居地本地补充地点库
 * 背景：出生地联想走 Open-Meteo Geocoding 在线接口，河南地级市
 * 命中不全（如开封/鹤壁/济源等搜不到城市级结果），故本地补充
 * 全部 17 个地级市（含已存在的郑州），口径与 Open-Meteo 结果一致：
 *   name / latitude / longitude / timezone / admin1 / admin2 /
 *   country / country_code
 * 配合 localGeoResults(q) / mergeGeoResults(local, remote) 使用，
 * 在搜索时本地命中优先展示、远程结果合并去重。
 * ============================================================ */
(function () {
  var CITIES = [
    { id: 1,   name: '郑州市',     latitude: 34.7466, longitude: 113.6254, admin2: '中原区',  aliases: [] },
    { id: 2,   name: '开封市',     latitude: 34.7973, longitude: 114.3074, admin2: '龙亭区',  aliases: ['开封府'] },
    { id: 3,   name: '洛阳市',     latitude: 34.6197, longitude: 112.4540, admin2: '洛龙区',  aliases: [] },
    { id: 4,   name: '平顶山市',   latitude: 33.7662, longitude: 113.1926, admin2: '新华区',  aliases: [] },
    { id: 5,   name: '安阳市',     latitude: 36.1034, longitude: 114.3528, admin2: '文峰区',  aliases: [] },
    { id: 6,   name: '鹤壁市',     latitude: 35.7482, longitude: 114.2954, admin2: '淇滨区',  aliases: [] },
    { id: 7,   name: '新乡市',     latitude: 35.3032, longitude: 113.9268, admin2: '红旗区',  aliases: [] },
    { id: 8,   name: '焦作市',     latitude: 35.2427, longitude: 113.2418, admin2: '解放区',  aliases: [] },
    { id: 9,   name: '濮阳市',     latitude: 35.7622, longitude: 115.0292, admin2: '华龙区',  aliases: [] },
    { id: 10,  name: '许昌市',     latitude: 34.0357, longitude: 113.8521, admin2: '魏都区',  aliases: [] },
    { id: 11,  name: '漯河市',     latitude: 33.5815, longitude: 114.0172, admin2: '源汇区',  aliases: [] },
    { id: 12,  name: '三门峡市',   latitude: 34.7728, longitude: 111.2001, admin2: '湖滨区',  aliases: [] },
    { id: 13,  name: '南阳市',     latitude: 32.9908, longitude: 112.5283, admin2: '卧龙区',  aliases: [] },
    { id: 14,  name: '商丘市',     latitude: 34.4140, longitude: 115.6564, admin2: '睢阳区',  aliases: [] },
    { id: 15,  name: '信阳市',     latitude: 32.1470, longitude: 114.0913, admin2: '浉河区',  aliases: [] },
    { id: 16,  name: '周口市',     latitude: 33.6260, longitude: 114.6496, admin2: '川汇区',  aliases: [] },
    { id: 17,  name: '驻马店市',   latitude: 33.0114, longitude: 114.0222, admin2: '驿城区',  aliases: [] },
    { id: 18,  name: '济源市',     latitude: 35.0904, longitude: 112.6020, admin2: '济源市',  aliases: ['济源示范区'] }
  ];

  CITIES.forEach(function (c) {
    c.country = '中国';
    c.country_code = 'CN';
    c.admin1 = '河南省';
    c.timezone = 'Asia/Shanghai';
  });

  function norm(s) {
    return String(s || '').replace(/[省市区县镇乡自治特别行政]/g, '').toLowerCase().trim();
  }

  /* 按输入返回本地匹配城市（Open-Meteo results 结构），最多 8 条 */
  window.localGeoResults = function (q) {
    var n = norm(q);
    if (!n) return [];
    if (n === '河南') return CITIES.slice(0, 8);
    var out = [];
    CITIES.forEach(function (c) {
      var names = [c.name].concat(c.aliases || []);
      for (var i = 0; i < names.length; i++) {
        var nm = norm(names[i]);
        if (nm && (nm.indexOf(n) === 0 || n.indexOf(nm) === 0)) { out.push(c); break; }
      }
    });
    return out.slice(0, 8);
  };

  /* 合并本地与远程结果：本地优先，按 name|admin1 去重，最多 8 条 */
  window.mergeGeoResults = function (local, remote) {
    var out = [], seen = {};
    function push(r) {
      if (!r || typeof r !== 'object') return;
      var key = (r.name || '') + '|' + (r.admin1 || '');
      if (seen[key]) return;
      seen[key] = 1;
      out.push(r);
    }
    (local || []).forEach(push);
    (remote || []).forEach(push);
    return out.slice(0, 8);
  };
})();
