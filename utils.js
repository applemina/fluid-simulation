// js/utils.js
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fmt(n, d = 1) {
  if (!isFinite(n)) return '∞';
  return n.toFixed(d);
}

function lerpColor(c1, c2, t) {
  const p1 = c1.match(/\w\w/g).map(x => parseInt(x, 16));
  const p2 = c2.match(/\w\w/g).map(x => parseInt(x, 16));
  const rgb = p1.map((c, i) => Math.round(lerp(c, p2[i], clamp(t, 0, 1))));
  return `rgb(${rgb.join(',')})`;
}
