# Treinamento comercial — deck e roteiro

Material para treinar o time no módulo Comercial e no uso do playbook.
São dois documentos com públicos diferentes:

| Arquivo | O que é | Para quem |
|---|---|---|
| `apresentacao-treinamento-comercial.pdf` | 25 slides 16:9, para projetar | a sala inteira |
| `roteiro-do-apresentador.pdf` | 4 páginas A4 — checklist de preparação, o que dizer por bloco, como conduzir cada exercício | só quem apresenta, **não projetar** |

A sessão é de 60 minutos, vendedores e suporte **juntos** — o exercício 3
confere os pedidos que os vendedores acabaram de registrar no exercício 2, e é
esse encadeamento que ensina o processo.

## Antes de marcar a data

Os três exercícios escrevem em produção, encadeados. A página 1 do roteiro tem
o checklist completo; os itens que travam a sessão inteira se faltarem:

- Catálogo carregado com preço de tabela (onda 0)
- Clientes com dono atribuído (onda 0)
- Logins do suporte criados com o papel `suporte` (onda 0)
- **Módulos Catálogo e Pedidos fora de `test`** — em `test`, só o admin enxerga
  as telas e a sala inteira abre um menu sem elas
- **A data de corte decidida e escrita no slide 21**, no lugar de `[DATA]`

## Regerar os PDFs

Precisa das fontes da marca instaladas (Inter e JetBrains Mono) — ver
`docs/playbook/README.md` para o passo de instalação, é o mesmo.

```sh
chromium --headless --no-pdf-header-footer \
  --print-to-pdf=apresentacao-treinamento-comercial.pdf apresentacao-treinamento.html
chromium --headless --no-pdf-header-footer \
  --print-to-pdf=roteiro-do-apresentador.pdf roteiro-do-apresentador.html
```

Esperado: deck com 25 páginas de 720 × 405 pt (16:9 exato) e roteiro com 4
páginas A4.

## Ao editar

Cada slide é uma `<div class="slide">` de 254 × 142,875 mm com
`overflow: hidden` — o que passa disso é cortado em silêncio, e num slide isso
acontece fácil. Depois de mexer, confira o PDF rasterizado, não o HTML no
navegador.

O deck descreve só o que já está no ar, igual ao playbook: o slide 22 lista as
pendências (portal, limite de margem, anexo). Se alguma delas entrar, o slide 22
e o playbook mudam juntos.
