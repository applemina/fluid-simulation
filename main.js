// js/main.js

function renderAll() {
  const d = compute(state);
  renderPart1(d, state);
  renderPart2(d, state);
  renderPart3(d, state);
  renderReadouts(d);
}

// Static derivation equations (not tied to slider state) — rendered once with
// KaTeX rather than on every renderAll() tick. This is exactly the derivation
// from the notes: Bernoulli (head form) + continuity, P1=P2=0 gauge, z2=0.
const EXPLANATION_EQUATIONS = {
  eq1: '\\dfrac{P_1}{\\rho g} + \\dfrac{v_1^2}{2g} + z_1 \\;=\\; \\dfrac{P_2}{\\rho g} + \\dfrac{v_2^2}{2g} + z_2, \\qquad P_1 = P_2 = 0 \\text{ (gauge)}',
  eq2: '\\underbrace{A_1 v_1 \\rho_1 = A_2 v_2 \\rho_2}_{\\text{continuity}} \\quad\\xrightarrow{\\rho_1=\\rho_2}\\quad v_1 = \\dfrac{A_2}{A_1} v_2 = \\beta v_2, \\qquad \\beta = \\left(\\dfrac{d_{valve}}{d_{tank}}\\right)^{2}',
  eq4: '\\begin{aligned} v_1^2 + 2g z_1 &= v_2^2 \\\\ (\\beta v_2)^2 + 2 g z_1 &= v_2^2 \\\\ 2 g z_1 &= v_2^2 (1-\\beta^2) \\\\ v_2 &= \\sqrt{\\dfrac{2 g z_1}{1-\\beta^{2}}} \\end{aligned}',
};

function renderExplanationMath() {
  const katexAvailable = typeof katex !== 'undefined';
  document.querySelectorAll('.eq[data-eq]').forEach(el => {
    const tex = EXPLANATION_EQUATIONS[el.dataset.eq];
    if (!tex) return;
    if (!katexAvailable) {
      el.textContent = tex; // CDN blocked/offline — show raw math notation rather than a blank box
      el.classList.add('eq-fallback');
      return;
    }
    try {
      katex.render(tex, el, { throwOnError: false, displayMode: true });
    } catch (e) {
      el.textContent = tex;
      el.classList.add('eq-fallback');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  bindControls(renderAll);
  renderAll();
  renderExplanationMath();
});
