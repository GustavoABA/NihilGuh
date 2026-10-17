(() => {
  const ad = document.querySelector('[data-header-ad]');
  if (!ad) return;

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
})();
