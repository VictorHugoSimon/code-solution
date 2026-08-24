# Code Solution production release trigger

Trigger registrado em 2026-08-23 para executar a esteira de produção após configuração de `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` no GitHub Actions.

Este arquivo não altera o runtime; existe apenas para disparar os workflows que monitoram `robo/**`.

## 2026-08-24 — CRM admin sync

Novo disparo solicitado após confirmação de que o repository secret `CRM_ADMIN_KEY` foi criado. Objetivo: sincronizar a chave administrativa para o Worker atendente e revalidar D1, Codi, lead contract e proteção do CRM sem alterar dados de negócio.
