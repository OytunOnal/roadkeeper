// @level presentation
// Roadkeeper — The Road's icon: the page's head link to an SVG inlined as a data URI, so no browser asks for /favicon.ico.
//
// roadIcon(tokenCss) draws it from the token file's text: a rounded square in --ground, the rail in --accent, a filled
// dot in --done at its middle, each the light block's value, switched to the page-set dark block's by the SVG's own
// prefers-color-scheme query. Reads a value only when it is a hex colour; with any of the six missing, or the file
// unread, the icon is empty and still asks for nothing.

import { esc } from "../../_text.mjs";

const LIGHT = ":root {";                        // the token file's light block opens so
const DARK = ':root[data-theme="dark"] {';      // and its page-set dark block, the same values as the system's dark
const PARTS = ["ground", "accent", "done"];      // the square, the rail and the dot, in that order
const EMPTY = `<link rel="icon" href="data:,">`; // an icon of nothing: the browser asks for no other

// The value a block of the token file gives `--name`, or null when it gives no hex colour.
function tokenIn(css, opener, name) {
  const at = css.indexOf(opener);
  if (at < 0) return null;
  const block = css.slice(at + opener.length, css.indexOf("}", at));
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{3,8})\\s*;`).exec(block);
  return m ? m[1] : null;
}

// The icon's SVG, its three parts' colours light then dark.
function iconSvg(light, dark) {
  const fills = (c) => PARTS.map((p, i) => `.${p[0]}{fill:${c[i]}}`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>${fills(light)}@media (prefers-color-scheme: dark){${fills(dark)}}</style>`
    + `<rect class="g" width="32" height="32" rx="7"/><rect class="a" x="14.5" y="3" width="3" height="26"/><circle class="d" cx="16" cy="16" r="7.5"/></svg>`;
}

// The head's icon link, drawn from the token file's text; the empty icon when the file was not read (null).
export function roadIcon(tokenCss) {
  if (tokenCss == null) return EMPTY;
  const light = PARTS.map((p) => tokenIn(tokenCss, LIGHT, p)), dark = PARTS.map((p) => tokenIn(tokenCss, DARK, p));
  if ([...light, ...dark].includes(null)) return EMPTY;
  return `<link rel="icon" type="image/svg+xml" href="${esc(`data:image/svg+xml,${encodeURIComponent(iconSvg(light, dark))}`)}">`;
}
