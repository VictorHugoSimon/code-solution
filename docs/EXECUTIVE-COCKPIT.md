# Code Solution — Cockpit Executivo v1

Status: implementação integrada ao pipeline de Pages em 28/08/2026.

## Objetivo

Dar ao responsável pela Code Solution uma visão única e operacional do negócio sem precisar navegar por CRM, Marketing, Agenda, Agentes e Propostas para descobrir o que precisa de atenção primeiro.

## URL

`/painel/executivo/`

## Escopo v1

O cockpit é **read-only** e consome somente APIs administrativas já existentes e protegidas por sessão do painel.

Indicadores:
- pipeline aberto;
- leads quentes;
- leads novos acima do SLA de 2 horas para primeiro contato;
- follow-ups vencidos;
- leads abertos sem próxima ação/data;
- aprovações humanas pendentes no Autonomous OS;
- propostas em elaboração/revisão.

Blocos:
- Brief Executivo automático;
- Próximas Melhores Ações;
- Oportunidades Prioritárias;
- Decisões & Governança;
- atalhos para Agentes, Propostas, Agenda e Marketing.

## Regras de priorização

A prioridade é calculada usando, nesta ordem:
1. SLA de primeiro contato estourado;
2. follow-up vencido;
3. temperatura quente;
4. ausência de próxima ação;
5. Lead Score.

O cockpit não inventa metas, valores, prazos ou probabilidades. Ele apenas resume dados presentes no CRM e no Autonomous OS.

## Segurança

- exige sessão autenticada do painel;
- não recebe `CRM_ADMIN_KEY` no navegador;
- não executa ações externas;
- não aprova propostas ou tarefas automaticamente;
- não altera estágio, preço, prazo ou dados do lead;
- preserva a política `fail closed` do Autonomous OS.

## Integração no build

`scripts/enhance-executive-cockpit.mjs`:
- gera `deploy/painel/executivo/index.html`;
- injeta o link **Executivo** na navegação lateral das superfícies existentes do painel;
- valida contratos mínimos do cockpit;
- roda depois de `normalize-panel-nav.mjs` dentro de `npm run pages:prepare`.

## Próximas evoluções

1. Executive Agent com brief diário persistido e histórico;
2. metas comerciais configuráveis (lead, pipeline, receita, SLA e propostas);
3. comparação Meta x Realizado;
4. alertas de anomalia e tendência;
5. previsão de pipeline com metodologia explícita e auditável;
6. recomendação de próxima melhor ação registrada no audit trail;
7. custos/latência por agente;
8. visão de clientes ganhos, onboarding e delivery;
9. resumo executivo diário por e-mail/WhatsApp somente após configuração dos conectores oficiais e aprovação de política.
