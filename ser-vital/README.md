# Ser Vital — Plataforma Digital

MVP digital do Espaço Terapêutico Ser Vital.

## Escopo do bootstrap
- Site institucional responsivo
- Páginas de Reiki, Radiestesia Radiônica e Meditação
- Captação de leads com origem/UTM e consentimento
- WhatsApp provisório: +55 18 99644-0034
- API Cloudflare Pages Functions
- Banco Cloudflare D1
- CRM administrativo básico
- Blog/SEO, sitemap e robots
- Páginas de privacidade e aviso institucional

## Identidade
- Verde: `#1E3B28`
- Roxo: `#613E5F`
- Areia: `#E9E2DC`
- Off-white: `#FAF9F6`
- Grafite: `#403E3B`

## Serviços MVP
- Reiki online — R$ 127
- Radiestesia Radiônica — R$ 197
- Meditação individual — R$ 97
- Jornada Equilíbrio (4 encontros) — R$ 497

Atendimentos com Viviane Greco, segunda a sexta, das 20h às 23h, duração média de 45–60 minutos.

## Executar localmente
Instale o Wrangler e rode a pasta `ser-vital` como projeto Cloudflare Pages. A aplicação foi desenhada para não exigir build no MVP.

## Banco
Execute `schema.sql` na base D1 e configure o binding `DB`.

## Segurança
O endpoint público de leads aceita somente os campos previstos e registra consentimento. A rota administrativa exige `ADMIN_TOKEN` no header `X-Admin-Token`. Em produção, recomenda-se também Cloudflare Access para `/admin`.

## Próximas integrações
1. D1 stage e produção
2. Turnstile
3. Agenda online
4. Gateway de pagamento
5. WhatsApp Business API
6. E-mail transacional
7. Search Console / analytics
8. Agentes IA e automações

> As práticas da Ser Vital são direcionadas ao bem-estar, relaxamento, autocuidado e autoconhecimento e não substituem avaliação, diagnóstico ou tratamento de profissionais de saúde regulamentados.
