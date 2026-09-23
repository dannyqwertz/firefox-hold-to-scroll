// Hold to Scroll: while the configured key (or mouse button) is held, moving
// the mouse moves the page.
//   Drag mode:   the page follows the mouse (like grabbing it).
//   Scroll mode: direction and distance from an anchor point set direction and speed.
(() => {
  if (window.__holdToScroll) return;
  window.__holdToScroll = true;

  const settings = structuredClone(HoldToScrollDefaults);
  const isTop = window === window.top;

  // The site that gets enabled/disabled: the one shown in the tab, even from inside iframes
  const site = (() => {
    try {
      return window.top.location.hostname || window.top.location.protocol;
    } catch {
      try {
        return new URL(document.referrer).hostname; // cross-origin iframe: usually the embedding page
      } catch {
        return location.hostname || location.protocol;
      }
    }
  })();

  const enabled = () => !settings.disabledSites.includes(site);

  // Only the top frame reports its state for the toolbar badge
  function reportState() {
    if (isTop) browser.runtime.sendMessage({ type: "state", enabled: enabled() }).catch(() => {});
  }

  browser.storage.sync.get(HoldToScrollDefaults).then((stored) => {
    Object.assign(settings, stored);
    reportState();
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in settings) settings[key] = newValue ?? HoldToScrollDefaults[key];
    }
    if ("disabledSites" in changes) {
      if (!enabled()) deactivate(true);
      reportState();
    }
  });

  if (isTop) {
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "site") return Promise.resolve({ site });
    });
  }

  // Elements where the key does something on its own (typing, clicking, playing …)
  const OWN_KEY_TAGS = new Set([
    "INPUT", "TEXTAREA", "SELECT", "OPTION", "BUTTON", "SUMMARY",
    "VIDEO", "AUDIO", "EMBED", "OBJECT",
  ]);
  const OWN_KEY_ROLES = new Set([
    "button", "checkbox", "radio", "switch", "textbox", "searchbox", "combobox",
    "menuitem", "menuitemcheckbox", "menuitemradio", "option", "tab", "slider",
    "spinbutton", "treeitem",
  ]);
  const MODIFIER_FLAGS = { Control: "ctrlKey", Alt: "altKey", Shift: "shiftKey", Meta: "metaKey" };

  let mode = null;     // null | "drag" | "scroll"
  let modeKey = "";    // code of the key or mouse button holding the current mode
  let armed = null;    // modifier or mouse button held, waiting for mouse movement: { mode, code, x, y }
  let swallowUntil = 0; // after scrolling with a mouse button: drop the click / context menu it ends with
  let mouseX = null;
  let mouseY = null;
  let anchor = null;   // scroll mode: where the key was pressed
  let chain = [];      // scrollable ancestors under the pointer, innermost first
  let restX = 0;       // fractional pixels, so slow movements aren't lost
  let restY = 0;
  let frame = 0;
  let lastFrame = 0;
  let vx = 0;          // current velocity (px/s)
  let vy = 0;
  let dragVX = 0;      // drag mode: smoothed velocity of the latest mouse movements
  let dragVY = 0;
  let lastMove = 0;
  let overlay = null;
  let indicator = null;

  function deepActiveElement() {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }

  function keyBelongsToElement(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.isContentEditable) return true;
    if (OWN_KEY_TAGS.has(el.tagName)) return true;
    const role = el.getAttribute?.("role");
    return role ? OWN_KEY_ROLES.has(role) : false;
  }

  // A mouse button on a link text or picture inside a button still belongs to the button
  function pointerOnOwnElement(el) {
    for (; el && el !== document.body; el = parentAcrossShadow(el)) {
      if (keyBelongsToElement(el)) return true;
    }
    return false;
  }

  // Pressing on a scrollbar drags the scrollbar
  function onScrollbar(event, el) {
    const root = document.documentElement;
    if (event.clientX >= root.clientWidth || event.clientY >= root.clientHeight) return true;
    if (!(el instanceof Element) || !el.clientWidth || el === root) return false;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left - el.clientLeft;
    const y = event.clientY - rect.top - el.clientTop;
    return (x >= el.clientWidth && el.offsetWidth - el.clientLeft * 2 > el.clientWidth)
      || (y >= el.clientHeight && el.offsetHeight - el.clientTop * 2 > el.clientHeight);
  }

  // Ctrl+Space and the like belong to the browser or page – unless the key itself is the modifier.
  function otherModifierHeld(event) {
    return Object.entries(MODIFIER_FLAGS).some(([key, flag]) => event[flag] && event.key !== key);
  }

  function modeFor(code) {
    const key = HoldToScrollKeys.normalize(code);
    if (settings.dragKey && key === HoldToScrollKeys.normalize(settings.dragKey)) return "drag";
    if (settings.scrollKey && key === HoldToScrollKeys.normalize(settings.scrollKey)) return "scroll";
    return null;
  }

  function parentAcrossShadow(el) {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  }

  function isScrollable(el) {
    const style = getComputedStyle(el);
    const scrollY = /(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
    const scrollX = /(auto|scroll|overlay)/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
    return scrollX || scrollY;
  }

  function buildChain(x, y) {
    const result = [];
    const page = document.scrollingElement || document.documentElement;
    let el = document.elementFromPoint(x, y);
    while (el && el !== page && el !== document.body && el !== document.documentElement) {
      if (isScrollable(el)) result.push(el);
      el = parentAcrossShadow(el);
    }
    result.push(page);
    return result;
  }

  function canScroll(el, axis, delta) {
    if (axis === "y") {
      const max = el.scrollHeight - el.clientHeight;
      return delta > 0 ? el.scrollTop < max - 0.5 : el.scrollTop > 0.5;
    }
    const max = el.scrollWidth - el.clientWidth;
    return delta > 0 ? el.scrollLeft < max - 0.5 : el.scrollLeft > 0.5;
  }

  // Per axis, scroll the innermost element that still has room in that direction.
  function scrollBy(dx, dy) {
    const targetX = dx ? chain.find((el) => canScroll(el, "x", dx)) : null;
    const targetY = dy ? chain.find((el) => canScroll(el, "y", dy)) : null;
    if (targetX && targetX === targetY) {
      targetX.scrollBy({ left: dx, top: dy, behavior: "instant" });
      return;
    }
    targetX?.scrollBy({ left: dx, behavior: "instant" });
    targetY?.scrollBy({ top: dy, behavior: "instant" });
  }

  // Collect fractions and only scroll whole pixels
  function scrollByFraction(dx, dy) {
    restX += dx;
    restY += dy;
    const x = Math.trunc(restX);
    const y = Math.trunc(restY);
    restX -= x;
    restY -= y;
    if (x || y) scrollBy(x, y);
  }

  function showOverlay() {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.style.cssText = `
        all: initial;
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        box-sizing: border-box;
        opacity: 0;
        transition: opacity 120ms ease-out;
      `;
    }
    const colors = HoldToScroll.palette(settings.overlayStyle);
    overlay.style.opacity = "0";
    overlay.style.mixBlendMode = colors.blend; // must sit on the overlay itself to blend with the page
    overlay.replaceChildren();
    if (mode === "drag") {
      overlay.style.cursor = "grab";
      overlay.style.boxShadow = settings.showFrame ? `inset 0 0 0 2px rgba(${colors.ink}, 0.5)` : "none";
    } else {
      overlay.style.cursor = "all-scroll";
      overlay.style.boxShadow = "none";
      if (settings.showIndicator) {
        indicator ??= HoldToScroll.create(null);
        overlay.appendChild(indicator.element);
        updateIndicator();
      }
    }
    (document.body || document.documentElement).appendChild(overlay);
    overlay.getBoundingClientRect(); // commit the start state so the fade-in runs
    overlay.style.opacity = "1";
  }

  function updateIndicator() {
    if (mode !== "scroll" || !settings.showIndicator || !indicator) return;
    indicator.update(anchor, { x: mouseX, y: mouseY }, settings, { width: innerWidth, height: innerHeight });
  }

  // --- Motion --------------------------------------------------------------
  // One loop for both modes: in scroll mode the velocity eases towards the target,
  // after releasing the key (and after a drag fling) it coasts to a stop.

  const momentumOn = () => settings.momentum && settings.brakeTime > 0;

  function targetVelocity() {
    if (mode !== "scroll") return [0, 0];
    const dx = mouseX - anchor.x;
    const dy = mouseY - anchor.y;
    const distance = Math.hypot(dx, dy);
    const speed = HoldToScroll.speedAt(distance, settings);
    return speed > 0 ? [(dx / distance) * speed, (dy / distance) * speed] : [0, 0];
  }

  function motionFrame(time) {
    const dt = Math.max(0, Math.min((time - lastFrame) / 1000, 0.1));
    lastFrame = time;
    const [tx, ty] = targetVelocity();
    if (!momentumOn()) {
      vx = tx;
      vy = ty;
    } else {
      // Speed up quickly, slow down with the configured coast time
      const brake = settings.brakeTime / 1000;
      const speedingUp = Math.hypot(tx, ty) >= Math.hypot(vx, vy);
      const k = 1 - Math.exp(-dt / (speedingUp ? Math.min(brake, 0.08) : brake));
      vx += (tx - vx) * k;
      vy += (ty - vy) * k;
    }
    scrollByFraction(vx * dt, vy * dt);
    if (!mode && Math.hypot(vx, vy) < 5) return stopMotion();
    frame = requestAnimationFrame(motionFrame);
  }

  function startMotion() {
    if (frame) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(motionFrame);
  }

  function stopMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    vx = 0;
    vy = 0;
    if (!mode) chain = [];
  }

  // start = where the key was pressed (armed modifiers activate only after the mouse moved)
  function activate(newMode, code, start) {
    if (newMode === "drag") stopMotion(); // end coasting; scroll mode continues seamlessly
    mode = newMode;
    modeKey = code;
    restX = 0;
    restY = 0;
    dragVX = 0;
    dragVY = 0;
    if (mouseX === null) {
      mouseX = innerWidth / 2;
      mouseY = innerHeight / 2;
    }
    const origin = start ?? { x: mouseX, y: mouseY };
    chain = buildChain(origin.x, origin.y); // before the overlay, otherwise it would be under the pointer
    if (mode === "scroll") {
      anchor = origin;
      startMotion();
    }
    if (modeKey === "Mouse0") getSelection()?.removeAllRanges(); // the press may have started a text selection
    showOverlay();
  }

  // hard = stop immediately (window left, site disabled)
  function deactivate(hard = false) {
    const wasDrag = mode === "drag";
    mode = null;
    modeKey = "";
    overlay?.remove();
    if (hard || !momentumOn()) return stopMotion();
    if (wasDrag) {
      // Fling only if the mouse was still moving when the key was released
      if (performance.now() - lastMove < 60) {
        vx = dragVX;
        vy = dragVY;
        startMotion();
      } else {
        stopMotion();
      }
    }
    // Scroll mode: the loop keeps running and slows down to zero
  }

  // Any other user input stops coasting immediately
  const interrupt = () => !mode && frame && stopMotion();
  window.addEventListener("wheel", interrupt, { passive: true });
  window.addEventListener("mousedown", () => !armed && interrupt());
  window.addEventListener("touchstart", interrupt, { passive: true });

  window.addEventListener("keydown", (event) => {
    const heldCode = mode ? modeKey : armed?.code;
    if (heldCode) {
      if (HoldToScrollKeys.isMouse(heldCode)) return; // keys don't interrupt a held mouse button
      if (event.code === heldCode) {
        if (mode && !HoldToScrollKeys.isModifier(event.key)) event.preventDefault(); // swallow key repeat
        return;
      }
      // Another key while holding: it's a shortcut (Shift+A, Alt+Left …) – step aside
      armed = null;
      if (mode) deactivate();
      return;
    }
    if (modeFor(event.code) === null) interrupt();
    const newMode = modeFor(event.code);
    if (!newMode || !enabled()) return;
    if (event.repeat || event.defaultPrevented) return; // the page handles the key itself
    if (otherModifierHeld(event)) return;
    if (keyBelongsToElement(event.composedPath()[0]) || keyBelongsToElement(deepActiveElement())) return;

    if (HoldToScrollKeys.isModifier(event.key)) {
      // Modifiers only arm: the mode starts once the mouse moves, so shortcuts,
      // Shift+click and tapping Alt keep working as usual.
      armed = { mode: newMode, code: event.code, x: mouseX ?? innerWidth / 2, y: mouseY ?? innerHeight / 2 };
      return;
    }
    event.preventDefault(); // e.g. Space would otherwise scroll the page by a screen
    activate(newMode, event.code);
  });

  window.addEventListener("keyup", (event) => {
    if (armed && event.code === armed.code) armed = null;
    if (!mode || event.code !== modeKey) return;
    event.preventDefault(); // also keeps Alt from opening the menu bar after scrolling
    deactivate();
  }, true);

  // Mouse buttons work like modifiers: pressing only arms, so a click without
  // movement stays a click (follow a link, open the context menu, middle-click …).
  window.addEventListener("mousedown", (event) => {
    armed = null; // Shift+click, Alt+click …
    swallowUntil = 0;
    const code = HoldToScrollKeys.mouseCode(event.button);
    const newMode = mode ? null : modeFor(code);
    if (!newMode || !enabled() || otherModifierHeld(event)) return; // with a modifier the button acts as usual
    const target = event.composedPath()[0];
    if (pointerOnOwnElement(target) || onScrollbar(event, target)) return;
    if (event.button === 1) event.preventDefault(); // Firefox's own autoscroll
    armed = { mode: newMode, code, x: event.clientX, y: event.clientY };
  }, true);

  window.addEventListener("mouseup", (event) => {
    const code = HoldToScrollKeys.mouseCode(event.button);
    if (armed?.code === code) armed = null;
    if (!mode || modeKey !== code) return;
    swallowUntil = performance.now() + 500;
    deactivate();
  }, true);

  function swallow(event) {
    if (event.type === "contextmenu" && armed?.code === "Mouse2") {
      event.preventDefault(); // Linux opens the menu on press – that would end the scroll before it starts
      return;
    }
    if (performance.now() > swallowUntil) return;
    swallowUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  window.addEventListener("click", swallow, true);
  window.addEventListener("auxclick", swallow, true);
  window.addEventListener("contextmenu", swallow, true);
  // Held mouse button: no text or link dragging
  window.addEventListener("dragstart", (event) => HoldToScrollKeys.isMouse(armed?.code ?? modeKey) && event.preventDefault(), true);
  window.addEventListener("selectstart", (event) => modeKey === "Mouse0" && event.preventDefault(), true);
  window.addEventListener("blur", () => {
    armed = null;
    deactivate(true);
  });
  document.addEventListener("visibilitychange", () => document.hidden && deactivate(true));

  const ARM_DISTANCE = 4; // px of movement before an armed modifier or mouse button takes over
  const BUTTON_BITS = { Mouse0: 1, Mouse1: 4, Mouse2: 2 }; // MouseEvent.buttons

  window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (mode && HoldToScrollKeys.isMouse(modeKey) && !(event.buttons & BUTTON_BITS[modeKey])) {
      // Released outside the window – no mouseup arrived. (Only checked while active:
      // Firefox reports no buttons on the first move after pressing on a link.)
      deactivate();
      return;
    }
    if (armed && Math.hypot(mouseX - armed.x, mouseY - armed.y) >= ARM_DISTANCE) {
      const { mode: armedMode, code, x, y } = armed;
      armed = null;
      activate(armedMode, code, { x, y });
      lastMove = performance.now();
    }
    if (mode === "scroll") {
      updateIndicator();
    } else if (mode === "drag") {
      const factor = (Number(settings.speed) || 1) * (settings.invert ? 1 : -1);
      const dx = event.movementX * factor;
      const dy = event.movementY * factor;
      scrollByFraction(dx, dy);

      // Velocity for the fling on release, smoothed over the latest movements
      const now = performance.now();
      const dt = Math.max((now - lastMove) / 1000, 0.004);
      const blend = now - lastMove < 100 ? 0.5 : 1;
      dragVX += (dx / dt - dragVX) * blend;
      dragVY += (dy / dt - dragVY) * blend;
      lastMove = now;
    }
    // With a mouse button held the page would otherwise see a drag of its own (select, move a map …)
    if (mode && HoldToScrollKeys.isMouse(modeKey)) event.stopPropagation();
  }, { capture: true, passive: true });
})();
