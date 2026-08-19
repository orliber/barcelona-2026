/*
  Service worker בסיסי: שומר "מעטפת" סטטית (index.html + js/*) כדי שהאתר יעלה גם
  בלי אינטרנט (למשל באזור בלי כיסוי בטיול) — לא כולל תמיכה אופליין לנתונים החיים
  (הזמנות/צ'קליסט מ-Supabase), רק את הדף והעיצוב עצמם.

  בכוונה לא נוגע בכלום שהוא לא מהאתר עצמו (Supabase, esm.sh וכו') — כל בקשה כזו
  עוברת ישר לרשת, בלי שה-service worker מתערב.
*/
var CACHE_NAME = 'bcn26-shell-v28';
var SHELL_ASSETS = [
  './',
  './index.html',
  './js/app.js',
  './js/weather.js',
  './js/shared.js',
  './js/supabase-config.js'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(SHELL_ASSETS); }).catch(function(){})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  var url = new URL(req.url);

  if (url.origin !== self.location.origin || req.method !== 'GET') return;

  // דף ה-HTML עצמו: קודם רשת (כדי שבדיקת "יש עדכון" הקיימת באתר תמשיך לעבוד כרגיל),
  // וגיבוי מה-cache רק אם באמת אין רשת.
  if (req.mode === 'navigate' || url.pathname.endsWith('index.html')){
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(res){ return res || caches.match('./index.html'); });
      })
    );
    return;
  }

  // קבצי js/: קודם רשת, בדיוק כמו ה-HTML למעלה — לא cache-first. האתר משתנה הרבה
  // (שדרוגים תכופים בזמן שמתכננים את הטיול) ו-cache-first היה גורם למי שכבר פתח את
  // האתר פעם אחת להמשיך לקבל קוד JS ישן, גם אחרי שהבאנר "יצאה גרסה חדשה" רענן את
  // ה-HTML — כי הוא לא נגע ב-cache הישן של js/app.js ו-js/shared.js. גיבוי מה-cache
  // רק אם באמת אין רשת.
  event.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
      return res;
    }).catch(function(){
      return caches.match(req);
    })
  );
});
