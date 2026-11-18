/* Lý thuyết âm nhạc + sinh câu hỏi. Không phụ thuộc DOM. */
window.PT = window.PT || {};
(function (PT) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const VI = ['Đô', 'Rê', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  const SEMI = [0, 2, 4, 5, 7, 9, 11];
  const MIDI_MIN = 21;  // A0
  const MIDI_MAX = 108; // C8

  const mod = (a, n) => ((a % n) + n) % n;
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Một nốt: { step: 0..6 (C..B), oct, acc: -1 | 0 | 1 }
  // "dia" = chỉ số bậc diatonic tuyệt đối = oct*7 + step (C4 = 28)
  const dia = (n) => n.oct * 7 + n.step;
  const fromDia = (d, acc = 0) => ({ step: mod(d, 7), oct: Math.floor(d / 7), acc });
  const midiOf = (n) => 12 * (n.oct + 1) + SEMI[n.step] + n.acc;

  function nameVi(n) {
    const acc = n.acc === 1 ? ' thăng' : n.acc === -1 ? ' giáng' : '';
    return `${VI[n.step]}${acc} ${n.oct}`;
  }
  function nameEn(n) {
    const acc = n.acc === 1 ? '♯' : n.acc === -1 ? '♭' : '';
    return `${LETTERS[n.step]}${acc}${n.oct}`;
  }
  function noteName(n, naming) {
    if (naming === 'en') return nameEn(n);
    if (naming === 'both') return `${nameVi(n)} (${nameEn(n)})`;
    return nameVi(n);
  }
  const diaName = (d, naming) => noteName(fromDia(d), naming);

  // Tên nốt cho một phím (midi), dùng dấu thăng cho phím đen
  const SHARP_STEPS = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
  function noteFromMidi(m) {
    const [step, acc] = SHARP_STEPS[mod(m, 12)];
    return { step, oct: Math.floor(m / 12) - 1, acc };
  }
  function midiLabel(m, naming) {
    const n = noteFromMidi(m);
    if (n.acc === 0) return noteName(n, naming);
    // phím đen: hiện cả thăng/giáng
    const flat = noteFromMidi(m + 1); flat.acc = -1;
    if (naming === 'en') return `${nameEn(n)}/${nameEn(flat)}`;
    return `${nameVi(n)} / ${nameVi(flat)}`;
  }
  // Tên gọn cho một phím: "Mi4", "Đô♯4/Rê♭4" (dùng ở chỗ chật)
  function midiShort(m, naming) {
    const n = noteFromMidi(m);
    const vi = (x) => `${VI[x.step]}${x.acc === 1 ? '♯' : x.acc === -1 ? '♭' : ''}${x.oct}`;
    const fmt = naming === 'en' ? nameEn : vi;
    if (n.acc === 0) return fmt(n);
    const flat = noteFromMidi(m + 1); flat.acc = -1;
    return `${fmt(n)}/${fmt(flat)}`;
  }
  const isBlack = (m) => [1, 3, 6, 8, 10].includes(mod(m, 12));

  const vexKey = (n) => `${LETTERS[n.step].toLowerCase()}${n.acc === 1 ? '#' : n.acc === -1 ? 'b' : ''}/${n.oct}`;

  // mid = bậc diatonic của dòng kẻ giữa khuông
  const CLEFS = {
    'treble':        { vex: 'treble',        mid: 34, label: 'Khóa Sol',       detail: 'Sol dòng 2 · Treble' },
    'bass':          { vex: 'bass',          mid: 22, label: 'Khóa Fa',        detail: 'Fa dòng 4 · Bass' },
    'grand':         { vex: null,            mid: null, label: 'Khuông đôi',   detail: 'Sol + Fa · Grand staff' },
    'alto':          { vex: 'alto',          mid: 28, label: 'Khóa Đô dòng 3', detail: 'Alto' },
    'tenor':         { vex: 'tenor',         mid: 26, label: 'Khóa Đô dòng 4', detail: 'Tenor' },
    'soprano':       { vex: 'soprano',       mid: 32, label: 'Khóa Đô dòng 1', detail: 'Soprano' },
    'mezzo-soprano': { vex: 'mezzo-soprano', mid: 30, label: 'Khóa Đô dòng 2', detail: 'Mezzo-soprano' },
    'baritone-c':    { vex: 'baritone-c',    mid: 24, label: 'Khóa Đô dòng 5', detail: 'Baritone' },
    'french':        { vex: 'french',        mid: 36, label: 'Khóa Sol dòng 1', detail: 'French violin' },
    'subbass':       { vex: 'subbass',       mid: 20, label: 'Khóa Fa dòng 5', detail: 'Sub-bass' },
  };
  const CLEF_ORDER = Object.keys(CLEFS);

  function ledgerCount(d, mid) {
    const off = Math.abs(d - mid);
    return off <= 5 ? 0 : Math.floor((off - 4) / 2);
  }

  // Thế tay: lưu bậc diatonic của phím trắng thấp nhất trong 5 phím.
  // Tay trái: phím thấp nhất = ngón 5. Tay phải: phím thấp nhất = ngón 1.
  const POSITIONS = {
    c:      { label: 'Thế Đô (C) — T: Đô3–Sol3 · P: Đô4–Sol4', L: 21, R: 28 },
    middle: { label: 'Đô giữa — hai ngón cái chung Đô4',        L: 24, R: 28 },
    g:      { label: 'Thế Sol (G) — T: Sol2–Rê3 · P: Sol4–Rê5',  L: 18, R: 32 },
    custom: { label: 'Tùy chỉnh' },
    random: { label: 'Ngẫu nhiên (đổi thế định kỳ)' },
  };

  function fingerFor(hand, low, d) {
    const k = d - low;
    if (k < 0 || k > 4) return null;
    return hand === 'R' ? k + 1 : 5 - k;
  }
  // Phím trắng (bậc diatonic) mà một ngón đang đặt lên
  function diaForFinger(hand, low, finger) {
    return hand === 'R' ? low + finger - 1 : low + 5 - finger;
  }

  function randomPosition() {
    return { L: randInt(14, 23), R: randInt(28, 35) }; // T: Đô2..Mi3, P: Đô4..Đô5
  }

  function maybeAccidental(d, accSetting, prob = 0.35) {
    if (accSetting === 'none' || Math.random() > prob) return 0;
    const step = mod(d, 7);
    const options = [];
    if ((accSetting === 'sharp' || accSetting === 'both') && step !== 2 && step !== 6) options.push(1); // bỏ E#, B#
    if ((accSetting === 'flat' || accSetting === 'both') && step !== 0 && step !== 3) options.push(-1);  // bỏ Cb, Fb
    return options.length ? pick(options) : 0;
  }

  const inPiano = (n) => { const m = midiOf(n); return m >= MIDI_MIN && m <= MIDI_MAX; };

  /**
   * Sinh câu hỏi.
   * settings: { clefs[], mode ('finger' | 'note' | 'phrase'), maxLedger, accidentals, hands, phraseLen }
   *   hands: 'any' (một tay, ngẫu nhiên) | 'R' | 'L' | 'both' (hai tay cùng lúc, luôn dùng khuông đôi)
   * pos: { L, R } (chỉ dùng ở chế độ finger)
   * last: câu trước (để tránh lặp)
   * Trả về { clefKey, both, parts: [{ note, midi, staff, hand?, answers:[{hand,finger}] }] } hoặc { error }
   *   Mỗi part là một nốt cần trả lời. Chế độ hai tay: parts[0] = tay phải (khuông trên), parts[1] = tay trái.
   */
  const sameAsLast = (last, clefKey, parts) => !!last && !last.error && last.clefKey === clefKey
    && last.parts.length === parts.length && last.parts.every((p, i) => p.midi === parts[i].midi);

  function makeNote(d, settings) {
    const note = fromDia(d, maybeAccidental(d, settings.accidentals));
    return inPiano(note) ? note : null;
  }

  function generate(settings, pos, last) {
    const hands = settings.hands || 'any';
    if (settings.mode === 'phrase') return generatePhrase(settings, last);
    if (hands === 'both') return generateBoth(settings, pos, last);

    const clefs = settings.clefs.length ? settings.clefs : ['treble'];
    const maxL = settings.maxLedger;
    const allowed = hands === 'any' ? ['L', 'R'] : [hands];

    if (settings.mode === 'note') {
      const maxOff = 5 + 2 * maxL;
      for (let tries = 0; tries < 80; tries++) {
        const clefKey = pick(clefs);
        const hand = pick(allowed);
        const staff = clefKey === 'grand' ? (hands === 'any' ? pick(['treble', 'bass']) : (hand === 'R' ? 'treble' : 'bass')) : clefKey;
        const mid = CLEFS[staff].mid;
        let lo = mid - maxOff, hi = mid + maxOff;
        if (clefKey === 'grand') {
          // Khuông đôi: không cho nốt "lấn" sang vùng của khuông kia (Sol: từ La3, Fa: tới Mi4)
          if (staff === 'treble') lo = Math.max(lo, 26); else hi = Math.min(hi, 30);
        } else if (hands !== 'any') {
          // Khóa đơn + một tay: tay phải từ Đô giữa trở lên, tay trái từ Đô giữa trở xuống
          if (hand === 'R') lo = Math.max(lo, 28); else hi = Math.min(hi, 28);
        }
        if (lo > hi) continue;
        const note = makeNote(randInt(lo, hi), settings);
        if (!note) continue;
        const parts = [{ note, midi: midiOf(note), staff, answers: [] }];
        if (sameAsLast(last, clefKey, parts) && tries < 60) continue;
        return { clefKey, both: false, parts };
      }
      return { error: 'Các khóa đã chọn không có nốt phù hợp cho tay này. Hãy tăng số dòng kẻ phụ hoặc thêm khóa.' };
    }

    // Chế độ ngón tay: nốt phải nằm trong thế tay hiện tại và đọc được ở khóa đã chọn.
    const byClef = {};
    for (const hand of allowed) {
      for (let k = 0; k < 5; k++) {
        const d = pos[hand] + k;
        for (const clefKey of clefs) {
          const staff = clefKey === 'grand' ? (hand === 'R' ? 'treble' : 'bass') : clefKey;
          if (ledgerCount(d, CLEFS[staff].mid) > maxL) continue;
          (byClef[clefKey] = byClef[clefKey] || []).push({ d, clefKey, staff, hand });
        }
      }
    }
    const usable = Object.keys(byClef);
    if (!usable.length) {
      return { error: 'Thế tay hiện tại nằm ngoài tầm đọc của các khóa đã chọn. Hãy tăng số dòng kẻ phụ, thêm khóa hoặc đổi thế tay.' };
    }
    for (let tries = 0; tries < 80; tries++) {
      const c = pick(byClef[pick(usable)]);
      const note = makeNote(c.d, settings);
      if (!note) continue;
      const answers = [];
      for (const hand of allowed) {
        const f = fingerFor(hand, pos[hand], c.d);
        // Trên khuông đôi: khuông trên = tay phải, khuông dưới = tay trái
        if (f && (c.clefKey !== 'grand' || (hand === 'R') === (c.staff === 'treble'))) answers.push({ hand, finger: f });
      }
      if (!answers.length) continue;
      const parts = [{ note, midi: midiOf(note), staff: c.staff, answers }];
      if (sameAsLast(last, c.clefKey, parts) && tries < 60) continue;
      return { clefKey: c.clefKey, both: false, parts };
    }
    return { error: 'Không tạo được nốt phù hợp.' };
  }

  // Hai tay cùng lúc trên khuông đôi: 1 nốt khuông trên (tay phải) + 1 nốt khuông dưới (tay trái)
  function generateBoth(settings, pos, last) {
    const maxL = settings.maxLedger;
    const fingerMode = settings.mode === 'finger';
    let rangeR, rangeL;
    if (fingerMode) {
      rangeR = [0, 1, 2, 3, 4].map((k) => pos.R + k).filter((d) => ledgerCount(d, CLEFS.treble.mid) <= maxL);
      rangeL = [0, 1, 2, 3, 4].map((k) => pos.L + k).filter((d) => ledgerCount(d, CLEFS.bass.mid) <= maxL);
      if (!rangeR.length || !rangeL.length) {
        return { error: 'Thế tay hiện tại nằm ngoài tầm đọc của khuông đôi. Hãy tăng số dòng kẻ phụ hoặc đổi thế tay.' };
      }
    } else {
      const maxOff = 5 + 2 * maxL;
      const span = (a, b) => { const r = []; for (let d = a; d <= b; d++) r.push(d); return r; };
      rangeR = span(Math.max(26, CLEFS.treble.mid - maxOff), CLEFS.treble.mid + maxOff);
      rangeL = span(CLEFS.bass.mid - maxOff, Math.min(30, CLEFS.bass.mid + maxOff));
    }
    for (let tries = 0; tries < 100; tries++) {
      const dR = pick(rangeR), dL = pick(rangeL);
      const nR = makeNote(dR, settings), nL = makeNote(dL, settings);
      if (!nR || !nL) continue;
      if (midiOf(nR) <= midiOf(nL)) continue; // tay phải luôn cao hơn tay trái
      const parts = [
        { hand: 'R', staff: 'treble', note: nR, midi: midiOf(nR), answers: fingerMode ? [{ hand: 'R', finger: fingerFor('R', pos.R, dR) }] : [] },
        { hand: 'L', staff: 'bass', note: nL, midi: midiOf(nL), answers: fingerMode ? [{ hand: 'L', finger: fingerFor('L', pos.L, dL) }] : [] },
      ];
      if (sameAsLast(last, 'grand', parts) && tries < 80) continue;
      return { clefKey: 'grand', both: true, parts };
    }
    return { error: 'Không tạo được cặp nốt phù hợp.' };
  }

  /* ---------- Câu nhạc: nhiều nốt trong một thế 5 ngón, hỏi ngón cho nốt đầu ---------- */
  // Bước nhảy giữa hai nốt liền nhau (bậc) và trọng số: chủ yếu đi liền bậc, đôi khi nhảy quãng
  const STEP_W = [[1, 50], [2, 33], [3, 12], [4, 5]];
  function randStep() {
    let r = Math.random() * 100;
    for (const [s, w] of STEP_W) { if ((r -= w) < 0) return Math.random() < 0.5 ? -s : s; }
    return 1;
  }
  // Giai điệu gồm len bậc trong khoảng 0..4, luôn chạm cả hai đầu (0 và 4)
  // → câu nhạc phủ đúng 5 phím trắng nên chỉ có một cách đặt tay không phải đổi thế.
  function phraseMelody(len) {
    for (let t = 0; t < 400; t++) {
      const ks = [randInt(0, 4)];
      let guard = 0;
      while (ks.length < len && guard++ < 200) {
        const nx = ks[ks.length - 1] + randStep();
        if (nx >= 0 && nx <= 4) ks.push(nx);
      }
      if (ks.length === len && ks.includes(0) && ks.includes(4)) return ks;
    }
    return [0, 2, 4, 3, 1, 2, 3, 4].slice(0, len);
  }

  // Các bậc thấp nhất (low) hợp lệ để đặt câu nhạc lên khuông `staff`.
  // splitByHand: tay phải từ La3 trở lên, tay trái tới Mi4 (như khuông đôi).
  function phraseLows(staff, hand, splitByHand, maxL) {
    const mid = CLEFS[staff].mid;
    const maxOff = 5 + 2 * maxL;
    const lows = [];
    for (let low = mid - maxOff; low + 4 <= mid + maxOff; low++) {
      if (ledgerCount(low, mid) > maxL || ledgerCount(low + 4, mid) > maxL) continue;
      if (splitByHand && (hand === 'R' ? low < 26 : low + 4 > 30)) continue;
      lows.push(low);
    }
    return lows;
  }

  function buildPhrase(hand, staff, low, ks, settings) {
    const accBy = {}; // cùng một bậc luôn cùng dấu hóa trong cả câu
    const notes = [];
    for (const k of ks) {
      const d = low + k;
      if (!(d in accBy)) accBy[d] = maybeAccidental(d, settings.accidentals, 0.2);
      const n = fromDia(d, accBy[d]);
      if (!inPiano(n)) return null;
      notes.push(n);
    }
    const first = notes[0];
    return {
      hand, staff, low, notes, note: first, midi: midiOf(first),
      answers: [{ hand, finger: fingerFor(hand, low, dia(first)) }],
    };
  }

  const samePhrase = (last, clefKey, parts) => !!last && !last.error && last.phrase && last.clefKey === clefKey
    && last.parts.length === parts.length
    && last.parts.every((p, i) => p.notes.map(midiOf).join() === parts[i].notes.map(midiOf).join());

  function generatePhrase(settings, last) {
    const hands = settings.hands || 'any';
    const maxL = settings.maxLedger;
    const len = Math.max(4, Math.min(8, +settings.phraseLen || 5));

    if (hands === 'both') {
      const lowsR = phraseLows('treble', 'R', true, maxL);
      const lowsL = phraseLows('bass', 'L', true, maxL);
      if (!lowsR.length || !lowsL.length) {
        return { error: 'Không đủ chỗ trên khuông đôi cho câu nhạc 5 phím. Hãy tăng số dòng kẻ phụ.' };
      }
      for (let tries = 0; tries < 100; tries++) {
        const lowR = pick(lowsR), lowL = pick(lowsL);
        if (lowR <= lowL + 4) continue; // hai tay không chồng lên nhau
        const pR = buildPhrase('R', 'treble', lowR, phraseMelody(len), settings);
        const pL = buildPhrase('L', 'bass', lowL, phraseMelody(len), settings);
        if (!pR || !pL) continue;
        const parts = [pR, pL];
        if (samePhrase(last, 'grand', parts) && tries < 80) continue;
        return { clefKey: 'grand', both: true, phrase: true, parts };
      }
      return { error: 'Không tạo được câu nhạc phù hợp.' };
    }

    const clefs = settings.clefs.length ? settings.clefs : ['treble'];
    const allowed = hands === 'any' ? ['L', 'R'] : [hands];
    const options = [];
    for (const clefKey of clefs) {
      for (const hand of allowed) {
        const grand = clefKey === 'grand';
        const staff = grand ? (hand === 'R' ? 'treble' : 'bass') : clefKey;
        const lows = phraseLows(staff, hand, grand || hands !== 'any', maxL);
        if (lows.length) options.push({ clefKey, staff, hand, lows });
      }
    }
    if (!options.length) {
      return { error: 'Các khóa đã chọn không đủ chỗ cho câu nhạc 5 phím ở tay này. Hãy tăng số dòng kẻ phụ hoặc thêm khóa.' };
    }
    for (let tries = 0; tries < 80; tries++) {
      const o = pick(options);
      const part = buildPhrase(o.hand, o.staff, pick(o.lows), phraseMelody(len), settings);
      if (!part) continue;
      const parts = [part];
      if (samePhrase(last, o.clefKey, parts) && tries < 60) continue;
      return { clefKey: o.clefKey, both: false, phrase: true, parts };
    }
    return { error: 'Không tạo được câu nhạc phù hợp.' };
  }

  PT.music = {
    LETTERS, VI, MIDI_MIN, MIDI_MAX, CLEFS, CLEF_ORDER, POSITIONS,
    dia, fromDia, midiOf, nameVi, nameEn, noteName, diaName, midiLabel, midiShort, noteFromMidi, isBlack,
    vexKey, ledgerCount, fingerFor, diaForFinger, randomPosition, generate,
  };
})(window.PT);
