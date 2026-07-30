// js/config.js
const RHO = 1000; // kg/m^3

const TANK_WIDTH_CM = 12;
const TANK_LENGTH_CM = 50;

const GRAVITY_PRESETS = [
  { label: 'Moon', g: 1.62 },
  { label: 'Mars', g: 3.71 },
  { label: 'Earth', g: 9.81 },
  { label: 'Jupiter', g: 24.79 },
];

const state = {
  H: 20,
  dValve: 45,
  dTank: 276,   // mm, effective tank diameter (equivalent circular Ø of the 12x50cm footprint)
  Hback: 3,     // cm, backpressure head at the valve exit
  g: 9.81,      // m/s^2, gravitational acceleration (defaults to Earth)
  mu: 1,
  nHoles: 8,
  dHole: 6,
  rimCavity: 16,
  isFlushing: false
};