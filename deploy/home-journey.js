(function () {
  var API = 'https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev';

  function init() {
    var root = document.querySelector('[data-cs-home-journey]');
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    var form = root.querySelector('#cs-home-lead-form');
    var steps = Array.prototype.slice.call(root.querySelectorAll('[data-step]'));
    var bars = Array.prototype.slice.call(root.querySelectorAll('.cs-progress span'));
    var success = root.querySelector('[data-cs-success]');
    var result = root.querySelector('[data-cs-lead-result]');

    function go(n) {
      steps.forEach(function (step) {
        step.classList.toggle('active', step.getAttribute('data-step') === String(n));
      });
      bars.forEach(function (bar, i) { bar.classList.toggle('on', i < n); });
      if (root.scrollIntoView) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function setStepError(n, text) {
      var target = root.querySelector('[data-step-error="' + n + '"]');
      if (!target) return;
      target.textContent = text || '';
      target.className = 'cs-result ' + (text ? 'err' : '');
    }

    function attribution() {
      try {
        var q = new URLSearchParams(location.search);
        return {
          source: q.get('utm_source') || 'site_home_journey',
          campaign: q.get('utm_campaign') || null,
          medium: q.get('utm_medium') || null,
          content: q.get('utm_content') || null,
          term: q.get('utm_term') || null,
          landingPage: location.pathname,
          referrer: document.referrer || null
        };
      } catch (_) {
        return { source: 'site_home_journey', landingPage: '/' };
      }
    }

    function validateStep(n) {
      var fd = new FormData(form);
      if (n === 1 && !fd.get('solution')) {
        setStepError(1, 'Escolha a opção que mais se aproxima da sua necessidade.');
        return false;
      }
      if (n === 2 && (!fd.get('segment') || !fd.get('stage') || !fd.get('urgency'))) {
        setStepError(2, 'Preencha segmento, estágio e urgência para continuar.');
        return false;
      }
      setStepError(n, '');
      return true;
    }

    root.addEventListener('click', function (event) {
      var next = event.target.closest('[data-next]');
      var back = event.target.closest('[data-back]');
      if (next) {
        var target = Number(next.getAttribute('data-next'));
        if (validateStep(target - 1)) go(target);
      }
      if (back) go(Number(back.getAttribute('data-back')));
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var fd = new FormData(form);
      var name = String(fd.get('name') || '').trim();
      var whatsapp = String(fd.get('whatsapp') || '').trim();
      var email = String(fd.get('email') || '').trim();
      var company = String(fd.get('company') || '').trim();
      var need = String(fd.get('need') || '').trim();

      if (name.length < 2) return showError('Informe seu nome.');
      if (whatsapp.replace(/\D/g, '').length < 10) return showError('Informe um WhatsApp válido.');
      if (need.length < 8) return showError('Descreva o problema ou resultado que você quer alcançar.');
      if (!form.querySelector('input[name="consent"]').checked) return showError('Marque a autorização para que a Code Solution possa retornar seu contato.');

      var button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Registrando…';
      result.textContent = 'Registrando sua solicitação no CRM…';
      result.className = 'cs-result';

      var solution = String(fd.get('solution') || '');
      var segment = String(fd.get('segment') || '');
      var stage = String(fd.get('stage') || '');
      var urgency = String(fd.get('urgency') || '');
      var budget = String(fd.get('budget') || 'avaliando');
      var decisionMaker = String(fd.get('decisionMaker') || 'nao');

      var payload = Object.assign({
        name: name,
        whatsapp: whatsapp,
        email: email || undefined,
        company: company || undefined,
        segment: segment,
        need: solution + ' — ' + need,
        businessType: 'empresa',
        urgency: urgency,
        budget: budget,
        decisionMaker: decisionMaker,
        notes: 'Jornada Home | Solução: ' + solution + ' | Estágio: ' + stage,
        consentAt: new Date().toISOString()
      }, attribution());

      try {
        var response = await fetch(API + '/lead', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = await response.json();
        if (!response.ok) throw new Error(data.error || 'lead_failed');

        form.style.display = 'none';
        success.classList.add('active');
        root.querySelector('[data-protocol]').textContent = data.leadId || 'registrado';

        var route = {
          href: '/diagnostico/',
          label: 'Fazer Diagnóstico Digital',
          title: 'Diagnóstico recomendado',
          text: 'Mapeie rapidamente maturidade, gargalos e prioridades antes da conversa.'
        };
        if (/Sistema|software|Automação|integrações/i.test(solution)) {
          route = {
            href: '/calculadora/',
            label: 'Estimar meu projeto',
            title: 'Estimativa recomendada',
            text: 'Veja uma faixa preliminar de investimento e prazo com base no tipo de projeto.'
          };
        }
        if (/Inteligência artificial|Ainda não sei|entender o melhor caminho/i.test(solution)) {
          route = {
            href: '/assistente/',
            label: 'Continuar com a Code Solution',
            title: 'Conversa guiada recomendada',
            text: 'Continue detalhando o cenário com o assistente da Code Solution; seu lead já está registrado.'
          };
        }

        var link = root.querySelector('[data-route-link]');
        link.href = route.href;
        link.textContent = route.label;
        root.querySelector('[data-route-title]').textContent = route.title;
        root.querySelector('[data-route-text]').textContent = route.text;

        var wa = 'Olá, Code Solution. Acabei de preencher a jornada do site. Protocolo: ' + (data.leadId || '') + '. Necessidade: ' + solution + '.';
        root.querySelector('[data-wa-link]').href = 'https://wa.me/5518996809954?text=' + encodeURIComponent(wa);

        try {
          if (window.gtag) window.gtag('event', 'generate_lead', { method: 'home_guided_journey', lead_score: data.score || 0, solution: solution });
        } catch (_) {}
      } catch (_) {
        showError('Não consegui registrar agora. Tente novamente ou use o WhatsApp como alternativa.');
        button.disabled = false;
        button.textContent = 'Enviar e ver meu próximo passo';
      }
    });

    function showError(text) {
      result.textContent = text;
      result.className = 'cs-result err';
      return false;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
