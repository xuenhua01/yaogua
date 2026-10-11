/* 纯逻辑：不碰 DOM，浏览器和 Node 都能用，方便跑测试。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.XGBuild = factory;
})(typeof self !== 'undefined' ? self : this, function build(GUA, EXTRA) {
  'use strict';

  // 八卦取码：爻自下而上，阳为 1
  var TRIGRAM = {
    '乾': [1, 1, 1], '兑': [1, 1, 0], '离': [1, 0, 1], '震': [1, 0, 0],
    '巽': [0, 1, 1], '坎': [0, 1, 0], '艮': [0, 0, 1], '坤': [0, 0, 0]
  };

  function code3(a, b, c) { return a * 4 + b * 2 + c; }

  var BY_CODE = {};
  GUA.forEach(function (g) {
    BY_CODE[code3.apply(null, TRIGRAM[g.lower]) * 8 + code3.apply(null, TRIGRAM[g.upper])] = g;
  });

  function findGua(lines) {
    var lo = code3(lines[0], lines[1], lines[2]);
    var up = code3(lines[3], lines[4], lines[5]);
    return BY_CODE[lo * 8 + up];
  }
  function byNum(n) { return GUA[n - 1]; }
  function extraOf(name) {
    return EXTRA[name] || { story: '这一卦的典故还在整理中。', yao: [] };
  }
  function hexOf(g) {
    var lo = TRIGRAM[g.lower], up = TRIGRAM[g.upper];
    return [lo[0], lo[1], lo[2], up[0], up[1], up[2]];
  }

  // 《周易》原文的吉凶，换成中性的通阻说法，免得被当成算命
  var TEND = { '大吉': '大通', '吉': '通', '凶': '阻' };
  function tend(l) { return TEND[l] || '平'; }
  function tendColor(l) {
    return { '大吉': 'var(--gold)', '吉': 'var(--green)', '凶': 'var(--red)' }[l] || 'var(--dim)';
  }

  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  // 各月交节（节，不是气）的大致日期，月份 1..12
  var JIE_DAY = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7];
  var JIE_ZHI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];
  var DAY_MS = 86400000;
  var ANCHOR = Date.UTC(1900, 0, 1); // 1900-01-01 为甲戌日

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function epochDay(d) {
    return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - ANCHOR) / DAY_MS);
  }
  function civil(d) {
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' 星期' + WEEK[d.getDay()];
  }
  function stamp(d) {
    var days = epochDay(d);
    var dayIdx = ((10 + days) % 60 + 60) % 60;
    var dayGan = dayIdx % 10;

    var gzYear = d.getFullYear();
    if (d < new Date(gzYear, 1, 4)) gzYear--;   // 以立春为界
    var yearIdx = (((gzYear - 4) % 60) + 60) % 60;
    var yearGan = yearIdx % 10;

    var m = d.getMonth() + 1;
    var monthZhi = d.getDate() >= JIE_DAY[m - 1] ? JIE_ZHI[m - 1] : JIE_ZHI[(m + 10) % 12];
    var monthGan = (yearGan * 2 + monthZhi) % 10;

    var hourZhi = Math.floor((d.getHours() + 1) / 2) % 12;
    var hourGan = (dayGan * 2 + hourZhi) % 10;

    return GAN[yearGan] + ZHI[yearIdx % 12] + '年 ' +
      GAN[monthGan] + ZHI[monthZhi] + '月 ' +
      GAN[dayGan] + ZHI[dayIdx % 12] + '日 ' +
      GAN[hourGan] + ZHI[hourZhi] + '时';
  }

  function movingNames(lines, moving) {
    var pos = ['初', '二', '三', '四', '五', '上'], out = [];
    for (var i = 0; i < 6; i++) {
      if (!moving[i]) continue;
      var yy = lines[i] === 1 ? '九' : '六';
      if (i === 0) out.push('初' + yy);
      else if (i === 5) out.push('上' + yy);
      else out.push(yy + pos[i]);
    }
    return out.join('、');
  }

  /** 三枚铜钱六摇：6 老阴、7 少阳、8 少阴、9 老阳。 */
  function tossAll(rnd) {
    var r = rnd || Math.random;
    var lines = [], moving = [], faces = [], sums = [];
    for (var i = 0; i < 6; i++) {
      var f = [], sum = 0;
      for (var j = 0; j < 3; j++) {
        var v = r() < 0.5 ? 2 : 3;
        f.push(v); sum += v;
      }
      faces.push(f);
      sums.push(sum);
      if (sum === 6) { lines.push(0); moving.push(true); }
      else if (sum === 7) { lines.push(1); moving.push(false); }
      else if (sum === 8) { lines.push(0); moving.push(false); }
      else { lines.push(1); moving.push(true); }
    }
    return { lines: lines, moving: moving, faces: faces, sums: sums };
  }

  function bianOf(lines, moving) {
    return lines.map(function (v, i) { return moving[i] ? 1 - v : v; });
  }

  // 三枚铜钱：字面（阳）记 3，背面（阴）记 2。
  // 三个一加就是这一爻的六七八九：六老阴（动）、七少阳、八少阴、九老阳（动）。
  function faceText(f) { return f === 3 ? '正' : '反'; }
  function coinSum(faces) { return faces[0] + faces[1] + faces[2]; }
  function lineName(sum) {
    return { 6: '老阴 · 动', 7: '少阳', 8: '少阴', 9: '老阳 · 动' }[sum] || '';
  }
  function coinText(faces) {
    return faces.map(faceText).join(' ') + '　' + lineName(coinSum(faces));
  }
  function encodeCoins(all) {
    return all.map(function (f) { return f.join(''); }).join(',');
  }
  function decodeCoins(raw) {
    if (!raw) return [];
    return String(raw).split(',').map(function (g) {
      var d = g.replace(/[^23]/g, '');
      if (d.length !== 3) return null;
      return [d.charCodeAt(0) - 48, d.charCodeAt(1) - 48, d.charCodeAt(2) - 48];
    }).filter(function (x) { return x; });
  }

  return {
    TRIGRAM: TRIGRAM, TEND: TEND,
    findGua: findGua, byNum: byNum, extraOf: extraOf, hexOf: hexOf,
    tend: tend, tendColor: tendColor,
    civil: civil, stamp: stamp,
    movingNames: movingNames, tossAll: tossAll, bianOf: bianOf,
    faceText: faceText, coinSum: coinSum, lineName: lineName, coinText: coinText,
    encodeCoins: encodeCoins, decodeCoins: decodeCoins
  };
});
