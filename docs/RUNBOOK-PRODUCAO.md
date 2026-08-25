# Runbook de Produção — Code Solution

Atualizado em 25/08/2026.

## Escopo

Ambiente oficial da Code Solution:

- Site: `https://www.codesolution.com.br/`
- Pages: `codesolution-site`
- Content Worker: `code-solution-robo`
- Attendant/CRM Worker: `code-solution-atendente`
- D1: `code-solution-crm`
- Conta Cloudflare: `cad25fe6c91871bbafb58236cf9b9b81`
- Repositório: `VictorHugoSimon/code-solution`

## Severidade

### P0 — indisponibilidade crítica

- site oficial fora do ar;
- login/painel indisponível;
- Worker CRM indisponível;
- perda/corrupção confirmada de dados;
- autenticação administrativa exposta ou contornada.

Ação: interromper mudanças não relacionadas, preservar evidências e executar rollback/restauração conforme a camada afetada.

### P1 — degradação importante

- Assistente Code Solution falhando;
- leads não entrando no CRM;
- automação/SLA sem execução;
- domínio/redirect/canonical incorreto;
- aquisição/analytics sem registrar.

### P2 — degradação não crítica

- página secundária com erro visual;
- indicador de painel indisponível;
- conteúdo/SEO sem atualização.

## Monitoramento automático

Workflow `.github/workflows/production-health-watch.yml` executa a cada hora e valida:

- Home;
- Serviços;
- Assistente;
- login CRM;
- redirect apex → `www`;
- health dos dois Workers;
- endpoint autenticado de automação comercial.

Falhas abrem/atualizam automaticamente uma issue `ALERTA PRODUÇÃO: Code Solution health check`. Recuperação fecha a issue automaticamente.

## Continuidade do D1

O D1 usa **Time Travel** nativo da Cloudflare. Não existe job que envie dump do CRM para o repositório público.

Workflow `.github/workflows/d1-continuity.yml`:

1. confirma que existe bookmark Time Travel atual;
2. exporta o D1 para arquivo temporário dentro do runner;
3. cria um D1 temporário;
4. importa o dump completo no banco temporário;
5. valida as principais tabelas;
6. apaga o D1 temporário;
7. apaga o dump local antes do fim do job.

Nenhum dado pessoal do CRM é versionado ou publicado como artifact.

## Restauração do D1 — incidente real

**Não execute restore de Time Travel por tentativa. É uma operação destrutiva sobre o banco de produção.**

Antes do restore:

1. confirmar P0 e horário aproximado do evento que causou a corrupção;
2. bloquear deploys/mutações relacionadas;
3. registrar horário UTC e horário de Brasília;
4. consultar bookmark anterior ao incidente;
5. registrar o bookmark atual para permitir desfazer a restauração;
6. somente então executar Time Travel restore.

Com Wrangler:

```bash
npx wrangler@4 d1 time-travel info code-solution-crm --timestamp="<RFC3339>"
npx wrangler@4 d1 time-travel restore code-solution-crm --timestamp="<RFC3339>"
```

Depois:

1. validar schema;
2. validar CRM `/crm/summary`;
3. validar leads e timeline por amostragem autorizada;
4. rodar smoke de Workers;
5. registrar causa e bookmark de recuperação.

## Rollback do Pages

Preferência operacional: reverter o commit causador na `main` e permitir que o pipeline único `deploy-pages.yml` publique o bundle anterior.

Passos:

1. identificar commit saudável anterior;
2. `git revert` do commit defeituoso, sem reescrever histórico;
3. acompanhar `Deploy Cloudflare Pages`;
4. validar Home, login, painéis, apex 301 e smoke público;
5. manter o incidente aberto até validação externa.

Em emergência, um deployment anterior do Pages pode ser promovido pelo dashboard da Cloudflare, mas o GitHub deve ser reconciliado imediatamente depois para evitar drift.

## Rollback dos Workers

1. identificar último `docs/deployment-status.json` verde;
2. reverter o commit de Worker/migration defeituoso quando seguro;
3. não tentar desfazer migration destrutiva por SQL improvisado;
4. publicar novamente via `deploy-workers.yml`;
5. validar `/health`, `/chat`, lead contract, CRM autenticado, automação e aquisição.

Se o incidente envolver dados, tratar D1 separadamente via Time Travel.

## Secrets

Nunca colocar em issue, commit, log, documentação ou chat público:

- `CLOUDFLARE_API_TOKEN`;
- `CRM_ADMIN_KEY`;
- tokens WhatsApp/Meta;
- chaves de IA;
- dumps do CRM.

A senha humana do painel deve ser rotacionada se houver suspeita de exposição.

## Pós-incidente

Todo P0/P1 deve registrar:

- impacto;
- início/fim;
- causa raiz;
- mudança causadora;
- detecção;
- ação de recuperação;
- prevenção;
- responsável e follow-up.
