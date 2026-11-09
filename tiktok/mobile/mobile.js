/* NihilGuh — portrait Twitch embed for TikTok/OBS.
 * Twitch's m.twitch.tv page is not an authorized embed. This route instead uses
 * Twitch.Embed with a 400 CSS-pixel internal viewport, scaled to the 9:16 stage.
 *
 * Default:  ?mode=mobile (video + chat stacked on narrow layouts)
 * Alternate:?mode=video  (video only)
 * Optional: ?muted=1  (starts muted, better autoplay compatibility)
 *           ?clean=1  (no recovery ribbon — use only when browser is configured)
 */
(() => {
  'use strict';

  const CHANNEL = 'nihilguh';
  const NARROW_WIDTH = 400; // Minimum accepted width for Twitch's embedded player.
  const qs = new URLSearchParams(window.location.search);
  const mode = qs.get('mode') === 'video' ? 'video' : 'mobile';
  const clean = qs.get('clean') === '1';
  const initialMuted = qs.get('muted') === '1';
  const stage = document.getElementById('stage');
  const target = document.getElementById('twitch-embed');
  const ribbon = document.getElementById('ribbon');
  const message = document.getElementById('ribbon-message');
  const action = document.getElementById('ribbon-action');
  const channelLink = document.getElementById('ribbon-link');

  let player = null;
  let mutedRetryAttempted = false;
  let isPlaying = false;

  function showRibbon(description, buttonLabel = '') {
    if (clean) return;
    message.textContent = description;
    action.textContent = buttonLabel;
    action.hidden = !buttonLabel;
    channelLink.hidden = false;
    ribbon.hidden = false;
    updateSize();
  }

  function hideRibbon() {
    ribbon.hidden = true;
    updateSize();
  }

  // For portrait OBS canvases (e.g. 1080x1920), give Twitch a 400 CSS-pixel
  // mobile-width layout so the official embed places chat below the video.
  // Scale the entire player to the browser source's full width and height.
  // The Twitch embed itself is never cropped or covered by site elements.
  function updateSize() {
    const bounds = stage.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const portrait = height > width;
    const logicalWidth = portrait ? NARROW_WIDTH : Math.max(NARROW_WIDTH, Math.round(width));
    const scale = width / logicalWidth;
    target.style.width = logicalWidth + 'px';
    target.style.height = Math.max(300, Math.ceil(height / scale)) + 'px';
    target.style.transform = 'scale(' + scale + ')';
  }

  window.addEventListener('resize', updateSize);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(updateSize).observe(stage);
  }
  updateSize();

  action.addEventListener('click', () => {
    if (!player) {
      window.location.reload();
      return;
    }
    try {
      player.setVolume(1);
      player.setMuted(false);
      player.play();
      // A browser may still block playback: the PLAYBACK_BLOCKED event
      // will restore a recovery control if that happens.
      hideRibbon();
    } catch (error) {
      showRibbon('Clique no botão de reprodução dentro do player Twitch.', 'Tentar com som');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyF' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  if (!window.Twitch || !window.Twitch.Embed || !window.location.hostname) {
    showRibbon('Não foi possível carregar o script da Twitch. Confira a conexão.', 'Recarregar');
    return;
  }

  let embed;
  try {
    embed = new window.Twitch.Embed('twitch-embed', {
      channel: CHANNEL,
      width: '100%',
      height: '100%',
      layout: mode === 'mobile' ? 'video-with-chat' : 'video',
      autoplay: true,
      muted: initialMuted,
      theme: 'dark',
      parent: [window.location.hostname]
    });
  } catch (error) {
    showRibbon('O player da Twitch não pôde ser iniciado.', 'Recarregar');
    return;
  }

  embed.addEventListener(window.Twitch.Embed.VIDEO_READY, () => {
    player = embed.getPlayer();
    if (!player) {
      showRibbon('O player da Twitch não respondeu.', 'Recarregar');
      return;
    }

    player.addEventListener(window.Twitch.Player.PLAYBACK_BLOCKED, () => {
      if (!mutedRetryAttempted) {
        mutedRetryAttempted = true;
        try {
          player.setMuted(true);
          player.play();
        } catch (error) {
          // Browsers on actual phones may need an interaction on Twitch itself.
        }
      }
      showRibbon('O navegador bloqueou o início com áudio.', '▶ Ativar áudio');
    });

    player.addEventListener(window.Twitch.Player.PLAYING, () => {
      isPlaying = true;
      try {
        if (player.getMuted()) {
          showRibbon('A live está tocando sem som.', '🔊 Ativar áudio');
        } else {
          hideRibbon();
        }
      } catch (error) {
        hideRibbon();
      }
    });

    player.addEventListener(window.Twitch.Player.OFFLINE, () => {
      isPlaying = false;
      showRibbon('O canal NihilGuh está offline na Twitch.');
    });

    player.addEventListener(window.Twitch.Player.ONLINE, () => {
      if (!isPlaying) {
        try {
          player.play();
        } catch (error) {
          showRibbon('Clique em reproduzir dentro do player da Twitch.', '▶ Reproduzir');
        }
      }
    });

    // Start playback even on embedded browsers which did not honor autoplay.
    // If unmuted autoplay is refused, PLAYBACK_BLOCKED switches to muted.
    try {
      player.play();
    } catch (error) {
      showRibbon('Toque no player para iniciar a transmissão.', '▶ Reproduzir');
    }
  });
})();
