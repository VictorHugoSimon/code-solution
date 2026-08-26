import fs from 'node:fs/promises';

const file = 'deploy/index.html';
const templateOpen = '<script type="__bundler/template">';

const funnel = `<style data-cs-home-journey-style>
.cs-journey{margin-top:54px;border:1px solid rgba(155,92,255,.3);border-radius:24px;background:linear-gradient(145deg,rgba(123,63,228,.16),rgba(255,255,255,.025));padding:clamp(24px,4vw,42px);overflow:hidden}.cs-journey-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}.cs-journey-head h2{margin-bottom:8px}.cs-progress{display:flex;gap:7px;align-items:center;margin:22px 0 28px}.cs-progress span{height:6px;flex:1;border-radius:999px;background:rgba(255,255,255,.09);transition:.25s}.cs-progress span.on{background:linear-gradient(90deg,#7b3fe4,#b985ff)}.cs-step{display:none}.cs-step.active{display:block}.cs-step h3{font-size:22px;margin-bottom:8px}.cs-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.cs-option{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--cs-line);background:#0d0a13;border-radius:14px;padding:16px;cursor:pointer;transition:.2s}.cs-option:hover{border-color:rgba(155,92,255,.55);transform:translateY(-1px)}.cs-option input{margin-top:4px}.cs-option strong{display:block;margin-bottom:3px}.cs-option small{display:block;color:var(--cs-muted);line-height:1.4}.cs-option:has(input:checked){border-color:#9b5cff;background:rgba(155,92,255,.12);box-shadow:0 0 0 2px rgba(155,92,255,.08)}.cs-journey .cs-field select{width:100%;border:1px solid var(--cs-line);background:#0d0a13;color:var(--cs-text);border-radius:11px;padding:12px 13px;font:inherit;outline:none}.cs-step-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:22px}.cs-step-actions .right{display:flex;gap:10px;flex-wrap:wrap;margin-left:auto}.cs-journey-note{font-size:12px;color:var(--cs-muted);margin-top:12px}.cs-success{display:none;border:1px solid rgba(92,228,154,.3);border-radius:18px;background:rgba(92,228,154,.07);padding:24px}.cs-success.active{display:block}.cs-success-badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(92,228,154,.12);color:var(--cs-green);font-size:12px;font-weight:800;margin-bottom:12px}.cs-success h3{font-size:26px;margin-bottom:8px}.cs-protocol{display:inline-flex;align-items:center;gap:7px;margin:10px 0 18px;padding:9px 12px;border-radius:10px;background:#0d0a13;border:1px solid var(--cs-line);font-size:13px}.cs-next-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}.cs-next{border:1px solid var(--cs-line);border-radius:13px;padding:14px;background:#0d0a13}.cs-next b{display:block;font-size:12px;color:var(--cs-lilac);margin-bottom:5px}.cs-next span{font-size:13px;color:var(--cs-muted)}.cs-route{margin-top:16px;padding:16px;border-radius:14px;background:rgba(155,92,255,.09);border:1px solid rgba(155,92,255,.22)}.cs-route strong{display:block;margin-bottom:4px}.cs-route p{margin:0;color:var(--cs-muted)}
@media(max-width:760px){.cs-options,.cs-next-grid{grid-template-columns:1fr}.cs-step-actions .right{width:100%;margin-left:0}.cs-step-actions .right .cs-btn{flex:1}}
</style>
<div class="cs-journey" id="cs-home-lead" data-cs-home-journey>
  <div class="cs-journey-head"><div><span class="cs-kicker">Comece por aqui</span><h2>Conte o cenário. A Code Solution organiza o próximo passo.</h2><p class="cs-intro">Leva poucos minutos. Suas respostas entram no CRM com contexto para o atendimento continuar sem você repetir tudo.</p></div></div>
  <div class="cs-progress" aria-label="Progresso"><span class="on"></span><span></span><span></span></div>
  <form class="cs-lead-form" id="cs-home-lead-form" novalidate>
    <section class="cs-step active" data-step="1"><h3>1. O que você quer resolver?</h3><p class="cs-intro">Não precisa saber a tecnologia. Escolha o que mais se aproxima da sua necessidade.</p>
      <div class="cs-options">
        <label class="cs-option"><input type="radio" name="solution" value="Sistema ou software sob medida"><span><strong>Sistema ou software</strong><small>Portal, plataforma, app, SaaS ou processo específico.</small></span></label>
        <label class="cs-option"><input type="radio" name="solution" value="Automação e integrações"><span><strong>Automação e integrações</strong><small>Eliminar retrabalho e conectar ERP, APIs, planilhas e sistemas.</small></span></label>
        <label class="cs-option"><input type="radio" name="solution" value="Inteligência artificial"><span><strong>Inteligência artificial</strong><small>Agentes, copilotos, atendimento e IA aplicada ao negócio.</small></span></label>
        <label class="cs-option"><input type="radio" name="solution" value="Dados e BI"><span><strong>Dados e BI</strong><small>Indicadores, dashboards, banco de dados e decisão.</small></span></label>
        <label class="cs-option"><input type="radio" name="solution" value="Preciso entender o melhor caminho"><span><strong>Ainda não sei</strong><small>Tenho um problema e quero entender o melhor caminho.</small></span></label>
      </div>
      <div class="cs-step-actions"><span></span><div class="right"><button class="cs-btn" type="button" data-next="2">Continuar</button></div></div><p class="cs-result" data-step-error="1" role="status"></p>
    </section>
    <section class="cs-step" data-step="2"><h3>2. Contexto da empresa</h3><p class="cs-intro">Isso ajuda a direcionar a conversa para o cenário certo.</p>
      <div class="cs-form-grid">
        <label class="cs-field"><span>Segmento *</span><select name="segment" required><option value="">Selecione</option><option>Agro</option><option>Logística e transporte</option><option>Varejo e e-commerce</option><option>Indústria</option><option>Serviços</option><option>Financeiro</option><option>Outro</option></select></label>
        <label class="cs-field"><span>Em que estágio está? *</span><select name="stage" required><option value="">Selecione</option><option value="processo_manual">Hoje é manual / planilha</option><option value="sistema_existente">Já existe sistema e precisa evoluir</option><option value="novo_projeto">Novo projeto</option><option value="integracao">Preciso integrar sistemas</option><option value="avaliacao">Estou avaliando possibilidades</option></select></label>
        <label class="cs-field"><span>Urgência *</span><select name="urgency" required><option value="">Selecione</option><option value="alta">Quero começar agora</option><option value="media">Próximos 30–90 dias</option><option value="baixa">Ainda estou planejando</option></select></label>
        <label class="cs-field"><span>Orçamento</span><select name="budget"><option value="avaliando">Ainda estou avaliando</option><option value="definido">Já tenho orçamento definido</option><option value="sem_definicao">Ainda não defini</option></select></label>
        <label class="cs-field"><span>Você participa da decisão?</span><select name="decisionMaker"><option value="sim">Sim</option><option value="nao">Não / participo com outras pessoas</option></select></label>
      </div>
      <div class="cs-step-actions"><button class="cs-btn alt" type="button" data-back="1">Voltar</button><div class="right"><button class="cs-btn" type="button" data-next="3">Continuar</button></div></div><p class="cs-result" data-step-error="2" role="status"></p>
    </section>
    <section class="cs-step" data-step="3"><h3>3. Como podemos continuar com você?</h3><p class="cs-intro">Deixe o contato e explique o principal problema. O restante já vai junto para o CRM.</p>
      <div class="cs-form-grid">
        <label class="cs-field"><span>Nome *</span><input name="name" autocomplete="name" maxlength="120" required></label>
        <label class="cs-field"><span>WhatsApp *</span><input name="whatsapp" autocomplete="tel" inputmode="tel" maxlength="40" placeholder="(18) 99999-9999" required></label>
        <label class="cs-field"><span>E-mail</span><input name="email" type="email" autocomplete="email" maxlength="160"></label>
        <label class="cs-field"><span>Empresa</span><input name="company" autocomplete="organization" maxlength="160"></label>
        <label class="cs-field full"><span>Qual é o principal problema ou resultado que você quer alcançar? *</span><textarea name="need" maxlength="1800" required placeholder="Ex.: hoje controlamos pedidos em planilhas e precisamos integrar comercial, estoque e financeiro..."></textarea></label>
      </div>
      <label class="cs-consent"><input name="consent" type="checkbox"> <span>Autorizo a Code Solution a usar estes dados para responder esta solicitação, conforme a <a href="/privacidade/">Política de Privacidade</a>.</span></label>
      <div class="cs-step-actions"><button class="cs-btn alt" type="button" data-back="2">Voltar</button><div class="right"><button class="cs-btn" type="submit">Enviar e ver meu próximo passo</button></div></div><p class="cs-result" data-cs-lead-result role="status" aria-live="polite"></p>
    </section>
  </form>
  <div class="cs-success" data-cs-success><span class="cs-success-badge">Solicitação recebida</span><h3>Pronto. Seu contexto já está com a Code Solution.</h3><p class="cs-intro">Você não precisa repetir essas informações. O lead foi registrado no CRM com o cenário informado.</p><div class="cs-protocol">Protocolo <strong data-protocol>—</strong></div>
    <div class="cs-next-grid"><div class="cs-next"><b>1. Registrado</b><span>Seu cenário entra no CRM com origem e qualificação.</span></div><div class="cs-next"><b>2. Direcionado</b><span>O time consegue entender prioridade, segmento e necessidade.</span></div><div class="cs-next"><b>3. Próximo passo</b><span>Você pode avançar agora ou aguardar a continuidade comercial.</span></div></div>
    <div class="cs-route"><strong data-route-title>Próximo passo recomendado</strong><p data-route-text>Complete uma etapa rápida enquanto seu atendimento já está registrado.</p></div>
    <div class="cs-actions"><a class="cs-btn" data-route-link href="/diagnostico/">Continuar</a><a class="cs-btn alt" href="/calculadora/">Estimar projeto</a><a class="cs-btn alt" href="/assistente/">Falar com a Code Solution</a><a class="cs-btn alt" data-wa-link href="https://wa.me/5518996809954" target="_blank" rel="noopener noreferrer">Continuar no WhatsApp</a></div><p class="cs-journey-note">O WhatsApp é opcional. Sua solicitação já foi registrada mesmo que você não abra o aplicativo.</p>
  </div>
</div>
<script src="/home-journey.js" defer></script>`;

function replaceJourney(markup, required = false) {
  if (markup.includes('data-cs-home-journey')) return markup;
  const block = /<div[^>]*id="cs-home-lead"[^>]*>[\s\S]*?<\/script>/;
  if (!block.test(markup)) {
    if (required) throw new Error('Bloco cs-home-lead original não encontrado no template do cliente');
    return markup;
  }
  return markup
    .replace(block, funnel)
    .replace(/Você pode explorar soluções por setor, estimar uma faixa de investimento, medir a maturidade digital ou conversar com a Code Solution\. Tudo parte do problema real da operação\./g, 'Comece pela jornada guiada abaixo ou explore as ferramentas da Code Solution. Tudo parte do problema real da operação.');
}

function encodeTemplate(value) {
  return JSON.stringify(value).replace(/<\/script/gi, '<\\/script');
}

let html = await fs.readFile(file, 'utf8');
const templateRe = /<script type="__bundler\/template">([\s\S]*?)<\/script>/;
const match = html.match(templateRe);
if (!match) throw new Error('__bundler/template não encontrado em deploy/index.html');

let template;
try { template = JSON.parse(match[1]); }
catch (error) { throw new Error(`Template original inválido antes da jornada: ${error.message}`); }

const transformedTemplate = replaceJourney(template, true);
const transformedOuter = replaceJourney(html, false);
let nextHtml = transformedOuter;

const nextMatch = nextHtml.match(templateRe);
if (!nextMatch) throw new Error('__bundler/template desapareceu após transformação');
nextHtml = nextHtml.replace(templateRe, `${templateOpen}${encodeTemplate(transformedTemplate)}</script>`);

await fs.writeFile(file, nextHtml);

const verify = await fs.readFile(file, 'utf8');
const verifyMatch = verify.match(templateRe);
if (!verifyMatch) throw new Error('Template empacotado ausente após gravação');
const verifyTemplate = JSON.parse(verifyMatch[1]);
for (const marker of ['data-cs-home-journey','Enviar e ver meu próximo passo','data-cs-success','/home-journey.js']) {
  if (!verifyTemplate.includes(marker)) throw new Error(`Template da Home inválido: ausente ${marker}`);
}
if (/Conversar com o Codi|>Codi</i.test(verifyTemplate)) throw new Error('Branding legado Codi encontrado na Home');
console.log('Jornada guiada da Home aplicada de forma bundle-safe e idempotente.');
