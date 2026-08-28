# Happy Corner · Carta Digital

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-CMS-34A853?style=flat-square&logo=googlesheets&logoColor=white)
![No framework](https://img.shields.io/badge/framework-ninguno-lightgrey?style=flat-square)
![GitHub Pages](https://img.shields.io/badge/hosting-GitHub_Pages-222222?style=flat-square&logo=github)

Menú digital de autoservicio para **Happy Corner** (cafetería · gelatería · orxatería), en Torrent, Valencia. Pensado para acceder desde el móvil escaneando un QR en la mesa: el cliente ve la carta completa sin descargar nada ni instalar una app.

**Demo en vivo: https://giancarlos25.github.io/happycorner-menu

## Qué es esto

Un sitio estático (sin frameworks ni build tools) que lee el contenido de la carta directamente desde una Google Sheet, para que el negocio pueda actualizar platos, precios y fotos sin tocar código ni depender de un desarrollador para cada cambio.

## Stack técnico

- HTML, CSS y JavaScript nativos — sin React, sin bundlers, sin dependencias de build.
- Google Sheets como CMS headless (exportado como CSV vía `gviz/tq`), con `menu.json` como respaldo local para los datos fijos del negocio (nombre, horario, hero).
- Hospedaje gratuito en GitHub Pages / Netlify — sin coste de servidor ni dominio para el cliente.
- Iconos: Font Awesome (CDN). Tipografía: Fredoka + Poppins (Google Fonts).

## Funcionalidades

- **Navegación por secciones**: categorías con miniatura circular (foto o icono), mostrando una sección a la vez en vez de un scroll infinito.
- **Contenido editable desde el Excel/Sheet**, sin tocar código: foto de categoría, nota libre por sección, agrupación de listas largas (p. ej. "De barril" / "En botella"), logo de marca en filas compactas, e ingredientes por plato.
- **Detección automática de alérgenos**: a partir de una lista de ingredientes por plato, un diccionario de palabras clave detecta los 14 alérgenos regulados en la UE y muestra iconos de colores, con nombre visible al tocar (pensado para móvil, sin depender de hover). **Es una ayuda heurística basada en coincidencia de texto, no un análisis certificado** — cualquier negocio que la use debe verificar manualmente los alérgenos reales de cada receta antes de publicarlos.
- **Modelo de carrito local ("Mi Selección")**: el cliente arma su pedido en el propio navegador y se lo enseña al camarero (sin pagos, sin backend). Actualmente desactivado mediante un flag (`CART_ENABLED`) a petición del cliente, pero el código queda intacto y listo para reactivarse.
- Diseño responsive, con paleta y tipografía de marca propia del negocio.

## Estructura

```
menu-web/
├── index.html      # Estructura de la página
├── style.css       # Estilos
├── script.js       # Lógica: lee la Sheet/menu.json y pinta la carta
├── config.js       # URL de la Google Sheet conectada
├── menu.json       # Datos fijos del negocio + carta de respaldo sin Sheet
└── assets/         # Logo e imágenes propias
```

## Licencia y aviso legal

### Titularidad

- **Código fuente** (HTML/CSS/JS de este repositorio): autoría de Gian Carlos, quien conserva el derecho a reutilizarlo, adaptarlo y mostrarlo como parte de su portfolio y trayectoria profesional.
- **Nombre, logotipo, identidad de marca, fotografías, textos de la carta e ideas de negocio de "Happy Corner"**: son propiedad exclusiva de Happy Corner. Su reproducción, copia o reutilización por parte de terceros (incluyendo el nombre comercial y el logotipo) no está autorizada sin permiso expreso del negocio. Se alojan en este repositorio únicamente porque el sitio se sirve directamente desde aquí (GitHub Pages), y no implican cesión de derechos a nadie más.

### Exención de responsabilidad

- **Alérgenos**: la detección de alérgenos es una ayuda heurística basada en palabras clave sobre el campo "Ingredientes" de cada plato — no es un análisis certificado ni una verificación profesional. La responsabilidad de mantener actualizada y verificada la información real de ingredientes y alérgenos de cada producto es exclusivamente de **Happy Corner**. El desarrollador de este sitio queda exento de cualquier responsabilidad por errores, omisiones, reacciones alérgicas o cualquier consecuencia derivada de un dato de alérgenos incorrecto, desactualizado o mal introducido en la Google Sheet.
- **Precios y disponibilidad**: se gestionan por Happy Corner a través de la Google Sheet conectada; el desarrollador no se hace responsable de desincronizaciones, erratas o falta de actualización del contenido.
- **Marcas de terceros**: los logotipos de bebidas/proveedores que puedan mostrarse en la carta se usan únicamente para identificar productos realmente vendidos en el establecimiento (uso nominativo/descriptivo), sin implicar patrocinio, afiliación ni respaldo por parte de esas marcas.

### Uso del código

Salvo acuerdo distinto por escrito entre las partes, el desarrollador conserva el derecho a mostrar este proyecto (o extractos del código) como muestra de trabajo en su portfolio y currículum. El repositorio no contiene credenciales ni datos sensibles: la única "conexión" externa es la URL pública de la Google Sheet, publicada por decisión del propio negocio.

---

## Autor

Desarrollado por **Gian Carlos** — [LinkedIn](https://www.linkedin.com/in/gian-carlos-samaniego-herrera-816123241/)
