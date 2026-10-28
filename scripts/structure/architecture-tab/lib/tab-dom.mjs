// @level presentation
// Roadkeeper — the Architecture tab's client, the DOM and its events: the declared levels as bands, outermost on top; a view
// is one node's children — the top modules, or a module's nested modules and files — each a box
// spanning the bands its levels hold, a strip on its left marking the bands it holds and the ones it only crosses.
// Arrows add up file edges marked file to file and leave and enter at the bands most of them start and end in; a box's
// header counts what it hides; chips name what a box reaches outside the view, and a module in a cycle carries one. It
// writes the repository's text with textContent and setAttribute only — never markup — and opens nothing in a new window.
//
// The page embeds each function here by its own source, in one scope with the drawing's one entry (tabDrawing,
// tab-drawing.mjs), and calls tabDom once; it imports nothing. What it counts or decides, the entry does. The client's
// state is one object, `sv` (svState), passed to each function that reads or changes it.

export function tabDom() {
  var root=document.getElementById('sv'), dataEl=document.getElementById('sv-data');
  if(!root||!dataEl) return;
  var V; try { V=JSON.parse(dataEl.textContent); } catch(e) { return; }
  var sv=svState(root, V);
  drawMarkers(sv);
  pressToggle(sv, {mode:sv.D.openingButton(), pressedBySelection:false});
  listenPanAndZoom(sv); listenControls(sv);
  render(sv); fitView(sv);
  window.addEventListener('resize', function(){ fitView(sv); });
  // the tab may be hidden at load: fit again when it is shown
  document.addEventListener('road:tab', function(e){ if (e.detail==='architecture') setTimeout(function(){ fitView(sv); }, 0); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ render(sv); fitView(sv); });
}
// svState: the client's state over the drawing `root` and its data `V`: the elements it draws in, the drawing (D) with
// the canvas measuring its text, the view's transform (T), what is drawn, viewed, selected and hovered, the arrows
// toggle (its mode, and whether the selection pressed Selected), and whether the drawing holds the wheel.
export function svState(root, V){
  var SRC=root.getAttribute('data-src')||'';
  var ctx=document.createElement('canvas').getContext('2d');
  // the page's body family, the drawing's own, and its mono family, the tip's
  var FB=getComputedStyle(root).fontFamily||'sans-serif', FM=getComputedStyle(document.getElementById('sv-tip')).fontFamily||'monospace';
  // each text role's font, as the style sheet sets it
  var FONT={title:'500 13.5px '+FB, pkg:'italic 500 14px '+FB, stat:'11px '+FB, line:'12px '+FM, chip:'10.5px '+FM, part:'11px '+FM};
  function tw(s, role){ ctx.font=FONT[role]; return ctx.measureText(s).width; }
  var D=tabDrawing(V, tw);
  return { root:root, SRC:SRC, D:D, S:D.size, svg:byId('sv-svg'), world:byId('sv-world'), stage:byId('sv-stage'), side:byId('sv-side'), tipEl:byId('sv-tip'),
    T:{k:1,x:0,y:0}, scene:null, view:null, selected:null, selEdge:null, hover:null, toggle:{mode:'bad', pressedBySelection:false}, moved:false, drawn:[], drag:null, held:false };
}
export function byId(id){ return document.getElementById(id); }
export function svgEl(t,a,txt){ var e=document.createElementNS('http://www.w3.org/2000/svg',t); for (var k in (a||{})) e.setAttribute(k,a[k]); if (txt!=null) e.textContent=txt; return e; }
export function htmlEl(t,cls,txt){ var e=document.createElement(t); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
// chain: the views from the top down to `id`
export function chain(sv, id){ var c=[]; for (var v=id; v!=null && sv.D.node(v); v=sv.D.node(v).parent) c.unshift(v); return c; }
// ---------- drawing ----------
export function applyTransform(sv){ sv.world.setAttribute('transform','translate('+sv.T.x+','+sv.T.y+') scale('+sv.T.k+')'); }
// fit the width; the stage takes the drawing's height, and the wheel scrolls past it
export function fitView(sv){ if(!sv.scene) return; var r=sv.stage.getBoundingClientRect(); if (!r.width) return;
  var f=sv.D.fit(r.width, innerHeight, sv.scene); sv.stage.style.height=f.H+'px'; sv.T={k:f.k, x:f.x, y:f.y}; applyTransform(sv); }
export function drawMarkers(sv){
  var defs=svgEl('defs'); sv.svg.insertBefore(defs, sv.svg.firstChild);
  [['',''],['bad','bad'],['exc','exc'],['rel','rel']].forEach(function(p){
    var s=p[0]?'-'+p[0]:'';
    function mk(id, d, cls, start){ var m=svgEl('marker',{id:'sv-'+id+s,'class':p[1],viewBox:'0 0 12 12',refX:start?'1':'11',refY:'6',markerWidth:'9',markerHeight:'9',orient:'auto-start-reverse'}); m.appendChild(svgEl('path',{d:d,'class':cls||''})); defs.appendChild(m); }
    mk('open','M1,1 L11,6 L1,11'); mk('tri','M1,1 L11,6 L1,11 Z','solid'); mk('dia','M1,6 L6,2 L11,6 L6,10 Z','solid',true); mk('diaf','M1,6 L6,2 L11,6 L6,10 Z','fill',true);
  });
}
export function showTip(sv, ev, lines){ var tipEl=sv.tipEl; tipEl.textContent=''; lines.forEach(function(l,i){ var d=htmlEl('div',null,l); if(i===0) d.style.fontWeight='600'; tipEl.appendChild(d); }); tipEl.style.display='block'; tipEl.style.left=Math.min(ev.clientX+14, innerWidth-540)+'px'; tipEl.style.top=(ev.clientY+14)+'px'; }
export function hideTip(sv){ sv.tipEl.style.display='none'; }
// tipOn: element `e` shows a tip while hovered, its lines asked of `lines()` each time it shows
export function tipOn(sv, e, lines){ e.addEventListener('mousemove', function(ev){ showTip(sv, ev, lines()); }); e.addEventListener('mouseleave', function(){ hideTip(sv); }); }
export function render(sv){
  hideTip(sv);
  var sc=sv.D.scene(sv.view), world=sv.world;
  sv.scene={width:sc.width, height:sc.height};
  world.textContent='';
  sc.bands.forEach(function(bd, i){
    world.appendChild(svgEl('rect',{x:-4000,y:bd.y,width:sc.width+8000,height:bd.h,'class':i%2?'band alt':'band'}));
    bd.names.forEach(function(nm, j){ world.appendChild(svgEl('text',{x:16,y:bd.y+22+j*15,'class':'lvl'}, nm)); });
  });
  var bg=svgEl('g'); world.appendChild(bg);
  sc.boxes.forEach(function(b){ bg.appendChild(drawBox(sv, b)); });
  var eg=svgEl('g'); world.appendChild(eg); sv.drawn=[];
  sc.arrows.forEach(function(a){ drawArrow(sv, eg, a); });
  sc.relations.forEach(function(r){
    var p=svgEl('path',{d:r.d,'class':'edge rel',role:r.access.role,'aria-label':r.access.name}); p.setAttribute(r.at, r.url);
    tipOn(sv, p, function(){ return [r.tip]; });
    eg.appendChild(p); sv.drawn.push({g:p, path:p, e:{from:r.r.a, to:r.r.b, mark:0, rel:true}});
  });
  showEdges(sv); crumb(sv); countLine(sv); panel(sv);
}
// drawArrow: arrow `a` of the scene drawn into `eg`, named as its access says: its focus halo under its path, and its
// hit line
export function drawArrow(sv, eg, a){
  var p=a.e, look=a.look;
  var grp=svgEl('g',{'class':'arrow',role:a.access.role,'aria-label':a.access.name}), path=svgEl('path',{d:a.d,'class':look.edge,'marker-end':look.marker,'stroke-width':look.width});
  var hit=svgEl('path',{d:a.d,'class':'edge-hit'});
  grp.appendChild(svgEl('path',{d:a.d,'class':'edge-halo'})); grp.appendChild(path); grp.appendChild(hit);
  tipOn(sv, hit, function(){ return sv.D.tip(a, sv.selEdge); });
  hit.addEventListener('click', function(ev){ if (sv.moved) return; ev.stopPropagation(); selectArrow(sv, p); });
  grp.addEventListener('keydown', function(ev){ if (ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); selectArrowAndShow(sv, p); } });
  eg.appendChild(grp); sv.drawn.push({g:grp, path:path, e:p});
}
// the arrows shown or hidden, hot or dim, a Tab stop after the boxes or none, in the accessibility tree or out of it
export function showEdges(sv){
  sv.drawn.forEach(function(d){
    var s=sv.D.shown(d.e, sv.toggle.mode, {hover:sv.hover, selected:sv.selected, edge:sv.selEdge});
    d.g.style.display=s.shown?'':'none';
    if (s.tabStop) d.g.setAttribute('tabindex', '0'); else d.g.removeAttribute('tabindex');
    if (s.ariaHidden) d.g.setAttribute('aria-hidden', 'true'); else d.g.removeAttribute('aria-hidden');
    d.path.classList.toggle('hot', s.hot); d.path.classList.toggle('dim', s.dim);
  });
}
export function markSel(sv){ var s=sv.world.querySelectorAll('[data-n]'); for (var j=0;j<s.length;j++) s[j].classList.toggle('sel', sv.selected!=null && s[j].getAttribute('data-n')===sv.selected); }
// what follows a selection's change: the boxes marked, the detail, the arrows shown and the count line
export function selectionChanged(sv){ markSel(sv); panel(sv); showEdges(sv); countLine(sv); }
// pressToggle: the arrows toggle set to `toggle` ({ mode, pressedBySelection }), its buttons pressed to match
export function pressToggle(sv, toggle){
  sv.toggle=toggle;
  var bs=sv.root.querySelectorAll('[data-ar]'); for (var i=0;i<bs.length;i++) bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-ar')===toggle.mode?'true':'false');
}
// setSelection: node `id` or arrow `edge` selected, or neither; the arrows toggle follows (toggleAfter)
export function setSelection(sv, id, edge){ sv.selected=id; sv.selEdge=edge; pressToggle(sv, sv.D.toggleAfter(sv.toggle, {selected:id, edge:edge})); }
// a click selects and leaves the page still, so a double-click lands on the card it began on
export function select(sv, id){ setSelection(sv, id, null); selectionChanged(sv); }
export function selectArrow(sv, e){ setSelection(sv, null, e); selectionChanged(sv); }
// space, or Enter or a double-click on a file, also brings the detail into view where it sits under the drawing
export function selectAndShow(sv, id){ select(sv, id); showDetail(sv); }
// an arrow's Space or Enter, as a box's Space
export function selectArrowAndShow(sv, e){ selectArrow(sv, e); showDetail(sv); }
// showDetail: the detail brought into view where it sits under the drawing
export function showDetail(sv){
  if (sv.D.scrollsToDetail(sv.stage.getBoundingClientRect(), sv.side.getBoundingClientRect())) try { sv.side.scrollIntoView({block:'nearest', behavior:'smooth'}); } catch(e) {} }
export function clearSelection(sv){ setSelection(sv, null, null); selectionChanged(sv); }
// drawBox: box `b` of the scene: its card, its header, its lines and gauge, its nested modules and its chips
export function drawBox(sv, b){
  var P=b.P, at=b.at, x0=b.x0, g=svgEl('g',{'class':b.cls+(sv.selected===b.id?' sel':''),tabindex:'0',role:'button','aria-label':b.title,'data-n':b.id,transform:'translate('+P.x+','+P.y+')'});
  g.appendChild(svgEl('rect',{'class':'body',width:P.w,height:at.bodyH,rx:b.rx}));
  // a band the box has files in: a solid strip; a band it only passes through: a dashed line as wide, in its colour
  at.strips.forEach(function(s){ g.appendChild(s.held ? svgEl('rect',{'class':s.cls,x:3,y:s.y,width:4,height:s.h,rx:2}) : svgEl('line',{'class':s.cls,x1:5,x2:5,y1:s.y,y2:s.y+s.h})); });
  var hy=b.headerY;
  g.appendChild(svgEl('text',{'class':'title',x:x0,y:hy.title}, b.title));
  // its counts on a line of their own under its name, so a long name never runs into them
  g.appendChild(svgEl('text',{'class':'lvtag',x:x0,y:hy.counts}, b.info));
  g.appendChild(svgEl('line',{'class':'rule',x1:6,x2:P.w-6,y1:hy.rule,y2:hy.rule}));
  if (b.statRow) drawStatRow(sv, g, b);
  b.lines.forEach(function(l,i){ g.appendChild(svgEl('text',{'class':'ln '+l.cls,x:x0,y:b.head+6+12+i*sv.S.lineH}, l.t)); });
  var ga=b.gaugeAt;
  if (ga){ g.appendChild(svgEl('rect',{'class':'gauge-rest',x:ga.x,y:ga.y,width:ga.w,height:3})); g.appendChild(svgEl('rect',{'class':'gauge-ok',x:ga.x,y:ga.y,width:ga.okW,height:3})); g.appendChild(svgEl('rect',{'class':'gauge-past',x:ga.pastX,y:ga.y,width:ga.pastW,height:3})); }
  // its nested modules, each in its entry's band
  for (var pr in b.pf) b.pf[pr].chips.forEach(function(c){ g.appendChild(drawPart(sv, c, {x:x0+c.x, y:at.partY[pr]+c.line*(sv.S.partH+sv.S.partGap)})); });
  drawChipRow(sv, g, b);
  listenBox(sv, g, b);
  return g;
}
// drawStatRow: a box's header line, and its cycle tag
export function drawStatRow(sv, g, b){
  var statY=b.headerY.stat, st=svgEl('text',{'class':'stat',x:b.x0,y:statY});
  b.stat.forEach(function(p){ st.appendChild(svgEl('tspan', p.cls?{'class':p.cls}:null, p.t)); });
  g.appendChild(st);
  if (b.cyc){ var cg=svgEl('g',{'class':'cyc'}); cg.appendChild(svgEl('rect',{x:b.cyc.x,y:b.cyc.y,width:b.cyc.w,height:15,rx:3})); cg.appendChild(svgEl('text',{x:b.cyc.x+6,y:statY},'cycle'));
    tipOn(sv, cg, function(){ return b.cycleTip; }); g.appendChild(cg); }
}
// drawPart: a nested module's chip `c`, its top left at `point` ({ x, y }) in its box
export function drawPart(sv, c, point){
  var S=sv.S, k=c.it.id, partGroup=svgEl('g',{'class':'part'+(sv.selected===k?' sel':''),'data-n':k,transform:'translate('+point.x+','+point.y+')'});
  partGroup.appendChild(svgEl('rect',{width:c.w,height:S.partH,rx:3})); partGroup.appendChild(svgEl('text',{x:S.partPad,y:14},c.t));
  tipOn(sv, partGroup, function(){ return c.tip; });
  partGroup.addEventListener('click', function(ev){ ev.stopPropagation(); if (sv.moved) return; select(sv, k); });
  partGroup.addEventListener('dblclick', function(ev){ ev.stopPropagation(); ev.preventDefault(); openNode(sv, k); });
  return partGroup;
}
// drawChipRow: what a box reaches outside the view: below a one-band card, inside the foot of a spanning box
export function drawChipRow(sv, g, b){
  var S=sv.S, y=b.at.footY;
  b.row.chips.forEach(function(c){
    var chipGroup=svgEl('g',{'class':'chip'+c.cls}); if (!b.spans) chipGroup.appendChild(svgEl('line',{'class':'stub'+c.cls,x1:c.x+c.w/2,x2:c.x+c.w/2,y1:b.h,y2:y})); chipGroup.appendChild(svgEl('rect',{x:c.x,y:y,width:c.w,height:S.chipH,rx:3})); chipGroup.appendChild(svgEl('text',{x:c.x+S.chipPad,y:y+13},c.t));
    tipOn(sv, chipGroup, function(){ return [c.tip]; }); g.appendChild(chipGroup);
  });
  if (b.row.more){ var mk=svgEl('text',{'class':'lvtag',x:b.row.moreX,y:y+13},b.row.moreText);
    tipOn(sv, mk, function(){ return b.row.moreTip; }); g.appendChild(mk); }
}
// listenBox: a box's hover, click, double-click and keys
export function listenBox(sv, g, b){
  g.addEventListener('mouseenter', function(){ sv.hover=b.id; showEdges(sv); }); g.addEventListener('mouseleave', function(){ sv.hover=null; showEdges(sv); });
  g.addEventListener('click', function(){ if (sv.moved) return; select(sv, b.id); });
  g.addEventListener('dblclick', function(ev){ ev.preventDefault(); openNode(sv, b.id); });
  g.addEventListener('keydown', function(ev){ if (ev.key==='Enter') openNode(sv, b.id); if (ev.key===' '){ ev.preventDefault(); selectAndShow(sv, b.id); } });
}
// a redraw removes the focused card; the stage keeps the focus so Esc still goes up
export function focusStage(sv){ try { sv.stage.focus({preventScroll:true}); } catch(e) {} }
// view `v` drawn, `sel` selected in it
export function goTo(sv, v, sel){ sv.view=v; setSelection(sv, sel, null); render(sv); fitView(sv); focusStage(sv); }
export function openNode(sv, id){ if (sv.D.open(id)==='show') selectAndShow(sv, id); else goTo(sv, id, null); }
export function goUp(sv){ if (sv.view==null) return; goTo(sv, sv.D.node(sv.view).parent, sv.view); }
export function crumb(sv){
  var c=byId('sv-crumb'), view=sv.view; c.textContent='';
  function link(lab, v){ var b=htmlEl('button',null,lab); b.type='button'; b.addEventListener('click', function(){ goTo(sv, v, null); }); return b; }
  c.appendChild(view==null? document.createTextNode('All modules') : link('All modules', null));
  if (view!=null) chain(sv, view).forEach(function(v){ c.appendChild(document.createTextNode(' / ')); c.appendChild(v===view? document.createTextNode(sv.D.node(v).label) : link(sv.D.node(v).label, v)); });
}
// what the count line follows: the arrows toggle and the selection, never the hover
export function countFollows(sv){ return {mode:sv.toggle.mode, selected:sv.selected, edge:sv.selEdge}; }
// the count line, written on each draw and after the toggle or the selection changed
export function countLine(sv){
  var c=byId('sv-count'); c.textContent='';
  sv.D.count(sv.view, countFollows(sv)).forEach(function(w){ c.appendChild(w.cls ? htmlEl('b', w.cls, w.t) : document.createTextNode(w.t)); });
}
// ---------- the detail beside the drawing ----------
// a link to the file in the repository, under `src`; a path the browser cannot encode stays text
export function fileLink(src, f, label){ var a=htmlEl('a',null,label||f); try { a.setAttribute('href', src+f.split('/').map(encodeURIComponent).join('/')); } catch(e) { return htmlEl('span',null,label||f); } return a; }
export function block(src, b){
  var e=htmlEl(b.tag, b.cls||null, b.t); if (b.link!=null) e.appendChild(fileLink(src, b.link));
  (b.items||[]).forEach(function(it){ e.appendChild(listItem(src, it)); });
  return e;
}
// a list's item: its lead words bold, its text, its file linked, its own items a list under it
export function listItem(src, it){
  var n=htmlEl('li', it.cls||null);
  if (it.lead!=null) n.appendChild(htmlEl('b', null, it.lead));
  if (it.t!=null) n.appendChild(document.createTextNode(it.t));
  if (it.link!=null) n.appendChild(fileLink(src, it.link));
  if (it.items) n.appendChild(block(src, {tag:'ul', items:it.items}));
  return n;
}
export function panel(sv){
  sv.side.textContent='';
  sv.D.panel({edge:sv.selEdge, id:sv.selected, view:sv.view}).forEach(function(b){ sv.side.appendChild(block(sv.SRC, b)); });
}
// ---------- pan, zoom, keys ----------
// moveTo: the view moved to `T`, kept at its content's edge
export function moveTo(sv, T){ var r=sv.stage.getBoundingClientRect(); sv.T=sv.D.kept(T, sv.scene, {width:r.width, height:r.height}); applyTransform(sv); }
// holdWheel: the drawing takes the wheel, or gives it back, its focus ring with it
export function holdWheel(sv, held){ sv.held=held; sv.stage.classList.toggle('held', held); }
// placeForWheel: where element `e` sits, for the wheel: in the 'drawing', on its 'toolbar', or elsewhere on the 'page'
export function placeForWheel(e){
  if (!e || !e.closest) return 'page';
  if (e.closest('#sv-stage')) return 'drawing';
  if (e.closest('.sv-ctl')) return 'toolbar';
  return 'page';
}
export function listenPanAndZoom(sv){
  var stage=sv.stage;
  // a press anywhere, and the focus moving anywhere, Tab's included, decide who holds the wheel
  document.addEventListener('pointerdown', function(e){ holdWheel(sv, sv.D.heldAfter(sv.held, 'press', placeForWheel(e.target))); });
  document.addEventListener('focusin', function(e){ holdWheel(sv, sv.D.heldAfter(sv.held, 'focus', placeForWheel(e.target))); });
  stage.addEventListener('pointerdown', function(e){ sv.drag={x:e.clientX,y:e.clientY,tx:sv.T.x,ty:sv.T.y}; sv.moved=false; });
  window.addEventListener('pointermove', function(e){ var drag=sv.drag; if(!drag) return; var dx=e.clientX-drag.x, dy=e.clientY-drag.y; if (sv.D.dragged(dx, dy)){ sv.moved=true; stage.classList.add('drag'); } if (sv.moved) moveTo(sv, {k:sv.T.k, x:drag.tx+dx, y:drag.ty+dy}); });
  window.addEventListener('pointerup', function(){ sv.drag=null; stage.classList.remove('drag'); setTimeout(function(){ sv.moved=false; },0); });
  // a turn the drawing cannot follow keeps its default, so the page scrolls
  stage.addEventListener('wheel', function(e){ var r=stage.getBoundingClientRect(), at={x:e.clientX-r.left, y:e.clientY-r.top};
    var T=sv.D.turnOrNull(sv.held, e, {T:sv.T, point:at, scene:sv.scene, stage:{width:r.width, height:r.height}});
    if (!T) return; e.preventDefault(); moveTo(sv, T); }, {passive:false});
}
export function zoomBy(sv, f){ var r=sv.stage.getBoundingClientRect(); moveTo(sv, sv.D.zoom(sv.T, {x:r.width/2, y:r.height/2}, f)); }
export function listenControls(sv){
  var root=sv.root, stage=sv.stage;
  root.querySelector('.sv-ctl').addEventListener('click', function(ev){
    var b=ev.target.closest('button'); if(!b) return;
    var z=b.getAttribute('data-z'), ar=b.getAttribute('data-ar');
    if (z==='in') zoomBy(sv, 1.2); else if (z==='out') zoomBy(sv, 1/1.2); else if (z==='fit') fitView(sv);
    if (ar){ pressToggle(sv, {mode:ar, pressedBySelection:false}); showEdges(sv); countLine(sv); }
  });
  root.addEventListener('keydown', function(e){ if (e.key!=='Escape') return; if (sv.D.escape({edge:sv.selEdge, selected:sv.selected})==='clear') clearSelection(sv); else goUp(sv); });
  stage.addEventListener('click', function(e){ if (sv.moved) return; var onEmpty=e.target===sv.svg || (e.target.tagName==='rect' && !e.target.closest('.card')); if (onEmpty) clearSelection(sv); });
  if (!stage.hasAttribute('tabindex')) stage.setAttribute('tabindex', '-1');
}
