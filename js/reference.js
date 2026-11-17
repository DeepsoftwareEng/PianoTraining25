/* Bảng tra cứu nốt + mẹo nhớ cho từng khóa */
window.PT = window.PT || {};
(function (PT) {
  'use strict';
  const VF = Vex.Flow;
  const M = PT.music;
  const SVGNS = 'http://www.w3.org/2000/svg';
  // Bảng vẽ từ dòng giữa -range đến +range bậc; range tăng theo số dòng kẻ phụ cho phép (6..9)
  const rangeFor = (maxLedger) => Math.min(9, Math.max(6, 5 + 2 * maxLedger));

  let labelScale = 1; // bảng càng rộng thì chữ càng phải to (vì SVG bị thu nhỏ khi hiển thị)
  const COLORS = { line: '#2b4c8c', space: '#9a3445', anchor: '#b7790f', hint: '#1f8a4c' };

  // Nốt mốc của từng khóa và câu giải thích vì sao
  const ANCHORS = {
    'treble':        { d: 32, why: 'Vòng xoắn của khóa Sol ôm lấy dòng 2 → nốt trên dòng 2 là <b>Sol4</b>.' },
    'bass':          { d: 24, why: 'Hai chấm của khóa Fa kẹp dòng 4 → nốt trên dòng 4 là <b>Fa3</b>.' },
    'alto':          { d: 28, why: 'Tâm khóa Đô (chỗ hai nửa khóa gặp nhau) chỉ vào dòng 3 → <b>Đô4</b> (Đô giữa).' },
    'tenor':         { d: 28, why: 'Tâm khóa Đô chỉ vào dòng 4 → nốt trên dòng 4 là <b>Đô4</b> (Đô giữa).' },
    'soprano':       { d: 28, why: 'Tâm khóa Đô chỉ vào dòng 1 → nốt trên dòng 1 là <b>Đô4</b> (Đô giữa).' },
    'mezzo-soprano': { d: 28, why: 'Tâm khóa Đô chỉ vào dòng 2 → nốt trên dòng 2 là <b>Đô4</b> (Đô giữa).' },
    'baritone-c':    { d: 28, why: 'Tâm khóa Đô chỉ vào dòng 5 → nốt trên dòng 5 là <b>Đô4</b> (Đô giữa).' },
    'french':        { d: 32, why: 'Vòng xoắn khóa Sol ôm dòng 1 → nốt trên dòng 1 là <b>Sol4</b>.' },
    'subbass':       { d: 24, why: 'Hai chấm khóa Fa kẹp dòng 5 → nốt trên dòng 5 là <b>Fa3</b>.' },
  };

  // Mẹo riêng (ngoài các mẹo tính tự động)
  const EXTRA = {
    'treble': [
      'Đô5 nằm ở <b>khe thứ 3</b> — hai Đô cách nhau đúng 1 quãng tám, dễ nhận ra.',
      'Tiếng Anh: dòng kẻ <i>“Every Good Boy Does Fine”</i> (E G B D F), các khe ghép thành chữ <i>“FACE”</i>.',
    ],
    'bass': [
      'Đô giữa của khóa Fa (1 dòng kẻ phụ phía trên) đối xứng với khóa Sol (1 dòng kẻ phụ phía dưới) — cùng một phím.',
      'Đô3 nằm ở <b>khe thứ 2</b>; Sol2 nằm trên dòng 1.',
      'Tiếng Anh: dòng kẻ <i>“Good Boys Do Fine Always”</i> (G B D F A), khe <i>“All Cows Eat Grass”</i> (A C E G).',
    ],
    'alto': ['Khóa Alto hay dùng cho đàn viola. Đô giữa nằm ngay chính giữa khuông nên nốt hai bên đối xứng: Si3 ↔ Rê4, La3 ↔ Mi4.'],
    'tenor': ['Khóa Tenor hay gặp ở cello, bassoon, trombone khi chơi âm vực cao.'],
    'french': ['Tên nốt trên dòng/khe giống hệt khóa Fa, nhưng cao hơn 2 quãng tám.'],
    'subbass': ['Tên nốt trên dòng/khe giống hệt khóa Sol, nhưng thấp hơn 2 quãng tám.'],
  };

  const GENERAL = [
    '<b>Dòng → khe → dòng:</b> mỗi bước đi từ dòng lên khe ngay trên là lên đúng 1 nốt (Đô → Rê → Mi…).',
    '<b>Nhảy dòng sang dòng</b> (hoặc khe sang khe) là bỏ qua 1 tên nốt — quãng 3: Mi → Sol → Si → Rê → Fa.',
    '<b>Đừng đếm từ dưới lên.</b> Học thuộc 3–4 nốt mốc (Đô giữa, nốt của khóa…) rồi đếm từ mốc gần nhất.',
    '<b>Nhìn khóa trước tiên</b> mỗi khi gặp khuông mới — cùng một vị trí, khác khóa là khác nốt.',
  ];

  const short = (d, naming) => {
    const n = M.fromDia(d);
    if (naming === 'en') return [M.nameEn(n)];
    if (naming === 'both') return [`${M.VI[n.step]}${n.oct}`, M.nameEn(n)];
    return [`${M.VI[n.step]}${n.oct}`];
  };
  const plain = (d, naming) => short(d, naming).join(' / ');
  const isLine = (d, mid) => (d - mid) % 2 === 0;

  function positionText(d, mid) {
    const off = d - mid;
    if (off >= -4 && off <= 4) return off % 2 === 0 ? `trên dòng ${(off + 4) / 2 + 1}` : `ở khe ${(off + 3) / 2 + 1}`;
    const above = off > 0;
    const n = Math.floor((Math.abs(off) - 4) / 2);
    const onLine = off % 2 === 0;
    if (n === 0) return above ? 'ngay trên dòng 5' : 'ngay dưới dòng 1';
    return `${onLine ? 'trên' : (above ? 'ngay trên' : 'ngay dưới')} dòng kẻ phụ thứ ${n} ${above ? 'phía trên' : 'phía dưới'}`;
  }

  function compareToTreble(mid) {
    // dòng của khóa này = dòng khóa Sol dịch đi (mid - 34) bậc
    const diff = mid - 34;
    let names = ((diff % 7) + 7) % 7;
    if (names > 3) names -= 7;
    const octaves = Math.round((diff - names) / 7);
    const nameTxt = names === 0 ? 'giữ nguyên tên nốt' : `${names > 0 ? 'tiến' : 'lùi'} ${Math.abs(names)} bậc tên (ví dụ Mi → ${M.VI[(2 + names + 7) % 7]})`;
    const octTxt = octaves === 0 ? 'cùng quãng tám' : `${octaves < 0 ? 'thấp' : 'cao'} hơn ${Math.abs(octaves)} quãng tám`;
    return `So với khóa Sol: cùng vị trí thì ${nameTxt}, ${octTxt}.`;
  }

  /* ---------- Vẽ bảng nốt ---------- */
  function drawChartStave(ctx, svg, x, y, width, clefKey, naming, hintDia, range) {
    const clef = M.CLEFS[clefKey];
    const mid = clef.mid;
    const anchor = ANCHORS[clefKey];
    const stave = new VF.Stave(x, y, width).addClef(clef.vex);
    stave.setContext(ctx).draw();

    const ds = [];
    for (let d = mid - range; d <= mid + range; d++) ds.push(d);
    const notes = ds.map((d) => {
      const note = new VF.StaveNote({ clef: clef.vex, keys: [M.vexKey(M.fromDia(d))], duration: 'w' });
      let color = isLine(d, mid) ? COLORS.line : COLORS.space;
      if (anchor && d === anchor.d) color = COLORS.anchor;
      if (d === hintDia) color = COLORS.hint;
      note.setStyle({ fillStyle: color, strokeStyle: color });
      return note;
    });
    const voice = new VF.Voice({ num_beats: 4 * notes.length, beat_value: 4 }).addTickables(notes);
    new VF.Formatter().joinVoices([voice]).format([voice], width - (stave.getNoteStartX() - x) - 16);
    voice.draw(ctx, stave);

    const labelY = stave.getYForLine(4) + 34 + 12 * labelScale + (range - 6) * 5;
    notes.forEach((note, i) => {
      const d = ds[i];
      const cx = (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2;
      const isAnchor = anchor && d === anchor.d;
      const isHint = d === hintDia;
      if (isHint) {
        const ny = note.getYs()[0];
        const c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', ny); c.setAttribute('r', 13);
        c.setAttribute('class', 'ref-hint-ring');
        svg.appendChild(c);
      }
      short(d, naming).forEach((txt, row) => {
        const t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', cx);
        t.setAttribute('y', labelY + row * 13 * labelScale);
        t.style.fontSize = `${12 * labelScale}px`;
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', `ref-label ${isLine(d, mid) ? 'is-line' : 'is-space'}${isAnchor ? ' is-anchor' : ''}${isHint ? ' is-hint' : ''}${d === 28 ? ' is-middle-c' : ''}`);
        t.textContent = txt;
        svg.appendChild(t);
      });
    });
  }

  /**
   * Vẽ bảng tra cứu cho khóa của câu hỏi.
   * q: câu hỏi hiện tại; hint: true → đánh dấu vị trí nốt của câu hỏi
   */
  function render(chartEl, tipsEl, q, naming, hint, maxLedger) {
    chartEl.innerHTML = '';
    const grand = q.clefKey === 'grand';
    chartEl.classList.toggle('grand', grand);
    const range = rangeFor(maxLedger);
    const extra = (range - 6) * 5; // chỗ cho dòng kẻ phụ thêm ở trên/dưới
    const W = 140 + (2 * range + 1) * 45;
    labelScale = W / 725;
    const rowH = 150 + (naming === 'both' ? 26 : 12) * labelScale + 2 * extra;
    const H = grand ? rowH * 2 + 6 : rowH;
    const renderer = new VF.Renderer(chartEl, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();
    const svg = chartEl.querySelector('svg');
    // vị trí cần khoanh trên từng khuông (chế độ hai tay có 2 nốt)
    const hintOn = (staff) => { const p = hint && q.parts.find((x) => grand ? x.staff === staff : true); return p ? M.dia(p.note) : null; };

    if (grand) {
      drawChartStave(ctx, svg, 30, extra, W - 40, 'treble', naming, hintOn('treble'), range);
      drawChartStave(ctx, svg, 30, rowH + 6 + extra, W - 40, 'bass', naming, hintOn('bass'), range);
    } else {
      drawChartStave(ctx, svg, 10, extra, W - 20, q.clefKey, naming, hintOn(q.clefKey), range);
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '';
    svg.style.height = '';

    tipsEl.innerHTML = (grand ? ['treble', 'bass'] : [q.clefKey]).map((k) => tipsHtml(k, naming)).join('')
      + `<div class="tip-block tip-general"><h4>Mẹo chung</h4><ul>${GENERAL.map((g) => `<li>${g}</li>`).join('')}</ul></div>`;
  }

  function tipsHtml(clefKey, naming) {
    const clef = M.CLEFS[clefKey];
    const mid = clef.mid;
    const lines = [-4, -2, 0, 2, 4].map((o) => plain(mid + o, naming));
    const spaces = [-3, -1, 1, 3].map((o) => plain(mid + o, naming));
    const anchor = ANCHORS[clefKey];
    const items = [];
    if (anchor) items.push(`<li class="tip-anchor">★ <b>Nốt mốc:</b> ${anchor.why}</li>`);
    items.push(`<li><span class="dot dot-line"></span><b>5 dòng kẻ</b> (dưới → trên): ${lines.join(' – ')}</li>`);
    items.push(`<li><span class="dot dot-space"></span><b>4 khe</b> (dưới → trên): ${spaces.join(' – ')}</li>`);
    items.push(`<li><b>Đô giữa</b> (Đô4) nằm ${positionText(28, mid)}.</li>`);
    if (clefKey !== 'treble') items.push(`<li>${compareToTreble(mid)}</li>`);
    (EXTRA[clefKey] || []).forEach((t) => items.push(`<li>${t}</li>`));
    return `<div class="tip-block"><h4>${clef.label} <small>${clef.detail}</small></h4><ul>${items.join('')}</ul></div>`;
  }

  function hintText(q, naming, maxLedger) {
    return q.parts.map((p) => {
      const staff = q.clefKey === 'grand' ? p.staff : q.clefKey;
      const mid = M.CLEFS[staff].mid;
      const d = M.dia(p.note);
      const acc = p.note.acc === 1 ? ' — dấu thăng ♯: phím đen ngay bên phải' : p.note.acc === -1 ? ' — dấu giáng ♭: phím đen ngay bên trái' : '';
      const ring = Math.abs(d - mid) <= rangeFor(maxLedger) ? ' (vòng xanh)' : '';
      const who = q.both ? `<b>${p.hand === 'R' ? 'Tay phải' : 'Tay trái'}:</b> nốt ` : 'Nốt ';
      return `${who}nằm <b>${positionText(d, mid)}</b>${ring}${acc}`;
    }).join(' · ') + '.';
  }

  PT.reference = { render, hintText };
})(window.PT);
