// js/main.js

function renderAll() {
  const d = compute(state);
  renderPart1(d, state);
  renderPart2(d, state);
  renderPart3(d, state);
  renderReadouts(d);
}

window.addEventListener('DOMContentLoaded', () => {
  bindControls(renderAll);
  renderAll();
});