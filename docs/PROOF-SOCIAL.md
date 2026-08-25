# Prova social e cases — Code Solution

## Regra editorial

A Code Solution não publica métricas de resultado sem evidência auditável ou autorização explícita do cliente. Um case pode demonstrar problema, solução, arquitetura, capacidades e produto público sem transformar inferências em números promocionais.

## Cases publicados

### S.O.S Truck
URL: `/cases/sos-truck/`

Base verificável pública:
- o produto S.O.S Truck apresenta no site atual as frentes Capacitações, Peças, Localizações e Serviços;
- sua missão pública é unir caminhoneiros aos serviços necessários na estrada;
- o site público descreve uso do aplicativo para localizar/cotar peças e encontrar serviços.

O case não publica como métrica própria números históricos de downloads, cadastros ou ROI.

### Tonini
URL: `/cases/tonini/`

Base verificável pública:
- e-commerce de autopeças com categorias técnicas;
- busca por veículo;
- filtros por ano-modelo, montadora, motorização, marca e modelo completo;
- páginas de produto com compatibilidade veicular e jornada de compra.

O case não atribui conversão, faturamento ou aumento de venda sem fonte auditável.

### Plataforma Code Solution
URL: `/cases/code-solution/`

Base verificável interna:
- Cloudflare Pages em produção;
- Workers de conteúdo e atendimento;
- Workers AI;
- D1 e KV;
- CRM, aquisição, Growth e automação comercial;
- deploy automático e smoke pós-release;
- monitoramento e teste de restauração D1.

As evidências operacionais ficam nos arquivos de status sob `docs/`.

## Rastreabilidade comercial

Todas as páginas de case recebem `case_view` e CTAs recebem `case_cta_click`. Os CTAs para diagnóstico usam UTMs próprias, por exemplo:

- `utm_campaign=sos_truck_case`
- `utm_campaign=tonini_case`
- `utm_campaign=code_solution_case`

Esses eventos entram no mesmo pipeline de aquisição usado pelo CRM, permitindo medir influência dos cases sem criar uma fonte paralela de dados.
