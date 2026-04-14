(function () {
  'use strict';

  // --- State ---
  var totalLaps = 0;      // 0 = unlimited
  var startTime = 0;      // performance.now() at start
  var lapStartTime = 0;   // performance.now() at last lap press
  var laps = [];          // [{lapNum, splitMs, totalMs}]
  var rafId = null;
  var wakeLock = null;

  // --- DOM refs ---
  var setupScreen   = document.getElementById('setup-screen');
  var timerScreen   = document.getElementById('timer-screen');
  var resultsScreen = document.getElementById('results-screen');
  var timerDisplay  = document.getElementById('timer-display');
  var lapDisplayEl  = document.getElementById('lap-display');
  var lapsToGoEl    = document.getElementById('laps-to-go');
  var lapListEl     = document.getElementById('lap-list');
  var finalTimeEl   = document.getElementById('final-time');
  var resultsListEl = document.getElementById('results-list');
  var startBtn      = document.getElementById('start-btn');
  var lapBtn        = document.getElementById('lap-btn');
  var stopBtn       = document.getElementById('stop-btn');
  var shareBtn      = document.getElementById('share-btn');
  var resetBtn      = document.getElementById('reset-btn');
  var lapRollerEl   = document.getElementById('lap-roller');
  var lapLabelEl    = document.getElementById('lap-label');

  // --- Formatting helpers ---
  function formatMmSsSs(ms) {
    var totalSecs = ms / 1000;
    var mins = Math.floor(totalSecs / 60);
    var secs = totalSecs - mins * 60;
    return String(mins).padStart(2, '0') + ':' + secs.toFixed(2).padStart(5, '0');
  }

  function formatSecsSs(ms) {
    return (ms / 1000).toFixed(2);
  }

  // --- Screen switching ---
  function showScreen(screen) {
    setupScreen.classList.remove('active');
    timerScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    screen.classList.add('active');
  }

  // --- Drum roller ---
  var ITEM_H = 56;
  var scrollTimer = null;

  (function buildRoller() {
    if (!lapRollerEl) { return; }

    var topSpacer = document.createElement('div');
    topSpacer.className = 'roller-spacer';
    lapRollerEl.appendChild(topSpacer);

    for (var i = 0; i <= 99; i++) {
      var item = document.createElement('div');
      item.className = 'roller-item';
      item.textContent = i;
      lapRollerEl.appendChild(item);
    }

    var bottomSpacer = document.createElement('div');
    bottomSpacer.className = 'roller-spacer';
    lapRollerEl.appendChild(bottomSpacer);

    lapRollerEl.scrollTop = 0;
  })();

  // Mouse-wheel scrolls one item at a time on desktop
  lapRollerEl.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY > 0 ? ITEM_H : -ITEM_H;
    lapRollerEl.scrollBy({ top: delta, behavior: 'smooth' });
  }, { passive: false });

  lapRollerEl.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var idx = Math.round(lapRollerEl.scrollTop / ITEM_H);
      totalLaps = Math.max(0, Math.min(99, idx));
    }, 80);
  });

  // --- Button state helpers ---
  function updateFinalLapUI() {
    stopBtn.classList.add('end-of-race');
    stopBtn.querySelector('.btn-icon').textContent = '🏁';
    stopBtn.querySelector('.btn-label').textContent = 'End of Race';
    lapBtn.classList.add('last-lap');
  }

  function resetButtonUI() {
    stopBtn.classList.remove('end-of-race');
    stopBtn.querySelector('.btn-icon').textContent = '⏹';
    stopBtn.querySelector('.btn-label').textContent = 'Stop';
    lapBtn.classList.remove('last-lap');
  }

  // --- Wake Lock ---
  function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(function (lock) {
          wakeLock = lock;
        }).catch(function () {});
      }
    } catch (_) { /* best effort */ }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(function () {});
      wakeLock = null;
    }
  }

  // --- Timer loop ---
  function tick() {
    var now = performance.now();
    timerDisplay.textContent = formatMmSsSs(now - startTime);
    lapDisplayEl.textContent = formatSecsSs(now - lapStartTime) + ' s';
    rafId = requestAnimationFrame(tick);
  }

  // --- Start ---
  startBtn.addEventListener('click', function () {
    laps = [];
    lapListEl.innerHTML = '';
    lapsToGoEl.textContent = '';
    startTime = performance.now();
    lapStartTime = startTime;
    timerDisplay.textContent = '00:00.00';
    lapDisplayEl.textContent = '0.00 s';
    lapLabelEl.textContent = 'Lap time';
    resetButtonUI();
    showScreen(timerScreen);
    rafId = requestAnimationFrame(tick);
    requestWakeLock();

    if (totalLaps > 0) {
      lapsToGoEl.textContent = totalLaps + ' laps to go';
    }
  });

  // --- Lap ---
  lapBtn.addEventListener('click', function () {
    var now = performance.now();
    var splitMs = now - lapStartTime;
    var totalMs = now - startTime;
    lapStartTime = now;

    var lapNum = laps.length + 1;
    laps.push({ lapNum: lapNum, splitMs: splitMs, totalMs: totalMs });

    lapLabelEl.textContent = 'Lap ' + (lapNum + 1) + ' time';
    renderLapList();

    if (totalLaps > 0) {
      var remaining = totalLaps - lapNum;
      if (remaining > 1) {
        lapsToGoEl.textContent = remaining + ' laps to go';
      } else if (remaining === 1) {
        lapsToGoEl.textContent = '⚑ Final lap!';
        updateFinalLapUI();
      } else {
        lapsToGoEl.textContent = 'Race complete — press Stop';
      }
    }
  });

  function renderLapList() {
    lapListEl.innerHTML = '';
    for (var i = laps.length - 1; i >= 0; i--) {
      var lap = laps[i];
      var entry = document.createElement('div');
      entry.className = 'lap-entry ' + (i === laps.length - 1 ? 'latest' : 'older');

      var numSpan = document.createElement('span');
      numSpan.className = 'lap-number';
      numSpan.textContent = lap.lapNum;

      var timeSpan = document.createElement('span');
      timeSpan.className = 'lap-time';
      timeSpan.textContent = formatSecsSs(lap.splitMs);

      var unitSpan = document.createElement('span');
      unitSpan.className = 'lap-unit';
      unitSpan.textContent = 's';

      timeSpan.appendChild(unitSpan);
      entry.appendChild(numSpan);
      entry.appendChild(timeSpan);
      lapListEl.appendChild(entry);
    }
  }

  // --- Stop ---
  stopBtn.addEventListener('click', function () {
    var now = performance.now();
    var totalMs = now - startTime;

    if (now - lapStartTime > 10) {
      laps.push({ lapNum: laps.length + 1, splitMs: now - lapStartTime, totalMs: totalMs });
    }

    cancelAnimationFrame(rafId);
    rafId = null;
    releaseWakeLock();

    finalTimeEl.textContent = formatMmSsSs(totalMs);
    renderResults();
    showScreen(resultsScreen);
  });

  // --- Results ---
  function renderResults() {
    resultsListEl.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'result-row result-header';
    header.innerHTML =
      '<span class="result-lap-num">Lap</span>' +
      '<span class="result-split">Split (s)</span>' +
      '<span class="result-total">Total</span>';
    resultsListEl.appendChild(header);

    for (var i = 0; i < laps.length; i++) {
      var lap = laps[i];
      var row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML =
        '<span class="result-lap-num">' + lap.lapNum + '</span>' +
        '<span class="result-split">' + formatSecsSs(lap.splitMs) + '</span>' +
        '<span class="result-total">' + formatMmSsSs(lap.totalMs) + '</span>';
      resultsListEl.appendChild(row);
    }
  }

  // --- Share (Android share sheet → clipboard API → execCommand fallback) ---
  function copyTextFallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  shareBtn.addEventListener('click', function () {
    var lines = ['Lap Timer Results', ''];
    for (var i = 0; i < laps.length; i++) {
      var lap = laps[i];
      lines.push('Lap ' + lap.lapNum + ':  ' + formatSecsSs(lap.splitMs) + 's   (Total: ' + formatMmSsSs(lap.totalMs) + ')');
    }
    if (laps.length > 0) {
      lines.push('');
      lines.push('Total: ' + formatMmSsSs(laps[laps.length - 1].totalMs));
    }
    var text = lines.join('\n');

    if (navigator.share) {
      navigator.share({ title: 'Lap Timer Results', text: text }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        shareBtn.querySelector('.btn-label').textContent = 'Copied!';
        setTimeout(function () { shareBtn.querySelector('.btn-label').textContent = 'Share'; }, 2000);
      }).catch(function () {
        copyTextFallback(text);
        shareBtn.querySelector('.btn-label').textContent = 'Copied!';
        setTimeout(function () { shareBtn.querySelector('.btn-label').textContent = 'Share'; }, 2000);
      });
    } else {
      copyTextFallback(text);
      shareBtn.querySelector('.btn-label').textContent = 'Copied!';
      setTimeout(function () { shareBtn.querySelector('.btn-label').textContent = 'Share'; }, 2000);
    }
  });

  // --- Reset ---
  resetBtn.addEventListener('click', function () {
    laps = [];
    lapListEl.innerHTML = '';
    resultsListEl.innerHTML = '';
    lapsToGoEl.textContent = '';
    timerDisplay.textContent = '00:00.00';
    lapDisplayEl.textContent = '0.00 s';
    lapLabelEl.textContent = 'Lap time';
    finalTimeEl.textContent = '';
    shareBtn.querySelector('.btn-label').textContent = 'Share';
    resetButtonUI();
    showScreen(setupScreen);
  });
})();
