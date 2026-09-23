// Key handling shared by the content script, settings page and welcome page.
var HoldToScrollKeys = (() => {
  // Shift, Ctrl and Super work on either side. Alt stays side-specific,
  // because the right Alt key is AltGr on many layouts (used for typing @, € …).
  const SIDELESS = /^(Shift|Control|Meta)(Left|Right)$/;
  const normalize = (code) => (SIDELESS.test(code) ? code.replace(/(Left|Right)$/, "") : code);

  const MODIFIERS = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "OS"]);
  const isModifier = (key) => MODIFIERS.has(key);

  // Mouse buttons are stored as "Mouse<MouseEvent.button>": left, middle, right
  const MOUSE_BUTTONS = 3;
  const mouseCode = (button) => (button < MOUSE_BUTTONS ? `Mouse${button}` : "");
  const isMouse = (code) => /^Mouse\d$/.test(code);

  // Keys whose KeyboardEvent.key isn't a readable label get a translated name (message "key<code>")
  const NAMED = new Set([
    "Space", "Shift", "Control", "Meta", "AltLeft", "AltRight",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Mouse0", "Mouse1", "Mouse2",
  ]);

  // Printable keys show what the key produces on the user's layout (recorded as KeyboardEvent.key)
  function label(code, name) {
    const t = (key, ...subs) => browser.i18n.getMessage(key, subs) || key;
    if (!code) return t("keyNotSet");
    const normalized = normalize(code);
    if (NAMED.has(normalized)) return t(`key${normalized}`);
    if (name && name.trim().length === 1) return name.toUpperCase();
    if (/^Numpad/.test(code)) return t("keyNumpad", code.slice(6));
    return name || code;
  }

  return { normalize, isModifier, mouseCode, isMouse, label };
})();
