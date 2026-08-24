# Gaps de Produção — atualizado em 24/08/2026

## Resolvidos

- Índice do blog é reconstruído automaticamente e conteúdo inválido fica fora do índice.
- Robô de conteúdo evita sobrescrever slug existente e a seleção de pauta não depende apenas do dia do mês.
- CRM possui autenticação administrativa no backend, Lead Score, timeline, próxima ação e 12 etapas.
- D1 `code-solution-crm` foi provisionado e está sendo usado pelo Worker atendente.
- Workers de conteúdo e atendimento estão publicados via GitHub Actions.
- Cloudflare Pages `codesolution-site` possui deployment de produção ativo.
- Home, Serviços, Setores, Calculadora, Assistente e Privacidade estão disponíveis no `codesolution-site.pages.dev`.
- Home possui captura direta de lead e Serviços possui camada AEO no bundle publicado.
- Codi passou a usar Cloudflare Workers AI como provedor principal, reduzindo dependência de chave Groq externa.
- O contrato de lead inválido continua bloqueando escrita antes do D1 (`400 validation_error`).
- CRM anônimo continua bloqueado (`401 unauthorized`).

## Bloqueios externos atuais

### 1. Domínio oficial / DNS

O projeto Pages e os custom domains existem, porém `codesolution.com.br` e `www.codesolution.com.br` continuam pendentes com `CNAME record not set`.

O token Cloudflare usado pelo GitHub consegue ler a zona, mas a API de DNS retorna `403 Authentication error`. É necessário acrescentar ao token acesso de DNS da zona `codesolution.com.br` antes de automatizar o apontamento para `codesolution-site.pages.dev`.

### 2. Chave administrativa do CRM

`CRM_ADMIN_KEY` ainda não está cadastrado como Repository Secret no GitHub. Enquanto estiver ausente, `/crm/*` permanece fechado para todos, inclusive o painel administrativo.

Cadastrar um valor forte em GitHub → Settings → Secrets and variables → Actions → Repository secrets → `CRM_ADMIN_KEY`. O workflow de Workers já sincroniza esse secret para o Worker atendente sem gravá-lo no repositório.

## Itens opcionais, não bloqueadores

- WhatsApp Cloud API: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` e `OWNER_WHATSAPP` para notificação automática de novos leads.
- Meta Pixel: depende do Pixel ID oficial da conta Meta; não usar placeholder.
- Groq: pode permanecer como fallback opcional; Codi não depende mais dele como provedor principal.

## Critério para declarar produção finalizada

1. DNS API acessível pelo token e `@`/`www` apontando corretamente para o Pages.
2. `www.codesolution.com.br` servindo o novo site e `codesolution.com.br` redirecionando 301 para `www`.
3. `CRM_ADMIN_KEY` configurado e `/painel/crm/` autenticando com sucesso.
4. Smoke público verde para Home, Serviços, Setores, Calculadora, Diagnóstico, Assistente, Privacidade, artigo estático, Workers, Codi e contrato de lead.
