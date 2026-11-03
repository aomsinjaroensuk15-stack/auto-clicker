# Auto-Clicker v1

A Chrome bookmarklet that injects a self-contained auto-clicker HUD into any page. The UI lives in a shadow root, the clicking engine runs from a dedicated worker timer, and everything is torn down when you close it.

No build step. No dependencies. One JavaScript file.

## Files

| File | What it is |
|---|---|
| `auto-clicker.js` | The entire bookmarklet payload. Load this from githack. |
| `test.html` | Local test bench with a timestamping target, shadow DOM, same-origin iframe, cross-origin iframe, disabled target, moving target and a typing guard. |
| `README.md` | This file. |

## Install

The loader expects a **public** GitHub repo named `auto-clicker` under `aomsinjaroensuk15-stack`, with the script on `main`:

```
https://raw.githack.com/aomsinjaroensuk15-stack/auto-clicker/main/auto-clicker.js
```

The repo must be public — raw.githack cannot read private repositories. If you use a different account, repo name or branch, change the URL in the loader.

### 1. Push the files

Push `auto-clicker.js` (and optionally `test.html` and this README) to GitHub. The bookmarklet appends `?v=<timestamp>` so githack does not serve a stale copy after you update the file.

### 2. Add the bookmark

Create a Chrome bookmark and paste this as its URL:

```js
javascript:(()=>{const s=document.createElement('script');s.src='https://raw.githack.com/aomsinjaroensuk15-stack/auto-clicker/main/auto-clicker.js?v='+Date.now();s.onerror=()=>alert('Auto-Clicker failed to load. Check that the GitHub repo is public and that this page allows scripts.');document.documentElement.appendChild(s)})()
```

Notes:

- Chrome strips the `javascript:` prefix when pasting into some URL fields. If that happens, type `javascript:` manually, then paste the rest.
- GitHub sanitizes `javascript:` links in rendered Markdown, so copy the snippet from this code block rather than dragging it out of the GitHub page.
- On a strict-CSP site (GitHub itself, some banks, some Google properties) the page may block the githack script or the bookmarklet entirely. That is a browser security restriction, not something the script can bypass.
- Click the bookmark again to bring the HUD back if it is collapsed or hidden.

### 3. Use it

1. Open the target page and click the bookmark. The panel appears at the top right.
2. Pick a tap point: press **Pick**, then click the page. If **Lock input** is set to **Space**, press Space over the page instead.
3. Choose a **Start key** with **Record**, or leave the default backtick (`` ` ``).
4. Press the Start key or **Start clicking**.

### Try it

1. Open this [link](https://html-auto-clicker-test.netlify.app/) in browser
If no tap point is locked when you press Start, the last cursor position outside the HUD is used and locked automatically.

## Controls

| Control | Behavior |
|---|---|
| **Speed** | Target clicks per second, 0.5–50 CPS. The number box accepts decimal values; the slider is in 0.5 steps. Changes apply on the next scheduled click. |
| **Jitter** | Per-click timing variation, 0–50% of the base interval. |
| **Gaussian** | Uses a clamped Gaussian curve instead of uniform variation. |
| **Max clicks** | Stops after exactly this many clicks. `0` means unlimited. |
| **Cursor / Tap point** | Live viewport coordinates. The tap point is stored as viewport coordinates, not page coordinates. |
| **Target** | Descriptor for the deepest element under the tap point, including `shadow`, `iframe` and `cross-origin` flags. |
| **Lock input** | Mouse: the next page click confirms the point. Space: Space confirms the point at the current cursor position. The confirming click/press is swallowed. |
| **Start key** | Any single key, including Enter, Space, Shift, arrows and F-keys. Defaults to backtick. Ignored while typing in a page field or in a HUD field. |
| **Start clicking** | Starts (or resumes after a guard pause). |
| **Stop** | Stops and keeps the current tap point. |
| **Micro-shift** | Randomly shifts each click within the target's box, up to 12 px, while staying inside the element. |
| **Hover events** | Dispatches `pointerover`, `mouseover`, `pointermove` and `mousemove` before the down/up/click sequence. |
| **Mutation guard** | Pauses if the element under the tap point changes, disappears, becomes disabled, has no size, or ends up behind the HUD. |
| **Burst / pause** | Runs 15–30 clicks, then pauses 480–1200 ms, repeatedly. Off by default. |
| **Particle effects** | Canvas trail that follows the cursor and bursts on clicks. Automatically disabled for `prefers-reduced-motion`. |

The **CPS actual** figure is a rolling one-second measurement. The footer shows the target rate and an average based on recent click intervals. The click count and run timer are for the current run.

## Hotkeys

| Key | Action |
|---|---|
| Your Start key | Starts, or stops if already running. Ignored while typing in an editable field. |
| **F8** | Emergency stop from anywhere in the top page. Also cancels picking/recording. |
| **Esc** | Cancels point picking or Start-key recording. Does not stop an active run. |

F8 and Esc are reserved and cannot be recorded as Start keys. On Macs, function keys may require **Fn**.

## Timing and background tabs

The schedule is driven by an inline Web Worker and absolute deadlines, with small lateness compensation. The worker is only a timer; the actual DOM clicks are dispatched on the page's main thread, as browser security requires.

Chrome can throttle timers in background or occluded tabs. The engine keeps the **average** rate close to the target by shortening the next interval when it is late, but the spacing can become uneven, and at higher CPS a hidden tab may not reach the requested rate. Keep the tab visible when exact cadence matters. The **CPS actual** readout shows what is really happening; if the page is hidden, its own 200 ms UI ticker is throttled too, so the panel also refreshes from the click loop.

## Targeting and safety

- Clicking is position-first: the deepest element under the stored point is resolved on every cycle.
- The resolver walks open shadow roots and same-origin iframe chains, translating coordinates at each hop.
- Dispatches use a realistic sequence (`pointerover`/`mousemove` optionally, then `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`) with `isTrusted: false`.
- If you scroll the page, the tap point stays at the same **screen** position. If the element at that position changes, the guard pauses instead of clicking something unintended.
- Closing the panel stops the worker, clears timers, aborts all listeners, removes the shadow host and deletes the global API. Re-running the bookmarklet after closing creates a fresh instance.
- Settings are intentionally in-memory only; reloading the page resets them.

## Known limits

- **Synthetic events are not trusted.** Sites that check `event.isTrusted`, use WebDriver detection or require native input will not respond. There is no workaround from a bookmarklet.
- **Cross-origin iframes** are closed to script by browser security. The picker can see the frame element and warns you, but clicks cannot be dispatched inside it.
- **Closed shadow roots** cannot be penetrated; the resolver stops at the host element.
- **CSS hover/active styling** is not applied by synthetic events, even when the event listeners fire.
- **Strict CSP** can block the githack script, the inline shadow styles or the Blob worker. The worker falls back to a main-thread timer if it can be created but fails; a blocked script produces nothing. Trusted Types can also block the HUD injection.
- **Page navigation** destroys the injected script. Click the bookmark again after a full page load.
- **F8 and the Start key only work in the top-level page.** If keyboard focus is inside an iframe, key events stay in that frame. The HUD's Stop button still works because it is in the top-level overlay. A page can also consume F8 before the bookmarklet sees it.
- **Pointer-lock, canvas games and code that relies on `movementX`/`movementY`** may ignore coordinate-based clicks.
- **Only tested on desktop Chrome.** Firefox and Safari are not supported in v1.
- **Cursor telemetry does not follow pointers inside iframes** while the picker is closed. The picker itself covers the frame and captures the pointer normally.

## Local test bench

Serve this folder with any static server, then open `test.html`:

```bash
npx --yes serve -l 8123 .
# http://127.0.0.1:8123/test.html
```

Click **Load Auto-Clicker** in the page. The bench records click timestamps and displays:

- total clicks, mean interval, standard deviation and coefficient of variation
- actual average CPS
- whether the last synthetic click was trusted
- counts for the checkbox, shadow button, same-origin iframe, moving target and typing guard

Measured on the local bench in Chromium (20 CPS target, jitter 0, 30 click limit):

- 30/30 clicks, span 1443 ms, mean interval 49.77 ms → **20.09 CPS** actual
- click limit stopped exactly at 30
- open shadow-root button: 5/5 dispatched inside the shadow tree
- same-origin iframe button: 4/4 dispatched inside the frame document
- scrolling the page while running paused the run with `target changed…`
- a disabled target refused to start
- cross-origin iframe lock warned and refused to start
- Close removed the host, deleted the API and stopped further clicks
- loading the script twice kept exactly one HUD

A hidden preview tab produced more interval variance (background timer throttling) while still averaging the target rate. Use a visible tab for cadence measurements.

## Privacy

The bookmarklet makes exactly one external request: it downloads `auto-clicker.js` from raw.githack. It does not collect, store or transmit page data. Settings and click statistics stay in the page's memory and disappear on close or reload.
