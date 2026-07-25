// js/physics.js

function compute(s) {
  const H = s.H / 100;                 
  const mu = s.mu / 1000;              
  const dValve = s.dValve / 1000;      
  const rValve = dValve / 2;
  const Avalve = Math.PI * rValve * rValve;

  const Phydro = RHO * G * H;
  const vIdeal = Math.sqrt(2 * G * H);

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