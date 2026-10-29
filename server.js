import express from "express";
import OpenAI from "openai";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(helmet({
  // Google Sites puede mostrar la web publicada en un iframe.
  // Si el proveedor de alojamiento añade otra política de frame, habrá que revisarla allí.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'", "https://sites.google.com", "https://*.google.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "20kb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use(express.static("public"));

const instructions = `
Eres Contigo, un asistente virtual amable que orienta a estudiantes sobre bullying, violencia escolar y convivencia.
Habla en español claro, con empatía, sin juzgar ni culpar. Escucha y valida emociones sin afirmar que puedes garantizar confidencialidad.
Ofrece pasos pequeños y seguros; recomienda acudir a un adulto seguro, familiar, tutor, docente u orientador escolar.
No eres terapeuta, profesional de emergencias ni sustituyes la ayuda humana. No investigues ni prometas resolver el caso.
No pidas nombres completos, dirección, colegio específico, teléfonos, contraseñas ni otros datos identificativos.
Si el estudiante describe peligro inmediato o teme que alguien le haga daño ahora, indica con calma que se aleje si puede hacerlo con seguridad, vaya con un adulto seguro y contacte los servicios de emergencia locales. No hagas que dependa de este chat.
Si revela abuso o violencia, anímale a contárselo a un adulto seguro y a pedir ayuda de inmediato. No prometas guardar secretos.
Si pregunta por autolesiones o suicidio, responde con cuidado, no des detalles ni instrucciones; anímale a acudir inmediatamente a un adulto seguro y a servicios de emergencia/crisis locales si existe peligro.
No inventes números telefónicos, políticas escolares ni recursos. Si está en Perú, puedes mencionar SíseVe como recurso oficial de violencia escolar, sin asegurar que sustituye una emergencia.
Respuestas breves, cálidas y prácticas. Haz como máximo una pregunta útil cada vez.
`;

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "El servidor todavía no tiene configurada la API Key." });
    }
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
      return res.status(400).json({ error: "Formato de conversación no válido." });
    }
    const safeMessages = messages.map((m) => {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        throw new Error("Mensaje no válido.");
      }
      return { role: m.role, content: m.content.slice(0, 1200) };
    });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions,
      input: safeMessages,
      store: false,
      max_output_tokens: 500
    });

    const reply = (response.output_text || "").trim();
    if (!reply) return res.status(502).json({ error: "La IA no devolvió una respuesta. Inténtalo de nuevo." });
    return res.json({ reply });
  } catch (error) {
    console.error("Error al responder:", error?.message || "Error desconocido");
    return res.status(500).json({ error: "No se pudo procesar el mensaje. Inténtalo de nuevo más tarde." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(port, () => console.log(`Contigo está funcionando en el puerto ${port}`));
