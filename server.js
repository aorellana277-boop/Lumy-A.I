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
      frameAncestors: ["'self'", "https://sites.google.com", "https://*.google.com"]
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

// Convierte el texto a una forma sencilla para reconocer palabras con o sin tildes.
function normalize(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9ñü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const stopNames = new Set([
  "esta", "este", "esa", "ese", "estos", "esas", "aquel", "aquella",
  "persona", "chico", "chica", "companero", "companera", "amigo", "amiga",
  "me", "te", "se", "lo", "la", "los", "las", "que", "quien", "cuando",
  "hoy", "ayer", "antes", "alguien", "nadie", "todos", "todas", "muchos",
  "muchas", "siempre", "nunca", "porque", "pero", "tambien", "solo", "sola",
  "muy", "mas", "menos", "como", "donde", "aqui", "ahi", "alli", "conmigo"
]);

// Extrae solo un nombre de pila cuando la persona usuaria lo menciona claramente.
// No intenta identificar a nadie ni pide apellidos o datos del colegio.
function extractPersonName(text = "") {
  const patterns = [
    /\b(?:persona|chico|chica|compañero|compañera|estudiante|alumno|alumna|amigo|amiga)\s*(?:\(|,|:)?\s*(?:llamado|llamada|de nombre)?\s*([a-zñü]{2,20})\b/i,
    /\b(?:se llama|llamado|llamada|de nombre)\s+([a-zñü]{2,20})\b/i,
    /^\s*([a-zñü]{2,20})\s+(?:me|nos)\s+(?:molesta|molestan|insulta|insultan|grita|amenaza|empuja|pega|golpea|se burla|excluye|acosa)\b/i,
    /\b([a-zñü]{2,20})\s+(?:me|nos)\s+(?:molesta|molestan|insulta|insultan|grita|amenaza|empuja|pega|golpea|excluye|acosa)\b/i
  ];

  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim();
      if (!stopNames.has(normalize(candidate)) && candidate.length >= 2) {
        return candidate.charAt(0).toLocaleUpperCase("es") + candidate.slice(1);
      }
    }
  }
  return null;
}

function findRecentPersonName(userMessages) {
  for (const message of [...userMessages].reverse()) {
    const found = extractPersonName(message);
    if (found) return found;
  }
  return null;
}

function includesAny(text, terms) {
  return terms.some(term => text.includes(term));
}

function classifyBehavior(text) {
  if (includesAny(text, ["golpea", "golpeo", "pega", "pego", "empuja", "empujo", "patada", "agrede", "me toca sin permiso", "me fuerza"])) return "physical";
  if (includesAny(text, ["whatsapp", "redes", "internet", "grupo de chat", "chat", "publica fotos", "sube fotos", "difunde", "mensaje", "mensajes", "cuenta falsa", "ciberacoso"])) return "online";
  if (includesAny(text, ["excluye", "excluyen", "me dejan fuera", "no me incluyen", "no me invitan", "me ignoran", "me aislan"])) return "social";
  if (includesAny(text, ["insulta", "insultan", "burl", "apodo", "humilla", "ridiculiza", "se rie de mi", "se rien de mi", "comentarios sobre mi"])) return "verbal";
  if (includesAny(text, ["amenaza", "amenazan", "chantaje", "intimida", "me espera afuera", "me persigue"])) return "threat";
  if (includesAny(text, ["molesta", "molestan", "acosa", "acosan", "hostiga", "me hace sentir mal", "me trata mal"])) return "general";
  return "unknown";
}

function isRepeated(text) {
  return includesAny(text, ["todos los dias", "cada dia", "siempre", "constantemente", "muchas veces", "varias veces", "desde hace tiempo", "todas las semanas", "repetidamente"]);
}

function chooseVariant(text, variants) {
  // La misma entrada obtiene una variante estable, pero otras frases pueden sonar diferentes.
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return variants[hash % variants.length];
}

function safetyReply(text) {
  if (includesAny(text, [
    "suicid", "quitarme la vida", "matarme",
    "no quiero vivir", "quiero morir", "hacerme dano", "quiero hacer dano",
    "lastimarme", "autolesion"
  ])) {
    return "Siento mucho que estés pasando por algo tan difícil. No tienes que manejarlo a solas ni esperar a que este chat lo resuelva. Por favor, busca ahora mismo a un adulto de confianza y dile claramente que necesitas ayuda. Si crees que podrías hacerte daño pronto, quédate acompañado y pide ayuda de emergencia.";
  }

  if (includesAny(text, [
    "me esta pegando", "me esta golpeando", "me amenaza ahora", "estoy en peligro ahora",
    "me quiere hacer dano ahora", "no estoy a salvo", "me acorrala ahora"
  ])) {
    return "Tu seguridad es lo primero. Si puedes hacerlo sin aumentar el peligro, aléjate hacia un lugar donde haya otras personas y busca inmediatamente a un adulto de confianza. Si el peligro es inmediato, pide ayuda a los servicios de emergencia locales. No te quedes esperando una respuesta de este chat.";
  }

  return null;
}

function responderContigo(messages) {
  const userMessages = messages
    .filter(message => message.role === "user")
    .map(message => message.content);
  const current = userMessages[userMessages.length - 1] || "";
  const currentText = normalize(current);
  const contextText = normalize(userMessages.slice(-6).join(" "));
  const name = findRecentPersonName(userMessages.slice(-6));

  const safety = safetyReply(normalize(userMessages.slice(-3).join(" ")));
  if (safety) return safety;

  const previousAssistant = messages
    .filter(message => message.role === "assistant")
    .slice(-1)[0]?.content || "";
  const previousAssistantText = normalize(previousAssistant);

  if (["si", "sí", "no", "no se", "no lo se"].includes(currentText) && previousAssistantText.includes("adulto de confianza")) {
    if (currentText === "si" || currentText === "sí") {
      return "Qué bueno que tengas a alguien a quien acudir. 💙 Puedes contarle qué ocurrió, cómo te afecta y qué apoyo necesitas. No tienes que resolverlo por tu cuenta. ¿Te gustaría que preparemos una frase sencilla para iniciar esa conversación?";
    }
    return "Está bien; a veces cuesta encontrar a quién contárselo. Piensa si hay otra persona adulta que te haga sentir seguro: un familiar, tutor, docente u orientador. No tienes que darme sus nombres. ¿Hay alguien con quien te sentirías un poco más cómodo hablando?";
  }

  if (includesAny(currentText, ["hola", "holi", "buenos dias", "buenas tardes", "buenas noches"]) && currentText.length < 45) {
    return "¡Hola! 💙 Soy Lumy, de Contigo. Puedes contarme lo que está pasando con tus propias palabras. No necesitas compartir apellidos, el nombre de tu colegio ni otros datos personales. ¿Qué te gustaría conversar hoy?";
  }

  if (includesAny(currentText, ["que es el bullying", "que significa bullying", "tipos de bullying", "como reconocer el bullying", "como saber si es bullying"])) {
    return "El bullying es una forma de intimidación que suele repetirse y puede incluir burlas, insultos, exclusión, amenazas o agresiones. También puede ocurrir por internet. Un desacuerdo aislado no siempre es bullying, pero cualquier situación que te haga sentir inseguro o mal merece atención. ¿Quieres que te explique algún tipo en particular?";
  }

  const helpingFriend = includesAny(contextText, ["mi amigo", "mi amiga", "ayudar a un amigo", "ayudar a una amiga", "un companero esta sufriendo", "una companera esta sufriendo"]);
  const behavior = classifyBehavior(contextText);
  const hasProblem = behavior !== "unknown" || includesAny(contextText, [
    "bullying", "acoso escolar", "me molesta", "me molestan", "me insulta", "se burla de mi", "me excluye", "me amenazo"
  ]);

  if (helpingFriend && (hasProblem || includesAny(currentText, ["ayudar", "que hago", "que puedo hacer"]))) {
    return chooseVariant(currentText, [
      "Es muy valioso que quieras apoyar a tu amigo o amiga. Escúchale sin juzgar, dile que no merece ese trato y anímale a hablar con un adulto de confianza. No tienes que investigar ni enfrentarte a nadie. ¿Tu amigo o amiga está a salvo ahora?",
      "Puedes ayudar mucho simplemente estando presente, escuchando y acompañándole a buscar apoyo de un docente, tutor u otro adulto seguro. Evita prometer guardar secretos si alguien está en peligro. ¿Ha podido contárselo a una persona adulta de confianza?"
    ]);
  }

  if (hasProblem) {
    const repeated = isRepeated(contextText);
    const person = name ? `Mencionas a ${name}. ` : "Por lo que cuentas, ";
    let detail = "Aunque todavía no conozco todos los detalles, lo que estás contando merece ser escuchado y tomado en serio.";

    if (behavior === "physical") {
      detail = "Si hay empujones o agresiones físicas, no intentes enfrentarte a esa persona ni resolverlo a solas. Busca a un adulto de confianza y cuéntale lo ocurrido cuanto antes.";
    } else if (behavior === "online") {
      detail = "Si ocurre por mensajes o redes, no respondas con insultos ni reenvíes el contenido. Si es seguro, conserva los mensajes para mostrárselos a un adulto de confianza y utiliza las opciones de bloqueo o reporte de la plataforma con su apoyo.";
    } else if (behavior === "social") {
      detail = "Quedarse fuera o ser ignorado repetidamente puede doler mucho. Mereces formar parte de un entorno donde te traten con respeto. Un docente u orientador puede ayudarte a abordar lo que ocurre.";
    } else if (behavior === "verbal") {
      detail = "Los insultos y las burlas no son una forma aceptable de tratarte. No tienes que demostrar que puedes soportarlo. Cuéntaselo a un adulto de confianza, especialmente si se repite.";
    } else if (behavior === "threat") {
      detail = "Las amenazas deben tomarse en serio. No te reúnas a solas con esa persona para resolverlo. Busca el apoyo de un adulto de confianza y explícale qué ocurrió.";
    } else if (repeated) {
      detail = "Que suceda una y otra vez puede ser muy desgastante. No es tu culpa y no tienes que aguantarlo en silencio. Sería importante contárselo a un adulto que pueda apoyarte.";
    }

    const question = behavior === "unknown" || behavior === "general"
      ? " ¿Qué hace esa persona exactamente: se burla, te insulta, te excluye, te amenaza o sucede de otra manera?"
      : " ¿Hay algún adulto de confianza con quien puedas hablar hoy?";

    return chooseVariant(currentText, [
      `Siento que estés pasando por esto. ${person}${detail}${question}`,
      `Gracias por contármelo. 💙 ${person}${detail}${question}`,
      `No estás exagerando por querer que te traten con respeto. ${person}${detail}${question}`
    ]);
  }

  if (includesAny(currentText, ["quiero hablar", "necesito hablar", "estoy triste", "me siento mal", "me siento solo", "me siento sola", "no se que hacer"])) {
    return "Gracias por confiar en este espacio. No tienes que explicarlo perfectamente ni contarlo todo de una vez. Podemos ir paso a paso, y también sería bueno buscar a alguien de confianza que pueda escucharte en persona. ¿Qué es lo que más te preocupa en este momento?";
  }

  if (includesAny(currentText, ["que hago", "como puedo responder", "que le digo", "como hago para que pare", "como lo soluciono"])) {
    return "No tienes que enfrentarte a esa persona ni solucionar esto por tu cuenta. Una opción segura es contarle a un adulto de confianza qué pasó, cuándo ocurre y cómo te afecta. Puedes empezar diciendo: «Hay algo que está pasando en el colegio y necesito que me escuches y me ayudes». ¿Te gustaría que preparemos juntos cómo contarlo?";
  }

  if (includesAny(currentText, ["convivencia", "respeto", "companerismo", "amistad", "inclusion"])) {
    return "La convivencia mejora cuando escuchamos, respetamos las diferencias, evitamos las burlas y no dejamos sola a una persona que está siendo tratada mal. Si ves una situación injusta, puedes apoyar sin ponerte en riesgo y buscar ayuda de un adulto.";
  }

  if (includesAny(currentText, ["gracias", "muchas gracias"])) {
    return "De nada. 💙 Gracias por confiar en Contigo. Recuerda que mereces respeto y apoyo. Si esto está ocurriendo en tu vida, no tienes que llevarlo a solas: puedes hablar con una persona adulta de confianza.";
  }

  return "Quiero comprender mejor lo que necesitas. Puedes contarme con tus propias palabras qué pasó, cómo te hizo sentir o qué te gustaría que cambiara. También puedes empezar por una de estas frases: «Una persona me molesta», «Quiero ayudar a un amigo» o «No sé si lo que me pasa es bullying». No compartas apellidos ni datos de tu colegio.";
}

app.post("/api/chat", (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
      return res.status(400).json({ error: "Formato de conversación no válido." });
    }

    const safeMessages = messages.map(message => {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string"
      ) {
        throw new Error("Mensaje no válido.");
      }
      return { role: message.role, content: message.content.slice(0, 1200) };
    });

    const hasUserMessage = safeMessages.some(message => message.role === "user");
    if (!hasUserMessage) {
      return res.status(400).json({ error: "No se encontró un mensaje del estudiante." });
    }

    const reply = responderContigo(safeMessages);
    return res.json({ reply });
  } catch (error) {
    console.error("Error en el chatbot:", error?.message || "Error desconocido");
    return res.status(400).json({ error: "No se pudo procesar el mensaje. Inténtalo de nuevo." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`Lumy está funcionando en el puerto ${port}`);
});
