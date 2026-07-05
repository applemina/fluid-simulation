// ============================================================
// PHYSICS ENGINE
// Simplified but physically-grounded model of a gravity flush:
//   Part 1: hydrostatic head -> orifice (Torricelli + viscous-corrected Cd)
//   Part 2: conservation of flow rate along the rim channel + through N holes,
//           Hagen-Poiseuille wall shear stress, channel velocity decay
//   Part 3: synthesis -> flush duration + pass/fail heuristic
// ============================================================

const RHO = 1000;        // kg/m^3, water/soap-solution density (assumed ~constant)
const G = 9.81;          // m/s^2

// Fixed real-world tank footprint (per spec)
const TANK_WIDTH_CM = 12;   // front-to-back depth of the tank
const TANK_LENGTH_CM = 50;  // vertical height of the tank body

const MU_MIN = 1, MU_MAX = 500; // mPa*s, log-scale slider range

const state = {
  H: 20,        // tank water height above valve, cm
  dValve: 45,   // flush valve opening diameter, mm
  mu: 1,        // viscosity, mPa*s (1 = water)
  nHoles: 8,    // number of rim holes
  dHole: 6,     // rim hole diameter, mm
  rimCavity: 16,// rim channel diameter, mm (cross-section fluid travels through)
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

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

  // --- Part 2: distribution across rim holes + channel decay ---
  const dHole = s.dHole / 1000;
  const rHole = dHole / 2;
  const Ahole = Math.PI * rHole * rHole;
  const AholesTotal = s.nHoles * Ahole;

  const dChannel = s.rimCavity / 1000;
  const rChannel = dChannel / 2;
  const Achannel = Math.PI * rChannel * rChannel;

  // assume the total flow splits evenly across all rim holes
  const vHole = s.nHoles > 0 ? Q / (s.nHoles * Ahole) : 0;
  const tauWall = rHole > 0 ? (4 * mu * vHole) / rHole : 0; // Hagen-Poiseuille wall shear, Pa
  const Pdyn = 0.5 * RHO * vHole * vHole;                    // dynamic pressure at hole, Pa
  const ReHole = (RHO * vHole * dHole) / mu;

  // Channel velocity profile: water enters at the top (start, i=0) and
  // progressively discharges through each hole travelling around the rim,
  // so the flow REMAINING in the channel -- and hence its velocity --
  // decreases monotonically from the start point onward (continuity).
  const channelProfile = [];
  for (let i = 0; i < s.nHoles; i++) {
    const fracRemaining = (s.nHoles - i) / s.nHoles; // flow still in channel just before hole i
    const qRemaining = Q * fracRemaining;
    const vChan = Achannel > 0 ? qRemaining / Achannel : 0;
    channelProfile.push({ i, angleFrac: i / s.nHoles, vChan });
  }
  const vChannelStart = Achannel > 0 ? Q / Achannel : 0;
  const vChannelEnd = Achannel > 0 ? (Q / s.nHoles) / Achannel : 0;

  // --- Part 3: synthesis ---
  // Flush volume = actual tank footprint (12cm x 50cm) x current water height,
  // not an arbitrary constant -- so tFlush responds to the H slider too.
  const Vtank = (TANK_WIDTH_CM / 100) * (TANK_LENGTH_CM / 100) * H; // m^3
  const tFlush = Q > 1e-9 ? Vtank / Q : Infinity; // idealized constant-flow drain time, s

  const QOK = Q_Lps > 0.4;
  const shearOK = tauWall > 0.08;
  const success = QOK && shearOK && isFinite(tFlush) && tFlush < 25;

  return {
    H, mu, dValve, Avalve, Phydro, vIdeal, Re, Cd, vExit, Q, Q_Lps,
    dHole, Ahole, AholesTotal, vHole, tauWall, Pdyn, ReHole,
    dChannel, Achannel, channelProfile, vChannelStart, vChannelEnd,
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

// Reynolds number classification (shared definition used across the UI)
function reRegime(re) {
  if (re < 2000) return { label: 'Laminar', color: '#2dd4bf', desc: 'fluid moves in smooth layers' };
  if (re <= 4000) return { label: 'Transitional', color: '#f5a623', desc: 'unstable — can flip between laminar and turbulent' };
  return { label: 'Turbulent', color: '#f0616f', desc: 'chaotic, vortices, mixing' };
}

// ============================================================
// RENDER: PART 1 — TANK & VALVE (recognizable cistern cutaway)
// ============================================================

function renderPart1(d, s) {
  const W = 900, Hh = 460;

  const pxPerCm = 6.2;
  const tankW = TANK_WIDTH_CM * pxPerCm;
  const tankH = TANK_LENGTH_CM * pxPerCm;
  const tankLeft = 130, tankTop = 46;
  const tankRight = tankLeft + tankW, tankBottom = tankTop + tankH;

  const maxHcm = TANK_LENGTH_CM - 5;
  const waterFrac = clamp(s.H / maxHcm, 0.04, 1);
  const waterTop = tankBottom - waterFrac * tankH;

  const maxValveMm = 90;
  const gapHalf = clamp((s.dValve / maxValveMm) * (tankW / 2 - 6), 8, tankW / 2 - 4);
  const gapCenter = (tankLeft + tankRight) / 2;
  const gapL = gapCenter - gapHalf, gapR = gapCenter + gapHalf;

  const fillValveX = tankLeft + 12;
  const floatY = clamp(waterTop + 6, tankTop + 30, tankBottom - 20);

  const leverX = tankRight - 16, leverY = tankTop + 16;
  const flapperCx = gapCenter, flapperCy = tankBottom - 6;
  const chainPts = [];
  const chainN = 6;
  for (let i = 0; i <= chainN; i++) {
    const t = i / chainN;
    chainPts.push(`${lerp(leverX - 6, flapperCx + gapHalf * 0.4, t).toFixed(1)},${lerp(leverY + 8, flapperCy - 10, t).toFixed(1)}`);
  }

  let streams = '';
  const nStream = 6;
  for (let i = 0; i < nStream; i++) {
    const t = i / (nStream - 1);
    const startX = lerp(tankLeft + 14, tankRight - 10, t);
    const midY = lerp(waterTop + 20, tankBottom - 10, 0.6);
    const endX = lerp(gapL + 6, gapR - 6, t);
    const dashDelay = (i * 0.15).toFixed(2);
    streams += `<path class="flow-path" d="M ${startX} ${Math.max(waterTop + 10, tankTop + 20)} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${tankBottom - 4}"
      fill="none" stroke="var(--teal)" stroke-width="2" opacity="0.5" style="animation-delay:-${dashDelay}s"/>`;
  }

  const jetLen = clamp(d.vExit * 34, 18, 110);
  const jetStreams = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x = lerp(gapL + 6, gapR - 6, t);
    jetStreams.push(`<path class="flow-path" d="M ${x} ${tankBottom} L ${x} ${tankBottom + jetLen}"
      stroke="var(--orange)" stroke-width="2.5" opacity="0.8" stroke-linecap="round"/>`);
  }

  const gaugeX = tankRight + 34;
  const gaugeTop = tankTop, gaugeBottom = tankBottom;
  const gaugeSurfaceY = waterTop;
  const gaugeValveY = tankBottom;

  const eqX = gaugeX + 60, eqY = tankTop + 6;

  const svg = `
  <svg viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="waterGrad1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="#0e9384" stop-opacity="0.85"/>
      </linearGradient>
      <linearGradient id="pgaugeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#12786c" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#2dd4bf" stop-opacity="0.9"/>
      </linearGradient>
      <marker id="arrowRed1" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--pink)"/>
      </marker>
    </defs>

    <line x1="${tankLeft - 60}" y1="${tankTop + 4}" x2="${tankLeft - 60}" y2="${tankTop + 54}" stroke="var(--pink)" stroke-width="2.5" marker-end="url(#arrowRed1)"/>
    <text x="${tankLeft - 50}" y="${tankTop + 36}" fill="var(--pink)" font-size="15" font-weight="700" font-family="var(--sans)">g</text>

    <path d="M ${tankLeft} ${tankTop + 14}
             Q ${tankLeft} ${tankTop}, ${tankLeft + 14} ${tankTop}
             L ${tankRight - 14} ${tankTop}
             Q ${tankRight} ${tankTop}, ${tankRight} ${tankTop + 14}
             L ${tankRight} ${tankBottom}
             L ${gapR} ${tankBottom}
             M ${gapL} ${tankBottom}
             L ${tankLeft} ${tankBottom}
             L ${tankLeft} ${tankTop + 14} Z"
          fill="none" stroke="#5c7286" stroke-width="3" stroke-linejoin="round"/>

    <rect x="${tankLeft + 3}" y="${waterTop}" width="${tankW - 6}" height="${tankBottom - waterTop}" fill="url(#waterGrad1)"/>
    <line x1="${tankLeft + 3}" y1="${waterTop}" x2="${tankRight - 3}" y2="${waterTop}" stroke="var(--teal)" stroke-width="2"/>

    <rect x="${fillValveX}" y="${tankTop + 8}" width="9" height="${floatY - tankTop - 4}" rx="3" fill="#3b82f6"/>
    <circle cx="${fillValveX + 4}" cy="${tankTop + 8}" r="6" fill="#2563eb"/>
    <line x1="${fillValveX + 4}" y1="${floatY}" x2="${fillValveX + 26}" y2="${floatY + 4}" stroke="#93a4b8" stroke-width="2"/>
    <circle cx="${fillValveX + 28}" cy="${floatY + 5}" r="7" fill="#93a4b8" opacity="0.8"/>

    <rect x="${fillValveX + 34}" y="${tankTop + 20}" width="7" height="${tankBottom - tankTop - 26}" fill="#42586c" opacity="0.85"/>

    <circle cx="${leverX}" cy="${leverY}" r="7" fill="none" stroke="#93a4b8" stroke-width="2.5"/>
    <line x1="${leverX - 7}" y1="${leverY}" x2="${tankRight}" y2="${leverY}" stroke="#93a4b8" stroke-width="2.5"/>
    <polyline points="${chainPts.join(' ')}" fill="none" stroke="#6b7f92" stroke-width="1.5" stroke-dasharray="1 3"/>

    <ellipse cx="${flapperCx}" cy="${flapperCy}" rx="${gapHalf}" ry="7" fill="#c0603f" opacity="0.85"/>

    <line x1="${gapL - 10}" y1="${tankBottom}" x2="${gapL}" y2="${tankBottom + 10}" stroke="var(--muted)" stroke-width="3"/>
    <line x1="${gapR + 10}" y1="${tankBottom}" x2="${gapR}" y2="${tankBottom + 10}" stroke="var(--muted)" stroke-width="3"/>

    ${streams}
    ${jetStreams.join('')}

    <path d="M ${gapL - 40} ${tankBottom + jetLen + 8}
             Q ${gapCenter} ${tankBottom + jetLen + 50}, ${gapR + 40} ${tankBottom + jetLen + 8}"
          fill="none" stroke="#2a4054" stroke-width="2" stroke-dasharray="3 5"/>

    <rect x="${gaugeX}" y="${gaugeTop}" width="16" height="${gaugeBottom - gaugeTop}" rx="4" fill="#0c1826" stroke="#22374a"/>
    <rect x="${gaugeX}" y="${gaugeSurfaceY}" width="16" height="${gaugeBottom - gaugeSurfaceY}" rx="4" fill="url(#pgaugeGrad)"/>
    <line x1="${gaugeX - 6}" y1="${gaugeSurfaceY}" x2="${gaugeX + 22}" y2="${gaugeSurfaceY}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>
    <text x="${gaugeX + 22}" y="${gaugeSurfaceY + 4}" fill="var(--muted)" font-size="11" font-family="var(--mono)">0 kPa</text>
    <line x1="${gaugeX - 6}" y1="${gaugeValveY}" x2="${gaugeX + 22}" y2="${gaugeValveY}" stroke="var(--teal)" stroke-width="1"/>
    <text x="${gaugeX + 22}" y="${gaugeValveY + 4}" fill="var(--teal)" font-size="11" font-weight="700" font-family="var(--mono)">${fmt(d.Phydro/1000,2)} kPa</text>
    <text x="${gaugeX + 8}" y="${gaugeTop - 10}" fill="var(--muted-dim)" font-size="11" text-anchor="middle" font-family="var(--sans)">depth</text>

    <g font-family="var(--mono)">
      <rect x="${eqX}" y="${eqY}" width="330" height="150" rx="10" fill="#0c1826" stroke="#22374a" stroke-width="1.5"/>
      <text x="${eqX + 16}" y="${eqY + 26}" fill="var(--muted)" font-size="12" font-family="var(--sans)" font-weight="700">HYDROSTATIC EQUATION</text>
      <text x="${eqX + 16}" y="${eqY + 56}" fill="var(--text)" font-size="18" font-weight="700">P = ρ · g · H</text>
      <text x="${eqX + 16}" y="${eqY + 86}" fill="var(--muted)" font-size="14">P = 1000 × 9.81 × ${fmt(d.H,3)}</text>
      <text x="${eqX + 16}" y="${eqY + 112}" fill="var(--teal)" font-size="20" font-weight="800">P = ${fmt(d.Phydro/1000,2)} kPa</text>
      <text x="${eqX + 16}" y="${eqY + 138}" fill="var(--muted-dim)" font-size="11.5" font-family="var(--sans)">taller water column → higher pressure at the valve</text>
    </g>

    <text x="${tankLeft}" y="${tankTop - 16}" fill="var(--muted)" font-size="13.5" font-family="var(--sans)">cistern · 12 cm × 50 cm (fixed)</text>
    <text x="${gapCenter - 34}" y="${tankBottom + 26}" fill="var(--muted)" font-size="12.5" font-family="var(--sans)">flush valve</text>
    <text x="${tankLeft + 8}" y="${waterTop - 8}" fill="var(--teal)" font-size="12.5" font-weight="600" font-family="var(--sans)">H = ${fmt(s.H,0)} cm</text>
    <text x="${gapCenter}" y="${tankBottom + jetLen + 48}" text-anchor="middle" fill="var(--orange)" font-size="14" font-weight="700" font-family="var(--mono)">v = ${fmt(d.vExit,2)} m/s</text>
  </svg>`;
  document.getElementById('svgPart1').innerHTML = svg;
}

// ============================================================
// RENDER: PART 2 — RIM DISTRIBUTION
// ============================================================

function renderPart2(d, s) {
  const W = 900, H = 460;
  const cx = 400, cy = 230;
  const rx = 230, ry = 140;

  const maxTau = 40;
  const tIntensity = clamp(d.tauWall / maxTau, 0, 1);
  const holeColor = intensityColor(tIntensity);
  const arrowLen = clamp(6 + d.vHole * 2.2, 10, 40);

  const channelStrokeW = clamp(4 + s.rimCavity * 0.9, 6, 32);

  const n = s.nHoles;
  const maxVChan = d.vChannelStart || 1;

  let arcs = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
    const x1 = cx + rx * Math.cos(a1), y1 = cy + ry * Math.sin(a1);
    const vChan = d.channelProfile[i].vChan;
    const t = clamp(vChan / maxVChan, 0, 1);
    const col = lerpColor('2dd4bf', '13303f', 1 - t);
    const largeArc = 0;
    arcs += `<path class="flow-path" d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${rx} ${ry} 0 ${largeArc} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}"
      fill="none" stroke="${col}" stroke-width="${channelStrokeW}" opacity="${0.25 + 0.55 * t}"/>`;
  }

  let holes = '';
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const hx = cx + rx * Math.cos(ang);
    const hy = cy + ry * Math.sin(ang);
    const nx = (cx - hx), ny = (cy - hy);
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    const dx = (nx / nlen) * arrowLen;
    const dy = (ny / nlen) * arrowLen;
    holes += `
      <circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="6" fill="${holeColor}" stroke="#0c1826" stroke-width="1.5"/>
      <line class="flow-path" x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${(hx+dx).toFixed(1)}" y2="${(hy+dy).toFixed(1)}"
            stroke="${holeColor}" stroke-width="2.5" opacity="0.85" stroke-linecap="round"/>`;
  }

  const startX = cx, startY = cy - ry;

  const regime = reRegime(d.ReHole);
  const gaugeX = 690, gaugeY = 70, gaugeW = 170;

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - channelStrokeW/2 - 20}" ry="${ry - channelStrokeW/2 - 12}" fill="#0c1826" stroke="#22374a" stroke-width="1.5" stroke-dasharray="2 5"/>
    ${arcs}
    ${holes}

    <circle cx="${startX}" cy="${startY}" r="5" fill="var(--orange)"/>
    <text x="${startX}" y="${startY - 14}" text-anchor="middle" fill="var(--orange)" font-size="12.5" font-weight="700" font-family="var(--sans)">start (inlet, top)</text>

    <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="var(--muted)" font-size="13" font-family="var(--sans)">rim channel (top view)</text>
    <text x="24" y="30" fill="var(--muted)" font-size="14" font-family="var(--sans)">${n} rim holes · Ø ${fmt(s.dHole,1)} mm · cavity Ø ${fmt(s.rimCavity,0)} mm</text>

    <g font-family="var(--mono)">
      <text x="24" y="392" fill="var(--teal)" font-size="14" font-weight="700">channel v (start) = ${fmt(d.vChannelStart,2)} m/s</text>
      <text x="24" y="414" fill="#5f7284" font-size="14" font-weight="700">channel v (end) = ${fmt(d.vChannelEnd,2)} m/s</text>
      <text x="24" y="436" fill="${holeColor}" font-size="14" font-weight="700">τ_wall (per hole) = ${fmt(d.tauWall,2)} Pa</text>
    </g>

    <g font-family="var(--sans)">
      <text x="${gaugeX}" y="${gaugeY - 14}" fill="var(--muted)" font-size="12" font-weight="700">REYNOLDS NUMBER (rim jet)</text>
      <rect x="${gaugeX}" y="${gaugeY}" width="${gaugeW*(2000/6000)}" height="14" fill="#2dd4bf"/>
      <rect x="${gaugeX + gaugeW*(2000/6000)}" y="${gaugeY}" width="${gaugeW*(2000/6000)}" height="14" fill="#f5a623"/>
      <rect x="${gaugeX + gaugeW*(4000/6000)}" y="${gaugeY}" width="${gaugeW*(2000/6000)}" height="14" fill="#f0616f"/>
      <line x1="${gaugeX + gaugeW*clamp(d.ReHole/6000,0,1)}" y1="${gaugeY - 6}" x2="${gaugeX + gaugeW*clamp(d.ReHole/6000,0,1)}" y2="${gaugeY + 20}" stroke="#fff" stroke-width="2.5"/>
      <text x="${gaugeX + gaugeW*clamp(d.ReHole/6000,0,1)}" y="${gaugeY + 34}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700" font-family="var(--mono)">Re ≈ ${Math.round(d.ReHole).toLocaleString()}</text>

      <text x="${gaugeX}" y="${gaugeY + 66}" fill="${regime.color}" font-size="15" font-weight="800">${regime.label}</text>
      <text x="${gaugeX}" y="${gaugeY + 86}" fill="var(--muted)" font-size="12">${regime.desc}</text>

      <text x="${gaugeX}" y="${gaugeY + 116}" fill="var(--muted-dim)" font-size="11.5">Re &lt; 2000 → Laminar</text>
      <text x="${gaugeX}" y="${gaugeY + 134}" fill="var(--muted-dim)" font-size="11.5">2000–4000 → Transitional</text>
      <text x="${gaugeX}" y="${gaugeY + 152}" fill="var(--muted-dim)" font-size="11.5">Re &gt; 4000 → Turbulent</text>
    </g>
  </svg>`;
  document.getElementById('svgPart2').innerHTML = svg;
}

// ============================================================
// RENDER: PART 3 — OVERALL SYNTHESIS (recognizable toilet side view)
// ============================================================

function renderPart3(d, s) {
  const W = 900, H = 460;
  const success = d.success;
  const statusColor = success ? 'var(--success)' : 'var(--fail)';

  const tLeft = 90, tTop = 40, tW = 100, tH = 190, tBottom = tTop + tH;
  const waterFrac = clamp(s.H / (TANK_LENGTH_CM - 5), 0.05, 1);
  const waterTop = tBottom - waterFrac * tH;

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="waterGrad3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#0e9384" stop-opacity="0.85"/>
      </linearGradient>
      <linearGradient id="bowlWater" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#12786c" stop-opacity="0.55"/>
      </linearGradient>
    </defs>

    <path d="M ${tLeft} ${tTop+12} Q ${tLeft} ${tTop}, ${tLeft+12} ${tTop}
             L ${tLeft+tW-12} ${tTop} Q ${tLeft+tW} ${tTop}, ${tLeft+tW} ${tTop+12}
             L ${tLeft+tW} ${tBottom} L ${tLeft} ${tBottom} Z"
          fill="#152736" stroke="#5c7286" stroke-width="2.5"/>
    <rect x="${tLeft+3}" y="${waterTop}" width="${tW-6}" height="${tBottom-waterTop-3}" fill="url(#waterGrad3)"/>
    <rect x="${tLeft+10}" y="${tTop+10}" width="7" height="26" rx="2" fill="#3b82f6"/>
    <circle cx="${tLeft+13}" cy="${tTop+10}" r="5" fill="#2563eb"/>
    <circle cx="${tLeft+30}" cy="${waterTop+4}" r="6" fill="#93a4b8" opacity="0.85"/>
    <line x1="${tLeft+13}" y1="${waterTop+4}" x2="${tLeft+30}" y2="${waterTop+4}" stroke="#93a4b8" stroke-width="1.5"/>
    <circle cx="${tLeft+tW-14}" cy="${tTop+12}" r="6" fill="none" stroke="#93a4b8" stroke-width="2"/>
    <line x1="${tLeft+tW}" y1="${tTop+12}" x2="${tLeft+tW-20}" y2="${tTop+12}" stroke="#93a4b8" stroke-width="2"/>
    <text x="${tLeft}" y="${tTop-8}" fill="var(--muted)" font-size="12" font-family="var(--sans)">tank</text>

    <path d="M ${tLeft+tW/2} ${tBottom} L ${tLeft+tW/2} ${tBottom+26} L ${tLeft+150} ${tBottom+50}"
          fill="none" stroke="#5c7286" stroke-width="9" stroke-linecap="round"/>

    <path d="M ${tLeft+90} ${tBottom+40}
             C ${tLeft+110} ${tBottom+20}, ${tLeft+320} ${tBottom+10}, ${tLeft+430} ${tBottom+55}
             C ${tLeft+470} ${tBottom+80}, ${tLeft+470} ${tBottom+170}, ${tLeft+400} ${tBottom+230}
             C ${tLeft+330} ${tBottom+270}, ${tLeft+200} ${tBottom+270}, ${tLeft+140} ${tBottom+225}
             C ${tLeft+95} ${tBottom+190}, ${tLeft+85} ${tBottom+90}, ${tLeft+90} ${tBottom+40} Z"
          fill="#e7edf3" opacity="0.06" stroke="#93a4b8" stroke-width="3"/>

    <ellipse cx="${tLeft+280}" cy="${tBottom+185}" rx="115" ry="42" fill="url(#bowlWater)"/>
    <ellipse cx="${tLeft+280}" cy="${tBottom+185}" rx="115" ry="42" fill="none" stroke="#2dd4bf" stroke-width="1.5" opacity="0.5"/>

    <ellipse cx="${tLeft+270}" cy="${tBottom+55}" rx="175" ry="26" fill="none" stroke="#93a4b8" stroke-width="2.5" opacity="0.7"/>

    <path d="M ${tLeft+190} ${tBottom+240}
             C ${tLeft+150} ${tBottom+300}, ${tLeft+230} ${tBottom+320}, ${tLeft+190} ${tBottom+360}
             C ${tLeft+160} ${tBottom+390}, ${tLeft+90} ${tBottom+390}, ${tLeft+60} ${tBottom+420}"
          fill="none" stroke="#93a4b8" stroke-width="16" stroke-linecap="round" opacity="0.55"/>
    <path d="M ${tLeft+190} ${tBottom+240}
             C ${tLeft+150} ${tBottom+300}, ${tLeft+230} ${tBottom+320}, ${tLeft+190} ${tBottom+360}
             C ${tLeft+160} ${tBottom+390}, ${tLeft+90} ${tBottom+390}, ${tLeft+60} ${tBottom+420}"
          fill="none" stroke="#0c1826" stroke-width="9" stroke-linecap="round"/>

    ${success ? `
      <g class="flow-path" style="animation-duration:1.4s;">
        <ellipse cx="${tLeft+150}" cy="${tBottom+340}" rx="13" ry="8" fill="#7a5a34" opacity="0.55"/>
      </g>
      <path class="flow-path" d="M ${tLeft+230} ${tBottom+210} C ${tLeft+190} ${tBottom+280}, ${tLeft+150} ${tBottom+330}, ${tLeft+70} ${tBottom+400}"
            fill="none" stroke="var(--teal)" stroke-width="3" opacity="0.75"/>
    ` : `
      <ellipse cx="${tLeft+300}" cy="${tBottom+178}" rx="20" ry="11" fill="#7a5a34"/>
      <ellipse cx="${tLeft+288}" cy="${tBottom+170}" rx="9" ry="6" fill="#8a6a3e"/>
    `}

    <g>
      <rect x="640" y="60" width="230" height="110" rx="12" fill="${success ? 'rgba(52,211,153,0.1)' : 'rgba(240,97,111,0.1)'}" stroke="${statusColor}" stroke-width="1.5"/>
      <text x="755" y="94" text-anchor="middle" fill="${statusColor}" font-size="20" font-weight="800" font-family="var(--sans)">${success ? '✓ SUCCESS' : '✗ FAILURE'}</text>
      <text x="755" y="118" text-anchor="middle" fill="var(--muted)" font-size="12.5" font-family="var(--sans)">${success ? 'flushed down the trapway' : 'still sitting in the bowl'}</text>
      <text x="755" y="140" text-anchor="middle" fill="var(--muted-dim)" font-size="11.5" font-family="var(--mono)">t_flush ≈ ${isFinite(d.tFlush) ? fmt(d.tFlush,1)+'s' : '∞'}</text>
      <text x="755" y="158" text-anchor="middle" fill="var(--muted-dim)" font-size="11" font-family="var(--mono)">Q = ${fmt(d.Q_Lps,2)} L/s · τ = ${fmt(d.tauWall,2)} Pa</text>
    </g>

    <text x="40" y="440" fill="var(--muted)" font-size="13" font-family="var(--sans)">side view · synthesis of parts 1 &amp; 2</text>
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
  const valveRegime = reRegime(d.Re);
  reTag.textContent = valveRegime.label.toLowerCase();
  reTag.style.background = valveRegime.color + '26';
  reTag.style.color = valveRegime.color;

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
  nHoles: 'sliderNHoles', dHole: 'sliderDHole', rimCavity: 'sliderRimCavity',
};

const labelIds = {
  H: 'labelH', dValve: 'labelDValve', mu: 'labelMu',
  nHoles: 'labelNHoles', dHole: 'labelDHole', rimCavity: 'labelRimCavity',
};

function muFromRaw(raw) {
  const t = raw / 100;
  return Math.exp(lerp(Math.log(MU_MIN), Math.log(MU_MAX), t));
}
function rawFromMu(mu) {
  const t = (Math.log(mu) - Math.log(MU_MIN)) / (Math.log(MU_MAX) - Math.log(MU_MIN));
  return clamp(t * 100, 0, 100);
}

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
    renderAll();
  });
}

function setupMuSlider() {
  const el = document.getElementById(sliderIds.mu);
  const lbl = document.getElementById(labelIds.mu);
  el.min = 0; el.max = 100; el.step = 0.5;
  el.value = rawFromMu(state.mu);
  updateSliderFill(el);
  lbl.textContent = `${fmt(state.mu,0)} mPa·s`;
  el.addEventListener('input', () => {
    state.mu = muFromRaw(parseFloat(el.value));
    updateSliderFill(el);
    lbl.textContent = `${fmt(state.mu,0)} mPa·s`;
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
      el.value = rawFromMu(mu);
      updateSliderFill(el);
      document.getElementById(labelIds.mu).textContent = `${fmt(mu,0)} mPa·s`;
      clearPresetActive();
      btn.classList.add('active');
      renderAll();
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  setupSlider('H', v => `${fmt(v,0)} cm`);
  setupSlider('dValve', v => `${fmt(v,0)} mm`);
  setupMuSlider();
  setupSlider('nHoles', v => `${fmt(v,0)}`);
  setupSlider('dHole', v => `${fmt(v,1)} mm`);
  setupSlider('rimCavity', v => `${fmt(v,0)} mm`);
  setupPresets();
  document.querySelector(`.preset-btn[data-mu="1"]`).classList.add('active');
  renderAll();
});
