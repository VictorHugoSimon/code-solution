# Governança do Painel Code Solution

## Modelo de identidade

O painel usa identidades individuais persistidas no D1, sem armazenar senhas em texto.

- Usuários: `panel_users`
- Sessões: `panel_sessions`
- Auditoria: `panel_audit_log`
- Senhas: PBKDF2-SHA256 com salt individual e **100.000 iterações**, valor validado no runtime Cloudflare
- Sessões: token opaco; apenas SHA-256 do token é persistido no D1
- Expiração padrão: 8 horas
- Alteração de senha, role ou bloqueio incrementa `session_version` e revoga sessões anteriores
- A chave `CRM_ADMIN_KEY` continua técnica e server-side; não é credencial humana do painel

## Perfis

### Administrador
Acesso a todos os módulos, gestão de usuários, alteração de perfis, reset de senha, revogação de sessões e auditoria.

### Comercial
Visão, CRM com leitura/escrita, Atendimento, Agenda, Prospecção e Relatórios.

### Marketing
Visão, CRM em leitura, Marketing, Inteligência, Growth e Relatórios.

### Leitura Executiva
Visão, CRM em leitura, Inteligência e Relatórios. Não pode mutar o CRM.

## Recuperação de acesso

Existe endpoint técnico de break-glass `/auth/bootstrap-reset`, protegido exclusivamente por `CRM_ADMIN_KEY`, para recuperar um usuário quando não houver administrador acessível. O endpoint:

1. exige a chave técnica server-side;
2. aplica a mesma política forte de senha;
3. reativa o usuário;
4. incrementa a versão de sessão;
5. revoga sessões existentes;
6. registra evento `break_glass_password_reset` em auditoria.

Nenhuma senha de usuário deve ser colocada em commit, issue, log ou documentação.

## Auditoria

Eventos de autenticação e governança são registrados em `panel_audit_log`, incluindo:

- login bem-sucedido e falho;
- logout;
- criação de usuário;
- alteração de role, estado ou senha;
- revogação de sessões;
- recuperação break-glass.

A interface administrativa está em `/painel/usuarios/`.

## Separação Stage e Produção

Produção:
- Worker: `code-solution-atendente`
- D1: `code-solution-crm`
- Pages: `codesolution-site`, branch `main`

Stage:
- Worker: `code-solution-atendente-stage`
- D1: `code-solution-crm-stage`
- Pages preview: branch `staging`

A esteira Stage substitui o endpoint do atendente no bundle e usa banco separado. Dados e sessões de produção não devem ser copiados para homologação.

## Teste pós-release

O workflow `validate-panel-identity.yml` executa um teste real sem expor credenciais humanas:

1. valida schema e seed admin;
2. cria um usuário efêmero diretamente no D1;
3. autentica via `/auth/login`;
4. valida role e permissões em `/auth/session`;
5. efetua `/auth/logout`;
6. comprova revogação;
7. remove o usuário e seus dados de teste.

A evidência auditável é persistida em `docs/panel-identity-status.json` por uma validação de evidência dedicada.
