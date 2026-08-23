# Site Code Solution — pacote fonte recebido em 23/08/2026

Este documento registra o pacote entregue pelo proprietário como referência de continuidade do site.

## Identificação

- Arquivo recebido: `Site Code Solution.zip`
- SHA-256: `0e3e19e9e049cdcf25804325f63252b4c3f41fe3e44590a7c801d0f97b8f1da1`
- Data de incorporação: 23/08/2026

## Arquivos do pacote

### Documentação
- `DOCUMENTACAO-COMPLETA.md`
- `EXECUTAR.md`
- `Estrategia-SEO-Code-Solution.md`
- `HANDOFF-CODE-SOLUTION.md`
- `PATCH-MELHORIAS.md`
- `sitemap-novas-rotas.xml`

### Fontes do site
- `Assistente Atendimento.dc.html`
- `Blog.dc.html`
- `Calculadora.dc.html`
- `Calendario Editorial.dc.html`
- `Code Solution.dc.html`
- `Destaques.dc.html`
- `Ecossistema Automatizado.dc.html`
- `Inteligencia de Mercado.dc.html`
- `Kit de Marca.dc.html`
- `LEIA-ME.md`
- `Manual do Prospector.dc.html`
- `Painel Marketing.dc.html`
- `Painel.dc.html`
- `Posts.dc.html`
- `Redes Sociais.dc.html`
- `Servicos.dc.html`
- `Setores.dc.html`
- `blog-posts.js`
- `doc-page.js`
- `site-i18n.js`
- `support.js`

### Workers
- `robo/atendente-worker.js`
- `robo/worker.js`
- `robo/wrangler.toml`

## Regra de precedência

1. `main` no GitHub é a fonte executável e auditável do que será publicado.
2. `deploy/` é o bundle de publicação e nunca deve ser substituído por uma pasta incompleta.
3. O pacote recebido é referência de produto, copy, UX e fontes `.dc.html`; melhorias úteis devem ser incorporadas de forma seletiva ao repositório, preservando CRM, Codi, D1, autenticação, blog estático, AEO e automações já existentes.
4. As faixas da Calculadora aprovadas em 23/08/2026 não devem ser alteradas sem nova aprovação do proprietário.
5. Credenciais, tokens e chaves nunca devem ser versionados.

## Itens já incorporados do pacote

- `/setores/` com Agro, Logística e Varejo e estrutura AEO.
- `/calculadora/` com faixas aprovadas e CTA de WhatsApp.
- Links comerciais de Home/Serviços para Setores, Calculadora, Diagnóstico e Codi.
- FAQ/AEO comercial na Home e bloco AEO visível em Serviços.
- Captura de lead do Codi para `/lead` com consentimento, UTM e GA4.
- Telemetria GA4 do Codi e Diagnóstico.
- Deploy de Pages com autodetecção do projeto existente (`codesolution-site` ou `codesolution`).
- Associação automatizada dos domínios `www.codesolution.com.br` e `codesolution.com.br` quando as credenciais Cloudflare estiverem disponíveis.
- STAGE isolado preparado com D1 `code-solution-crm-stage` e Worker `code-solution-atendente-stage`.
