# Guía de Publicación Web

Este proyecto es una aplicación web estática construida con **Vite**. Esto significa que puede ser alojada gratuitamente en servicios líderes como **Netlify** o **Vercel**.

## Paso 1: Generar la Versión de Producción
Antes de subir tu sitio, asegurate de tener la versión más optimizada.
1. Abre tu terminal.
2. Ejecuta el comando:
   ```bash
   npm run build
   ```
3. Esto creará una carpeta llamada **`dist`** en tu proyecto (`c:\Users\ACER\.gemini\antigravity\scratch\portal_cautivo\dist`).
   * Esta carpeta contiene todo tu sitio comprimido y listo para la web.

## Paso 2: Publicar (Opción Fácil: Netlify Drop)
La forma más rápida sin configurar servidores:

1. Ve a [app.netlify.com/drop](https://app.netlify.com/drop).
2. Busca la carpeta **`dist`** que se generó en el Paso 1.
3. **Arrastra y suelta** la carpeta `dist` entera dentro del área punteada en la página de Netlify.
4. ¡Listo! En unos segundos te darán un link (ej. `random-name.netlify.app`) que puedes compartir.

## Paso 3: Publicar con GitHub (Recomendado)
Si quieres actualizaciones automáticas cada vez que guardes cambios:

1. Sube este proyecto a un repositorio de **GitHub**.
2. Crea una cuenta en **Vercel** o **Netlify**.
3. Selecciona "Import Project from GitHub".
4. Elige tu repositorio.
5. El sistema detectará automáticamente que es `Vite`.
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
6. Dale a "Deploy".

## Notas Importantes
* **Base de Datos**: Actualmente el proyecto usa `localStorage` (simulación local).
    * *Nota*: Al publicar en web, si borras la caché del navegador o entras desde otro dispositivo, los datos (usuarios, chats) comenzarán vacíos o separados.
    * Para un sistema real multi-usuario conectado, se requeriría un "Backend" (base de datos real como Firebase o Supabase).
