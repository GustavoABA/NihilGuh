(() => {
  const api = window.NihilGuhAPI;

  const TIMER_HIDDEN_SEC = 3 * 60;
  const TIMER_VISIBLE_SEC = 3 * 60;
  const TIMER_CYCLE_SEC = TIMER_HIDDEN_SEC + TIMER_VISIBLE_SEC;

  const SUMMARY_INTERVAL_SEC = 15 * 60;
  const SUMMARY_SECONDS_PER_CHALLENGE = 30;

  const OVERTIME_VISIBLE_SEC = 5 * 60;
  const OVERTIME_HIDDEN_SEC = 2 * 60;
  const OVERTIME_CYCLE_SEC = OVERTIME_VISIBLE_SEC + OVERTIME_HIDDEN_SEC;

  const STATE_REFRESH_MS = 5000;
  const FRAME_MS = 250;
  const VIEW_TRANSITION_MS = 460;

  let state = null;
  let refreshInFlight = false;
  let lastView = '';
  let lastSummaryIndex = -1;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[char]));

  function isLive(s) {
    return Boolean(s?.session && s.session.status === 'ONLINE');
  }

  function sessionStartMs(s) {
    const value = new Date(s?.session?.inicio).getTime();
    return Number.isFinite(value) ? value : NaN;
  }

  function elapsedSeconds(s) {
    if (!isLive(s)) return 0;
    const started = sessionStartMs(s);
    return Number.isFinite(started)
      ? Math.max(0, Math.floor((Date.now() - started) / 1000))
      : 0;
  }

  function remainingSeconds(s) {
    if (!isLive(s)) return 0;
    const started = sessionStartMs(s);
    const total = Number(s?.session?.tempo_total_min || 0) * 60;
    if (!Number.isFinite(started)) return Math.max(0, Number(s?.game?.remainingSeconds || 0));
    return Math.max(0, Math.floor(total - (Date.now() - started) / 1000));
  }

  function overtimeElapsedSeconds(s) {
    if (!isLive(s)) return 0;
    const started = sessionStartMs(s);
    if (!Number.isFinite(started)) return 0;
    const scheduledEnd = started + Number(s?.session?.tempo_total_min || 0) * 60 * 1000;
    return Math.max(0, Math.floor((Date.now() - scheduledEnd) / 1000));
  }

  function clock(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds || 0)));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hours, minutes, secs].map(value => String(value).padStart(2, '0')).join(':');
  }

  function signedMinutes(value) {
    const minutes = Number(value || 0);
    if (minutes > 0) return '+' + minutes + ' min';
    if (minutes < 0) return String(minutes) + ' min';
    return '0 min';
  }

  function completedChallenges(s, cutoffMs = Date.now()) {
    if (!isLive(s)) return [];
    const wins = Array.isArray(s?.overlay?.recentWins) ? s.overlay.recentWins : [];
    const started = sessionStartMs(s);

    return wins
      .filter(win => {
        const at = new Date(win?.at).getTime();
        return !Number.isFinite(started) || !Number.isFinite(at) || (at >= started && at <= cutoffMs);
      })
      .slice()
      .sort((a, b) => new Date(a?.at).getTime() - new Date(b?.at).getTime());
  }

  function summaryWindow(s) {
    const elapsed = elapsedSeconds(s);
    if (elapsed < SUMMARY_INTERVAL_SEC) return null;

    const occurrence = Math.floor(elapsed / SUMMARY_INTERVAL_SEC);
    const position = elapsed - occurrence * SUMMARY_INTERVAL_SEC;
    const started = sessionStartMs(s);
    const cutoffMs = Number.isFinite(started)
      ? started + occurrence * SUMMARY_INTERVAL_SEC * 1000
      : Date.now();
    const wins = completedChallenges(s, cutoffMs);

    // Cada desafio recebe sua própria tela por 30 segundos.
    // Quando ainda não há vitórias, a mensagem de estado ocupa 30 segundos.
    const itemCount = Math.max(1, wins.length);
    const duration = itemCount * SUMMARY_SECONDS_PER_CHALLENGE;

    if (position >= duration) return null;

    return {
      elapsed,
      position,
      occurrence,
      cutoffMs,
      duration,
      wins,
      activeIndex: wins.length
        ? Math.min(wins.length - 1, Math.floor(position / SUMMARY_SECONDS_PER_CHALLENGE))
        : -1
    };
  }

  function normalMode(s) {
    const summary = summaryWindow(s);
    if (summary) return { mode:'wins', summary };

    const position = elapsedSeconds(s) % TIMER_CYCLE_SEC;
    return {
      mode: position < TIMER_HIDDEN_SEC ? 'blank' : 'timer',
      summary:null
    };
  }

  function overtimeMode(s) {
    const position = overtimeElapsedSeconds(s) % OVERTIME_CYCLE_SEC;
    return position < OVERTIME_VISIBLE_SEC ? 'overtime' : 'blank';
  }

  function desiredMode(s) {
    if (!isLive(s)) return { mode:'blank', summary:null };
    if (remainingSeconds(s) <= 0) return { mode:overtimeMode(s), summary:null };
    return normalMode(s);
  }

  function setView(mode) {
    if (lastView === mode) return;

    const names = ['blank', 'timer', 'wins', 'overtime'];
    const next = $('overlay-view-' + mode);

    names.forEach(name => {
      const element = $('overlay-view-' + name);
      if (!element || element === next) return;

      if (!element.hidden) {
        element.classList.remove('is-active');
        element.classList.add('is-leaving');
        window.setTimeout(() => {
          if (!element.classList.contains('is-active')) {
            element.hidden = true;
            element.classList.remove('is-leaving');
          }
        }, VIEW_TRANSITION_MS);
      }
    });

    if (next) {
      next.hidden = false;
      next.classList.remove('is-leaving');
      requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-active')));
    }

    lastView = mode;
    if (mode !== 'wins') lastSummaryIndex = -1;
  }

  function summaryRowsHtml(summary) {
    const wins = summary.wins || [];

    if (!wins.length) {
      return '<div class="overlay-no-wins"><strong>Nenhum desafio concluído ainda.</strong><span>O relógio continua esperando alguém aprontar.</span></div>';
    }

    const index = summary.activeIndex;
    const win = wins[index];
    lastSummaryIndex = index;

    const minutes = Number(win?.minutes || 0);
    return '<div class="overlay-win-row">' +
      '<div class="overlay-win-player">' +
        '<strong>' + esc(win?.title || 'Desafio concluído') + '</strong>' +
        '<span>' + esc(win?.winner || 'Comunidade') + '</span>' +
      '</div>' +
      '<b class="' + (minutes < 0 ? 'negative' : '') + '">' + esc(signedMinutes(minutes)) + '</b>' +
    '</div>';
  }

  function paintSummary(summary) {
    const wins = summary.wins || [];
    const totalMinutes = wins.reduce((sum, win) => sum + Number(win?.minutes || 0), 0);

    if ($('overlay-win-count')) {
      if (wins.length) {
        const current = Math.max(1, summary.activeIndex + 1);
        $('overlay-win-count').textContent =
          current + '/' + wins.length + ' · ' + signedMinutes(totalMinutes) + ' agregados';
      } else {
        $('overlay-win-count').textContent = 'nenhum desafio concluído';
      }
    }

    if ($('overlay-winners-list') && summary.activeIndex !== lastSummaryIndex) {
      $('overlay-winners-list').innerHTML = summaryRowsHtml(summary);
    } else if ($('overlay-winners-list') && !wins.length && lastSummaryIndex !== -2) {
      $('overlay-winners-list').innerHTML = summaryRowsHtml(summary);
      lastSummaryIndex = -2;
    }
  }

  function paintFrame() {
    if (!state) {
      setView('blank');
      return;
    }

    const view = desiredMode(state);
    setView(view.mode);

    if (view.mode === 'timer' && $('overlay-clock')) {
      $('overlay-clock').textContent = clock(remainingSeconds(state));
    }

    if (view.mode === 'wins' && view.summary) {
      paintSummary(view.summary);
    }
  }

  async function refreshState() {
    if (!api?.backendUrl || refreshInFlight) return;
    refreshInFlight = true;

    try {
      state = await api.stateLite();
      paintFrame();
    } catch (error) {
      console.warn('Overlay: backend indisponível.', error);
    } finally {
      refreshInFlight = false;
    }
  }

  setView('blank');
  refreshState();
  window.setInterval(refreshState, STATE_REFRESH_MS);
  window.setInterval(paintFrame, FRAME_MS);
})();