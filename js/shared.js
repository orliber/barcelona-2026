import { supabaseConfig } from './supabase-config.js';

var SUPABASE_SDK = 'https://esm.sh/@supabase/supabase-js@2';
var NAME_KEY = 'bcn26_name';

var DAYS = [
  { id: 'd1', date: '2026-08-26', label: 'יום 1 · 26 באוג׳ · נחיתה' },
  { id: 'd2', date: '2026-08-27', label: 'יום 2 · 27 באוג׳ · גאודי והמשחק' },
  { id: 'd3', date: '2026-08-28', label: 'יום 3 · 28 באוג׳ · נסיעה ליורט' },
  { id: 'd4', date: '2026-08-29', label: 'יום 4 · 29 באוג׳ · יום המים' },
  { id: 'd5', date: '2026-08-30', label: 'יום 5 · 30 באוג׳ · קיאקים לבגור' },
  { id: 'd6', date: '2026-08-31', label: 'יום 6 · 31 באוג׳ · סאפ וסה טונה' },
  { id: 'd7', date: '2026-09-01', label: 'יום 7 · 1 בספט׳ · אאוטלט וחזרה' },
  { id: 'general', date: '', label: 'כללי (לא קשור ליום ספציפי)' }
];

var TYPES = [
  { id: 'hotel', icon: '🏨', label: 'מלון' },
  { id: 'transport', icon: '🚐', label: 'רכב / ואן' },
  { id: 'tickets', icon: '🎫', label: 'כרטיסים' },
  { id: 'activity', icon: '📍', label: 'פעילות' },
  { id: 'note', icon: '📝', label: 'הערה' }
];

var TYPE_SPRITE = {
  hotel: 's-hotel',
  transport: 'i-car',
  tickets: 'i-ticket',
  activity: 'i-walk',
  note: 'i-info'
};

function dayLabel(id){
  var d = DAYS.filter(function(x){ return x.id===id; })[0];
  return d ? d.label : id;
}

var DAY_IDS = DAYS.filter(function(d){ return d.id !== 'general'; }).map(function(d){ return d.id; });

/* יום בודד -> [יום]. טווח (יום -> dayEnd, למשל מלון עם כמה לילות) -> כל הימים בין השניים,
   כדי שהפריט יופיע בכל יום שהוא רלוונטי אליו, לא רק ביום הראשון. */
function dayRange(startId, endId){
  if (!endId || endId === startId || endId === 'general' || startId === 'general') return [startId];
  var si = DAY_IDS.indexOf(startId), ei = DAY_IDS.indexOf(endId);
  if (si === -1 || ei === -1) return [startId];
  if (si > ei){ var tmp = si; si = ei; ei = tmp; }
  return DAY_IDS.slice(si, ei + 1);
}

function dayRangeLabel(day, dayEnd){
  var range = dayRange(day, dayEnd);
  if (range.length <= 1) return dayLabel(day);
  return 'ימים ' + range[0].replace('d','') + '–' + range[range.length-1].replace('d','');
}

function esc(s){
  var d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function isHttpUrl(s){
  if (!s) return false;
  try {
    var u = new URL(s, location.href);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch(e){ return false; }
}

/*
  בכוונה בנוי מאותם קלאסים בדיוק שהמסלול המקורי משתמש בהם (.item/.row/.wt/.ico/.ib) —
  כדי שפריט שהקבוצה מוסיפה יתנהג ויראה בדיוק כמו פריט מסלול אמיתי (כולל פתיחה/סגירה
  בלחיצה, שמופעלת אוטומטית ע"י ה-event delegation הקיים ב-app.js) ולא כמו רכיב נפרד.
*/
function buildItemCard(docSnap){
  var it = docSnap.data();
  var sprite = TYPE_SPRITE[it.type] || TYPE_SPRITE.note;

  var card = document.createElement('div');
  card.className = 'item group';
  card.dataset.sharedGen = '1';

  var row = document.createElement('button');
  row.type = 'button';
  row.className = 'row';
  row.setAttribute('aria-expanded', 'false');
  row.innerHTML =
    '<span class="tm"><i></i></span>' +
    '<span class="th"><svg class="sc"><use href="#' + sprite + '"/></svg></span>' +
    '<span class="ttl"></span>' +
    '<svg class="chev"><use href="#i-chev"/></svg>';
  row.querySelector('.ttl').textContent = it.title || '';
  row.querySelector('.tm i').textContent = it.addedBy || '?';

  var wt = document.createElement('div');
  wt.className = 'wt';

  var what = document.createElement('div');
  what.className = 'what';
  what.textContent = it.details || dayLabel(it.day);
  wt.appendChild(what);

  var ico = document.createElement('div');
  ico.className = 'ico';
  if (it.price){
    var priceEl = document.createElement('span');
    priceEl.className = 'ib';
    priceEl.textContent = it.price;
    ico.appendChild(priceEl);
  }
  if (isHttpUrl(it.link)){
    var a = document.createElement('a');
    a.className = 'ib buy';
    a.href = it.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = '<svg class="i"><use href="#i-globe"/></svg><span>קישור</span>';
    ico.appendChild(a);
  }
  var delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'ib rm';
  delBtn.innerHTML = '<span>✕ הסרה</span>';
  ico.appendChild(delBtn);
  wt.appendChild(ico);

  var who = document.createElement('div');
  who.className = 'gi-who';
  who.textContent = 'נוסף ע״י ' + (it.addedBy || 'מישהו מהקבוצה') + ' · ' + dayRangeLabel(it.day, it.dayEnd);
  wt.appendChild(who);

  card.appendChild(row);
  card.appendChild(wt);

  return { card: card, delBtn: delBtn };
}

function clearGenerated(){
  Array.prototype.slice.call(document.querySelectorAll('[data-shared-gen="1"]')).forEach(function(el){
    el.remove();
  });
}

function render(docs, onDelete){
  clearGenerated();

  var groupList = document.getElementById('groupList');
  var groupEmpty = document.getElementById('groupEmpty');
  var gcount = document.getElementById('gcount');

  if (gcount) gcount.textContent = docs.length ? (docs.length + ' פריטים') : '';
  if (groupEmpty) groupEmpty.style.display = docs.length ? 'none' : '';

  function wireDelete(built, docSnap){
    built.delBtn.addEventListener('click', function(e){
      e.stopPropagation();
      if (confirm('להסיר את "' + docSnap.data().title + '"?')) onDelete(docSnap.id);
    });
  }

  var byDay = {};
  docs.forEach(function(docSnap){
    if (groupList){
      var built = buildItemCard(docSnap);
      wireDelete(built, docSnap);
      groupList.appendChild(built.card);
    }
    var it = docSnap.data();
    if (it.day && it.day !== 'general'){
      dayRange(it.day, it.dayEnd).forEach(function(d){
        byDay[d] = byDay[d] || [];
        byDay[d].push(docSnap);
      });
    }
  });

  Object.keys(byDay).forEach(function(dayId){
    var dbody = document.querySelector('#' + dayId + ' .dbody');
    if (!dbody) return;
    byDay[dayId].forEach(function(docSnap){
      var built = buildItemCard(docSnap);
      wireDelete(built, docSnap);
      dbody.appendChild(built.card);
    });
  });
}

/*
  זרימת הוספה: העלאת תמונה/PDF היא הדרך הראשית — ה-AI מזהה סוג/יום/מחיר לבד מהמסמך.
  מילוי ידני (בלי קובץ) מוגבל בכוונה לפעילות/הערה בלבד — אלה הדברים שבדרך כלל אין
  עליהם מסמך אמיתי (למלון/תחבורה/כרטיסים יש כמעט תמיד אישור הזמנה, אז עדיף להעלות אותו).
*/
function buildModal(onSubmit, onExtract){
  var bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = 'gmodalBg';

  var dayOptions = DAYS.map(function(d){
    return '<option value="' + d.id + '">' + esc(d.label) + '</option>';
  }).join('');

  var uploadHtml = onExtract
    ? '<div class="field"><label>העלאת תמונה או PDF של ההזמנה</label>' +
      '<input type="file" id="gfileInput" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf">' +
      '<div id="gfileStatus" class="gfilestatus">ה-AI יזהה לבד את הסוג, היום, ופרטי המחיר.</div></div>' +
      '<button type="button" class="linkbtn" id="gManualToggle">אין קובץ? הוספה ידנית של פעילות או הערה בלבד</button>'
    : '';

  bg.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-label="הוספת הזמנה">' +
      '<h3>הוספת הזמנה</h3>' +
      uploadHtml +
      '<div id="gfields" style="display:' + (onExtract ? 'none' : 'block') + '">' +
        '<div class="field"><label>סוג</label><div class="typegrid" id="gtype"></div></div>' +
        '<div class="field"><label>כותרת</label><input id="gtitle" maxlength="120" placeholder="למשל: מלון Petit Palace Museum"></div>' +
        '<div class="field"><label>יום</label><select id="gday">' + dayOptions + '</select></div>' +
        '<div class="field"><label>פרטים (תאריכים, שעות, כמות...)</label><textarea id="gdetails" maxlength="240" placeholder="למשל: 26–28.8, צ׳ק-אין 15:00"></textarea></div>' +
        '<div class="field"><label>מחיר (לא חובה)</label><input id="gprice" maxlength="40" placeholder="למשל: €240"></div>' +
        '<div class="field"><label>קישור (לא חובה)</label><input id="glink" maxlength="500" placeholder="https://..."></div>' +
      '</div>' +
      '<div class="field"><label>השם שלכם (חובה)</label><input id="gname" maxlength="40" placeholder="איך שתרצו שיראו אתכם"></div>' +
      '<div class="gerr" id="gerr"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn-cancel" id="gcancel">ביטול</button>' +
        '<button type="button" class="btn-save" id="gsave">הוספה</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(bg);

  var selectedType = TYPES[0].id;
  var typegrid = bg.querySelector('#gtype');
  function renderTypeButtons(list, selected){
    selectedType = selected || list[0].id;
    typegrid.innerHTML = list.map(function(t){
      return '<button type="button" class="typebtn' + (t.id === selectedType ? ' on' : '') + '" data-type="' + t.id + '">' +
        '<span>' + t.icon + '</span>' + t.label + '</button>';
    }).join('');
    typegrid.querySelectorAll('.typebtn').forEach(function(btn){
      btn.addEventListener('click', function(){
        typegrid.querySelectorAll('.typebtn').forEach(function(b){ b.classList.remove('on'); });
        btn.classList.add('on');
        selectedType = btn.dataset.type;
      });
    });
  }

  var MANUAL_TYPES = TYPES.filter(function(t){ return t.id === 'activity' || t.id === 'note'; });
  if (!onExtract) renderTypeButtons(TYPES, TYPES[0].id);

  function close(){ bg.classList.remove('show'); }
  bg.addEventListener('click', function(e){ if (e.target === bg) close(); });
  bg.querySelector('#gcancel').addEventListener('click', close);

  var fieldsWrap = bg.querySelector('#gfields');
  var manualToggle = bg.querySelector('#gManualToggle');
  if (manualToggle){
    manualToggle.addEventListener('click', function(){
      fieldsWrap.style.display = 'block';
      renderTypeButtons(MANUAL_TYPES, MANUAL_TYPES[0].id);
      bg.querySelector('#gtitle').focus();
    });
  }

  var fileInput = bg.querySelector('#gfileInput');
  if (fileInput && onExtract){
    var MAX_FILE_BYTES = 6 * 1024 * 1024;
    fileInput.addEventListener('change', function(){
      var file = fileInput.files[0];
      if (!file) return;
      var statusEl = bg.querySelector('#gfileStatus');
      if (file.size > MAX_FILE_BYTES){
        statusEl.textContent = 'הקובץ גדול מדי (עד 6MB). אפשר להוסיף ידנית פעילות/הערה למעלה.';
        fileInput.value = '';
        return;
      }
      statusEl.textContent = 'קורא את המסמך…';
      var reader = new FileReader();
      reader.onload = function(){
        var base64 = String(reader.result).split(',')[1] || '';
        onExtract({ mediaType: file.type, data: base64 }).then(function(fields){
          statusEl.textContent = 'מולא אוטומטית מהקובץ — אפשר לערוך לפני השמירה.';
          fieldsWrap.style.display = 'block';
          renderTypeButtons(TYPES, fields.type);
          bg.querySelector('#gtitle').value = fields.title || '';
          bg.querySelector('#gday').value = fields.day || 'general';
          bg.querySelector('#gdetails').value = fields.details || '';
          bg.querySelector('#gprice').value = fields.price || '';
        }).catch(function(err){
          statusEl.textContent = 'לא הצלחנו לחלץ מהקובץ הזה. אפשר להוסיף ידנית פעילות/הערה למעלה.';
          console.error(err);
        });
      };
      reader.onerror = function(){ statusEl.textContent = 'שגיאה בקריאת הקובץ.'; };
      reader.readAsDataURL(file);
    });
  }

  var savedName = '';
  try { savedName = localStorage.getItem(NAME_KEY) || ''; } catch(e){}
  bg.querySelector('#gname').value = savedName;

  bg.querySelector('#gsave').addEventListener('click', function(){
    var title = bg.querySelector('#gtitle').value.trim();
    var name = bg.querySelector('#gname').value.trim();
    var errEl = bg.querySelector('#gerr');
    if (!title){
      errEl.textContent = 'צריך למלא כותרת.';
      errEl.classList.add('show');
      return;
    }
    if (!name){
      errEl.textContent = 'צריך למלא מי מוסיף (השם שלכם) — כדי שיהיה ברור לכולם מי הוסיף מה.';
      errEl.classList.add('show');
      return;
    }
    errEl.classList.remove('show');
    try { localStorage.setItem(NAME_KEY, name); } catch(e){}

    var saveBtn = bg.querySelector('#gsave');
    saveBtn.disabled = true; saveBtn.textContent = 'שומר…';

    onSubmit({
      type: selectedType,
      title: title,
      day: bg.querySelector('#gday').value,
      details: bg.querySelector('#gdetails').value.trim(),
      price: bg.querySelector('#gprice').value.trim(),
      link: bg.querySelector('#glink').value.trim(),
      addedBy: name
    }).then(function(){
      saveBtn.disabled = false; saveBtn.textContent = 'הוספה';
      bg.querySelector('#gtitle').value = '';
      bg.querySelector('#gdetails').value = '';
      bg.querySelector('#gprice').value = '';
      bg.querySelector('#glink').value = '';
      close();
    }).catch(function(err){
      saveBtn.disabled = false; saveBtn.textContent = 'הוספה';
      errEl.textContent = 'לא הצלחנו לשמור. נסו שוב עוד רגע.';
      errEl.classList.add('show');
      console.error(err);
    });
  });

  return bg;
}

function mountAddUi(modal){
  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'fab';
  fab.id = 'gfab';
  fab.setAttribute('aria-label', 'הוספת הזמנה');
  fab.textContent = '+';
  document.body.appendChild(fab);

  function openModal(){ modal.classList.add('show'); }
  fab.addEventListener('click', openModal);
  var addBtn = document.getElementById('addBtn');
  if (addBtn) addBtn.addEventListener('click', openModal);
}

/*
  מצב תצוגה מקדימה: פועל רק כשעדיין לא מולא js/supabase-config.js.
  אותה חוויה בדיוק (אותו modal, אותם כרטיסים) אבל הנתונים נשמרים רק בדפדפן הזה —
  לצורך התרשמות לפני שמחברים את Supabase האמיתי. ברגע שיהיה config אמיתי, מסלול הקוד
  הזה כבר לא ירוץ.
*/
function bootDemo(){
  var KEY = 'bcn26_demo_items';
  var items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e){ items = []; }
  var listeners = [];

  function persist(){ try{ localStorage.setItem(KEY, JSON.stringify(items)); } catch(e){} }
  function notify(){
    var snap = items.slice().sort(function(a,b){ return b.createdAt - a.createdAt; }).map(function(it){
      return { id: it.id, data: function(){ return it; } };
    });
    listeners.forEach(function(fn){ fn(snap); });
  }

  listeners.push(function(snap){ render(snap, removeDemoItem); });
  notify();

  function removeDemoItem(id){
    items = items.filter(function(it){ return it.id !== id; });
    persist(); notify();
  }

  function submitDemoItem(data){
    data = { type: data.type, title: data.title, day: data.day, details: data.details,
      price: data.price, link: data.link, addedBy: data.addedBy,
      id: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      createdAt: Date.now() };
    items.push(data);
    persist(); notify();
    return Promise.resolve();
  }

  var groupWrap = document.querySelector('#group .wrap');
  var groupList = document.getElementById('groupList');
  if (groupWrap && groupList){
    var banner = document.createElement('div');
    banner.className = 'note hot';
    banner.style.margin = '0 0 4px';
    banner.innerHTML = '<b>מצב תצוגה מקדימה:</b> מה שמוסיפים כאן נשמר רק בדפדפן הזה, לצורך התרשמות. אחרי חיבור Supabase (ראו js/supabase-config.js) זה יהפוך למשותף באמת לכל מי שיש לו את הקישור, וה-AI יסדר כל תוספת.';
    groupWrap.insertBefore(banner, groupList);
  }

  mountAddUi(buildModal(submitDemoItem));
  console.info('[shared.js] running in local preview mode — fill in js/supabase-config.js to go live for everyone.');
}

function rowToDocSnap(row){
  return {
    id: row.id,
    data: function(){
      return {
        type: row.type,
        title: row.title,
        day: row.day,
        dayEnd: row.day_end,
        details: row.details,
        price: row.price,
        link: row.link,
        addedBy: row.added_by
      };
    }
  };
}

/*
  צ'קליסט "מה להזמין" (t1..t16): במקור נשמר רק ב-localStorage (app.js), כלומר כל מכשיר
  לבד. השכבה הזו מוסיפה סנכרון אמיתי — מי שמסמן, מסומן אצל כולם. app.js ממשיך לרוץ
  בדיוק כפי שהיה (עדיין שומר localStorage כגיבוי אופליין); זו תוספת, לא תחליף.
  רשימת האריזה (p1..p8) בכוונה לא כאן — היא אישית לכל אחד, לא משותפת.
*/
function bootChecklist(supabase){
  var taskIds = Array.prototype.slice.call(document.querySelectorAll('.task input'))
    .map(function(b){ return b.id; })
    .filter(function(id){ return /^t\d+$/.test(id); });
  if (!taskIds.length) return;

  function refreshProgress(){
    var boxes = taskIds.map(function(id){ return document.getElementById(id); }).filter(Boolean);
    var done = boxes.filter(function(b){ return b.checked; }).length;
    var pct = boxes.length ? Math.round(done / boxes.length * 100) : 0;
    var pbar = document.getElementById('pbar'), pnum = document.getElementById('pnum'), ptxt = document.getElementById('ptxt');
    if (pbar) pbar.style.width = pct + '%';
    if (pnum) pnum.textContent = done + '/' + boxes.length;
    if (ptxt) ptxt.textContent = done === 0 ? 'מסמנים תוך כדי' : done === boxes.length ? 'הכל סגור' : pct + '% הושלם';
  }

  function applyRemote(taskId, checked){
    var box = document.getElementById(taskId);
    if (!box || box.checked === checked) return;
    box.checked = checked;
    var task = box.closest('.task');
    if (task) task.classList.toggle('done', checked);
  }

  supabase.from('checklist').select('*').then(function(res){
    if (res.error){ console.error('[shared.js] checklist fetch failed', res.error); return; }
    res.data.forEach(function(row){ applyRemote(row.task_id, row.checked); });
    refreshProgress();
  });

  supabase.channel('checklist-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist' }, function(payload){
      if (payload.new && payload.new.task_id){
        applyRemote(payload.new.task_id, payload.new.checked);
        refreshProgress();
      }
    })
    .subscribe();

  taskIds.forEach(function(id){
    var box = document.getElementById(id);
    if (!box) return;
    box.addEventListener('change', function(){
      supabase.from('checklist').upsert({ task_id: id, checked: box.checked, updated_at: new Date().toISOString() }).then(function(res){
        if (res.error) console.error('[shared.js] checklist upsert failed', res.error);
      });
    });
  });

  var rst = document.getElementById('rst');
  if (rst){
    rst.addEventListener('click', function(){
      var rows = taskIds.map(function(id){ return { task_id: id, checked: false, updated_at: new Date().toISOString() }; });
      supabase.from('checklist').upsert(rows).then(function(res){
        if (res.error) console.error('[shared.js] checklist reset failed', res.error);
      });
    });
  }
}

function boot(){
  var configured = !!(supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey);
  if (!configured){
    bootDemo();
    return;
  }

  import(SUPABASE_SDK).then(function(mod){
    var supabase = mod.createClient(supabaseConfig.url, supabaseConfig.anonKey);

    supabase.auth.signInAnonymously().then(function(res){
      if (res.error) console.error('[shared.js] anonymous sign-in failed — deleting items will not work until it is enabled in the Supabase console', res.error);
    });

    bootChecklist(supabase);

    function onDelete(id){
      supabase.from('items').delete().eq('id', id).then(function(res){
        if (res.error){
          console.error('[shared.js] delete failed', res.error);
          alert('לא הצלחנו להסיר. נסו שוב.');
        }
      });
    }

    function refresh(){
      supabase.from('items').select('*').order('created_at', { ascending: false }).then(function(res){
        if (res.error){ console.error('[shared.js] fetch failed', res.error); return; }
        render(res.data.map(rowToDocSnap), onDelete);
      });
    }

    supabase.channel('items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, refresh)
      .subscribe();
    refresh();

    function callFunction(name, payload){
      return fetch(supabaseConfig.url + '/functions/v1/' + name, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'apikey': supabaseConfig.anonKey,
          'authorization': 'Bearer ' + supabaseConfig.anonKey
        },
        body: JSON.stringify(payload)
      }).then(function(res){
        if (!res.ok) throw new Error(name + ' request failed: ' + res.status);
        return res.json();
      });
    }

    function submitItem(data){
      return callFunction('add-item', data);
    }

    function submitExtract(file){
      return callFunction('extract-item', file).then(function(res){ return res.item; });
    }

    mountAddUi(buildModal(submitItem, submitExtract));
  }).catch(function(err){
    console.error('[shared.js] failed to load Supabase SDK', err);
  });
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
