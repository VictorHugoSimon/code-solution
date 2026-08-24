# Code Solution — site, automação, conteúdo, atendimento e CRM

Este repositório é a fonte versionada da operação digital da Code Solution.

## Status de produção

**Produção lançada em 24/08/2026.**

A operação digital está publicada na conta pessoal Cloudflare `Victorhugoteixeirasimon6@gmail.com's Account`, Account ID `cad25fe6c91871bbafb58236cf9b9b81`, com domínio, Pages, D1, KV e Workers validados.

### Plataforma publicada
- Home institucional com captura direta de lead;
- Serviços com camada SEO/AEO;
- soluções por Setor para Agro, Logística e Varejo;
- Calculadora de Projeto;
- Diagnóstico Digital com score 0–100;
- Assistente digital **Code Solution** com IA e captura voluntária de lead;
- Privacidade;
- Blog estático multilíngue PT/EN/ES;
- Painel operacional;
- CRM Kanban com 12 etapas, Lead Score, timeline, responsável, próxima ação, vencimento, valor, previsão e motivo de perda;
- Painel de Marketing;
- Painel de Inteligência;
- D1 `code-solution-crm`;
- Worker de conteúdo `code-solution-robo`;
- Worker de atendimento `code-solution-atendente`;
- Workers AI como provedor principal do assistente;
- redirect canônico `codesolution.com.br` → `www.codesolution.com.br`.

## URLs operacionais
- Site oficial: `https://www.codesolution.com.br/`
- Serviços: `https://www.codesolution.com.br/servicos/`
- Setores: `https://www.codesolution.com.br/setores/`
- Calculadora: `https://www.codesolution.com.br/calculadora/`
- Diagnóstico: `https://www.codesolution.com.br/diagnostico/`
- Assistente Code Solution: `https://www.codesolution.com.br/assistente/`
- Privacidade: `https://www.codesolution.com.br/privacidade/`
- Painel: `https://www.codesolution.com.br/painel/`
- CRM: `https://www.codesolution.com.br/painel/crm/`
- Marketing: `https://www.codesolution.com.br/painel/marketing/`
- Inteligência: `https://www.codesolution.com.br/painel/inteligencia/`
- Content Worker: `https://code-solution-robo.victorhugoteixeirasimon6.workers.dev`
- Attendant Worker: `https://code-solution-atendente.victorhugoteixeirasimon6.workers.dev`

## Arquitetura e segurança
- GitHub oficial: `VictorHugoSimon/code-solution`;
- Cloudflare oficial: Account ID `cad25fe6c91871bbafb58236cf9b9b81`;
- workflow de ownership impede deploy em uma conta Cloudflare diferente da conta pessoal oficial;
- segredos ficam apenas em GitHub Actions Secrets ou Cloudflare runtime secrets;
- `/painel/*` usa proteção na borda e recebe `noindex`, `noarchive` e `Cache-Control: no-store`;
- a API do CRM exige `CRM_ADMIN_KEY` no upstream;
- CRM anônimo retorna HTTP 401;
- lead inválido retorna HTTP 400 `validation_error` antes da escrita;
- o domínio raiz retorna HTTP 301 para `https://www.codesolution.com.br/`;
- MX/TXT de e-mail Zoho são preservados no DNS.

## Runtime secrets

### `code-solution-robo`
- `AI_API_KEY`
- `GITHUB_TOKEN`
- `MANUAL_KEY`

### `code-solution-atendente`
- `AI_API_KEY` para fallback externo opcional;
- `CRM_ADMIN_KEY`;
- opcionais para WhatsApp Cloud API: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `OWNER_WHATSAPP`.

O assistente usa Cloudflare Workers AI como provedor principal. Provedores externos podem ser mantidos apenas como fallback.

## Pipeline de release
- build e validação de conteúdo;
- geração de blog e sitemap;
- preparação SEO/AEO;
- aplicação obrigatória da marca **Code Solution** nas superfícies públicas;
- validação que bloqueia a presença pública do nome legado do assistente;
- deploy automático para Cloudflare Pages;
- deploy automático dos Workers;
- smoke das rotas públicas;
- smoke do assistente, lead e CRM;
- validação de redirect canônico;
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
- `docs/PRODUCTION-GAPS.md`

## Itens opcionais pós-lançamento
- WhatsApp Cloud API para avisos automáticos de novos leads;
- Meta Pixel quando o Pixel ID oficial estiver disponível;
- evolução de analytics e automações comerciais.

Nenhum desses itens bloqueia o funcionamento atual da Produção.

## Comandos locais

```bash
npm run check
```
