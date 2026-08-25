# Migração SEO — Code Solution

Atualizado em 25/08/2026.

## Objetivo

Consolidar toda a autoridade orgânica em `https://www.codesolution.com.br/` e retirar gradualmente do índice páginas do site WordPress/template anterior que não representam mais o posicionamento da Code Solution.

## Canonical

- domínio canônico: `https://www.codesolution.com.br/`
- `https://codesolution.com.br/*` deve responder com redirect HTTP 301 para o mesmo caminho em `www`;
- páginas atuais recebem canonical absoluto para `www.codesolution.com.br`;
- `/painel/*` permanece `noindex,nofollow,noarchive`.

## URLs legadas observadas em mecanismos de busca

| URL antiga | Destino novo | Motivo |
| --- | --- | --- |
| `/portfolio-category/website/` | `/servicos/` | arquivo antigo de portfólio/template |
| `/portfolio/apple-3d-design/` | `/servicos/` | case/template legado sem prova auditável |
| `/portfolio/illustration-visual-design/` | `/servicos/` | case/template legado sem prova auditável |
| `/a-guide-for-businesses-in-the-digital-age/` | `/blog/` | artigo WordPress legado |
| `/the-art-of-crafting-compelling-brand-stories/` | `/blog/` | artigo WordPress legado |
| `/how-analytics-can-drive-business-success/` | `/blog/` | artigo WordPress legado |
| `/portfolio/*` | `/servicos/` | fallback de portfólio antigo |
| `/portfolio-category/*` | `/servicos/` | fallback de categoria antiga |
| `/author/*`, `/category/*`, `/tag/*` | `/blog/` | taxonomias antigas |

Os redirects são implementados dentro de `deploy/_worker.js` pelo build `scripts/apply-seo-migration.mjs`, porque o Pages usa Worker avançado na borda.

## Conteúdo e prova pública

O build remove números e textos públicos que não possuam evidência auditável no repositório ou em fonte interna aprovada. Blocos genéricos de portfólio passam a ser apresentados como **exemplos de soluções**, e não como cases reais.

Cases reais só devem ser publicados quando houver:

1. cliente/projeto autorizado;
2. problema e escopo confirmados;
3. período/prazo confirmado;
4. resultado mensurável com fonte;
5. autorização para nome/logo/depoimento, quando aplicável.

## Sitemap e robots

- sitemap oficial: `https://www.codesolution.com.br/sitemap.xml`;
- somente URLs públicas e canônicas devem entrar no sitemap;
- painel, APIs e áreas administrativas nunca entram no sitemap;
- páginas removidas não devem permanecer referenciadas internamente.

## Google Search Console — procedimento operacional

A ação abaixo depende do acesso à conta Google responsável pela propriedade e não deve ser simulada por automação sem essa autorização.

1. confirmar propriedade de `codesolution.com.br` e/ou domínio no Search Console;
2. enviar `https://www.codesolution.com.br/sitemap.xml`;
3. inspecionar Home, Serviços, Setores, Calculadora, Diagnóstico, Assistente e Blog;
4. solicitar indexação das páginas estratégicas atuais;
5. inspecionar as URLs legadas acima e confirmar que o Google enxerga HTTP 301;
6. acompanhar Cobertura/Indexação nas semanas seguintes;
7. não usar remoção temporária para URLs que já possuem redirect permanente, salvo necessidade específica.

## Critério de conclusão

- canonical `www` consistente;
- apex 301;
- redirects legados 301 em produção;
- sitemap atual sem URLs antigas;
- páginas administrativas `noindex`;
- nenhuma métrica/case público sem prova auditável;
- Search Console documentado como etapa externa de reindexação.
