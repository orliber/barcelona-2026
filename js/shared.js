import { supabaseConfig } from './supabase-config.js';

var SUPABASE_SDK = 'https://esm.sh/@supabase/supabase-js@2';
var NAME_KEY = 'bcn26_name';
var NEW_BADGE_MS = 20 * 60 * 60 * 1000; // "חדש" מוצג על פריטים שנוספו ב-20 השעות האחרונות

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

  if (it.createdAt && (Date.now() - new Date(it.createdAt).getTime()) < NEW_BADGE_MS){
    var badge = document.createElement('span');
    badge.className = 'newbadge';
    badge.textContent = 'חדש';
    row.querySelector('.ttl').appendChild(badge);
  }

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
  var editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'ib ed';
  editBtn.innerHTML = '<span>✏️ עריכה</span>';
  ico.appendChild(editBtn);

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

  return { card: card, delBtn: delBtn, editBtn: editBtn };
}

function clearGenerated(){
  Array.prototype.slice.call(document.querySelectorAll('[data-shared-gen="1"]')).forEach(function(el){
    el.remove();
  });
}

function render(docs, onDelete, onEdit){
  clearGenerated();

  var groupList = document.getElementById('groupList');
  var groupEmpty = document.getElementById('groupEmpty');
  var gcount = document.getElementById('gcount');

  if (gcount) gcount.textContent = docs.length ? (docs.length + ' פריטים') : '';
  if (groupEmpty){
    if (docs.length === 0){
      groupEmpty.textContent = 'עדיין לא נוסף כלום. תהיו הראשונים.';
      groupEmpty.style.display = '';
    } else {
      groupEmpty.style.display = 'none';
    }
  }

  function wireActions(built, docSnap){
    built.delBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var it = docSnap.data();
      var spansMultiple = dayRange(it.day, it.dayEnd).length > 1;
      var msg = 'להסיר את "' + it.title + '"?' +
        (spansMultiple ? ' (הפריט יוסר מכל הימים שהוא מופיע בהם — ' + dayRangeLabel(it.day, it.dayEnd) + ')' : '');
      if (confirm(msg)) onDelete(docSnap.id);
    });
    if (built.editBtn){
      built.editBtn.addEventListener('click', function(e){
        e.stopPropagation();
        if (onEdit) onEdit(docSnap);
      });
    }
  }

  var byDay = {};
  docs.forEach(function(docSnap){
    if (groupList){
      var built = buildItemCard(docSnap);
      wireActions(built, docSnap);
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
      wireActions(built, docSnap);
      dbody.appendChild(built.card);
    });
  });
}

/*
  זרימת הוספה: העלאת תמונה/PDF היא הדרך הראשית — ה-AI מזהה סוג/יום/מחיר לבד מהמסמך.
  מילוי ידני (בלי קובץ) מוגבל בכוונה לפעילות/הערה בלבד — אלה הדברים שבדרך כלל אין
  עליהם מסמך אמיתי (למלון/תחבורה/כרטיסים יש כמעט תמיד אישור הזמנה, אז עדיף להעלות אותו).
  אותה פונקציה גם משמשת לעריכה (editItem לא ריק) — אז מדלגים על ההעלאה ופותחים ישר
  עם הערכים הקיימים ממולאים.
*/
function buildModal(onSubmit, onExtract, editItem){
  var isEdit = !!editItem;
  var bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = 'gmodalBg';

  var dayOptions = DAYS.map(function(d){
    return '<option value="' + d.id + '">' + esc(d.label) + '</option>';
  }).join('');

  var showUpload = onExtract && !isEdit;
  var uploadHtml = showUpload
    ? '<div class="field"><label>העלאת תמונה או PDF של ההזמנה</label>' +
      '<input type="file" id="gfileInput" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf">' +
      '<div id="gfileStatus" class="gfilestatus">ה-AI יזהה לבד את הסוג, היום, ופרטי המחיר.</div></div>' +
      '<button type="button" class="linkbtn" id="gManualToggle">אין קובץ? הוספה ידנית של פעילות או הערה בלבד</button>'
    : '';

  bg.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-label="' + (isEdit ? 'עריכת פריט' : 'הוספת הזמנה') + '">' +
      '<h3>' + (isEdit ? 'עריכת פריט' : 'הוספת הזמנה') + '</h3>' +
      uploadHtml +
      '<div id="gfields" style="display:' + (showUpload ? 'none' : 'block') + '">' +
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
        '<button type="button" class="btn-save" id="gsave">' + (isEdit ? 'שמירת שינויים' : 'הוספה') + '</button>' +
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
  if (!showUpload) renderTypeButtons(TYPES, isEdit ? editItem.type : TYPES[0].id);

  function close(){
    bg.classList.remove('show');
    if (isEdit) setTimeout(function(){ bg.remove(); }, 250);
  }
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
          statusEl.textContent = 'לא הצלחנו לחלץ מהקובץ הזה. אפשר להוסיף ידנית פעילות/הערה למעלה. (' + (err && err.message || '') + ')';
          console.error(err);
        });
      };
      reader.onerror = function(){ statusEl.textContent = 'שגיאה בקריאת הקובץ.'; };
      reader.readAsDataURL(file);
    });
  }

  var savedName = '';
  try { savedName = localStorage.getItem(NAME_KEY) || ''; } catch(e){}
  bg.querySelector('#gname').value = isEdit ? (editItem.addedBy || savedName) : savedName;

  if (isEdit){
    bg.querySelector('#gtitle').value = editItem.title || '';
    bg.querySelector('#gday').value = editItem.day || 'general';
    bg.querySelector('#gdetails').value = editItem.details || '';
    bg.querySelector('#gprice').value = editItem.price || '';
    bg.querySelector('#glink').value = editItem.link || '';
  }

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

    if (!isEdit){
      var existingTitles = Array.prototype.slice.call(document.querySelectorAll('#groupList .ttl'))
        .map(function(el){ return (el.textContent || '').trim().toLowerCase(); })
        .filter(Boolean);
      var titleLower = title.toLowerCase();
      var looksDup = existingTitles.some(function(t){
        return t === titleLower || t.indexOf(titleLower) > -1 || titleLower.indexOf(t) > -1;
      });
      if (looksDup && !confirm('נראה שכבר יש פריט דומה בשם "' + title + '" ברשימה. להוסיף בכל זאת?')){
        return;
      }
    }

    errEl.classList.remove('show');
    try { localStorage.setItem(NAME_KEY, name); } catch(e){}

    var saveBtn = bg.querySelector('#gsave');
    saveBtn.disabled = true; saveBtn.textContent = 'שומר…';

    var payload = {
      type: selectedType,
      title: title,
      day: bg.querySelector('#gday').value,
      details: bg.querySelector('#gdetails').value.trim(),
      price: bg.querySelector('#gprice').value.trim(),
      link: bg.querySelector('#glink').value.trim(),
      addedBy: name
    };
    if (isEdit) payload.id = editItem.id;

    onSubmit(payload).then(function(){
      saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'שמירת שינויים' : 'הוספה';
      if (!isEdit){
        bg.querySelector('#gtitle').value = '';
        bg.querySelector('#gdetails').value = '';
        bg.querySelector('#gprice').value = '';
        bg.querySelector('#glink').value = '';
      }
      close();
    }).catch(function(err){
      saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'שמירת שינויים' : 'הוספה';
      errEl.textContent = 'לא הצלחנו לשמור. נסו שוב עוד רגע. (' + (err && err.message || '') + ')';
      errEl.classList.add('show');
      console.error(err);
    });
  });

  return bg;
}

function openEditModal(docSnap, onUpdate){
  var it = docSnap.data();
  var modal = buildModal(onUpdate, null, {
    id: docSnap.id,
    type: it.type,
    title: it.title,
    day: it.day,
    details: it.details,
    price: it.price,
    link: it.link,
    addedBy: it.addedBy
  });
  modal.classList.add('show');
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
  אותה חוויה בדיוק (אותו modal, אותם כרטיסים, כולל עריכה) אבל הנתונים נשמרים רק בדפדפן
  הזה — לצורך התרשמות לפני שמחברים את Supabase האמיתי. ברגע שיהיה config אמיתי, מסלול
  הקוד הזה כבר לא ירוץ.
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

  function onEdit(docSnap){ openEditModal(docSnap, editDemoItem); }
  listeners.push(function(snap){ render(snap, removeDemoItem, onEdit); });
  notify();

  function removeDemoItem(id){
    items = items.filter(function(it){ return it.id !== id; });
    persist(); notify();
    return Promise.resolve();
  }

  function submitDemoItem(data){
    data = { type: data.type, title: data.title, day: data.day, dayEnd: data.day, details: data.details,
      price: data.price, link: data.link, addedBy: data.addedBy,
      id: 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      createdAt: Date.now() };
    items.push(data);
    persist(); notify();
    return Promise.resolve();
  }

  function editDemoItem(data){
    var idx = items.findIndex(function(it){ return it.id === data.id; });
    if (idx === -1) return Promise.resolve();
    items[idx] = Object.assign({}, items[idx], {
      type: data.type, title: data.title, day: data.day, dayEnd: data.day,
      details: data.details, price: data.price, link: data.link, addedBy: data.addedBy
    });
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
        addedBy: row.added_by,
        createdAt: row.created_at
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
    .filter(function(id){ return /^(t\d+|r_[a-z0-9_]+)$/.test(id); });
  if (!taskIds.length) return;

  // בר ההתקדמות שייך רק ל"מה להזמין" (t1..t16) — "הזמנו מקום" במסעדות מסונכרן
  // באותה טבלה ובאותו מנגנון בדיוק, אבל לא נספר באחוזים של אותו בר.
  var bookingIds = taskIds.filter(function(id){ return /^t\d+$/.test(id); });

  function refreshProgress(){
    var boxes = bookingIds.map(function(id){ return document.getElementById(id); }).filter(Boolean);
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
      var prevChecked = !box.checked;
      var wasDone = prevChecked;
      supabase.from('checklist').upsert({ task_id: id, checked: box.checked, updated_at: new Date().toISOString() }).then(function(res){
        if (res.error){
          console.error('[shared.js] checklist upsert failed', res.error);
          box.checked = prevChecked;
          var task = box.closest('.task');
          if (task) task.classList.toggle('done', wasDone);
          refreshProgress();
          alert('לא הצלחנו לשמור את הסימון. נסו שוב.');
        }
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

/*
  "רוצים לנסות" — הצבעת לב על מסעדות, כדי שהקבוצה תחליט ביחד לאיפה מתקשרים קודם.
  אותה תבנית upsert-לפי-מפתח כמו הצ'קליסט: vote_key = restaurant_key + '::' + השם שלי,
  כדי שכל אחד יוכל להחליף רק את ההצבעה של עצמו. אין מחיקה — ביטול הצבעה = liked:false.
*/
function bootVotes(supabase){
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.votebtn'));
  if (!buttons.length) return;

  function myName(){
    var n = ''; try { n = localStorage.getItem(NAME_KEY) || ''; } catch(e){}
    if (!n){
      n = (prompt('איך שתרצו שיראו אתכם (לצורך ההצבעה):') || '').trim();
      if (n){ try { localStorage.setItem(NAME_KEY, n); } catch(e){} }
    }
    return n;
  }

  var state = {}; // restaurant_key -> { count, mine }

  function render(){
    buttons.forEach(function(btn){
      var key = btn.dataset.rkey;
      var s = state[key] || { count: 0, mine: false };
      btn.querySelector('.vc').textContent = s.count;
      btn.querySelector('.vh').textContent = s.mine ? '❤️' : '🤍';
      btn.classList.toggle('on', s.mine);
    });
  }

  function applyRows(rows){
    state = {};
    var name = null; try { name = localStorage.getItem(NAME_KEY); } catch(e){}
    rows.forEach(function(row){
      if (!row.liked) return;
      state[row.restaurant_key] = state[row.restaurant_key] || { count: 0, mine: false };
      state[row.restaurant_key].count++;
      if (name && row.voter_name === name) state[row.restaurant_key].mine = true;
    });
    render();
  }

  supabase.from('restaurant_votes').select('*').then(function(res){
    if (res.error){ console.error('[shared.js] votes fetch failed', res.error); return; }
    applyRows(res.data);
  });

  supabase.channel('votes-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_votes' }, function(){
      supabase.from('restaurant_votes').select('*').then(function(res){
        if (!res.error) applyRows(res.data);
      });
    })
    .subscribe();

  buttons.forEach(function(btn){
    btn.addEventListener('click', function(){
      var key = btn.dataset.rkey;
      var name = myName();
      if (!name) return;
      var wasMine = state[key] && state[key].mine;
      var voteKey = key + '::' + name;
      supabase.from('restaurant_votes').upsert({
        vote_key: voteKey, restaurant_key: key, voter_name: name,
        liked: !wasMine, updated_at: new Date().toISOString()
      }).then(function(res){
        if (res.error){ console.error('[shared.js] vote upsert failed', res.error); return; }
        state[key] = state[key] || { count: 0, mine: false };
        state[key].count += wasMine ? -1 : 1;
        state[key].mine = !wasMine;
        render();
      });
    });
  });
}

/*
  עריכה חיה של כל בולט במסלול המקורי (לא רק פריטים שהקבוצה הוסיפה) — app.js כבר סימן
  כל .item עם data-eid יציב, והוסיף כפתור ✏️. כאן: שומרים "מקור" (הטקסט המקורי שנטען
  מה-HTML) לכל eid לפני שמפעילים override כלשהו, כדי ש"שחזור למקור" תמיד יעבוד אצל כולם
  בלי למחוק כלום מה-DB — כי ה-HTML המקורי זהה אצל כל הצופים.
*/
function bootContentEdits(supabase){
  var eidEls = {};
  Array.prototype.slice.call(document.querySelectorAll('.item[data-eid]')).forEach(function(el){
    eidEls[el.dataset.eid] = el;
  });
  if (!Object.keys(eidEls).length) return;

  var originals = {};
  Object.keys(eidEls).forEach(function(eid){
    var el = eidEls[eid];
    var ttl = el.querySelector('.ttl'), what = el.querySelector('.what');
    originals[eid] = { title: ttl ? ttl.textContent : '', what: what ? what.textContent : '' };
  });

  var active = {}; // eid -> row

  function applyRow(row){
    var el = eidEls[row.edit_key];
    if (!el) return;
    var ttl = el.querySelector('.ttl'), what = el.querySelector('.what');
    // ttl.textContent תמיד מוחק גם ילדים קודמים (כולל תג "נערך" קודם) — לכן בונים
    // מחדש את התג *אחרי* קביעת הטקסט, לא לפני, אחרת הוא נעלם עם כל עדכון חוזר.
    if (row.cleared){
      if (ttl) ttl.textContent = originals[row.edit_key].title;
      if (what) what.textContent = originals[row.edit_key].what;
      delete active[row.edit_key];
      return;
    }
    if (ttl && row.title) ttl.textContent = row.title;
    if (what && row.what) what.textContent = row.what;
    active[row.edit_key] = row;
    if (ttl){
      var badge = document.createElement('span');
      badge.className = 'editbadge';
      badge.textContent = 'נערך ע״י ' + (row.updated_by || 'מישהו');
      ttl.appendChild(badge);
    }
  }

  supabase.from('content_edits').select('*').then(function(res){
    if (res.error){ console.error('[shared.js] content_edits fetch failed', res.error); return; }
    res.data.forEach(applyRow);
  });

  supabase.channel('content-edits-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'content_edits' }, function(payload){
      if (payload.new && payload.new.edit_key) applyRow(payload.new);
    })
    .subscribe();

  function openContentEditModal(eid){
    var el = eidEls[eid]; if (!el) return;
    var ttl = el.querySelector('.ttl'), what = el.querySelector('.what');
    // לא קוראים textContent ישירות מ-.ttl — יש בו תג "נערך ע״י" כילד, וזה יתערבב
    // עם הכותרת. משתמשים במקור השמור/בעריכה הפעילה, שהם תמיד הטקסט הנקי בלבד.
    var cur = active[eid] || originals[eid];
    var curTitle = cur ? cur.title : '';
    var curWhat = cur ? cur.what : '';

    var bg = document.createElement('div');
    bg.className = 'modal-bg';
    var savedName = ''; try { savedName = localStorage.getItem(NAME_KEY) || ''; } catch(e){}
    bg.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-label="עריכת פריט במסלול">' +
        '<h3>עריכת פריט במסלול</h3>' +
        '<div class="field"><label>כותרת</label><input id="ceTitle" maxlength="160"></div>' +
        (what ? '<div class="field"><label>תיאור קצר</label><textarea id="ceWhat" maxlength="400"></textarea></div>' : '') +
        '<div class="field"><label>השם שלכם (חובה)</label><input id="ceName" maxlength="40" placeholder="איך שתרצו שיראו אתכם"></div>' +
        '<div class="gerr" id="ceErr"></div>' +
        '<div class="modal-actions">' +
          (active[eid] ? '<button type="button" class="btn-cancel" id="ceRestore">שחזור למקור</button>' : '') +
          '<button type="button" class="btn-cancel" id="ceCancel">ביטול</button>' +
          '<button type="button" class="btn-save" id="ceSave">שמירה</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bg);
    bg.querySelector('#ceTitle').value = curTitle;
    var ceWhat = bg.querySelector('#ceWhat'); if (ceWhat) ceWhat.value = curWhat;
    bg.querySelector('#ceName').value = savedName;

    function close(){ bg.classList.remove('show'); setTimeout(function(){ bg.remove(); }, 250); }
    bg.addEventListener('click', function(e){ if (e.target === bg) close(); });
    bg.querySelector('#ceCancel').addEventListener('click', close);

    var restoreBtn = bg.querySelector('#ceRestore');
    if (restoreBtn){
      restoreBtn.addEventListener('click', function(){
        var name = bg.querySelector('#ceName').value.trim();
        if (!name){
          var errEl = bg.querySelector('#ceErr');
          errEl.textContent = 'צריך למלא מי מבצע את השחזור.';
          errEl.classList.add('show');
          return;
        }
        supabase.from('content_edits').upsert({
          edit_key: eid, cleared: true, updated_by: name, updated_at: new Date().toISOString()
        }).then(function(res){
          if (res.error){ console.error('[shared.js] restore failed', res.error); return; }
          close();
        });
      });
    }

    bg.querySelector('#ceSave').addEventListener('click', function(){
      var title = bg.querySelector('#ceTitle').value.trim();
      var name = bg.querySelector('#ceName').value.trim();
      var errEl = bg.querySelector('#ceErr');
      if (!title){ errEl.textContent = 'צריך למלא כותרת.'; errEl.classList.add('show'); return; }
      if (!name){ errEl.textContent = 'צריך למלא מי עורך — כדי שיהיה ברור לכולם.'; errEl.classList.add('show'); return; }
      errEl.classList.remove('show');
      try { localStorage.setItem(NAME_KEY, name); } catch(e){}
      var saveBtn = bg.querySelector('#ceSave');
      saveBtn.disabled = true; saveBtn.textContent = 'שומר…';
      var payload = { edit_key: eid, title: title, cleared: false, updated_by: name, updated_at: new Date().toISOString() };
      if (ceWhat) payload.what = ceWhat.value.trim();
      supabase.from('content_edits').upsert(payload).then(function(res){
        if (res.error){
          saveBtn.disabled = false; saveBtn.textContent = 'שמירה';
          errEl.textContent = 'לא הצלחנו לשמור. נסו שוב. (' + (res.error.message || '') + ')';
          errEl.classList.add('show');
          return;
        }
        close();
      });
    });

    bg.classList.add('show');
  }

  document.addEventListener('click', function(e){
    var b = e.target.closest('.edrow');
    if (!b) return;
    e.stopPropagation();
    openContentEditModal(b.dataset.editfor);
  });
}

function boot(){
  var configured = !!(supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey);
  if (!configured){
    bootDemo();
    return;
  }

  var groupEmptyEl = document.getElementById('groupEmpty');
  if (groupEmptyEl) groupEmptyEl.textContent = 'טוען…';

  import(SUPABASE_SDK).then(function(mod){
    var supabase = mod.createClient(supabaseConfig.url, supabaseConfig.anonKey);

    supabase.auth.signInAnonymously().then(function(res){
      if (res.error) console.error('[shared.js] anonymous sign-in failed — adding/deleting will not work until it is enabled in the Supabase console', res.error);
    });

    bootChecklist(supabase);
    bootVotes(supabase);
    bootContentEdits(supabase);

    function getAuthToken(){
      return supabase.auth.getSession().then(function(res){
        var session = res.data && res.data.session;
        return (session && session.access_token) || supabaseConfig.anonKey;
      });
    }

    function callFunction(name, payload){
      return getAuthToken().then(function(token){
        return fetch(supabaseConfig.url + '/functions/v1/' + name, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'apikey': supabaseConfig.anonKey,
            'authorization': 'Bearer ' + token
          },
          body: JSON.stringify(payload)
        });
      }).then(function(res){
        return res.json().catch(function(){ return {}; }).then(function(json){
          if (!res.ok) throw new Error((json && json.error) || (name + ' failed: ' + res.status));
          return json;
        });
      });
    }

    function onDelete(id){
      callFunction('delete-item', { id: id }).catch(function(err){
        console.error('[shared.js] delete failed', err);
        alert('לא הצלחנו להסיר. נסו שוב. (' + (err && err.message || '') + ')');
      });
    }

    var refreshSeq = 0;
    function refresh(){
      var mySeq = ++refreshSeq;
      supabase.from('items').select('*').order('created_at', { ascending: false }).then(function(res){
        if (mySeq !== refreshSeq) return; // תגובה מיושנת שהוקדמה ע"י בקשה חדשה יותר — מתעלמים
        if (res.error){ console.error('[shared.js] fetch failed', res.error); return; }
        render(res.data.map(rowToDocSnap), onDelete, onEdit);
      });
    }

    supabase.channel('items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, refresh)
      .subscribe();
    refresh();

    function submitItem(data){
      return callFunction('add-item', data);
    }

    function submitExtract(file){
      return callFunction('extract-item', file).then(function(res){ return res.item; });
    }

    function submitEdit(data){
      return callFunction('update-item', data);
    }

    function onEdit(docSnap){
      openEditModal(docSnap, submitEdit);
    }

    mountAddUi(buildModal(submitItem, submitExtract));
  }).catch(function(err){
    console.error('[shared.js] failed to load Supabase SDK', err);
    if (groupEmptyEl) groupEmptyEl.textContent = 'לא הצלחנו לטעון את התוכן המשותף. נסו לרענן את הדף.';
  });
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
