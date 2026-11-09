/*
 * Recorte visual da PAGINA MOBILE Twitch (nao e o player horizontal).
 * Referencia: captura do usuario em 1365x645 px de area da Twitch:
 *   - area do player: 910 px de largura (2/3 do total).
 *   - o video vertical ocupa cerca de 363 x 645 px, centralizado no player.
 *   - o chat inicia depois de x=910.
 *
 * Uma fonte OBS de 1080x1920 gera iframe aproximado de 4063x1920
 * com recorte em CSS, sem ampliacao de um player pequeno.
 *
 * Aviso tecnico: o site m.twitch.tv pode BLOQUEAR incorporacao por
 * Content-Security-Policy frame-ancestors. CSS nao pode contornar isso,
 * nem podemos controlar autoplay de uma pagina cross-origin.
 */
(() => {
  'use strict';
  const stage = document.getElementById('stage');
  const frame = document.getElementById('twitch-mobile');
  const debug = document.getElementById('debug');
  const params = new URLSearchParams(location.search);
  const showDebug = params.get('debug') === '1';
  const manualShift = Number(params.get('shift') || '0');
  const shift = Number.isFinite(manualShift) ? Math.max(-2000, Math.min(2000, manualShift)) : 0;

  function layout() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);

    // Mantem o video vertical original com ~9:16 e SEM scale() CSS.
    const iframeWidth = Math.ceil(Math.max(width, height * (1365 / 645)));
    const iframeHeight = Math.ceil(height);
    // Dentro do layout observado de m.twitch, o player ocupa 2/3 da largura.
    // O video vertical fica centralizado nessa area; o chat fica a direita.
    const centerOfVideo = iframeWidth / 3;
    const left = Math.round(width / 2 - centerOfVideo + shift);

    frame.style.width = iframeWidth + 'px';
    frame.style.height = iframeHeight + 'px';
    frame.style.left = left + 'px';
    frame.style.top = '0px';

    if (showDebug) {
      debug.hidden = false;
      debug.innerHTML = '';
      const details = document.createElement('span');
      details.textContent = 'Recorte Twitch mobile: ' + width + '×' + height +
        ' | iframe ' + iframeWidth + '×' + iframeHeight +
        ' | deslocamento ' + left + 'px. ';
      const link = document.createElement('a');
      link.href = 'https://m.twitch.tv/nihilguh';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Abrir Twitch direta';
      debug.append(details, link);
    }
  }

  layout();
  addEventListener('resize', layout);
  if ('ResizeObserver' in window) {
    new ResizeObserver(layout).observe(stage);
  }
})();
