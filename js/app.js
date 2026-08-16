(function(){
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return [].slice.call((c||document).querySelectorAll(s))};
  var days=$$('.day'), legs=$$('.leg'), nav=$('#navrow');
  var justDragged=false; /* מונע פתיחה/סגירה בטעות של פריט מיד אחרי החלקה (swipe) */

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

  /* פריט בונוס חוזר להסתתר כשמפסיקים לסנן/לפתוח הכל — אלא אם ה"עוד אפשרויות" של
     היום שלו פתוח בפועל. בלי זה, פריט בונוס שנחשף ע"י חיפוש/פתח-הכל נשאר גלוי לצמיתות. */
  function restoreBonusVisibility(it){
    if(!it.classList.contains('bonus')) return;
    var day=it.closest('.day');
    var moreBtn=day && day.querySelector('.morebtn');
    it.classList.toggle('hidebonus', !(moreBtn && moreBtn.classList.contains('on')));
  }

  /* item expand */
  document.addEventListener('click',function(e){
    var r=e.target.closest('.row');
    if(r){
      if(justDragged){ return; }
      var it=r.closest('.item'), o=it.classList.toggle('open');
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
    $$('.fc',sec).forEach(function(x){ x.setAttribute('aria-pressed', x.classList.contains('on')?'true':'false'); });
    bars.forEach(function(bar){
      bar.addEventListener('click',function(e){
        var b=e.target.closest('.fc'); if(!b)return;
        var dim=b.dataset.dim;
        $$('.fc[data-dim="'+dim+'"]',sec).forEach(function(x){ x.classList.remove('on'); x.setAttribute('aria-pressed','false'); });
        b.classList.add('on'); b.setAttribute('aria-pressed','true');
        st[dim]=b.dataset.v;
        run();
      });
    });
    run();
  }
  cardFilter('eats','enone','ecount','מקומות');
  cardFilter('backup','bnone','bcount','אפשרויות');

  /* day collapse */
  function toggleDay(topEl){
    var day=topEl.parentElement;
    day.classList.toggle('shut');
    topEl.setAttribute('aria-expanded', day.classList.contains('shut') ? 'false' : 'true');
  }
  $$('.daytop').forEach(function(t){
    t.setAttribute('aria-expanded', t.parentElement.classList.contains('shut') ? 'false' : 'true');
    t.addEventListener('click',function(e){ if(!e.target.closest('a,button')) toggleDay(t); });
    t.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault(); toggleDay(t);}
    });
  });

  /* כרטיס הטיסה היה נגיש רק לעכבר/מגע — בלי tabindex/role אי אפשר בכלל להגיע אליו
     או לפתוח אותו במקלדת/קורא מסך */
  var fh=$('.fly-h');
  if(fh){
    fh.setAttribute('tabindex','0');
    fh.setAttribute('role','button');
    fh.setAttribute('aria-expanded', $('.fly').classList.contains('shut') ? 'false' : 'true');
    function toggleFly(){
      var open=$('.fly').classList.toggle('shut')===false;
      fh.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    fh.addEventListener('click',function(e){ if(!e.target.closest('a,button')) toggleFly(); });
    fh.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault(); toggleFly();}
    });
  }

  /* nav */
  function goToSection(go){
    if(go==='all'){window.scrollTo({top:0,behavior:'smooth'});return;}
    var el=document.getElementById(go);
    if(el){ el.classList.remove('shut'); setTimeout(function(){el.scrollIntoView({block:'start'})},60); }
  }
  nav.addEventListener('click',function(e){
    var b=e.target.closest('.pill'); if(!b)return;
    $$('.pill',nav).forEach(function(p){p.classList.remove('on')});
    b.classList.add('on');
    goToSection(b.dataset.go);
  });

  /* filters */
  var fr=$('#filterrow'), srch=$('#srch'), cnt=$('#cnt'), empty=$('#empty');
  var cat='all', onlyAnchor=false, q='';
  function apply(){
    /* שאילתה חיה בכל הרצה (לא צילום שנלקח פעם אחת בטעינה) — כך שפריטים שהקבוצה
       מוסיפה בזמן אמת (js/shared.js) גם הם מסוננים/נמצאים נכון, לא רק פריטי המסלול
       שהיו קיימים כשהדף נטען. */
    var items=$$('.item');
    var shown=0, filtering=(cat!=='all'||onlyAnchor||q);
    items.forEach(function(it){
      var txt=it._txt||(it.textContent||'').toLowerCase();
      var ok=((cat==='all')||(it.dataset.k===cat))
           && (!onlyAnchor||it.classList.contains('anchor'))
           && (!q||txt.indexOf(q)>-1);
      it.classList.toggle('hide',!ok);
      if(ok){
        shown++;
        if(filtering) it.classList.remove('hidebonus');
        else restoreBonusVisibility(it);
      }
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
  $$('.chip',fr).forEach(function(c){ c.setAttribute('aria-pressed', c.classList.contains('on')?'true':'false'); });
  fr.addEventListener('click',function(e){
    var c=e.target.closest('.chip'); if(!c)return;
    if(c.dataset.k==='anchor'){
      onlyAnchor=!onlyAnchor; c.classList.toggle('on',onlyAnchor);
      c.setAttribute('aria-pressed', onlyAnchor?'true':'false');
    } else {
      cat=c.dataset.k;
      $$('.chip:not(.anchor)',fr).forEach(function(x){ x.classList.remove('on'); x.setAttribute('aria-pressed','false'); });
      c.classList.add('on'); c.setAttribute('aria-pressed','true');
    }
    apply();
  });
  var tmr;
  srch.addEventListener('input',function(){
    clearTimeout(tmr);
    tmr=setTimeout(function(){ q=srch.value.trim().toLowerCase(); apply(); },140);
  });

  /* checklist */
  /* המפתח בכוונה *לא* תלוי במספר הגרסה — קודם היה cb2026.v19, כלומר כל עדכון גרסה
     היה מוחק בשקט את כל הסימונים המקומיים (בעיקר רשימת האריזה, שנשארת מקומית בכוונה). */
  var boxes=$$('.task input'), KEY='cb2026';
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
    $$('.item').forEach(function(i){
      i.classList.toggle('open',allOpen);
      if(allOpen) i.classList.remove('hidebonus');
      else restoreBonusVisibility(i);
    });
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
      var dt=$('.daytop',d); if(dt) dt.setAttribute('aria-expanded','true');
      var p=$$('.pill',nav)[i+1]; if(p)p.classList.add('now');
      setTimeout(function(){ d.scrollIntoView({block:'start'}) },400);
    }
  });

  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(en){
      en.forEach(function(x){
        if(!x.isIntersecting)return;
        $$('.pill',nav).forEach(function(p){ p.classList.toggle('on',p.dataset.go===x.target.id) });
        $$('.tlchip').forEach(function(c){ c.classList.toggle('on',c.dataset.go===x.target.id) });
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

  /* מעטפת אופליין בסיסית — לא נוגע בנתונים החיים (Supabase), רק שהדף עצמו יעלה גם בלי כיסוי */
  if('serviceWorker' in navigator){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }

  /* ---- עוד כמה ימים לטיול / ימים שעברו ---- */
  (function(){
    var el=$('#countdown'); if(!el) return;
    var start=new Date('2026-08-26T00:00:00'), end=new Date('2026-09-02T00:00:00');
    var now=new Date();
    var msPerDay=86400000;
    if(now < start){
      var n=Math.ceil((start-now)/msPerDay);
      el.innerHTML = '<span>✈️</span><span>עוד <b>'+n+'</b> '+(n===1?'יום':'ימים')+' לטיול!</span>';
    } else if(now >= start && now < end){
      var dayNum=Math.min(7, Math.floor((now-start)/msPerDay)+1);
      el.innerHTML = '<span>🌊</span><span>הטיול בעיצומו — <b>יום '+dayNum+'</b> מתוך 7</span>';
    } else {
      el.innerHTML = '<span>🧡</span><span>הטיול הסתיים — מקווים שהיה מדהים</span>';
    }
    days.forEach(function(d){
      var dd=d.dataset.date; if(!dd) return;
      if(new Date(dd+'T23:59:59') < now && !d.classList.contains('today')) d.classList.add('past');
    });
  })();

  /* ---- רצועת "המסלול במבט אחד" ---- */
  (function(){
    var host=$('#tlstrip'); if(!host || !days.length) return;
    days.forEach(function(d){
      var num=$('.dnum',d), h3=$('h3',d), gist=$('.gist span',d);
      if(!num || !h3) return;
      var dateParts=(d.dataset.date||'').split('-'); // ["2026","08","26"]
      var shortDate = dateParts.length===3 ? (+dateParts[2])+'.'+(+dateParts[1]) : '';
      var tag = d.style.getPropertyValue('--tag') || 'var(--sea)';
      var chip=document.createElement('button');
      chip.type='button';
      chip.className='tlchip'+(d.classList.contains('today')?' today':'')+(d.classList.contains('past')?' past':'');
      chip.dataset.go=d.id;
      chip.style.setProperty('--tag', tag);
      var numEl=document.createElement('span'); numEl.className='tlnum'; numEl.textContent=num.textContent;
      var dateEl=document.createElement('span'); dateEl.className='tldate'; dateEl.textContent=shortDate;
      var lblEl=document.createElement('span'); lblEl.className='tllbl'; lblEl.textContent=gist?gist.textContent:h3.textContent;
      chip.appendChild(numEl); chip.appendChild(dateEl); chip.appendChild(lblEl);
      host.appendChild(chip);
    });
    host.addEventListener('click',function(e){
      var b=e.target.closest('.tlchip'); if(!b) return;
      $$('.pill',nav).forEach(function(p){ p.classList.toggle('on', p.dataset.go===b.dataset.go); });
      goToSection(b.dataset.go);
    });
  })();

  /* ---- מזהה יציב לכל בולט במסלול המקורי + כפתור עריכה בהחלקה/hover, לטובת js/shared.js (עריכה חיה) ---- */
  (function(){
    days.forEach(function(d){
      var items=$$('.item',d).filter(function(it){ return !it.classList.contains('group'); });
      items.forEach(function(it,i){
        it.dataset.eid = d.id+'-'+i;
        var row=$('.row',it);
        if(!row || row.parentElement.classList.contains('swiperow')) return;
        var wrap=document.createElement('div');
        wrap.className='swiperow';
        wrap.style.setProperty('--reveal','58px');
        row.parentNode.insertBefore(wrap,row);
        var actions=document.createElement('div');
        actions.className='swipeactions';
        var b=document.createElement('button');
        b.type='button'; b.className='edrow sa-edit'; b.dataset.editfor=it.dataset.eid;
        b.innerHTML='<svg class="i"><use href="#i-edit"/></svg><span>עריכה</span>';
        actions.appendChild(b);
        wrap.appendChild(actions);
        wrap.appendChild(row);
      });
    });
  })();

  /* ---- מנוע החלקה/hover גנרי לחשיפת עריכה+מחיקה (עובד גם על פריטי קבוצה שמתווספים דינמית) ---- */
  (function(){
    var current=null, openWrap=null;

    function closeWrap(el){
      if(!el) return;
      el.classList.remove('open');
      $('.row',el).style.transform='';
      if(openWrap===el) openWrap=null;
    }
    function closeAllExcept(except){
      $$('.swiperow.open').forEach(function(el){ if(el!==except) closeWrap(el); });
    }

    document.addEventListener('pointerdown',function(e){
      var target=e.target;
      /* ה-FAB הצף (position:fixed) יכול לשבת פיזית מעל שורה בת-החלקה, בפינה
         השמאלית-תחתונה הקבועה שלו. אם יש שורה כזו ממש מתחתיו באותה נקודה,
         מעדיפים להתחיל החלקה על השורה במקום ללחוץ על ה-FAB. */
      if(target.id==='gfab'){
        var stack=document.elementsFromPoint(e.clientX,e.clientY);
        var under=stack.filter(function(el){ return el.classList && el.classList.contains('swiperow'); })[0];
        if(!under) return;
        target=under;
      }
      if(target.closest('.swipeactions')){
        setTimeout(function(){ closeAllExcept(null); },150);
        return;
      }
      var wrap=target.closest('.swiperow');
      if(!wrap){ closeAllExcept(null); return; }
      var row=$('.row',wrap);
      var reveal=parseInt(getComputedStyle(wrap).getPropertyValue('--reveal'))||58;
      current={wrap:wrap,row:row,startX:e.clientX,startY:e.clientY,dragging:false,reveal:reveal,pointerId:e.pointerId,base:wrap.classList.contains('open')?reveal:0};
    });

    document.addEventListener('pointermove',function(e){
      if(!current||e.pointerId!==current.pointerId) return;
      var dx=e.clientX-current.startX, dy=e.clientY-current.startY;
      if(!current.dragging){
        if(Math.abs(dx)>8 && Math.abs(dx)>Math.abs(dy)){
          current.dragging=true;
          current.wrap.classList.add('dragging');
        } else if(Math.abs(dy)>8){ current=null; return; }
        else return;
      }
      var pos=Math.max(0,Math.min(current.reveal,current.base+dx));
      current.pos=pos;
      current.row.style.transform='translateX('+pos+'px)';
    });

    function endDrag(e){
      if(!current) return;
      if(current.dragging){
        var openIt=(current.pos||0) > current.reveal*0.4;
        current.row.style.transform=openIt?'translateX('+current.reveal+'px)':'';
        current.wrap.classList.toggle('open',openIt);
        current.wrap.classList.remove('dragging');
        if(openIt){ closeAllExcept(current.wrap); openWrap=current.wrap; }
        justDragged=true;
        setTimeout(function(){ justDragged=false; },50);
      }
      current=null;
    }
    document.addEventListener('pointerup',endDrag);
    document.addEventListener('pointercancel',endDrag);
  })();

  /* ---- צ'קבוקס "הזמנו מקום" + הצבעת "רוצים לנסות" על כל מסעדה ברשימה הראשית ---- */
  (function(){
    var sec=document.getElementById('eats'); if(!sec) return;
    function slug(s){
      return (s||'').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'x';
    }
    $$('.eat',sec).forEach(function(card){
      var name=$('.ename',card); if(!name) return;
      var key='r_'+slug(name.textContent);
      var body=$('.ebody',card); if(!body || $('.rsvbar',body)) return;
      var bar=document.createElement('div');
      bar.className='rsvbar';
      bar.innerHTML =
        '<div class="task"><input type="checkbox" id="'+key+'"><label for="'+key+'"><strong>הזמנו מקום ✓</strong></label></div>'+
        '<button type="button" class="votebtn" data-rkey="'+slug(name.textContent)+'"><span class="vh">🤍</span><span class="vc">0</span></button>';
      body.appendChild(bar);
    });
  })();
})();
