/* Âm thanh piano đơn giản bằng Web Audio */
window.PT = window.PT || {};
(function (PT) {
  'use strict';
  let ctx = null;

  function play(midi, { volume = 0.35, duration = 1.6 } = {}) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(volume, t + 0.008);
      out.gain.exponentialRampToValueAtTime(volume * 0.35, t + 0.25);
      out.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(8000, f * 8), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2), t + duration);
      lp.connect(out).connect(ctx.destination);
      // vài họa âm cho tiếng ấm hơn
      [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([mul, type, g]) => {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = type;
        o.frequency.value = f * mul;
        og.gain.value = g;
        o.connect(og).connect(lp);
        o.start(t);
        o.stop(t + duration + 0.05);
      });
    } catch (e) { /* trình duyệt không hỗ trợ — bỏ qua */ }
  }

  PT.audio = { play };
})(window.PT);
