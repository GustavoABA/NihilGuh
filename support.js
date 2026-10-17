(() => {
  const api = window.NihilGuhAPI;
  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[char]));
  }

  function durationLabel(minutes) {
    const total = Math.max(0, Math.round(Number(minutes || 0)));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h && m) return h + 'h ' + m + 'min';
    if (h) return h + 'h';
    return m + 'min';
  }

  function dateLabel(raw) {
    if (!raw) return 'Data não registrada';
    const value = new Date(String(raw) + (String(raw).includes('T') ? '' : 'T12:00:00'));
    if (!Number.isFinite(value.getTime())) return String(raw);
    return new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'short', year:'numeric' }).format(value);
  }

  async function loadHistory() {
    const root = $('support-history-list');
    if (!root || !api) return;

    try {
      const data = await api.history(30);
      const sessions = Array.isArray(data?.sessions) ? data.sessions.slice(0, 8) : [];

      if (!sessions.length) {
        root.innerHTML = '<div class="support-history-empty">Ainda não há lives recentes registradas para mostrar.</div>';
        return;
      }

      root.innerHTML = sessions.map(session => {
        const completed = Number(session.metas_batidas || 0);
        const totalGoals = Number(session.metas_total || 0);
        const goalsText = totalGoals > 0 ? completed + '/' + totalGoals + ' metas' : completed + ' metas';
        const status = String(session.status || '').toUpperCase() === 'ONLINE' ? 'ao vivo' : 'encerrada';
        return '<article class="support-history-item">' +
          '<div>' +
            '<strong>' + esc(dateLabel(session.data)) + '</strong>' +
            '<small>Live ' + esc(status) + ' · ' + esc(goalsText) + '</small>' +
          '</div>' +
          '<div class="support-history-meta">' +
            '<b>' + esc(durationLabel(session.tempo_total_min)) + '</b>' +
            '<span>tempo total</span>' +
          '</div>' +
        '</article>';
      }).join('');
    } catch (error) {
      console.warn('Não foi possível carregar o histórico de lives.', error);
      root.innerHTML = '<div class="support-history-empty">Não foi possível carregar o histórico agora.</div>';
    }
  }

  function bindAmounts() {
    const input = $('support-amount');
    const buttons = [...document.querySelectorAll('[data-amount]')];
    if (!input || !buttons.length) return;

    const sync = value => {
      buttons.forEach(button => button.classList.toggle('is-active', Number(button.dataset.amount) === Number(value)));
    };

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        input.value = button.dataset.amount;
        sync(input.value);
        input.focus();
      });
    });

    input.addEventListener('input', () => sync(input.value));
  }

  function bindSupportForm() {
    const form = $('support-form');
    const amount = $('support-amount');
    const name = $('support-name');
    const message = $('support-message');
    const submit = $('support-submit');
    const feedback = $('support-feedback');
    if (!form || !api) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const reais = Number(amount?.value || 0);

      if (!Number.isFinite(reais) || reais < 1 || reais > 5000) {
        feedback.className = 'support-feedback is-error';
        feedback.textContent = 'Escolha um valor entre R$ 1 e R$ 5.000.';
        return;
      }

      submit.disabled = true;
      feedback.className = 'support-feedback';
      feedback.textContent = 'Criando checkout seguro…';

      const popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;

      try {
        const result = await api.call('livepixCheckout', {
          visitorId: api.visitorId(),
          amountCents: Math.round(reais * 100),
          username: String(name?.value || 'Anônimo').trim() || 'Anônimo',
          message: String(message?.value || '').trim() || 'Apoio para a live ♡'
        });

        if (!result?.checkoutUrl) throw new Error('checkout_url_missing');

        feedback.className = 'support-feedback is-ok';
        feedback.textContent = 'Checkout criado. Abrindo o LivePix…';

        if (popup) popup.location.href = result.checkoutUrl;
        else window.location.href = result.checkoutUrl;
      } catch (error) {
        if (popup) popup.close();
        console.warn('Falha ao criar checkout LivePix.', error);
        feedback.className = 'support-feedback is-error';
        feedback.textContent = 'Não foi possível criar o checkout agora. Use o botão para abrir o LivePix diretamente.';
      } finally {
        submit.disabled = false;
      }
    });
  }

  bindAmounts();
  bindSupportForm();
  loadHistory();
})();
