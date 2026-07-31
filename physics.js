// js/physics.js
//
// Model: steady, incompressible, inviscid flow between the free surface (1)
// and the valve exit (2) -- exactly the assumptions boxed in the derivation:
//
//   P1/rho g + v1^2/2g + z1  =  P2/rho g + v2^2/2g + z2      (Bernoulli, head form)
//   P1 = P2 = 0 (both are gauge pressure, open to atmosphere)
//   z2 = 0 (reference level at the valve), z1 = H
//
//   Continuity (mass flow rate): A1 v1 rho1 = A2 v2 rho2, rho1 = rho2
//     => v1 = (A2/A1) v2 = beta * v2,  beta = (d_valve/d_tank)^2 = A2/A1
//
// Substituting:
//   (beta*v2)^2 + 2 g H = v2^2
//   2 g H = v2^2 (1 - beta^2)
//   v2 = sqrt( 2 g H / (1 - beta^2) )

function compute(s) {
  const H = s.H / 100;            // m, z1
  const dValve = s.dValve / 1000; // m, A2's diameter
  const dTank = s.dTank / 1000;   // m, A1's diameter
  const g = s.g;

  const rValve = dValve / 2;
  const Avalve = Math.PI * rValve * rValve; // A2
  const Atank = Math.PI * (dTank / 2) * (dTank / 2); // A1

  const beta = dTank > 0 ? Math.pow(dValve / dTank, 2) : 0; // A2/A1
  const denom = clamp(1 - beta * beta, 0.02, 1); // guard as dValve -> dTank

  const Phydro = RHO * g * H; // hydrostatic driving pressure available (rho g H)

  const v2 = Math.sqrt((2 * g * H) / denom); // exit velocity at the valve
  const v1 = beta * v2;                      // free-surface velocity, from continuity

  const Q = v2 * Avalve; // m^3/s -- inviscid, so no discharge coefficient
  const Q_Lps = Q * 1000;

  // --- Synthesis: flush volume = actual tank footprint (12cm x 50cm) x
  // the current water height, so tFlush responds to the H slider too. ---
  const Vtank = (TANK_WIDTH_CM / 100) * (TANK_LENGTH_CM / 100) * H; // m^3
  const tFlush = Q > 1e-9 ? Vtank / Q : Infinity;

  const QOK = Q_Lps > 1.0;
  const tOK = isFinite(tFlush) && tFlush < 8;
  const success = QOK && tOK;

  return {
    H, dValve, dTank, g, Avalve, Atank, beta, denom,
    Phydro, v1, v2, Q, Q_Lps,
    Vtank, tFlush, QOK, tOK, success,
  };
}
