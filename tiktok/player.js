/* NihilGuh /tiktok/
 * Player Twitch oficial e independente do restante do site.
 *
 * Padrão: tenta autoplay COM áudio. Se o navegador bloquear, tenta
 * novamente sem áudio e oferece um botão para ativá-lo com um clique.
 *
 * ?muted=1  -> começa mutado (autoplay mais compatível).
 * ?clean=1  -> oculta o botão de recuperação; útil somente em capturas
 *              com autoplay já autorizado pelo navegador.
 * F          -> solicita tela cheia de navegador após uma tecla do usuário.
 * A página sempre ocupa 100% da área da fonte no OBS, sem precisar de F11.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const startMuted = params.get('muted') === '1';
  const clean = params.get('clean') === '1';
  const recovery = document.getElementById('recovery');
  const resumeButton = document.getElementById('resume');
  const notice = document.getElementById('notice');

  const showRecovery = (label) => {
    if (clean) return;
    resumeButton.textContent = label;
    recovery.hidden = false;
  };
  const hideRecovery = () => { recovery.hidden = true; };
  const showError = (message) => {
    notice.textContent = message;
    notice.hidden = false;
    showRecovery('▶ Tentar novamente');
  };

  // Requesting browser fullscreen on initial load is prohibited without
  // a user gesture. For an OBS browser source the CSS already fills the frame.
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyF' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  if (!window.Twitch || !window.Twitch.Player || !window.location.hostname) {
    showError('Player indisponível. Abra esta página em HTTPS e recarregue.');
    resumeButton.addEventListener('click', () => window.location.reload());
    return;
  }

  let player;
  let playbackBlocked = false;
  try {
    player = new window.Twitch.Player('twitch-player', {
      channel: 'nihilguh',
      width: '100%',
      height: '100%',
      autoplay: true,
      muted: startMuted,
      parent: [window.location.hostname]
    });
  } catch (error) {
    showError('Não foi possível iniciar a Twitch. Recarregue a página.');
    resumeButton.addEventListener('click', () => window.location.reload());
    return;
  }

  const tryWithSound = () => {
    if (!player) return;
    try {
      notice.hidden = true;
      playbackBlocked = false;
      player.setVolume(1);
      player.setMuted(false);
      player.play();
      hideRecovery();
    } catch (error) {
      showRecovery('▶ Tentar ativar o som');
    }
  };

  resumeButton.addEventListener('click', () => {
    // A click is a valid gesture for browsers that block autoplay or sound.
    tryWithSound();
  });

  player.addEventListener(window.Twitch.Player.READY, () => {
    player.setVolume(1);
    if (startMuted) {
      showRecovery('🔊 Ativar som');
    } else {
      // An explicit play() also helps some desktop browser-source setups.
      player.play();
    }
  });

  player.addEventListener(window.Twitch.Player.PLAYBACK_BLOCKED, () => {
    if (playbackBlocked) return;
    playbackBlocked = true;
    // Muted autoplay is more compatible on desktop; mobile may still
    // require a click, which is why the recovery button remains available.
    try {
      player.setMuted(true);
      player.play();
    } catch (error) {
      // Recovery remains available even when the fallback cannot play.
    }
    showRecovery('▶ Iniciar live com som');
  });

  player.addEventListener(window.Twitch.Player.PLAYING, () => {
    if (!player.getMuted()) {
      playbackBlocked = false;
      hideRecovery();
    } else {
      showRecovery('🔊 Ativar som');
    }
  });
})();
