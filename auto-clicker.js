/*!
 * Auto-Clicker v1.0.0
 * Single-file bookmarklet payload. No dependencies, no build step.
 * Loaded from raw.githack.com and injected with a javascript: bookmarklet.
 */
(() => {
  'use strict';

  const NS = '__AC_V1__';
  const VERSION = '1.0.0';
  const HOST_ID = 'ac-v1-host';

  const existing = window[NS];
  if (existing && typeof existing.reveal === 'function') {
    existing.reveal();
    return;
  }
  if (existing) return;
  window[NS] = { loading: true };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const round = (n) => Math.round(n);

  function gaussian() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function fmtDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function textSig(el) {
    if (!el) return '';
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 40);
  }

  function classTokens(el) {
    const set = new Set();
    if (!el || !el.classList) return set;
    for (const c of el.classList) {
      if (c && !c.startsWith('ac-')) set.add(c);
    }
    return set;
  }

  function describe(el) {
    if (!el || el.nodeType !== 1 || !el.tagName) return '—';
    const tag = el.tagName.toLowerCase();
    let out = tag;
    if (el.id) out += '#' + el.id;
    const cls = [...classTokens(el)].slice(0, 2);
    if (cls.length) out += '.' + cls.join('.');
    const text = textSig(el);
    if (text) out += ' "' + text.slice(0, 22) + (text.length > 22 ? '…' : '') + '"';
    return out;
  }

  const KEY_LABELS = {
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    IntlBackslash: '\\',
    Space: 'Space',
    Enter: 'Enter',
    NumpadEnter: 'Num Enter',
    Tab: 'Tab',
    Escape: 'Esc',
    Backspace: 'Backspace',
    Delete: 'Del',
    Insert: 'Ins',
    Home: 'Home',
    End: 'End',
    PageUp: 'PgUp',
    PageDown: 'PgDn',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    AltLeft: 'Alt',
    AltRight: 'Alt',
    MetaLeft: 'Meta',
    MetaRight: 'Meta',
    CapsLock: 'Caps',
    NumLock: 'NumLock',
    ScrollLock: 'ScrLk',
    Pause: 'Pause',
    ContextMenu: 'Menu',
    PrintScreen: 'PrtSc',
    NumpadAdd: 'Num +',
    NumpadSubtract: 'Num -',
    NumpadMultiply: 'Num *',
    NumpadDivide: 'Num /',
    NumpadDecimal: 'Num .'
  };

  function keyLabel(code, key) {
    if (code && KEY_LABELS[code]) return KEY_LABELS[code];
    if (code && code.startsWith('Key')) return code.slice(3);
    if (code && code.startsWith('Digit')) return code.slice(5);
    if (code && code.startsWith('Numpad')) return 'Num ' + code.slice(6);
    if (code && /^F\d{1,2}$/.test(code)) return code;
    return key || code || '?';
  }

  const state = {
    running: false,
    paused: false,
    pauseReason: '',
    recording: false,
    picking: false,
    locked: null,
    cursor: { x: 0, y: 0, seen: false },
    lastPage: null,
    startKey: { code: 'Backquote', key: '`', label: '`' },
    lockInput: 'mouse',
    cps: 10,
    jitter: 10,
    gaussian: true,
    maxClicks: 0,
    microShift: 2,
    hover: true,
    guard: true,
    burst: false,
    fx: true,
    clicks: 0,
    activeMs: 0,
    segStart: 0,
    lastClickAt: 0,
    lastDelta: 0,
    smoothCps: 0,
    clickTimes: [],
    deltas: [],
    lastPoint: null,
    burstLeft: 0,
    burstPauseUntil: 0,
    destroyed: false
  };

  let host = null;
  let shadow = null;
  let panel = null;
  let picker = null;
  let pickBox = null;
  let pickTag = null;
  let pickCursor = null;
  let pickCoords = null;
  let pickHint = null;
  let canvas = null;
  let ctx = null;
  let els = {};

  let abort = new AbortController();
  let observer = null;
  let uiTimer = 0;
  let cursorRaf = 0;
  let pickRaf = 0;
  let flashTimer = 0;

  let worker = null;
  let workerUrl = null;
  let workerFailed = false;
  let mainTimer = 0;
  let scheduleSeq = 0;
  let scheduledId = 0;
  let scheduledDue = 0;

  let fxSprites = null;
  let fxParticles = [];
  let fxRaf = 0;
  let fxPrev = 0;
  let fxLastX = 0;
  let fxLastY = 0;
  let fxLastAt = 0;
  let fxLastBurst = 0;
  let fxReduced = false;
  let lastUiRefresh = 0;

  const CSS_TEXT = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button, input { font: inherit; }
    button { -webkit-tap-highlight-color: transparent; }

    .ac-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2;
      width: min(332px, calc(100vw - 24px));
      max-height: calc(100vh - 24px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #e8eef8;
      background: linear-gradient(180deg, rgba(16, 22, 33, 0.97), rgba(8, 12, 19, 0.985));
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 15px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55), 0 2px 10px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(16px) saturate(130%);
      pointer-events: auto;
      user-select: none;
      font: 12px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
      color-scheme: dark;
      animation: ac-in 180ms ease-out;
    }
    .ac-panel[data-state="running"] { border-color: rgba(52, 211, 153, 0.38); }
    .ac-panel[data-state="ready"] { border-color: rgba(251, 191, 36, 0.3); }
    .ac-panel[data-state="paused"],
    .ac-panel[data-state="error"] { border-color: rgba(248, 113, 113, 0.42); }
    .ac-panel.collapsed { width: auto; min-width: 232px; }
    .ac-panel.collapsed .ac-body { display: none; }

    .ac-head {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      padding: 10px 10px 10px 13px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      cursor: grab;
      touch-action: none;
    }
    .ac-head:active { cursor: grabbing; }
    .ac-title {
      color: #e2e8f0;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .ac-title span { color: #67e8f9; }
    .ac-badge {
      flex: 0 0 auto;
      padding: 1px 5px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 4px;
      color: #7d8da6;
      background: rgba(148, 163, 184, 0.06);
      font: 600 8.5px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      letter-spacing: 0.06em;
    }
    .ac-dot {
      flex: 0 0 auto;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #64748b;
      box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.12);
      transition: background 150ms, box-shadow 150ms;
    }
    .ac-dot.sm { width: 6px; height: 6px; box-shadow: none; }
    .ac-dot[data-state="ready"] { background: #fbbf24; box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.13), 0 0 12px rgba(251, 191, 36, 0.4); }
    .ac-dot[data-state="recording"] { background: #67e8f9; box-shadow: 0 0 0 3px rgba(103, 232, 249, 0.14), 0 0 12px rgba(103, 232, 249, 0.5); }
    .ac-dot[data-state="running"] { background: #34d399; box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.13), 0 0 12px rgba(52, 211, 153, 0.55); animation: ac-pulse 1.1s ease-in-out infinite; }
    .ac-dot[data-state="paused"],
    .ac-dot[data-state="error"] { background: #f87171; box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.13), 0 0 12px rgba(248, 113, 113, 0.45); }

    .ac-mini { display: none; align-items: baseline; gap: 3px; margin-left: 2px; color: #67e8f9; font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .ac-mini i { color: #7d8da6; font: 600 8px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
    .ac-panel.collapsed .ac-mini { display: inline-flex; }
    .ac-panel.collapsed .ac-badge { display: none; }
    .ac-spacer { flex: 1; }

    .ac-icon {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: #8494ad;
      font: 600 14px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
    }
    .ac-icon:hover { color: #dbeafe; background: rgba(148, 163, 184, 0.12); border-color: rgba(148, 163, 184, 0.14); }
    .ac-close:hover { color: #fca5a5; background: rgba(248, 113, 113, 0.12); border-color: rgba(248, 113, 113, 0.22); }
    .ac-mini-stop { color: #f87171; font-size: 10px; }
    .ac-mini-stop:hover { color: #fecaca; background: rgba(248, 113, 113, 0.16); }

    .ac-body { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #263244 transparent; }
    .ac-body::-webkit-scrollbar { width: 6px; }
    .ac-body::-webkit-scrollbar-track { background: transparent; }
    .ac-body::-webkit-scrollbar-thumb { background: #263244; border-radius: 99px; }

    .ac-metrics { display: grid; grid-template-columns: 1.1fr 1fr 1fr; border-bottom: 1px solid rgba(148, 163, 184, 0.1); background: rgba(103, 232, 249, 0.025); }
    .ac-metric { min-width: 0; padding: 9px 12px 8px; border-right: 1px solid rgba(148, 163, 184, 0.09); }
    .ac-metric:last-child { border-right: 0; }
    .ac-metric span { display: block; color: #7d8da6; font: 700 8px/1.3 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.11em; text-transform: uppercase; white-space: nowrap; }
    .ac-metric strong { display: block; margin-top: 2px; color: #e8f6ff; font: 600 19px/1.15 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: -0.02em; }
    .ac-metric strong#mCps { color: #67e8f9; }

    .ac-statusline { display: flex; align-items: center; gap: 7px; min-height: 30px; padding: 6px 13px; border-bottom: 1px solid rgba(148, 163, 184, 0.1); color: #aebdd2; font-size: 10.5px; line-height: 1.35; }
    .ac-statusline #statusText { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .ac-sec { padding: 10px 13px 11px; border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
    .ac-row { display: flex; align-items: center; gap: 7px; min-height: 27px; margin: 4px 0; }
    .ac-row-sub { min-height: 14px; margin: -1px 0 5px; }
    .ac-label { flex: 0 0 70px; width: 70px; color: #8b9bb4; font-size: 10.5px; letter-spacing: 0.02em; }
    .ac-val { flex: 1; min-width: 0; color: #dbe7f5; font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ac-val.ac-ellipsis { color: #a5f3fc; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .ac-hint { color: #718096; font-size: 9.5px; white-space: nowrap; }
    .ac-unit { color: #7d8da6; font-size: 9.5px; white-space: nowrap; }
    .ac-inline { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; }
    .ac-speed { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; }

    .ac-num {
      width: 58px;
      height: 26px;
      padding: 0 6px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 7px;
      outline: none;
      color: #e8f6ff;
      background: #0b1220;
      font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      user-select: text;
    }
    .ac-num:focus { border-color: #67e8f9; box-shadow: 0 0 0 2px rgba(103, 232, 249, 0.14); }
    .ac-num::-webkit-inner-spin-button { opacity: 0.35; }

    input[type="range"].ac-range { flex: 1; min-width: 0; height: 16px; margin: 0; accent-color: #67e8f9; cursor: pointer; }
    input[type="checkbox"] { width: 13px; height: 13px; margin: 0; accent-color: #34d399; }
    .ac-check { display: inline-flex; align-items: center; gap: 4px; color: #8b9bb4; font-size: 10px; cursor: pointer; white-space: nowrap; }

    .ac-seg { flex: 1; display: flex; gap: 2px; padding: 2px; border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 8px; background: #0a1120; }
    .ac-seg button {
      flex: 1;
      height: 23px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      color: #8494ad;
      background: transparent;
      font: 600 10px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
    }
    .ac-seg button:hover { color: #dbe7f5; background: rgba(148, 163, 184, 0.08); }
    .ac-seg button.active { color: #a5f3fc; background: rgba(103, 232, 249, 0.13); box-shadow: inset 0 0 0 1px rgba(103, 232, 249, 0.24); }

    .ac-btn {
      height: 31px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 10px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      color: #cbd8ea;
      background: #131c2b;
      font: 700 11px/1 ui-sans-serif, system-ui, sans-serif;
      white-space: nowrap;
      cursor: pointer;
    }
    .ac-btn:hover { border-color: rgba(148, 163, 184, 0.32); background: #192335; }
    .ac-btn:active { transform: translateY(1px); }
    .ac-btn:disabled { opacity: 0.38; cursor: not-allowed; transform: none; }
    .ac-btn-sm { height: 23px; padding: 0 7px; border-radius: 6px; font-size: 9.5px; font-weight: 600; }
    .ac-btn.recording { color: #a5f3fc; border-color: rgba(103, 232, 249, 0.5); background: rgba(103, 232, 249, 0.1); }
    .ac-adv-body .ac-note { margin-left: 0; }
    .ac-primary {
      flex: 1.45;
      color: #04121a;
      background: linear-gradient(180deg, #8ff5d0, #5eead4);
      border-color: rgba(94, 234, 212, 0.75);
      box-shadow: 0 4px 18px rgba(45, 212, 191, 0.18);
    }
    .ac-primary:hover { background: linear-gradient(180deg, #a7f8dc, #75f0dd); border-color: rgba(94, 234, 212, 0.9); }
    .ac-danger { flex: 1; color: #fca5a5; background: rgba(248, 113, 113, 0.09); border-color: rgba(248, 113, 113, 0.32); }
    .ac-danger:hover { background: rgba(248, 113, 113, 0.16); border-color: rgba(248, 113, 113, 0.45); }
    .ac-actions { display: flex; gap: 7px; margin-top: 9px; }
    .ac-hotkey { margin-top: 7px; color: #64748b; font-size: 9px; text-align: center; }
    .ac-hotkey b { color: #94a3b8; font-weight: 700; }

    .ac-kbd {
      min-width: 38px;
      height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
      border: 1px solid rgba(103, 232, 249, 0.25);
      border-bottom-color: rgba(103, 232, 249, 0.4);
      border-radius: 6px;
      color: #a5f3fc;
      background: rgba(8, 19, 28, 0.9);
      font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      box-shadow: inset 0 -1px 0 rgba(103, 232, 249, 0.15);
      white-space: nowrap;
    }
    .ac-note { margin: 2px 0 0 77px; color: #fbbf24; font-size: 9.5px; line-height: 1.35; }
    .ac-note.dim { color: #64748b; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    .ac-adv { border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
    .ac-adv summary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 13px;
      color: #8b9bb4;
      font-size: 10.5px;
      font-weight: 600;
      cursor: pointer;
      list-style: none;
    }
    .ac-adv summary::-webkit-details-marker { display: none; }
    .ac-adv summary::before { content: "▸"; color: #64748b; font-size: 9px; }
    .ac-adv[open] summary::before { content: "▾"; }
    .ac-adv summary:hover { color: #cbd8ea; }
    .ac-adv-body { padding: 0 13px 9px; }
    .ac-toggle { display: flex; align-items: center; gap: 6px; padding: 4px 0; color: #aebdd2; font-size: 10.5px; cursor: pointer; }

    .ac-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 13px 8px; color: #64748b; font: 9px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .ac-foot span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .ac-canvas { position: fixed; inset: 0; z-index: 1; width: 100%; height: 100%; pointer-events: none; }

    .ac-picker { position: fixed; inset: 0; z-index: 10; overflow: hidden; cursor: none; pointer-events: auto; background: radial-gradient(circle at 50% 50%, rgba(5, 16, 24, 0) 42%, rgba(2, 6, 12, 0.22) 100%); }
    .ac-pick-hint {
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      max-width: calc(100vw - 24px);
      padding: 8px 13px;
      border: 1px solid rgba(103, 232, 249, 0.4);
      border-radius: 999px;
      color: #d9f7ff;
      background: rgba(8, 14, 24, 0.96);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
      font: 600 11.5px/1.3 ui-sans-serif, system-ui, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .ac-pick-hint.bad { border-color: rgba(248, 113, 113, 0.7); color: #fecaca; }
    .ac-pick-box {
      position: fixed;
      border: 1.5px solid rgba(103, 232, 249, 0.9);
      border-radius: 4px;
      background: rgba(103, 232, 249, 0.08);
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35), 0 0 22px rgba(103, 232, 249, 0.16);
      pointer-events: none;
    }
    .ac-pick-box.bad { border-color: rgba(248, 113, 113, 0.95); background: rgba(248, 113, 113, 0.1); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35), 0 0 22px rgba(248, 113, 113, 0.18); }
    .ac-pick-tag {
      position: fixed;
      max-width: 340px;
      padding: 3px 7px;
      border: 1px solid rgba(103, 232, 249, 0.24);
      border-radius: 5px;
      color: #a5f3fc;
      background: rgba(5, 13, 21, 0.94);
      font: 10px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .ac-pick-tag.bad { color: #fca5a5; border-color: rgba(248, 113, 113, 0.3); }
    .ac-pick-cursor { position: fixed; left: 0; top: 0; width: 0; height: 0; pointer-events: none; will-change: transform; }
    .ac-pick-cursor::before {
      content: "";
      position: absolute;
      left: -9px;
      top: -9px;
      width: 18px;
      height: 18px;
      border: 1.5px solid #67e8f9;
      border-radius: 50%;
      box-shadow: 0 0 16px rgba(103, 232, 249, 0.65), inset 0 0 8px rgba(103, 232, 249, 0.18);
    }
    .ac-pick-cursor::after {
      content: "";
      position: absolute;
      left: -2px;
      top: -2px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #d9f7ff;
    }
    .ac-pick-cursor b {
      position: absolute;
      left: 14px;
      top: 12px;
      padding: 2px 5px;
      border: 1px solid rgba(103, 232, 249, 0.22);
      border-radius: 4px;
      color: #a5f3fc;
      background: rgba(4, 12, 19, 0.9);
      font: 600 9.5px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: nowrap;
    }

    .ac-panel.flash { animation: ac-flash 600ms ease-out; }
    @keyframes ac-in { from { transform: translateY(-4px) scale(0.985); } }
    @keyframes ac-flash { 0% { box-shadow: 0 0 0 1px rgba(103, 232, 249, 0.8), 0 24px 80px rgba(0, 0, 0, 0.55); } 100% { box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55), 0 2px 10px rgba(0, 0, 0, 0.4); } }
    @keyframes ac-pulse { 0%, 100% { box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.13), 0 0 10px rgba(52, 211, 153, 0.4); } 50% { box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.08), 0 0 18px rgba(52, 211, 153, 0.65); } }

    .ac-panel :is(button, input, summary):focus-visible { outline: 2px solid #67e8f9; outline-offset: 1px; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.001ms !important; transition: none !important; }
    }
  `;

  const MARKUP = `
    <div class="ac-panel" id="panel" role="region" aria-label="Auto-Clicker">
      <div class="ac-head" id="dragHandle">
        <span class="ac-dot" id="statusDot" data-state="idle"></span>
        <span class="ac-title">AUTO<span>CLICKER</span></span>
        <span class="ac-badge">v1</span>
        <span class="ac-mini"><b id="miniCps">0.0</b><i>cps</i></span>
        <span class="ac-spacer"></span>
        <button class="ac-icon ac-mini-stop" id="btnMiniStop" title="Stop (F8)" aria-label="Stop clicking" hidden>■</button>
        <button class="ac-icon" id="btnCollapse" title="Collapse" aria-label="Collapse panel" aria-expanded="true">−</button>
        <button class="ac-icon ac-close" id="btnClose" title="Close and clean up" aria-label="Close Auto-Clicker">×</button>
      </div>

      <div class="ac-body" id="body">
        <div class="ac-metrics">
          <div class="ac-metric"><span>CPS actual</span><strong id="mCps">0.0</strong></div>
          <div class="ac-metric"><span>Clicks</span><strong id="mClicks">0</strong></div>
          <div class="ac-metric"><span>Run</span><strong id="mTime">00:00</strong></div>
        </div>

        <div class="ac-statusline"><span class="ac-dot sm" id="statusDot2" data-state="idle"></span><span id="statusText" aria-live="polite">Idle — pick a tap point</span></div>

        <div class="ac-sec">
          <div class="ac-row">
            <span class="ac-label">Cursor</span>
            <span class="ac-val" id="curPos">—, —</span>
            <span class="ac-hint">viewport</span>
          </div>
          <div class="ac-row">
            <span class="ac-label">Tap point</span>
            <span class="ac-val" id="lockPos">not locked</span>
            <button class="ac-btn ac-btn-sm" id="btnPick" type="button">Pick</button>
            <button class="ac-btn ac-btn-sm" id="btnClear" type="button" disabled>Clear</button>
          </div>
          <div class="ac-row">
            <span class="ac-label">Target</span>
            <span class="ac-val ac-ellipsis" id="targetDesc" title="">—</span>
          </div>
        </div>

        <div class="ac-sec">
          <div class="ac-row">
            <label class="ac-label" for="cpsRange">Speed</label>
            <div class="ac-speed">
              <input class="ac-range" type="range" id="cpsRange" min="0.5" max="50" step="0.5" value="10" aria-label="Clicks per second">
              <input class="ac-num" type="number" id="cpsNum" min="0.5" max="50" step="0.1" value="10" aria-label="Clicks per second">
              <span class="ac-unit">CPS</span>
            </div>
          </div>
          <div class="ac-row ac-row-sub">
            <span class="ac-label"></span>
            <span class="ac-hint" id="intervalText">100 ms between clicks</span>
          </div>
          <div class="ac-row">
            <label class="ac-label" for="jitterNum">Jitter</label>
            <div class="ac-inline">
              <input class="ac-num" type="number" id="jitterNum" min="0" max="50" step="1" value="10" aria-label="Jitter percent">
              <span class="ac-unit">%</span>
              <label class="ac-check"><input type="checkbox" id="gaussian" checked> Gaussian</label>
            </div>
          </div>
          <div class="ac-row">
            <label class="ac-label" for="maxNum">Max clicks</label>
            <div class="ac-inline">
              <input class="ac-num" type="number" id="maxNum" min="0" max="1000000" step="1" value="0" aria-label="Maximum clicks, zero means unlimited">
              <span class="ac-hint" id="maxHint">0 = unlimited</span>
            </div>
          </div>
        </div>

        <div class="ac-sec">
          <div class="ac-row">
            <span class="ac-label">Lock input</span>
            <div class="ac-seg" id="lockSeg" role="group" aria-label="Lock input">
              <button type="button" data-lock="mouse" class="active">Mouse</button>
              <button type="button" data-lock="space">Space</button>
            </div>
          </div>
          <div class="ac-row">
            <span class="ac-label">Start key</span>
            <div class="ac-inline">
              <kbd class="ac-kbd" id="startKey"></kbd>
              <button class="ac-btn ac-btn-sm" id="btnRecord" type="button">Record</button>
            </div>
          </div>
          <div class="ac-note" id="keyWarn" hidden></div>
          <div class="ac-actions">
            <button class="ac-btn ac-primary" id="btnStart" type="button"><span aria-hidden="true">▶</span><span id="startLabel">Start clicking</span></button>
            <button class="ac-btn ac-danger" id="btnStop" type="button" disabled><span aria-hidden="true">■</span><span>Stop</span></button>
          </div>
          <div class="ac-hotkey"><b>F8</b> — emergency stop from anywhere</div>
        </div>

        <details class="ac-adv" id="adv">
          <summary>Advanced</summary>
          <div class="ac-adv-body">
            <div class="ac-row">
              <label class="ac-label" for="shiftNum">Micro-shift</label>
              <div class="ac-inline">
                <input class="ac-num" type="number" id="shiftNum" min="0" max="12" step="1" value="2" aria-label="Micro shift in pixels">
                <span class="ac-unit">px</span>
              </div>
            </div>
            <label class="ac-toggle"><input type="checkbox" id="optHover" checked> Hover events before click</label>
            <label class="ac-toggle"><input type="checkbox" id="optGuard" checked> Mutation guard</label>
            <label class="ac-toggle"><input type="checkbox" id="optBurst"> Burst / pause cycles</label>
            <label class="ac-toggle"><input type="checkbox" id="optFx" checked> Particle effects</label>
            <div class="ac-note dim" id="timerNote">timer: worker</div>
          </div>
        </details>

        <div class="ac-foot">
          <span id="lastClick">last —</span>
          <span id="footCps">target 10.0 · avg —</span>
        </div>
      </div>
    </div>

    <canvas class="ac-canvas" id="fxCanvas"></canvas>

    <div class="ac-picker" id="picker" hidden>
      <div class="ac-pick-hint" id="pickHint">Click to lock this point · Esc to cancel</div>
      <div class="ac-pick-box" id="pickBox" hidden></div>
      <div class="ac-pick-tag" id="pickTag" hidden></div>
      <div class="ac-pick-cursor" id="pickCursor" hidden><b id="pickCoords">0, 0</b></div>
    </div>
  `;

  // -------------------------------------------------------------------------
  // Small DOM helpers
  // -------------------------------------------------------------------------

  function on(target, type, fn, opts = {}) {
    target.addEventListener(type, fn, { signal: abort.signal, ...opts });
  }

  function isOurNode(node) {
    if (!node) return false;
    if (host && node === host) return true;
    if (shadow && node === shadow) return true;
    try {
      if (shadow && node.getRootNode && node.getRootNode() === shadow) return true;
    } catch {}
    return false;
  }

  function isOurEvent(e) {
    if (!host) return false;
    try {
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(host)) return true;
      for (const n of path) {
        if (isOurNode(n)) return true;
      }
    } catch {}
    return isOurNode(e.target);
  }

  function pointInPanel(x, y) {
    if (!panel) return false;
    const r = panel.getBoundingClientRect();
    return x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2;
  }

  function withUiHidden(fn) {
    const oldPanel = panel ? panel.style.pointerEvents : '';
    const oldPicker = picker ? picker.style.pointerEvents : '';
    try {
      if (panel) panel.style.pointerEvents = 'none';
      if (picker) picker.style.pointerEvents = 'none';
      return fn();
    } finally {
      if (panel) panel.style.pointerEvents = oldPanel;
      if (picker) picker.style.pointerEvents = oldPicker;
    }
  }

  function rectToTop(r, ox, oy) {
    return {
      left: r.left + ox,
      top: r.top + oy,
      right: r.right + ox,
      bottom: r.bottom + oy,
      width: r.width,
      height: r.height
    };
  }

  // Resolve the deepest element under a viewport point. Walks open shadow
  // roots and same-origin iframe chains. Returns local coordinates too, which
  // are the coordinates used when dispatching into an iframe's document.
  function resolveAtPoint(topX, topY) {
    return withUiHidden(() => {
      let doc = document;
      let offX = 0;
      let offY = 0;
      let el = null;
      let inFrame = 0;
      let inShadow = 0;

      for (let depth = 0; depth < 12; depth++) {
        const lx = topX - offX;
        const ly = topY - offY;
        if (lx < -1 || ly < -1) return { ok: false, reason: 'point is outside the page' };

        if (!el) {
          el = doc.elementFromPoint(lx, ly);
          if (!el) return { ok: false, reason: 'nothing under the point' };
        }

        const sr = el.shadowRoot;
        if (sr) {
          let inner = null;
          try {
            inner = sr.elementFromPoint(lx, ly);
          } catch {}
          if (inner && inner !== el) {
            el = inner;
            inShadow++;
            continue;
          }
        }

        if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
          let innerDoc = null;
          try {
            innerDoc = el.contentDocument;
          } catch {}
          if (!innerDoc) {
            const r = el.getBoundingClientRect();
            return {
              ok: false,
              blocked: true,
              reason: 'cross-origin iframe',
              el,
              doc,
              x: lx,
              y: ly,
              topRect: rectToTop(r, offX, offY),
              inFrame,
              inShadow
            };
          }
          const r = el.getBoundingClientRect();
          offX += r.left + (el.clientLeft || 0);
          offY += r.top + (el.clientTop || 0);
          doc = innerDoc;
          el = null;
          inFrame++;
          continue;
        }

        break;
      }

      if (!el) return { ok: false, reason: 'nothing under the point' };
      const r = el.getBoundingClientRect();
      return {
        ok: true,
        el,
        doc,
        x: topX - offX,
        y: topY - offY,
        topRect: rectToTop(r, offX, offY),
        inFrame,
        inShadow
      };
    });
  }

  function isDisabled(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      if (el.disabled === true) return true;
      if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return true;
      if (el.closest && el.closest('[inert]')) return true;
      if (el.closest && el.closest('[aria-disabled="true"]')) return true;
      if (el.closest && el.closest('fieldset[disabled]')) return true;
    } catch {}
    return false;
  }

  function compatibleTarget(hit, locked) {
    const a = hit && hit.el;
    const b = locked && locked.el;
    if (!a || !b) return false;
    if (a === b) return true;
    try {
      if (a.contains && a.contains(b)) return true;
      if (b.contains && b.contains(a)) return true;
    } catch {}
    if (a.tagName !== b.tagName) return false;
    if (locked.id || a.id) return locked.id === a.id;
    const ca = classTokens(a);
    const cb = classTokens(b);
    if (ca.size && cb.size) {
      for (const c of ca) if (cb.has(c)) return true;
    }
    const ta = textSig(a);
    const tb = textSig(b);
    if (ta && ta === tb) return true;
    return ca.size === 0 && cb.size === 0;
  }

  function dispatchClick(hit) {
    const el = hit.el;
    const doc = hit.doc || document;
    const win = doc.defaultView || window;
    const x = hit.x;
    const y = hit.y;
    const screenX = x + (win.screenX || 0);
    const screenY = y + (win.screenY || 0);

    const opts = (buttons) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      view: win,
      button: 0,
      buttons,
      clientX: x,
      clientY: y,
      screenX,
      screenY,
      detail: 0
    });

    const pointer = (type, buttons) => {
      const o = {
        ...opts(buttons),
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        width: 1,
        height: 1,
        pressure: buttons ? 0.5 : 0,
        tiltX: 0,
        tiltY: 0
      };
      if (typeof win.PointerEvent === 'function') return new win.PointerEvent(type, o);
      return new win.MouseEvent(type, opts(buttons));
    };

    const mouse = (type, buttons) => new win.MouseEvent(type, opts(buttons));

    if (state.hover) {
      el.dispatchEvent(pointer('pointerover', 0));
      el.dispatchEvent(mouse('mouseover', 0));
      el.dispatchEvent(pointer('pointermove', 0));
      el.dispatchEvent(mouse('mousemove', 0));
    }

    el.dispatchEvent(pointer('pointerdown', 1));
    el.dispatchEvent(mouse('mousedown', 1));
    el.dispatchEvent(pointer('pointerup', 0));
    el.dispatchEvent(mouse('mouseup', 0));

    const clickOpts = { ...opts(0), detail: 1 };
    if (typeof win.PointerEvent === 'function') {
      el.dispatchEvent(new win.PointerEvent('click', clickOpts));
    } else {
      el.dispatchEvent(new win.MouseEvent('click', clickOpts));
    }
  }

  // -------------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------------

  function setStatus(kind, text) {
    if (!els.statusText) return;
    els.statusText.textContent = text;
    if (els.statusDot) els.statusDot.dataset.state = kind;
    if (els.statusDot2) els.statusDot2.dataset.state = kind;
    if (panel) panel.dataset.state = kind;
  }

  function updateTimingHint() {
    if (!els.intervalText) return;
    const base = 1000 / state.cps;
    if (state.jitter <= 0) {
      els.intervalText.textContent = `${base.toFixed(0)} ms between clicks`;
    } else {
      const jitterMs = base * state.jitter / 100;
      els.intervalText.textContent = `${base.toFixed(0)} ms base · ±${jitterMs.toFixed(0)} ms`;
    }
  }

  function updateMaxHint() {
    if (!els.maxHint) return;
    els.maxHint.textContent = state.maxClicks > 0 ? `${state.maxClicks} click limit` : '0 = unlimited';
  }

  function updateLockUi() {
    if (!els.lockPos) return;
    if (!state.locked) {
      els.lockPos.textContent = 'not locked';
      els.lockPos.title = '';
      els.targetDesc.textContent = '—';
      els.targetDesc.title = '';
    } else {
      els.lockPos.textContent = `${round(state.locked.x)}, ${round(state.locked.y)}`;
      els.lockPos.title = 'Viewport coordinates';
      const flags = [];
      if (state.locked.inShadow) flags.push('shadow');
      if (state.locked.inFrame) flags.push('iframe');
      if (state.locked.blocked) flags.push('cross-origin');
      const text = state.locked.descriptor + (flags.length ? ' · ' + flags.join(' · ') : '');
      els.targetDesc.textContent = text;
      els.targetDesc.title = text;
    }
    if (els.btnClear) els.btnClear.disabled = state.running || !state.locked;
  }

  function syncButtons() {
    if (!els.btnStart) return;
    els.btnStart.disabled = state.running;
    els.startLabel.textContent = state.paused ? 'Resume' : 'Start clicking';
    els.btnStop.disabled = !(state.running || state.paused);
    els.btnPick.disabled = state.running;
    els.btnPick.textContent = state.picking ? 'Cancel' : 'Pick';
    els.btnClear.disabled = state.running || !state.locked;
    els.btnRecord.disabled = state.running;
    els.btnRecord.textContent = state.recording ? 'Cancel' : 'Record';
    els.btnRecord.classList.toggle('recording', state.recording);
    els.btnMiniStop.hidden = !(state.running || state.paused);
    if (els.btnCollapse) {
      const collapsed = panel.classList.contains('collapsed');
      els.btnCollapse.textContent = collapsed ? '+' : '−';
      els.btnCollapse.setAttribute('aria-expanded', String(!collapsed));
      els.btnCollapse.title = collapsed ? 'Expand' : 'Collapse';
    }
  }

  function syncControls() {
    els.cpsRange.value = String(state.cps);
    els.cpsNum.value = state.cps.toFixed(1);
    els.jitterNum.value = String(state.jitter);
    els.gaussian.checked = state.gaussian;
    els.maxNum.value = String(state.maxClicks);
    els.shiftNum.value = String(state.microShift);
    els.optHover.checked = state.hover;
    els.optGuard.checked = state.guard;
    els.optBurst.checked = state.burst;
    els.optFx.checked = state.fx;
    els.startKey.textContent = state.startKey.label;
    els.startKey.title = state.startKey.code ? `${state.startKey.label} (${state.startKey.code})` : state.startKey.label;
    [...els.lockSeg.querySelectorAll('button')].forEach((b) => {
      b.classList.toggle('active', b.dataset.lock === state.lockInput);
    });
    updateTimingHint();
    updateMaxHint();
    updateKeyWarn();
    updateLockUi();
    syncButtons();
  }

  function updateKeyWarn() {
    if (!els.keyWarn) return;
    const code = state.startKey.code || '';
    const mod = /^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code);
    els.keyWarn.hidden = !mod;
    els.keyWarn.textContent = mod
      ? 'Modifier start keys can fire while using the page. F8 always stops.'
      : '';
  }

  function elapsedMs() {
    return state.activeMs + (state.running && state.segStart ? performance.now() - state.segStart : 0);
  }

  function averageCps() {
    if (!state.deltas.length) return 0;
    let total = 0;
    for (const d of state.deltas) total += d;
    const avg = total / state.deltas.length;
    return avg > 0 ? 1000 / avg : 0;
  }

  function countClicksLastSecond(now) {
    let n = 0;
    for (let i = state.clickTimes.length - 1; i >= 0; i--) {
      if (now - state.clickTimes[i] <= 1000) n++;
      else break;
    }
    return n;
  }

  function updateQuickMetrics() {
    if (!els.mClicks) return;
    els.mClicks.textContent = String(state.clicks);
    if (state.lastPoint) {
      const d = state.lastDelta ? `${round(state.lastDelta)} ms` : '—';
      els.lastClick.textContent = `last ${round(state.lastPoint.x)}, ${round(state.lastPoint.y)} · ${d}`;
    } else {
      els.lastClick.textContent = 'last —';
    }
  }

  function updateLive() {
    if (!els.mCps || state.destroyed) return;
    const now = performance.now();
    if (state.running) {
      while (state.clickTimes.length && now - state.clickTimes[0] > 3000) state.clickTimes.shift();
      const n = countClicksLastSecond(now);
      state.smoothCps = state.smoothCps * 0.55 + n * 0.45;
    } else {
      state.smoothCps = 0;
    }
    els.mCps.textContent = state.smoothCps.toFixed(1);
    els.miniCps.textContent = state.smoothCps.toFixed(1);
    els.mClicks.textContent = String(state.clicks);
    els.mTime.textContent = fmtDuration(elapsedMs());
    const avg = averageCps();
    els.footCps.textContent = `target ${state.cps.toFixed(1)} · avg ${avg ? avg.toFixed(1) : '—'}`;
    updateQuickMetrics();
  }

  // -------------------------------------------------------------------------
  // Particle FX
  // -------------------------------------------------------------------------

  const FX_COLORS = {
    cyan: [103, 232, 249],
    amber: [251, 191, 36],
    green: [52, 211, 153],
    red: [248, 113, 113]
  };

  function fxColorName() {
    if (state.running) return 'green';
    if (state.paused) return 'red';
    if (state.locked) return 'amber';
    return 'cyan';
  }

  function makeSprite(rgb) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`);
    grad.addColorStop(0.24, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.55)`);
    grad.addColorStop(0.6, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.16)`);
    grad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  function initFx() {
    fxReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fxSprites = {};
    for (const name of Object.keys(FX_COLORS)) fxSprites[name] = makeSprite(FX_COLORS[name]);
    resizeFx();
    applyFxEnabled();
  }

  function resizeFx() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxPrev = 0;
  }

  function applyFxEnabled() {
    if (!canvas) return;
    const allowed = state.fx && !fxReduced;
    canvas.style.display = allowed ? 'block' : 'none';
    if (!allowed) {
      fxParticles.length = 0;
      if (fxRaf) {
        cancelAnimationFrame(fxRaf);
        fxRaf = 0;
      }
      if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    } else {
      resizeFx();
    }
  }

  function pushParticle(x, y, vx, vy, size, life, colorName) {
    if (!fxSprites) return;
    fxParticles.push({
      x,
      y,
      vx,
      vy,
      size,
      life,
      max: life,
      color: fxSprites[colorName] || fxSprites.cyan,
      rot: rand(0, Math.PI * 2)
    });
    if (fxParticles.length > 90) fxParticles.splice(0, fxParticles.length - 90);
  }

  function spawnTrail(x, y) {
    if (!state.fx || fxReduced || state.destroyed || document.hidden) return;
    const now = performance.now();
    const dx = x - fxLastX;
    const dy = y - fxLastY;
    const dist = Math.hypot(dx, dy);
    if (dist < 4 || now - fxLastAt < 9) return;
    fxLastX = x;
    fxLastY = y;
    fxLastAt = now;
    const color = fxColorName();
    const count = Math.min(3, Math.max(1, Math.floor(dist / 22)));
    for (let i = 0; i < count; i++) {
      pushParticle(
        x + rand(-3, 3),
        y + rand(-3, 3),
        rand(-0.05, 0.05) + dx * 0.0008,
        rand(-0.05, 0.05) + dy * 0.0008,
        rand(2.2, 4.4),
        rand(380, 720),
        color
      );
    }
    ensureFxLoop();
  }

  function burstAt(x, y, colorName) {
    if (!state.fx || fxReduced || state.destroyed || document.hidden) return;
    const now = performance.now();
    if (now - fxLastBurst < 60) return;
    fxLastBurst = now;
    const color = colorName || fxColorName();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + rand(-0.3, 0.3);
      const speed = rand(0.12, 0.4);
      pushParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(2.8, 5.6),
        rand(320, 620),
        color
      );
    }
    ensureFxLoop();
  }

  function ensureFxLoop() {
    if (fxRaf || !state.fx || fxReduced || document.hidden) return;
    fxRaf = requestAnimationFrame(fxLoop);
  }

  function fxLoop(t) {
    fxRaf = 0;
    if (state.destroyed || !ctx || !canvas || !state.fx || fxReduced) return;
    const dt = fxPrev ? Math.min(42, t - fxPrev) : 16;
    fxPrev = t;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = fxParticles.length - 1; i >= 0; i--) {
      const p = fxParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        fxParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.992;
      p.vy = p.vy * 0.992 - 0.000035 * dt;
      const k = p.life / p.max;
      const alpha = Math.min(0.62, k * 0.62);
      const size = p.size * (0.8 + k * 0.8) * 3.2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(p.color, p.x - size / 2, p.y - size / 2, size, size);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (fxParticles.length && !document.hidden) {
      fxRaf = requestAnimationFrame(fxLoop);
    }
  }

  // -------------------------------------------------------------------------
  // Target evaluation
  // -------------------------------------------------------------------------

  function validateCurrentTarget() {
    if (!state.locked) return { ok: false, reason: 'no tap point' };
    if (pointInPanel(state.locked.x, state.locked.y)) {
      return { ok: false, reason: 'tap point is under the HUD' };
    }

    const hit = resolveAtPoint(state.locked.x, state.locked.y);
    if (!hit.ok) {
      if (hit.blocked) return { ok: false, reason: 'cross-origin iframe' };
      return { ok: false, reason: hit.reason || 'nothing under the tap point' };
    }
    if (isOurNode(hit.el)) return { ok: false, reason: 'tap point is the HUD' };
    if (state.locked.blocked) return { ok: false, reason: 'cross-origin iframe' };
    if (isDisabled(hit.el)) return { ok: false, reason: 'target is disabled' };
    if (!hit.topRect || hit.topRect.width < 2 || hit.topRect.height < 2) {
      return { ok: false, reason: 'target has no size' };
    }

    if (state.guard && !compatibleTarget(hit, state.locked)) {
      return { ok: false, reason: 'target changed to ' + describe(hit.el) };
    }

    if (hit.el !== state.locked.el) {
      state.locked.el = hit.el;
      state.locked.doc = hit.doc;
      state.locked.descriptor = describe(hit.el);
      state.locked.inShadow = hit.inShadow;
      state.locked.inFrame = hit.inFrame;
      updateLockUi();
    }
    state.locked.topRect = hit.topRect;
    return { ok: true, hit };
  }

  function lockAt(x, y) {
    if (state.destroyed) return false;
    if (state.running) stopRun('tap point changed');
    if (pointInPanel(x, y)) {
      setStatus('error', 'That spot is under the HUD — pick a page area');
      return false;
    }

    const hit = resolveAtPoint(x, y);
    if (!hit.ok && !hit.blocked) {
      setStatus('error', 'Nothing clickable at that spot');
      return false;
    }
    if (hit.ok && isOurNode(hit.el)) {
      setStatus('error', 'That spot is the HUD — pick a page area');
      return false;
    }

    state.locked = {
      x: round(x),
      y: round(y),
      el: hit.el,
      doc: hit.doc,
      descriptor: describe(hit.el),
      topRect: hit.topRect,
      inShadow: hit.inShadow || 0,
      inFrame: hit.inFrame || 0,
      blocked: !!hit.blocked,
      lockedAt: Date.now()
    };
    state.paused = false;
    state.pauseReason = '';
    closePicker(true);
    updateLockUi();
    syncButtons();
    burstAt(x, y, 'cyan');

    if (hit.blocked) {
      setStatus('error', 'Cross-origin iframe — the browser blocks clicks inside');
    } else {
      setStatus('ready', `Locked — press ${state.startKey.label} or Start`);
    }
    return true;
  }

  function clearLock() {
    if (!state.locked && !state.paused) return;
    if (state.running) stopRun('tap point cleared');
    state.locked = null;
    state.paused = false;
    state.pauseReason = '';
    updateLockUi();
    syncButtons();
    setStatus('idle', 'Tap point cleared');
  }

  // -------------------------------------------------------------------------
  // Picker
  // -------------------------------------------------------------------------

  function updatePickHint() {
    if (!pickHint) return;
    pickHint.classList.remove('bad');
    pickHint.textContent = state.lockInput === 'space'
      ? 'Press Space to lock this point · Esc to cancel'
      : 'Click to lock this point · Esc to cancel';
  }

  function openPicker() {
    if (state.running || state.picking) return;
    cancelRecording();
    state.picking = true;
    picker.hidden = false;
    pickBox.hidden = true;
    pickTag.hidden = true;
    pickCursor.hidden = !state.cursor.seen;
    updatePickHint();
    setStatus('ready', state.lockInput === 'space' ? 'Picking — press Space to lock' : 'Picking — click to lock');
    syncButtons();
    if (state.cursor.seen) queuePickPreview();
  }

  function closePicker(keepStatus) {
    if (!state.picking) return;
    state.picking = false;
    picker.hidden = true;
    pickBox.hidden = true;
    pickTag.hidden = true;
    if (!keepStatus) {
      if (state.paused) setStatus('paused', 'Paused — ' + state.pauseReason);
      else if (state.locked) setStatus('ready', `Locked — press ${state.startKey.label} or Start`);
      else setStatus('idle', 'Idle — pick a tap point');
    }
    syncButtons();
  }

  function updatePickPreview(x, y) {
    if (!state.picking || !state.cursor.seen) return;
    pickCoords.textContent = `${round(x)}, ${round(y)}`;
    pickCursor.style.transform = `translate3d(${round(x)}px, ${round(y)}px, 0)`;
    pickCursor.hidden = false;

    const overPanel = pointInPanel(x, y);
    const hit = resolveAtPoint(x, y);
    if (!hit.ok && !hit.blocked) {
      pickBox.hidden = true;
      pickTag.hidden = false;
      pickTag.classList.add('bad');
      pickTag.textContent = hit.reason || 'nothing here';
      pickTag.style.left = `${clamp(x + 14, 8, Math.max(8, window.innerWidth - 348))}px`;
      pickTag.style.top = `${clamp(y + 14, 8, Math.max(8, window.innerHeight - 30))}px`;
      pickHint.classList.toggle('bad', overPanel);
      return;
    }

    const r = hit.topRect;
    const bad = overPanel || !!hit.blocked;
    pickBox.hidden = false;
    pickBox.classList.toggle('bad', bad);
    pickBox.style.left = `${Math.max(0, r.left)}px`;
    pickBox.style.top = `${Math.max(0, r.top)}px`;
    pickBox.style.width = `${Math.max(1, r.width)}px`;
    pickBox.style.height = `${Math.max(1, r.height)}px`;

    pickTag.hidden = false;
    pickTag.classList.toggle('bad', bad);
    if (overPanel) {
      pickTag.textContent = 'HUD — choose a page area';
    } else if (hit.blocked) {
      pickTag.textContent = 'iframe · cross-origin (cannot click inside)';
    } else {
      pickTag.textContent = describe(hit.el) + (hit.inShadow ? ' · shadow' : '') + (hit.inFrame ? ' · iframe' : '');
    }

    const tagLeft = clamp(r.left, 8, Math.max(8, window.innerWidth - 348));
    let tagTop = r.top - 24;
    if (tagTop < 8) tagTop = r.top + r.height + 6;
    pickTag.style.left = `${tagLeft}px`;
    pickTag.style.top = `${Math.max(8, tagTop)}px`;

    pickHint.classList.toggle('bad', overPanel || !!hit.blocked);
  }

  function queuePickPreview() {
    if (!state.picking || pickRaf) return;
    pickRaf = requestAnimationFrame(() => {
      pickRaf = 0;
      if (state.destroyed || !state.picking) return;
      updatePickPreview(state.cursor.x, state.cursor.y);
    });
  }

  function queueCursorFrame() {
    if (cursorRaf) return;
    cursorRaf = requestAnimationFrame(() => {
      cursorRaf = 0;
      if (state.destroyed || !els.curPos) return;
      if (!state.cursor.seen) {
        els.curPos.textContent = '—, —';
        return;
      }
      els.curPos.textContent = `${round(state.cursor.x)}, ${round(state.cursor.y)}`;
      if (state.picking) updatePickPreview(state.cursor.x, state.cursor.y);
    });
  }

  // -------------------------------------------------------------------------
  // Key handling
  // -------------------------------------------------------------------------

  function isTextTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(type);
    }
    return false;
  }

  function isTypingTarget(e) {
    let path = [];
    try {
      path = e.composedPath ? e.composedPath() : [];
    } catch {}
    const target = path[0] || e.target;
    const el = target && target.nodeType === 3 ? target.parentElement : target;
    const inHud = path.includes(host) || isOurNode(el);

    if (inHud) {
      if (!el || el.nodeType !== 1) return false;
      return !!el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
    }

    if (!el || el.nodeType !== 1) return false;
    if (isTextTarget(el)) return true;
    if ((e.key === ' ' || e.key === 'Enter') && el.closest('button, a[href], summary, [role="button"], input, select, textarea')) return true;
    return false;
  }

  function isModifierCode(code) {
    return /^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code || '');
  }

  function matchesStartKey(e) {
    if (e.repeat || e.isComposing) return false;
    const sk = state.startKey;
    if (!sk) return false;
    if (e.ctrlKey || e.altKey || e.metaKey) {
      if (!isModifierCode(sk.code)) return false;
    }
    if (isModifierCode(sk.code)) {
      return (e.code || '').replace(/(Left|Right)$/, '') === sk.code.replace(/(Left|Right)$/, '');
    }
    if (sk.code) return e.code === sk.code;
    return !!sk.key && e.key === sk.key;
  }

  function setStartKey(e) {
    const code = e.code || '';
    const key = e.key || '';
    if (code === 'F8' || key === 'F8') return;
    state.startKey = { code, key, label: keyLabel(code, key) };
    state.recording = false;
    els.btnRecord.textContent = 'Record';
    els.btnRecord.classList.remove('recording');
    els.startKey.textContent = state.startKey.label;
    els.startKey.title = code ? `${state.startKey.label} (${code})` : state.startKey.label;
    updateKeyWarn();
    syncButtons();
    if (state.locked) setStatus('ready', `Start key set — ${state.startKey.label}`);
    else setStatus('idle', 'Start key set');
  }

  function startRecording() {
    if (state.running) return;
    closePicker(true);
    state.recording = true;
    els.btnRecord.textContent = 'Cancel';
    els.btnRecord.classList.add('recording');
    els.btnRecord.disabled = false;
    els.keyWarn.hidden = true;
    setStatus('recording', 'Recording — press any key (Esc cancels)');
    syncButtons();
  }

  function cancelRecording() {
    if (!state.recording) return;
    state.recording = false;
    els.btnRecord.textContent = 'Record';
    els.btnRecord.classList.remove('recording');
    updateKeyWarn();
    syncButtons();
    if (!state.running && !state.picking) {
      if (state.paused) setStatus('paused', 'Paused — ' + state.pauseReason);
      else if (state.locked) setStatus('ready', `Locked — press ${state.startKey.label} or Start`);
      else setStatus('idle', 'Idle — pick a tap point');
    }
  }

  function onKeyDown(e) {
    if (state.destroyed) return;
    const f8 = e.key === 'F8' || e.code === 'F8';

    if (f8) {
      e.preventDefault();
      e.stopImmediatePropagation();
      panic();
      return;
    }

    if (state.recording) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        cancelRecording();
        return;
      }
      setStartKey(e);
      return;
    }

    if (state.picking) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closePicker();
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (state.lockInput === 'space') {
          if (state.cursor.seen) lockAt(state.cursor.x, state.cursor.y);
          else setStatus('error', 'Move the mouse to a page point first');
        }
        return;
      }
      if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }

    if (isTypingTarget(e)) return;
    if (!matchesStartKey(e)) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    if (state.running) stopRun('start key');
    else startRun();
  }

  // -------------------------------------------------------------------------
  // Engine
  // -------------------------------------------------------------------------

  function createTimer() {
    if (worker || workerFailed) return;
    try {
      const src = `
        let t = 0;
        self.onmessage = function (e) {
          const m = e.data || {};
          if (m.type === 'schedule') {
            if (t) { clearTimeout(t); t = 0; }
            t = setTimeout(function () {
              t = 0;
              self.postMessage({ type: 'tick', id: m.id });
            }, Math.max(0, m.delay || 0));
          } else if (m.type === 'cancel') {
            if (t) { clearTimeout(t); t = 0; }
          }
        };
        self.postMessage({ type: 'ready' });
      `;
      workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      worker = new Worker(workerUrl);
      worker.onmessage = (e) => {
        const m = e.data || {};
        if (m.type !== 'tick') return;
        if (!state.running) return;
        if (m.id !== scheduledId) return;
        onTick();
      };
      worker.onerror = () => {
        if (workerFailed) return;
        workerFailed = true;
        try {
          if (worker) worker.terminate();
        } catch {}
        worker = null;
        if (els.timerNote) els.timerNote.textContent = 'timer: main-thread fallback';
        if (state.running) scheduleAt(Math.max(4, scheduledDue - performance.now()));
      };
    } catch {
      workerFailed = true;
      worker = null;
      if (els.timerNote) els.timerNote.textContent = 'timer: main-thread fallback';
    }
    if (worker && els.timerNote) els.timerNote.textContent = 'timer: worker';
  }

  function scheduleAt(delay) {
    if (!state.running) return;
    const id = ++scheduleSeq;
    scheduledId = id;
    scheduledDue = performance.now() + Math.max(0, delay);

    if (worker && !workerFailed) {
      try {
        worker.postMessage({ type: 'schedule', delay: Math.max(0, delay), id });
        return;
      } catch {
        workerFailed = true;
        if (els.timerNote) els.timerNote.textContent = 'timer: main-thread fallback';
      }
    }

    if (mainTimer) {
      clearTimeout(mainTimer);
      mainTimer = 0;
    }
    mainTimer = setTimeout(() => {
      mainTimer = 0;
      if (!state.running || id !== scheduledId) return;
      onTick();
    }, Math.max(0, delay));
  }

  function cancelEngine() {
    scheduledId = ++scheduleSeq;
    if (mainTimer) {
      clearTimeout(mainTimer);
      mainTimer = 0;
    }
    if (worker) {
      try {
        worker.postMessage({ type: 'cancel' });
      } catch {}
    }
  }

  function intervalWithJitter() {
    const base = 1000 / clamp(state.cps, 0.5, 50);
    const pct = clamp(state.jitter, 0, 50) / 100;
    if (pct <= 0) return base;

    if (state.gaussian) {
      const sigma = (base * pct) / 2.5;
      const z = clamp(gaussian(), -2.5, 2.5);
      return Math.max(5, base + z * sigma);
    }
    return Math.max(5, base * (1 + (Math.random() * 2 - 1) * pct));
  }

  function nextDelay() {
    const now = performance.now();
    if (state.burst) {
      if (state.burstPauseUntil > now) return state.burstPauseUntil - now;
      if (state.burstLeft <= 0) {
        const pause = rand(480, 1200);
        state.burstPauseUntil = now + pause;
        state.burstLeft = randInt(15, 30);
        return pause;
      }
      state.burstLeft--;
    }
    return intervalWithJitter();
  }

  function microShiftPoint(hit) {
    const r = hit.topRect;
    if (!r || r.width < 6 || r.height < 6) return null;
    const inset = 3;
    const minX = r.left + inset;
    const maxX = r.right - inset;
    const minY = r.top + inset;
    const maxY = r.bottom - inset;
    if (maxX <= minX || maxY <= minY) return null;
    return {
      x: clamp(state.locked.x + rand(-state.microShift, state.microShift), minX, maxX),
      y: clamp(state.locked.y + rand(-state.microShift, state.microShift), minY, maxY)
    };
  }

  function onTick() {
    if (!state.running) return;
    const tickDue = scheduledDue;
    const check = validateCurrentTarget();
    if (!check.ok) {
      pauseRun(check.reason);
      return;
    }
    if (state.maxClicks > 0 && state.clicks >= state.maxClicks) {
      stopRun('click limit reached');
      return;
    }

    const baseHit = check.hit;
    let fire = baseHit;
    let topX = state.locked.x;
    let topY = state.locked.y;

    if (state.microShift > 0) {
      const p = microShiftPoint(baseHit);
      if (p) {
        const shifted = resolveAtPoint(p.x, p.y);
        if (shifted.ok && !shifted.blocked && !isOurNode(shifted.el)) {
          let related = false;
          try {
            related = shifted.el === baseHit.el || baseHit.el.contains(shifted.el) || shifted.el.contains(baseHit.el);
          } catch {}
          if (related) {
            fire = shifted;
            topX = p.x;
            topY = p.y;
          }
        }
      }
    }

    try {
      dispatchClick(fire);
    } catch {
      pauseRun('click dispatch failed');
      return;
    }

    const now = performance.now();
    if (state.lastClickAt) {
      const delta = now - state.lastClickAt;
      if (delta > 0 && delta < 10000) {
        state.lastDelta = delta;
        state.deltas.push(delta);
        if (state.deltas.length > 30) state.deltas.shift();
      }
    }
    state.lastClickAt = now;
    state.clicks++;
    state.lastPoint = { x: topX, y: topY };
    state.clickTimes.push(now);
    while (state.clickTimes.length && now - state.clickTimes[0] > 3000) state.clickTimes.shift();

    updateQuickMetrics();
    burstAt(topX, topY, 'green');
    if (now - lastUiRefresh > 200) {
      lastUiRefresh = now;
      updateLive();
    }

    if (state.maxClicks > 0 && state.clicks >= state.maxClicks) {
      stopRun('click limit reached');
      return;
    }

    const delay = nextDelay();
    if (!state.running) return;
    let due = tickDue + delay;
    if (!Number.isFinite(due) || due < now + 2) due = now + delay;
    scheduleAt(Math.max(0, due - performance.now()));
  }

  function resetRunCounters() {
    state.clicks = 0;
    state.activeMs = 0;
    state.segStart = 0;
    state.lastClickAt = 0;
    state.lastDelta = 0;
    state.smoothCps = 0;
    state.clickTimes = [];
    state.deltas = [];
    state.lastPoint = null;
    state.burstLeft = randInt(15, 30);
    state.burstPauseUntil = 0;
  }

  function startRun() {
    if (state.running) return;
    if (state.recording) cancelRecording();
    if (state.picking) closePicker(true);

    const resume = state.paused;

    if (!state.locked) {
      const p = state.lastPage;
      if (!p) {
        setStatus('error', 'Move the mouse over the page first, or use Pick');
        return;
      }
      if (!lockAt(p.x, p.y)) return;
    }

    if (state.locked.blocked) {
      setStatus('error', 'That target is inside a cross-origin iframe');
      return;
    }

    const check = validateCurrentTarget();
    if (!check.ok) {
      setStatus('error', 'Cannot start — ' + check.reason);
      return;
    }

    if (!resume) {
      resetRunCounters();
    } else {
      state.clickTimes = [];
      state.lastClickAt = 0;
      state.lastDelta = 0;
      state.burstLeft = randInt(15, 30);
      state.burstPauseUntil = 0;
    }

    state.running = true;
    state.paused = false;
    state.pauseReason = '';
    state.segStart = performance.now();
    state.smoothCps = 0;
    cancelEngine();
    updateLockUi();
    syncButtons();
    updateQuickMetrics();
    setStatus('running', resume ? 'Resumed' : 'Running');
    updateLive();
    scheduleAt(0);
  }

  function pauseRun(reason) {
    if (!state.running) return;
    const now = performance.now();
    if (state.segStart) state.activeMs += now - state.segStart;
    state.segStart = 0;
    state.running = false;
    state.paused = true;
    state.pauseReason = reason;
    state.smoothCps = 0;
    cancelEngine();
    setStatus('paused', 'Paused — ' + reason);
    syncButtons();
    updateLive();
  }

  function stopRun(reason) {
    const had = state.running || state.paused;
    if (state.running && state.segStart) {
      state.activeMs += performance.now() - state.segStart;
    }
    state.segStart = 0;
    state.running = false;
    state.paused = false;
    state.pauseReason = '';
    state.smoothCps = 0;
    cancelEngine();
    if (!state.destroyed) {
      if (had) {
        setStatus(
          reason === 'emergency stop (F8)' ? 'paused' : 'idle',
          reason === 'stopped' ? 'Stopped' : 'Stopped — ' + reason
        );
      } else {
        setStatus('idle', 'Stopped');
      }
      syncButtons();
      updateLive();
    }
  }

  function panic() {
    const had = state.running || state.paused;
    cancelRecording();
    if (state.picking) closePicker(true);
    if (had) {
      stopRun('emergency stop (F8)');
    } else {
      cancelEngine();
      setStatus('paused', 'Emergency stop (F8) — idle');
      syncButtons();
    }
  }

  // -------------------------------------------------------------------------
  // Build / listeners
  // -------------------------------------------------------------------------

  function build() {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'all: initial; position: fixed; inset: 0; display: block; pointer-events: none;';
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('inset', '0', 'important');
    host.style.setProperty('display', 'block', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    host.style.setProperty('pointer-events', 'none', 'important');
    host.style.setProperty('visibility', 'visible', 'important');
    host.style.setProperty('opacity', '1', 'important');
    host.style.setProperty('transform', 'none', 'important');
    host.style.setProperty('filter', 'none', 'important');

    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${CSS_TEXT}</style>${MARKUP}`;
    document.documentElement.appendChild(host);

    els = {};
    shadow.querySelectorAll('[id]').forEach((el) => {
      els[el.id] = el;
    });

    panel = els.panel;
    picker = els.picker;
    pickBox = els.pickBox;
    pickTag = els.pickTag;
    pickCursor = els.pickCursor;
    pickCoords = els.pickCoords;
    pickHint = els.pickHint;
    canvas = els.fxCanvas;

    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }

    const swallow = ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'keydown', 'keyup', 'input', 'change'];
    for (const type of swallow) {
      host.addEventListener(type, (e) => {
        e.stopPropagation();
      }, { signal: abort.signal });
    }

    host.addEventListener('wheel', (e) => {
      e.stopPropagation();
      const path = e.composedPath ? e.composedPath() : [];
      if (!path.includes(els.body)) e.preventDefault();
    }, { signal: abort.signal, passive: false });
  }

  function bindUi() {
    els.btnCollapse.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      syncButtons();
    });
    els.btnClose.addEventListener('click', destroy);
    els.btnMiniStop.addEventListener('click', () => stopRun('stopped'));

    els.btnStart.addEventListener('click', () => {
      if (state.recording) cancelRecording();
      startRun();
    });
    els.btnStop.addEventListener('click', () => stopRun('stopped'));
    els.btnPick.addEventListener('click', () => {
      if (state.picking) closePicker();
      else openPicker();
    });
    els.btnClear.addEventListener('click', clearLock);
    els.btnRecord.addEventListener('click', () => {
      if (state.recording) cancelRecording();
      else startRecording();
    });

    els.cpsRange.addEventListener('input', () => {
      const v = parseFloat(els.cpsRange.value);
      if (Number.isFinite(v)) setCps(v, 'range');
    });
    els.cpsNum.addEventListener('input', () => {
      const v = parseFloat(els.cpsNum.value);
      if (Number.isFinite(v)) setCps(v, 'num');
    });
    els.cpsNum.addEventListener('blur', () => setCps(state.cps, 'both'));

    els.jitterNum.addEventListener('input', () => {
      const v = parseFloat(els.jitterNum.value);
      if (Number.isFinite(v)) {
        state.jitter = clamp(Math.round(v), 0, 50);
        updateTimingHint();
      }
    });
    els.jitterNum.addEventListener('blur', () => {
      els.jitterNum.value = String(state.jitter);
      updateTimingHint();
    });
    els.gaussian.addEventListener('change', () => {
      state.gaussian = els.gaussian.checked;
    });
    els.maxNum.addEventListener('input', () => {
      const v = parseInt(els.maxNum.value, 10);
      if (Number.isFinite(v)) {
        state.maxClicks = clamp(v, 0, 1000000);
        updateMaxHint();
      }
    });
    els.maxNum.addEventListener('blur', () => {
      els.maxNum.value = String(state.maxClicks);
      updateMaxHint();
    });
    els.shiftNum.addEventListener('input', () => {
      const v = parseInt(els.shiftNum.value, 10);
      if (Number.isFinite(v)) state.microShift = clamp(v, 0, 12);
    });
    els.shiftNum.addEventListener('blur', () => {
      els.shiftNum.value = String(state.microShift);
    });

    els.optHover.addEventListener('change', () => {
      state.hover = els.optHover.checked;
    });
    els.optGuard.addEventListener('change', () => {
      state.guard = els.optGuard.checked;
    });
    els.optBurst.addEventListener('change', () => {
      state.burst = els.optBurst.checked;
      if (state.burst) {
        state.burstLeft = randInt(15, 30);
        state.burstPauseUntil = 0;
      }
    });
    els.optFx.addEventListener('change', () => {
      state.fx = els.optFx.checked;
      applyFxEnabled();
    });

    els.lockSeg.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-lock]');
      if (!btn) return;
      state.lockInput = btn.dataset.lock === 'space' ? 'space' : 'mouse';
      [...els.lockSeg.querySelectorAll('button')].forEach((b) => {
        b.classList.toggle('active', b.dataset.lock === state.lockInput);
      });
      if (state.picking) updatePickHint();
    });

    picker.addEventListener('pointerdown', (e) => {
      e.preventDefault();
    }, { signal: abort.signal });
    picker.addEventListener('click', (e) => {
      if (!state.picking) return;
      e.preventDefault();
      e.stopPropagation();
      if (state.lockInput !== 'mouse') {
        pickHint.classList.add('bad');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          if (state.picking) updatePickHint();
        }, 800);
        return;
      }
      lockAt(e.clientX, e.clientY);
    }, { signal: abort.signal });
    picker.addEventListener('wheel', (e) => {
      e.preventDefault();
    }, { signal: abort.signal, passive: false });
    picker.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    }, { signal: abort.signal });

    bindDrag();
  }

  function setCps(v, from) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    state.cps = Math.round(clamp(n, 0.5, 50) * 10) / 10;
    if (from !== 'range') els.cpsRange.value = String(state.cps);
    if (from !== 'num') els.cpsNum.value = state.cps.toFixed(1);
    updateTimingHint();
  }

  function bindDrag() {
    const head = els.dragHandle;
    let drag = null;

    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        dx: e.clientX - r.left,
        dy: e.clientY - r.top
      };
      try {
        head.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
    }, { signal: abort.signal });

    head.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const w = panel.getBoundingClientRect().width;
      const x = clamp(e.clientX - drag.dx, 8 - w + 52, window.innerWidth - 52);
      const y = clamp(e.clientY - drag.dy, 6, window.innerHeight - 42);
      panel.style.left = `${round(x)}px`;
      panel.style.top = `${round(y)}px`;
      panel.style.right = 'auto';
    }, { signal: abort.signal });

    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
    };
    head.addEventListener('pointerup', end, { signal: abort.signal });
    head.addEventListener('pointercancel', end, { signal: abort.signal });
  }

  function onPointerMove(e) {
    if (state.destroyed) return;
    state.cursor.x = e.clientX;
    state.cursor.y = e.clientY;
    state.cursor.seen = true;
    if (!isOurEvent(e)) state.lastPage = { x: e.clientX, y: e.clientY };
    spawnTrail(e.clientX, e.clientY);
    queueCursorFrame();
    if (state.picking) queuePickPreview();
  }

  function onPointerDown(e) {
    if (state.destroyed) return;
    if (!isOurEvent(e)) state.lastPage = { x: e.clientX, y: e.clientY };
  }

  function onResize() {
    resizeFx();
    if (!panel || !panel.style.left) return;
    const r = panel.getBoundingClientRect();
    const maxLeft = window.innerWidth - 52;
    const minLeft = 8 - r.width + 52;
    const left = clamp(parseFloat(panel.style.left) || r.left, minLeft, maxLeft);
    const top = clamp(parseFloat(panel.style.top) || r.top, 6, window.innerHeight - 42);
    panel.style.left = `${round(left)}px`;
    panel.style.top = `${round(top)}px`;
    panel.style.right = 'auto';
  }

  function onVisibility() {
    if (!canvas) return;
    if (document.hidden) {
      if (fxRaf) {
        cancelAnimationFrame(fxRaf);
        fxRaf = 0;
      }
    } else {
      resizeFx();
      if (state.fx && !fxReduced && fxParticles.length) ensureFxLoop();
      updateLive();
    }
  }

  function attachGlobalEvents() {
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true, signal: abort.signal });
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true, signal: abort.signal });
    window.addEventListener('keydown', onKeyDown, { capture: true, signal: abort.signal });
    window.addEventListener('resize', onResize, { passive: true, signal: abort.signal });
    document.addEventListener('visibilitychange', onVisibility, { signal: abort.signal });
  }

  function reveal() {
    if (state.destroyed || !host) return;
    if (!host.isConnected) {
      try {
        document.documentElement.appendChild(host);
      } catch {}
    }
    panel.classList.remove('collapsed');
    syncButtons();
    panel.classList.remove('flash');
    void panel.offsetWidth;
    panel.classList.add('flash');
    setTimeout(() => {
      if (panel) panel.classList.remove('flash');
    }, 700);
  }

  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true;
    state.running = false;
    state.paused = false;
    state.picking = false;
    state.recording = false;
    cancelEngine();
    if (mainTimer) {
      clearTimeout(mainTimer);
      mainTimer = 0;
    }
    if (worker) {
      try {
        worker.terminate();
      } catch {}
      worker = null;
    }
    if (workerUrl) {
      try {
        URL.revokeObjectURL(workerUrl);
      } catch {}
      workerUrl = null;
    }
    if (observer) {
      try {
        observer.disconnect();
      } catch {}
      observer = null;
    }
    try {
      abort.abort();
    } catch {}
    if (uiTimer) {
      clearInterval(uiTimer);
      uiTimer = 0;
    }
    if (cursorRaf) {
      cancelAnimationFrame(cursorRaf);
      cursorRaf = 0;
    }
    if (pickRaf) {
      cancelAnimationFrame(pickRaf);
      pickRaf = 0;
    }
    if (fxRaf) {
      cancelAnimationFrame(fxRaf);
      fxRaf = 0;
    }
    fxParticles.length = 0;
    if (flashTimer) clearTimeout(flashTimer);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    shadow = null;
    try {
      delete window[NS];
    } catch {
      window[NS] = undefined;
    }
  }

  function debugSnapshot() {
    return {
      version: VERSION,
      running: state.running,
      paused: state.paused,
      pauseReason: state.pauseReason,
      recording: state.recording,
      picking: state.picking,
      clicks: state.clicks,
      actualCps: state.smoothCps,
      targetCps: state.cps,
      jitter: state.jitter,
      maxClicks: state.maxClicks,
      startKey: { ...state.startKey },
      lockInput: state.lockInput,
      locked: state.locked
        ? {
            x: state.locked.x,
            y: state.locked.y,
            descriptor: state.locked.descriptor,
            blocked: state.locked.blocked,
            inShadow: state.locked.inShadow,
            inFrame: state.locked.inFrame
          }
        : null,
      lastDelta: state.lastDelta,
      clickTimes: state.clickTimes.slice(),
      lastPoint: state.lastPoint ? { ...state.lastPoint } : null,
      timer: worker ? 'worker' : workerFailed ? 'main' : 'none',
      status: els.statusText ? els.statusText.textContent : ''
    };
  }

  function exposeApi() {
    window[NS] = {
      version: VERSION,
      reveal,
      toggle: reveal,
      stop: () => stopRun('external stop'),
      destroy,
      debug: debugSnapshot
    };
  }

  function init() {
    build();
    bindUi();
    initFx();
    syncControls();
    setStatus('idle', 'Idle — pick a tap point, or press Start to use the cursor');
    createTimer();
    attachGlobalEvents();

    observer = new MutationObserver(() => {
      if (!state.destroyed && host && !host.isConnected) {
        try {
          document.documentElement.appendChild(host);
        } catch {}
      }
    });
    try {
      observer.observe(document.documentElement, { childList: true });
    } catch {}

    uiTimer = setInterval(updateLive, 200);
    updateLive();
    exposeApi();
  }

  try {
    init();
  } catch (err) {
    try {
      abort.abort();
    } catch {}
    try {
      if (host && host.parentNode) host.parentNode.removeChild(host);
    } catch {}
    try {
      if (worker) worker.terminate();
    } catch {}
    console.error('[Auto-Clicker] init failed', err);
    try {
      delete window[NS];
    } catch {
      window[NS] = undefined;
    }
  }
})();
