/* 徐半仙 AI 细讲：把卦象和你所问交给大模型，现场生成一段更细的解读。

   走的是 OpenAI 兼容接口（豆包/火山方舟、智谱、DeepSeek 都是这个格式）：
     POST {base}/chat/completions
     Authorization: Bearer <key>

   键只存在这台设备的 localStorage 里，不进代码、不上传。
   纯逻辑部分（拼提示词、解 SSE）不碰 DOM，Node 里能直接跑测试。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XGAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CFG_KEY = 'xg.ai.cfg';
  var CACHE_KEY = 'xg.ai.cache';
  var CACHE_MAX = 40;

  // ---------- 常见几家，填个默认值省事 ----------
  var PRESETS = [
    {
      id: 'zhipu', label: '智谱 GLM-4-Flash（免费，推荐）',
      base: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4.7-flash',
      hint: '免费的：智谱官网写明 GLM-4.7-Flash、GLM-4.5-Flash、GLM-4-Flash-250414 ' +
        '都是免费文本模型，注册 + 实名就能用，不用充钱。报“模型不存在”就把模型名' +
        '换成后面那两个里的一个。'
    },
    {
      id: 'siliconflow', label: '硅基流动（有免费小模型）',
      base: 'https://api.siliconflow.cn/v1',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      hint: '注册送额度，模型广场里有标着「免费」的小模型，把名字整条填进模型名那一栏就行。' +
        '免费的一般是 7B 一档，够说一段卦解了。'
    },
    {
      id: 'doubao', label: '豆包 · 火山方舟（要花钱）',
      base: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-seed-1-6-250615',
      hint: '豆包没有免费额度这一说，新号送一点，用完就按量计费。' +
        '只想白嫖就别选它。另外控制台里得先把模型「开通」，报模型不存在时' +
        '换成你建的接入点 ID（ep- 开头）。'
    },
    {
      id: 'custom', label: '自定义（任何 OpenAI 兼容接口）',
      base: '', model: '',
      hint: '地址写到 /v4 或 /v1 这一层就行，后面会自动接 /chat/completions。' +
        '硅基流动、DeepSeek 这些也是这个填法。'
    }
  ];

  function presetOf(id) {
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id === id) return PRESETS[i];
    }
    return PRESETS[0];
  }

  // ---------- 配置存取 ----------
  function readCfg(store) {
    store = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    var cfg = { preset: PRESETS[0].id, base: PRESETS[0].base, model: PRESETS[0].model, key: '' };
    if (!store) return cfg;
    try {
      var raw = JSON.parse(store.getItem(CFG_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        if (raw.preset) cfg.preset = String(raw.preset);
        if (typeof raw.base === 'string') cfg.base = raw.base;
        if (typeof raw.model === 'string') cfg.model = raw.model;
        if (typeof raw.key === 'string') cfg.key = raw.key;
      }
    } catch (e) {}
    return cfg;
  }

  function writeCfg(cfg, store) {
    store = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    try { store.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function clearCfg(store) {
    store = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    try { store.removeItem(CFG_KEY); } catch (e) {}
  }

  /** 能不能直接调：地址、模型、键三样都得有。 */
  function ready(cfg) {
    return !!(cfg && cfg.base && cfg.model && cfg.key);
  }

  // ---------- 拼提示词（纯函数，方便测） ----------
  var SYSTEM = [
    '你是「徐半仙」，一个说书的，熟读《周易》六十四卦。',
    '用户摇了一卦，也说了自己眼下的事。卦象和一条粗解已经给你了，你要说一段更细、更贴着他的解读。',
    '',
    '要求：',
    '1. 说人话。别端着，别背书，别把卦辞原文抄一遍糊弄人。可以用比喻，一两处就够。',
    '2. 不谈预言。不说“命中注定”“必然会”，只讲眼下的处境、时机和该怎么走。',
    '3. 结构：先用一两句说他眼下是什么处境；再说这一卦在提醒什么（有动爻就点动爻，有变卦就点变卦）；然后给三条落得到地上的具体做法；最后点一个最容易踩的坑。',
    '4. 分段写，四段，每段两三句，一共 350 到 550 字。不要 markdown 标题，不要列表符号，不要 emoji。',
    '5. 称呼用“你”。语气像个见过世面的老大人——稳、干净，偶尔幽默一下，但不油。',
    '6. 如果问的是身体、法律、投资这类事，只给思路和该警惕的地方，不给结论，并提醒他找专业的人。'
  ].join('\n');

  function line(label, value) {
    return value ? '【' + label + '】' + value : '';
  }

  /** 把一次起卦压成一条给模型看的事実清单。 */
  function buildQuestion(input) {
    var ben = input.ben || {};
    var parts = [];

    parts.push(line('所问', input.question || '（他没细说，只说想理一理眼下的事）'));
    if (input.when) parts.push(line('起卦时间', input.when));

    var benHead = '第' + ben.num + '卦 ' + ben.full;
    if (ben.upper && ben.lower) benHead += '（上' + ben.upper + '，下' + ben.lower + '）';
    if (ben.luckText) benHead += '，此象「' + ben.luckText + '」';
    parts.push(line('本卦', benHead));
    parts.push('卦辞：' + (ben.text || ''));
    if (ben.plain) parts.push('现成的粗解：' + ben.plain);

    var yao = input.movingYao || [];
    if (yao.length) {
      var y = yao.map(function (v) { return v.t + '——' + v.p; }).join('\n');
      parts.push(line('动爻', input.movingNames || ''));
      parts.push('动爻的爻辞：\n' + y);
    } else {
      parts.push(line('动爻', '六爻安静，没有动爻'));
    }

    if (input.bian) {
      var b = input.bian;
      parts.push(line('变卦', '第' + b.num + '卦 ' + b.full + '。卦辞：' + (b.text || '')));
      if (b.plain) parts.push('变卦的粗解：' + b.plain);
    }

    parts.push('');
    parts.push('照着这些说一段给我。');
    return parts.filter(function (p) { return p !== ''; }).join('\n');
  }

  function buildMessages(input) {
    return [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildQuestion(input) }
    ];
  }

  /** 缓存键：卦、动爻、所问，三样一样就复用。 */
  function cacheKey(input) {
    var q = (input.question || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return [input.ben && input.ben.num, input.bian ? input.bian.num : 0,
      (input.movingNames || '') , q].join('|');
  }

  function cacheGet(key, store) {
    store = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return '';
    try {
      var all = JSON.parse(store.getItem(CACHE_KEY) || '{}');
      return all[key] || '';
    } catch (e) {
      return '';
    }
  }

  function cachePut(key, text, store) {
    store = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store || !text) return;
    try {
      var all = JSON.parse(store.getItem(CACHE_KEY) || '{}');
      all[key] = text;
      var keys = Object.keys(all);
      while (keys.length > CACHE_MAX) {
        delete all[keys.shift()];
      }
      store.setItem(CACHE_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  // ---------- SSE 拆包（纯函数，方便测） ----------
  function SSEBuffer() { this.buf = ''; }

  /** 喂一段文本，吐出这一批完整的 data: 载荷。半行留着等下一段。 */
  SSEBuffer.prototype.push = function (text) {
    this.buf += text;
    var out = [], idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      var raw = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      raw = raw.replace(/\r$/, '');
      if (raw.indexOf('data:') !== 0) continue;
      var payload = raw.slice(5).trim();
      if (payload && payload !== '[DONE]') out.push(payload);
    }
    return out;
  };

  /** 从一段 SSE 载荷里抠出这一跳的新增文字。 */
  function deltaOf(payload) {
    try {
      var o = JSON.parse(payload);
      if (!o.choices || !o.choices.length) return '';
      var c = o.choices[0];
      if (c.delta && typeof c.delta.content === 'string') return c.delta.content;
      if (c.message && typeof c.message.content === 'string') return c.message.content;
      if (typeof c.text === 'string') return c.text;
      return '';
    } catch (e) {
      return '';
    }
  }

  // ---------- 出错时说人话 ----------
  function friendly(status, body) {
    var detail = '';
    try {
      var o = JSON.parse(body);
      detail = (o.error && (o.error.message || o.error.code)) || o.message || '';
    } catch (e) {
      detail = (body || '').slice(0, 120);
    }
    if (status === 401 || status === 403) return '密钥不对，或者这个模型没开通。（' + detail + '）';
    if (status === 404) return '地址或模型名不对，检查一下接口地址和模型名。（' + detail + '）';
    if (status === 429) return '调用太频或者额度用完了，等会儿再试。（' + detail + '）';
    return '接口返回 ' + status + '：' + detail;
  }

  /**
   * 发一次请求。边收边把新增的文字交给 onDelta。
   * 返回整段文字；出错抛中文消息。
   */
  function chat(cfg, messages, onDelta, opts) {
    opts = opts || {};
    var url = String(cfg.base || '').replace(/\/+$/, '') + '/chat/completions';
    var body = {
      model: cfg.model,
      messages: messages,
      stream: true,
      temperature: 0.85,
      max_tokens: opts.maxTokens || 1200
    };

    var ctrl = null, timer = null;
    if (typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      timer = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 90000);
    }

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) { throw new Error(friendly(res.status, t)); });
      }
      var ct = res.headers.get('content-type') || '';
      // 有的服务不理 stream，直接回一整包 JSON
      if (!res.body || ct.indexOf('event-stream') < 0) {
        return res.json().then(function (j) {
          var s = j && j.choices && j.choices[0] &&
            ((j.choices[0].message && j.choices[0].message.content) || '') || '';
          if (s && onDelta) onDelta(s);
          return s;
        });
      }
      var reader = res.body.getReader();
      var dec = new TextDecoder('utf-8');
      var sse = new SSEBuffer();
      var acc = '';
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return acc;
          var chunks = sse.push(dec.decode(r.value, { stream: true }));
          for (var i = 0; i < chunks.length; i++) {
            var d = deltaOf(chunks[i]);
            if (d) {
              acc += d;
              if (onDelta) onDelta(d);
            }
          }
          return pump();
        });
      })();
    }).catch(function (e) {
      if (e && e.name === 'AbortError') throw new Error('等太久了，先不说了，再点一次试试。');
      if (e && e instanceof Error && e.message && e.message.indexOf('接口') >= 0) throw e;
      if (e && e instanceof Error && /密钥|地址|模型|调用|额度/.test(e.message)) throw e;
      throw new Error('连不上接口。检查网络，或者确认这个接口允许网页直接调。');
    }).then(function (text) {
      if (timer) clearTimeout(timer);
      return text;
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  return {
    PRESETS: PRESETS, presetOf: presetOf,
    readCfg: readCfg, writeCfg: writeCfg, clearCfg: clearCfg, ready: ready,
    SYSTEM: SYSTEM,
    buildQuestion: buildQuestion, buildMessages: buildMessages,
    cacheKey: cacheKey, cacheGet: cacheGet, cachePut: cachePut,
    SSEBuffer: SSEBuffer, deltaOf: deltaOf,
    friendly: friendly, chat: chat
  };
});
