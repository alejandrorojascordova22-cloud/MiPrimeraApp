import { ScrollViewStyleReset } from "expo-router/html";

/**
 * Este archivo solo se usa en web (expo-router lo detecta por su nombre
 * especial +html.tsx). Envuelve todo el documento HTML de la app.
 *
 * Lo agregamos para arreglar el "residuo de pantalla": sin este archivo,
 * <html>/<body> pueden desplazarse (scroll) por separado del contenido
 * interno de cada pantalla, y al ocultarse/mostrarse la barra de
 * direcciones del navegador (o con cualquier scroll de más) se alcanzaba
 * a ver un pedacito de la topbar por encima del contenido.
 *
 * ScrollViewStyleReset fija html/body a 100% de altura y sin scroll
 * propio, dejando que solo los ScrollView internos de React Native
 * hagan scroll — que es como se comporta normalmente esta app.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          // Refuerzo extra: evita que html/body tengan su propio scroll.
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                overflow: hidden;
                overscroll-behavior: none;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
