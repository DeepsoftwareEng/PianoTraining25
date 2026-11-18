/* Vẽ khuông nhạc bằng VexFlow */
window.PT = window.PT || {};
(function (PT) {
  'use strict';
  const VF = Vex.Flow;
  const M = PT.music;

  function makeNote(part, clef) {
    const note = new VF.StaveNote({ clef, keys: [M.vexKey(part.note)], duration: 'w' });
    if (part.note.acc) note.addModifier(new VF.Accidental(part.note.acc === 1 ? '#' : 'b'), 0);
    return note;
  }

  // Vẽ các nốt (mỗi nốt kèm khuông của nó), canh giữa và thẳng hàng dọc với nhau
  function drawNotes(ctx, staves, items) {
    const start = Math.max(...staves.map((s) => s.getNoteStartX()));
    const end = staves[0].getX() + staves[0].getWidth();
    const x = start + (end - start) / 2 - 22;
    staves.forEach((s) => s.setNoteStartX(x));
    const voices = items.map(({ stave, note }) => ({
      stave,
      voice: new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables([note]),
    }));
    new VF.Formatter().format(voices.map((v) => v.voice), 40);
    voices.forEach(({ voice, stave }) => voice.draw(ctx, stave));
  }

  /* ---------- Câu nhạc ---------- */
  const FIRST_COLOR = '#c2410c';
  // reveal = true → ghi số ngón trên/dưới mọi nốt; false → chỉ dấu "?" ở nốt đầu
  function makePhraseNotes(part, clef, reveal) {
    const shown = new Set(); // dấu hóa chỉ ghi ở lần xuất hiện đầu (hiệu lực cả ô nhịp)
    const above = part.hand === 'R';
    return part.notes.map((n, i) => {
      const sn = new VF.StaveNote({ clef, keys: [M.vexKey(n)], duration: 'q', auto_stem: true });
      const d = M.dia(n);
      if (n.acc && !shown.has(d)) sn.addModifier(new VF.Accidental(n.acc === 1 ? '#' : 'b'), 0);
      shown.add(d);
      if (i === 0) sn.setStyle({ fillStyle: FIRST_COLOR, strokeStyle: FIRST_COLOR });
      const text = reveal ? String(M.fingerFor(part.hand, part.low, d)) : (i === 0 ? '?' : null);
      if (text) {
        const a = new VF.Annotation(text)
          .setVerticalJustification(above ? VF.Annotation.VerticalJustify.TOP : VF.Annotation.VerticalJustify.BOTTOM);
        a.setFont('Arial', 15, 'bold');
        if (i === 0) a.setStyle({ fillStyle: FIRST_COLOR, strokeStyle: FIRST_COLOR });
        sn.addModifier(a, 0);
      }
      return sn;
    });
  }

  function drawPhrase(ctx, staves, items) {
    const start = Math.max(...staves.map((s) => s.getNoteStartX()));
    staves.forEach((s) => s.setNoteStartX(start));
    const end = staves[0].getX() + staves[0].getWidth();
    const voices = items.map(({ stave, notes }) => ({
      stave,
      voice: new VF.Voice({ num_beats: notes.length, beat_value: 4 }).addTickables(notes),
    }));
    new VF.Formatter().format(voices.map((v) => v.voice), end - start - 24);
    voices.forEach(({ voice, stave }) => voice.draw(ctx, stave));
  }

  function render(el, q, reveal = false) {
    el.innerHTML = '';
    const grand = q.clefKey === 'grand';
    const phrase = !!q.phrase;
    const len = phrase ? q.parts[0].notes.length : 1;
    const W = phrase ? Math.max(340, 150 + len * 48) : 340;
    const pad = phrase ? 20 : 0; // chừa chỗ cho số ngón trên/dưới khuông
    const H = (grand ? 330 : 210) + 2 * pad;
    const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    if (phrase) {
      if (grand) {
        const top = new VF.Stave(46, 20 + pad, W - 70).addClef('treble');
        const bot = new VF.Stave(46, 150 + pad, W - 70).addClef('bass');
        top.setContext(ctx).draw();
        bot.setContext(ctx).draw();
        new VF.StaveConnector(top, bot).setType('brace').setContext(ctx).draw();
        new VF.StaveConnector(top, bot).setType('singleLeft').setContext(ctx).draw();
        new VF.StaveConnector(top, bot).setType('singleRight').setContext(ctx).draw();
        const byStaff = { treble: top, bass: bot };
        // khuông còn lại (chế độ một tay) để trống, vẫn cần căn lề cùng
        drawPhrase(ctx, [top, bot], q.parts.map((p) => ({ stave: byStaff[p.staff], notes: makePhraseNotes(p, p.staff, reveal) })));
      } else {
        const clef = M.CLEFS[q.clefKey].vex;
        const stave = new VF.Stave(20, 40 + pad, W - 40).addClef(clef);
        stave.setContext(ctx).draw();
        drawPhrase(ctx, [stave], q.parts.map((p) => ({ stave, notes: makePhraseNotes(p, clef, reveal) })));
      }
    } else if (grand) {
      const top = new VF.Stave(46, 20, 270).addClef('treble');
      const bot = new VF.Stave(46, 150, 270).addClef('bass');
      top.setContext(ctx).draw();
      bot.setContext(ctx).draw();
      new VF.StaveConnector(top, bot).setType('brace').setContext(ctx).draw();
      new VF.StaveConnector(top, bot).setType('singleLeft').setContext(ctx).draw();
      new VF.StaveConnector(top, bot).setType('singleRight').setContext(ctx).draw();
      drawNotes(ctx, [top, bot], q.parts.map((p) => ({
        stave: p.staff === 'treble' ? top : bot,
        note: makeNote(p, p.staff),
      })));
    } else {
      const clef = M.CLEFS[q.clefKey].vex;
      const stave = new VF.Stave(20, 40, 300).addClef(clef);
      stave.setContext(ctx).draw();
      drawNotes(ctx, [stave], q.parts.map((p) => ({ stave, note: makeNote(p, clef) })));
    }

    const svg = el.querySelector('svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '';
    svg.style.height = '';
    svg.classList.toggle('grand', grand);
    svg.classList.toggle('phrase', phrase);
  }

  PT.staff = { render };
})(window.PT);
