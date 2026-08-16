(function(){
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return [].slice.call((c||document).querySelectorAll(s))};
  var days=$$('.day'), items=$$('.item'), legs=$$('.leg'), nav=$('#navrow');

  /* bonus toggle per day */
  days.forEach(function(d){
    var bonus=$$('.item.bonus',d);
    if(!bonus.length) return;
    bonus.forEach(function(b){ b.classList.add('hidebonus') });
    var btn=document.createElement('button');
    btn.className='morebtn'; btn.type='button';
    btn.innerHTML='<svg class="i"><use href="#i-chev"/></svg><span>עוד '+bonus.length+' אפשרויות ליום הזה</span>';
    btn.addEventListener('click',function(){
      var on=btn.classList.toggle('on');
      bonus.forEach(function(b){ b.classList.toggle('hidebonus',!on) });
      btn.querySelector('span').textContent = on ? 'הסתר אפשרויות נוספות' : 'עוד '+bonus.length+' אפשרויות ליום הזה';
    });
    $('.dbody',d).appendChild(btn);
  });

  /* item expand */
  document.addEventListener('click',function(e){
    var r=e.target.closest('.row');
    if(r){
      var it=r.parentElement, o=it.classList.toggle('open');
      r.setAttribute('aria-expanded',o);
      if(!o){ /* reset tabs when the item is closed */
        $$('.dr',it).forEach(function(x){x.classList.remove('open')});
        $$('.ib[data-t]',it).forEach(function(x){x.classList.remove('on');x.setAttribute('aria-expanded','false')});
      }
      return;
    }
    var b=e.target.closest('.ib[data-t]');
    if(b){
      e.preventDefault();
      var d=document.getElementById(b.dataset.t); if(!d) return;
      var wrap=b.closest('.wt')||b.closest('.ebody')||b.closest('.fly')||document;
      var willOpen=!d.classList.contains('open');
      $$('.dr',wrap).forEach(function(x){x.classList.remove('open')});
      $$('.ib[data-t]',wrap).forEach(function(x){x.classList.remove('on');x.setAttribute('aria-expanded','false')});
      if(willOpen){ d.classList.add('open'); b.classList.add('on'); b.setAttribute('aria-expanded','true'); }
    }
  });


  /* ---- card expand + card filters ---- */
  document.addEventListener('click',function(e){
    var er=e.target.closest('.erow');
    if(er){ var c=er.parentElement; var o=c.classList.toggle('open'); er.setAttribute('aria-expanded',o); }
  });

  function cardFilter(sectionId,noneId,countId,noun){
    var sec=document.getElementById(sectionId); if(!sec)return;
    var cards=$$('.eat',sec), bars=$$('.fbar',sec);
    var none=document.getElementById(noneId), cnt2=document.getElementById(countId);
    var st={loc:'all',style:'all'};
    function run(){
      var n=0;
      cards.forEach(function(c){
        var okL = st.loc==='all' || c.dataset.loc===st.loc;
        var okS = st.style==='all' || (st.style==='pick' ? c.classList.contains('pick') : c.dataset.style===st.style);
        var ok=okL&&okS;
        c.classList.toggle('hide',!ok);
        if(ok)n++;
      });
      if(cnt2) cnt2.textContent = (st.loc==='all'&&st.style==='all') ? cards.length+' '+noun : n+' מתוך '+cards.length;
      if(none) none.classList.toggle('show',n===0);
    }
    bars.forEach(function(bar){
      bar.addEventListener('click',function(e){
        var b=e.target.closest('.fc'); if(!b)return;
        var dim=b.dataset.dim;
        $$('.fc[data-dim="'+dim+'"]',sec).forEach(function(x){x.classList.remove('on')});
        b.classList.add('on');
        st[dim]=b.dataset.v;
        run();
      });
    });
    run();
  }
  cardFilter('eats','enone','ecount','מקומות');
  cardFilter('backup','bnone','bcount','אפשרויות');

  /* day collapse */
  $$('.daytop').forEach(function(t){
    t.addEventListener('click',function(e){ if(!e.target.closest('a,button')) t.parentElement.classList.toggle('shut'); });
    t.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();t.parentElement.classList.toggle('shut');}
    });
  });
  var fh=$('.fly-h');
  if(fh) fh.addEventListener('click',function(e){ if(!e.target.closest('a,button')) $('.fly').classList.toggle('shut'); });

  /* nav */
  nav.addEventListener('click',function(e){
    var b=e.target.closest('.pill'); if(!b)return;
    $$('.pill',nav).forEach(function(p){p.classList.remove('on')});
    b.classList.add('on');
    var go=b.dataset.go;
    if(go==='all'){window.scrollTo({top:0,behavior:'smooth'});return;}
    var el=document.getElementById(go);
    if(el){ el.classList.remove('shut'); setTimeout(function(){el.scrollIntoView({block:'start'})},60); }
  });

  /* filters */
  var fr=$('#filterrow'), srch=$('#srch'), cnt=$('#cnt'), empty=$('#empty');
  var cat='all', onlyAnchor=false, q='';
  items.forEach(function(it){ it._txt=(it.textContent||'').toLowerCase(); });
  function apply(){
    var shown=0, filtering=(cat!=='all'||onlyAnchor||q);
    items.forEach(function(it){
      var ok=((cat==='all')||(it.dataset.k===cat))
           && (!onlyAnchor||it.classList.contains('anchor'))
           && (!q||it._txt.indexOf(q)>-1);
      it.classList.toggle('hide',!ok);
      if(ok){ shown++; if(filtering) it.classList.remove('hidebonus'); }
    });
    legs.forEach(function(l){ l.style.display=filtering?'none':''; });
    $$('.morebtn').forEach(function(b){ b.style.display=filtering?'none':''; });
    $$('.gist').forEach(function(g){ g.style.display=filtering?'none':''; });
    days.forEach(function(d){
      var any=$$('.item:not(.hide)',d).length;
      d.style.display=any?'':'none';
      if(filtering&&any) d.classList.remove('shut');
    });
    cnt.textContent=filtering?shown+' פריטים':'';
    empty.classList.toggle('show',shown===0);
  }
  fr.addEventListener('click',function(e){
    var c=e.target.closest('.chip'); if(!c)return;
    if(c.dataset.k==='anchor'){ onlyAnchor=!onlyAnchor; c.classList.toggle('on',onlyAnchor); }
    else{ cat=c.dataset.k; $$('.chip:not(.anchor)',fr).forEach(function(x){x.classList.remove('on')}); c.classList.add('on'); }
    apply();
  });
  var tmr;
  srch.addEventListener('input',function(){
    clearTimeout(tmr);
    tmr=setTimeout(function(){ q=srch.value.trim().toLowerCase(); apply(); },140);
  });

  /* checklist */
  var boxes=$$('.task input'), KEY='cb2026.v19';
  var pbar=$('#pbar'), pnum=$('#pnum'), ptxt=$('#ptxt');
  var mem={}, hasLS=false;
  try{ localStorage.setItem('__t','1'); localStorage.removeItem('__t'); hasLS=true; }catch(e){}
  function load(){ if(!hasLS)return mem; try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}} }
  function save(o){ if(!hasLS){mem=o;return;} try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){} }
  var bookBoxes=boxes.filter(function(b){return /^t\d+$/.test(b.id)});
  function refresh(){
    var done=bookBoxes.filter(function(b){return b.checked}).length;
    var pct=Math.round(done/bookBoxes.length*100);
    pbar.style.width=pct+'%'; pnum.textContent=done+'/'+bookBoxes.length;
    ptxt.textContent = done===0?'מסמנים תוך כדי' : done===bookBoxes.length?'הכל סגור' : pct+'% הושלם';
  }
  var st=load();
  boxes.forEach(function(b){
    if(st[b.id]){ b.checked=true; b.closest('.task').classList.add('done'); }
    b.addEventListener('change',function(){
      b.closest('.task').classList.toggle('done',b.checked);
      var s=load(); s[b.id]=b.checked; save(s); refresh();
    });
  });
  refresh();
  $('#rst').addEventListener('click',function(){
    save({}); boxes.forEach(function(b){ b.checked=false; b.closest('.task').classList.remove('done'); }); refresh();
  });

  /* expand all */
  var allOpen=false;
  $('#expand').addEventListener('click',function(){
    allOpen=!allOpen;
    days.forEach(function(d){ d.classList.toggle('shut',!allOpen) });
    items.forEach(function(i){ i.classList.toggle('open',allOpen); if(allOpen) i.classList.remove('hidebonus'); });
    $$('.wt,.ebody,.fly').forEach(function(w){
      var first=w.querySelector(':scope > .dr, .dr');
      $$('.dr',w).forEach(function(d){ d.classList.toggle('open', allOpen && d===first) });
      $$('.ib[data-t]',w).forEach(function(b){ b.classList.toggle('on', allOpen && document.getElementById(b.dataset.t)===first) });
    });
    $$('.eat').forEach(function(c){ c.classList.toggle('open',allOpen) });
    $$('.ib[data-t]').forEach(function(b){ b.classList.toggle('on',allOpen) });
    this.textContent = allOpen?'סגור הכל':'פתח הכל';
  });

  /* today */
  var t=new Date(), iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
  days.forEach(function(d,i){
    if(d.dataset.date===iso){
      d.classList.add('today'); d.classList.remove('shut');
      var p=$$('.pill',nav)[i+1]; if(p)p.classList.add('now');
      setTimeout(function(){ d.scrollIntoView({block:'start'}) },400);
    }
  });

  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(en){
      en.forEach(function(x){
        if(!x.isIntersecting)return;
        $$('.pill',nav).forEach(function(p){ p.classList.toggle('on',p.dataset.go===x.target.id) });
      });
    },{rootMargin:'-160px 0px -65% 0px'});
    days.forEach(function(d){io.observe(d)});
  }

  /* ---- auto update check ---- */
  (function(){
    var meta=document.querySelector('meta[name="app-version"]');
    if(!meta||!window.fetch) return;
    var cur=meta.content, bar=document.getElementById('upd'), dismissed=false;
    document.getElementById('updX').addEventListener('click',function(){ dismissed=true; bar.classList.remove('show'); });
    document.getElementById('updGo').addEventListener('click',function(){
      location.replace(location.pathname+'?v='+Date.now());
    });
    function check(){
      if(dismissed||document.hidden) return;
      fetch(location.pathname+'?_='+Date.now(),{cache:'no-store'})
        .then(function(r){ return r.ok?r.text():null })
        .then(function(t){
          if(!t) return;
          var m=t.match(/name="app-version" content="(\d+)"/);
          if(m && m[1]!==cur) bar.classList.add('show');
        }).catch(function(){});
    }
    setTimeout(check,8000);
    setInterval(check,300000);
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) check(); });
  })();
})();
