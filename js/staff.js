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

  function render(el, q) {
    el.innerHTML = '';
    const grand = q.clefKey === 'grand';
    const W = 340;
    const H = grand ? 330 : 210;
    const renderer = new VF.Renderer(el, VF.Renderer.Backends.SVG);
    renderer.resize(W, H);
    const ctx = renderer.getContext();

    if (grand) {
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
  }

  PT.staff = { render };
})(window.PT);
