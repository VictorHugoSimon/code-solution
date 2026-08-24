# Code Solution — Ownership de GitHub e Cloudflare

Atualizado em 24/08/2026.

## GitHub

Repositório oficial: `VictorHugoSimon/code-solution`

Owner GitHub: `VictorHugoSimon`

A Code Solution não utiliza um repositório do Instituto Államo como repositório de produção.

> O e-mail privado da conta GitHub não é exposto pela API usada na auditoria. A associação do login `VictorHugoSimon` ao e-mail pessoal deve ser conferida em GitHub → Settings → Emails.

## Cloudflare — conta oficial da Code Solution

Conta: `Victorhugoteixeirasimon6@gmail.com's Account`

Account ID: `cad25fe6c91871bbafb58236cf9b9b81`

Recursos confirmados nessa conta:

- Zona `codesolution.com.br`
  - Zone ID: `68188e983aeadea279bf680ccfd260c9`
- Pages `codesolution-site`
  - subdomain: `codesolution-site.pages.dev`
  - branch de produção: `main`
- Pages legado `codesolution`
  - subdomain: `codesolution.pages.dev`
- D1 `code-solution-crm`
  - database ID: `5f2a71bc-e3bf-4063-b52d-48ad11132e1d`
- KV `LEADS_KV`
  - namespace ID: `8308fb9fe843456c84afa724769c00b9`
- Worker `code-solution-atendente`
- Worker `code-solution-robo`
- Workers AI do atendente, via binding `AI`

## Auditoria da conta Instituto Államo

Conta auditada: `Victor.instituto.allamo@gmail.com's Account`

Account ID: `00899e6cd46cdd85b1bb6f1f9a5d313b`

Resultado da auditoria somente leitura:

- Pages Code Solution encontrados: 0
- D1 Code Solution encontrados: 0
- Workers Code Solution encontrados: 0
- zonas/domínios Code Solution encontrados: 0
- o endpoint de listagem de KV retornou 401 por falta de permissão do token do Instituto; porém o namespace efetivamente ligado à produção (`8308fb9f...`) foi confirmado diretamente na conta pessoal.

## Regra de proteção

O workflow `.github/workflows/guard-cloudflare-account.yml` recusa a configuração caso `CLOUDFLARE_ACCOUNT_ID` seja diferente de `cad25fe6c91871bbafb58236cf9b9b81` e também confere domínio, Pages, D1, KV e Workers na conta pessoal.

## Pendência operacional separada

O token configurado no secret `CLOUDFLARE_API_TOKEN` ainda precisa de permissão para acessar registros DNS da zona `codesolution.com.br`. Isso é uma pendência de permissão/token, não uma migração de conta: a zona já está na conta pessoal correta.
