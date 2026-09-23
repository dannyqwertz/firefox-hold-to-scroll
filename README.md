# Hold to Scroll

A Firefox add-on: hold a key and move the mouse to scroll – no mouse click
needed. Inspired by "Spacebar Drag", written from scratch.



https://github.com/user-attachments/assets/86aa1f08-b488-4415-bb5f-e63ac36767ff



**[Download the latest release](https://github.com/dannyqwertz/firefox-hold-to-scroll/releases/latest)** – signed `.xpi`, click it in Firefox to install.

## Features

- **Drag mode** (default key: Shift): the page – or the scrollable area under
  the pointer – follows the mouse, as if you were grabbing it.
- **Scroll mode** (default key: Alt): pressing the key sets an anchor point;
  the page scrolls towards the mouse, even while the mouse stands still.
  Two variants:
  - *Progressive* (default):
    `speed = base speed × (distance / 100 px) ^ acceleration`, capped at the
    top speed. A circle around the anchor grows and shrinks with the speed
    (area ∝ speed; the dotted ring marks top speed).
  - *Steps*: a fixed speed per zone (zone width and a list of px/s values);
    all zones are lightly filled and the active one is highlighted.

  Both have a dead zone around the anchor; direction and px/s are shown next
  to the pointer.
- **Modifier-friendly**: with Shift, Ctrl, Alt or Super as the key, the mode
  only starts once the mouse moves. Shortcuts (Shift+A, Alt+←), Shift+click
  and tapping Alt for the menu bar keep working. Shift, Ctrl and Super work on
  either side; Alt is left-only, since the right Alt is AltGr on many layouts.
- **Momentum & coasting** (optional, adjustable coast time): scrolling eases
  in and coasts to a stop after releasing the key; in drag mode the page keeps
  rolling if the mouse was still moving on release. Mouse wheel, click or any
  key stops it immediately.
- **Neutral overlay**: inverted (`mix-blend-mode: difference`, visible on any
  background), dark or light.
- **Toolbar button**: a popup with an on/off switch for the current site (per
  hostname) and all settings. Disabled sites show an "off" badge.
- **Welcome page** after installing, showing the keys with room to try them.
- Stays out of the way where the key is needed: text fields, contenteditable,
  buttons, checkboxes, media, or when the page handles the key itself.

The interface is available in English and German (following the browser
language). All settings are available in the popup and under about:addons →
Hold to Scroll, with a live preview.

## Try it

    npx web-ext run          # starts Firefox with the add-on
    # or: about:debugging → "This Firefox" → "Load Temporary Add-on…" → manifest.json

## Build

    npx web-ext lint
    npx web-ext build        # → web-ext-artifacts/*.zip, without store/, docs/ and README.md

Release versions of Firefox only install signed add-ons permanently. To sign
it without publishing (unlisted), create API credentials at
https://addons.mozilla.org/developers/addon/api/key/ and run:

    npx web-ext sign --channel=unlisted --api-key=… --api-secret=…

## Release

Push a tag matching the manifest version, e.g. `git tag v1.0.1 && git push github v1.0.1`.
The GitHub workflow (`.github/workflows/release.yml`) lints and builds the add-on and
creates a GitHub release with the `.xpi`. If the repository secrets `AMO_JWT_ISSUER` and
`AMO_JWT_SECRET` are set, the file is signed by Mozilla on the unlisted channel (not
published on addons.mozilla.org) and installs in any Firefox.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3 |
| `content.js` | Key handling, drag/scroll motion, overlay |
| `scroll.js` | Scroll speed formula and indicator – shared with the settings page |
| `keys.js` | Key matching and labels – shared |
| `defaults.js` | Default settings – shared |
| `options.html`, `options.js` | Settings page; also the toolbar popup (`options.html?popup`) |
| `welcome.html`, `welcome.js` | Welcome page opened after installing |
| `background.js` | "off" badge, opens the welcome page |
| `_locales/` | English (default) and German translations |
| `icons/` | Toolbar icons for light/dark themes, add-on icon |
| `store/` | addons.mozilla.org listing texts and screenshots (not packaged) |
| `docs/` | Demo animation for this README (not packaged) |

## License

[MIT](LICENSE) © 2026 Daniel Michelberger
