(function () {
  'use strict';

  // --- Race presets ---
  var PRESETS = {
    '800':  { laps: 2,  relay: false },
    '1600': { laps: 4,  relay: false },
    '3200': { laps: 8,  relay: false },
    '4x400': { laps: 4, relay: true },
    '4x800': { laps: 8, relay: true },
    'custom': { laps: 0, relay: false }
  };

  // --- State ---
  var totalLaps = 0;      // 0 = unlimited
  var startTime = 0;
  var lapStartTime = 0;
  var laps = [];          // [{lapNum, splitMs, totalMs}]
  var rafId = null;
  var wakeLock = null;
  var isRelay = false;
  var legNames = [];      // ['Leg 1','Leg 2','Leg 3','Leg 4']
  var raceName = 'Race';
  var selectedRace = 'custom';

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
  var raceTypeGrid  = document.getElementById('race-type-grid');
  var customLapSection = document.getElementById('custom-lap-section');
  var relayLegsSection = document.getElementById('relay-legs-section');
  var raceNameInput = document.getElementById('race-name-input');
  var leg1Input     = document.getElementById('leg1-input');
  var leg2Input     = document.getElementById('leg2-input');
  var leg3Input     = document.getElementById('leg3-input');
  var leg4Input     = document.getElementById('leg4-input');
  var timerRaceName = document.getElementById('timer-race-name');
  var resultsTitleEl = document.getElementById('results-title');

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

  // --- Race type selector ---
  var raceBtns = raceTypeGrid.querySelectorAll('.race-type-btn');
  for (var bi = 0; bi < raceBtns.length; bi++) {
    raceBtns[bi].addEventListener('click', (function (btn) {
      return function () { selectRaceType(btn.getAttribute('data-race')); };
    })(raceBtns[bi]));
  }

  function selectRaceType(race) {
    selectedRace = race;
    for (var i = 0; i < raceBtns.length; i++) {
      raceBtns[i].classList.toggle('selected', raceBtns[i].getAttribute('data-race') === race);
    }
    var preset = PRESETS[race];
    isRelay = preset.relay;
    if (race === 'custom') {
      customLapSection.style.display = '';
      relayLegsSection.style.display = 'none';
    } else if (isRelay) {
      customLapSection.style.display = 'none';
      relayLegsSection.style.display = '';
      totalLaps = preset.laps;
    } else {
      customLapSection.style.display = 'none';
      relayLegsSection.style.display = 'none';
      totalLaps = preset.laps;
    }
  }

  // Default selection
  selectRaceType('custom');

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

  // --- Relay helpers ---
  function getLegForLap(lapNum) {
    // lapNum is 1-based; laps per leg = totalLaps / 4
    var lapsPerLeg = totalLaps / 4;
    return Math.floor((lapNum - 1) / lapsPerLeg); // 0-based leg index
  }

  function getLegName(legIndex) {
    return legNames[legIndex] || ('Leg ' + (legIndex + 1));
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
    raceName = (raceNameInput.value.trim()) || 'Race';

    if (isRelay) {
      legNames = [
        (leg1Input.value.trim()) || 'Leg 1',
        (leg2Input.value.trim()) || 'Leg 2',
        (leg3Input.value.trim()) || 'Leg 3',
        (leg4Input.value.trim()) || 'Leg 4'
      ];
    } else {
      legNames = [];
    }

    laps = [];
    lapListEl.innerHTML = '';
    lapsToGoEl.textContent = '';
    startTime = performance.now();
    lapStartTime = startTime;
    timerDisplay.textContent = '00:00.00';
    lapDisplayEl.textContent = '0.00 s';
    lapLabelEl.textContent = 'Lap time';
    timerRaceName.textContent = raceName;
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

    if (isRelay) {
      var legIdx = getLegForLap(lapNum);
      lapLabelEl.textContent = getLegName(legIdx) + ' — Lap ' + lapNum;
    } else {
      lapLabelEl.textContent = 'Lap ' + (lapNum + 1) + ' time';
    }

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
    if (isRelay) {
      renderRelayLapList();
    } else {
      renderSimpleLapList();
    }
  }

  function renderSimpleLapList() {
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

  function renderRelayLapList() {
    if (laps.length === 0) { return; }

    var lapsPerLeg = totalLaps / 4;
    // Build legs completed so far
    var currentLeg = getLegForLap(laps.length);  // 0-based, leg of the most recent lap

    // Render legs from current down to 0
    for (var legIdx = currentLeg; legIdx >= 0; legIdx--) {
      var firstLapOfLeg = legIdx * lapsPerLeg + 1;  // 1-based
      var lastLapOfLeg  = (legIdx + 1) * lapsPerLeg;

      // Collect laps in this leg that have been run
      var legLaps = [];
      for (var k = 0; k < laps.length; k++) {
        if (laps[k].lapNum >= firstLapOfLeg && laps[k].lapNum <= lastLapOfLeg) {
          legLaps.push(laps[k]);
        }
      }
      if (legLaps.length === 0) { continue; }

      // Leg total so far: sum of splits in this leg
      var legTotalMs = 0;
      for (var m = 0; m < legLaps.length; m++) {
        legTotalMs += legLaps[m].splitMs;
      }

      var legComplete = legLaps.length === lapsPerLeg;
      var isCurrentLegBlock = (legIdx === currentLeg);

      // Leg header
      var header = document.createElement('div');
      header.className = 'relay-leg-header' + (isCurrentLegBlock ? ' relay-leg-current' : ' relay-leg-done');
      var statusIcon = legComplete ? '✓' : '▶';
      header.innerHTML =
        '<span class="relay-leg-name">' + statusIcon + ' ' + getLegName(legIdx) + '</span>' +
        '<span class="relay-leg-total">' + formatMmSsSs(legTotalMs) + '</span>';
      lapListEl.appendChild(header);

      // Lap rows within this leg (newest first)
      for (var j = legLaps.length - 1; j >= 0; j--) {
        var lap = legLaps[j];
        var isLatestOverall = (lap.lapNum === laps.length);
        var entry = document.createElement('div');
        entry.className = 'lap-entry relay-lap' + (isLatestOverall ? ' latest' : ' older');

        var numSpan = document.createElement('span');
        numSpan.className = 'lap-number';
        // Show position within leg
        numSpan.textContent = (lap.lapNum - firstLapOfLeg + 1);

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
    resultsTitleEl.textContent = raceName;
    renderResults();
    showScreen(resultsScreen);
  });

  // --- Results ---
  function renderResults() {
    resultsListEl.innerHTML = '';

    if (isRelay) {
      renderRelayResults();
    } else {
      renderSimpleResults();
    }
  }

  function renderSimpleResults() {
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

  function renderRelayResults() {
    var lapsPerLeg = totalLaps / 4;

    for (var legIdx = 0; legIdx < 4; legIdx++) {
      var firstLapOfLeg = legIdx * lapsPerLeg + 1;
      var lastLapOfLeg  = (legIdx + 1) * lapsPerLeg;

      var legLaps = [];
      for (var k = 0; k < laps.length; k++) {
        if (laps[k].lapNum >= firstLapOfLeg && laps[k].lapNum <= lastLapOfLeg) {
          legLaps.push(laps[k]);
        }
      }
      if (legLaps.length === 0) { break; }

      // Leg total
      var legTotalMs = 0;
      for (var m = 0; m < legLaps.length; m++) {
        legTotalMs += legLaps[m].splitMs;
      }

      // Leg header
      var legHeader = document.createElement('div');
      legHeader.className = 'result-leg-header';
      legHeader.innerHTML =
        '<span class="result-leg-name">' + getLegName(legIdx) + '</span>' +
        '<span class="result-leg-total">' + formatMmSsSs(legTotalMs) + '</span>';
      resultsListEl.appendChild(legHeader);

      // Column header
      var colHeader = document.createElement('div');
      colHeader.className = 'result-row result-header';
      colHeader.innerHTML =
        '<span class="result-lap-num">Lap</span>' +
        '<span class="result-split">Split (s)</span>' +
        '<span class="result-total">Leg Total</span>';
      resultsListEl.appendChild(colHeader);

      // Lap rows
      var runningLegTotal = 0;
      for (var i = 0; i < legLaps.length; i++) {
        var lap = legLaps[i];
        runningLegTotal += lap.splitMs;
        var row = document.createElement('div');
        row.className = 'result-row';
        row.innerHTML =
          '<span class="result-lap-num">' + (i + 1) + '</span>' +
          '<span class="result-split">' + formatSecsSs(lap.splitMs) + '</span>' +
          '<span class="result-total">' + formatMmSsSs(runningLegTotal) + '</span>';
        resultsListEl.appendChild(row);
      }
    }
  }

  // --- Share ---
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
    var lines = [raceName + ' — Results', ''];

    if (isRelay) {
      var lapsPerLeg = totalLaps / 4;
      for (var legIdx = 0; legIdx < 4; legIdx++) {
        var firstLapOfLeg = legIdx * lapsPerLeg + 1;
        var lastLapOfLeg  = (legIdx + 1) * lapsPerLeg;
        var legLaps = [];
        for (var k = 0; k < laps.length; k++) {
          if (laps[k].lapNum >= firstLapOfLeg && laps[k].lapNum <= lastLapOfLeg) {
            legLaps.push(laps[k]);
          }
        }
        if (legLaps.length === 0) { break; }
        var legTotalMs = 0;
        for (var m = 0; m < legLaps.length; m++) { legTotalMs += legLaps[m].splitMs; }
        lines.push(getLegName(legIdx) + ':');
        var runningLeg = 0;
        for (var i = 0; i < legLaps.length; i++) {
          runningLeg += legLaps[i].splitMs;
          lines.push('  Lap ' + (i + 1) + ':  ' + formatSecsSs(legLaps[i].splitMs) + 's   (Leg: ' + formatMmSsSs(runningLeg) + ')');
        }
        lines.push('  Total: ' + formatMmSsSs(legTotalMs));
        lines.push('');
      }
    } else {
      for (var i = 0; i < laps.length; i++) {
        var lap = laps[i];
        lines.push('Lap ' + lap.lapNum + ':  ' + formatSecsSs(lap.splitMs) + 's   (Total: ' + formatMmSsSs(lap.totalMs) + ')');
      }
    }

    if (laps.length > 0) {
      lines.push('');
      lines.push('Total: ' + formatMmSsSs(laps[laps.length - 1].totalMs));
    }
    var text = lines.join('\n');

    if (navigator.share) {
      navigator.share({ title: raceName + ' Results', text: text }).catch(function () {});
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
