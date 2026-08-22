# AEO — Implementação Code Solution

## Objetivo

Transformar páginas da Code Solution em fontes fáceis de compreender, extrair e citar por mecanismos de busca e assistentes de IA, preservando SEO técnico.

## Padrão obrigatório por página de serviço

1. Uma resposta direta de 40–80 palavras logo após o H1.
2. Seção “Quando essa solução faz sentido?” com sinais concretos de dor.
3. Tabela curta “Problema / Solução / Resultado esperado”.
4. FAQ com 4–6 perguntas reais de decisão de compra.
5. CTA único para diagnóstico/discovery.
6. `Service` + `FAQPage` em JSON-LD, mantendo o conteúdo visível igual ao schema.
7. Autor/organização e data de atualização visíveis quando houver conteúdo editorial.
8. Links internos para cases, serviço relacionado e contato.

## Perguntas-base

### Desenvolvimento sob medida
- Quando vale a pena desenvolver um sistema sob medida?
- Quanto de processo deve estar definido antes do projeto?
- Sistema sob medida substitui ERP?
- Como reduzir risco de dependência do fornecedor?
- Como funciona sustentação depois do go-live?

### Automação
- Quais processos devem ser automatizados primeiro?
- Como identificar ROI de uma automação?
- RPA funciona com sistemas legados?
- Como tratar falhas e exceções em automações?

### Inteligência Artificial
- Onde IA gera valor real em uma PME?
- Quando usar RAG em vez de um chatbot genérico?
- Como impedir que um agente tome ações indevidas?
- Como medir qualidade de uma solução de IA?

### Dados & BI
- Quando uma planilha deixa de ser suficiente?
- Qual a diferença entre dashboard e BI?
- Como integrar dados de ERP, CRM e e-commerce?
- Como garantir qualidade dos indicadores?

## Estrutura de resposta direta

> **Resposta direta:** [definição objetiva]. A solução é indicada quando [condições]. Antes de implementar, é preciso validar [pré-requisitos]. O resultado deve ser medido por [métricas].

## Dados estruturados

Usar somente schemas compatíveis com o conteúdo real da página. Evitar marcação invisível, perguntas que não aparecem na interface ou alegações que não possam ser comprovadas.

## Implementação pendente no Pages

O fonte compilável atual do site não está neste repositório. Assim que o pacote `deploy/` completo ou os `.dc.html` forem recuperados, aplicar este padrão diretamente em Home, Serviços e Blog, atualizar o sitemap e validar rich results.
