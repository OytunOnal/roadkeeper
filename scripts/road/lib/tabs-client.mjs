// @level presentation
// Roadkeeper — The Road's tabs' client: the tabs, the fold, and the address it writes. The page embeds each function here
// by its own source (road-html.mjs), in one scope with the road client's (road-client.mjs), whose functions decide for
// it; it imports nothing.

// The tabs and the fold, `ids` the page's tabs in order. `tabs` holds the ids, the nav and the tab open now.
export function tabsClient(ids) {
  document.documentElement.lang='en';
  var tabs = { ids: ids, nav: document.querySelector('nav.tabs'), current: null };
  // a step through history fires popstate, and hashchange too when the hash changes: the tab switches once
  function step(){ stepThroughHistory(tabs); }
  window.addEventListener('popstate', step);
  window.addEventListener('hashchange', step);
  tabs.nav.addEventListener('click', function(ev){ switchOnClick(tabs, ev); });
  showTab(tabs, pickTab(tabs));
  markHistoryStepAndAddress(tabs);
  document.addEventListener('click', toggleMore);
  var groups = document.querySelectorAll('details.group');
  for (var i=0;i<groups.length;i++) restoreGroup(groups[i]);
}

export function storeChoice(key, value){try{localStorage.setItem(key, value)}catch{}}

export function loadChoice(key){try{return localStorage.getItem(key)}catch{return null}}

// Opens the tab `id`, stores it and says so.
export function showTab(tabs, id){
  var ids = tabs.ids;
  for (var i=0;i<ids.length;i++){
    var s=document.getElementById('tab-'+ids[i]); if(s) s.className='tab'+(ids[i]===id?' on':'');
    var a=tabs.nav.querySelector('a[href="#'+ids[i]+'"]'); if(a){ if(ids[i]===id) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); }
  }
  storeChoice('road-tab', id);
  tabs.current=id;
  // what draws only when visible (the diagrams, the structure) listens for this
  try { document.dispatchEvent(new CustomEvent('road:tab', {detail: id})); } catch {}
}

// something hidden came into view in the open tab: an issue's detail, a group; the diagrams listen for this
export function announceShown(){
  try { document.dispatchEvent(new CustomEvent('road:shown')); } catch {}
}

export function pickTab(tabs){
  return landOn(location.hash, tabs.ids) || whichTabOpens({ open: tabs.current, opens: tabs.nav.getAttribute('data-opens'), stored: loadChoice('road-tab') }, tabs.ids);
}

// a history step carries its tab in its state; where history is refused (the artifact viewer), none
export function historyState(){try{return history.state}catch{return null}}

export function stepThroughHistory(tabs){
  var id=whichTabHistoryOpens(historyState(), location.hash, tabs.ids) || pickTab(tabs);
  if (id!==tabs.current) showTab(tabs, id);
  markHistoryStepAndAddress(tabs);
}

// the history step shown carries its tab, adding no step; an address landing on no tab is replaced by the shown tab's,
// any other stays as it was; where history is refused (the artifact viewer), nothing changes
export function markHistoryStepAndAddress(tabs){
  var to=addressToWrite(location.hash, tabs.current, tabs.ids);
  try { if (to) history.replaceState({tab: tabs.current}, '', to); else history.replaceState({tab: tabs.current}, ''); } catch {}
}

// a click switches the tab itself: on a host that swallows fragment navigation (the artifact viewer) the
// hashchange never comes
export function switchOnClick(tabs, ev){
  var a=ev.target.closest ? ev.target.closest('a') : null;
  var id=a ? landOn(a.getAttribute('href'), tabs.ids) : null;
  if (!id) return;
  if (id===tabs.current) { ev.preventDefault(); return; }
  showTab(tabs, id);
  try { history.pushState({tab: id}, '', '#'+id); ev.preventDefault(); } catch {}
}

// "more" opens or closes its issue's detail; its name, "more about #N", follows its visible word
export function toggleMore(ev){
  var b=ev.target;
  if (!b || b.tagName!=='BUTTON') return;
  if (b.classList.contains('more')){
    var li=b.closest('li.slice'); if(!li) return;
    var open=li.classList.toggle('open');
    b.textContent=open?'less':'more'; b.setAttribute('aria-expanded', open?'true':'false');
    var name=b.getAttribute('aria-label'); if(name) b.setAttribute('aria-label', name.replace(/^(more|less)/, b.textContent));
    if (open) announceShown(); else backToHead(li);
  }
}

// a card closed by "less": its head, when above the window, back at the window's top
export function backToHead(li){
  var head=li.querySelector('.heading'); if(!head) return;
  var y=lessScrollTop(head.getBoundingClientRect().top, window.scrollY);
  if (y!==null) window.scrollTo(0, y);
}

// a group opens as last chosen, and keeps the choice
export function restoreGroup(group){
  var key='road-group-'+group.id;
  group.open=isGroupOpen(loadChoice(key), group.open);
  group.addEventListener('toggle', function(){ storeChoice(key, group.open?'open':'closed'); if (group.open) announceShown(); });
}
