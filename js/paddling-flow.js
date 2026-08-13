(() => {
  const stages = [...document.querySelectorAll('[data-paddle-stage]')];
  const nav = [...document.querySelectorAll('[data-paddle-go]')];
  if (!stages.length) return;

  const byName = (name) => stages.find((stage) => stage.dataset.paddleStage === name);
  const activate = (name, { scroll = true } = {}) => {
    const target = byName(name);
    if (!target) return;
    stages.forEach((stage) => { stage.open = stage === target; });
    nav.forEach((button) => button.classList.toggle('is-active', button.dataset.paddleGo === name));
    if (scroll) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  nav.forEach((button) => button.addEventListener('click', () => activate(button.dataset.paddleGo)));
  document.querySelectorAll('[data-paddle-next]').forEach((button) => button.addEventListener('click', () => activate(button.dataset.paddleNext)));
  document.querySelectorAll('[data-paddle-back]').forEach((button) => button.addEventListener('click', () => activate(button.dataset.paddleBack)));

  stages.forEach((stage) => stage.addEventListener('toggle', () => {
    if (!stage.open) return;
    stages.forEach((other) => { if (other !== stage) other.open = false; });
    nav.forEach((button) => button.classList.toggle('is-active', button.dataset.paddleGo === stage.dataset.paddleStage));
  }));

  const condition = document.querySelector('[data-paddle-status]');
  const conditionSummary = document.querySelector('[data-paddle-condition-summary]');
  if (condition && conditionSummary) {
    const observer = new MutationObserver(() => {
      const text = condition.querySelector('strong')?.textContent?.trim();
      if (text) conditionSummary.textContent = text;
    });
    observer.observe(condition, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  const newPlan = document.querySelector('[data-new-plan]');
  newPlan?.addEventListener('click', () => activate('trip'));
})();
