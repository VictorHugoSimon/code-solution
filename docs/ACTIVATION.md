# Ativação final — Code Solution

Este runbook reduz a virada de produção a uma sequência verificável.

## 1. GitHub Actions Secrets
No repositório `VictorHugoSimon/code-solution`:

`Settings → Secrets and variables → Actions → New repository secret`

Cadastrar somente na interface do GitHub:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Não registrar valores em commit, issue, documentação ou chat.

O token deve ter acesso suficiente aos recursos da Code Solution usados pelos workflows: Workers Scripts, D1 e Pages.

## 2. O que acontece automaticamente depois

### Deploy Cloudflare Workers
- valida credenciais;
- localiza ou cria o D1 `code-solution-crm`;
- aplica `crm/migrations/0001_init.sql`;
- publica `code-solution-robo`;
- publica `code-solution-atendente` com binding `CRM_DB`;
- testa os dois `/health`;
- exige o build `commercial-engine-2026-08-22.2` no robô;
- grava `docs/deployment-status.json`.

### Deploy Cloudflare Pages
- reconstrói índice do blog;
- gera páginas PT/EN/ES;
- prepara fallback SEO/AEO e headers;
- publica `deploy/` no projeto Pages `codesolution-site`;
- testa Home, robots, sitemap e artigo estático;
- grava `docs/pages-deployment-status.json`.

### Public production smoke
- testa Home;
- testa artigo estático;
- testa `/diagnostico/`;
- testa `/assistente/`;
- resolve o subdomínio Workers.dev ativo;
- testa os dois Workers;
- executa uma conversa não sensível com o Codi;
- grava `docs/public-smoke-status.json`.

## 3. Runtime secrets no Cloudflare
Os deploys não devem copiar segredos para o código.

### Worker `code-solution-robo`
Confirmar no Cloudflare:
- `AI_API_KEY`
- `GITHUB_TOKEN`
- `MANUAL_KEY`
- opcionais: `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`

### Worker `code-solution-atendente`
Confirmar no Cloudflare:
- `AI_API_KEY`
- `CRM_ADMIN_KEY`
- opcionais para notificação: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `OWNER_WHATSAPP`

## 4. Critério de aceite

`docs/content-integrity-status.json`
- todos os builds `success`.

`docs/deployment-status.json`
- `cloudflareSecretsConfigured = true`;
- `crmD1Provision = success`;
- `contentWorkerDeploy = success`;
- `attendantWorkerDeploy = success`;
- `publicHealthSmokeTest = success`.

`docs/pages-deployment-status.json`
- `build = success`;
- `cloudflareSecretsConfigured = true`;
- `pagesDeploy = success`;
- `publicSmokeTest = success`.

`docs/public-smoke-status.json`
- Home, artigo, diagnóstico e assistente = `success`;
- Workers = `success`;
- `contentWorkerBuild = commercial-engine-2026-08-22.2`;
- `attendantChat = success`;
- `attendantStorage = d1`.

## 5. Pendências que exigem identificador externo
- Meta Pixel: instalar apenas quando o Pixel ID oficial da conta Meta Business for obtido.
- Proteção de acesso aos painéis: preferir Cloudflare Access; manter `noindex`/`no-store` como camada complementar, não como autenticação.
