/* Yappu web edition — offline-friendly English trainer.
   Author: Chao Wang (Bellary) · 非正式商用版 · v0.4.1 */
(function () {
  'use strict';
  var C = window.__COURSE__;
  var KEY = 'yappu-web-v1';
  var W = {};
  C.words.forEach(function (w) { W[w.lemma] = w; });

  var TABS = ['learn', 'practice', 'league', 'tasks', 'me'];
  var TAB_NAMES = { learn: '学习', practice: '练习', league: '联赛', tasks: '任务', me: '我' };
  var ACH = [
    { id: 'a1', e: '🐣', n: '第一课', d: '完成第 1 课', f: function (s) { return s.lessons >= 1; } },
    { id: 'a2', e: '🔥', n: '三天不落', d: '连续学习 3 天', f: function (s) { return s.streak >= 3; } },
    { id: 'a3', e: '🔥', n: '七日连胜', d: '连续学习 7 天', f: function (s) { return s.streak >= 7; } },
    { id: 'a4', e: '🏅', n: '30 天', d: '连续学习 30 天', f: function (s) { return s.streak >= 30; } },
    { id: 'a5', e: '📚', n: '完成 10 课', d: '累计完成 10 课', f: function (s) { return s.lessons >= 10; } },
    { id: 'a6', e: '📚', n: '完成 20 课', d: '累计完成 20 课', f: function (s) { return s.lessons >= 20; } },
    { id: 'a7', e: '🧠', n: '认识 30 词', d: '学过 30 个单词', f: function (s) { return s.wordsLearned >= 30; } },
    { id: 'a8', e: '💯', n: '全对一课', d: '一节课全部答对', f: function (s) { return s.perfect >= 1; } },
    { id: 'a9', e: '⭐', n: '500 XP', d: '累计 500 XP', f: function (s) { return s.xp >= 500; } },
    { id: 'a10', e: '🌟', n: '1500 XP', d: '累计 1500 XP', f: function (s) { return s.xp >= 1500; } }
  ];

  var S = load();

  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function dayNum() { return Math.floor(Date.now() / 86400000); }

  function load() {
    var def = { xp: 0, gems: 0, streak: 0, lastStudy: null, done: {}, words: {},
      daily: { day: '', lessons: 0, xp: 0, reviews: 0, chest: false },
      week: { key: weekKey(), xp: 0 }, perfect: 0, settings: { tts: true } };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return def;
      var s = JSON.parse(raw);
      for (var k in def) if (s[k] === undefined) s[k] = def[k];
      if (s.daily.day !== todayKey()) s.daily = def.daily;
      if (s.week.key !== weekKey()) s.week = { key: weekKey(), xp: 0 };
      return s;
    } catch (e) { return def; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function weekKey() {
    var d = new Date(); var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-' + Math.ceil(((t - y) / 86400000 + 1) / 7);
  }

  function stats() {
    var lessons = Object.keys(S.done).length;
    var wordsLearned = Object.keys(S.words).filter(function (k) { return S.words[k].seen > 0; }).length;
    return { lessons: lessons, wordsLearned: wordsLearned, xp: S.xp, streak: S.streak, perfect: S.perfect };
  }
  function addXp(n) {
    S.xp += n; S.daily.xp += n; S.week.xp += n;
    var t = todayKey();
    if (S.lastStudy !== t) {
      var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      S.streak = S.lastStudy === y ? S.streak + 1 : 1;
      S.lastStudy = t;
    }
    save();
  }
  function touchWord(id, ok) {
    var lemma = id.replace(/^w:/, '');
    var r = S.words[lemma] || (S.words[lemma] = { seen: 0, right: 0, wrong: 0, due: 0, box: 0 });
    r.seen++;
    if (ok) { r.right++; r.box = Math.min(5, r.box + 1); } else { r.wrong++; r.box = 0; }
    var gap = [1, 1, 2, 4, 7, 15][r.box] || 1;
    r.due = dayNum() + (ok ? gap : 0);
    save();
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function $(sel) { return document.querySelector(sel); }

  /* ---------------- speech ---------------- */
  var voice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices() || [];
    voice = vs.filter(function (v) { return /^en(-|_)?/i.test(v.lang); })[0] || vs[0] || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!S.settings.tts || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.85;
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------------- shell ---------------- */
  function renderHeader() {
    $('#p-streak').textContent = S.streak;
    $('#p-gems').textContent = S.gems;
    $('#p-xp').textContent = S.xp;
  }

  var tab = 'learn';
  function render() {
    renderHeader();
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    var v = $('#view');
    if (tab === 'learn') v.innerHTML = viewLearn();
    if (tab === 'practice') v.innerHTML = viewPractice();
    if (tab === 'league') v.innerHTML = viewLeague();
    if (tab === 'tasks') v.innerHTML = viewTasks();
    if (tab === 'me') v.innerHTML = viewMe();
    bindView();
  }

  document.getElementById('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  });

  /* ---------------- learn ---------------- */
  function unitDone(u) { return u.lessons.filter(function (l) { return S.done[l.id]; }).length; }
  function unitUnlocked(i) {
    if (i === 0) return true;
    var prev = C.units[i - 1];
    return unitDone(prev) === prev.lessons.length;
  }
  function lessonUnlocked(ui, li) {
    if (!unitUnlocked(ui)) return false;
    if (li === 0) return true;
    return !!S.done[C.units[ui].lessons[li - 1].id];
  }

  function viewLearn() {
    var goal = 40, todayXp = S.daily.xp;
    var h = '<h2 style="margin-top:4px">今日目标</h2>' +
      '<div class="card"><div class="goal"><span class="big">🎯 每日目标</span>' +
      '<span class="num">' + Math.min(todayXp, goal) + ' / ' + goal + ' XP</span></div>' +
      '<div class="bar"><i style="width:' + Math.min(100, todayXp / goal * 100) + '%"></i></div></div>';
    var lastCefr = null;
    C.units.forEach(function (u, ui) {
      if (u.cefr !== lastCefr) {
        var names = { A1: '入门', A2: '进阶', B1: '中级', B2: '高级' };
        h += '<div class="stage">' + u.cefr + ' · ' + (names[u.cefr] || '') + '</div>';
        lastCefr = u.cefr;
      }
      var done = unitDone(u), total = u.lessons.length, unlocked = unitUnlocked(ui);
      h += '<div class="unit" style="' + (unlocked ? '' : 'opacity:.55') + '">' +
        '<span class="tag">第 ' + (ui + 1) + ' 单元</span>' +
        '<div class="row"><span class="us">' + done + ' / ' + total + '</span></div>' +
        '<h3>' + esc(u.title) + '</h3><div class="us">' + esc(u.subtitle) + '</div>' +
        '<div class="gram">📖 ' + esc(u.grammar.title) + '</div></div>';
      if (unlocked) {
        u.lessons.forEach(function (l, li) {
          var ok = lessonUnlocked(ui, li), isDone = !!S.done[l.id];
          h += '<button class="lessonbtn ' + (ok ? '' : 'lock') + '" data-lesson="' + l.id + '" ' + (ok ? '' : 'disabled') + '>' +
            '<span class="ic">' + (isDone ? '✓' : (ok ? '▶' : '🔒')) + '</span>' +
            '<span class="t">' + esc(l.title) + '<span class="s"> ' + l.wordIds.length + ' 个词 · ' + (isDone ? '已完成' : (ok ? '开始' : '先完成前面的课程')) + '</span></span></button>';
        });
      }
    });
    return h;
  }

  /* ---------------- practice ---------------- */
  function dueWords() {
    var d = dayNum();
    return Object.keys(S.words).filter(function (k) { return S.words[k].seen > 0 && S.words[k].due <= d; });
  }
  function viewPractice() {
    var due = dueWords();
    var learned = Object.keys(S.words).filter(function (k) { return S.words[k].seen > 0; });
    var wrong = Object.keys(S.words).filter(function (k) { return S.words[k].wrong > 0; });
    var h = '<h1>练习</h1><p class="sub">把学过的词真正记住</p>' +
      '<div class="bigcard"><div style="font-size:34px">🔁</div><h2>到期复习</h2>' +
      '<p>' + (due.length ? due.length + ' 个词到了该复习的时候' : '今天没有要复习的，去学一课吧') + '</p>' +
      '<div style="height:14px"></div>' +
      '<button class="btn ghost" data-review="1" ' + (due.length ? '' : 'disabled style="opacity:.5"') + '>开始复习</button></div>' +
      '<div class="grid2"><div class="stat"><div style="font-size:22px">📕</div><b>' + learned.length + '</b><span>生词本</span></div>' +
      '<div class="stat"><div style="font-size:22px">✖️</div><b>' + wrong.length + '</b><span>错题</span></div></div>' +
      '<h2>单词表</h2>';
    var list = learned.slice(0, 60);
    if (!list.length) h += '<p class="muted">还没有学过的词，先去学一课。</p>';
    list.forEach(function (k) {
      var w = W[k]; if (!w) return;
      h += '<div class="rowline"><span class="l">' + esc(w.lemma) + ' <span class="muted" style="font-weight:400">' + esc(w.ipa || '') + '</span></span><span class="r">' + esc(w.zh) + '</span></div>';
    });
    return h;
  }

  /* ---------------- league ---------------- */
  function ghosts() {
    var seed = parseInt(S.week.key.replace('-', ''), 10) || 1;
    var names = ['Eli', 'Luna', 'Ada', 'Nina', 'Leo', 'Finn', 'Noah'];
    return names.map(function (n, i) {
      var r = Math.abs(Math.sin(seed + i * 7.3)) * 180 + 80;
      return { name: n, xp: Math.round(r / 3) * 3 };
    });
  }
  function viewLeague() {
    var rows = ghosts().concat([{ name: '我', xp: S.week.xp, me: true }]);
    rows.sort(function (a, b) { return b.xp - a.xp; });
    var myRank = rows.findIndex(function (r) { return r.me; }) + 1;
    var h = '<h1>青铜联赛</h1><p class="sub">前 7 名升级 · 后 5 名降级 · 每周一刷新</p>' +
      '<div class="card" style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><div class="muted" style="font-size:12px">我的排名</div><div style="font-size:34px;font-weight:800">第 ' + myRank + ' 名</div></div>' +
      '<div style="text-align:right"><div class="muted" style="font-size:12px">本周 XP</div><div style="font-size:30px;font-weight:800">' + S.week.xp + '</div></div></div>' +
      '<div style="height:10px"></div>';
    rows.forEach(function (r, i) {
      h += '<div class="lb ' + (r.me ? 'me' : '') + '"><div class="rank">' + (i + 1) + '</div>' +
        '<div class="av">' + esc(r.name[0]) + '</div><div class="nm">' + esc(r.name) + '</div>' +
        '<div class="xp">' + r.xp + ' XP</div></div>';
      if (i === 6) h += '<div class="divider">升级区 · 前 7 名</div>';
    });
    return h + '<p class="muted" style="font-size:12px">对手来自本地模拟（Ghost League），不涉及任何真实用户数据。</p>';
  }

  /* ---------------- tasks ---------------- */
  function viewTasks() {
    var d = S.daily;
    var tasks = [
      { n: '完成 2 节课', cur: d.lessons, max: 2 },
      { n: '获得 40 XP', cur: d.xp, max: 40 },
      { n: '复习 6 个词', cur: d.reviews, max: 6 }
    ];
    var doneCount = tasks.filter(function (t) { return t.cur >= t.max; }).length;
    var h = '<h1>今日任务</h1><p class="sub">完成 3 个任务可开启宝箱</p>';
    tasks.forEach(function (t) {
      h += '<div class="card" style="margin-bottom:12px"><div class="goal"><span class="big">' + t.n + '</span>' +
        '<span class="num">' + Math.min(t.cur, t.max) + ' / ' + t.max + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.min(100, t.cur / t.max * 100) + '%"></i></div></div>';
    });
    h += '<div class="card" style="text-align:center;margin-top:16px">' +
      '<div style="font-size:52px">' + (S.daily.chest ? '🎁' : (doneCount === 3 ? '🎁' : '🔒')) + '</div>' +
      '<h2 style="margin:10px 0 6px">' + (S.daily.chest ? '宝箱已开启' : '宝箱还锁着') + '</h2>' +
      '<p class="muted">完成后 +30 💎</p>' +
      '<button class="btn wide" data-chest="1" ' + (doneCount === 3 && !S.daily.chest ? '' : 'disabled style="opacity:.5"') + '>' +
      (S.daily.chest ? '明天再来' : '打开宝箱') + '</button></div>';
    return h;
  }

  /* ---------------- me ---------------- */
  function viewMe() {
    var st = stats();
    var h = '<h1>我</h1><p class="sub">所有数据都只存在这台设备上</p>' +
      '<div class="card" style="display:flex;align-items:center;gap:16px">' +
      '<div style="width:74px;height:74px;border-radius:50%;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800">Y</div>' +
      '<div><div style="font-size:26px;font-weight:800">学习者</div>' +
      '<div class="muted">已学习 ' + st.lessons + ' 课 · 最长连胜 ' + st.streak + ' 天</div></div></div>' +
      '<div class="grid2" style="margin-top:12px">' +
      '<div class="stat"><div>⚡</div><b>' + st.xp + '</b><span>总 XP</span></div>' +
      '<div class="stat"><div>🔥</div><b>' + st.streak + '</b><span>当前连胜</span></div>' +
      '<div class="stat" style="margin-top:12px"><div>📖</div><b>' + st.wordsLearned + '</b><span>学过的词</span></div>' +
      '<div class="stat" style="margin-top:12px"><div>✅</div><b>' + st.lessons + '</b><span>完成课时</span></div></div>' +
      '<h2>成就</h2>';
    ACH.forEach(function (a) {
      var on = a.f(st);
      h += '<div class="ach ' + (on ? 'on' : '') + '"><div class="e">' + a.e + '</div><div><div class="n">' + a.n + '</div><div class="d">' + a.d + '</div></div></div>';
    });
    h += '<h2>设置</h2><div class="card">' +
      '<div class="rowline"><span class="l">朗读来源</span><span class="r">' + (S.settings.tts ? '系统语音引擎' : '已关闭') + '</span></div>' +
      '<div class="rowline"><span class="l">音效与朗读</span><button class="btn ghost" data-tts="1" style="padding:8px 14px;font-size:14px">' + (S.settings.tts ? '关闭' : '开启') + '</button></div>' +
      '<div class="rowline"><span class="l">清除学习数据</span><button class="btn ghost" data-clear="1" style="padding:8px 14px;font-size:14px;color:#d9534f">清除</button></div>' +
      '</div><p class="muted" style="font-size:12px;margin-top:18px">Yappu 0.4.1 · Chao Wang（Bellary）· 非正式商用版<br>内容全部离线可用 · 不上传任何数据</p>';
    return h;
  }

  /* ---------------- bindings ---------------- */
  function bindView() {
    document.querySelectorAll('[data-lesson]').forEach(function (b) {
      b.onclick = function () { if (!b.disabled) startLesson(b.dataset.lesson); };
    });
    var rev = $('[data-review]');
    if (rev) rev.onclick = function () { startReview(); };
    var chest = $('[data-chest]');
    if (chest) chest.onclick = function () { S.daily.chest = true; S.gems += 30; save(); render(); };
    var tts = $('[data-tts]');
    if (tts) tts.onclick = function () { S.settings.tts = !S.settings.tts; save(); render(); };
    var clr = $('[data-clear]');
    if (clr) clr.onclick = function () {
      if (confirm('再点一次「清除」会清空全部学习记录，确定吗？')) {
        localStorage.removeItem(KEY); S = load(); render();
      }
    };
  }

  /* ---------------- lesson player ---------------- */
  var L = null;
  var lessonEl = $('#lesson');

  function findLesson(id) {
    for (var i = 0; i < C.units.length; i++)
      for (var j = 0; j < C.units[i].lessons.length; j++)
        if (C.units[i].lessons[j].id === id) return { u: i, l: j, lesson: C.units[i].lessons[j] };
    return null;
  }

  function startLesson(id) {
    var found = findLesson(id);
    if (!found) return;
    L = { lesson: found.lesson, unit: found.u, queue: found.lesson.exercises.slice(),
      i: 0, xp: 0, right: 0, wrong: 0, mode: 'lesson', checked: false, sel: null,
      wb: [], matched: [] };
    lessonEl.classList.remove('hidden');
    renderExercise();
  }

  function startReview() {
    var due = dueWords();
    if (!due.length) return;
    var qs = [];
    due.slice(0, 10).forEach(function (k, i) {
      var w = W[k]; if (!w) return;
      var others = C.words.filter(function (x) { return x.lemma !== k; });
      var pool = others.sort(function () { return Math.random() - 0.5; }).slice(0, 3).map(function (x) { return x.lemma; });
      var opts = pool.concat([k]).sort(function () { return Math.random() - 0.5; });
      qs.push({ type: 'choice', prompt: '选择正确的英文', stem: w.zh, stemLang: 'zh',
        options: opts, answer: opts.indexOf(k), wordIds: ['w:' + k], tags: ['VOCAB'], id: 'rv-' + i });
    });
    L = { lesson: { id: 'review', title: '到期复习' }, queue: qs, i: 0, xp: 0, right: 0,
      wrong: 0, mode: 'review', checked: false, sel: null, wb: [], matched: [] };
    lessonEl.classList.remove('hidden');
    renderExercise();
  }

  function closeLesson() {
    lessonEl.classList.add('hidden');
    lessonEl.innerHTML = '';
    L = null;
    render();
  }

  function playAudio(word) {
    if (word) speak(word);
  }

  function renderExercise() {
    if (!L) return;
    if (L.i >= L.queue.length) return renderSummary();
    var ex = L.queue[L.i];
    var pct = Math.round(L.i / L.queue.length * 100);
    var h = '<div class="lhead"><button class="x" data-close="1">✕</button>' +
      '<div class="lbar"><i style="width:' + pct + '%"></i></div>' +
      '<span class="muted" style="font-size:13px">' + (L.i + 1) + '/' + L.queue.length + '</span></div>' +
      '<div class="lbody" id="lbody"></div><div class="lfoot" id="lfoot"></div>';
    lessonEl.innerHTML = h;
    lessonEl.querySelector('[data-close]').onclick = closeLesson;
    renderBody(ex);
  }

  function renderBody(ex) {
    var body = document.getElementById('lbody');
    var foot = document.getElementById('lfoot');
    var h = '';
    if (ex.type === 'match') {
      h += '<h2>' + esc(ex.prompt) + '</h2><div class="match" id="match"></div>';
      body.innerHTML = h;
      renderMatch(ex);
      foot.innerHTML = '';
      return;
    }
    h += '<h2>' + esc(ex.prompt) + '</h2>';
    if (ex.type === 'listen') {
      h += '<button class="audio" data-play="1">🔊 <span>点击播放</span></button>';
    }
    if (ex.type === 'fill') {
      h += '<div class="stem small">' + esc(ex.sentence) + '</div>' +
        '<div class="muted" style="margin-bottom:8px">' + esc(ex.sentenceZh || '') + '</div>';
    } else if (ex.type === 'wordbank') {
      h += '<div class="muted">' + esc(ex.sentenceZh || '') + '</div><div id="wbbox"></div>';
    } else if (ex.stem) {
      h += '<div class="stem">' + esc(ex.stem) + '</div>';
    }
    if (ex.type === 'wordbank') {
      body.innerHTML = h;
      L.wb = [];
      renderWordbank(ex);
    } else {
      h += '<div id="opts"></div>';
      body.innerHTML = h;
      var opts = document.getElementById('opts');
      ex.options.forEach(function (o, i) {
        var b = el('<button class="opt">' + esc(o) + '</button>');
        b.onclick = function () { if (L.checked) return; L.sel = i; renderSelection(ex); };
        opts.appendChild(b);
      });
    }
    foot.innerHTML = '<button class="btn wide" id="main-btn" disabled style="opacity:.5">检查</button>';
    document.getElementById('main-btn').onclick = onMain;
    var play = body.querySelector('[data-play]');
    if (play) { play.onclick = function () { playAudio(ex.audio); }; playAudio(ex.audio); }
  }

  function renderSelection(ex) {
    var opts = document.querySelectorAll('#opts .opt');
    opts.forEach(function (b, i) { b.classList.toggle('sel', i === L.sel); });
    var btn = document.getElementById('main-btn');
    btn.disabled = false; btn.style.opacity = 1;
  }

  function renderWordbank(ex) {
    var box = document.getElementById('wbbox'); if (!box) return;
    box.innerHTML = '';
    var ans = document.createElement('div'); ans.className = 'wb';
    L.wb.forEach(function (t) { ans.appendChild(el('<button class="tok">' + esc(t) + '</button>')); });
    box.appendChild(ans);
    var pool = document.createElement('div'); pool.style.marginTop = '10px';
    L.used = L.used || {};
    ex.tokens.forEach(function (t, i) {
      var b = el('<button class="tok">' + esc(t) + '</button>');
      if (L.used[i]) b.classList.add('used');
      b.onclick = function () {
        if (L.used[i]) return;
        L.used[i] = 1; L.wb.push(t); renderWordbank(ex);
      };
      pool.appendChild(b);
    });
    box.appendChild(pool);
    var btn = document.getElementById('main-btn');
    btn.disabled = L.wb.length !== ex.tokens.length;
    btn.style.opacity = btn.disabled ? .5 : 1;
  }

  function renderMatch(ex) {
    var box = document.getElementById('match');
    var left = ex.pairs.map(function (p, i) { return { t: p.l, i: i }; });
    var right = ex.pairs.map(function (p, i) { return { t: p.r, i: i }; }).sort(function () { return Math.random() - 0.5; });
    L.matched = L.matched || [];
    var selL = null;
    left.forEach(function (p) {
      var b = el('<button class="mi">' + esc(p.t) + '</button>');
      b.dataset.i = p.i;
      if (L.matched.indexOf(p.i) >= 0) b.classList.add('done');
      b.onclick = function () {
        if (b.classList.contains('done')) return;
        document.querySelectorAll('.mi').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel'); selL = p.i;
      };
      box.appendChild(b);
    });
    right.forEach(function (p) {
      var b = el('<button class="mi">' + esc(p.t) + '</button>');
      b.dataset.i = p.i;
      if (L.matched.indexOf(p.i) >= 0) b.classList.add('done');
      b.onclick = function () {
        if (selL === null || b.classList.contains('done')) return;
        if (selL === p.i) {
          L.matched.push(p.i); L.xp += 2; L.right++;
          renderMatch(ex);
          if (L.matched.length === ex.pairs.length) setTimeout(nextExercise, 450);
        } else {
          b.classList.add('bad'); setTimeout(function () { b.classList.remove('bad'); }, 400);
          L.wrong++; L.xp = Math.max(0, L.xp - 1);
        }
      };
      box.appendChild(b);
    });
  }

  function onMain() {
    var ex = L.queue[L.i];
    if (L.checked) { nextExercise(); return; }
    if (ex.type === 'wordbank') {
      var ok = L.wb.join(' ').replace(/\s+/g, ' ').trim() === ex.answer.replace(/\s+/g, ' ').trim();
      finishAnswer(ex, ok);
    } else {
      if (L.sel === null) return;
      finishAnswer(ex, L.sel === ex.answer);
    }
  }

  function finishAnswer(ex, ok) {
    L.checked = true;
    if (ok) { L.xp += 2; L.right++; } else L.wrong++;
    (ex.wordIds || []).forEach(function (id) { touchWord(id, ok); });
    if (L.mode === 'review') {
      S.daily.reviews++;
      save();
    }
    var foot = document.getElementById('lfoot');
    var extra = '';
    if (ex.stem || ex.sentence) {
      var txt = ex.type === 'choice' && ex.stemLang === 'zh' ? (W[ex.options[ex.answer]] ? W[ex.options[ex.answer]].zh : '') : '';
      if (txt) extra = '<p>' + esc(txt) + '</p>';
    }
    foot.innerHTML = '<div class="fb ' + (ok ? 'ok' : 'bad') + '"><h3>' + (ok ? '答对了' : '再记一下') + '</h3>' +
      (ok ? '' : '<p>正确答案：' + esc(String(ex.answer !== undefined ? (ex.type === 'wordbank' ? ex.answer : (ex.options || [])[ex.answer]) : '')) + '</p>') +
      '</div><button class="btn wide" id="main-btn">继续</button>';
    document.getElementById('main-btn').onclick = nextExercise;
    document.querySelectorAll('#opts .opt').forEach(function (b, i) {
      b.classList.remove('sel');
      if (i === ex.answer) b.classList.add('ok');
      else if (i === L.sel) b.classList.add('bad');
    });
  }

  function nextExercise() {
    L.i++; L.sel = null; L.checked = false; L.wb = []; L.used = {}; L.matched = [];
    renderExercise();
  }

  function renderSummary() {
    var perfect = L.wrong === 0 && L.queue.length > 0;
    if (L.mode === 'lesson') {
      var lid = L.lesson.id;
      if (!S.done[lid]) { S.done[lid] = true; S.daily.lessons++; }
      if (perfect) S.perfect++;
      addXp(L.xp + 10);
    } else {
      addXp(L.xp);
    }
    save();
    var h = '<div class="lbody center" style="padding-top:60px">' +
      '<div style="font-size:64px">' + (perfect ? '🏆' : '👏') + '</div>' +
      '<h2 style="font-size:26px">' + (perfect ? '完美一课！' : '做得不错') + '</h2>' +
      '<p class="muted">本课掌握 ' + L.right + ' 题 · 用时很短</p>' +
      '<div class="grid2" style="margin-top:24px">' +
      '<div class="stat"><b>+' + L.xp + '</b><span>XP</span></div>' +
      '<div class="stat"><b>' + Math.round(L.right / Math.max(1, L.right + L.wrong) * 100) + '%</b><span>正确率</span></div></div>' +
      '<div style="height:26px"></div><button class="btn wide" data-done="1">完成</button></div>';
    lessonEl.innerHTML = h;
    lessonEl.querySelector('[data-done]').onclick = closeLesson;
    render();
  }

  render();
})();
