# Code Solution — automação, conteúdo, atendimento e CRM

Este repositório é a fonte versionada da operação digital da Code Solution.

## Estado atual

### Código e build
- pipeline de conteúdo com validação e geração do `content/blog/index.json`;
- blog estático multilíngue (PT/EN/ES) com canonical, hreflang, `BlogPosting` e sitemap;
- preparação SEO/AEO da Home, Serviços e Blog;
- landing `/diagnostico/` com score local 0–100 e CTA para WhatsApp, sem armazenamento de respostas;
- assistente standalone `/assistente/` apontando para o Worker de atendimento;
- CRM Kanban em `/painel/crm/` com 12 etapas, Lead Score, timeline, responsável, próxima ação, vencimento, valor, previsão e motivo de perda;
- schema D1 em `crm/migrations/0001_init.sql`;
- deploy Workers capaz de provisionar D1, aplicar schema, publicar e executar smoke test;
- deploy Pages capaz de construir, preparar SEO/AEO, publicar e executar smoke test;
- smoke público persistido em `docs/public-smoke-status.json`.

### Produção observada
- `https://www.codesolution.com.br/` responde;
- os Workers públicos respondem no subdomínio `victorhugoteixeirasimon6.workers.dev`;
- as versões públicas dos Workers são anteriores ao build atual do repositório;
- as novas rotas estáticas ainda dependem do próximo deploy do Cloudflare Pages.

### Bloqueio de deploy do GitHub Actions
O repositório precisa dos secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Nunca coloque esses valores em commit, issue ou arquivo versionado.

Depois que ambos existirem, os workflows de Pages e Workers executam a automação de publicação. O workflow de Workers também cria/localiza `code-solution-crm`, aplica a migration e injeta o binding D1 no deploy do atendente.

## Runtime secrets esperados no Cloudflare

### `code-solution-robo`
- `AI_API_KEY`
- `GITHUB_TOKEN`
- `MANUAL_KEY` (para `/run` manual)
- opcionais para Indexing API: `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`

### `code-solution-atendente`
- `AI_API_KEY`
- `CRM_ADMIN_KEY`
- opcionais para notificação WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `OWNER_WHATSAPP`

## URLs operacionais
- Site: `https://www.codesolution.com.br/`
- Diagnóstico: `https://www.codesolution.com.br/diagnostico/`
- Codi: `https://www.codesolution.com.br/assistente/`
- CRM: `https://www.codesolution.com.br/painel/crm/`
- Content Worker: `https://code-solution-robo.victorhugoteixeirasimon6.workers.dev`
- Attendant Worker: `https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev`

## Status auditável
- `docs/content-integrity-status.json`
- `docs/deployment-status.json`
- `docs/pages-deployment-status.json`
- `docs/public-smoke-status.json`

## Segurança
- segredos ficam apenas em GitHub Actions Secrets ou Cloudflare runtime secrets;
- painéis recebem `noindex`, `noarchive` e `Cache-Control: no-store`;
- API do CRM exige `CRM_ADMIN_KEY`;
- a landing de diagnóstico não transmite respostas;
- o Codi orienta a não enviar informações sensíveis e requer início voluntário do atendimento.

## Comandos locais

```bash
npm run check
```
