# Code Solution production release trigger

Trigger registrado em 2026-08-23 para executar a esteira de produção após configuração de `CLOUDFLARE_ACCOUNT_ID` e `CLOUDFLARE_API_TOKEN` no GitHub Actions.

Este arquivo não altera o runtime; existe apenas para disparar os workflows que monitoram `robo/**`.

## 2026-08-24 — CRM admin sync

Novo disparo solicitado após confirmação de que o repository secret `CRM_ADMIN_KEY` foi criado. Objetivo: sincronizar a chave administrativa para o Worker atendente e revalidar D1, assistente Code Solution, lead contract e proteção do CRM sem alterar dados de negócio.

## 2026-08-25 — fechamento final de produção

Disparo único para encerrar a validação de lançamento: reprovisionar/verificar D1, publicar os dois Workers na conta Cloudflare pessoal, sincronizar secrets disponíveis e executar o smoke real de health, chat, contrato de lead e proteção do CRM. Este registro não contém credenciais nem altera dados de clientes.
