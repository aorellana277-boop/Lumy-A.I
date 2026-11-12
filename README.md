# Proyecto LUMY — Chatbot Educativo de Orientación y Protección Escolar (v2.0)

## Descripción General
**Lumy** es un sistema conversacional educativo desarrollado en **Node.js** y **Express** orientado a brindar escucha empática, orientación práctica y protocolos de seguridad inmediata a estudiantes frente a situaciones de:
- Bullying y acoso escolar (verbal, físico, social y psicológico).
- Insultos, apodos ofensivos y humillaciones públicas.
- Exclusión social, aislamiento, rumores y difamación.
- Amenazas, intimidación y miedo durante el recreo o a la salida del colegio.
- Ciberacoso, difusión no consentida de imágenes y perfiles falsos.
- Discriminación (por origen, apariencia, idioma, discapacidad, condición socioeconómica o identidad).
- Conflictos entre compañeros, amistades y presión de grupo.
- Problemas, trato humillante o intimidación por parte de profesores o adultos del colegio.
- Violencia familiar y maltrato en el hogar.
- **Protocolo prioritario especializado** ante violencia sexual, abuso sexual, tocamientos sin consentimiento, coerción digital y lesiones íntimas.
- **Protocolos independientes de emergencia** ante peligro físico inmediato y riesgo de autolesión o suicidio.
- Orientación sobre cómo pedir ayuda a un adulto de confianza y cómo apoyar de forma segura a un amigo o compañero.

Funciona con un **motor conversacional local autónomo** (sin necesidad de claves secretas de OpenAI ni APIs de pago).

## Archivos del Proyecto
- `server.js`: Motor conversacional completo (normalización tolerante a errores ortográficos y jerga estudiantil, extracción segura de nombres propios, análisis de contexto multi-turno, clasificación jerárquica de intenciones, bancos de respuestas modulares y endpoints `/api/chat` y `/health`).
- `public/index.html`: Interfaz web oficial de Lumy (conserva íntegramente el diseño, colores e imágenes originales).
- `package.json`: Configuración del proyecto y scripts de ejecución y pruebas.
- `test-lumy.js`: Batería automatizada con más de 60 pruebas unitarias, contextuales y de endpoints HTTP.

## Ejecución Local
Requisitos: **Node.js 20+**.

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Verifica la sintaxis del servidor:
   ```bash
   npm run check
   ```
3. Ejecuta la batería de pruebas (+60 casos):
   ```bash
   npm test
   ```
4. Inicia el servidor:
   ```bash
   npm start
   ```
5. Abre en tu navegador `http://localhost:3000`.

## Despliegue en Render y GitHub
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Variables de entorno**: No requiere claves externas (`OPENAI_API_KEY` no es necesaria). Render asigna `PORT` automáticamente y `server.js` incluye `app.set("trust proxy", 1)` para compatibilidad con el balanceador de Render.
- **Verificación de salud**: Abre `https://tu-dominio-en-render.onrender.com/health` para comprobar que devuelve `"ok": true` y `"project": "Lumy"`.

## Aviso Importante de Protección Escolar
Lumy es una herramienta educativa de orientación primaria y **nunca sustituye la atención médica, psicológica, legal ni de protección infantil profesional**. Ante cualquier situación de peligro inmediato, violencia familiar, agresión sexual o riesgo de autolesión, el estudiante debe acudir de inmediato a un adulto de confianza y a los servicios oficiales de emergencia:
- **SíseVe (MINEDU — Violencia Escolar)**: [https://siseve.minedu.gob.pe/](https://siseve.minedu.gob.pe/) · Línea gratuita `0800-76-888` · WhatsApp `991 410 000`
- **Línea 100 y Chat 100 (MIMP — Violencia Familiar y Sexual)**: [https://www.gob.pe/44181](https://www.gob.pe/44181-solicitar-ayuda-en-casos-de-violencia-contra-las-mujeres-e-integrantes-del-grupo-familiar-linea-100) y [https://chat100.warminan.gob.pe/](https://chat100.warminan.gob.pe/) · Teléfono gratuito `100` (24 h)
- **Línea ANNA 1810 (MIMP — Desprotección Familiar de Niñas, Niños y Adolescentes)**: [https://www.gob.pe/institucion/mimp/contacto-y-numeros-de-emergencias](https://www.gob.pe/institucion/mimp/contacto-y-numeros-de-emergencias) · Teléfono gratuito `1810`
- **Línea 113 Opción 5 (MINSA — Salud Mental y Psicología)**: [https://www.gob.pe/555](https://www.gob.pe/555-recibir-informacion-y-orientacion-en-salud) · Teléfono gratuito `113` (opción 5, 24 h)
- **Emergencias Nacionales (Perú)**: [https://www.gob.pe/547-telefonos-de-emergencia](https://www.gob.pe/547-telefonos-de-emergencia) · Policía Nacional `105` · SAMU `106` · Bomberos `116`
