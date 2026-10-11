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
