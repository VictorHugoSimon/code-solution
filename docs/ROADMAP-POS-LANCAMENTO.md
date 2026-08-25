# Code Solution — Roadmap pós-lançamento

Atualizado em 25/08/2026.

## Estado atual

Produção oficial: `https://www.codesolution.com.br/`

Plataforma comercial disponível:
- Visão executiva;
- CRM Kanban;
- Atendimento Guiado;
- Agenda;
- Prospecção Orgânica;
- Marketing & Aquisição;
- Inteligência Comercial;
- Growth Engine;
- Relatórios Comerciais;
- Assistente Code Solution;
- captura de leads integrada ao D1/CRM;
- Workers AI;
- deploy automático GitHub → Cloudflare Pages/Workers.

## v1.1 — Operação comercial assistida

Status: implementada / em publicação contínua.

- [x] login administrativo e sessão segura;
- [x] CRM com pipeline e lead score;
- [x] resumo executivo no CRM;
- [x] forecast ponderado;
- [x] SLA de primeiro contato;
- [x] fila "Atender agora";
- [x] visão por origem;
- [x] playbook de atendimento por tipo de solução;
- [x] mensagens de primeiro contato, discovery, follow-up e proposta;
- [x] Growth Engine incluído na navegação principal;
- [x] remoção da marca pública legada "Codi" em favor de "Code Solution".

## v1.2 — Automação do lead até reunião

Prioridade: alta.

1. Notificação de novo lead para responsável comercial.
2. SLA automático: alerta para lead novo sem contato em 4h.
3. Lembrete de follow-up vencido.
4. Geração de tarefa/agenda a partir da próxima ação do CRM.
5. Modelo de distribuição de leads por responsável.
6. Histórico de alterações de owner e SLA.
7. Dashboard de velocidade comercial: tempo até primeiro contato, discovery e proposta.

Dependências externas opcionais:
- WhatsApp Cloud API para mensagens/notificações automáticas;
- e-mail transacional para alertas e follow-ups.

## v1.3 — Growth e aquisição mensurável

Prioridade: alta.

1. Consolidar UTMs e origem em todos os formulários.
2. Acompanhar visita → lead → oportunidade → ganho.
3. Metas semanais por canal orgânico.
4. Conteúdo ligado a ICP/segmento e dor comercial.
5. Dashboard de conversão por landing page e campanha.
6. Medir conteúdo publicado → lead influenciado.
7. Ativar Meta Pixel somente com Pixel ID oficial.
8. Manter GA4/UTMs sem identificadores fictícios.

## v1.4 — Usuários e governança

Prioridade: média.

1. Usuários individuais em vez de uma credencial administrativa compartilhada.
2. Perfis: Administrador, Comercial, Marketing e Leitura Executiva.
3. Auditoria de login e alterações críticas.
4. Revogação de sessões.
5. Política de senha e recuperação de acesso.
6. Separação entre STAGE e Produção para mudanças de maior risco.

## v1.5 — Observabilidade e continuidade

Prioridade: média.

1. Monitor de uptime do site e Workers.
2. Alertas para falha de deploy.
3. Smoke pós-release obrigatório.
4. Backup/export periódico do D1.
5. Teste de restauração do CRM.
6. Painel técnico de saúde da operação.
7. Runbook de incidente e rollback.

## Critério de prioridade

Toda melhoria deve responder a pelo menos um objetivo:
- gerar mais leads qualificados;
- reduzir tempo de resposta;
- aumentar avanço no funil;
- aumentar win rate/ticket;
- reduzir risco operacional;
- tornar decisões comerciais mensuráveis.

Mudanças sem impacto em um desses objetivos não devem preceder as entregas acima.
