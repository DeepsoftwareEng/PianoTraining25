/* Điều khiển ứng dụng */
(function (PT) {
  'use strict';
  const M = PT.music;
  const KB = PT.keyboard;
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = {
    clefs: ['grand'],
    mode: 'finger',
    hands: 'any',  // 'any' = một tay ngẫu nhiên, 'R' / 'L' = chỉ một tay, 'both' = hai tay cùng lúc
    learn: 'test', // 'test' = kiểm tra, 'ref' = có bảng tra cứu
    posPreset: 'c',
    customL: 21,
    customR: 28,
    randomEvery: 10,
    showPos: true,
    maxLedger: 2,
    accidentals: 'none',
    naming: 'vi',
    keyNames: false,
    sound: true,
    autoNext: true,
    phraseLen: 5,
  };
  const EMPTY_STATS = () => ({ total: 0, correct: 0, streak: 0, best: 0, timeSum: 0, weak: {} });

  const store = {
    load(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return v ? Object.assign(fallback, v) : fallback; }
      catch (e) { return fallback; }
    },
    save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* bỏ qua */ } },
  };

  const settings = store.load('pt.settings', { ...DEFAULTS });
  settings.clefs = settings.clefs.filter((c) => M.CLEFS[c]);
  if (!settings.clefs.length) settings.clefs = [...DEFAULTS.clefs];
  if (!['any', 'R', 'L', 'both'].includes(settings.hands)) settings.hands = 'any';
  if (!['finger', 'note', 'phrase'].includes(settings.mode)) settings.mode = 'finger';
  let stats = store.load('pt.stats', EMPTY_STATS());

  const state = {
    q: null,
    answered: false,
    pendingKey: null,    // phím vừa bấm, chưa gán ngón
    pendingFinger: null, // { hand, finger } vừa chọn, chưa gán phím
    picks: [],           // câu trả lời đã gán: { key, hand?, finger? }
    startTime: 0,
    pos: null,
    randomPos: null,
    randomCount: 0,
    autoTimer: null,
    playTimers: [],
  };

  const saveSettings = () => store.save('pt.settings', settings);
  const saveStats = () => store.save('pt.stats', stats);
  const handName = (h) => (h === 'L' ? 'tay trái' : 'tay phải');
  const HandName = (h) => (h === 'L' ? 'Tay trái' : 'Tay phải');
  const fmtAnswer = (a) => `${handName(a.hand)} ngón ${a.finger}`;
  const isFinger = () => settings.mode === 'finger';
  const isPhrase = () => settings.mode === 'phrase';
  const usesFingers = () => isFinger() || isPhrase(); // có dùng nút chọn ngón
  const activeHands = () => (settings.hands === 'R' ? ['R'] : settings.hands === 'L' ? ['L'] : ['L', 'R']);
  const keyName = (m) => M.midiLabel(m, settings.naming);
  const keyShort = (m) => M.midiShort(m, settings.naming);

  /* ---------- Thế tay ---------- */
  function currentPosition(advance) {
    const p = settings.posPreset;
    if (p === 'custom') return { L: settings.customL, R: settings.customR };
    if (p === 'random') {
      let changed = false;
      if (!state.randomPos || (advance && state.randomCount >= settings.randomEvery)) {
        state.randomPos = M.randomPosition();
        state.randomCount = 0;
        changed = true;
      }
      if (advance) state.randomCount++;
      return { ...state.randomPos, changed };
    }
    return { L: M.POSITIONS[p].L, R: M.POSITIONS[p].R };
  }

  function positionText(pos) {
    const n = settings.naming;
    const txt = {
      L: `T: ${M.diaName(pos.L, n)}–${M.diaName(pos.L + 4, n)}`,
      R: `P: ${M.diaName(pos.R, n)}–${M.diaName(pos.R + 4, n)}`,
    };
    return activeHands().map((h) => txt[h]).join(' · ');
  }

  /* ---------- Câu hỏi ---------- */
  function stopPhrasePlayback() {
    state.playTimers.forEach(clearTimeout);
    state.playTimers = [];
  }

  // Phát lần lượt các nốt của câu nhạc (hai tay thì phát cùng nhịp)
  function playPhrase(q, delay = 0) {
    stopPhrasePlayback();
    const len = q.parts[0].notes.length;
    for (let i = 0; i < len; i++) {
      state.playTimers.push(setTimeout(() => {
        q.parts.forEach((p) => PT.audio.play(M.midiOf(p.notes[i]), { duration: 0.9 }));
      }, delay + i * 330));
    }
  }

  function newQuestion() {
    clearTimeout(state.autoTimer);
    stopPhrasePlayback();
    const fingerMode = isFinger();
    state.pos = fingerMode ? currentPosition(true) : null;
    const q = M.generate(settings, state.pos, state.q);

    state.answered = false;
    state.pendingKey = null;
    state.pendingFinger = null;
    state.picks = [];
    KB.clearMarks();
    KB.setZones(state.pos, settings.showPos, activeHands());

    const posLabel = $('positionLabel');
    posLabel.hidden = !fingerMode;
    if (fingerMode) posLabel.textContent = `Thế tay — ${positionText(state.pos)}`;

    if (q.error) {
      state.q = null;
      refreshPicks();
      $('staff').innerHTML = '';
      $('clefLabel').textContent = '⚠';
      setFeedback(q.error, 'warn');
      renderRef(false);
      return;
    }
    state.q = q;
    refreshPicks();
    const clef = M.CLEFS[q.clefKey];
    $('clefLabel').textContent = q.both
      ? 'Khuông đôi · hai tay cùng lúc'
      : q.clefKey === 'grand'
        ? `Khuông đôi · ${q.parts[0].staff === 'treble' ? 'khuông trên (Sol)' : 'khuông dưới (Fa)'}`
        : `${clef.label} · ${clef.detail}`;
    PT.staff.render($('staff'), q);
    renderRef(false);

    if (state.pos && state.pos.changed && settings.posPreset === 'random') {
      setFeedback(`Đổi thế tay! ${positionText(state.pos)}`, 'info');
    } else {
      setFeedback(promptText(q), '');
    }

    const focus = state.pos
      ? activeHands().flatMap((h) => [state.pos[h], state.pos[h] + 4]).map((d) => M.midiOf(M.fromDia(d)))
      : q.parts.map((p) => p.midi);
    KB.scrollToward(focus);
    state.startTime = performance.now();
  }

  function promptText(q) {
    if (q.phrase) {
      const base = 'Cả câu chơi trọn trong một thế 5 ngón, không đổi thế.';
      if (q.both) return `${base} Nốt <b class="first-note">đầu tiên</b> của mỗi tay đánh ngón mấy? (<b>tay phải</b> khuông trên, <b>tay trái</b> khuông dưới)`;
      return `${base} Nốt <b class="first-note">đầu tiên</b> đánh <b>${handName(q.parts[0].hand)}</b> ngón mấy?`;
    }
    if (q.both) {
      return isFinger()
        ? 'Hai nốt cùng lúc: <b>tay phải</b> đọc khuông trên, <b>tay trái</b> đọc khuông dưới. Mỗi tay: bấm phím rồi chọn ngón.'
        : 'Hai nốt cùng lúc — bấm <b>2 phím</b> (khuông trên + khuông dưới).';
    }
    if (!isFinger()) return 'Nốt này là phím nào?';
    if (settings.hands === 'R' || settings.hands === 'L') return `Nốt này là phím nào, ngón mấy? (<b>${handName(settings.hands)}</b>)`;
    return 'Nốt này là phím nào, tay nào, ngón mấy?';
  }

  /* ---------- Bảng tra cứu ---------- */
  function renderRef(hint) {
    const on = settings.learn === 'ref' && !!state.q;
    $('refPanel').hidden = !on;
    document.body.classList.toggle('is-ref', on);
    $('refHint').hidden = true;
    $('refLegend').hidden = false;
    if (!on) return;
    PT.reference.render($('refChart'), $('refTips'), state.q, settings.naming, hint, settings.maxLedger);
    if (hint) {
      $('refHint').innerHTML = PT.reference.hintText(state.q, settings.naming, settings.maxLedger);
      $('refHint').hidden = false;
      $('refLegend').hidden = true;
    }
  }

  function setFeedback(html, kind) {
    const el = $('feedback');
    el.innerHTML = html;
    el.className = `feedback ${kind ? 'fb-' + kind : ''}`;
  }

  /* ---------- Trả lời ---------- */
  function onKeyPress(midi) {
    if (settings.sound) PT.audio.play(midi);
    const q = state.q;
    if (!q || state.answered || q.phrase) return; // chế độ câu nhạc: phím đàn chỉ để nghe thử
    const idx = state.picks.findIndex((p) => p.key === midi);

    if (!isFinger()) {
      if (idx >= 0) state.picks.splice(idx, 1); // bấm lại phím đã chọn → bỏ chọn
      else state.picks.push({ key: midi });
      refreshPicks();
      if (state.picks.length >= q.parts.length) submit();
      return;
    }
    // Chế độ ngón: bấm lại phím đã gán (khi chưa chọn gì dở dang) → gỡ phím đó ra
    if (idx >= 0 && state.pendingKey == null && !state.pendingFinger) {
      state.picks.splice(idx, 1);
      refreshPicks();
      return;
    }
    state.pendingKey = state.pendingKey === midi ? null : midi;
    tryAssign();
  }

  function onFinger(hand, finger) {
    const q = state.q;
    if (!q || state.answered) return;
    if (q.phrase) {
      if (!q.parts.some((p) => p.hand === hand)) return;
      const prev = state.picks.find((p) => p.hand === hand);
      state.picks = state.picks.filter((p) => p.hand !== hand); // mỗi tay một câu trả lời, chọn lại để sửa
      if (!prev || prev.finger !== finger) state.picks.push({ hand, finger });
      refreshPicks();
      if (state.picks.length >= q.parts.length) submit();
      return;
    }
    if (!activeHands().includes(hand)) return;
    const p = state.pendingFinger;
    state.pendingFinger = p && p.hand === hand && p.finger === finger ? null : { hand, finger };
    tryAssign();
  }

  function tryAssign() {
    const q = state.q;
    if (state.pendingKey != null && state.pendingFinger) {
      const pick = { key: state.pendingKey, ...state.pendingFinger };
      if (q.both) state.picks = state.picks.filter((p) => p.hand !== pick.hand); // mỗi tay một nốt
      state.picks.push(pick);
      state.pendingKey = null;
      state.pendingFinger = null;
    }
    refreshPicks();
    if (state.picks.length >= q.parts.length) submit();
  }

  // Cập nhật bàn phím, nút ngón và ô "Phím" theo lựa chọn hiện tại
  function refreshPicks() {
    const q = state.q;
    const fingerMode = isFinger();
    KB.clearBadges();
    KB.markSelected([...state.picks.map((p) => p.key), state.pendingKey].filter((m) => m != null));
    state.picks.forEach((p) => { if (p.hand) KB.setBadge(p.key, [{ hand: p.hand, finger: p.finger }]); });

    document.querySelectorAll('.finger').forEach((b) => {
      const h = b.dataset.hand, f = +b.dataset.finger;
      const pf = state.pendingFinger;
      b.classList.toggle('active', !!pf && pf.hand === h && pf.finger === f);
      b.classList.toggle('assigned', state.picks.some((p) => p.hand === h && p.finger === f));
      b.classList.remove('is-correct', 'is-wrong');
      b.classList.toggle('is-off', !!q && !!q.phrase && !q.parts.some((p) => p.hand === h));
    });

    const slot = $('slotKey');
    const label = $('slotLabel');
    let html;
    if (!q) {
      html = '—';
    } else if (q.phrase) {
      label.textContent = 'Nốt đầu tiên';
      html = q.parts.map((part) => {
        const p = state.picks.find((x) => x.hand === part.hand);
        return `<span class="slot-line slot-${part.hand}"><b>${HandName(part.hand)}:</b> ${p ? `ngón ${p.finger}` : '— chọn ngón —'}</span>`;
      }).join('');
    } else if (q.both && fingerMode) {
      label.textContent = 'Hai tay';
      html = ['R', 'L'].map((h) => {
        const p = state.picks.find((x) => x.hand === h);
        return `<span class="slot-line slot-${h}"><b>${HandName(h)}:</b> ${p ? `${keyShort(p.key)} · ngón ${p.finger}` : '—'}</span>`;
      }).join('');
      if (state.pendingKey != null) html += `<span class="slot-line slot-pending">Phím ${keyShort(state.pendingKey)} → chọn ngón</span>`;
      else if (state.pendingFinger) html += `<span class="slot-line slot-pending">${fmtAnswer(state.pendingFinger)} → bấm phím</span>`;
    } else if (q.both) {
      label.textContent = 'Phím';
      html = state.picks.length ? state.picks.map((p) => keyShort(p.key)).join(' + ') + (state.picks.length < 2 ? ' + …' : '') : '— bấm 2 phím —';
    } else {
      label.textContent = 'Phím';
      const k = state.pendingKey ?? (state.picks[0] && state.picks[0].key);
      html = k != null ? keyName(k) : '— bấm phím đàn —';
    }
    slot.innerHTML = html;
    slot.classList.toggle('filled', state.picks.length > 0 || state.pendingKey != null);
  }

  function evaluate(q) {
    const fingerMode = isFinger();
    if (q.phrase) {
      return q.parts.map((part) => {
        const pick = state.picks.find((p) => p.hand === part.hand) || null;
        const fingerOk = !!pick && part.answers.some((a) => a.finger === pick.finger);
        return { part, pick, keyOk: true, fingerOk, ok: fingerOk };
      });
    }
    return q.parts.map((part) => {
      let pick;
      if (!fingerMode) pick = state.picks.find((p) => p.key === part.midi) || null;
      else if (q.both) pick = state.picks.find((p) => p.hand === part.hand) || null;
      else pick = state.picks[0] || null;
      const keyOk = !!pick && pick.key === part.midi;
      const fingerOk = !fingerMode || (!!pick && part.answers.some((a) => a.hand === pick.hand && a.finger === pick.finger));
      return { part, pick, keyOk, fingerOk, ok: keyOk && fingerOk };
    });
  }

  function submit() {
    const q = state.q;
    state.answered = true;
    const elapsed = (performance.now() - state.startTime) / 1000;
    const results = evaluate(q);
    const ok = results.every((r) => r.ok);
    const refMode = settings.learn === 'ref';
    if (!refMode) recordStats(q, results, ok, elapsed); // chế độ tra cứu không tính điểm
    if (refMode) renderRef(true); // sau khi trả lời: chỉ luôn vị trí nốt trên bảng
    markAnswer(q, results, ok, elapsed, refMode);
  }

  function recordStats(q, results, ok, elapsed) {
    stats.total++;
    stats.timeSum += Math.min(elapsed, 60);
    if (ok) { stats.correct++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); }
    else stats.streak = 0;
    results.forEach((r) => {
      const clef = M.CLEFS[q.clefKey === 'grand' ? r.part.staff : q.clefKey];
      const wkey = `${q.phrase ? 'Câu nhạc · ' : ''}${clef.label}|${M.nameEn(r.part.note)}`;
      const w = stats.weak[wkey] || (stats.weak[wkey] = { miss: 0, total: 0 });
      w.total++;
      if (!r.ok) w.miss++;
    });
    saveStats();
    renderStats();
  }

  function markPhraseAnswer(q, results, ok, elapsed, refMode) {
    PT.staff.render($('staff'), q, true); // hiện số ngón cho cả câu
    // bàn phím: vùng 5 phím của câu nhạc + đánh dấu phím của nốt đầu
    const zone = {};
    q.parts.forEach((p) => { zone[p.hand] = p.low; });
    KB.setZones(zone, true, q.parts.map((p) => p.hand));
    results.forEach((r) => {
      KB.mark(r.part.midi, r.ok ? 'correct' : 'reveal');
      const badges = [...r.part.answers];
      if (r.pick && !r.ok) badges.unshift({ hand: r.pick.hand, finger: r.pick.finger, bad: true });
      KB.setBadge(r.part.midi, badges);
    });
    const answers = q.parts.flatMap((p) => p.answers);
    document.querySelectorAll('.finger').forEach((b) => {
      const h = b.dataset.hand, f = +b.dataset.finger;
      const isAns = answers.some((a) => a.hand === h && a.finger === f);
      const isChosen = state.picks.some((p) => p.hand === h && p.finger === f);
      b.classList.remove('active', 'assigned');
      b.classList.toggle('is-correct', isAns);
      b.classList.toggle('is-wrong', isChosen && !isAns);
    });

    const tag = refMode ? ' <span class="muted">· tra cứu, không tính điểm</span>' : '';
    const time = `<span class="time">${elapsed.toFixed(1)}s</span>`;
    const n = settings.naming;
    // Giải thích: nốt thấp nhất / cao nhất của câu ứng với ngón nào
    const why = (part) => {
      const lo = M.diaName(part.low, n), hi = M.diaName(part.low + 4, n);
      return part.hand === 'R'
        ? `thấp nhất ${lo} = ngón 1, cao nhất ${hi} = ngón 5`
        : `thấp nhất ${lo} = ngón 5, cao nhất ${hi} = ngón 1`;
    };
    const lines = results.map((r) => {
      const p = r.part;
      const mine = r.ok || !r.pick ? '' : ` <span class="muted">(bạn chọn ngón ${r.pick.finger})</span>`;
      return `<span class="fb-line ${r.ok ? 'fb-line-ok' : 'fb-line-bad'}">${r.ok ? '✓' : '✗'} ${HandName(p.hand)}: `
        + `nốt đầu <strong>${M.noteName(p.note, n)}</strong> → <b>ngón ${p.answers[0].finger}</b>${mine}`
        + ` <span class="muted">— ${why(p)}</span></span>`;
    }).join('');
    setFeedback(`${ok ? '✓ Chính xác!' : '✗ Chưa đúng.'} ${time}${tag}<div class="fb-lines">${lines}</div>`, ok ? 'ok' : 'bad');

    const len = q.parts[0].notes.length;
    if (settings.sound) playPhrase(q, ok ? 150 : 380);
    if (ok && settings.autoNext) state.autoTimer = setTimeout(newQuestion, Math.max(refMode ? 2400 : 1800, len * 330 + 900));
  }

  function markAnswer(q, results, ok, elapsed, refMode) {
    if (q.phrase) { markPhraseAnswer(q, results, ok, elapsed, refMode); return; }
    const fingerMode = isFinger();
    KB.markSelected(null);
    KB.clearBadges();

    // gom màu + nhãn ngón theo từng phím rồi mới vẽ (2 tay có thể đụng cùng phím)
    const RANK = { wrong: 1, reveal: 2, correct: 3 };
    const cls = new Map();
    const badges = new Map();
    const setC = (m, c) => { if (!cls.has(m) || RANK[c] > RANK[cls.get(m)]) cls.set(m, c); };
    const addB = (m, b) => { if (!badges.has(m)) badges.set(m, []); badges.get(m).push(b); };

    results.forEach((r) => {
      const m = r.part.midi;
      if (r.keyOk) {
        setC(m, r.ok ? 'correct' : 'wrong');
        if (fingerMode && !r.fingerOk) addB(m, { hand: r.pick.hand, finger: r.pick.finger, bad: true });
      } else {
        if (fingerMode && r.pick) { setC(r.pick.key, 'wrong'); addB(r.pick.key, { hand: r.pick.hand, finger: r.pick.finger, bad: true }); }
        setC(m, 'reveal');
      }
      if (fingerMode) r.part.answers.forEach((a) => addB(m, a));
    });
    if (!fingerMode) {
      state.picks.filter((p) => !q.parts.some((pt) => pt.midi === p.key)).forEach((p) => setC(p.key, 'wrong'));
    }
    cls.forEach((c, m) => KB.mark(m, c));
    badges.forEach((b, m) => KB.setBadge(m, b));

    // nút ngón tay
    if (fingerMode) {
      const answers = q.parts.flatMap((p) => p.answers);
      document.querySelectorAll('.finger').forEach((b) => {
        const h = b.dataset.hand, f = +b.dataset.finger;
        const isAns = answers.some((a) => a.hand === h && a.finger === f);
        const isChosen = state.picks.some((p) => p.hand === h && p.finger === f);
        b.classList.remove('active', 'assigned');
        b.classList.toggle('is-correct', isAns);
        b.classList.toggle('is-wrong', isChosen && !isAns);
      });
    }

    // phản hồi
    const tag = refMode ? ' <span class="muted">· tra cứu, không tính điểm</span>' : '';
    const time = `<span class="time">${elapsed.toFixed(1)}s</span>`;
    const name = (part) => `<strong>${M.noteName(part.note, settings.naming)}</strong>`;
    const yours = (r) => {
      const bits = [];
      if (!r.pick) return 'bạn chưa bấm đúng phím nào';
      if (!r.keyOk) bits.push(`bạn bấm ${keyName(r.pick.key)}`);
      if (fingerMode && !r.fingerOk) bits.push(`bạn chọn ${fmtAnswer(r.pick)}`);
      return bits.join(', ');
    };

    if (q.both) {
      const lines = results.map((r) => {
        const who = fingerMode ? HandName(r.part.hand) : (r.part.staff === 'treble' ? 'Khuông trên' : 'Khuông dưới');
        const fing = fingerMode ? ` ngón ${r.part.answers[0].finger}` : '';
        return `<span class="fb-line ${r.ok ? 'fb-line-ok' : 'fb-line-bad'}">${r.ok ? '✓' : '✗'} ${who}: ${name(r.part)}${fing}${r.ok ? '' : ` <span class="muted">(${yours(r)})</span>`}</span>`;
      }).join('');
      const allOk = fingerMode ? '✓ Chính xác cả hai tay!' : '✓ Chính xác cả hai nốt!';
      setFeedback(`${ok ? allOk : '✗ Chưa đúng hết.'} ${time}${tag}<div class="fb-lines">${lines}</div>`, ok ? 'ok' : 'bad');
    } else {
      const r = results[0];
      const fingering = fingerMode ? ` — ${r.part.answers.map(fmtAnswer).join(' hoặc ')}` : '';
      if (ok) {
        setFeedback(`✓ Chính xác! ${name(r.part)}${fingering} ${time}${tag}`, 'ok');
      } else {
        const head = r.keyOk ? '✗ Đúng phím, sai ngón.' : '✗ Chưa đúng.';
        setFeedback(`${head} Đây là ${name(r.part)}${fingering} <span class="muted">(${yours(r)})</span>${tag}`, 'bad');
      }
    }
    if (!ok && settings.sound) setTimeout(() => q.parts.forEach((p) => PT.audio.play(p.midi)), 380);
    if (ok && settings.autoNext) state.autoTimer = setTimeout(newQuestion, refMode ? 2000 : q.both ? 1300 : 1000);
  }

  /* ---------- Thống kê ---------- */
  function renderStats() {
    $('stCorrect').textContent = `${stats.correct}/${stats.total}`;
    $('stAcc').textContent = stats.total ? `${Math.round((stats.correct / stats.total) * 100)}%` : '–';
    $('stStreak').textContent = stats.streak;
    $('stBest').textContent = stats.best;
    $('stTime').textContent = stats.total ? `${(stats.timeSum / stats.total).toFixed(1)}s` : '–';

    const list = $('weakList');
    const rows = Object.entries(stats.weak)
      .filter(([, v]) => v.miss > 0)
      .sort((a, b) => b[1].miss - a[1].miss || b[1].miss / b[1].total - a[1].miss / a[1].total)
      .slice(0, 6);
    list.innerHTML = rows.length
      ? rows.map(([k, v]) => {
          const [clef, note] = k.split('|');
          return `<li><span>${note} <small>${clef}</small></span><span class="miss">${v.miss}/${v.total}</span></li>`;
        }).join('')
      : '<li class="empty">Chưa có lỗi nào 🎉</li>';
  }

  /* ---------- Cài đặt ---------- */
  function buildSettingsUI() {
    const grid = $('clefGrid');
    grid.innerHTML = M.CLEF_ORDER.map((k) => {
      const c = M.CLEFS[k];
      return `<label class="clef-opt"><input type="checkbox" value="${k}">
        <span><b>${c.label}</b><small>${c.detail}</small></span></label>`;
    }).join('');
    grid.addEventListener('change', () => {
      const checked = [...grid.querySelectorAll('input:checked')].map((i) => i.value);
      if (!checked.length) { syncSettingsUI(); return; } // luôn giữ ít nhất 1 khóa
      settings.clefs = checked;
      changed();
    });
    $('btnClefPiano').onclick = () => { settings.clefs = ['grand']; syncSettingsUI(); changed(); };
    $('btnClefAll').onclick = () => { settings.clefs = M.CLEF_ORDER.filter((k) => k !== 'grand'); syncSettingsUI(); changed(); };

    document.querySelectorAll('input[name="hands"]').forEach((r) => r.addEventListener('change', () => {
      settings.hands = r.value; syncSettingsUI(); changed();
    }));
    document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
      settings.mode = r.value; syncSettingsUI(); changed();
    }));
    document.querySelectorAll('input[name="learn"]').forEach((r) => r.addEventListener('change', () => {
      settings.learn = r.value; saveSettings(); syncSettingsUI(); refreshLabels(); renderRef(state.answered);
    }));
    $('btnHint').onclick = () => renderRef(true);

    const preset = $('posPreset');
    preset.innerHTML = Object.entries(M.POSITIONS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
    preset.onchange = () => { settings.posPreset = preset.value; state.randomPos = null; syncSettingsUI(); changed(); };

    const whiteOpts = (from, to) => {
      let html = '';
      for (let d = from; d <= to; d++) html += `<option value="${d}">${M.diaName(d, 'both')}</option>`;
      return html;
    };
    $('posL').innerHTML = whiteOpts(7, 47);
    $('posR').innerHTML = whiteOpts(7, 47);
    $('posL').onchange = (e) => { settings.customL = +e.target.value; changed(); };
    $('posR').onchange = (e) => { settings.customR = +e.target.value; changed(); };
    $('randomEvery').onchange = (e) => {
      settings.randomEvery = Math.max(1, Math.min(100, +e.target.value || 10));
      e.target.value = settings.randomEvery; saveSettings();
    };
    $('optShowPos').onchange = (e) => { settings.showPos = e.target.checked; saveSettings(); KB.setZones(state.pos, settings.showPos, activeHands()); };

    $('phraseLen').onchange = (e) => { settings.phraseLen = +e.target.value; changed(); };
    $('maxLedger').onchange = (e) => { settings.maxLedger = +e.target.value; changed(); };
    $('accidentals').onchange = (e) => { settings.accidentals = e.target.value; changed(); };
    $('naming').onchange = (e) => { settings.naming = e.target.value; saveSettings(); refreshLabels(); };
    $('optKeyNames').onchange = (e) => { settings.keyNames = e.target.checked; saveSettings(); refreshLabels(); };
    $('optSound').onchange = (e) => { settings.sound = e.target.checked; saveSettings(); };
    $('optAutoNext').onchange = (e) => { settings.autoNext = e.target.checked; saveSettings(); };

    $('btnResetStats').onclick = () => {
      if (!confirm('Xóa toàn bộ thống kê luyện tập?')) return;
      stats = EMPTY_STATS(); saveStats(); renderStats();
    };
  }

  function syncSettingsUI() {
    $('clefGrid').querySelectorAll('input').forEach((i) => { i.checked = settings.clefs.includes(i.value); });
    document.querySelectorAll('input[name="hands"]').forEach((r) => { r.checked = r.value === settings.hands; });
    document.querySelectorAll('input[name="mode"]').forEach((r) => { r.checked = r.value === settings.mode; });
    document.querySelectorAll('input[name="learn"]').forEach((r) => { r.checked = r.value === settings.learn; });
    const fingerMode = isFinger();
    const both = settings.hands === 'both';
    $('clefSet').classList.toggle('locked', both);
    $('clefLockNote').hidden = !both;
    $('positionSet').hidden = !fingerMode;
    $('fingerPicker').hidden = !usesFingers();
    $('phraseLenWrap').hidden = !isPhrase();
    $('phraseLen').value = settings.phraseLen;
    document.querySelector('.hand-left').hidden = settings.hands === 'R';
    document.querySelector('.hand-right').hidden = settings.hands === 'L';
    $('posPreset').value = settings.posPreset;
    $('customPos').hidden = settings.posPreset !== 'custom';
    $('randomEveryWrap').hidden = settings.posPreset !== 'random';
    $('posL').value = settings.customL;
    $('posR').value = settings.customR;
    $('randomEvery').value = settings.randomEvery;
    $('optShowPos').checked = settings.showPos;
    $('maxLedger').value = settings.maxLedger;
    $('accidentals').value = settings.accidentals;
    $('naming').value = settings.naming;
    $('optKeyNames').checked = settings.keyNames;
    $('optSound').checked = settings.sound;
    $('optAutoNext').checked = settings.autoNext;
    $('hintText').textContent = isPhrase()
      ? 'Tìm nốt thấp nhất và cao nhất của câu: tay phải đặt ngón 1 lên nốt thấp nhất, tay trái đặt ngón 5 lên nốt thấp nhất — rồi suy ra ngón cho nốt đầu (tô màu). Phím đàn chỉ để nghe thử.'
      : !fingerMode
      ? (both ? 'Bấm 2 phím ứng với 2 nốt (thứ tự nào cũng được). Bấm lại một phím để bỏ chọn.' : 'Bấm phím trên đàn ứng với nốt trên khuông.')
      : both
        ? 'Với từng tay: bấm phím rồi chọn ngón (hoặc ngược lại). Chọn lại tay đó để sửa. Ngón 1 = ngón cái, 5 = ngón út.'
        : 'Bấm phím trên đàn và chọn ngón (thứ tự nào cũng được). Ngón 1 = ngón cái, 5 = ngón út.';
  }

  function refreshLabels() {
    KB.setLabels(settings.naming, settings.keyNames || settings.learn === 'ref');
    if (settings.learn === 'ref' && state.q) renderRef(state.answered);
    if (state.pos) $('positionLabel').textContent = `Thế tay — ${positionText(state.pos)}`;
    if (state.q && !state.answered) refreshPicks();
  }

  function changed() {
    saveSettings();
    newQuestion();
  }

  /* ---------- Phím tắt ---------- */
  const SHORTCUTS = {
    a: ['L', 5], s: ['L', 4], d: ['L', 3], f: ['L', 2], g: ['L', 1],
    h: ['R', 1], j: ['R', 2], k: ['R', 3], l: ['R', 4], ';': ['R', 5],
  };
  function onKeyDown(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'enter' || key === ' ') {
      if (tag === 'summary') return;
      e.preventDefault(); // tránh nút đang focus bị "click" thêm lần nữa
      newQuestion();
      return;
    }
    if (key === '?' && settings.learn === 'ref') { e.preventDefault(); renderRef(true); return; }
    if (usesFingers() && SHORTCUTS[key]) {
      e.preventDefault();
      onFinger(...SHORTCUTS[key]);
    }
  }

  /* ---------- Khởi động ---------- */
  function init() {
    KB.build($('keyboard'), $('keyboardScroll'), onKeyPress);
    buildSettingsUI();
    syncSettingsUI();
    refreshLabels();
    renderStats();
    document.querySelectorAll('.finger').forEach((b) => {
      b.addEventListener('click', () => onFinger(b.dataset.hand, +b.dataset.finger));
    });
    $('btnNext').addEventListener('click', newQuestion);
    document.addEventListener('keydown', onKeyDown);
    newQuestion();
  }

  init();
  PT.app = { state, settings }; // tiện cho gỡ lỗi trong DevTools
})(window.PT);
