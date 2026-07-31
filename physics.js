// js/physics.js

function compute(s) {
  const H = s.H / 100;                 
  const mu = s.mu / 1000;              
  const dValve = s.dValve / 1000;      
  const g = s.g;                       
  const rValve = dValve / 2;
  const Avalve = Math.PI * rValve * rValve;

  // --- Bernoulli between free surface (1) and valve exit (2) ---
  // P1 + 1/2 rho v1^2 + rho g H = P2 + 1/2 rho v2^2
  // We no longer assume v1 = 0 or P2(gauge) = 0:
  //   v1 is tied to v2 via continuity (A1 v1 = A2 v2, beta = (dValve/dTank)^2)
  //   P2(gauge) is modeled as an equivalent backpressure head Hback
  //     (standing water / resistance downstream of the valve)
  const dTank = s.dTank / 1000;
  const Hback = s.Hback / 100;

  const beta = dTank > 0 ? Math.pow(dValve / dTank, 2) : 0;
  const denom = clamp(1 - beta * beta, 0.05, 1); // guard against dValve -> dTank
  const driveHead = Math.max(0, H - Hback);       // net driving head, can't go negative

  const Phydro = RHO * g * driveHead; // net driving (gauge) pressure difference P1-P2
  const vIdeal = Math.sqrt((2 * g * driveHead) / denom); // v2, with v1 and backpressure accounted for
  const v1 = beta * vIdeal; // free-surface velocity, from continuity A1v1 = A2v2

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

  const QOK = Q_Lps > 0.7;
  const shearOK = tauWall > 4;
  const success = QOK && shearOK && isFinite(tFlush) && tFlush < 11;

  return {
    H, mu, dValve, g, Avalve, Phydro, vIdeal, Re, Cd, vExit, Q, Q_Lps,
    dTank, Hback, beta, driveHead, v1,
    dHole, Ahole, AholesTotal, vHole, tauWall, Pdyn, ReHole,
    dChannel, Achannel, channelProfile, vChannelStart, vChannelEnd,
    Vtank, tFlush, QOK, shearOK, success,
  };
}