/* 跑法：D:\Tools\Python313 不需要，直接用 node：
     "D:\Tools\node\node.exe" tools\test_logic.js
   主要验证：六十四卦的编码能一一对上、干支算法对得上已知锚点。 */
const fs = require('fs');
const path = require('path');
const build = require('../logic.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const data = new Function(src + '\n;return {GUA:GUA, EXTRA:EXTRA};')();
const X = build(data.GUA, data.EXTRA);

let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (extra ? '  -> ' + extra : ''));
  }
}

console.log('数据：');
check('六十四卦', data.GUA.length === 64, data.GUA.length);
check('六十四篇详解', Object.keys(data.EXTRA).length === 64);
check('每卦六爻', data.GUA.every(function (g) {
  const e = data.EXTRA[g.name];
  return e && e.yao && e.yao.length === 6;
}));
check('每卦都有典故', data.GUA.every(function (g) {
  const e = data.EXTRA[g.name];
  return e && e.story && e.story.length > 20;
}));

console.log('卦象编码：');
check('卦序连续 1..64', data.GUA.every(function (g, i) { return g.num === i + 1; }));
check('上下卦都在八卦里', data.GUA.every(function (g) {
  return X.TRIGRAM[g.upper] && X.TRIGRAM[g.lower];
}));
let roundTrip = 0;
data.GUA.forEach(function (g) {
  const found = X.findGua(X.hexOf(g));
  if (found && found.num === g.num) roundTrip++;
  else console.log('      对不上：' + g.num + ' ' + g.name);
});
check('每卦按爻反查都能回到自己', roundTrip === 64, roundTrip + '/64');

const seen = {};
let dup = 0;
data.GUA.forEach(function (g) {
  const h = X.hexOf(g).join('');
  if (seen[h]) dup++;
  seen[h] = g;
});
check('六十四卦象互不重复', dup === 0);

console.log('干支（对已知锚点）：');
// 1949-10-01 甲子日、2000-01-01 戊午日，都是公认的锚点
const d1 = X.stamp(new Date(1949, 9, 1, 12, 0));
check('1949-10-01 是甲子日', d1.indexOf('甲子日') >= 0, d1);
const d2 = X.stamp(new Date(2000, 0, 1, 12, 0));
check('2000-01-01 是戊午日', d2.indexOf('戊午日') >= 0, d2);
const d3 = X.stamp(new Date(2026, 9, 11, 21, 33));
check('2026-10-11 21:33 = 丙午年 戊戌月 戊午日 癸亥时',
  d3 === '丙午年 戊戌月 戊午日 癸亥时', d3);

console.log('摇卦：');
// 用固定序列喂进去，验证 6/7/8/9 的判定
let seq = [0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9, 0.1, 0.9, 0.9, 0.1, 0.1, 0.1];
let k = 0;
const t = X.tossAll(function () { return seq[k++ % seq.length]; });
check('和为 6 或 7 或 8 或 9', t.sums.every(function (s) { return s >= 6 && s <= 9; }));
check('每个和 = 三枚铜钱之和', t.sums.every(function (s, i) {
  return s === t.faces[i][0] + t.faces[i][1] + t.faces[i][2];
}));
check('老阴是阴爻且为动爻', t.sums.every(function (s, i) {
  if (s === 6) return t.lines[i] === 0 && t.moving[i];
  if (s === 7) return t.lines[i] === 1 && !t.moving[i];
  if (s === 8) return t.lines[i] === 0 && !t.moving[i];
  return t.lines[i] === 1 && t.moving[i];
}));
let stat = { 6: 0, 7: 0, 8: 0, 9: 0 };
for (let i = 0; i < 60000; i++) stat[X.tossAll().sums[0]]++;
const ratio = (stat[9] / 60000 * 100).toFixed(1);
check('老阳概率约 12.5%', Math.abs(stat[9] / 60000 - 0.125) < 0.01, ratio + '%');

console.log('动爻与变卦：');
check('初九、上六的叫法', X.movingNames([1, 0, 0, 0, 0, 0], [true, false, false, false, false, false]) === '初九');
check('多动爻用顿号连接',
  X.movingNames([1, 0, 0, 0, 0, 0], [true, true, false, false, false, false]) === '初九、六二');
const ben = X.findGua([1, 0, 0, 0, 1, 0]);           // 水雷屯
check('水雷屯 = 第 3 卦', ben && ben.num === 3, ben && ben.name);
const bian = X.findGua(X.bianOf([1, 0, 0, 0, 1, 0], [false, false, true, false, false, false]));
check('屯的三爻一动就有变卦', !!bian, bian && bian.full);

console.log('三枚铜钱：');
check('正面写正、反面写反', X.faceText(3) === '正' && X.faceText(2) === '反');
check('三个一加就是这一爻', X.coinSum([3, 3, 2]) === 8 && X.coinSum([3, 3, 3]) === 9);
check('六七八九各有各的说法',
  X.lineName(6) === '老阴 · 动' && X.lineName(7) === '少阳' &&
  X.lineName(8) === '少阴' && X.lineName(9) === '老阳 · 动');
check('一句话说清一组', X.coinText([3, 3, 2]) === '正 正 反　少阴', X.coinText([3, 3, 2]));
check('摇出来的每一组都能说清楚', t.faces.every(function (f, i) {
  return X.coinText(f) === X.faceText(f[0]) + ' ' + X.faceText(f[1]) + ' ' + X.faceText(f[2]) +
    '　' + X.lineName(t.sums[i]);
}));
const rawCoins = X.encodeCoins(t.faces);
check('六组存下来还是六组', X.decodeCoins(rawCoins).length === 6, rawCoins);
check('存了再读，正反没变',
  JSON.stringify(X.decodeCoins(rawCoins)) === JSON.stringify(t.faces));
check('老记录没这一段也不炸', X.decodeCoins('').length === 0 && X.decodeCoins(undefined).length === 0);

console.log('');
if (failed) {
  console.log('有 ' + failed + ' 项没过');
  process.exit(1);
} else {
  console.log('全部通过');
}
