/* Bàn phím piano 88 phím (A0–C8) */
window.PT = window.PT || {};
(function (PT) {
  'use strict';
  const M = PT.music;

  let root, scroller;
  const keys = new Map(); // midi -> element
  let whiteCount = 0;

  function build(el, scrollEl, onPress) {
    root = el; scroller = scrollEl;
    root.innerHTML = '';
    keys.clear();
    // đếm phím trắng
    const whites = [];
    for (let m = M.MIDI_MIN; m <= M.MIDI_MAX; m++) if (!M.isBlack(m)) whites.push(m);
    whiteCount = whites.length;
    root.style.setProperty('--whites', whiteCount);

    let wi = 0;
    for (let m = M.MIDI_MIN; m <= M.MIDI_MAX; m++) {
      const k = document.createElement('button');
      k.type = 'button';
      k.dataset.midi = m;
      if (M.isBlack(m)) {
        k.className = 'key black';
        k.style.left = `calc(${wi} * var(--ww) - var(--bw) / 2)`;
      } else {
        k.className = 'key white';
        k.style.left = `calc(${wi} * var(--ww))`;
        if (m === 60) k.classList.add('middle-c');
        wi++;
      }
      k.innerHTML = '<span class="key-finger"></span><span class="key-badges"></span><span class="key-label"></span>';
      k.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(m); });
      k.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPress(m); } });
      root.appendChild(k);
      keys.set(m, k);
    }
  }

  function setLabels(naming, showAll) {
    for (const [m, k] of keys) {
      const lbl = k.querySelector('.key-label');
      const n = M.noteFromMidi(m);
      const isC = n.step === 0 && n.acc === 0;
      let text = '';
      if (showAll) {
        if (M.isBlack(m)) {
          const flat = M.noteFromMidi(m + 1); flat.acc = -1;
          text = naming === 'en' ? `${M.nameEn(n)}\n${M.nameEn(flat)}` : `${M.VI[n.step]}♯\n${M.VI[flat.step]}♭`;
        } else {
          text = naming === 'en' ? M.nameEn(n) : `${M.VI[n.step]}${naming === 'both' ? '\n' + M.nameEn(n) : n.oct}`;
        }
      } else if (isC) {
        text = naming === 'en' ? `C${n.oct}` : `Đô${n.oct}`;
      }
      lbl.textContent = text;
      k.setAttribute('aria-label', M.midiLabel(m, naming));
    }
  }

  function clearMarks() {
    for (const k of keys.values()) {
      k.classList.remove('selected', 'correct', 'wrong', 'reveal');
      k.querySelector('.key-badges').innerHTML = '';
    }
  }

  // midis: một số, mảng số, hoặc null
  function markSelected(midis) {
    for (const k of keys.values()) k.classList.remove('selected');
    [].concat(midis ?? []).forEach((m) => { if (keys.has(m)) keys.get(m).classList.add('selected'); });
  }

  function clearBadges() {
    for (const k of keys.values()) k.querySelector('.key-badges').innerHTML = '';
  }

  function setBadge(midi, items) {
    const k = keys.get(midi);
    if (!k) return;
    const box = k.querySelector('.key-badges');
    box.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('span');
      b.className = `badge badge-${it.hand}${it.bad ? ' badge-bad' : ''}`;
      b.textContent = `${it.hand === 'L' ? 'T' : 'P'}${it.finger}`;
      box.appendChild(b);
    }
  }

  function mark(midi, cls) {
    const k = keys.get(midi);
    if (k) k.classList.add(cls);
  }

  // pos: { L, R } (bậc diatonic thấp nhất) hoặc null; hands: các tay cần hiện
  function setZones(pos, show, hands = ['L', 'R']) {
    for (const k of keys.values()) {
      k.classList.remove('zone-L', 'zone-R');
      k.querySelector('.key-finger').textContent = '';
    }
    if (!pos || !show) return;
    for (const hand of hands) {
      for (let f = 1; f <= 5; f++) {
        const n = M.fromDia(M.diaForFinger(hand, pos[hand], f));
        const k = keys.get(M.midiOf(n));
        if (!k) continue;
        k.classList.add(`zone-${hand}`);
        const span = k.querySelector('.key-finger');
        if (span.textContent && span.textContent !== String(f)) span.textContent += `·${f}`;
        else span.textContent = f;
      }
    }
  }

  // Cuộn để vùng chứa các midi vào giữa màn hình (chỉ khi bàn phím rộng hơn khung)
  function scrollToward(midis) {
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 2) return;
    const els = midis.map((m) => keys.get(m)).filter(Boolean);
    if (!els.length) return;
    const lefts = els.map((e) => e.offsetLeft);
    const rights = els.map((e) => e.offsetLeft + e.offsetWidth);
    const center = (Math.min(...lefts) + Math.max(...rights)) / 2;
    scroller.scrollTo({ left: center - scroller.clientWidth / 2, behavior: 'smooth' });
  }

  PT.keyboard = { build, setLabels, clearMarks, markSelected, clearBadges, setBadge, mark, setZones, scrollToward };
})(window.PT);
