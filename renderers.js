// js/renderers.js

// ============================================================
// RENDER: PART 1 — TANK & VALVE (Bernoulli, head form)
// ============================================================
function renderPart1(d, s) {
  const W = 900, Hh = 460;

  const pxPerCm = 6.2;
  // Tank width in the drawing tracks the dTank slider (A1's effective diameter),
  // so users can see it grow/shrink — a drawn proxy, not the physical footprint
  // (Vtank/tFlush still use the fixed 12x50cm rectangular footprint).
  const pxPerMmTank = 0.55;
  const tankW = clamp(s.dTank * pxPerMmTank, 30, 260);
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

  const jetLen = clamp(d.v2 * 26, 18, 110);
  const jetStreams = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x = lerp(gapL + 6, gapR - 6, t);
    jetStreams.push(`<path class="flow-path" d="M ${x} ${tankBottom} L ${x} ${tankBottom + jetLen}"
      stroke="var(--orange)" stroke-width="2.5" opacity="0.8" stroke-linecap="round"/>`);
  }

  // v1 (free-surface) and v2 (valve exit) velocity vectors + animation speeds —
  // faster animateMotion loop = higher velocity, clamped to stay readable on screen.
  const surfaceX = tankLeft + tankW * 0.68;
  const v1ArrowLen = clamp(10 + d.v1 * 300, 12, 60);
  const v1Dur = clamp(2.4 - d.v1 * 15, 0.5, 2.4).toFixed(2);
  const v2X = tankLeft - 20;
  const v2ArrowLen = clamp(d.v2 * 26, 20, 130);
  const v2Dur = clamp(2.0 - d.v2 * 0.5, 0.35, 2.0).toFixed(2);

  const gaugeX = tankRight + 40;
  const gaugeTop = tankTop, gaugeBottom = tankBottom;
  const gaugeSurfaceY = waterTop;
  const gaugeValveY = tankBottom;

  const eqX = gaugeX + 80, eqY = tankTop + 6;

  // v2 - v1: how close the two velocities are. This shrinks toward 0 as H -> 0,
  // which is the "v1 and v2 converge" observation from the spec.
  const deltaV = d.v2 - d.v1;

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
      <marker id="arrowPurple1" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--purple)"/>
      </marker>
      <marker id="arrowTeal1" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--teal)"/>
      </marker>
    </defs>

    <line x1="${tankLeft - 60}" y1="${tankTop + 4}" x2="${tankLeft - 60}" y2="${tankTop + 54}" stroke="var(--pink)" stroke-width="2.5" marker-end="url(#arrowRed1)"/>
    <text x="${tankLeft - 50}" y="${tankTop + 36}" fill="var(--pink)" font-size="15" font-weight="700" font-family="var(--sans)">g</text>
    <text x="${tankLeft - 74}" y="${tankTop + 70}" fill="var(--pink)" font-size="11" font-weight="700" font-family="var(--mono)" text-anchor="middle">${fmt(d.g,2)} m/s²</text>

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
    <text x="${gaugeX + 22}" y="${gaugeSurfaceY + 4}" fill="var(--muted)" font-size="11" font-family="var(--mono)">z1 = ${fmt(d.H,2)} m</text>
    <line x1="${gaugeX - 6}" y1="${gaugeValveY}" x2="${gaugeX + 22}" y2="${gaugeValveY}" stroke="var(--teal)" stroke-width="1"/>
    <text x="${gaugeX + 22}" y="${gaugeValveY + 4}" fill="var(--teal)" font-size="11" font-weight="700" font-family="var(--mono)">z2 = 0 (datum)</text>
    <text x="${gaugeX + 8}" y="${gaugeTop - 10}" fill="var(--muted-dim)" font-size="11" text-anchor="middle" font-family="var(--sans)">depth</text>

    <g font-family="var(--mono)">
      <rect x="${eqX}" y="${eqY}" width="380" height="228" rx="10" fill="#0c1826" stroke="#22374a" stroke-width="1.5"/>
      <text x="${eqX + 16}" y="${eqY + 24}" fill="var(--muted)" font-size="12" font-family="var(--sans)" font-weight="700">BERNOULLI EQUATION · HEAD FORM</text>
      <text x="${eqX + 16}" y="${eqY + 48}" fill="var(--text)" font-size="14.5" font-weight="700">P₁/ρg + v₁²/2g + z₁ = P₂/ρg + v₂²/2g + z₂</text>
      <text x="${eqX + 16}" y="${eqY + 70}" fill="var(--muted-dim)" font-size="12">P₁ = P₂ = 0 (gauge, open to air), z₂ = 0</text>
      <text x="${eqX + 16}" y="${eqY + 92}" fill="var(--muted)" font-size="13">⇒ v₂ = √( 2g·z₁ / (1 − β²) )</text>
      <text x="${eqX + 16}" y="${eqY + 114}" fill="var(--muted)" font-size="12.5">z₁ = H = ${fmt(d.H,3)} m,  g = ${fmt(d.g,2)} m/s²</text>
      <text x="${eqX + 16}" y="${eqY + 136}" fill="var(--muted)" font-size="12.5">β (from Part 2, continuity) = ${fmt(d.beta,4)}</text>
      <text x="${eqX + 16}" y="${eqY + 168}" fill="var(--teal)" font-size="19" font-weight="800">v₂ = ${fmt(d.v2,3)} m/s</text>
      <text x="${eqX + 16}" y="${eqY + 192}" fill="var(--purple)" font-size="16" font-weight="700">v₁ = β·v₂ = ${fmt(d.v1,4)} m/s</text>
      <text x="${eqX + 16}" y="${eqY + 216}" fill="var(--muted-dim)" font-size="11" font-family="var(--sans)">inviscid · incompressible · steady (no C_d correction)</text>
    </g>

    <line x1="${surfaceX}" y1="${waterTop}" x2="${surfaceX}" y2="${waterTop + v1ArrowLen}" stroke="var(--purple)" stroke-width="2.5" marker-end="url(#arrowPurple1)" opacity="0.9"/>
    <circle r="3.5" fill="var(--purple)">
      <animateMotion dur="${v1Dur}s" repeatCount="indefinite" path="M ${surfaceX} ${waterTop} L ${surfaceX} ${waterTop + v1ArrowLen}"/>
    </circle>
    <text x="${surfaceX + 10}" y="${waterTop + v1ArrowLen + 14}" fill="var(--purple)" font-size="12" font-weight="700" font-family="var(--mono)">v₁ = ${fmt(d.v1,4)} m/s</text>

    <line x1="${v2X}" y1="${tankBottom}" x2="${v2X}" y2="${tankBottom + v2ArrowLen}" stroke="var(--teal)" stroke-width="2.5" stroke-dasharray="4 4" marker-end="url(#arrowTeal1)" opacity="0.9"/>
    <circle r="3.5" fill="var(--teal)">
      <animateMotion dur="${v2Dur}s" repeatCount="indefinite" path="M ${v2X} ${tankBottom} L ${v2X} ${tankBottom + v2ArrowLen}"/>
    </circle>
    <text x="${v2X - 8}" y="${tankBottom - 8}" fill="var(--teal)" font-size="12" font-weight="700" font-family="var(--sans)" text-anchor="end">v₂</text>
    <text x="${v2X - 8}" y="${tankBottom + v2ArrowLen + 16}" fill="var(--teal)" font-size="12.5" font-weight="800" font-family="var(--mono)" text-anchor="end">${fmt(d.v2,2)} m/s</text>

    <text x="${tankLeft}" y="${tankTop - 16}" fill="var(--muted)" font-size="13.5" font-family="var(--sans)">cistern · length 50cm (fixed) · effective Ø ${fmt(s.dTank,0)} mm</text>
    <text x="${gapCenter - 34}" y="${tankBottom + 26}" fill="var(--muted)" font-size="12.5" font-family="var(--sans)">flush valve</text>
    <text x="${tankLeft + 8}" y="${waterTop - 8}" fill="var(--teal)" font-size="12.5" font-weight="600" font-family="var(--sans)">z₁ = H = ${fmt(s.H,0)} cm</text>

    <g font-family="var(--sans)">
      <rect x="${tankLeft}" y="${tankBottom + 14}" width="${tankW}" height="52" rx="8" fill="rgba(240,97,111,0.06)" stroke="var(--panel-border)" stroke-width="1"/>
      <text x="${tankLeft + 10}" y="${tankBottom + 30}" fill="var(--pink)" font-size="11.5" font-weight="700">OBSERVATION (t → 0⁺ down to empty)</text>
      <text x="${tankLeft + 10}" y="${tankBottom + 48}" fill="var(--muted)" font-size="11" font-family="var(--mono)">v₂ − v₁ = ${fmt(deltaV,3)} m/s — shrinks to 0 as z₁ → 0</text>
    </g>
  </svg>`;
  document.getElementById('svgPart1').innerHTML = svg;
}

// ============================================================
// RENDER: PART 2 — CONTINUITY (converging duct, A1 -> A2)
// ============================================================

function renderPart2(d, s) {
  const W = 900, H = 460;

  // Funnel geometry: wide free-surface opening (A1, top) narrowing to the
  // valve throat (A2, bottom) — mirrors the hand-drawn continuity diagram.
  const cx = 380;
  const topY = 70, botY = 340;
  const maxHalfTop = 240, maxHalfBot = 240;
  const halfTop = clamp((s.dTank / 350) * maxHalfTop, 60, maxHalfTop);
  const halfBot = clamp((s.dValve / 90) * maxHalfBot * 0.42, 16, maxHalfBot * 0.42);

  const leftTop = cx - halfTop, rightTop = cx + halfTop;
  const leftBot = cx - halfBot, rightBot = cx + halfBot;

  // v1 arrows spread across the full top width (A1); v2 arrows concentrated
  // at the narrow throat (A2) -- visually, fewer + faster.
  const v1Len = clamp(10 + d.v1 * 300, 14, 46);
  const v1Dur = clamp(2.2 - d.v1 * 12, 0.5, 2.2).toFixed(2);
  const nTop = 7;
  let topArrows = '';
  for (let i = 0; i < nTop; i++) {
    const t = i / (nTop - 1);
    const x = lerp(leftTop + 14, rightTop - 14, t);
    const delay = (i * 0.12).toFixed(2);
    topArrows += `
      <line x1="${x.toFixed(1)}" y1="${topY}" x2="${x.toFixed(1)}" y2="${topY + v1Len}" stroke="var(--purple)" stroke-width="2" marker-end="url(#arrowPurple2)" opacity="0.85"/>
      <circle r="3" fill="var(--purple)" opacity="0.9">
        <animateMotion dur="${v1Dur}s" begin="-${delay}s" repeatCount="indefinite" path="M ${x.toFixed(1)} ${topY} L ${x.toFixed(1)} ${topY + v1Len}"/>
      </circle>`;
  }

  const v2Len = clamp(14 + d.v2 * 22, 20, 120);
  const v2Dur = clamp(1.8 - d.v2 * 0.45, 0.3, 1.8).toFixed(2);
  const nBot = 3;
  let botArrows = '';
  for (let i = 0; i < nBot; i++) {
    const t = nBot === 1 ? 0.5 : i / (nBot - 1);
    const x = lerp(leftBot + 6, rightBot - 6, t);
    const delay = (i * 0.15).toFixed(2);
    botArrows += `
      <line x1="${x.toFixed(1)}" y1="${botY}" x2="${x.toFixed(1)}" y2="${botY + v2Len}" stroke="var(--teal)" stroke-width="3" marker-end="url(#arrowTeal2)"/>
      <circle r="4" fill="var(--teal)">
        <animateMotion dur="${v2Dur}s" begin="-${delay}s" repeatCount="indefinite" path="M ${x.toFixed(1)} ${botY} L ${x.toFixed(1)} ${botY + v2Len}"/>
      </circle>`;
  }

  // side-by-side area bars -- a direct visual of "observing the ratio" A2:A1
  const barX = 700, barBaseY = 380, barMaxH = 220, barW = 70;
  const areaMax = Math.max(d.Atank, d.Avalve) || 1;
  const a1H = clamp((d.Atank / areaMax) * barMaxH, 4, barMaxH);
  const a2H = clamp((d.Avalve / areaMax) * barMaxH, 4, barMaxH);

  const eqX = 40, eqY = 350;

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrowPurple2" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--purple)"/>
      </marker>
      <marker id="arrowTeal2" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="var(--teal)"/>
      </marker>
      <linearGradient id="ductWater" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#2dd4bf" stop-opacity="0.32"/>
      </linearGradient>
    </defs>

    <!-- converging duct: A1 (wide, top / free surface) -> A2 (narrow, throat) -->
    <path d="M ${leftTop} ${topY} L ${leftBot} ${botY} L ${rightBot} ${botY} L ${rightTop} ${topY}"
          fill="url(#ductWater)" stroke="#5c7286" stroke-width="3" stroke-linejoin="round"/>

    <!-- wavy free surface at the top -->
    <path d="M ${leftTop} ${topY} q 10 -8 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0"
          fill="none" stroke="var(--teal)" stroke-width="2"/>

    <!-- width markers -->
    <line x1="${leftTop}" y1="${topY - 22}" x2="${rightTop}" y2="${topY - 22}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 4"/>
    <line x1="${leftTop}" y1="${topY - 30}" x2="${leftTop}" y2="${topY - 14}" stroke="var(--muted)" stroke-width="1"/>
    <line x1="${rightTop}" y1="${topY - 30}" x2="${rightTop}" y2="${topY - 14}" stroke="var(--muted)" stroke-width="1"/>
    <text x="${cx}" y="${topY - 30}" text-anchor="middle" fill="var(--muted)" font-size="13" font-weight="700" font-family="var(--sans)">A₁ (free surface) · Ø ${fmt(s.dTank,0)} mm</text>

    <line x1="${leftBot}" y1="${botY + 22}" x2="${rightBot}" y2="${botY + 22}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 4"/>
    <line x1="${leftBot}" y1="${botY + 14}" x2="${leftBot}" y2="${botY + 30}" stroke="var(--muted)" stroke-width="1"/>
    <line x1="${rightBot}" y1="${botY + 14}" x2="${rightBot}" y2="${botY + 30}" stroke="var(--muted)" stroke-width="1"/>
    <text x="${cx}" y="${botY + 46}" text-anchor="middle" fill="var(--muted)" font-size="13" font-weight="700" font-family="var(--sans)">A₂ (valve throat) · Ø ${fmt(s.dValve,0)} mm</text>

    ${topArrows}
    ${botArrows}

    <text x="${leftTop - 10}" y="${topY - 8}" text-anchor="end" fill="var(--purple)" font-size="12.5" font-weight="700" font-family="var(--sans)">P₁, v₁</text>
    <text x="${rightBot + 10}" y="${botY - 8}" text-anchor="start" fill="var(--teal)" font-size="12.5" font-weight="700" font-family="var(--sans)">P₂, v₂</text>

    <g font-family="var(--mono)">
      <rect x="${eqX}" y="${eqY}" width="420" height="96" rx="10" fill="#0c1826" stroke="#22374a" stroke-width="1.5"/>
      <text x="${eqX + 16}" y="${eqY + 22}" fill="var(--muted)" font-size="12" font-family="var(--sans)" font-weight="700">CONTINUITY (MASS FLOW RATE)</text>
      <text x="${eqX + 16}" y="${eqY + 44}" fill="var(--text)" font-size="15" font-weight="700">A₁v₁ρ₁ = A₂v₂ρ₂  ⇒  v₁ = (A₂/A₁)v₂ = β·v₂</text>
      <text x="${eqX + 16}" y="${eqY + 66}" fill="var(--muted)" font-size="12.5">A₁ = ${(d.Atank*1e4).toFixed(1)} cm² ,  A₂ = ${(d.Avalve*1e4).toFixed(2)} cm²</text>
      <text x="${eqX + 16}" y="${eqY + 86}" fill="var(--orange)" font-size="14" font-weight="800">β = A₂/A₁ = (d_valve/d_tank)² = ${fmt(d.beta,4)}</text>
    </g>

    <g font-family="var(--sans)">
      <text x="${barX}" y="${barBaseY - barMaxH - 16}" text-anchor="middle" fill="var(--muted)" font-size="12.5" font-weight="700">AREA RATIO</text>
      <rect x="${barX - barW - 14}" y="${barBaseY - a1H}" width="${barW}" height="${a1H}" rx="4" fill="var(--purple)" opacity="0.75"/>
      <text x="${barX - barW/2 - 14}" y="${barBaseY + 18}" text-anchor="middle" fill="var(--purple)" font-size="12" font-weight="700">A₁</text>
      <rect x="${barX + 14}" y="${barBaseY - a2H}" width="${barW}" height="${a2H}" rx="4" fill="var(--teal)" opacity="0.85"/>
      <text x="${barX + 14 + barW/2}" y="${barBaseY + 18}" text-anchor="middle" fill="var(--teal)" font-size="12" font-weight="700">A₂</text>
      <text x="${barX}" y="${barBaseY + 40}" text-anchor="middle" fill="var(--muted-dim)" font-size="11.5" font-family="var(--mono)">A₂:A₁ ≈ 1:${fmt(d.Atank/Math.max(d.Avalve,1e-9),0)}</text>
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

    ${(success && s.isFlushing) ? `
      <g>
        <animateMotion
          dur="2.2s"
          repeatCount="1"
          fill="freeze"
          path="M ${tLeft+300},${tBottom+178} C ${tLeft+310},${tBottom+205} ${tLeft+245},${tBottom+215} ${tLeft+240},${tBottom+185} C ${tLeft+235},${tBottom+155} ${tLeft+290},${tBottom+155} ${tLeft+285},${tBottom+185} C ${tLeft+280},${tBottom+205} ${tLeft+250},${tBottom+210} ${tLeft+230},${tBottom+210} C ${tLeft+190},${tBottom+280} ${tLeft+150},${tBottom+330} ${tLeft+120},${tBottom+370} C ${tLeft+90},${tBottom+390} ${tLeft+60},${tBottom+420} ${tLeft+20},${tBottom+440}"
        />

        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            from="1"
            to="0.2"
            dur="2.2s"
            fill="freeze"
          />

          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="1080"
              dur="2.2s"
              fill="freeze"
            />

            <ellipse cx="0" cy="0" rx="20" ry="11" fill="#7a5a34" />
            <ellipse cx="-5" cy="-3" rx="9" ry="6" fill="#8a6a3e" />
          </g>
        </g>
      </g>

      <path class="flow-path" d="M ${tLeft+230} ${tBottom+210} C ${tLeft+190} ${tBottom+280}, ${tLeft+150} ${tBottom+330}, ${tLeft+70} ${tBottom+400}"
            fill="none" stroke="var(--teal)" stroke-width="3" opacity="0.75"/>
    ` : `
      <ellipse cx="${tLeft+300}" cy="${tBottom+178}" rx="20" ry="11" fill="#7a5a34"/>
      <ellipse cx="${tLeft+288}" cy="${tBottom+170}" rx="9" ry="6" fill="#8a6a3e"/>
    `}

    <g>
      <rect x="640" y="60" width="230" height="100" rx="12" fill="${success ? 'rgba(52,211,153,0.1)' : 'rgba(240,97,111,0.1)'}" stroke="${statusColor}" stroke-width="1.5"/>
      <text x="755" y="94" text-anchor="middle" fill="${statusColor}" font-size="20" font-weight="800" font-family="var(--sans)">${success ? '✓ SUCCESS' : '✗ FAILURE'}</text>
      <text x="755" y="118" text-anchor="middle" fill="var(--muted)" font-size="12.5" font-family="var(--sans)">${success ? 'flushed down the trapway' : 'still sitting in the bowl'}</text>
      <text x="755" y="140" text-anchor="middle" fill="var(--muted-dim)" font-size="11.5" font-family="var(--mono)">t_flush ≈ ${isFinite(d.tFlush) ? fmt(d.tFlush,1)+'s' : '∞'} · Q = ${fmt(d.Q_Lps,2)} L/s</text>
    </g>

    <text x="40" y="440" fill="var(--muted)" font-size="13" font-family="var(--sans)">side view · synthesis of parts 1 &amp; 2</text>
  </svg>`;
  document.getElementById('svgPart3').innerHTML = svg;
}
