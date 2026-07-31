// js/config.js
const RHO = 1000; // kg/m^3 (incompressible, rho1 = rho2, per the "assume incompressible" note)

const TANK_WIDTH_CM = 12;
const TANK_LENGTH_CM = 50;

// Only the quantities that appear as sliders in the current spec:
//   Part 1 (Bernoulli, head form): z1 = H, and g
//   Part 2 (continuity):           A1 <-> dTank, A2 <-> dValve
const state = {
  H: 20,        // cm, tank water level above the valve (z1)
  dValve: 45,   // mm, valve/orifice diameter (A2)
  dTank: 276,   // mm, effective tank diameter (A1) -- equivalent circular Ø of the 12x50cm footprint
  g: 9.81,      // m/s^2, gravitational acceleration (defaults to Earth)
  isFlushing: false,
};
