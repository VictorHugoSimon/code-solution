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
- deploy automático GitHub → Cloudflare Pages/Workers;
- identidades individuais e revogáveis no painel;
- automação comercial agendada a cada 30 minutos.

## v1.1 — Operação comercial assistida

Status: **concluída e em produção**.

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

Status: **núcleo interno concluído e ativo em produção**.

- [x] SLA automático e alerta de lead novo sem contato;
- [x] alerta de follow-up vencido;
- [x] alerta de próxima ação ausente;
- [x] alerta de lead quente aguardando atendimento;
- [x] geração de tarefas a partir da próxima ação do CRM;
- [x] distribuição automática de leads por responsável;
- [x] histórico de alteração de owner e eventos de SLA;
- [x] dashboard de velocidade comercial: primeiro contato, discovery, proposta e ganho;
- [x] execução automática do motor comercial a cada 30 minutos;
- [ ] notificação externa de novos alertas via WhatsApp Cloud API ou e-mail transacional.

Dependências externas opcionais:
- WhatsApp Cloud API para mensagens/notificações automáticas;
- e-mail transacional para alertas e follow-ups.

## v1.3 — Growth e aquisição mensurável

Status: **em produção / consolidação final**.

- [x] UTMs e origem persistidas nos eventos e leads vinculados;
- [x] funil visita → engajamento → formulário → lead → ganho;
- [x] dashboard por origem e campanha;
- [x] conteúdo publicado → lead influenciado;
- [x] tracking de CTA, WhatsApp, assistente, diagnóstico, calculadora, blog e cases;
- [ ] metas semanais por canal orgânico;
- [ ] dashboard explícito de conversão por landing page;
- [ ] ranking de campanhas por eficiência comercial;
- [ ] Meta Pixel, somente após Pixel ID oficial;
- [ ] GA4, somente após Measurement ID oficial.

## v1.4 — Usuários e governança

Status: **concluída em produção**.

- [x] usuários individuais em vez de credencial administrativa compartilhada;
- [x] perfis Administrador, Comercial, Marketing e Leitura Executiva;
- [x] auditoria de login e alterações críticas;
- [x] sessões individuais revogáveis;
- [x] autenticação PBKDF2-SHA256 com senha não armazenada em texto;
- [x] tela de gestão de usuários em `/painel/usuarios/`;
- [x] STAGE com dados de identidade isolados da Produção.

## v1.5 — Observabilidade e continuidade

Prioridade: média.

1. Monitor de uptime do site e Workers.
2. Alertas para falha de deploy.
3. Smoke pós-release obrigatório.
4. Backup/export periódico do D1.
5. Teste de restauração do CRM.
6. Painel técnico de saúde da operação.
7. Runbook de incidente e rollback.

## Próxima execução recomendada

1. concluir v1.3 com metas semanais por canal e conversão por landing page;
2. depois ativar backup/restore do D1 e observabilidade operacional da v1.5;
3. integrar WhatsApp/e-mail somente quando as credenciais oficiais estiverem disponíveis.

## Critério de prioridade

Toda melhoria deve responder a pelo menos um objetivo:
- gerar mais leads qualificados;
- reduzir tempo de resposta;
- aumentar avanço no funil;
- aumentar win rate/ticket;
- reduzir risco operacional;
- tornar decisões comerciais mensuráveis.

Mudanças sem impacto em um desses objetivos não devem preceder as entregas acima.
