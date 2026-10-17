(() => {
  const api = window.NihilGuhAPI;

  const TIMER_HIDDEN_SEC = 3 * 60;
  const TIMER_VISIBLE_SEC = 3 * 60;
  const TIMER_CYCLE_SEC = TIMER_HIDDEN_SEC + TIMER_VISIBLE_SEC;

  const SUMMARY_INTERVAL_SEC = 15 * 60;
  const SUMMARY_VISIBLE_SEC = 20;

  const OVERTIME_VISIBLE_SEC = 5 * 60;
  const OVERTIME_HIDDEN_SEC = 2 * 60;
  const OVERTIME_CYCLE_SEC = OVERTIME_VISIBLE_SEC + OVERTIME_HIDDEN_SEC;

  const STATE_REFRESH_MS = 5000;
  const FRAME_MS = 250;
  const VIEW_TRANSITION_MS = 460;

  let state = null;
  let refreshInFlight = false;
  let lastView = '';
  let lastSummaryPage = -1;

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

  function completedChallenges(s) {
    if (!isLive(s)) return [];
    const wins = Array.isArray(s?.overlay?.recentWins) ? s.overlay.recentWins : [];
    const started = sessionStartMs(s);
    const now = Date.now();

    return wins
      .filter(win => {
        const at = new Date(win?.at).getTime();
        return !Number.isFinite(started) || !Number.isFinite(at) || (at >= started && at <= now);
      })
      .slice()
      .sort((a, b) => new Date(a?.at).getTime() - new Date(b?.at).getTime());
  }

  function summaryWindow(s) {
    const elapsed = elapsedSeconds(s);
    if (elapsed < SUMMARY_INTERVAL_SEC) return null;

    const position = elapsed % SUMMARY_INTERVAL_SEC;
    if (position >= SUMMARY_VISIBLE_SEC) return null;

    return {
      elapsed,
      position,
      occurrence: Math.floor(elapsed / SUMMARY_INTERVAL_SEC)
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
    if (mode !== 'wins') lastSummaryPage = -1;
  }

  function summaryRowsHtml(wins, summary) {
    if (!wins.length) {
      return '<div class="overlay-no-wins"><strong>Nenhum desafio concluído ainda.</strong><span>O relógio continua esperando alguém aprontar.</span></div>';
    }

    const pageSize = 4;
    const pages = Math.max(1, Math.ceil(wins.length / pageSize));
    const pageDuration = SUMMARY_VISIBLE_SEC / pages;
    const page = Math.min(pages - 1, Math.floor(summary.position / Math.max(0.5, pageDuration)));
    const slice = wins.slice(page * pageSize, page * pageSize + pageSize);

    lastSummaryPage = page;

    return slice.map(win => {
      const minutes = Number(win?.minutes || 0);
      return '<div class="overlay-win-row">' +
        '<div class="overlay-win-player">' +
          '<strong>' + esc(win?.title || 'Desafio concluído') + '</strong>' +
          '<span>' + esc(win?.winner || 'Comunidade') + '</span>' +
        '</div>' +
        '<b class="' + (minutes < 0 ? 'negative' : '') + '">' + esc(signedMinutes(minutes)) + '</b>' +
      '</div>';
    }).join('');
  }

  function paintSummary(s, summary) {
    const wins = completedChallenges(s);
    const totalMinutes = wins.reduce((sum, win) => sum + Number(win?.minutes || 0), 0);

    if ($('overlay-win-count')) {
      $('overlay-win-count').textContent = wins.length
        ? wins.length + (wins.length === 1 ? ' desafio · ' : ' desafios · ') + signedMinutes(totalMinutes) + ' agregados'
        : 'nenhum desafio concluído';
    }

    if ($('overlay-winners-list')) {
      $('overlay-winners-list').innerHTML = summaryRowsHtml(wins, summary);
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
      paintSummary(state, view.summary);
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