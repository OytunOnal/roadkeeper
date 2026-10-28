// @level presentation
// Roadkeeper — The Road's page client's one embedded entry, roadClient, and what the clients decide, pure. The page embeds
// each function here by its own source (road-html.mjs), beside the tabs' client (tabs-client.mjs) and the diagram client
// (diagram-client.mjs), in one scope; the page's script returns roadClient. They see only the language's globals.

export function roadClient() {
  return { landOn: landOn, addressToWrite: addressToWrite, whichTabOpens: whichTabOpens,
    whichTabHistoryOpens: whichTabHistoryOpens, isDark: isDark, isGroupOpen: isGroupOpen, lessScrollTop: lessScrollTop,
    diagramTokens: diagramTokens, diagramTheme: diagramTheme };
}

// Where "less" leaves the page: with the closed card's head `headTop` px above the window's top, scrolled from
// `scrollY`, the scroll that puts the head at the window's top; with the head in the window, none (null).
export function lessScrollTop(headTop, scrollY) {
  return headTop < 0 ? scrollY + headTop : null;
}

export function hashName(hash) {
  return String(hash || "").replace(/^#/, "");
}

// Where a hash lands: a tab's own name opens that tab; anything else, nowhere (null).
export function landOn(hash, ids) {
  var tab = hashName(hash);
  return ids.indexOf(tab) >= 0 ? tab : null;
}

// What the address becomes with the tab `shown` open: a hash landing on no tab, the shown tab's ("#you"); a hash
// landing on a tab, or no hash, stays (null).
export function addressToWrite(hash, shown, ids) {
  return hashName(hash) === "" || landOn(hash, ids) ? null : "#" + shown;
}

// Which tab opens where no hash lands: `open`, the tab open now; else "you" while the page opens on it (`opens`, its
// data-opens), over `stored`, the tab the browser remembered; else `stored`, one of `ids`; else `opens`.
export function whichTabOpens(tabs, ids) {
  if (tabs.open) return tabs.open;
  if (tabs.opens === "you") return tabs.opens;
  return ids.indexOf(tabs.stored) >= 0 ? tabs.stored : tabs.opens;
}

// Which tab a history step opens: the tab its `state` carries ({ tab }), one of `ids`; else where its `hash` lands;
// else none (null), and the caller keeps whichTabOpens' choice.
export function whichTabHistoryOpens(state, hash, ids) {
  var tab = state ? state.tab : null;
  return ids.indexOf(tab) >= 0 ? tab : landOn(hash, ids);
}

// Whether the diagrams draw dark: a theme the page is set to wins; with none, the system's.
export function isDark(forced, prefersDark) {
  return forced ? forced === "dark" : Boolean(prefersDark);
}

// Whether a group opens: its stored choice, "open" or "closed", wins; else as the page drew it.
export function isGroupOpen(stored, drawnOpen) {
  return stored === "open" || stored === "closed" ? stored === "open" : Boolean(drawnOpen);
}

// The one mapping from each token to the mermaid theme variables it sets.
export function diagramTokenVariables() {
  return { paper: ["background", "edgeLabelBackground", "errorBkgColor"], body: ["fontFamily"],
    "accent-soft": ["primaryColor", "mainBkg"], accent: ["primaryBorderColor", "nodeBorder"], chip: ["secondaryColor"],
    ink: ["primaryTextColor", "secondaryTextColor", "tertiaryTextColor", "nodeTextColor", "textColor", "titleColor",
      "noteTextColor"], "card-edge": ["secondaryBorderColor"], band: ["tertiaryColor", "clusterBkg"], muted: ["lineColor"],
    line: ["tertiaryBorderColor", "clusterBorder"], "warn-soft": ["noteBkgColor"], warn: ["noteBorderColor"], bad: ["errorTextColor"] };
}

// The tokens diagramTheme reads, each once.
export function diagramTokens() {
  return Object.keys(diagramTokenVariables());
}

// Mermaid's theme from the tokens' resolved values, by name: its base theme, every colour a token's (nodes on
// accent-soft edged in accent, lines muted, clusters on band, text ink, edge labels on the paper, opaque), so mermaid
// derives none of its own; an empty token sets nothing.
export function diagramTheme(tokenValues, dark) {
  // an empty token (the file unread) is left to mermaid: its colour maths throws on an empty value
  var mapping = diagramTokenVariables(), themeVariables = Object.assign(Object.create(null), { darkMode: Boolean(dark) });
  Object.keys(mapping).forEach(function (name) {
    if (tokenValues[name]) mapping[name].forEach(function (variable) { themeVariables[variable] = tokenValues[name]; });
  });
  // mermaid fades the edge label's ground to half: the paper, opaque, instead
  var paper = tokenValues.paper, css = paper ? ".labelBkg, .edgeLabel, .edgeLabel p { background-color: " + paper
    + "; } .edgeLabel rect { fill: " + paper + "; opacity: 1; }" : "";
  return { theme: "base", themeVariables: themeVariables, themeCSS: css };
}
