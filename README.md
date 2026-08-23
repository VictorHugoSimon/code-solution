# Code Solution — site, automação, conteúdo, atendimento e CRM

Este repositório é a fonte versionada da operação digital da Code Solution.

## Estado atual

### Código e build
- pipeline de conteúdo com validação e geração do `content/blog/index.json`;
- blog estático multilíngue (PT/EN/ES) com canonical, hreflang, `BlogPosting` e sitemap;
- preparação SEO/AEO da Home, Serviços e Blog;
- página `/setores/` com soluções para Agro, Logística e Varejo;
- página `/calculadora/` com estimativa de faixa de projeto;
- landing `/diagnostico/` com score local 0–100 e CTA para WhatsApp, sem armazenamento das respostas do diagnóstico;
- assistente `/assistente/` com conversa Codi e captura voluntária de lead com consentimento para o CRM;
- página `/privacidade/`;
- CRM Kanban em `/painel/crm/` com 12 etapas, Lead Score, timeline, responsável, próxima ação, vencimento, valor, previsão e motivo de perda;
- schema D1 em `crm/migrations/0001_init.sql`;
- autenticação de `/painel/*` na borda do Pages e proxy same-origin `/api/crm/*`, sem expor `CRM_ADMIN_KEY` no JavaScript;
- redirect canônico preparado para `codesolution.com.br` → `www.codesolution.com.br`;
- deploy Workers capaz de provisionar D1, aplicar schema, publicar e executar smoke test;
- deploy Pages capaz de construir, preparar SEO/AEO, publicar e executar smoke test;
- smoke público persistido em `docs/public-smoke-status.json`.

### Produção observada
- `https://www.codesolution.com.br/` responde;
- `https://www.codesolution.com.br/servicos/` responde;
- os Workers públicos respondem no subdomínio `victorhugoteixeirasimon6.workers.dev`;
- as versões públicas dos Workers ainda são anteriores ao build atual do repositório;
- as novas rotas estáticas dependem do próximo deploy do Cloudflare Pages;
- o domínio sem `www` ainda precisa receber o deploy/roteamento novo para executar o redirect 301 preparado na borda.

### Bloqueio de deploy do GitHub Actions
O repositório precisa dos repository secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Nunca coloque esses valores em commit, issue, arquivo versionado ou chat.

Depois que ambos existirem, os workflows de Pages e Workers executam a automação de publicação. O workflow de Workers também cria/localiza `code-solution-crm`, aplica a migration e injeta o binding D1 no deploy do atendente.

## Runtime secrets esperados no Cloudflare

### `code-solution-robo`
- `AI_API_KEY`
- `GITHUB_TOKEN`
- `MANUAL_KEY` para `/run` manual

Artigos normais usam sitemap/crawl para descoberta e indexação. A Google Indexing API não faz parte deste fluxo.

### `code-solution-atendente`
- `AI_API_KEY`
- `CRM_ADMIN_KEY`
- opcionais para notificação WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `OWNER_WHATSAPP`

O workflow pode sincronizar esses valores a partir de GitHub Actions Secrets quando eles existirem, sem versioná-los.

## URLs operacionais
- Site: `https://www.codesolution.com.br/`
- Serviços: `https://www.codesolution.com.br/servicos/`
- Setores: `https://www.codesolution.com.br/setores/`
- Calculadora: `https://www.codesolution.com.br/calculadora/`
- Diagnóstico: `https://www.codesolution.com.br/diagnostico/`
- Codi: `https://www.codesolution.com.br/assistente/`
- Privacidade: `https://www.codesolution.com.br/privacidade/`
- CRM: `https://www.codesolution.com.br/painel/crm/`
- Content Worker: `https://code-solution-robo.victorhugoteixeirasimon6.workers.dev`
- Attendant Worker: `https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev`

## Status auditável
- `docs/content-integrity-status.json`
- `docs/deployment-status.json`
- `docs/pages-deployment-status.json`
- `docs/public-smoke-status.json`
- `docs/SOURCE-PACKAGE-MANIFEST.md`

## Segurança e privacidade
- segredos ficam apenas em GitHub Actions Secrets ou Cloudflare runtime secrets;
- `/painel/*` exige autenticação na borda e recebe `noindex`, `noarchive` e `Cache-Control: no-store`;
- a API do CRM exige `CRM_ADMIN_KEY` no upstream e é acessada pelo navegador via proxy same-origin autenticado;
- a landing de diagnóstico não transmite as respostas do questionário;
- o Codi orienta a não enviar informações sensíveis;
- cadastro de lead no Codi é voluntário, exige consentimento e envia somente os campos apresentados ao usuário.

## Meta Pixel
A infraestrutura de marketing está preparada para receber instrumentação, mas o Pixel ID real ainda não foi encontrado em fonte confiável. Não versionar um ID fictício. A instalação deve ocorrer quando o identificador oficial da conta Meta Business estiver disponível.

## Comandos locais

```bash
npm run check
```
