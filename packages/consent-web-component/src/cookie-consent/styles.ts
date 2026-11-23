// Applied through a constructable stylesheet where supported, so a strict
// Content-Security-Policy does not need 'unsafe-inline' for styles.
export const COOKIE_CONSENT_STYLES = `
:host {
  display: block;
  --bcc-primary: #0A7C7C;
  --bcc-on-primary: #FFFFFF;
  --bcc-bg: #FFFFFF;
  --bcc-text: #1F2937;
  --bcc-font: inherit;
  --bcc-font-size: 14px;
  --bcc-radius: 8px;
  --bcc-border: color-mix(in srgb, var(--bcc-text) 18%, transparent);
  --bcc-muted: color-mix(in srgb, var(--bcc-text) 72%, var(--bcc-bg));
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

.root {
  font-family: var(--bcc-font);
  font-size: var(--bcc-font-size);
  line-height: 1.5;
  color: var(--bcc-text);
  text-align: start;
  letter-spacing: normal;
  text-transform: none;
}

/* ── Banner ── */
.banner {
  position: fixed;
  z-index: 2147483000;
  background: var(--bcc-bg);
  color: var(--bcc-text);
  border: 1px solid var(--bcc-border);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
  display: flex;
  gap: 16px;
  padding: 16px 20px;
}
.banner.bar { left: 0; right: 0; align-items: center; border-radius: 0; }
.banner.bar.top { top: 0; border-top: 0; }
.banner.bar.bottom { bottom: 0; border-bottom: 0; }
.banner.box {
  flex-direction: column;
  width: min(420px, calc(100vw - 32px));
  border-radius: var(--bcc-radius);
}
.banner.box.bottom { bottom: 16px; left: 50%; transform: translateX(-50%); }
.banner.box.top { top: 16px; left: 50%; transform: translateX(-50%); }
.banner.box.bottom-left { bottom: 16px; left: 16px; }
.banner.box.bottom-right { bottom: 16px; right: 16px; }

.banner-text { flex: 1; min-width: 0; }
.title { margin: 0 0 4px; font-size: 1.1em; font-weight: 700; }
.message { margin: 0; }
/* Text colour, not primary: a light brand colour would be unreadable on the banner background. */
.link { color: inherit; font-weight: 600; text-decoration: underline; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }

/* ── Buttons ── */
button { font: inherit; }
.btn {
  min-height: 40px;
  padding: 8px 16px;
  border-radius: var(--bcc-radius);
  border: 1px solid var(--bcc-border);
  background: var(--bcc-bg);
  color: var(--bcc-text);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover { border-color: var(--bcc-primary); }
.btn-primary { background: var(--bcc-primary); border-color: var(--bcc-primary); color: var(--bcc-on-primary); }
.btn-primary:hover { filter: brightness(0.92); }
.btn:focus-visible, .link:focus-visible, .switch input:focus-visible + .track, .close:focus-visible, .fab:focus-visible {
  outline: 2px solid var(--bcc-primary);
  outline-offset: 2px;
}

/* ── Preferences modal ── */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483001;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal {
  background: var(--bcc-bg);
  color: var(--bcc-text);
  border-radius: var(--bcc-radius);
  width: min(560px, 100%);
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--bcc-border);
}
.modal-header .title { margin: 0; }
.close {
  border: 0;
  background: transparent;
  color: var(--bcc-muted);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}
.close:hover { color: var(--bcc-text); }
.modal-body { overflow-y: auto; padding: 0 20px; }
.category {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--bcc-border);
}
.category:last-child { border-bottom: 0; }
.category-label { font-weight: 600; }
.category-desc { margin: 2px 0 0; color: var(--bcc-muted); font-size: 0.93em; }
.category-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.always { color: var(--bcc-muted); font-size: 0.9em; }
.modal-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--bcc-border);
}

/* ── Switch ── */
.switch { position: relative; display: inline-flex; cursor: pointer; }
.switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: inherit; }
.track {
  width: 42px;
  height: 24px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--bcc-text) 25%, var(--bcc-bg));
  position: relative;
  transition: background 0.15s;
}
.track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}
.switch input:checked + .track { background: var(--bcc-primary); }
.switch input:checked + .track::after { transform: translateX(18px); }
.switch input:disabled { cursor: not-allowed; }
.switch input:disabled + .track { opacity: 0.6; }

/* ── Floating button ── */
.fab {
  position: fixed;
  bottom: 16px;
  left: 16px;
  z-index: 2147482999;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--bcc-border);
  background: var(--bcc-bg);
  color: var(--bcc-primary);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.fab.right { left: auto; right: 16px; }
.fab svg { width: 24px; height: 24px; }

@media (max-width: 640px) {
  .banner.bar { flex-direction: column; align-items: stretch; }
  .actions, .modal-footer { flex-direction: column-reverse; align-items: stretch; }
  .btn { width: 100%; white-space: normal; }
}

@media (prefers-reduced-motion: reduce) {
  .track, .track::after { transition: none; }
}
`;
