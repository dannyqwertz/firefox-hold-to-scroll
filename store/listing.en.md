# addons.mozilla.org listing – English (default locale)

## Name

Hold to Scroll

## Summary (max. 250 characters)

Hold a key and move the mouse to scroll – no click needed. Drag the page with Shift, or hold Alt and scroll progressively from an anchor point: the farther the mouse, the faster. With momentum, per-site switch and live preview.

## Description

Scroll without clicking, without the wheel, without hunting for the scrollbar: hold a key and move the mouse.

<b>Two modes</b>
<ul>
<li><b>Drag mode</b> (Shift): the page follows the mouse, as if you were grabbing it. Release while moving and it keeps rolling.</li>
<li><b>Scroll mode</b> (Alt): pressing the key sets an anchor point. The page scrolls towards the mouse – even while the mouse stands still. The farther away the mouse, the faster it scrolls.</li>
</ul>

<b>Scroll the way you like</b>
<ul>
<li><b>Progressive</b>: speed grows smoothly with the distance – tune base speed, acceleration and top speed.</li>
<li><b>Steps</b>: fixed speeds per zone, if you prefer predictable steps.</li>
<li><b>Momentum & coasting</b>: scrolling eases in and coasts to a stop instead of jumping. Adjustable, or off.</li>
<li>A subtle indicator shows the anchor, direction and current speed – inverted, so it stays visible on light and dark pages.</li>
</ul>

<b>Stays out of your way</b>
<ul>
<li>Shortcuts like Shift+A or Alt+←, Shift+click and tapping Alt keep working: the mode only starts once the mouse moves.</li>
<li>In text fields, buttons and videos the key keeps its normal function.</li>
<li>Turn it off for single sites right from the toolbar button.</li>
<li>Works in scrollable areas too, not just the whole page.</li>
</ul>

<b>Your keys</b>
Any key can be used – Shift, Alt, Ctrl, Space or a letter. Everything is configurable in the toolbar popup, with a live preview.

Available in English and German. No data is collected, nothing is sent anywhere.

## Categories

Other

## Tags

scroll, autoscroll, mouse, keyboard, drag, navigation, accessibility

## Screenshots (1280 × 800) and captions

1. `screenshots/1-scroll-progressive.png` – Scroll mode: hold Alt and move the mouse – the circle grows with the speed.
2. `screenshots/2-scroll-steps-dark.png` – Steps variant on a dark page: fixed speeds per zone, the active zone is highlighted.
3. `screenshots/3-popup-settings.png` – Toolbar popup: per-site switch, keys, momentum and colors.
4. `screenshots/4-popup-scroll.png` – Tune the scroll speed with a live preview.
5. `screenshots/5-welcome.png` – After installing, a welcome page shows your keys and lets you try them right away.

German screenshots of the popup and welcome page are in `screenshots/de/`.

## Additional details

- License: MIT
- Privacy policy: not needed – the add-on collects no data (`data_collection_permissions: none`).
- Support website: https://github.com/dannyqwertz/firefox-hold-to-scroll (issues)
- Support e-mail: *to be decided*

## Notes for reviewers

- No remote code, no build step, no minification – the package is the source.
- Permissions: `storage` for the settings. The content script runs on all sites because the add-on works on any page; it only reacts to the configured keys and never reads or sends page content.
- The popup and settings page are the same file (`options.html?popup` for the popup).
- The welcome page (`welcome.html`) opens once after installation.
