# Code Solution — Roadmap pós-lançamento

Atualizado em 27/08/2026.

## Estado atual

**Plataforma interna concluída e operacional em Produção.**

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
- Saúde da Operação;
- Assistente Code Solution;
- captura de leads integrada ao D1/CRM;
- Workers AI;
- deploy automático GitHub → Cloudflare Pages/Workers;
- identidades individuais e revogáveis no painel;
- automação comercial agendada a cada 30 minutos;
- monitor horário de Produção;
- alertas de falha de deploy;
- continuidade D1 com Time Travel, export efêmero e teste real de restauração temporária.

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
- [ ] notificação externa de novos alertas via WhatsApp Cloud API ou e-mail transacional — **integração externa opcional**.

## v1.3 — Growth e aquisição mensurável

Status: **núcleo interno concluído e em produção**.

- [x] UTMs e origem persistidas nos eventos e leads vinculados;
- [x] funil visita → engajamento → formulário → lead → ganho;
- [x] dashboard por origem e campanha;
- [x] conteúdo publicado → lead influenciado;
- [x] tracking de CTA, WhatsApp, assistente, diagnóstico, calculadora, blog e cases;
- [x] metas semanais por canal orgânico;
- [x] dashboard explícito de conversão por landing page;
- [x] ranking de campanhas por eficiência comercial;
- [ ] Meta Pixel — depende do Pixel ID oficial da Code Solution;
- [ ] GA4 — depende do Measurement ID oficial da Code Solution.

### Ranking de campanhas

O ranking interno não inventa CAC/ROAS sem custo de mídia. O Índice de Eficiência Comercial prioriza campanhas por:
- 50% conversão Lead → Ganho;
- 30% proporção de leads quentes;
- 20% score médio dos leads.

Quando investimento de mídia for integrado, CAC/CPA/ROAS poderão ser adicionados separadamente.

## v1.4 — Usuários e governança

Status: **concluída em produção**.

- [x] usuários individuais em vez de credencial administrativa compartilhada;
- [x] perfis Administrador, Comercial, Marketing e Leitura Executiva;
- [x] auditoria de login e alterações críticas;
- [x] sessões individuais revogáveis;
- [x] autenticação PBKDF2-SHA256, 100.000 iterações, salt individual e senha não armazenada em texto;
- [x] tela de gestão de usuários em `/painel/usuarios/`;
- [x] STAGE com dados de identidade isolados da Produção.

## v1.5 — Observabilidade e continuidade

Status: **concluída para operação interna**.

- [x] monitor horário de uptime do site, login, Workers e CRM;
- [x] abertura/fechamento automático de incidentes de health;
- [x] alertas específicos para falha de deploy Pages/Workers;
- [x] smoke pós-release obrigatório e fail-closed;
- [x] Time Travel do D1 validado;
- [x] export periódico do D1 somente para runner efêmero;
- [x] teste real de restauração em D1 temporário;
- [x] exclusão automática do banco temporário e dump após teste;
- [x] nenhum backup sensível versionado no repositório público;
- [x] painel técnico de Saúde da Operação em `/painel/relatorios/saude/`;
- [x] runbook de incidente e rollback em `docs/RUNBOOK-PRODUCAO.md`.

## v1.6 — Operação orgânica dos primeiros 30 dias

Status: **backend e metas em produção; superfície visual em release controlado**.

- [x] baseline operacional de 30 dias configurado por canal, com LinkedIn como prioridade;
- [x] metas separadas de resultados observados para não confundir objetivo com performance real;
- [x] LinkedIn: meta semanal de 50 sessões rastreadas, 4 leads e 1 ganho;
- [x] API e D1 para registrar execução diária de prospecção;
- [x] registro de conexões, interações, primeiras mensagens, follow-ups, conteúdo, respostas qualificadas e reuniões;
- [x] cadência operacional LinkedIn: 15 conexões, 10 interações, 5 primeiras mensagens, 5 follow-ups e 1 conteúdo por dia útil;
- [x] metas de atividade para 7 dias: 75 conexões, 50 interações, 25 primeiras mensagens, 25 follow-ups, 5 conteúdos e 2 reuniões;
- [x] playbooks preparados para Agronegócio, Logística e Transporte, Varejo/Distribuição e Processos Corporativos;
- [x] UTMs por canal/ICP para ligar abordagem → visita → lead → ganho;
- [x] API de Prospecção validada em Produção com HTTP 200 e fail-closed HTTP 401 sem credencial;
- [ ] concluir evidência do widget de realizado x meta na superfície publicada de `/painel/prospeccao/`;
- [ ] iniciar execução humana diária e registrar o realizado;
- [ ] recalibrar metas semanalmente com base em resposta, reuniões e ganhos observados.

### Regra de leitura das metas

Os números acima são **metas operacionais de lançamento**, não projeções de faturamento nem performance histórica. A primeira recalibração deve ocorrer depois de uma semana completa de execução registrada. Não elevar volume se resposta qualificada e reuniões caírem; a prioridade é qualidade do ICP e avanço no funil.

## Evidências de fechamento

- `docs/pages-deployment-status.json` — Pages/CRM/identidade/smoke;
- `docs/acquisition-v13-status.json` — metas por canal e landing pages;
- `docs/launch-acquisition-goals-status.json` — baseline de aquisição dos primeiros 30 dias;
- `docs/prospecting-operations-status.json` — D1/API da execução diária e fail-closed;
- `docs/panel-identity-status.json` — identidade e lifecycle de sessão;
- `docs/d1-continuity-status.json` — Time Travel/export/restore;
- `.github/workflows/production-health-watch.yml` — monitor horário;
- `.github/workflows/deploy-alerts.yml` — alertas de deploy;
- `docs/RUNBOOK-PRODUCAO.md` — resposta a incidentes.

## Pendências externas opcionais

Estas integrações não bloqueiam o lançamento nem a operação atual:

1. **WhatsApp Cloud API** — `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` e número oficial para notificações automáticas.
2. **E-mail transacional** — provedor/credencial oficial para alertas e follow-ups externos.
3. **Meta Pixel** — Pixel ID oficial da conta Meta Business.
4. **GA4** — Measurement ID oficial da propriedade Google Analytics.
5. **Retenção de backup superior ao Time Travel** — opcionalmente export criptografado para armazenamento privado (ex.: R2) se houver necessidade de retenção de longo prazo.

## Próxima prioridade de negócio

Com o produto interno estabilizado, a prioridade é **execução comercial e geração de demanda**:

1. concluir o release visual do módulo de execução diária da Prospecção;
2. executar diariamente a cadência LinkedIn e registrar o realizado no painel;
3. publicar conteúdo/cases alinhados aos quatro ICPs priorizados;
4. acompanhar visita → lead → reunião → proposta → ganho;
5. revisar semanalmente atingimento, resposta qualificada e ranking de campanhas;
6. integrar WhatsApp/e-mail quando as credenciais oficiais forem disponibilizadas;
7. ativar Meta Pixel e GA4 quando os IDs oficiais forem fornecidos.

## Critério de prioridade

Toda melhoria deve responder a pelo menos um objetivo:
- gerar mais leads qualificados;
- reduzir tempo de resposta;
- aumentar avanço no funil;
- aumentar win rate/ticket;
- reduzir risco operacional;
- tornar decisões comerciais mensuráveis.

Mudanças sem impacto em um desses objetivos não devem preceder as entregas acima.
