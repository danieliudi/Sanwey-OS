# Playbook Comercial — fonte e regeração

`playbook-comercial.html` é a fonte; `playbook-comercial-sanwey.pdf` é o que se
entrega ao time. O HTML é autossuficiente (logo embutido em base64), então
regerar não depende de nenhum asset ao lado.

## Regerar o PDF

Precisa das duas fontes da marca instaladas (Inter e JetBrains Mono — Manual de
Marca v5.0). Sem elas o Chromium cai num fallback e a paginação muda:

```sh
# fontes, uma vez
mkdir -p ~/.fonts
curl -sSL https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip -o /tmp/i.zip
curl -sSL https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip -o /tmp/j.zip
unzip -jo /tmp/i.zip 'InterVariable.ttf' -d ~/.fonts
unzip -jo /tmp/j.zip 'fonts/ttf/JetBrainsMono-Regular.ttf' 'fonts/ttf/JetBrainsMono-Bold.ttf' 'fonts/ttf/JetBrainsMono-SemiBold.ttf' -d ~/.fonts
fc-cache -f

# o PDF
chromium --headless --no-pdf-header-footer \
  --print-to-pdf=playbook-comercial-sanwey.pdf playbook-comercial.html
```

Resultado esperado: 12 páginas A4 (595 × 842 pt), uma `.page` por folha.

## Ao editar

Cada página é uma `<div class="page">` de 210 × 297 mm com `overflow: hidden` —
conteúdo que passa disso é cortado em silêncio. Depois de mexer, confira o PDF
rasterizado (não o HTML no navegador: a barra de rolagem da janela engana e
sugere cortes que não existem no PDF).

Paleta e tipografia vêm do Manual de Marca Grupo Sanwey v5.0 (paleta unificada
Sanwey/Sanbag: creme `#F9F5F1` 60%, vermelho industrial `#B62D2C` 30%, carvão
`#2C2C2B` 10%). O conteúdo espelha as telas reais — ao mudar o fluxo de
Catálogo, Produtos & Preços ou Pedidos, o playbook muda junto.
