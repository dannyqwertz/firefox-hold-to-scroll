const settings = structuredClone(HoldToScrollDefaults);
const $ = (id) => document.getElementById(id);
const save = (values) => browser.storage.sync.set(values);
const t = (key, ...subs) => browser.i18n.getMessage(key, subs) || key;
const locale = browser.i18n.getUILanguage();

// Translate static texts; the English text in the HTML is the fallback
document.documentElement.lang = locale;
document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));

// The same page serves as settings page (about:addons) and toolbar popup
const isPopup = new URLSearchParams(location.search).has("popup");
if (isPopup) {
  document.body.classList.add("popup");
  document.querySelectorAll("details:not(#keysSection)").forEach((d) => (d.open = false));
}

const keyLabel = HoldToScrollKeys.label;

function renderKeys() {
  $("dragKeyLabel").textContent = keyLabel(settings.dragKey, settings.dragKeyName);
  $("scrollKeyLabel").textContent = keyLabel(settings.scrollKey, settings.scrollKeyName);
}

// --- Key bindings ----------------------------------------------------------

let recording = null;

function stopRecording(message = "") {
  if (!recording) return;
  $(`${recording}Label`).classList.remove("recording");
  window.removeEventListener("keydown", onRecordKey, true);
  window.removeEventListener("mousedown", onRecordMouse, true);
  recording = null;
  renderKeys();
  $("keyMessage").textContent = message;
}

function record(code, name) {
  const other = recording === "dragKey" ? "scrollKey" : "dragKey";
  if (settings[other] && HoldToScrollKeys.normalize(code) === HoldToScrollKeys.normalize(settings[other])) {
    $("keyMessage").textContent = t("keyUsed", keyLabel(code, name));
    return;
  }
  const key = recording;
  settings[key] = code;
  settings[`${key}Name`] = name;
  save({ [key]: code, [`${key}Name`]: name });
  const hints = { AltLeft: "hintAlt", Tab: "hintTab", Mouse0: "hintMouse0", Mouse1: "hintMouse1", Mouse2: "hintMouse2" };
  stopRecording(hints[code] ? t(hints[code]) : "");
}

function onRecordKey(event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.code === "Escape") return stopRecording();
  record(event.code, event.key);
}

// A mouse button is recorded by clicking the key field with it; a click anywhere else cancels.
function onRecordMouse(event) {
  const code = HoldToScrollKeys.mouseCode(event.button);
  if (event.target !== $(`${recording}Label`) || !code) return stopRecording();
  event.preventDefault();
  record(code, "");
}

document.querySelectorAll("[data-record]").forEach((button) => {
  button.addEventListener("click", () => {
    stopRecording();
    recording = button.dataset.record;
    const label = $(`${recording}Label`);
    label.textContent = t("pressKey");
    label.classList.add("recording");
    $("keyMessage").textContent = t("recordHint");
    window.addEventListener("keydown", onRecordKey, true);
    window.addEventListener("mousedown", onRecordMouse, true);
    button.blur(); // otherwise Space would trigger the button again
  });
});

// Right-clicking the key field records the button, it shouldn't also open a menu
document.querySelectorAll("kbd").forEach((kbd) => kbd.addEventListener("contextmenu", (event) => event.preventDefault()));

document.querySelectorAll("[data-clear]").forEach((button) => {
  button.addEventListener("click", () => {
    stopRecording();
    const key = button.dataset.clear;
    settings[key] = "";
    settings[`${key}Name`] = "";
    save({ [key]: "", [`${key}Name`]: "" });
    renderKeys();
  });
});

// --- Drag and scroll options -----------------------------------------------

document.querySelectorAll('input[name="overlayStyle"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    settings.overlayStyle = radio.value;
    save({ overlayStyle: radio.value });
    renderPreview();
  });
});

$("invert").addEventListener("change", () => save({ invert: $("invert").checked }));
$("showFrame").addEventListener("change", () => save({ showFrame: $("showFrame").checked }));
$("showIndicator").addEventListener("change", () => save({ showIndicator: $("showIndicator").checked }));
$("speed").addEventListener("input", () => {
  $("speedValue").value = $("speed").value;
  save({ speed: Number($("speed").value) });
});

const FACTORS = ["deadZone", "scrollSpeed", "scrollCurve", "scrollMax", "ringWidth", "brakeTime"];

$("momentum").addEventListener("change", () => {
  settings.momentum = $("momentum").checked;
  save({ momentum: settings.momentum });
  $("brakeTime").disabled = !settings.momentum;
});

function renderScrollMode() {
  const steps = settings.scrollMode === "steps";
  $("progressiveSettings").hidden = steps;
  $("stepSettings").hidden = !steps;
}

document.querySelectorAll('input[name="scrollMode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    settings.scrollMode = radio.value;
    save({ scrollMode: radio.value });
    renderScrollMode();
    renderPreview();
  });
});

$("zoneSpeeds").addEventListener("input", () => {
  const speeds = $("zoneSpeeds").value.split(/[,;\s]+/).filter(Boolean).map(Number);
  const valid = speeds.length >= 1 && speeds.length <= 8 && speeds.every((v) => Number.isFinite(v) && v > 0);
  $("zoneError").hidden = valid;
  if (!valid) {
    $("zoneError").textContent = t("zoneError");
    return;
  }
  settings.zoneSpeeds = speeds;
  save({ zoneSpeeds: speeds });
  renderPreview();
});

function renderFactors() {
  for (const id of FACTORS) {
    const output = document.querySelector(`output[data-for="${id}"]`);
    output.value = `${settings[id].toLocaleString(locale)} ${output.dataset.unit}`.trim();
  }
  // What the factors add up to, readable at a few distances
  const progressive = { ...settings, scrollMode: "progressive" };
  const samples = [50, 150, 300].map((beyond) =>
    `${beyond} px → ${Math.round(HoldToScroll.speedAt(settings.deadZone + beyond, progressive)).toLocaleString(locale)} px/s`);
  $("curveSummary").textContent = t("curveSummary", samples.join(" · "));
}

for (const id of FACTORS) {
  $(id).addEventListener("input", () => {
    settings[id] = Number($(id).value);
    save({ [id]: settings[id] });
    renderFactors();
    renderPreview();
  });
}

// --- Preview ---------------------------------------------------------------

const preview = $("preview");
const indicator = HoldToScroll.create(preview);
let previewMouse = null;

function renderPreview() {
  const bounds = { width: preview.clientWidth, height: preview.clientHeight };
  const anchor = { x: bounds.width / 2, y: bounds.height / 2 };
  indicator.element.style.mixBlendMode = HoldToScroll.palette(settings.overlayStyle).blend;
  indicator.update(anchor, previewMouse ?? anchor, settings, bounds);
}

preview.addEventListener("mousemove", (event) => {
  const rect = preview.getBoundingClientRect();
  previewMouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  renderPreview();
});
preview.addEventListener("mouseleave", () => {
  previewMouse = null;
  renderPreview();
});
new ResizeObserver(renderPreview).observe(preview);

// --- Current site (popup only) ---------------------------------------------

let currentSite = null;

function renderSite() {
  if (!isPopup) return;
  $("site").hidden = false;
  if (!currentSite) {
    $("siteHost").textContent = t("siteUnavailable");
    $("siteState").textContent = t("siteUnavailableHint");
    $("siteEnabled").disabled = true;
    $("siteEnabled").checked = false;
    return;
  }
  const on = !settings.disabledSites.includes(currentSite);
  $("siteHost").textContent = currentSite;
  $("siteState").textContent = t(on ? "siteActive" : "siteDisabled");
  $("siteEnabled").disabled = false;
  $("siteEnabled").checked = on;
}

async function loadSite() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const reply = await browser.tabs.sendMessage(tab.id, { type: "site" }, { frameId: 0 });
    currentSite = reply?.site ?? null;
  } catch {
    currentSite = null; // no content script: about:, AMO, or opened before installation
  }
  renderSite();
}

function setSiteEnabled(site, on) {
  const others = settings.disabledSites.filter((s) => s !== site);
  settings.disabledSites = on ? others : [...others, site].sort();
  save({ disabledSites: settings.disabledSites });
  renderSite();
  renderDisabled();
}

$("siteEnabled").addEventListener("change", () => setSiteEnabled(currentSite, $("siteEnabled").checked));

// --- Disabled sites --------------------------------------------------------

function renderDisabled() {
  const list = $("disabledList");
  list.replaceChildren(...settings.disabledSites.map((site) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = site;
    const button = document.createElement("button");
    button.textContent = t("enableAgain");
    button.addEventListener("click", () => setSiteEnabled(site, true));
    item.append(name, button);
    return item;
  }));
  $("disabledSection").hidden = settings.disabledSites.length === 0;
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.disabledSites) return;
  settings.disabledSites = changes.disabledSites.newValue ?? [];
  renderSite();
  renderDisabled();
});

// --- Load ------------------------------------------------------------------

browser.storage.sync.get(HoldToScrollDefaults).then((stored) => {
  Object.assign(settings, stored);
  renderKeys();
  $("invert").checked = settings.invert;
  $("speed").value = settings.speed;
  $("speedValue").value = settings.speed;
  $("showFrame").checked = settings.showFrame;
  $("showIndicator").checked = settings.showIndicator;
  const style = document.querySelector(`input[name="overlayStyle"][value="${settings.overlayStyle}"]`);
  if (style) style.checked = true;
  for (const id of FACTORS) $(id).value = settings[id];
  $("momentum").checked = settings.momentum;
  $("brakeTime").disabled = !settings.momentum;
  renderFactors();
  $("zoneSpeeds").value = settings.zoneSpeeds.join(", ");
  const scrollMode = document.querySelector(`input[name="scrollMode"][value="${settings.scrollMode}"]`);
  if (scrollMode) scrollMode.checked = true;
  renderScrollMode();
  renderPreview();
  renderDisabled();
  loadSite();
});
