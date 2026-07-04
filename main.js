// ============================================================
// PHYSICS ENGINE
// Simplified but physically-grounded model of a gravity flush:
//   Part 1: hydrostatic head -> orifice (Torricelli + viscous-corrected Cd)
//   Part 2: conservation of flow rate split across N rim holes,
//           Hagen-Poiseuille wall shear stress per hole
//   Part 3: synthesis -> flush duration + pass/fail heuristic
// ============================================================

const RHO = 1000;      // kg/m^3, water/soap-solution density (assumed ~constant)
const G = 9.81;        // m/s^2
const TANK_VOLUME_L = 6; // liters, a fairly typical tank flush volume

const state = {
  H: 15,        // tank water height above valve, cm
  dValve: 45,   // flush valve opening diameter, mm
  mu: 1,        // viscosity, mPa*s (1 = water)
  nHoles: 8,    // number of rim holes
  dHole: 6,     // rim hole diameter, mm
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function compute(s) {
  const H = s.H / 100;                 // m
  const mu = s.mu / 1000;              // Pa*s
  const dValve = s.dValve / 1000;      // m
  const rValve = dValve / 2;
  const Avalve = Math.PI * rValve * rValve;

  // --- Part 1: hydrostatic pressure + orifice flow ---
  const Phydro = RHO * G * H;                    // Pa
  const vIdeal = Math.sqrt(2 * G * H);           // Torricelli, m/s

  // Empirical viscous discharge-coefficient correction: Cd falls off as
  // orifice Reynolds number drops (same qualitative shape as published
  // Cd-vs-Re orifice correlations, e.g. Lichtarowicz-type curves).
  const Re = (RHO * vIdeal * dValve) / mu;
  const Cd0 = 0.62;
  const K = 3000;
  const Cd = clamp(Cd0 * (Re / (Re + K)), 0.02, Cd0);

  const vExit = Cd * vIdeal;             // m/s
  const Q = vExit * Avalve;              // m^3/s
  const Q_Lps = Q * 1000;

  // --- Part 2: distribution across rim holes ---
  const dHole = s.dHole / 1000;
  const rHole = dHole / 2;
  const Ahole = Math.PI * rHole * rHole;
  const AholesTotal = s.nHoles * Ahole;

  // assume the total flow splits evenly across all rim holes
  const vHole = s.nHoles > 0 ? Q / (s.nHoles * Ahole) : 0;
  const tauWall = rHole > 0 ? (4 * mu * vHole) / rHole : 0; // Hagen-Poiseuille wall shear, Pa
  const Pdyn = 0.5 * RHO * vHole * vHole;                    // dynamic pressure at hole, Pa
  const ReHole = (RHO * vHole * dHole) / mu;

  // --- Part 3: synthesis ---
  const Vtank = TANK_VOLUME_L / 1000; // m^3
  const tFlush = Q > 1e-9 ? Vtank / Q : Infinity; // idealized constant-flow drain time, s

  const QOK = Q_Lps > 0.4;
  const shearOK = tauWall > 0.08;
  const success = QOK && shearOK && isFinite(tFlush) && tFlush < 25;

  return {
    H, mu, dValve, Avalve, Phydro, vIdeal, Re, Cd, vExit, Q, Q_Lps,
    dHole, Ahole, AholesTotal, vHole, tauWall, Pdyn, ReHole,
    Vtank, tFlush, QOK, shearOK, success,
  };
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

function fmt(n, d = 1) {
  if (!isFinite(n)) return '∞';
  return n.toFixed(d);
}

function lerp(a, b, t) { return a + (b - a) * t; }
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

// ============================================================
// RENDER: PART 1 — TANK & VALVE
// ============================================================

function renderPart1(d, s) {
  const W = 900, H = 460;
  const tankTop = 50, tankBottom = 300;
  const tankLeft = 230, tankRight = 670;
  const maxHcm = 32;
  const waterFrac = clamp(s.H / maxHcm, 0.05, 1);
  const waterTop = tankBottom - waterFrac * (tankBottom - tankTop);

  const maxValveMm = 90;
  const gapHalf = clamp((s.dValve / maxValveMm) * 90, 18, 95);
  const gapCenter = (tankLeft + tankRight) / 2;
  const gapL = gapCenter - gapHalf, gapR = gapCenter + gapHalf;

  // streamlines: from surface converging into the gap
  let streams = '';
  const nStream = 7;
  for (let i = 0; i < nStream; i++) {
    const t = i / (nStream - 1);
    const startX = lerp(tankLeft + 25, tankRight - 25, t);
    const midY = lerp(waterTop + 20, tankBottom - 10, 0.55);
    const endX = lerp(gapL + 8, gapR - 8, t);
    const dashDelay = (i * 0.15).toFixed(2);
    streams += `<path class="flow-path" d="M ${startX} ${waterTop + 14} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${tankBottom - 6}"
      fill="none" stroke="var(--teal)" stroke-width="2" opacity="0.55" style="animation-delay:-${dashDelay}s"/>`;
  }

  // exit jet below the valve, into the bowl area, length scaled with vExit
  const jetLen = clamp(d.vExit * 40, 20, 120);
  const jetStreams = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x = lerp(gapL + 10, gapR - 10, t);
    jetStreams.push(`<path class="flow-path" d="M ${x} ${tankBottom} L ${x} ${tankBottom + jetLen}"
      stroke="var(--orange)" stroke-width="2.5" opacity="0.75" stroke-linecap="round"/>`);
  }

  const pressureShade = clamp(d.Phydro / 3500, 0.15, 0.85);

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#2dd4bf" stop-opacity="${pressureShade}"/>
      </linearGradient>
      <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--pink)"/>
      </marker>
    </defs>

    <!-- gravity arrow -->
    <line x1="790" y1="55" x2="790" y2="110" stroke="var(--pink)" stroke-width="2.5" marker-end="url(#arrowRed)"/>
    <text x="800" y="90" fill="var(--pink)" font-size="15" font-weight="700" font-family="var(--sans)">g</text>

    <!-- tank walls -->
    <path d="M ${tankLeft} ${tankTop} L ${tankLeft} ${tankBottom} L ${gapL} ${tankBottom}
             M ${gapR} ${tankBottom} L ${tankRight} ${tankBottom} L ${tankRight} ${tankTop}"
          fill="none" stroke="#3a5468" stroke-width="3" stroke-linejoin="round"/>

    <!-- water fill -->
    <rect x="${tankLeft + 2}" y="${waterTop}" width="${tankRight - tankLeft - 4}" height="${tankBottom - waterTop}"
          fill="url(#waterGrad)"/>
    <line x1="${tankLeft + 2}" y1="${waterTop}" x2="${tankRight - 2}" y2="${waterTop}"
          stroke="var(--teal)" stroke-width="2"/>

    <!-- streamlines -->
    ${streams}

    <!-- valve gate marks -->
    <line x1="${gapL - 14}" y1="${tankBottom}" x2="${gapL}" y2="${tankBottom + 14}" stroke="var(--muted)" stroke-width="3"/>
    <line x1="${gapR + 14}" y1="${tankBottom}" x2="${gapR}" y2="${tankBottom + 14}" stroke="var(--muted)" stroke-width="3"/>

    <!-- exit jet -->
    ${jetStreams.join('')}

    <!-- bowl basin hint -->
    <path d="M ${gapL - 60} ${tankBottom + jetLen + 10}
             Q ${gapCenter} ${tankBottom + jetLen + 60}, ${gapR + 60} ${tankBottom + jetLen + 10}"
          fill="none" stroke="#2a4054" stroke-width="2" stroke-dasharray="3 5"/>

    <!-- labels -->
    <text x="${tankLeft + 10}" y="${tankTop - 14}" fill="var(--muted)" font-size="14" font-family="var(--sans)">tank / cistern</text>
    <text x="${gapCenter - 46}" y="${tankBottom + 30}" fill="var(--muted)" font-size="13" font-family="var(--sans)">flush valve</text>
    <text x="${tankLeft + 14}" y="${waterTop - 10}" fill="var(--teal)" font-size="13" font-weight="600" font-family="var(--sans)">H = ${fmt(s.H,0)} cm</text>

    <g font-family="var(--mono)">
      <text x="${gapCenter}" y="${tankBottom + jetLen + 55}" text-anchor="middle" fill="var(--orange)" font-size="15" font-weight="700">v = ${fmt(d.vExit,2)} m/s</text>
    </g>
  </svg>`;
  document.getElementById('svgPart1').innerHTML = svg;
}

// ============================================================
// RENDER: PART 2 — RIM DISTRIBUTION
// ============================================================

function renderPart2(d, s) {
  const W = 900, H = 460;
  const cx = 450, cy = 240;
  const rx = 260, ry = 150;

  const maxTau = 40; // Pa, for color-scaling the shear intensity
  const tIntensity = clamp(d.tauWall / maxTau, 0, 1);
  const color = intensityColor(tIntensity);
  const arrowLen = clamp(6 + d.vHole * 2.5, 10, 46);

  let holes = '';
  const n = s.nHoles;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const hx = cx + rx * Math.cos(ang);
    const hy = cy + ry * Math.sin(ang);
    // inward-pointing jet direction (toward center, tangentially biased)
    const nx = (cx - hx), ny = (cy - hy);
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    const dx = (nx / nlen) * arrowLen;
    const dy = (ny / nlen) * arrowLen;
    holes += `
      <circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="6" fill="${color}" stroke="#0c1826" stroke-width="1.5"/>
      <line class="flow-path" x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${(hx + dx).toFixed(1)}" y2="${(hy + dy).toFixed(1)}"
            stroke="${color}" stroke-width="2.5" opacity="0.85" stroke-linecap="round"/>`;
  }

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#3a5468" stroke-width="3"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 34}" ry="${ry - 20}" fill="#0c1826" stroke="#22374a" stroke-width="1.5" stroke-dasharray="2 5"/>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="var(--muted)" font-size="13" font-family="var(--sans)">bowl (top view)</text>
    ${holes}
    <text x="24" y="30" fill="var(--muted)" font-size="14" font-family="var(--sans)">${n} rim holes · Ø ${fmt(s.dHole,1)} mm each</text>
    <g font-family="var(--mono)">
      <text x="24" y="418" fill="var(--orange)" font-size="15" font-weight="700">v_hole = ${fmt(d.vHole,2)} m/s</text>
      <text x="24" y="440" fill="${color}" font-size="15" font-weight="700">τ_wall = ${fmt(d.tauWall,2)} Pa</text>
    </g>
  </svg>`;
  document.getElementById('svgPart2').innerHTML = svg;
}

// ============================================================
// RENDER: PART 3 — OVERALL SYNTHESIS
// ============================================================

function renderPart3(d, s) {
  const W = 900, H = 460;
  const success = d.success;
  const statusColor = success ? 'var(--success)' : 'var(--fail)';

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <!-- tank -->
    <rect x="560" y="60" width="150" height="140" rx="10" fill="none" stroke="#3a5468" stroke-width="3"/>
    <rect x="566" y="${60 + (1 - clamp(s.H/32,0.05,1))*130 + 6}" width="138" height="${clamp(s.H/32,0.05,1)*130}" fill="#2dd4bf" opacity="0.28"/>
    <text x="635" y="215" text-anchor="middle" fill="var(--muted)" font-size="12" font-family="var(--sans)">tank</text>

    <!-- pipe from tank to bowl -->
    <path d="M 610 200 L 610 240 L 520 260" fill="none" stroke="#3a5468" stroke-width="10" stroke-linecap="round"/>

    <!-- bowl -->
    <path d="M 380 250 Q 380 260, ... " opacity="0"/>
    <ellipse cx="470" cy="300" rx="150" ry="90" fill="none" stroke="#3a5468" stroke-width="4"/>
    <ellipse cx="470" cy="300" rx="110" ry="60" fill="#0c1826" stroke="#22374a" stroke-width="2"/>

    <!-- trapway -->
    <path d="M 400 360 C 380 420, 300 430, 260 460" fill="none" stroke="#3a5468" stroke-width="14" stroke-linecap="round"/>

    <!-- waste marker -->
    <ellipse cx="470" cy="300" rx="26" ry="15"
      fill="${success ? 'none' : '#8a6a3a'}" stroke="${success ? 'none' : '#a9814a'}" stroke-width="1.5"
      opacity="${success ? 0 : 0.9}"/>

    <!-- flow arrows through trapway if success -->
    ${success ? `
      <path class="flow-path" d="M 420 340 C 400 400, 320 415, 275 450" fill="none" stroke="var(--teal)" stroke-width="3" opacity="0.8"/>
    ` : `
      <path d="M 420 340 C 400 380, 350 390, 320 400" fill="none" stroke="var(--fail)" stroke-width="2" stroke-dasharray="3 5" opacity="0.6"/>
    `}

    <!-- status badge -->
    <g>
      <rect x="620" y="330" width="230" height="90" rx="12" fill="${success ? 'rgba(52,211,153,0.1)' : 'rgba(240,97,111,0.1)'}" stroke="${statusColor}" stroke-width="1.5"/>
      <text x="735" y="362" text-anchor="middle" fill="${statusColor}" font-size="20" font-weight="800" font-family="var(--sans)">${success ? '✓ SUCCESS' : '✗ FAILURE'}</text>
      <text x="735" y="386" text-anchor="middle" fill="var(--muted)" font-size="12.5" font-family="var(--sans)">${success ? 'waste cleared the trapway' : 'waste still in bowl'}</text>
      <text x="735" y="405" text-anchor="middle" fill="var(--muted-dim)" font-size="11.5" font-family="var(--mono)">t_flush ≈ ${isFinite(d.tFlush) ? fmt(d.tFlush,1)+'s' : '∞'}</text>
    </g>

    <text x="40" y="40" fill="var(--muted)" font-size="14" font-family="var(--sans)">side view · synthesis of parts 1 &amp; 2</text>
  </svg>`;
  document.getElementById('svgPart3').innerHTML = svg;
}

// ============================================================
// READOUTS + MINI STATS
// ============================================================

function renderReadouts(d) {
  document.getElementById('roQ').textContent = fmt(d.Q_Lps, 2);
  document.getElementById('roPhydro').textContent = fmt(d.Phydro / 1000, 2);
  document.getElementById('roCd').textContent = fmt(d.Cd, 2);
  document.getElementById('roTau').textContent = fmt(d.tauWall, 2);
  document.getElementById('roVhole').textContent = fmt(d.vHole, 2);
  document.getElementById('roRe').textContent = Math.round(d.Re).toLocaleString();

  const reTag = document.getElementById('roReTag');
  if (d.Re < 2300) {
    reTag.textContent = 'laminar';
    reTag.className = 'tag tag-laminar';
  } else {
    reTag.textContent = 'turbulent';
    reTag.className = 'tag tag-turbulent';
  }

  const verdict = document.getElementById('verdictCard');
  const headline = document.getElementById('verdictHeadline');
  const detail = document.getElementById('verdictDetail');
  verdict.className = 'verdict-card ' + (d.success ? 'success' : 'fail');
  headline.textContent = d.success ? '✓ FLUSH SUCCEEDS' : '✗ FLUSH FAILS';
  if (d.success) {
    detail.textContent = `~${fmt(d.Q_Lps,2)} L/s exits the valve and clears the bowl in about ${fmt(d.tFlush,1)}s.`;
  } else if (!d.QOK) {
    detail.textContent = `Flow rate is only ${fmt(d.Q_Lps,3)} L/s — too weak to push a full flush cycle.`;
  } else if (!d.shearOK) {
    detail.textContent = `Wall shear stress (${fmt(d.tauWall,2)} Pa) is too low to scour the bowl clean.`;
  } else {
    detail.textContent = `Flush drains too slowly (${fmt(d.tFlush,1)}s) to work in practice.`;
  }
}

function updateSliderFill(input) {
  const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--pct', pct + '%');
}

// ============================================================
// WIRE-UP
// ============================================================

const sliderIds = {
  H: 'sliderH', dValve: 'sliderDValve', mu: 'sliderMu',
  nHoles: 'sliderNHoles', dHole: 'sliderDHole',
};

const labelIds = {
  H: 'labelH', dValve: 'labelDValve', mu: 'labelMu',
  nHoles: 'labelNHoles', dHole: 'labelDHole',
};

function renderAll() {
  const d = compute(state);
  renderPart1(d, state);
  renderPart2(d, state);
  renderPart3(d, state);
  renderReadouts(d);
}

function setupSlider(key, formatFn) {
  const el = document.getElementById(sliderIds[key]);
  const lbl = document.getElementById(labelIds[key]);
  el.value = state[key];
  updateSliderFill(el);
  lbl.textContent = formatFn(state[key]);
  el.addEventListener('input', () => {
    state[key] = parseFloat(el.value);
    updateSliderFill(el);
    lbl.textContent = formatFn(state[key]);
    clearPresetActive();
    renderAll();
  });
}

function clearPresetActive() {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
}

function setupPresets() {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mu = parseFloat(btn.dataset.mu);
      state.mu = mu;
      const el = document.getElementById(sliderIds.mu);
      el.value = mu;
      updateSliderFill(el);
      document.getElementById(labelIds.mu).textContent = `${mu} mPa·s`;
      clearPresetActive();
      btn.classList.add('active');
      renderAll();
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  setupSlider('H', v => `${fmt(v,0)} cm`);
  setupSlider('dValve', v => `${fmt(v,0)} mm`);
  setupSlider('mu', v => `${fmt(v,0)} mPa·s`);
  setupSlider('nHoles', v => `${fmt(v,0)}`);
  setupSlider('dHole', v => `${fmt(v,1)} mm`);
  setupPresets();
  document.querySelector(`.preset-btn[data-mu="1"]`).classList.add('active');
  renderAll();
});
