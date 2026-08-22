# Code Solution — Automação, Conteúdo e CRM

Este repositório é a fonte versionada das automações comerciais da Code Solution.

## Componentes

- `content/blog/` — artigos produzidos pelo robô e `index.json` consumido pelo blog.
- `robo/worker.js` — geração de conteúdo via Groq + publicação no GitHub.
- `robo/atendente-worker.js` — Codi, captura de leads e API do CRM.
- `deploy/painel/crm/` — painel Kanban comercial estático.
- `scripts/rebuild-blog-index.mjs` — validação, quarentena de encoding e reconstrução do índice.
- `.github/workflows/` — integridade de conteúdo e deploy automático dos Workers.

## Pipeline de conteúdo

1. Cron do Worker roda terça e sexta às 12:00 UTC.
2. A categoria menos recentemente publicada é escolhida.
3. Groq gera PT-BR + EN + ES em JSON.
4. O Worker valida HTML, tamanho, encoding e slug.
5. O artigo é criado em `content/blog/<slug>.json` sem sobrescrever arquivos existentes.
6. `content/blog/index.json` é atualizado.
7. O GitHub Action também reconstrói o índice a partir dos arquivos como mecanismo de recuperação.

## CRM

Pipeline padrão: `novo → qualificacao → contato_realizado → discovery → avaliacao_tecnica → proposta → negociacao → follow_up → ganho/perdido → nutricao/arquivado`.

O endpoint público `/lead` valida nome, WhatsApp e necessidade, calcula Lead Score (0–100), define temperatura e grava no KV. Endpoints `/crm/*` exigem `CRM_ADMIN_KEY`.

## Secrets

Nunca versionar valores de segredo.

### Worker de conteúdo
- `AI_API_KEY`
- `GITHUB_TOKEN`
- `MANUAL_KEY`
- opcionais: `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`, `GOOGLE_INDEXING_WEBHOOK`

### Worker de atendimento
- `AI_API_KEY`
- `CRM_ADMIN_KEY`
- opcionais para WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `OWNER_WHATSAPP`

### GitHub Actions
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Comandos locais

```bash
npm run check:workers
npm run blog:index
```

Deploy manual de Workers:

```bash
cd robo
npx wrangler@4 deploy --config wrangler.toml
npx wrangler@4 deploy --config wrangler-atendente.toml
```

## Regra de segurança de produção

O código completo do Cloudflare Pages ainda deve ser versionado antes de habilitar deploy automático do site. O workflow automático deste repositório publica somente os Workers; ele não substitui o conteúdo do projeto Pages.
