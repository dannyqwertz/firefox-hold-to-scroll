// Welcome page shown after installing: the current keys, plus room to try them out.
// content.js is loaded on this page too, so the add-on works here right away.
const t = (key) => browser.i18n.getMessage(key) || key;

document.documentElement.lang = browser.i18n.getUILanguage();
document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));

// Keys may already have been changed – always show the stored ones
function renderKeys(settings) {
  const rows = [["dragKey", settings.dragKey, settings.dragKeyName], ["scrollKey", settings.scrollKey, settings.scrollKeyName]];
  for (const [id, code, name] of rows) {
    const kbd = document.getElementById(id);
    kbd.textContent = HoldToScrollKeys.label(code, name);
    kbd.parentElement.querySelectorAll(`#${id}, #${id} + .move, #${id} + .move + .action`)
      .forEach((el) => (el.style.opacity = code ? "" : "0.4"));
  }
}

browser.storage.sync.get(HoldToScrollDefaults).then(renderKeys);
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") browser.storage.sync.get(HoldToScrollDefaults).then(renderKeys);
});

document.getElementById("openSettings").addEventListener("click", () => browser.runtime.openOptionsPage());
document.getElementById("close").addEventListener("click", () => document.getElementById("card").classList.add("hidden"));

// Numbered tiles to scroll around
const playground = document.getElementById("playground");
for (let i = 1; i <= 12 * 30; i++) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.textContent = i;
  playground.appendChild(tile);
}
