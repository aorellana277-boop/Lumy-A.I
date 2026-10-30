import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 3000;

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: [
        "'self'",
        "https://sites.google.com",
        "https://*.google.com"
      ]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: "20kb" }));

app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use(express.static("public"));

// CHATBOT DE Lumy: RESPUESTAS PROGRAMADAS

function responderLumy(mensaje) {
  const texto = mensaje
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Situaciones de autolesión o riesgo de suicidio
  if (/suicid|quitarme la vida|no quiero vivir|hacerme dano|lastimarme|autolesion|matarme/.test(texto)) {
    return "Siento mucho que estés pasando por esto. No tienes que afrontar esta situación a solas. Busca ahora mismo a un adulto de confianza y cuéntale cómo te sientes. Si estás en peligro inmediato, pide ayuda de emergencia. Este chat no sustituye la ayuda de una persona que pueda acompañarte.";
  }

  // Peligro inmediato
  if (/estoy en peligro|me esta pegando|me esta golpeando|me quiere pegar|me quiere hacer dano|me amenaza ahora|necesito ayuda urgente/.test(texto)) {
    return "Tu seguridad es lo primero. Busca un lugar seguro si puedes hacerlo sin ponerte en más peligro y acude inmediatamente a un adulto de confianza, docente u orientador. Si existe peligro inmediato, solicita ayuda de emergencia. No tienes que resolverlo a solas.";
  }

  // Ayudar a un amigo
  if (/mi amigo|mi amiga|ayudar a un amigo|ayudar a una amiga|un companero|una companera/.test(texto)) {
    return "Es muy valioso que quieras ayudar. Escucha a tu amigo sin juzgarlo, hazle saber que no está solo y anímalo a hablar con un adulto de confianza. No intentes enfrentar a quienes lo intimidan por tu cuenta. ¿Tu amigo está seguro en este momento?";
  }

  // Información sobre bullying
  if (/que es el bullying|que significa bullying|tipos de bullying|como identificar el bullying/.test(texto)) {
    return "El bullying es una forma de intimidación que puede repetirse y causar daño a otra persona. Puede ser físico, verbal, social o digital. Nadie merece recibir este trato. Es importante reconocerlo y pedir ayuda a un adulto de confianza.";
  }

  // Experiencias de acoso
  if (/bullying|acoso|se burlan de mi|me insultan|me excluyen|me humillan|me molestan|me pegan|me golpean/.test(texto)) {
    return "Siento que estés viviendo esa situación. No es tu culpa y mereces ser tratado con respeto. Puedes contarle lo ocurrido a un familiar, docente u orientador de confianza. Trata de guardar información sobre lo ocurrido, si es seguro hacerlo. ¿Hay algún adulto con quien puedas hablar?";
  }

  // Saludos
  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|holi)/.test(texto)) {
    return "¡Hola! 💙 Soy Lumy. Estoy aquí para orientarte sobre bullying, convivencia escolar y cómo ayudar a alguien. ¿Sobre qué tema te gustaría conversar?";
  }

  // Necesidad de hablar
  if (/quiero hablar|necesito hablar|estoy triste|me siento mal|me siento solo|me siento sola/.test(texto)) {
    return "Gracias por confiar en este espacio. Lo que sientes importa y mereces que te escuchen sin juzgarte. También puedes buscar a una persona adulta de confianza para hablar. ¿Qué es lo que más te preocupa?";
  }

  // Convivencia escolar
  if (/convivencia|respeto|companerismo|amistad|inclusion/.test(texto)) {
    return "Una buena convivencia escolar se construye con respeto, empatía, inclusión y diálogo. Podemos comenzar escuchando a los demás, evitando las burlas y apoyando a quienes lo necesitan. ¡Todos podemos contribuir a un ambiente seguro!";
  }

  // Ayuda inmediata
  if (/ayuda|necesito ayuda|no se que hacer/.test(texto)) {
    return "Estoy aquí para orientarte. Puedes contarme si necesitas información sobre bullying, ayudar a un amigo o hablar sobre una situación escolar. Si alguien está en peligro, busca inmediatamente a un adulto de confianza.";
  }

  // Respuesta general
  return "Puedo orientarte sobre bullying, acoso escolar, convivencia y cómo ayudar a un amigo. Prueba escribiendo: «¿Qué es el bullying?», «Me molestan en el colegio» o «Quiero ayudar a un amigo».";
}

// RUTA DEL CHATBOT
app.post("/api/chat", (req, res) => {
  try {
    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
      return res.status(400).json({
        error: "Formato de conversación no válido."
      });
    }

    for (const m of messages) {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        return res.status(400).json({
          error: "Mensaje no válido."
        });
      }
    }

    const ultimoMensaje = [...messages]
      .reverse()
      .find(m => m.role === "user");

    if (!ultimoMensaje) {
      return res.status(400).json({
        error: "No se encontró un mensaje del usuario."
      });
    }

    const reply = responderLumy(
      ultimoMensaje.content.slice(0, 1200)
    );

    return res.json({ reply });

  } catch (error) {
    console.error("Error en el chatbot:", error?.message || "Error desconocido");

    return res.status(500).json({
      error: "No se pudo procesar el mensaje."
    });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`Lumy está funcionando en el puerto ${port}`);
});
