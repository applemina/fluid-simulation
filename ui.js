// js/ui.js

const sliderIds = {
  H: 'sliderH', dValve: 'sliderDValve', dTank: 'sliderDTank', g: 'sliderG',
};

const labelIds = {
  H: 'labelH', dValve: 'labelDValve', dTank: 'labelDTank', g: 'labelG',
};

function updateSliderFill(input) {
  const min = parseFloat(input.min), max = parseFloat(input.max), val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--pct', pct + '%');
}

function renderReadouts(d) {
  document.getElementById('roQ').textContent = `${fmt(d.Q_Lps, 2)} L/s`;
  document.getElementById('roQMain').textContent = fmt(d.Q_Lps, 2);
  document.getElementById('roPhydro').textContent = `${fmt(d.Phydro / 1000, 2)} kPa`;
  document.getElementById('roV1').textContent = `${fmt(d.v1, 3)} m/s`;
  document.getElementById('roV2').textContent = `${fmt(d.v2, 3)} m/s`;
  document.getElementById('roBeta').textContent = fmt(d.beta, 4);
  document.getElementById('roTFlush').textContent = isFinite(d.tFlush) ? fmt(d.tFlush, 1) : '∞';

  const verdict = document.getElementById('verdictCard');
  const headline = document.getElementById('verdictHeadline');
  const detail = document.getElementById('verdictDetail');

  verdict.className = 'verdict-card ' + (d.success ? 'success' : 'fail');
  headline.textContent = d.success ? '✓ FLUSH SUCCEEDS' : '✗ FLUSH FAILS';

  if (d.success) {
    detail.textContent = `~${fmt(d.Q_Lps,2)} L/s exits the valve and clears the bowl in about ${fmt(d.tFlush,1)}s.`;
  } else if (!d.QOK) {
    detail.textContent = `Flow rate is only ${fmt(d.Q_Lps,3)} L/s — too weak to push a full flush cycle.`;
  } else {
    detail.textContent = `Flush drains too slowly (${fmt(d.tFlush,1)}s) to work in practice.`;
  }
}

// ============================================================
// BIND CONTROLS
// ============================================================
function bindControls(onUpdate) {

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
      onUpdate();
    });
  }

  setupSlider('H', v => `${fmt(v,0)} cm`);
  setupSlider('dValve', v => `${fmt(v,0)} mm`);
  setupSlider('dTank', v => `${fmt(v,0)} mm`);

  // --- gravity: linear slider + planet presets ---
  const gEl = document.getElementById(sliderIds.g);
  const gLbl = document.getElementById(labelIds.g);

  gEl.value = state.g;
  updateSliderFill(gEl);
  gLbl.textContent = `${fmt(state.g, 2)} m/s²`;

  gEl.addEventListener('input', () => {
    state.g = parseFloat(gEl.value);
    updateSliderFill(gEl);
    gLbl.textContent = `${fmt(state.g, 2)} m/s²`;
    document.querySelectorAll('.preset-btn-g').forEach(b => b.classList.remove('active'));
    onUpdate();
  });

  document.querySelectorAll('.preset-btn-g').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = parseFloat(btn.dataset.g);
      state.g = g;
      gEl.value = g;
      updateSliderFill(gEl);
      gLbl.textContent = `${fmt(g, 2)} m/s²`;
      document.querySelectorAll('.preset-btn-g').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onUpdate();
    });
  });

  const defaultGPreset = document.querySelector('.preset-btn-g[data-g="9.81"]');
  if (defaultGPreset) defaultGPreset.classList.add('active');

  // --- flush button ---
  let flushBtn = document.getElementById('btnFlush');

  if (!flushBtn) {
    flushBtn = document.createElement('button');
    flushBtn.id = 'btnFlush';
    flushBtn.textContent = '🚽 FLUSH TOILET';
    flushBtn.style.cssText = 'position: fixed; bottom: 30px; right: 30px; padding: 15px 30px; background: #2dd4bf; color: #0c1826; border: none; border-radius: 8px; font-weight: 800; font-size: 18px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 9999; transition: transform 0.1s;';
    flushBtn.onmousedown = () => flushBtn.style.transform = 'scale(0.95)';
    flushBtn.onmouseup = () => flushBtn.style.transform = 'scale(1)';
    document.body.appendChild(flushBtn);
  }

  flushBtn.addEventListener('click', () => {
    if (state.isFlushing) return;
    state.isFlushing = true;
    onUpdate();
    setTimeout(() => {
      state.isFlushing = false;
      onUpdate();
    }, 2200);
  });
}
