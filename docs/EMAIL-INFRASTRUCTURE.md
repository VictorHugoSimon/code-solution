# Code Solution — infraestrutura de e-mail

## Estado validado em 30/08/2026

Com base no painel administrativo Zoho Mail apresentado pelo proprietário:

- Organização: Code Solution
- Domínio: `codesolution.com.br`
- Superadministrador: `victorhugoteixeirasimon6@gmail.com`
- Plano: Mail Free
- Usuários ativos exibidos no painel: 5
- Licenças exibidas no painel: 5
- Grupos exibidos no painel: 0

## Isolamento de ambiente

A infraestrutura de e-mail registrada aqui pertence à Code Solution e deve permanecer separada de Instituto Államo e demais projetos.

## Regras operacionais

- Não remover ou substituir registros MX/TXT/SPF/DKIM/DMARC do Zoho durante alterações de DNS web.
- Alterações de `A`, `AAAA` ou `CNAME` do site não devem interferir nos registros de e-mail.
- Contas, aliases e grupos devem usar o domínio `codesolution.com.br`.
- Integrações futuras de CRM por e-mail devem usar credenciais próprias da Code Solution e nunca credenciais de outros projetos.

## Próximos passos recomendados

- Validar SPF, DKIM e DMARC publicamente.
- Definir caixas funcionais como comercial, atendimento e financeiro conforme necessidade operacional.
- Integrar notificações do CRM somente após definir a conta remetente oficial e método de autenticação do Zoho.
