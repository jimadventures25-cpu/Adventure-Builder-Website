/* Adventure Builder W26 — Adventure Studio Workspace Manager */
(() => {
  'use strict';

  const STORAGE_KEY = 'adventureBuilder.studioWorkspaceMode';
  const MODES = ['auto', 'compact', 'standard', 'fullscreen'];
  let resizeFrame = 0;

  const safeRead = () => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return MODES.includes(value) ? value : 'auto';
    } catch (_) {
      return 'auto';
    }
  };

  const safeWrite = (value) => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
  };

  const safeClear = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  };

  function availableMetrics(area) {
    const rect = area.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const availableWidth = Math.max(320, Math.min(rect.width || viewportWidth, viewportWidth - 24));
    const availableHeight = Math.max(420, viewportHeight - 185);
    const panel = Math.max(190, Math.min(270, Math.round(availableWidth * 0.19)));
    return { availableWidth, availableHeight, panel };
  }

  function fit(area, status) {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const { availableWidth, availableHeight, panel } = availableMetrics(area);
      area.style.setProperty('--ab-studio-available-height', `${availableHeight}px`);
      area.style.setProperty('--ab-studio-panel-width', `${panel}px`);
      if (status) status.textContent = `Fit: ${Math.round(availableWidth)} × ${Math.round(availableHeight)} px`;
    });
  }

  function updateButtons(toolbar, mode) {
    toolbar.querySelectorAll('[data-studio-workspace-mode]').forEach((button) => {
      const active = button.dataset.studioWorkspaceMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function enterFullscreen(area) {
    if (document.fullscreenElement === area) return true;
    if (!area.requestFullscreen) return false;
    try {
      await area.requestFullscreen();
      return true;
    } catch (_) {
      return false;
    }
  }

  async function leaveFullscreen(area) {
    if (document.fullscreenElement !== area || !document.exitFullscreen) return;
    try { await document.exitFullscreen(); } catch (_) {}
  }

  async function applyMode(area, toolbar, status, requestedMode, persist = true) {
    const mode = MODES.includes(requestedMode) ? requestedMode : 'auto';
    area.classList.remove(...MODES.map((name) => `ab-studio-mode-${name}`));

    let applied = mode;
    if (mode === 'fullscreen') {
      const success = await enterFullscreen(area);
      if (!success) applied = 'auto';
    } else {
      await leaveFullscreen(area);
    }

    area.classList.add(`ab-studio-mode-${applied}`);
    area.dataset.studioWorkspaceMode = applied;
    updateButtons(toolbar, applied);
    fit(area, status);
    if (persist) safeWrite(applied);
    if (status && applied !== 'auto') status.textContent = `${applied[0].toUpperCase()}${applied.slice(1)} layout`;
  }

  function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'ab-studio-workspace-manager';
    toolbar.setAttribute('aria-label', 'Adventure Studio workspace layout');
    toolbar.innerHTML = `
      <div class="ab-studio-workspace-manager__title"><span aria-hidden="true">▣</span><span>Workspace</span></div>
      <div class="ab-studio-workspace-manager__controls">
        <button type="button" data-studio-workspace-mode="auto">Auto Fit</button>
        <button type="button" data-studio-workspace-mode="compact">Compact</button>
        <button type="button" data-studio-workspace-mode="standard">Standard</button>
        <button type="button" data-studio-workspace-mode="fullscreen">Full Screen</button>
        <button type="button" data-studio-workspace-reset>Reset Layout</button>
      </div>
      <div class="ab-studio-workspace-manager__status" data-studio-workspace-status aria-live="polite">Auto fitting workspace…</div>`;
    return toolbar;
  }

  function init() {
    const area = document.getElementById('studio-members-area');
    if (!area || area.dataset.workspaceManagerReady === 'true') return;
    area.dataset.workspaceManagerReady = 'true';

    const toolbar = createToolbar();
    area.prepend(toolbar);
    const status = toolbar.querySelector('[data-studio-workspace-status]');

    toolbar.querySelectorAll('[data-studio-workspace-mode]').forEach((button) => {
      button.addEventListener('click', () => applyMode(area, toolbar, status, button.dataset.studioWorkspaceMode));
    });

    toolbar.querySelector('[data-studio-workspace-reset]').addEventListener('click', () => {
      safeClear();
      applyMode(area, toolbar, status, 'auto', false);
      status.textContent = 'Layout reset — Auto Fit restored';
    });

    window.addEventListener('resize', () => fit(area, status), { passive: true });
    window.addEventListener('orientationchange', () => fit(area, status), { passive: true });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && area.dataset.studioWorkspaceMode === 'fullscreen') {
        applyMode(area, toolbar, status, 'auto');
      } else {
        fit(area, status);
      }
    });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => fit(area, status));
      observer.observe(area);
    }

    applyMode(area, toolbar, status, safeRead());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
