# Contigo conectado a OpenAI

## Qué incluye
- `public/index.html`: interfaz Contigo con tus imágenes y colores.
- `server.js`: servidor que llama a la API de OpenAI sin exponer la clave en el navegador.
- `package.json`: dependencias y comando de inicio.

## Ejecutarlo localmente
Necesitas Node.js 20+ y una API key de OpenAI Platform (la API se factura por separado de ChatGPT).

1. Abre una terminal en esta carpeta.
2. Ejecuta `npm install`.
3. Configura las variables de entorno `OPENAI_API_KEY` y `OPENAI_MODEL`.
   - macOS/Linux: `export OPENAI_API_KEY="tu_clave"` y `export OPENAI_MODEL="gpt-5.4-mini"`
   - Windows PowerShell: `$env:OPENAI_API_KEY="tu_clave"` y `$env:OPENAI_MODEL="gpt-5.4-mini"`
   - En servicios de hosting, configúralas en su panel de Environment Variables.
4. Ejecuta `npm start`.
5. Abre `http://localhost:3000`.

No pongas la clave en `public/index.html`, Google Sites, GitHub ni en un mensaje de chat.

## Publicarlo e insertarlo en Google Sites
Despliega toda esta carpeta como un Web Service Node.js en un proveedor de hosting compatible:
- Build command: `npm install`
- Start command: `npm start`
- Variables de entorno: `OPENAI_API_KEY`, `OPENAI_MODEL`

Usa la URL HTTPS que te dé el proveedor en Google Sites → Insertar → Insertar URL. Si el iframe no se muestra, añade un botón que abra la URL en otra pestaña.

## Importante para un proyecto escolar
Este es un prototipo, no un servicio profesional de crisis. Pide a un docente/adulto responsable que revise privacidad, seguridad y respuestas antes de compartirlo con estudiantes. No uses relatos reales identificables para pruebas. El historial de esta interfaz vive en memoria del navegador y no se guarda en almacenamiento local; el servidor solicita `store: false`, pero esto no significa que todas las obligaciones de privacidad o retención de un proveedor desaparezcan. La IA puede equivocarse. Para peligro inmediato, el estudiante debe acudir a un adulto seguro o servicios de emergencia, no depender del chat.
