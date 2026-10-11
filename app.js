/* 徐半仙算卦 · 网页版
   六十四个卦就是六十四个处境，起一卦当镜子照自己的事。
   数据在 data.js，由 Android 工程自动导出。 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  // ---------- 纯逻辑在 logic.js，这里接上就行 ----------
  var X = XGBuild(GUA, EXTRA);
  var findGua = X.findGua, byNum = X.byNum, extraOf = X.extraOf, hexOf = X.hexOf;
  var tend = X.tend, tendColor = X.tendColor, civil = X.civil, stamp = X.stamp;
  var movingNames = X.movingNames, tossAll = X.tossAll, bianOf = X.bianOf;

  // ---------- 半仙的嘴 ----------
  var VERDICT = {
    '大吉': '卦都这么给面子了，你自己别掉链子。',
    '吉': '路子是通的，剩下的靠腿。',
    '凶': '卦说了句实话，你别嫌难听。'
  };
  var ASIDE = [
    '铜钱有点滑，别急', '掐指一算，指头有点酸', '正在跟老天爷对表',
    '这一爻有点沉', '半仙的胡子抖了一下', '替天行道中，稍等',
    '别催，天机也在排队', '这枚铜钱转得有点久', '念念有词，其实在背卦辞',
    '别出声，怕惊着它'
  ];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function verdict(l) { return VERDICT[l] || '不好不坏，全看你怎么走。'; }

  // ---------- 卦象渲染 ----------
  function renderHex(box, lines, moving, revealed) {
    box.innerHTML = '';
    for (var i = 0; i < 6; i++) {
      var yao = document.createElement('div');
      yao.className = 'yao';
      if (lines[i] === 0) yao.className += ' yin';
      if (moving && moving[i]) yao.className += ' moving';
      yao.innerHTML = lines[i] === 1 ? '<i></i>' : '<i></i><i></i>';
      if (revealed === undefined || i < revealed) yao.className += ' show';
      box.appendChild(yao);
    }
  }
  function revealNext(box, n) {
    var kids = box.children;
    if (kids[n]) kids[n].className += ' show';
  }

  // ---------- 摇卦 ----------
  function buzz(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  function flipCoins(faces, done) {
    var els = Array.prototype.slice.call(document.querySelectorAll('#coins .coin'));
    var left = els.length;
    els.forEach(function (el, i) {
      var isBack = faces[i] === 2;
      el.classList.remove('flip');
      void el.offsetWidth;
      el.classList.add('flip');
      setTimeout(function () { el.classList.toggle('back', isBack); }, 205);
      setTimeout(function () {
        el.classList.remove('flip');
        if (--left === 0) done();
      }, 450);
    });
  }

  var tossing = false;
  var current = null;
  var curQuestion = '';
  var tossTime = null;

  function startToss() {
    if (tossing) return;
    tossing = true;
    stopSpeak();

    curQuestion = ($('question').value || '').trim();
    tossTime = new Date();
    var r = tossAll();

    $('btn-toss').disabled = true;
    $('btn-again').disabled = true;
    $('result').hidden = true;
    $('coins').hidden = false;
    $('status').hidden = false;
    $('status').textContent = '静心取象…';
    renderHex($('r-hex'), r.lines, r.moving, 0);
    buzz(28);

    var i = 0;
    (function next() {
      if (i >= 6) { showResult(r); return; }
      $('status').textContent = '取象中　第 ' + (i + 1) + ' 爻 · ' + pick(ASIDE);
      flipCoins(r.faces[i], function () {
        revealNext($('r-hex'), i);
        buzz(16);
        i++;
        setTimeout(next, 110);
      });
    })();
  }

  // ---------- 结果 ----------
  function showResult(r) {
    tossing = false;
    var lines = r.lines, moving = r.moving;
    var ben = findGua(lines);
    var bianLines = lines.map(function (v, i) { return moving[i] ? 1 - v : v; });
    var bian = moving.some(Boolean) ? findGua(bianLines) : null;

    current = { lines: lines, moving: moving, time: tossTime, question: curQuestion, ben: ben, bian: bian };

    $('coins').hidden = true;
    $('status').hidden = true;

    $('r-situation').textContent = curQuestion ? '眼下的境况：' + curQuestion : '眼下的境况：（心中默想）';
    $('r-time').textContent = '起卦时间　' + civil(tossTime) + '\n' + stamp(tossTime);
    $('r-moving').textContent = moving.some(Boolean)
      ? '关键在 ' + movingNames(lines, moving) + '　·　本卦是眼下的处境，变卦是照这条路走下去的样子'
      : '六爻安静 · 眼下没有明显的转折，照本卦的分寸来就好';

    $('r-name').textContent = '第 ' + ben.num + ' 卦　' + ben.full;
    $('r-luck').textContent = '此象：' + tend(ben.luck);
    $('r-luck').style.color = tendColor(ben.luck);
    $('r-quip').textContent = verdict(ben.luck);
    $('r-ci').textContent = '卦辞：' + ben.text;
    $('r-plain').textContent = ben.plain;

    if (bian) {
      $('bian-block').hidden = false;
      renderHex($('b-hex'), bianLines, null);
      $('b-name').textContent = '第 ' + bian.num + ' 卦　' + bian.full;
      $('b-luck').textContent = '此象：' + tend(bian.luck);
      $('b-luck').style.color = tendColor(bian.luck);
      $('b-ci').textContent = '卦辞：' + bian.text;
      $('b-plain').textContent = bian.plain;
    } else {
      $('bian-block').hidden = true;
    }

    $('result').hidden = false;
    $('btn-toss').disabled = false;
    $('btn-again').disabled = false;
    resultPanel.reset();
    saveRecord();
    setTimeout(function () {
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  // ---------- 详解 ----------
  function openDetail(num, ctx) {
    var gua = byNum(num);
    var lines = (ctx && ctx.lines) || hexOf(gua);
    var moving = (ctx && ctx.moving) || [false, false, false, false, false, false];
    var extra = extraOf(gua.name);
    var names = movingNames(lines, moving);

    detailCtx = {
      gua: gua, lines: lines, moving: moving,
      question: (ctx && ctx.question) || '',
      time: (ctx && ctx.time) || null
    };
    detailPanel.reset();

    $('d-title').textContent = '第 ' + gua.num + ' 卦　' + gua.full;
    var sub = '上卦 ' + gua.upper + '　下卦 ' + gua.lower;
    if (ctx && ctx.time) {
      sub += '\n起卦于 ' + civil(ctx.time) + '\n' + stamp(ctx.time);
    }
    if (ctx && ctx.question) sub += '\n眼下的境况：' + ctx.question;
    $('d-sub').textContent = sub;

    renderHex($('d-hex'), lines, moving);
    $('d-moving').textContent = names ? '关键在：' + names : '六爻安静 · 照本卦的分寸来';

    $('d-luck').textContent = '此象：' + tend(gua.luck);
    $('d-luck').style.color = tendColor(gua.luck);
    $('d-ci').textContent = '卦辞：' + gua.text;
    $('d-plain').textContent = gua.plain;

    if (names) {
      var bianLines = lines.map(function (v, i) { return moving[i] ? 1 - v : v; });
      var bian = findGua(bianLines);
      $('d-bian-block').hidden = false;
      renderHex($('d-bhex'), bianLines, null);
      $('d-bname').textContent = '第 ' + bian.num + ' 卦　' + bian.full;
      $('d-bluck').textContent = '此象：' + tend(bian.luck);
      $('d-bluck').style.color = tendColor(bian.luck);
      $('d-bci').textContent = '卦辞：' + bian.text;
      $('d-bplain').textContent = bian.plain;
      $('btn-bian-detail').onclick = function () { openDetail(bian.num, null); };
    } else {
      $('d-bian-block').hidden = true;
    }

    $('d-yao-hint').textContent = names ? '标红者即关键一步' : '六爻安静';
    var list = $('d-yao');
    list.innerHTML = '';
    extra.yao.forEach(function (y, i) {
      var item = document.createElement('div');
      item.className = 'yao-item' + (moving[i] ? ' moving' : '');
      var html = '<div class="t">第' + (i + 1) + '爻　' + y.t + '</div>';
      if (moving[i]) {
        html += '<div class="mark">动爻　' + (lines[i] === 1 ? '老阳变阴' : '老阴变阳') + '</div>';
      }
      html += '<div class="p">' + y.p + '</div>';
      item.innerHTML = html;
      list.appendChild(item);
    });
    $('d-story').textContent = extra.story;

    $('btn-speak-detail').onclick = function () {
      var s = '第' + gua.num + '卦，' + gua.full + '。卦辞：' + gua.text + gua.plain;
      extra.yao.forEach(function (y) { s += y.t + '。' + y.p; });
      if (names) {
        var bl = lines.map(function (v, i) { return moving[i] ? 1 - v : v; });
        var bg = findGua(bl);
        s += '变卦，第' + bg.num + '卦，' + bg.full + '。卦辞：' + bg.text + bg.plain;
      }
      s += '典故。' + extra.story;
      speak(s);
    };

    $('detail').hidden = false;
    $('detail').scrollTop = 0;
    detailOpen = true;
  }

  var detailOpen = false;
  var detailCtx = null;
  function closeDetail() {
    $('detail').hidden = true;
    detailOpen = false;
    stopSpeak();
  }

  // ---------- 朗读 ----------
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('这个浏览器不支持朗读'); return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }
  function stopSpeak() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  // ---------- 记录 ----------
  var REC_KEY = 'xg.records';
  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(REC_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveRecord() {
    if (!current) return;
    var list = loadRecords();
    list.unshift({
      t: current.time.getTime(),
      q: current.question,
      lines: current.lines,
      moving: current.moving,
      ben: current.ben.num,
      bian: current.bian ? current.bian.num : 0
    });
    while (list.length > 80) list.pop();
    try { localStorage.setItem(REC_KEY, JSON.stringify(list)); } catch (e) {}
    renderRecords();
  }
  function renderRecords() {
    var list = loadRecords();
    var ul = $('record-list');
    ul.innerHTML = '';
    $('records-empty').hidden = list.length > 0;
    $('btn-clear').hidden = list.length === 0;
    list.forEach(function (r) {
      var ben = byNum(r.ben), bian = r.bian ? byNum(r.bian) : null;
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="li-main">' +
        '<div class="li-time">' + civil(new Date(r.t)) + '　' + stamp(new Date(r.t)) + '</div>' +
        '<div class="li-title">' + (bian ? ben.full + '　→　' + bian.full : ben.full) + '</div>' +
        '<div class="li-sub">' + (r.q || '（未写所问）') + '</div>' +
        '</div>';
      li.onclick = function () {
        openDetail(r.ben, { time: new Date(r.t), question: r.q, lines: r.lines, moving: r.moving });
      };
      ul.appendChild(li);
    });
  }

  // ---------- 卦典 ----------
  function renderBook() {
    var ul = $('book-list');
    ul.innerHTML = '';
    GUA.forEach(function (g) {
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="li-num">' + g.num + '</div>' +
        '<div class="li-main">' +
        '<div class="li-title">' + g.name + '</div>' +
        '<div class="li-sub">' + g.full + '　上' + g.upper + ' 下' + g.lower + '</div>' +
        '</div>' +
        '<div class="li-tag" style="color:' + tendColor(g.luck) + '">' + tend(g.luck) + '</div>';
      li.onclick = function () { openDetail(g.num, null); };
      ul.appendChild(li);
    });
  }

  // ---------- 分享 / 提示 ----------
  function shareResult() {
    if (!current) return;
    var b = current.ben, s = '';
    if (current.question) s += '眼下的境况：' + current.question + '\n\n';
    s += '起卦时间：' + civil(current.time) + '\n' + stamp(current.time) + '\n\n';
    s += '【本卦】第' + b.num + '卦　' + b.full + '\n卦辞：' + b.text +
      '\n此象：' + tend(b.luck) + '\n' + b.plain + '\n';
    if (current.bian) {
      s += '\n【变卦】第' + current.bian.num + '卦　' + current.bian.full + '\n' +
        current.bian.plain + '\n';
    }
    s += '\n—— 徐半仙算卦（卦是老的，半仙是装的）';
    if (navigator.share) {
      navigator.share({ text: s }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(s).then(function () { toast('已复制到剪贴板'); });
    } else {
      toast('这个浏览器不支持分享');
    }
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(80px + env(safe-area-inset-bottom));' +
        'transform:translateX(-50%);background:rgba(0,0,0,.85);color:#EDE3D0;padding:10px 16px;' +
        'border-radius:10px;font-size:14px;z-index:99;pointer-events:none;opacity:0;transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = '0'; }, 1800);
  }

  // ---------- AI 细讲 ----------
  var AI = window.XGAI;

  /** 把一次起卦整理成给模型看的材料。 */
  function aiInput(gua, lines, moving, question, time) {
    if (!gua) return null;
    var names = movingNames(lines, moving);
    var extra = extraOf(gua.name);
    var yao = [];
    if (names) {
      for (var i = 0; i < 6; i++) {
        if (!moving[i]) continue;
        var y = extra.yao[i] || { t: '第' + (i + 1) + '爻', p: '' };
        yao.push({ t: y.t, p: y.p });
      }
    }
    var bianGua = names ? findGua(bianOf(lines, moving)) : null;
    return {
      question: question || '',
      when: time ? civil(time) + ' ' + stamp(time) : '',
      ben: {
        num: gua.num, full: gua.full, upper: gua.upper, lower: gua.lower,
        text: gua.text, luckText: tend(gua.luck), plain: gua.plain
      },
      movingNames: names,
      movingYao: yao,
      bian: bianGua
        ? { num: bianGua.num, full: bianGua.full, text: bianGua.text, plain: bianGua.plain }
        : null
    };
  }

  /** 挂一块「半仙细说」，ctxFn 负责说清眼下讲的是哪一卦。 */
  function makeAIPanel(mountId, ctxFn) {
    var box = $(mountId);
    if (!box) return { reset: function () {} };

    box.innerHTML =
      '<hr class="rule">' +
      '<h3 class="section-title">半 仙 细 说 · AI</h3>' +
      '<p class="hint">上面是简版。想听它对着你这件具体的事多说几句，点下面。</p>' +
      '<button class="btn ghost ai-go">细说一盘</button>' +
      '<div class="ai-out" hidden>' +
        '<p class="ai-text body-text"></p>' +
        '<div class="row">' +
          '<button class="btn ghost ai-copy">复制</button>' +
          '<button class="btn ghost ai-speak">念一遍</button>' +
          '<button class="btn ghost ai-redo">再说一遍</button>' +
        '</div>' +
        '<div class="ai-follow-row">' +
          '<input class="ai-follow" type="text" placeholder="还想追问一句…" spellcheck="false">' +
          '<button class="btn ghost ai-follow-go">问</button>' +
        '</div>' +
      '</div>' +
      '<p class="ai-note hint"></p>';

    var goBtn = box.querySelector('.ai-go');
    var outBox = box.querySelector('.ai-out');
    var textEl = box.querySelector('.ai-text');
    var noteEl = box.querySelector('.ai-note');
    var followEl = box.querySelector('.ai-follow');
    var followGo = box.querySelector('.ai-follow-go');
    var busy = false;
    var last = '';

    function note(msg, bad) {
      noteEl.textContent = msg || '';
      noteEl.className = 'ai-note hint' + (bad ? ' bad' : '');
    }
    function show(text) {
      last = text;
      outBox.hidden = false;
      textEl.textContent = text;
    }
    function reset() {
      if (busy) return;
      last = '';
      outBox.hidden = true;
      textEl.textContent = '';
      followEl.value = '';
      note('');
    }
    function run(followUp, force) {
      if (busy) return;
      var ctx = ctxFn();
      if (!ctx) return;
      var cfg = AI.readCfg();
      if (!AI.ready(cfg)) {
        toast('先去右上角「AI 设置」把 Key 填上');
        openAiCfg();
        return;
      }

      var cacheKey = AI.cacheKey(ctx);
      if (!followUp && !force) {
        var hit = AI.cacheGet(cacheKey);
        if (hit) {
          show(hit);
          note('这段是本机存过的，没再费额度。');
          return;
        }
      }

      var msgs = AI.buildMessages(ctx);
      if (followUp) {
        msgs.push({ role: 'assistant', content: last });
        msgs.push({ role: 'user', content: followUp });
      }

      busy = true;
      goBtn.disabled = true;
      followGo.disabled = true;
      show('');
      textEl.className = 'ai-text body-text busy';
      note(followUp ? '追问中…' : '半仙正在掐指，边想边写…');

      AI.chat(cfg, msgs, function (d) { textEl.textContent += d; })
        .then(function (full) {
          busy = false;
          goBtn.disabled = false;
          followGo.disabled = false;
          textEl.className = 'ai-text body-text';
          var text = (full || '').trim() || textEl.textContent.trim();
          if (!text) {
            show('');
            note('它一个字都没说，再点一次试试。', true);
            return;
          }
          show(text);
          if (followUp) {
            followEl.value = '';
            note('');
          } else {
            note('这段是接口现查的，不是卦书里的话，看着乐。');
            AI.cachePut(cacheKey, text);
          }
          outBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        })
        .catch(function (err) {
          busy = false;
          goBtn.disabled = false;
          followGo.disabled = false;
          textEl.className = 'ai-text body-text';
          note((err && err.message) || '没成，再试一次。', true);
        });
    }

    goBtn.onclick = function () { run('', false); };
    box.querySelector('.ai-redo').onclick = function () { run('', true); };
    box.querySelector('.ai-copy').onclick = function () {
      if (!last) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(last).then(function () { toast('复制好了'); },
          function () { toast('这个浏览器不让复制'); });
      } else {
        toast('这个浏览器不让复制');
      }
    };
    box.querySelector('.ai-speak').onclick = function () { if (last) speak(last); };
    followGo.onclick = function () {
      var q = followEl.value.trim();
      if (!q) { toast('问什么就写什么'); return; }
      run(q, false);
    };
    followEl.onkeydown = function (e) {
      if (e.key === 'Enter') followGo.onclick();
    };

    return { reset: reset };
  }

  // ---------- AI 设置 ----------
  var cfgSheet = $('ai-cfg');
  var cfgPreset = $('cfg-preset');
  var cfgBase = $('cfg-base');
  var cfgModel = $('cfg-model');
  var cfgKey = $('cfg-key');
  var cfgHint = $('cfg-preset-hint');
  var cfgStatus = $('cfg-status');

  AI.PRESETS.forEach(function (p) {
    var o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.label;
    cfgPreset.appendChild(o);
  });

  function cfgFromForm() {
    return {
      preset: cfgPreset.value,
      base: cfgBase.value.trim().replace(/\/+$/, ''),
      model: cfgModel.value.trim(),
      key: cfgKey.value.trim()
    };
  }

  function openAiCfg() {
    var cfg = AI.readCfg();
    cfgPreset.value = cfg.preset;
    cfgBase.value = cfg.base;
    cfgModel.value = cfg.model;
    cfgKey.value = cfg.key;
    cfgHint.textContent = AI.presetOf(cfg.preset).hint || '';
    cfgStatus.textContent = '';
    cfgStatus.className = 'hint';
    cfgSheet.hidden = false;
    cfgSheet.scrollTop = 0;
  }

  function closeAiCfg() { cfgSheet.hidden = true; }

  cfgPreset.onchange = function () {
    var p = AI.presetOf(cfgPreset.value);
    cfgHint.textContent = p.hint || '';
    if (p.base) cfgBase.value = p.base;
    if (p.model) cfgModel.value = p.model;
  };

  $('cfg-save').onclick = function () {
    var cfg = cfgFromForm();
    AI.writeCfg(cfg);
    cfgBase.value = cfg.base;
    cfgStatus.className = 'hint';
    cfgStatus.textContent = AI.ready(cfg)
      ? '存好了，可以去细说了。'
      : '存了，但地址 / 模型 / Key 还差一样，缺了没法用。';
    toast('存好了');
  };

  $('cfg-clear').onclick = function () {
    AI.clearCfg();
    cfgKey.value = '';
    cfgStatus.className = 'hint';
    cfgStatus.textContent = '密钥已经从这台设备上抹掉了。';
  };

  $('cfg-test').onclick = function () {
    var cfg = cfgFromForm();
    if (!AI.ready(cfg)) {
      cfgStatus.className = 'hint';
      cfgStatus.textContent = '三样都填上才能试。';
      return;
    }
    AI.writeCfg(cfg);
    var got = '';
    cfgStatus.className = 'hint';
    cfgStatus.textContent = '正在试…';
    AI.chat(cfg, [{ role: 'user', content: '用一句话说说《周易》屯卦讲的是什么。' }],
      function (d) {
        got += d;
        cfgStatus.textContent = '通了：' + got;
      })
      .then(function (full) {
        cfgStatus.textContent = '通了：' + ((full || '').trim() || got);
      })
      .catch(function (err) {
        cfgStatus.className = 'hint bad';
        cfgStatus.textContent = (err && err.message) || '没通，检查一下地址和 Key。';
      });
  };

  $('btn-ai-cfg').onclick = openAiCfg;
  $('btn-cfg-back').onclick = closeAiCfg;

  var resultPanel = makeAIPanel('ai-mount-result', function () {
    return current
      ? aiInput(current.ben, current.lines, current.moving, current.question, current.time)
      : null;
  });
  var detailPanel = makeAIPanel('ai-mount-detail', function () {
    return detailCtx
      ? aiInput(detailCtx.gua, detailCtx.lines, detailCtx.moving, detailCtx.question, detailCtx.time)
      : null;
  });

  // ---------- 页签 ----------
  function switchView(id) {
    ['view-shake', 'view-book', 'view-records'].forEach(function (v) {
      $(v).hidden = (v !== id);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('active', t.dataset.view === id);
    });
    if (id === 'view-records') renderRecords();
    if (id === 'view-book') window.scrollTo(0, 0);
  }

  // ---------- 初始化 ----------
  $('btn-toss').onclick = startToss;
  $('btn-again').onclick = startToss;
  $('btn-detail').onclick = function () {
    if (!current) return;
    openDetail(current.ben.num, {
      time: current.time, question: current.question,
      lines: current.lines, moving: current.moving
    });
  };
  $('btn-share').onclick = shareResult;
  $('btn-speak').onclick = function () {
    if (!current) return;
    var b = current.ben, s = '';
    if (current.question) s += '眼下的境况：' + current.question + '。';
    s += '本卦，第' + b.num + '卦，' + b.full + '。卦辞：' + b.text +
      '此象：' + tend(b.luck) + '。' + b.plain;
    if (current.bian) {
      s += '变卦，第' + current.bian.num + '卦，' + current.bian.full + '。' + current.bian.plain;
    }
    speak(s);
  };
  $('btn-back').onclick = closeDetail;
  $('btn-close-detail').onclick = closeDetail;
  $('btn-clear').onclick = function () {
    if (confirm('这一清，前尘往事可就都没了。确定？')) {
      try { localStorage.removeItem(REC_KEY); } catch (e) {}
      renderRecords();
    }
  };
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.onclick = function () { switchView(t.dataset.view); };
  });

  renderBook();
  renderRecords();
  switchView('view-shake');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
