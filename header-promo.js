(() => {
  const ad = document.querySelector('[data-header-ad]');
  if (ad) {
    const BASE_INTERVAL_MS = 5 * 60 * 1000;
    const JITTER_MS = 30 * 1000;
    const VISIBLE_MS = 18 * 1000;
    let hideTimer = null;
    let nextTimer = null;

    function hideAd() {
      ad.classList.remove('is-visible');
      ad.setAttribute('aria-hidden', 'true');
    }

    function showAd() {
      ad.classList.add('is-visible');
      ad.setAttribute('aria-hidden', 'false');
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        hideAd();
        scheduleNext();
      }, VISIBLE_MS);
    }

    function scheduleNext() {
      clearTimeout(nextTimer);
      const jitter = Math.round((Math.random() * 2 - 1) * JITTER_MS);
      nextTimer = window.setTimeout(showAd, BASE_INTERVAL_MS + jitter);
    }

    hideAd();
    scheduleNext();
  }

  if (document.body.dataset.page !== 'home') return;

  const api = window.NihilGuhAPI;
  const transmission = document.getElementById('transmissao');
  const panel = document.getElementById('home-transmission');
  const player = document.getElementById('home-player');
  const game = panel?.querySelector('.game-embed-v3');
  const summary = panel?.querySelector('.live-summary');
  const eyebrow = panel?.querySelector('.hero-head .eyebrow');
  const badge = panel?.querySelector('[data-live-badge]');

  if (!transmission || !panel || !player || !api) return;

  transmission.removeAttribute('data-live-only');
  transmission.hidden = false;

  const style = document.createElement('style');
  style.textContent = `
    #home-player .replay-art{width:100%;height:100%;padding:0!important;display:block!important;background:#000;overflow:hidden}
    #home-player .replay-art iframe{display:block;width:100%;height:100%;border:0}
    #home-player .replay-fallback{width:100%;height:100%;display:grid;place-items:center;text-align:center;padding:28px;box-sizing:border-box;background:#09070c;color:#a99fb1}
    #home-player .replay-fallback strong{display:block;margin-bottom:8px;color:#f5eff9;font-size:1rem}
    #home-transmission.is-replay .status-badge{background:rgba(169,112,255,.11);border-color:rgba(169,112,255,.22);color:#c9a8ff}
  `;
  document.head.appendChild(style);

  const CHECK_MS = 10000;
  const VOD_CACHE_MS = 5 * 60 * 1000;
  let checking = false;
  let cachedVod = null;
  let cachedAt = 0;
  let replayObserver = null;
  let pendingVod = null;

  function isLive(state) {
    return Boolean(state?.session && state.session.status === 'ONLINE');
  }

  function playerVisibleEnough() {
    const style = getComputedStyle(player);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = player.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const visibleY = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    const visibleX = Math.min(rect.right, vw) - Math.max(rect.left, 0);
    return rect.width >= 320 && rect.height >= 180 && visibleY >= Math.min(120, rect.height * .25) && visibleX > 0;
  }

  function stopReplayObserver() {
    replayObserver?.disconnect();
    replayObserver = null;
    pendingVod = null;
  }

  function setLiveLayout(live) {
    transmission.hidden = false;
    panel.classList.toggle('is-replay', !live);

    if (live) stopReplayObserver();
    if (game) game.hidden = !live;
    if (summary) summary.hidden = !live;

    if (eyebrow) eyebrow.textContent = live ? 'TRANSMISSÃO' : 'ÚLTIMA LIVE';
    if (badge) {
      badge.textContent = live ? '● AO VIVO' : 'REPLAY';
      badge.classList.toggle('online', live);
    }
  }

  async function latestVod() {
    if (Date.now() - cachedAt < VOD_CACHE_MS) return cachedVod;

    const params = new URLSearchParams({
      limit: '1',
      broadcast_type: 'archive',
      video_format: '${url}'
    });

    try {
      const response = await fetch('https://decapi.me/twitch/videos/nihilguh?' + params.toString(), {
        cache: 'no-store',
        mode: 'cors'
      });
      if (!response.ok) throw new Error('vod_http_' + response.status);

      const text = (await response.text()).trim();
      const match = text.match(/twitch\.tv\/videos\/(\d+)/i) || text.match(/video=v?(\d+)/i);
      cachedVod = match ? { id: match[1], url: text } : null;
    } catch (error) {
      console.warn('Não foi possível buscar a última VOD da Twitch.', error);
      cachedVod = null;
    }

    cachedAt = Date.now();
    return cachedVod;
  }

  function mountReplayNow(vod) {
    let wrap = player.querySelector('.offline-art');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'offline-art replay-art';
      player.replaceChildren(wrap);
    }

    wrap.classList.add('replay-art');

    if (!vod?.id) {
      if (!wrap.querySelector('.replay-fallback')) {
        wrap.innerHTML = '<div class="replay-fallback"><div><strong>Última live indisponível agora.</strong><span>Você ainda pode ver as transmissões anteriores direto na Twitch.</span></div></div>';
      }
      return;
    }

    const current = wrap.querySelector('iframe');
    if (current?.dataset.vodId === vod.id) return;

    const parent = location.hostname || 'gustavoaba.github.io';
    const iframe = document.createElement('iframe');
    iframe.title = 'Última live de Nihil Guh na Twitch';
    iframe.dataset.vodId = vod.id;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.scrolling = 'no';
    iframe.src = 'https://player.twitch.tv/?video=v' + encodeURIComponent(vod.id) +
      '&parent=' + encodeURIComponent(parent) + '&autoplay=true&muted=true';

    wrap.replaceChildren(iframe);
  }

  function mountReplay(vod) {
    pendingVod = vod;
    if (playerVisibleEnough()) {
      stopReplayObserver();
      mountReplayNow(vod);
      return;
    }

    let wrap = player.querySelector('.offline-art');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'offline-art replay-art';
      player.replaceChildren(wrap);
    }
    wrap.classList.add('replay-art');
    if (!wrap.querySelector('iframe')) {
      wrap.innerHTML = '<div class="replay-fallback"><div><strong>Última live</strong><span>O replay começa automaticamente quando esta área entrar na tela.</span></div></div>';
    }

    if (replayObserver || !('IntersectionObserver' in window)) return;
    replayObserver = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (!entry?.isIntersecting || entry.intersectionRatio < .15) return;
      const vodToMount = pendingVod;
      stopReplayObserver();
      mountReplayNow(vodToMount);
    }, { threshold: [0, .15, .35] });
    replayObserver.observe(player);
  }

  async function syncReplay() {
    if (checking || document.visibilityState === 'hidden') return;
    checking = true;

    try {
      const state = await api.stateLite();
      const live = isLive(state);
      setLiveLayout(live);

      if (live) return;

      const vod = await latestVod();
      mountReplay(vod);
    } catch (error) {
      console.warn('Não foi possível sincronizar o replay da home.', error);
      setLiveLayout(false);
      mountReplay(null);
    } finally {
      checking = false;
    }
  }

  syncReplay();
  const replayPoll = window.setInterval(syncReplay, CHECK_MS);
  window.addEventListener('pagehide', () => {
    clearInterval(replayPoll);
    stopReplayObserver();
  }, { once: true });
})();