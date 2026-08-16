/*
  תחזית אמיתית לימי הטיול, במקום הערכה עונתית קבועה. Open-Meteo — חינמי, בלי מפתח,
  תומך CORS מהדפדפן. פועל רק בטווח שהוא נותן תחזית אליו (בד"כ עד 16 יום קדימה); מחוץ
  לטווח פשוט נשארים המספרים הקבועים שכבר בעמוד, כגיבוי סביר.
*/
(function(){
  var LOCS = {
    d1: { lat: 41.3874, lon: 2.1686 },  // ברצלונה
    d2: { lat: 41.3874, lon: 2.1686 },  // ברצלונה
    d3: { lat: 41.6987, lon: 2.8449 },  // יורט (יעד הלילה)
    d4: { lat: 41.6987, lon: 2.8449 },  // יורט
    d5: { lat: 41.9552, lon: 3.2078 },  // בגור (יעד הלילה)
    d6: { lat: 41.9552, lon: 3.2078 },  // בגור
    d7: { lat: 41.3874, lon: 2.1686 }   // אל פראט / ברצלונה
  };

  var DATES = { d1:'2026-08-26', d2:'2026-08-27', d3:'2026-08-28', d4:'2026-08-29', d5:'2026-08-30', d6:'2026-08-31', d7:'2026-09-01' };

  var WCODE_HE = {
    0: 'בהיר', 1: 'בהיר בעיקר', 2: 'מעונן חלקית', 3: 'מעונן',
    45: 'ערפל', 48: 'ערפל קופא',
    51: 'טפטוף קל', 53: 'טפטוף', 55: 'טפטוף חזק',
    61: 'גשם קל', 63: 'גשם', 65: 'גשם חזק',
    80: 'ממטרים קלים', 81: 'ממטרים', 82: 'ממטרים חזקים',
    95: 'סופת רעמים'
  };

  function wcodeToHe(code){ return WCODE_HE[code] || 'משתנה'; }

  var CACHE_KEY = 'bcn26_weather_cache_v1';
  function loadCache(){
    try {
      var raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (raw && raw.fetchedAt && (Date.now() - raw.fetchedAt) < 6 * 60 * 60 * 1000) return raw.data;
    } catch(e){}
    return null;
  }
  function saveCache(data){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data: data })); } catch(e){}
  }

  function applyDay(dayId, hi, lo, code){
    var wx = document.querySelector('.wx[data-day="' + dayId + '"]');
    if (!wx) return;
    var hiEl = wx.querySelector('[data-wx="hi"]'), loEl = wx.querySelector('[data-wx="lo"]'), fcEl = wx.querySelector('[data-wx="fc"]');
    if (hiEl && hi != null) hiEl.textContent = Math.round(hi) + '°';
    if (loEl && lo != null) loEl.textContent = Math.round(lo) + '°';
    if (fcEl && code != null) fcEl.textContent = wcodeToHe(code);
  }

  function applyAll(byDay){
    Object.keys(byDay).forEach(function(dayId){
      var d = byDay[dayId];
      applyDay(dayId, d.hi, d.lo, d.code);
    });
  }

  var cached = loadCache();
  if (cached) applyAll(cached);

  if (!window.fetch) return;

  // בקשה נפרדת לכל יום (לא טווח משותף למיקום) — כדי שיום אחד שיוצא מטווח התחזית
  // (בד"כ עד כ-16 יום קדימה) לא יפיל גם ימים אחרים שכן בטווח וחולקים איתו מיקום.
  var byDay = {};
  var dayIds = Object.keys(LOCS);
  var pending = dayIds.length;
  function done(){
    pending--;
    if (pending === 0 && Object.keys(byDay).length){
      applyAll(byDay);
      saveCache(byDay);
    }
  }

  dayIds.forEach(function(dayId){
    var loc = LOCS[dayId], date = DATES[dayId];
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Europe%2FMadrid&start_date=' + date + '&end_date=' + date;
    fetch(url).then(function(res){ return res.ok ? res.json() : null; }).then(function(json){
      if (!json || !json.daily || !json.daily.time || !json.daily.time.length) return;
      byDay[dayId] = {
        hi: json.daily.temperature_2m_max[0],
        lo: json.daily.temperature_2m_min[0],
        code: json.daily.weathercode[0]
      };
    }).catch(function(){}).then(done);
  });
})();
