# Code Solution — Prospecção Orgânica LinkedIn

Status: **Produção validada em 28/08/2026**.

## Acesso

- Painel: `https://www.codesolution.com.br/painel/prospeccao/linkedin/`
- Prospecção geral: `https://www.codesolution.com.br/painel/prospeccao/`
- CRM: `https://www.codesolution.com.br/painel/crm/`

O módulo LinkedIn é protegido pela autenticação do painel Code Solution e utiliza a mesma sessão administrativa.

## Responsável operacional

- Responsável padrão: **Ercilaine**
- Papel: **Executiva de Relacionamento e Novos Negócios**
- Canal: **LinkedIn orgânico**
- Princípio: abordagem consultiva, humana e personalizada; o sistema não envia convites ou mensagens automaticamente pelo LinkedIn.

## ICP prioritário

1. Agro
2. Logística
3. Indústria
4. Serviços B2B

Sinais de oportunidade a investigar:

- operação dependente de planilhas;
- retrabalho e digitação repetida;
- sistemas que não conversam;
- processos manuais de aprovação, controle ou atendimento;
- legado tecnológico dificultando crescimento;
- baixa visibilidade gerencial ou dados espalhados;
- necessidade de automação, integração, software sob medida ou IA aplicada a processo real.

## Fluxo operacional

1. **Pesquisar** — identificar empresa, decisor, contexto e hipótese de dor.
2. **Conectar** — enviar convite personalizado, sem pitch comercial agressivo.
3. **Interagir** — criar familiaridade por meio de comentários e conteúdo relevante.
4. **Conversar** — iniciar diálogo e entender situação atual.
5. **Follow-up** — retomar com contexto e valor, sem insistência excessiva.
6. **Qualificar** — confirmar problema, impacto, prioridade e abertura para avaliar solução.
7. **Converter para CRM** — criar lead somente quando houver oportunidade concreta.
8. **Discovery** — aprofundar escopo, decisão, viabilidade e próximos passos no CRM.

## Meta operacional diária

O painel acompanha:

- 15 novas conexões qualificadas;
- 10 interações relevantes;
- 5 primeiras mensagens;
- 5 follow-ups;
- 1 conteúdo/publicação;
- meta de 1 reunião agendada como referência diária;
- rotina concentrada de aproximadamente 60 minutos.

Os números são indicadores de disciplina operacional; qualidade e aderência ao ICP prevalecem sobre volume.

## Carteira de prospects

Cada prospect possui:

- nome;
- cargo;
- empresa;
- segmento;
- localização;
- URL do LinkedIn;
- responsável;
- estágio;
- score 0–100;
- dor/oportunidade;
- contexto;
- notas;
- próxima ação;
- data da próxima ação;
- quantidade de interações;
- última interação;
- vínculo com lead do CRM após conversão.

### Estágios

- `pesquisar`
- `conectar`
- `conectado`
- `interagir`
- `mensagem_1`
- `followup_1`
- `followup_2`
- `qualificado`
- `convertido`
- `pausado`
- `descartado`

## Priorização

A rotina deve seguir esta ordem:

1. ações atrasadas;
2. ações previstas para hoje;
3. prospects com score >= 70;
4. respostas recebidas;
5. novos prospects aderentes ao ICP.

## Critério para entrar no CRM

Converter o prospect em lead quando houver pelo menos um sinal concreto, como:

- problema confirmado;
- interesse em entender solução;
- solicitação de informação, preço, apresentação ou diagnóstico;
- projeto atual ou futuro identificado;
- disponibilidade para uma conversa de Discovery.

Na conversão, o sistema grava:

- origem: `linkedin`;
- campanha: `linkedin_organico`;
- mídia: `organic`;
- conteúdo: `prospeccao_ercilaine`;
- responsável: Ercilaine;
- status inicial: qualificado;
- score mínimo: 70;
- próxima ação padrão: Agendar discovery.

## Mensagens

O painel oferece modelos para:

- pedido de conexão;
- mensagem após aceite;
- diagnóstico consultivo;
- follow-up 1;
- follow-up 2;
- envio de case/prova de autoridade.

Todo modelo deve ser personalizado com nome, empresa, contexto e hipótese de problema antes do envio.

### Regra comercial

Não prometer preço, prazo ou viabilidade antes de entender o problema. A primeira mensagem não deve ser um pitch de venda; seu objetivo é iniciar conversa e ganhar permissão para diagnosticar.

## Perfil da Ercilaine

Checklist previsto no painel:

- título: **Executiva de Relacionamento e Novos Negócios · Code Solution**;
- capa: **Tecnologia para transformar processos em resultados**;
- seção Sobre orientada a problemas que a Code Solution resolve;
- Destaques com site, diagnóstico e cases publicáveis;
- uso de prova social real e autorizada.

## Dados e integração

Banco D1:

- `linkedin_prospects`
- `linkedin_prospect_events`
- `prospecting_daily_activity`
- integração com `leads` no CRM.

Endpoints principais:

- `GET /crm/prospecting/linkedin/summary`
- `GET /crm/prospecting/linkedin/prospects`
- `POST /crm/prospecting/linkedin/prospects`
- `GET/PATCH /crm/prospecting/linkedin/prospect/:id`
- `POST /crm/prospecting/linkedin/prospect/:id/event`
- `POST /crm/prospecting/linkedin/prospect/:id/convert`

## Validação de produção

Evidência: `docs/linkedin-production-status.json`.

Critérios validados:

- backend summary HTTP 200;
- backend prospects HTTP 200;
- owner padrão Ercilaine;
- rota do painel protegida e redirecionando usuário não autenticado ao login;
- API same-origin bloqueando usuário não autenticado com HTTP 401;
- Cloudflare Pages publicado com sucesso;
- Content Integrity aprovado;
- Cloudflare Workers publicado com sucesso após aplicação das migrations.
