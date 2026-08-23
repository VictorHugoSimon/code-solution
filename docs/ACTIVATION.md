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
- exige o robô de conteúdo pronto e identificado por build;
- testa uma conversa empresarial não sensível com o Codi;
- testa o contrato de `/lead` com payload inválido e exige rejeição antes de qualquer gravação;
- confirma que `/crm/summary` rejeita acesso não autenticado;
- grava `docs/deployment-status.json`.

### Deploy Cloudflare Pages
- reconstrói índice do blog;
- gera páginas estáticas PT/EN/ES;
- prepara SEO/AEO e headers;
- publica `deploy/` no projeto Pages `codesolution-site`;
- testa Home, robots, sitemap e artigo estático;
- testa `/diagnostico/`, `/assistente/`, `/privacidade/`, `/setores/` e `/calculadora/`;
- confirma que `/painel/crm/` e `/api/crm/summary` exigem autenticação;
- grava `docs/pages-deployment-status.json`.

### Public production smoke
- testa Home e Serviços;
- testa artigo estático;
- testa `/diagnostico/`;
- testa `/assistente/`;
- testa `/privacidade/`;
- testa `/setores/`;
- testa `/calculadora/`;
- verifica redirect canônico do domínio sem `www`;
- resolve o subdomínio Workers.dev ativo;
- testa os dois Workers;
- executa uma conversa não sensível com o Codi;
- registra o tipo de storage do atendente;
- só testa `/lead` quando o health confirmar `storage=d1`, evitando efeitos sobre Worker legado;
- grava `docs/public-smoke-status.json`.

## 3. Runtime secrets no Cloudflare
Os deploys não devem copiar segredos para o código.

### Worker `code-solution-robo`
Confirmar no Cloudflare:
- `AI_API_KEY`
- `GITHUB_TOKEN`
- `MANUAL_KEY`

Para artigos comuns, a descoberta/indexação é feita por sitemap e crawl. A Google Indexing API não faz parte da operação normal do blog.

### Worker `code-solution-atendente`
Confirmar no Cloudflare:
- `AI_API_KEY`
- `CRM_ADMIN_KEY`
- opcionais para notificação: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `OWNER_WHATSAPP`

Esses valores também podem existir como GitHub Actions Secrets para sincronização automática no deploy, sem serem expostos no código.

## 4. Critério de aceite

`docs/content-integrity-status.json`
- todos os builds `success`.

`docs/deployment-status.json`
- `cloudflareSecretsConfigured = true`;
- `crmD1Provision = success`;
- `contentWorkerDeploy = success`;
- `attendantWorkerDeploy = success`;
- `publicHealthChatAndLeadSmokeTest = success`.

`docs/pages-deployment-status.json`
- `build = success`;
- `cloudflareSecretsConfigured = true`;
- `projectLookup = success`;
- `pagesDeploy = success`;
- `publicSmokeTest = success`;
- `panelEdgeAuthRequired = true`.

`docs/public-smoke-status.json`
- `home = success`;
- `services = success`;
- `staticArticle = success`;
- `diagnosticLanding = success`;
- `standaloneAssistant = success`;
- `privacyPage = success`;
- `sectorsPage = success`;
- `calculatorPage = success`;
- `apexCanonicalRedirect = success`;
- `contentWorkerHealth = success`;
- `contentWorkerReady = true`;
- `attendantWorkerHealth = success`;
- `attendantChat = success`;
- `attendantLeadValidation = success`;
- `attendantStorage = d1`.

## 5. Codi e CRM
Na rota `/assistente/`:
- conversa começa somente após ação voluntária do usuário;
- o usuário é orientado a não enviar dados sensíveis;
- após informar a necessidade, pode registrar voluntariamente nome, WhatsApp, empresa, segmento e necessidade;
- o cadastro exige consentimento explícito;
- UTM, landing page e referrer são enviados como contexto de aquisição;
- o endpoint `/lead` cria o registro e devolve `leadId`, score, status e próxima ação;
- o painel `/painel/crm/` opera sobre o mesmo backend via proxy autenticado `/api/crm/*`.

## 6. Domínio canônico
O Pages Worker está preparado para responder com 301 quando o host for `codesolution.com.br`, preservando caminho e query string e direcionando para `https://www.codesolution.com.br`.

Para o redirect funcionar publicamente, o domínio raiz precisa estar roteado para o mesmo projeto/edge da Code Solution. O smoke público só considera concluído quando recebe HTTP 301 com `Location` correto.

## 7. Pendências que exigem identificador externo
- Meta Pixel: instalar apenas quando o Pixel ID oficial da conta Meta Business for obtido.
- Google Perfil da Empresa: cadastro/otimização depende da conta empresarial correspondente.
- WhatsApp Cloud API: notificações automáticas dependem das credenciais oficiais da conta Meta/WhatsApp.
