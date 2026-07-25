// js/ui.js

// Re-declare your ID mappings here
const sliderIds = {
  H: 'sliderH', dValve: 'sliderDValve', mu: 'sliderMu',
  nHoles: 'sliderNHoles', dHole: 'sliderDHole', rimCavity: 'sliderRimCavity',
};

const labelIds = {
  H: 'labelH', dValve: 'labelDValve', mu: 'labelMu',
  nHoles: 'labelNHoles', dHole: 'labelDHole', rimCavity: 'labelRimCavity',
};

// --- Helper for the slider backgrounds ---
function updateSliderFill(input) {
  const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--pct', pct + '%');
}

function renderReadouts(d) {
  // Update the mini-stats
  document.getElementById('roQ').textContent = fmt(d.Q_Lps, 2);
  document.getElementById('roPhydro').textContent = fmt(d.Phydro / 1000, 2);
  document.getElementById('roCd').textContent = fmt(d.Cd, 2);
  document.getElementById('roTau').textContent = fmt(d.tauWall, 2);
  document.getElementById('roVhole').textContent = fmt(d.vHole, 2);
  document.getElementById('roRe').textContent = Math.round(d.Re).toLocaleString();

  // Update Reynolds tag coloring
  const reTag = document.getElementById('roReTag');
  const valveRegime = reRegime(d.Re);
  reTag.textContent = valveRegime.label.toLowerCase();
  reTag.style.background = valveRegime.color + '26';
  reTag.style.color = valveRegime.color;

  // Update the Pass/Fail Verdict Card
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

// Slider boundaries
const MU_MIN = 1, MU_MAX = 500; 

// Converts raw 0-100 slider value to a logarithmic viscosity value
function muFromRaw(raw) {
  const t = raw / 100;
  return Math.exp(lerp(Math.log(MU_MIN), Math.log(MU_MAX), t));
}

// Converts actual viscosity value back to a 0-100 raw slider value
function rawFromMu(mu) {
  const t = (Math.log(mu) - Math.log(MU_MIN)) / (Math.log(MU_MAX) - Math.log(MU_MIN));
  return clamp(t * 100, 0, 100);
}

// ============================================================
// THE BIND CONTROLS FUNCTION
// ============================================================
function bindControls(onUpdate) {
  
  // 1. Internal helper to wire up standard sliders
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
      
      // Instead of calling renderAll() directly, we call the parameter:
      onUpdate(); 
    });
  }

  // 2. Wire up all the basic sliders
  setupSlider('H', v => `${fmt(v,0)} cm`);
  setupSlider('dValve', v => `${fmt(v,0)} mm`);
  setupSlider('nHoles', v => `${fmt(v,0)}`);
  setupSlider('dHole', v => `${fmt(v,1)} mm`);
  setupSlider('rimCavity', v => `${fmt(v,0)} mm`);

  const muEl = document.getElementById(sliderIds.mu);
  const muLbl = document.getElementById(labelIds.mu);
  
  // Set initial slider properties[cite: 2]
  muEl.min = 0; 
  muEl.max = 100; 
  muEl.step = 0.5;
  muEl.value = rawFromMu(state.mu); //[cite: 2]
  updateSliderFill(muEl);
  muLbl.textContent = `${fmt(state.mu, 0)} mPa·s`;
  
  // Add the event listener[cite: 2]
  muEl.addEventListener('input', () => {
    state.mu = muFromRaw(parseFloat(muEl.value)); //[cite: 2]
    updateSliderFill(muEl);
    muLbl.textContent = `${fmt(state.mu, 0)} mPa·s`;
    
    // Clear active preset buttons directly inline (replaces clearPresetActive)[cite: 2]
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    
    onUpdate(); // Replaces renderAll()[cite: 2]
  });

  // 3. Wire up the presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mu = parseFloat(btn.dataset.mu);
      state.mu = mu;
      
      const muSlider = document.getElementById(sliderIds.mu);
      const muLabel = document.getElementById(labelIds.mu);
      
      muSlider.value = rawFromMu(mu);
      updateSliderFill(muSlider);
      muLabel.textContent = `${fmt(mu, 0)} mPa·s`;

      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      onUpdate(); 
    });
  });

  // Set the default preset as active on initial load
  const defaultPreset = document.querySelector('.preset-btn[data-mu="1"]');
  if (defaultPreset) defaultPreset.classList.add('active');

  
  // 4. Wire up the flush button
  let flushBtn = document.getElementById('btnFlush'); //[cite: 2]
  
  // Auto-create the button if it isn't in the HTML[cite: 2]
  if (!flushBtn) {
    flushBtn = document.createElement('button');
    flushBtn.id = 'btnFlush';
    flushBtn.textContent = '🚽 FLUSH TOILET';
    flushBtn.style.cssText = 'position: fixed; bottom: 30px; right: 30px; padding: 15px 30px; background: #2dd4bf; color: #0c1826; border: none; border-radius: 8px; font-weight: 800; font-size: 18px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 9999; transition: transform 0.1s;';
    
    flushBtn.onmousedown = () => flushBtn.style.transform = 'scale(0.95)';
    flushBtn.onmouseup = () => flushBtn.style.transform = 'scale(1)';
    
    document.body.appendChild(flushBtn); //[cite: 2]
  } 
  
  flushBtn.addEventListener('click', () => {
    if (state.isFlushing) return; // Prevent double-triggering[cite: 2]
    
    state.isFlushing = true; //[cite: 2]
    onUpdate(); // Trigger animation start (replaces renderAll)
    
    // Reset after 2.2 seconds (matches the SVG animation duration)[cite: 2]
    setTimeout(() => {
      state.isFlushing = false;
      onUpdate(); // Trigger animation end (replaces renderAll)
    }, 2200);
  });
}
