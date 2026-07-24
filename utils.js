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

// color scale teal -> orange -> pink for shear/velocity intensity
function intensityColor(t) {
  t = clamp(t, 0, 1);
  if (t < 0.5) return lerpColor('2dd4bf', 'f5a623', t / 0.5);
  return lerpColor('f5a623', 'f0616f', (t - 0.5) / 0.5);
}

function reRegime(re) {
  if (re < 2000) return { label: 'Laminar', color: '#2dd4bf', desc: 'fluid moves in smooth layers' };
  if (re <= 4000) return { label: 'Transitional', color: '#f5a623', desc: 'unstable — can flip between laminar and turbulent' };
  return { label: 'Turbulent', color: '#f0616f', desc: 'chaotic, vortices, mixing' };
}