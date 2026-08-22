# Gaps de Produção — 22/08/2026

## Resolvidos neste ciclo

- Índice do blog passa a ser reconstruído automaticamente.
- Conteúdo com mojibake é colocado em quarentena e não entra no índice.
- Novo robô evita sobrescrever slug existente.
- Seleção de pauta deixa de depender apenas do dia do mês.
- API de CRM ganha autenticação administrativa, Lead Score, timeline, próxima ação e 12 etapas.
- Integração WhatsApp fica implementada e condicionada aos secrets oficiais.
- Deploy automático de Workers fica preparado via GitHub Actions.
- Painel CRM Kanban ganha primeira versão funcional.

## Bloqueios externos que ainda exigem recurso da conta

- Código-fonte completo do Cloudflare Pages não está versionado no GitHub nem foi encontrado no Google Drive. Sem ele, um deploy automático do site poderia apagar páginas atuais; por isso não foi habilitado.
- Secrets Cloudflare do GitHub precisam existir para o workflow publicar Workers.
- `CRM_ADMIN_KEY` precisa ser cadastrado no Worker antes de usar endpoints `/crm/*`.
- WhatsApp Cloud API exige `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` e `OWNER_WHATSAPP` válidos.
- Meta Pixel continua dependente do Pixel ID da conta Meta.

## Próxima decisão técnica

Recuperar o pacote completo do Pages (`deploy/` atual ou fontes `.dc.html`) para colocá-lo sob Git. Depois disso: habilitar stage + production do site, deploy automático por branch, testes smoke e rollout do CRM/AEO no domínio principal.
