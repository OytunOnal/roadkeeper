// @level presentation
// Roadkeeper — The Road's diagram client: the diagrams, drawn dark or light in the page's tokens. The page embeds each
// function here by its own source (road-html.mjs), in one scope with the road client's (road-client.mjs), whose
// functions decide whether the diagrams draw dark and their theme from the tokens' values; it imports nothing.

// After load, any mermaid block still holding text and no <svg> pulls the renderer from cdnjs: the one script host the
// artifact CSP allows, and no CSP applies off it. If it will not load, the source stays and says so. `diagrams.state`
// is the renderer's: idle, loading, ready or failed.
export function diagramClient() {
  var diagrams = { state: 'idle' };
  function retheme(){ redrawInTheme(diagrams); }
  function drawShown(){ drawShownDiagrams(diagrams); }
  if (window.matchMedia){ var mq=matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', retheme); }
  try{ new MutationObserver(retheme).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']}); }catch{}
  document.addEventListener('road:tab', drawShown);
  document.addEventListener('road:shown', drawShown);
  window.addEventListener('load', function(){ setTimeout(drawShown, 400); }); // give the host its turn first
}

// the tokens' values as the page resolves them now: mermaid's colour maths needs values, not var()
export function resolvedTokenValues(){
  var names=diagramTokens(), computed=getComputedStyle(document.documentElement), values=Object.create(null);
  for (var i=0;i<names.length;i++) values[names[i]]=computed.getPropertyValue('--'+names[i]).trim();
  return values;
}

export function noteUndrawn(nodes){
  for (var i=0;i<nodes.length;i++){
    var p=nodes[i];
    if (p.nextElementSibling && p.nextElementSibling.className==='note') continue;
    var n=document.createElement('p');
    n.className='note';
    n.textContent='diagram source shown; the renderer did not load';
    p.parentNode.insertBefore(n, p.nextSibling);
  }
}

export function unrenderedDiagrams(){
  var out=[], pres=document.querySelectorAll('pre.mermaid');
  for (var i=0;i<pres.length;i++){
    if (pres[i].textContent.trim() && !pres[i].querySelector('svg') && !pres[i].getAttribute('data-drawing')) out.push(pres[i]);
  }
  return out;
}

// a hidden diagram has no size to be drawn at: only the visible ones are drawn, and the rest when they come into
// view: their tab opens (road:tab), or their issue's detail or their group (road:shown)
export function visibleDiagrams(nodes){
  var out=[];
  for (var i=0;i<nodes.length;i++) if (nodes[i].offsetParent!==null) out.push(nodes[i]);
  return out;
}

export function pageIsDark(){
  return isDark(document.documentElement.getAttribute('data-theme'), window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}

// each diagram at its own size, scrolling sideways in its box when wider than the page
export function setupMermaid(){
  var fit={useMaxWidth:false}, theme=diagramTheme(resolvedTokenValues(), pageIsDark());
  mermaid.initialize({startOnLoad:false, securityLevel:'strict', theme: theme.theme, themeVariables: theme.themeVariables,
    themeCSS: theme.themeCSS, flowchart:fit, sequence:fit, state:fit});
}

export function drawVisibleDiagrams(){
  var nodes=visibleDiagrams(unrenderedDiagrams());
  if (!nodes.length) return;
  for (var i=0;i<nodes.length;i++){ nodes[i].setAttribute('data-drawing','1'); nodes[i].setAttribute('data-source', nodes[i].textContent); }
  try{ mermaid.run({nodes: nodes}); }catch{ noteUndrawn(nodes); }
}

// a theme switch redraws every diagram from its source in the new theme
export function redrawInTheme(diagrams){
  if (diagrams.state!=='ready') return;
  var drawn=document.querySelectorAll('pre.mermaid[data-source]');
  for (var i=0;i<drawn.length;i++){
    drawn[i].textContent=drawn[i].getAttribute('data-source');
    drawn[i].removeAttribute('data-drawing'); drawn[i].removeAttribute('data-processed');
  }
  try{ setupMermaid(); drawVisibleDiagrams(); }catch{ noteUndrawn(drawn); }
}

export function drawShownDiagrams(diagrams){
  if (diagrams.state==='ready') drawVisibleDiagrams();
  else if (diagrams.state==='idle' && visibleDiagrams(unrenderedDiagrams()).length) loadRenderer(diagrams);
}

export function loadRenderer(diagrams){
  var nodes=unrenderedDiagrams();
  if (!nodes.length) return;            // the host drew them: nothing to do
  diagrams.state='loading';
  var s=document.createElement('script');
  // a version cdnjs publishes, with the registry's own sri hash: a changed file does not run
  s.src='https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.15.0/mermaid.min.js';
  s.integrity='sha512-HH52omhHpZF6RfVnGiQwYgYm4H/ya2xsZYLl5xJ4+tLfX+rN4+8zF7V/H/KLeicPrKZYi1g6iBmVkk2AhXTGlg==';
  s.crossOrigin='anonymous';
  s.onerror=function(){ diagrams.state='failed'; noteUndrawn(nodes); };
  s.onload=function(){
    try{
      setupMermaid();
      diagrams.state='ready';
      drawVisibleDiagrams();
    }catch{ diagrams.state='failed'; noteUndrawn(nodes); }
  };
  document.head.appendChild(s);
}
