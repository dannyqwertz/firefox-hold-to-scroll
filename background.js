// Toolbar badge ("off") for tabs whose site is disabled.
browser.action.setBadgeBackgroundColor({ color: "#8f8f9d" });
browser.action.setBadgeTextColor({ color: "#ffffff" });

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "state" || !sender.tab) return;
  browser.action.setBadgeText({ tabId: sender.tab.id, text: message.enabled ? "" : browser.i18n.getMessage("badgeOff") });
});

// Show the welcome page with the keys right after installing
browser.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") browser.tabs.create({ url: "welcome.html" });
});
