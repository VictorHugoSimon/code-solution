# Site Code Solution — manifesto do pacote-fonte 2026-08-23

Pacote recebido em 23/08/2026: `Site Code Solution.zip`.

Este manifesto registra os arquivos autorais e seus SHA-256 para permitir auditoria, restauração e conferência de futuras importações para `src/`. O `deploy/` não deve ser substituído diretamente pelos `.dc.html`: ele contém rotas e camadas adicionais de produção.

## Fontes autorais

| Arquivo | SHA-256 |
|---|---|
| `Assistente Atendimento.dc.html` | `2ca2f0dd2fb7028be25efd5fc454ac54a67bc286a176571a8f599ea176a2d15c` |
| `Blog.dc.html` | `f10b272b50301b45d4fe0892ac965c277414eb39a6e0faa69c1f264633506ae3` |
| `Calculadora.dc.html` | `42f211ad7419f2e98a48f84dc8f183bdf05d0be7058e1890e4ae6ae7564f3622` |
| `Calendario Editorial.dc.html` | `e63048e66b6c1dcef4c5600c83f9fab0ee6909500e8d4b7cb0647eaaee2bfb99` |
| `Code Solution.dc.html` | `a73d57c1671dbd0feca0a4adabd56bab543d9fbb0adf99e25aa7bdc60d5d0ed8` |
| `Destaques.dc.html` | `30deeac936afcd87581715377ee1473c2f4043552ae0367892624816de3694bd` |
| `Ecossistema Automatizado.dc.html` | `4ff48718b880a8572c51d1575017792216e0c178ff88e16c47c92b83aa205219` |
| `Inteligencia de Mercado.dc.html` | `c936208b983cf6ee18d210feaa54b248446c42372e5a82dee27ef6be0539c388` |
| `Kit de Marca.dc.html` | `fffffc0bee572a99a47da28265533e9522cd0bf4c8c3ee5ae9ea5e0faf9f00b2` |
| `Manual do Prospector.dc.html` | `be4e11b5a0d05b097fbde866a841111ea48def7a7ffd9578aadde0cd6cf1374a` |
| `Painel Marketing.dc.html` | `e6efe7ff406c27e2d702d768e2bb55df3bf21fb394586b9abfc0a385fa40f77b` |
| `Painel.dc.html` | `90109f1e8dd44f89a8da6e02eaa34e5b94390c4a1069e5e5558fb158ff959e8c` |
| `Posts.dc.html` | `e739bc3ab0aed1096cbbe3f6869411510fad185fd76c26bedfd709a54c92d09a` |
| `Redes Sociais.dc.html` | `a6e3ac3c44afc2a9fc19c011cd1f0846f04f9e3696943f02a98db708d0a285c8` |
| `Servicos.dc.html` | `4311def3bf68ef03fb978f593f451b81c3ba06ba649ad4fada8f4a76f99c04ff` |
| `Setores.dc.html` | `d21d4832ce9523618e31505d5f3cb82b5463edbe9957c4c0a62639d1fb830766` |
| `blog-posts.js` | `c7fe350de26a9b62b6efbb4f1f951a59920f70d4fdeb7c0e2e9abb23f0cabcf0` |
| `doc-page.js` | `f52ae9c02fca7ab44c37f3ff363194fdf81caa20ae63e2fe1f518ed21133185e` |
| `site-i18n.js` | `b45a801396ac11c2c1fe1b7033304779c214dde17b2f3f7d0ddd1f80406a53e5` |
| `support.js` | `8fe7df74405f3c55f49b7249c74ea1397e65d07dea2b1bd3b4a489bec2e28cbe` |

## Estado de integração

- `/setores/`: conteúdo principal convertido para HTML estático crawlable em `deploy/setores/index.html`.
- `/calculadora/`: regras/faixas aprovadas convertidas para página estática interativa em `deploy/calculadora/index.html`.
- Home: FAQ/AEO e links comerciais incorporados pelo `scripts/prepare-pages.mjs`.
- Serviços: resposta direta/AEO e links comerciais incorporados pelo `scripts/prepare-pages.mjs`.
- Os `.dc.html` restantes continuam sendo a referência de autoria do pacote e devem ser importados para `src/` sem substituir o `deploy/` de produção.

## Regra de segurança

Nunca usar o pacote-fonte para apagar `deploy/diagnostico`, `deploy/assistente`, `deploy/privacidade`, `deploy/painel/crm`, `deploy/_worker.js`, artigos estáticos ou outros artefatos gerados pela esteira.
