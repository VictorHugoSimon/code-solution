# CRM Code Solution — arquitetura de produção

## Estado atual

A captura de leads permanece compatível com `LEADS_KV`, permitindo ativar o CRM sem migração imediata. O schema D1 em `crm/migrations/0001_init.sql` prepara a evolução para persistência transacional e consultas mais adequadas ao painel comercial.

## Por que migrar do KV para D1

KV é adequado para captura simples e leitura por chave, mas o CRM passa a exigir filtros, agregações, histórico, tarefas, auditoria, paginação e relatórios. Essas necessidades são melhor atendidas por D1.

## Modelo alvo

- **Cloudflare Pages**: site e painel.
- **Cloudflare Worker `code-solution-atendente`**: API de chat, leads e CRM.
- **Cloudflare D1 `code-solution-crm`**: leads, eventos, tarefas e auditoria.
- **Cloudflare KV `LEADS_KV`**: compatibilidade temporária / fallback durante migração.
- **Cloudflare Access ou autenticação equivalente**: proteger o painel interno; `CRM_ADMIN_KEY` é solução transitória.
- **Groq**: geração de respostas do Codi.
- **WhatsApp Cloud API**: notificação e futura jornada conversacional.
- **GA4**: eventos de aquisição e conversão sem armazenar segredos no front-end.

## Ambientes

Criar recursos separados:

### Stage
- Worker: `code-solution-atendente-stage`
- D1: `code-solution-crm-stage`
- KV: `code-solution-leads-stage`
- Pages: projeto/branch de stage
- chaves e números de teste separados quando possível

### Produção
- Worker: `code-solution-atendente`
- D1: `code-solution-crm`
- KV atual somente durante transição
- Pages: `codesolution`

Nunca compartilhar banco de leads entre stage e produção.

## Migração sugerida

1. Criar D1 stage.
2. Aplicar `0001_init.sql`.
3. Adicionar binding `CRM_DB` no Worker stage.
4. Atualizar storage adapter do Worker para gravar D1 e, durante a transição, opcionalmente espelhar no KV.
5. Migrar leads existentes do KV para D1 com script idempotente.
6. Rodar smoke tests e validar contagens.
7. Criar D1 produção e aplicar a mesma migration.
8. Migrar produção.
9. Alterar leitura oficial para D1.
10. Manter KV como rollback curto; remover após janela de segurança.

## Segurança

- Segredos somente em Cloudflare Secrets e GitHub Actions Secrets.
- Painel CRM nunca deve ser público apenas por conhecer a URL.
- Não registrar tokens, senhas ou conteúdo sensível em timeline.
- Coletar apenas dados comerciais necessários para atender o lead.
- Registrar consentimento/origem quando o lead vier de formulário.
- Implementar política de retenção e exclusão antes de ampliar captação paga.
- Auditar alterações de status, responsável e valores.

## Indicadores suportados pelo modelo

- volume por etapa;
- conversão entre etapas;
- idade da oportunidade;
- fonte/campanha;
- lead score e temperatura;
- valor de pipeline;
- follow-ups vencidos;
- motivos de perda;
- atividade por responsável;
- tempo Novo → Discovery → Proposta → Ganho.

## Critério para considerar produção robusta

- autenticação real no painel;
- D1 separado por ambiente;
- migrations automatizadas e versionadas;
- backups/export periódico;
- logs e alertas do Worker;
- smoke tests pós-deploy;
- nenhuma oportunidade ativa sem próxima ação;
- política de retenção/LGPD definida;
- rollback testado.
