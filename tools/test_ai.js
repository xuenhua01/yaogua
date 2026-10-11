/* 跑法："D:\Tools\node\node.exe" tools\test_ai.js
   只测不碰网络的那部分：拼提示词、解 SSE、错误信息、配置与缓存。 */
const path = require('path');
const AI = require(path.join(__dirname, '..', 'ai.js'));

let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (extra === undefined ? '' : '  -> ' + extra));
  }
}

const input = {
  question: '两家公司都给了 offer，去哪家？',
  when: '2026年10月11日 10:20 星期六 丙午年 戊戌月 壬子日 乙巳时',
  ben: { num: 3, full: '水雷屯', upper: '坎', lower: '震', text: '元亨利贞，勿用有攸往，利建侯。', luckText: '平', plain: '万物初生，起步维艰。' },
  movingNames: '六三',
  movingYao: [{ t: '六三　即鹿无虞', p: '追鹿没有向导，不如先停下。' }],
  bian: { num: 8, full: '水地比', text: '吉。', plain: '亲比辅佐，宜与人结伴。' }
};

console.log('提示词：');
const msgs = AI.buildMessages(input);
check('两条消息，system 在前', msgs.length === 2 && msgs[0].role === 'system' && msgs[1].role === 'user');
check('system 里点了不许预言', AI.SYSTEM.indexOf('不谈预言') >= 0);
check('system 里点了不给专业结论', AI.SYSTEM.indexOf('专业的人') >= 0);
const q = msgs[1].content;
check('带上所问', q.indexOf('两家公司都给了 offer') >= 0);
check('带上本卦与卦辞', q.indexOf('第3卦 水雷屯') >= 0 && q.indexOf('元亨利贞') >= 0);
check('带上动爻的爻辞', q.indexOf('即鹿无虞') >= 0);
check('带上变卦', q.indexOf('第8卦 水地比') >= 0);
check('带上起卦时间', q.indexOf('丙午年') >= 0);

const quiet = AI.buildMessages({ ben: { num: 1, full: '乾为天', text: '元亨利贞。' }, movingYao: [] });
check('没写所问也能拼', quiet[1].content.indexOf('没细说') >= 0);
check('六爻安静时有交代', quiet[1].content.indexOf('六爻安静') >= 0);

console.log('SSE 拆包：');
const sse = new AI.SSEBuffer();
const whole = 'data: {"choices":[{"delta":{"content":"天"}}]}\n\ndata: {"choices":[{"delta":{"content":"机"}}]}\n\ndata: [DONE]\n\n';
let got = sse.push(whole).map(AI.deltaOf).join('');
check('整包能切开', got === '天机', got);

const sse2 = new AI.SSEBuffer();
let acc = '';
// 故意在行中间断开，模拟网络分片
const pieces = [
  'data: {"choices":[{"delta":{"con',
  'tent":"徐"}}]}\n',
  '\ndata: {"choices":[{"delta":{"content":"半仙"}}]}',
  '\n\ndata: [DONE]\n\n'
];
pieces.forEach(function (p) { acc += sse2.push(p).map(AI.deltaOf).join(''); });
check('半行会等着拼起来', acc === '徐半仙', acc);
check('半个 JSON 不硬解', AI.deltaOf('{"choices":[{"delta":{"con') === '');
check('非流式也能解读', AI.deltaOf('{"choices":[{"message":{"content":"完整一段"}}]}') === '完整一段');
check('空 choices 不炸', AI.deltaOf('{"choices":[]}') === '' && AI.deltaOf('not json') === '');
check('忽略注释行', new AI.SSEBuffer().push(': ping\n\ndata: {"choices":[{"delta":{"content":"a"}}]}\n').length === 1);

console.log('出错信息：');
check('401 说密钥', AI.friendly(401, '{"error":{"message":"invalid api key"}}').indexOf('密钥') >= 0);
check('404 说地址模型', AI.friendly(404, '{}').indexOf('模型名') >= 0);
check('429 说额度', AI.friendly(429, '{}').indexOf('额度') >= 0);
check('别的原样带出来', AI.friendly(500, 'boom').indexOf('500') >= 0);

console.log('配置与缓存：');
function fakeStore() {
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; }
  };
}
const store = fakeStore();
const cfg0 = AI.readCfg(store);
check('默认用免费那家', cfg0.preset === 'zhipu' && cfg0.base.indexOf('bigmodel') >= 0);
check('默认模型是官方标免费的那档',
  /free|flash/i.test(cfg0.model) &&
  AI.presetOf('zhipu').hint.indexOf('免费') >= 0 &&
  AI.presetOf('siliconflow').base.indexOf('siliconflow') >= 0);
check('豆包留着但标了要钱',
  AI.presetOf('doubao').label.indexOf('要花钱') >= 0 &&
  AI.presetOf('doubao').hint.indexOf('没有免费') >= 0);
check('默认没 key，不算就绪', AI.ready(cfg0) === false);
AI.writeCfg({ preset: 'zhipu', base: 'https://x/api/v4/', model: 'glm-4-flash', key: 'k1' }, store);
const cfg1 = AI.readCfg(store);
check('存了能读回来', cfg1.model === 'glm-4-flash' && AI.ready(cfg1) === true);
check('缺一项就不算就绪', AI.ready({ base: 'x', model: 'y', key: '' }) === false);
AI.clearCfg(store);
check('清掉后回到默认', AI.readCfg(store).key === '' && AI.readCfg(store).preset === 'zhipu');

check('缓存键跟着卦和所问走',
  AI.cacheKey(input) !== AI.cacheKey(Object.assign({}, input, { question: '换个问题' })) &&
  AI.cacheKey(input) === AI.cacheKey(Object.assign({}, input, { when: '别的时辰' })));
AI.cachePut(AI.cacheKey(input), '一段解读', store);
check('缓存能取回来', AI.cacheGet(AI.cacheKey(input), store) === '一段解读');
for (let i = 0; i < 60; i++) AI.cachePut('k' + i, 'v' + i, store);
const kept = JSON.parse(store.getItem('xg.ai.cache'));
check('缓存不会无限长', Object.keys(kept).length <= 40, Object.keys(kept).length);

console.log('');
console.log(failed ? failed + ' 项没过' : '全部通过');
process.exit(failed ? 1 : 0);
