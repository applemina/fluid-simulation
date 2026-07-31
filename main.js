// js/main.js

function renderAll() {
  const d = compute(state);
  renderPart1(d, state);
  renderPart2(d, state);
  renderPart3(d, state);
  renderReadouts(d);
}

// The Part 1 "Explanation" equations are static (not tied to slider state),
// so render them once with KaTeX rather than on every renderAll() tick.
const EXPLANATION_EQUATIONS = {
  eq1: 'P_1 + \\tfrac{1}{2}\\rho v_1^2 + \\rho g H = P_2 + \\tfrac{1}{2}\\rho v_2^2',
  eq2: 'A_1 v_1 = A_2 v_2 \\quad\\Longrightarrow\\quad v_1 = \\beta\\, v_2, \\qquad \\beta = \\left(\\dfrac{d_{valve}}{d_{tank}}\\right)^{2}',
  eq3: 'P_2 = \\rho g\\, H_{back}',
  eq4: '\\begin{aligned} \\rho g H + \\tfrac12\\rho(\\beta v_2)^2 &= \\rho g H_{back} + \\tfrac12\\rho v_2^2\\\\ g(H-H_{back}) &= \\tfrac12 v_2^2(1-\\beta^2)\\\\ v_2 &= \\sqrt{\\dfrac{2g(H-H_{back})}{1-\\beta^2}} \\end{aligned}',
  eq5: 'v_{\\text{actual}} = C_d \\cdot v_2, \\qquad C_d = C_{d,0}\\dfrac{Re}{Re+K}, \\qquad Re = \\dfrac{\\rho v_2 d_{valve}}{\\mu}',
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
      el.textContent = tex; // fallback: show raw LaTeX rather than a blank box
      el.classList.add('eq-fallback');
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  bindControls(renderAll);
  renderAll();
  renderExplanationMath();
});