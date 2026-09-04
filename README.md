# Generador QR masivo

Genera muchos **códigos QR a la vez** a partir de una lista de textos, y los imprime todos juntos. Gratis, sin registro y sin backend: todo corre en tu navegador.

**➡️ [Abrir la app](https://maxterjunior.github.io/generador-qr/)**

![Generador QR](./public/open_graph.webp)

## Qué hace

Pegás una lista de textos —uno por línea— y obtenés un código QR por cada uno, listos para usar.

- **Generación en lote**: convertí una lista entera en códigos QR de una sola pasada.
- **Pestañas**: organizá lotes distintos en pestañas separadas, con nombres editables.
- **Todo queda guardado**: el contenido de las pestañas persiste en el navegador (`localStorage`); no hay servidor ni cuenta de usuario.
- **Impresión**: mandá todos los QR a imprimir en una sola hoja.
- **Impresoras Zebra**: generación de etiquetas en ZPL vía Zebra Browser Print, 4 códigos por fila.
- **Lectura de QR**: subí una imagen con un código y se agrega a la lista.
- **Marcado**: tildá los códigos ya usados mientras trabajás, con un modo de doble marca (dos estados) para flujos de dos pasos.
- **Separador configurable**: dividí la entrada por saltos de línea o por cualquier espacio en blanco.
- **Modo oscuro.**

## Para qué sirve

Pensado para cuando necesitás muchos códigos QR de golpe en vez de uno solo: etiquetar lotes de productos, inventario, activos de una oficina, cajas de un depósito, o cualquier listado que ya tengas en una planilla.

## Stack

[Preact](https://preactjs.com/) + [Signals](https://preactjs.com/guide/v10/signals/) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vitejs.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [`qrcode`](https://github.com/soldair/node-qrcode) · [`qr-scanner`](https://github.com/nimiq/qr-scanner) · [`zebra-browser-print-wrapper`](https://github.com/lhilario/zebra-browser-print-wrapper)

Se hostea en GitHub Pages, sin backend.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # chequeo de tipos + build de producción en dist/
npm run preview    # previsualizar el build
```

## Deploy

```bash
npm run deploy     # build + publicar dist/ en la rama gh-pages
```

## Licencia

Hecho por [Maxterjunior](https://github.com/maxterjunior).
