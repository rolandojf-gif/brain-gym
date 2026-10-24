# BRAIN.GYM

Web personal para la rutina de entrenamiento cognitivo: al abrirla dice qué toca hoy, se hace y queda registrado.

- Brief: [`docs/brief.md`](docs/brief.md)
- Decisiones: [`docs/decisiones.md`](docs/decisiones.md)
- Arquitectura y modelo de datos: [`docs/arquitectura.md`](docs/arquitectura.md)

```sh
npm install
npm run dev
npm run verify
```

## Despliegue en Netlify

1. En Netlify: *Add new site → Import an existing project →* este repositorio. La configuración de compilación sale de `netlify.toml` (`npm run build`, publica `dist/`, funciones en `netlify/functions`).
2. En *Site configuration → Environment variables*, crea `BG_TOKEN` con una clave larga: `openssl rand -base64 32` en zsh. No la subas al repositorio.
3. Abre la web en el Mac y en el móvil, pestaña **Datos**, y pega la misma clave en cada uno. A partir de ahí se sincronizan solos.
4. En el móvil Android (Chrome): menú ⋮ → *Instalar aplicación* (o *Añadir a pantalla de inicio*). Queda como app propia, a pantalla completa y usable sin conexión.
