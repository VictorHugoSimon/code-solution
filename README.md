# Code Solution — operação digital, comercial e inteligência

Este repositório é a fonte versionada da operação digital da Code Solution.

## Status de produção

**Produção lançada em 24/08/2026 e evolução comercial ativa em 25/08/2026.**

A operação está publicada na conta Cloudflare pessoal `Victorhugoteixeirasimon6@gmail.com's Account`, Account ID `cad25fe6c91871bbafb58236cf9b9b81`, com domínio, Pages, D1, KV e Workers validados.

## Plataforma publicada

### Aquisição pública
- Home institucional com captura direta de lead;
- Serviços com camada SEO/AEO;
- soluções por Setor para Agro, Logística e Varejo;
- Calculadora de Projeto;
- Diagnóstico Digital com score 0–100;
- Assistente digital **Code Solution** com IA e captura voluntária de lead;
- Privacidade;
- Blog estático multilíngue PT/EN/ES.

### Operação comercial
- Painel Executivo alimentado diretamente pelo CRM;
- CRM Kanban com 12 etapas, Lead Score, timeline, responsável, próxima ação, vencimento, valor, previsão e motivo de perda;
- **Atendimento Guiado** com roteiro para entender negócio, dor, qualificar, direcionar solução e registrar próxima ação;
- **Prospecção Orgânica** com fila diária de LinkedIn/prospecção ativa, prioridades, follow-ups, mensagens e gerador de links UTM;
- cadastro manual de leads para indicação, LinkedIn, WhatsApp, telefone, e-mail, evento e prospecção ativa;
- filtros do CRM por temperatura, origem e responsável;
- Painel de Marketing com leads, UTMs, campanhas, score, conversão, funil e pipeline por origem;
- Painel de Inteligência com prioridades, SLA, gargalos, forecast, responsáveis, segmentos e motivos de perda;
- SLA comercial automático: quente no mesmo dia útil, morno em 1 dia útil e frio em 3 dias úteis;
- playbook operacional em `docs/PLAYBOOK-COMERCIAL.md`.

### Infraestrutura
- D1 `code-solution-crm`;
- Worker de conteúdo `code-solution-robo`;
- Worker de atendimento `code-solution-atendente`;
- Workers AI como provedor principal do assistente;
- redirect canônico `codesolution.com.br` → `www.codesolution.com.br`;
- pipeline único de Pages com build, secret sync, deploy, smoke e validação de backend;
- guard de ownership que impede deploy em outra conta Cloudflare.

## URLs operacionais

### Público
- Site oficial: `https://www.codesolution.com.br/`
- Serviços: `https://www.codesolution.com.br/servicos/`
- Setores: `https://www.codesolution.com.br/setores/`
- Calculadora: `https://www.codesolution.com.br/calculadora/`
- Diagnóstico: `https://www.codesolution.com.br/diagnostico/`
- Assistente Code Solution: `https://www.codesolution.com.br/assistente/`
- Privacidade: `https://www.codesolution.com.br/privacidade/`

### Administração comercial
- Login: `https://www.codesolution.com.br/painel/login/`
- Painel Executivo: `https://www.codesolution.com.br/painel/`
- CRM: `https://www.codesolution.com.br/painel/crm/`
- Atendimento Guiado: `https://www.codesolution.com.br/painel/atendimento/`
- Prospecção Orgânica: `https://www.codesolution.com.br/painel/prospeccao/`
- Marketing: `https://www.codesolution.com.br/painel/marketing/`
- Inteligência: `https://www.codesolution.com.br/painel/inteligencia/`

### Runtime
- Content Worker: `https://code-solution-robo.victorhugoteixeirasimon6.workers.dev`
- Attendant Worker: `https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev`

## Acesso administrativo

- login humano em `/painel/login/`;
- usuário explícito e senha validada por hash;
- senha humana não é armazenada em texto no repositório;
- após autenticação, o Pages cria sessão assinada com cookie `HttpOnly`, `Secure` e `SameSite=Strict`;
- sessão administrativa de até 8 horas;
- `CRM_ADMIN_KEY` é chave técnica interna e não é enviada ao navegador;
- `/painel/logout/` encerra a sessão;
- acesso anônimo a `/painel/*` redireciona para login;
- acesso anônimo a `/api/crm/*` retorna HTTP 401.

## Fluxo comercial

1. Lead entra por Home, Assistente, Diagnóstico, LinkedIn, indicação, WhatsApp ou cadastro manual.
2. Worker valida os campos e calcula Lead Score/temperatura.
3. Lead é persistido no D1 `code-solution-crm`.
4. Leads digitais recebem SLA automático de próxima ação.
5. O atendente usa **Atendimento Guiado** para entender a dor e qualificar.
6. O CRM registra owner, estágio, próxima ação, prazo, valor e timeline.
7. **Prospecção Orgânica** organiza novas oportunidades e follow-ups e gera links UTM.
8. Marketing mede origem, UTMs, campanhas e conversão sem inventar CAC/ROAS.
9. Inteligência organiza prioridades, forecast, gargalos, segmentos e motivos de perda.
10. Ganho/perda fecha o ciclo e alimenta os indicadores executivos.

## Direcionamento de solução

| Situação do cliente | Direcionamento inicial |
| --- | --- |
| Processo específico sem solução pronta aderente | Software sob medida |
| Trabalho manual/repetitivo | Automação |
| Sistemas ou dados desconectados | Integrações |
| Atendimento/conhecimento/operação assistida | IA / Agentes |
| Falta de indicadores e visão gerencial | Dados & BI |

## Prospecção orgânica

Cadência diária recomendada disponível no painel:

- 15 conexões qualificadas;
- 10 interações relevantes;
- 5 primeiras mensagens;
- 5 follow-ups;
- 1 conteúdo de autoridade.

O módulo `/painel/prospeccao/` também gera URLs com UTM para medir o que efetivamente gera leads e pipeline.

## Segurança e ownership

- GitHub oficial: `VictorHugoSimon/code-solution`;
- Cloudflare oficial: Account ID `cad25fe6c91871bbafb58236cf9b9b81`;
- workflow de ownership bloqueia outra conta Cloudflare;
- segredos somente em GitHub Actions Secrets ou Cloudflare runtime secrets;
- `/painel/*` recebe `noindex`, `noarchive` e `Cache-Control: no-store`;
- API upstream do CRM exige `CRM_ADMIN_KEY`;
- lead inválido retorna HTTP 400 `validation_error` antes da escrita;
- domínio raiz retorna HTTP 301 para `https://www.codesolution.com.br/`;
- MX/TXT do Zoho permanecem preservados.

## Runtime secrets

### `code-solution-robo`
- `AI_API_KEY`
- `GITHUB_TOKEN`
- `MANUAL_KEY`

### `code-solution-atendente`
- `AI_API_KEY` para fallback externo opcional;
- `CRM_ADMIN_KEY`;
- opcionais: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `OWNER_WHATSAPP`.

O assistente usa Cloudflare Workers AI como provedor principal.

## Pipeline de release

- validação de Workers e schema D1;
- geração de blog e sitemap;
- preparação SEO/AEO;
- aplicação obrigatória da marca **Code Solution**;
- bloqueio do nome público legado do assistente;
- normalização da navegação do painel;
- validação obrigatória de Painel, CRM, Atendimento, Prospecção, Marketing e Inteligência;
- sincronização de `CRM_ADMIN_KEY` no Pages;
- deploy automático para Cloudflare Pages;
- deploy automático dos Workers;
- smoke de rotas públicas e privadas;
- smoke do CRM backend;
- validação do redirect canônico;
- proteção de ownership Cloudflare.

## Status auditável

- `docs/content-integrity-status.json`
- `docs/deployment-status.json`
- `docs/pages-deployment-status.json`
- `docs/public-smoke-status.json`
- `docs/dns-preflight-status.json`
- `docs/crm-admin-validation.json`
- `docs/cloudflare-footprint.json`
- `docs/CLOUDFLARE-OWNERSHIP.md`
- `docs/PLAYBOOK-COMERCIAL.md`
- `docs/PRODUCTION-GAPS.md`

## Itens opcionais pós-lançamento

- WhatsApp Cloud API para avisos automáticos de novos leads;
- Meta Pixel quando o Pixel ID oficial estiver disponível;
- integração de custos de mídia para CAC, CPA e ROAS;
- distribuição automática por atendente;
- notificações automáticas de follow-up vencido.

Nenhum desses itens bloqueia a operação atual.

## Comandos locais

```bash
npm run check
```
