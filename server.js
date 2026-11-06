import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { applyLumyExtras } from "./lumy-respuestas-extra.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// -----------------------------------------------------------------------------
// LUMY - servidor local de orientación escolar.
// No utiliza OpenAI, Gemini, claves API ni servicios de IA externos.
// Mantiene el contrato que utiliza la web: POST /api/chat { messages: [...] }
// Respuesta: { reply: "..." }
// -----------------------------------------------------------------------------

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
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

app.use(express.json({ limit: "30kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Has enviado muchos mensajes seguidos. Espera un momento e inténtalo de nuevo." }
});

app.use("/api/", apiLimiter);
app.use(express.static("public"));

// -----------------------------------------------------------------------------
// Utilidades de texto
// -----------------------------------------------------------------------------

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9ñü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, phrases = []) {
  return phrases.some((phrase) => {
    const normalizedPhrase = normalize(phrase);
    return normalizedPhrase && text.includes(normalizedPhrase);
  });
}

function choose(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function recentUserText(messages, amount = 5) {
  return messages
    .filter((message) => message.role === "user")
    .slice(-amount)
    .map((message) => message.content)
    .join(" ");
}

const stopNames = new Set([
  "esta", "este", "esa", "ese", "persona", "chico", "chica",
  "companero", "companera", "amigo", "amiga", "profesor",
  "profesora", "profe", "docente", "maestro", "maestra",
  "director", "directora", "me", "te", "se", "mi", "mis",
  "tu", "su", "que", "quien", "cuando", "donde", "alguien",
  "nadie", "todos", "todas", "porque", "pero", "tambien",
  "solo", "sola", "mucho", "mucha", "siempre", "nunca",
  "hoy", "ayer", "antes", "ahora", "nombre", "llama"
]);

function cleanFirstName(raw) {
  const value = normalize(raw).split(" ")[0] || "";
  if (value.length < 2 || value.length > 20 || stopNames.has(value)) return null;
  if (!/^[a-zñü]+$/i.test(value)) return null;
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}

function extractName(message = "") {
  const patterns = [
    /\b(?:persona|companero|companera|amigo|amiga|profesor|profesora|profe|docente|maestro|maestra)\s+(?:llamado|llamada|de nombre|que se llama)\s+([a-zñü]{2,20})\b/i,
    /\b(?:se llama|le dicen|de nombre)\s+([a-zñü]{2,20})\b/i,
    /\b(?:mi companero|mi companera|mi amigo|mi amiga|esta persona|esa persona)\s*,?\s+([A-ZÑÜ][a-zñü]{1,19})\b/,
    /^\s*([A-ZÑÜ][a-zñü]{1,19})\s+(?:me|nos)\s+(?:molesta|insulta|humilla|amenaza|excluye|acosa)\b/
  ];

  for (const pattern of patterns) {
    const match = String(message).match(pattern);
    if (match?.[1]) {
      const name = cleanFirstName(match[1]);
      if (name) return name;
    }
  }
  return null;
}

function recentName(messages) {
  const userMessages = messages.filter((message) => message.role === "user").slice(-5);
  for (const message of userMessages.reverse()) {
    const name = extractName(message.content);
    if (name) return name;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Bancos de respuestas. Lumy combina una apertura, validación y pasos concretos.
// Cada categoría tiene múltiples combinaciones posibles.
// -----------------------------------------------------------------------------

const BANKS = {
  bullying: {
    a: [
      "Gracias por contarme lo que está pasando.",
      "Siento que estés viviendo una situación así en el colegio.",
      "Lo que describes merece atención y no debe minimizarse.",
      "Debe ser agotador tener que convivir con ese comportamiento.",
      "Quiero que tengas claro que mereces un entorno respetuoso.",
      "No necesitas encontrar las palabras perfectas para explicar lo que ocurre."
    ],
    v: [
      "No es tu culpa que otras personas decidan tratarte mal.",
      "No tienes que soportarlo para demostrar que eres fuerte.",
      "Mereces estudiar y convivir sin miedo a las burlas.",
      "Que te afecte no significa que estés exagerando.",
      "Pedir ayuda no te convierte en una persona débil.",
      "Nadie tiene derecho a humillarte o intimidarte."
    ],
    s: [
      "Cuéntale lo ocurrido a un familiar, tutor u orientador escolar de confianza.",
      "Explica qué sucede, cuándo pasa y cómo te está afectando.",
      "Busca la compañía de un adulto que pueda intervenir y ayudarte.",
      "Evita enfrentarte a quienes te intimidan sin acompañamiento adulto.",
      "Si continúa, pide a un responsable del colegio que dé seguimiento a la situación.",
      "Puedes empezar diciendo: «Hay algo que me está pasando y necesito que me escuches»."
    ],
    c: [
      "No tienes que resolverlo todo hoy; empieza por buscar apoyo seguro.",
      "La responsabilidad de detener el acoso también corresponde a los adultos del colegio.",
      "Mereces que te escuchen y tomen medidas para protegerte.",
      "No respondas con violencia ni te expongas para demostrar que puedes defenderte."
    ]
  },

  nickname: {
    a: [
      "Siento que estén utilizando ese apodo para molestarte.",
      "Entiendo que escuchar ese sobrenombre repetidamente puede doler.",
      "Gracias por contarme lo que te están diciendo.",
      "No tienes que fingir que ese apodo te causa gracia.",
      "Es importante que se respete la forma en que quieres que te llamen."
    ],
    v: [
      "Un apodo ofensivo no define quién eres.",
      "Tu apariencia y tus características no justifican las burlas.",
      "No es culpa tuya que alguien decida humillarte.",
      "Tienes derecho a pedir que dejen de llamarte así.",
      "Una broma deja de serlo cuando te lastima o no respeta tus límites."
    ],
    s: [
      "Puedes decir que no aceptas ese sobrenombre, siempre que hacerlo sea seguro.",
      "Cuenta a un docente de confianza qué apodo utilizan y cuándo ocurre.",
      "Pide que un adulto intervenga si continúan después de expresar que te incomoda.",
      "Si sucede en redes, pide ayuda para reportar los mensajes o publicaciones.",
      "Busca la compañía de personas que te traten con respeto."
    ],
    c: [
      "No necesitas devolver el insulto para demostrar tu valor.",
      "Mereces que te llamen por tu nombre o por la forma que tú prefieras.",
      "No tienes que cambiar nada de ti para merecer respeto.",
      "Tu dignidad no depende de la opinión de quienes te molestan."
    ]
  },

  loneliness: {
    a: [
      "Gracias por expresar cómo te estás sintiendo.",
      "Debe ser difícil sentir que no tienes con quién hablar.",
      "No tienes que fingir que todo está bien.",
      "Es válido necesitar a alguien que te escuche.",
      "No estás molestando por necesitar compañía."
    ],
    v: [
      "No eres una carga por necesitar apoyo.",
      "Tu presencia y tus sentimientos importan.",
      "No necesitas tener muchos amigos para merecer respeto.",
      "No tienes que resolver todo lo que sientes en un solo día.",
      "Mereces relaciones donde puedas expresarte sin miedo."
    ],
    s: [
      "Puedes acercarte a un familiar, tutor u orientador escolar de confianza.",
      "Si hablar cuesta, empieza con un mensaje: «¿Tienes un momento? Necesito conversar».",
      "También puedes pedir un espacio para conversar con el orientador escolar.",
      "Busca una actividad segura donde puedas compartir intereses con otras personas.",
      "Si la primera persona no puede escucharte, intenta con otro adulto seguro."
    ],
    c: [
      "Construir vínculos puede tomar tiempo y no tienes que apresurarte.",
      "Pedir que alguien te acompañe es completamente válido.",
      "Mereces ser escuchado sin burlas ni juicios.",
      "No tienes que atravesar un momento difícil sin apoyo humano."
    ]
  },

  exclusion: {
    a: [
      "Siento que te estén dejando fuera de las actividades.",
      "Ser excluido puede hacer que el día escolar resulte muy difícil.",
      "Gracias por compartir lo que sucede con tus compañeros.",
      "No tienes que fingir que no te afecta que te aparten."
    ],
    v: [
      "Que un grupo te excluya no determina tu valor.",
      "No tienes que cambiar quién eres para conseguir aceptación.",
      "Es válido que quieras participar y sentirte acompañado.",
      "No eres responsable de las decisiones hirientes de otras personas."
    ],
    s: [
      "Puedes contarle a tu tutor en qué momentos te están excluyendo.",
      "Busca acercarte a compañeros que hayan demostrado ser amables.",
      "Pide apoyo al orientador escolar si el aislamiento se repite.",
      "Intenta participar en actividades donde puedas conocer personas con intereses similares.",
      "Solicita intervención adulta si la exclusión es intencional y repetida."
    ],
    c: [
      "No tienes que perseguir la aceptación de un grupo que te trata mal.",
      "Mereces amistades en las que exista respeto.",
      "Puedes construir relaciones positivas poco a poco.",
      "La inclusión no debe depender de soportar humillaciones."
    ]
  },

  cyber: {
    a: [
      "Que te molesten por internet también es importante y merece atención.",
      "Siento que estés recibiendo mensajes o publicaciones que te afectan.",
      "Lo que ocurre detrás de una pantalla también puede hacer daño.",
      "No tienes que aceptar amenazas ni humillaciones digitales."
    ],
    v: [
      "No eres responsable de recibir mensajes abusivos.",
      "Tienes derecho a proteger tu privacidad.",
      "No necesitas responder con insultos para defenderte.",
      "Nadie tiene derecho a difundir información privada para humillarte.",
      "Mereces utilizar internet sin intimidación."
    ],
    s: [
      "Pide a un adulto de confianza que te ayude a bloquear o reportar la cuenta.",
      "Si es seguro, conserva los mensajes importantes para mostrárselos a un adulto.",
      "No reenvíes publicaciones humillantes ni las difundas.",
      "Revisa tus opciones de privacidad con ayuda de una persona adulta.",
      "Evita continuar una conversación que se está convirtiendo en amenazas."
    ],
    c: [
      "Si comparten imágenes privadas, pide ayuda adulta inmediatamente para reportarlo.",
      "No te reúnas con alguien que te amenaza por internet.",
      "No compartas contraseñas, direcciones ni información personal.",
      "Tu seguridad digital y personal merece protección."
    ]
  },

  teacher: {
    a: [
      "Gracias por confiarme una situación tan delicada.",
      "Quiero tomar en serio lo que estás describiendo.",
      "Siento que estés pasando por esto con una persona adulta del colegio.",
      "Tu seguridad dentro del centro educativo importa."
    ],
    v: [
      "Tener autoridad no le da derecho a nadie a intimidarte o humillarte.",
      "No es tu culpa si una persona adulta cruza tus límites.",
      "Mereces recibir un trato respetuoso por parte de todos los adultos.",
      "No tienes que guardar secretos que te hacen sentir inseguro.",
      "Tu relato merece ser escuchado por otro adulto seguro."
    ],
    s: [
      "Cuéntaselo cuanto antes a un familiar o adulto seguro que no esté implicado.",
      "Acude a otro docente, tutor u orientador que pueda acompañarte.",
      "Evita quedarte a solas con esa persona para intentar resolver el problema.",
      "Pide a un familiar que te acompañe al comunicar lo ocurrido.",
      "Si la primera persona adulta no te escucha, busca otra persona segura."
    ],
    c: [
      "No tienes que investigar ni enfrentarte por tu cuenta a esa persona.",
      "Tu relato merece atención y protección.",
      "No estás obligado a soportar una conducta que te hace sentir inseguro.",
      "No tienes que afrontar esta situación sin compañía."
    ]
  },

  physical: {
    a: [
      "Siento que estés pasando por una agresión o una situación física que te preocupa.",
      "Lo que describes debe tomarse en serio.",
      "Tu seguridad es lo más importante en este momento."
    ],
    v: [
      "No tienes que enfrentarte a esa persona ni resolverlo por tu cuenta.",
      "No es tu culpa que alguien te agreda.",
      "Mereces estar en un lugar donde te sientas protegido."
    ],
    s: [
      "Aléjate hacia un lugar con otras personas si puedes hacerlo sin aumentar el riesgo.",
      "Busca inmediatamente a un adulto de confianza y cuéntale lo ocurrido.",
      "Si tienes una lesión o dolor, pide que te acompañen a recibir atención médica.",
      "No intentes responder con violencia."
    ],
    c: [
      "Si el peligro continúa, pide ayuda a los servicios de emergencia de tu zona.",
      "No esperes a que vuelva a ocurrir para pedir protección.",
      "Tu seguridad está por encima de cualquier discusión."
    ]
  },

  threat: {
    a: [
      "Las amenazas deben tomarse en serio.",
      "No tienes que esperar a que una amenaza se convierta en una agresión para pedir ayuda.",
      "Es importante que no cargues con ese miedo a solas."
    ],
    v: [
      "No es tu responsabilidad controlar las decisiones de quien te amenaza.",
      "Mereces sentirte seguro.",
      "Pedir ayuda ante una amenaza es lo correcto."
    ],
    s: [
      "No te reúnas a solas con esa persona.",
      "Busca compañía y cuéntale a un adulto de confianza qué ocurrió.",
      "Si la amenaza fue por mensaje, muéstrala a un adulto si hacerlo es seguro.",
      "Pide que una persona adulta te acompañe."
    ],
    c: [
      "Si crees que el peligro es inmediato, busca un lugar seguro y pide ayuda de emergencia.",
      "No respondas con amenazas ni intentes resolverlo mediante una pelea.",
      "No tienes que manejar esta situación sin apoyo."
    ]
  },

  rumors: {
    a: [
      "Siento que estén difundiendo comentarios sobre ti.",
      "Los rumores pueden afectar mucho la tranquilidad.",
      "No es fácil sentirse juzgado por comentarios de otras personas."
    ],
    v: [
      "Un rumor no convierte una afirmación en verdadera.",
      "Tu privacidad merece ser respetada.",
      "No tienes que justificar toda tu vida ante tus compañeros.",
      "No necesitas responder públicamente a cada comentario."
    ],
    s: [
      "Habla con un adulto de confianza que pueda ayudarte a aclarar la situación.",
      "Evita reenviar los comentarios o difundirlos entre más personas.",
      "Solicita apoyo a un docente si los rumores afectan tu convivencia.",
      "Si publican datos privados, pide ayuda adulta para reportarlos."
    ],
    c: [
      "No tienes que demostrar tu valor frente a quienes difunden rumores.",
      "Es válido pedir que se respete tu intimidad.",
      "No respondas publicando información privada de otras personas."
    ]
  },

  friend: {
    a: [
      "Es valioso que quieras apoyar a tu amigo o amiga.",
      "Gracias por preocuparte por lo que está viviendo otra persona.",
      "Podemos pensar en una ayuda que sea segura para ambos."
    ],
    v: [
      "Escucha sin juzgar y no culpes a tu amigo por lo ocurrido.",
      "Respeta su privacidad y evita difundir lo que te cuenta.",
      "No tienes que convertirte en quien resuelva todo el problema.",
      "No te enfrentes a quienes lo intimidan."
    ],
    s: [
      "Ofrécele acompañarle a hablar con un adulto de confianza.",
      "Pregúntale qué apoyo necesita y escucha su respuesta.",
      "Si hay peligro inmediato, avisa a un adulto aunque te haya pedido guardar silencio.",
      "Puedes recordarle: «Te creo, no es tu culpa y puedo acompañarte a buscar ayuda»."
    ],
    c: [
      "Acompañar no significa cargar tú solo con todo el problema.",
      "Pedir ayuda adulta también es una manera de cuidar a tu amigo.",
      "Tu seguridad también importa mientras intentas ayudar."
    ]
  },

  conflict: {
    a: [
      "Gracias por explicar lo que ocurrió.",
      "Los desacuerdos pueden ser difíciles de manejar.",
      "Es positivo que quieras encontrar una salida respetuosa."
    ],
    v: [
      "Tus sentimientos importan incluso cuando hay opiniones diferentes.",
      "Un desacuerdo no justifica amenazas ni humillaciones.",
      "No necesitas insultar para expresar tus límites.",
      "Tienes derecho a pedir una pausa."
    ],
    s: [
      "Espera a que la situación esté tranquila antes de intentar dialogar.",
      "Explica lo que te molestó utilizando palabras claras y respetuosas.",
      "Pide mediación a un adulto neutral si no pueden conversar sin discutir.",
      "Aléjate y busca apoyo adulto si aparecen amenazas o agresiones."
    ],
    c: [
      "Resolver un desacuerdo no requiere que nadie salga lastimado.",
      "Puedes defender tus límites sin recurrir a la violencia.",
      "Pedir mediación no significa que hayas perdido una discusión."
    ]
  },

  discrimination: {
    a: [
      "Siento que estés recibiendo comentarios discriminatorios.",
      "Lo que describes merece ser tomado en serio.",
      "Nadie debería ser humillado por sus características personales."
    ],
    v: [
      "Tu origen, idioma, apariencia o características no justifican ningún maltrato.",
      "No eres responsable de los prejuicios de otras personas.",
      "Mereces un trato digno en cualquier espacio escolar."
    ],
    s: [
      "Comunica lo ocurrido a un docente u orientador de confianza.",
      "Pide que un adulto responsable intervenga si esos comentarios se repiten.",
      "Explica cuándo ocurre y cómo está afectando tu experiencia escolar.",
      "Busca compañía de personas que te respeten."
    ],
    c: [
      "Mereces participar en igualdad de condiciones.",
      "No tienes que soportar humillaciones para pertenecer a un grupo.",
      "Pedir protección frente a la discriminación es válido."
    ]
  },

  pain: {
    a: [
      "Siento que estés experimentando ese dolor.",
      "Lo que describes merece atención y no tienes que avergonzarte por contarlo.",
      "Tu bienestar físico importa y no conviene ignorar el dolor."
    ],
    v: [
      "No puedo determinar la causa por un mensaje.",
      "No tienes que soportar el dolor en silencio.",
      "Una persona adulta debe ayudarte a conseguir la atención que necesitas."
    ],
    s: [
      "Avísale a un familiar o adulto de confianza y pídele ayuda para recibir atención médica.",
      "Explica a una persona adulta dónde sientes dolor y desde cuándo comenzó.",
      "Evita automedicarte o intentar tratar una lesión sin orientación profesional."
    ],
    c: [
      "Si el dolor es intenso, empeora o aparece después de una agresión, busca atención médica urgente.",
      "Si alguien te lastimó o forzó, no es tu culpa y necesitas apoyo adulto.",
      "Lo más importante es que recibas ayuda presencial."
    ]
  }
};

function buildReply(topic, name = null) {
  const bank = BANKS[topic];
  if (!bank) return null;

  const parts = [
    choose(bank.a),
    choose(bank.v),
    choose(bank.s),
    choose(bank.c)
  ];

  const intro = name && ["bullying", "nickname", "teacher", "friend", "exclusion"].includes(topic)
    ? `Sobre ${name}, `
    : "";

  return intro + parts.join(" ");
}

// -----------------------------------------------------------------------------
// Detección de situaciones. Se evalúan primero las situaciones urgentes.
// -----------------------------------------------------------------------------

const TOPIC_SIGNALS = {
  teacher: {
    people: ["profesor", "profesora", "profe", "docente", "maestro", "maestra", "director", "directora", "entrenador", "entrenadora", "tutor", "tutora"],
    actions: ["acosa", "acosando", "hostiga", "insulta", "humilla", "amenaza", "me toca", "me pide fotos", "me pide que no cuente", "me pide secreto", "me intimida", "me busca a solas", "me hace comentarios sexuales", "me hace sentir miedo"]
  },
  nickname: ["me ponen apodos", "me pusieron un apodo", "me apodan", "me dicen cosas", "me insultan", "me llaman", "se burlan de mi", "me humillan", "me ponen sobrenombres", "se rien de mi", "me dicen"],
  loneliness: ["no tengo con quien hablar", "no tengo a nadie con quien hablar", "nadie me escucha", "no tengo amigos", "no tengo amigas", "me siento solo", "me siento sola", "estoy solo", "estoy sola", "no se a quien contarle", "no tengo a quien contarle"],
  exclusion: ["me excluyen", "me dejan fuera", "no me incluyen", "no me invitan", "me ignoran", "me apartan", "nadie quiere sentarse conmigo", "no me dejan participar", "me dejan solo en el recreo", "me dejan sola en el recreo"],
  rumors: ["inventan cosas de mi", "hablan mal de mi", "difunden rumores", "chismes sobre mi", "dicen mentiras de mi", "rumores sobre mi", "comparten cosas privadas", "estan hablando de mi"],
  discrimination: ["racismo", "racista", "discriminan", "discriminacion", "por mi color de piel", "por mi origen", "por mi nacionalidad", "por mi discapacidad", "por mi religion", "por mi idioma", "por mi acento"],
  conflict: ["discuti con", "discutimos", "tuvimos una pelea", "me pelee con", "nos llevamos mal", "no nos entendemos", "tuvimos un problema", "estamos enojados", "quiero solucionar un conflicto"]
};
applyLumyExtras(BANKS, TOPIC_SIGNALS);

function detectTopic(text) {
  if (
    hasAny(text, TOPIC_SIGNALS.teacher.people) &&
    hasAny(text, TOPIC_SIGNALS.teacher.actions)
  ) return "teacher";

  if (hasAny(text, ["mi amigo", "mi amiga", "ayudar a un amigo", "ayudar a una amiga", "un compañero", "una compañera"]) &&
      hasAny(text, ["bullying", "acoso", "molestan", "insultan", "golpean", "excluyen", "ayudar", "tiene miedo", "esta triste", "le pegan"])) {
    return "friend";
  }

  if (hasAny(text, TOPIC_SIGNALS.discrimination)) return "discrimination";
  if (hasAny(text, TOPIC_SIGNALS.rumors)) return "rumors";

  const onlineContext = hasAny(text, [
    "whatsapp", "instagram", "tiktok", "facebook", "redes sociales",
    "grupo de chat", "chat", "internet", "publicaron una foto",
    "subieron una foto", "cuenta falsa", "me escriben por redes"
  ]);
  const onlineAction = hasAny(text, [
    "molestan", "acoso", "insultan", "burlan", "amenazan",
    "humillan", "excluyen", "difunden", "mensajes", "publican", "me escriben"
  ]);
  if (onlineContext && onlineAction) return "cyber";

  if (hasAny(text, TOPIC_SIGNALS.nickname)) return "nickname";
  if (hasAny(text, TOPIC_SIGNALS.exclusion)) return "exclusion";
  if (hasAny(text, TOPIC_SIGNALS.loneliness)) return "loneliness";
  if (hasAny(text, TOPIC_SIGNALS.conflict)) return "conflict";

  if (hasAny(text, ["me golpean", "me pegan", "me empujan", "me patean", "me agreden", "me pegaron", "me golpearon", "me empujaron", "me patearon", "me tiraron al suelo"])) {
    return "physical";
  }

  if (hasAny(text, ["me amenazan", "me persiguen", "me esperan afuera", "me quieren hacer daño", "me quieren hacer dano", "me intimidan", "me chantajean"])) {
    return "threat";
  }

  if (hasAny(text, ["bullying", "acoso escolar", "me molestan", "me hostigan", "me intimidan", "me tratan mal", "me hacen la vida imposible", "me persiguen en el colegio"])) {
    return "bullying";
  }

  return null;
}

function isImmediateDanger(text) {
  return hasAny(text, [
    "estoy en peligro ahora", "me estan golpeando ahora",
    "me esta pegando ahora", "me amenaza ahora",
    "esta aqui y me amenaza", "no me deja salir",
    "me esta siguiendo ahora", "tengo miedo de que me haga daño ahora",
    "tengo miedo de que me haga dano ahora"
  ]);
}

function isSexualAbuseConcern(text) {
  return hasAny(text, [
    "me tocaron sin permiso", "me tocaron sin mi consentimiento",
    "me obligaron a un contacto sexual", "sufri abuso sexual",
    "sufri una agresion sexual", "me hicieron algo sexual sin mi consentimiento",
    "un adulto me pide fotos intimas", "me pide fotos intimas",
    "me pide que guarde nuestro secreto", "me obliga a enviar fotos"
  ]);
}

function crisisReply(text) {
  const deniesRisk = /\bno\s+(?:quiero|pienso|voy a)\s+(?:suicidarme|matarme|quitarme la vida|hacerme dano)\b/.test(text);
  const risk = !deniesRisk && hasAny(text, [
    "quiero suicidarme", "quiero matarme", "quiero quitarme la vida",
    "no quiero seguir viviendo", "no quiero vivir",
    "quiero acabar con mi vida", "quiero hacerme daño",
    "quiero hacerme dano", "voy a lastimarme", "me voy a lastimar",
    "no puedo evitar hacerme daño", "no puedo evitar hacerme dano"
  ]);

  if (risk) {
    return "Gracias por confiarme algo tan importante. Siento mucho que estés pasando por un momento así. No tienes que afrontarlo a solas: busca ahora mismo a un adulto de confianza y dile claramente que necesitas ayuda para mantenerte a salvo. Quédate acompañado y, si el peligro es inmediato, pide ayuda a los servicios de emergencia de tu zona. También puedes mostrarle este mensaje. Mereces apoyo y atención ahora.";
  }
  return null;
}

function specialSafetyReply(text) {
  if (isSexualAbuseConcern(text)) {
    return "Lo que describes es grave y no es tu culpa. Busca ahora mismo a un adulto de confianza que no esté implicado y pídele que te acompañe a recibir ayuda. No tienes que contarme detalles íntimos ni enfrentarte a esa persona. Si estás en peligro inmediato, ve hacia un lugar seguro con otras personas y pide ayuda de emergencia. Mereces protección y que te escuchen.";
  }

  if (isImmediateDanger(text)) {
    return "Tu seguridad es lo primero. Si puedes hacerlo sin aumentar el peligro, ve hacia un lugar donde haya otras personas y busca inmediatamente a un adulto de confianza. No te enfrentes a quien te amenaza. Si el peligro es inmediato, pide ayuda a los servicios de emergencia de tu zona. No esperes a que este chat resuelva la situación.";
  }

  return null;
}

// -----------------------------------------------------------------------------
// Respuesta principal
// -----------------------------------------------------------------------------

function respond(messages) {
  const currentMessage = [...messages].reverse().find((message) => message.role === "user");
  const current = normalize(currentMessage?.content || "");
  const context = normalize(recentUserText(messages, 5));
  const name = recentName(messages);

  const crisis = crisisReply(context);
  if (crisis) return crisis;

  const urgent = specialSafetyReply(context);
  if (urgent) return urgent;

  if (/^(hola|holi|hey|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(current) && current.length < 55) {
    return choose([
      "¡Hola! Soy Lumy 💙. Puedo orientarte sobre bullying, convivencia escolar, amistades y formas seguras de pedir ayuda. Puedes escribir con tus propias palabras y sin compartir datos personales.",
      "¡Hola! Qué bueno que estés aquí. Este es un espacio de orientación sobre respeto, convivencia y situaciones difíciles. Tu bienestar importa.",
      "¡Hola! Soy Lumy. Puedes contarme qué te preocupa; intentaré darte una orientación clara y respetuosa."
    ]);
  }

  if (hasAny(current, ["gracias", "muchas gracias", "te agradezco"])) {
    return choose([
      "De nada. Recuerda que mereces respeto y apoyo también fuera de este chat.",
      "Me alegra que hayas encontrado orientación. No tienes que afrontar una situación difícil sin apoyo humano.",
      "Gracias por confiar en Lumy. Tu bienestar y tu seguridad importan."
    ]);
  }

  if (hasAny(current, ["que es bullying", "que significa bullying", "tipos de bullying", "como reconocer el bullying", "como saber si es bullying", "que es el acoso escolar"])) {
    return "El bullying o acoso escolar es una conducta de intimidación que suele repetirse y puede incluir burlas, insultos, exclusión, amenazas o agresiones. También puede ocurrir por internet. Un desacuerdo aislado no siempre es bullying, pero cualquier situación que te haga sentir inseguro merece atención. Si te está pasando, puedes pedir apoyo a un adulto de confianza.";
  }

  if (hasAny(current, ["que puedo hacer", "como puedo responder", "que le digo", "como hago para que pare", "como lo soluciono", "no se que hacer"])) {
    return "Puedes empezar por tres pasos: 1) prioriza tu seguridad y evita enfrentarte a alguien que te intimida; 2) cuéntale a un adulto de confianza qué ocurrió y cómo te afecta; 3) pide que te acompañe a buscar una solución en el colegio. No tienes que resolverlo todo por tu cuenta.";
  }

  const topic = detectTopic(context);
  if (topic) return buildReply(topic, name);

  return choose([
    "Gracias por escribir a Lumy. Puedo orientarte sobre bullying, ciberacoso, convivencia escolar, amistades y cómo pedir ayuda. Explica la situación con tus propias palabras; no necesitas compartir nombres completos, direcciones ni el nombre de tu colegio.",
    "Tu preocupación merece una respuesta respetuosa. Si se relaciona con algo que ocurre en el colegio, puedes contarle a un familiar, tutor u orientador de confianza. Lumy puede ayudarte a ordenar ideas y pensar en pasos seguros.",
    "Estoy aquí para ofrecer orientación inicial sobre convivencia y situaciones difíciles. No reemplazo la ayuda de una persona adulta, pero puedo ayudarte a identificar opciones seguras. Puedes explicar qué necesitas sin compartir datos personales."
  ]);
}

// -----------------------------------------------------------------------------
// Rutas
// -----------------------------------------------------------------------------

app.post("/api/chat", (req, res) => {
  try {
    const incoming = req.body?.messages;

    if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > 20) {
      return res.status(400).json({
        error: "Formato de conversación no válido. Envía una lista de mensajes."
      });
    }

    const messages = incoming.map((message) => {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string"
      ) {
        throw new Error("Mensaje no válido.");
      }

      return {
        role: message.role,
        content: message.content.slice(0, 1500)
      };
    });

    if (!messages.some((message) => message.role === "user")) {
      return res.status(400).json({
        error: "No se encontró un mensaje del estudiante."
      });
    }

    const reply = respond(messages);
    return res.json({ reply });
  } catch (error) {
    console.error("Error en /api/chat:", error?.message || "Error desconocido");
    return res.status(400).json({
      error: "No se pudo procesar el mensaje. Inténtalo de nuevo."
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    chatbot: "Lumy local",
    openaiRequired: false,
    apiRoute: "/api/chat"
  });
});

// Ruta final para errores de JSON y otras solicitudes incorrectas.
app.use((error, _req, res, _next) => {
  console.error("Error del servidor:", error?.message || "Error desconocido");
  res.status(400).json({ error: "La solicitud no pudo procesarse." });
});

app.listen(PORT, () => {
  console.log(`Lumy está funcionando en el puerto ${PORT}`);
});
export function applyLumyExtras(BANKS, TOPIC_SIGNALS) {
  const extraBanks = {
    bullying: {
      a: [
        "Gracias por explicarlo con tus propias palabras; voy a tomar en serio lo que cuentas.",
        "No está bien que tengas que preocuparte por cómo te tratarán durante la jornada escolar.",
        "Lo que estás viviendo merece atención, aunque otras personas digan que solo están jugando.",
        "Es comprensible que esta situación te quite tranquilidad o ganas de ir al colegio.",
        "No tienes que minimizar lo ocurrido para que los demás estén cómodos.",
        "Que se repita una conducta hiriente es una razón válida para pedir intervención."
      ],
      v: [
        "La responsabilidad del maltrato corresponde a quien decide hacerlo, no a ti.",
        "No tienes que ganarte el respeto de nadie: debe existir desde el principio.",
        "Contar lo que ocurre es una forma de cuidarte, no de crear problemas.",
        "No estás obligado a responder a cada provocación.",
        "Tu aprendizaje y tranquilidad también importan.",
        "Que otras personas lo normalicen no significa que sea aceptable."
      ],
      s: [
        "Anota para un adulto de confianza los días, lugares y hechos principales, sin exponerte.",
        "Pide a un familiar que te acompañe a conversar con el tutor o responsable de convivencia.",
        "Explica si ocurre en clase, recreo, salida o en varios espacios para que puedan protegerte.",
        "Si temes represalias, dilo claramente al adulto y pide que no te dejen gestionar esto a solas.",
        "Solicita que revisen la situación después de intervenir, para comprobar que haya mejorado.",
        "Si un adulto no te escucha, busca a otro responsable seguro dentro o fuera del colegio."
      ],
      c: [
        "No necesitas demostrar que puedes soportarlo; mereces ayuda desde ahora.",
        "Un plan de apoyo debe protegerte y no exponerte a más burlas.",
        "Puedes pedir que te acompañen mientras se comunica la situación.",
        "La solución no debe depender de que tú cambies tu personalidad."
      ]
    },
    nickname: {
      a: [
        "Entiendo que te canse escuchar el mismo apodo una y otra vez.",
        "No es necesario que el sobrenombre sea fuerte para que resulte incómodo.",
        "Gracias por decirlo; las palabras también pueden afectar la convivencia.",
        "Que los demás se rían no significa que tú tengas que aceptarlo."
      ],
      v: [
        "Tú decides cómo quieres que te llamen.",
        "No tienes que reírte de algo que te hace sentir mal.",
        "Un apodo repetido para avergonzarte merece atención.",
        "Tu nombre no necesita la aprobación de tus compañeros."
      ],
      s: [
        "Puedes expresar con calma: «No me llames así; prefiero que uses mi nombre», si hacerlo es seguro.",
        "Si no se detienen, comunica al tutor quiénes lo hacen y en qué momentos.",
        "Pide que el docente intervenga sin convertir la situación en otra ocasión para burlarse.",
        "Si el apodo aparece en un grupo digital, solicita ayuda para reportarlo y detener su difusión."
      ],
      c: [
        "No tienes que inventar una respuesta ingeniosa para merecer respeto.",
        "Puedes retirarte de la conversación y buscar compañía segura.",
        "Que un apodo sea popular no lo vuelve respetuoso."
      ]
    },
    loneliness: {
      a: [
        "Sentirse apartado puede ser pesado, incluso cuando nadie más parece notarlo.",
        "Gracias por confiar en este espacio para expresar algo que quizá te cuesta decir.",
        "A veces cuesta iniciar una conversación cuando uno siente que no tiene a quién acudir.",
        "No tienes que aparentar estar bien todo el tiempo."
      ],
      v: [
        "Estar pasando por soledad no significa que haya algo malo en ti.",
        "Mereces compañía respetuosa, no atención a cambio de soportar malos tratos.",
        "Tu valor no se mide por cuántas personas te escriben o te buscan.",
        "Es válido necesitar apoyo aunque no sepas explicar exactamente qué sientes."
      ],
      s: [
        "Elige a una persona adulta segura y dile que últimamente te estás sintiendo aislado.",
        "Puedes empezar por compartir una actividad con alguien con quien te sientas tranquilo.",
        "Si te cuesta hablar, escribe unas líneas y entrégaselas a un familiar o tutor.",
        "Pide al orientador escolar ayuda para encontrar espacios de participación y acompañamiento."
      ],
      c: [
        "No tienes que convertirte en otra persona para conectar con los demás.",
        "Los vínculos pueden comenzar con conversaciones pequeñas y respetuosas.",
        "Si alguien no está disponible, eso no significa que no exista apoyo para ti."
      ]
    },
    exclusion: {
      a: [
        "Duele querer participar y sentir que los demás te cierran la puerta.",
        "Gracias por contarme que te están dejando fuera.",
        "Ser ignorado repetidamente puede afectar mucho la experiencia escolar.",
        "No es necesario que haya insultos para que una exclusión sea preocupante."
      ],
      v: [
        "Tienes derecho a participar sin tener que rogar por un trato digno.",
        "Que un grupo te aparte no define lo que puedes aportar.",
        "No eres responsable de que otras personas decidan excluirte.",
        "Mereces espacios donde tu presencia sea bienvenida."
      ],
      s: [
        "Cuenta al tutor ejemplos concretos de actividades o momentos en que te dejan fuera.",
        "Busca una actividad escolar organizada donde puedas integrarte con acompañamiento.",
        "Si la exclusión ocurre en trabajos grupales, pide al docente que organice la participación de forma justa.",
        "Solicita seguimiento si el grupo continúa aislándote después de pedir ayuda."
      ],
      c: [
        "No tienes que perseguir a un grupo para demostrar que mereces pertenecer.",
        "Puedes construir vínculos con personas que sí respeten tu participación.",
        "Pedir inclusión no es pedir un favor extraordinario."
      ]
    },
    cyber: {
      a: [
        "Siento que la situación haya llegado también a tus espacios digitales.",
        "Recibir mensajes hirientes puede afectar incluso cuando estás fuera del colegio.",
        "No tienes que contestar de inmediato ni mantener una conversación que te hace sentir inseguro.",
        "Gracias por contarme lo que está pasando en internet."
      ],
      v: [
        "Una cuenta o una pantalla no elimina la responsabilidad de respetar a los demás.",
        "No tienes que publicar una respuesta para demostrar que tienes razón.",
        "Tu información personal merece cuidado y privacidad.",
        "Compartir contenido para avergonzarte no es una broma inofensiva."
      ],
      s: [
        "Pide a una persona adulta que te acompañe a usar las opciones de bloqueo y reporte de la plataforma.",
        "No abras enlaces ni archivos enviados por cuentas que te amenazan.",
        "Revisa quién puede ver tus publicaciones y contactarte, con ayuda de un adulto.",
        "Si el contenido involucra datos o imágenes privadas, no lo difundas: pide ayuda adulta para reportarlo.",
        "Si los mensajes vienen de compañeros, comunica también el contexto al responsable de convivencia escolar."
      ],
      c: [
        "No respondas compartiendo datos, contraseñas o contenido privado.",
        "Puedes silenciar o bloquear una cuenta mientras recibes apoyo.",
        "No tienes que resolver el acoso digital enfrentándote a quien lo realiza."
      ]
    },
    teacher: {
      a: [
        "Debe ser complicado pedir ayuda cuando la preocupación involucra a alguien con autoridad.",
        "Gracias por contar algo que puede resultar difícil de explicar.",
        "Quiero que sepas que tu seguridad merece atención, sin importar el cargo de esa persona.",
        "No tienes que justificar por qué una conducta adulta te hizo sentir inseguro."
      ],
      v: [
        "Un cargo escolar no da permiso para humillar, amenazar o cruzar límites.",
        "No eres responsable de proteger la reputación de un adulto ocultando algo que te preocupa.",
        "Tienes derecho a pedir que otro adulto te escuche.",
        "No tienes que reunirte a solas con esa persona para demostrar nada."
      ],
      s: [
        "Busca a un familiar o adulto seguro que no esté involucrado y cuéntale lo ocurrido.",
        "Pide que te acompañen a comunicarlo a la dirección u otra instancia responsable.",
        "Si te preocupa que no te crean, puedes escribir los hechos principales y leerlos acompañado.",
        "Si la persona implicada es quien suele recibir quejas, busca otro canal adulto seguro.",
        "Solicita que las conversaciones sobre el tema se realicen con un acompañante de confianza."
      ],
      c: [
        "No investigues ni intentes confrontar a esa persona por tu cuenta.",
        "Mereces una respuesta adulta que priorice tu protección.",
        "Si hay peligro inmediato, aléjate hacia otras personas y pide ayuda urgente."
      ]
    },
    physical: {
      a: [
        "Lamento que alguien haya cruzado tus límites físicos.",
        "Lo que cuentas no debe tratarse como un simple juego si te hizo daño o sentir inseguro.",
        "Gracias por decirlo; es importante que una persona adulta lo sepa."
      ],
      v: [
        "Nadie tiene derecho a empujarte, golpearte o lastimarte.",
        "No tienes que devolver la agresión para que te tomen en serio.",
        "Pedir protección no es exagerar."
      ],
      s: [
        "Busca a un adulto responsable del lugar y explícale que necesitas protección.",
        "Si ocurrió en el colegio, pide que te acompañen a un espacio seguro y que avisen a tu familia.",
        "Si sientes dolor o tienes una lesión, solicita atención médica con ayuda de un adulto.",
        "Evita quedarte a solas con la persona que te agredió."
      ],
      c: [
        "No esperes a que se repita para informar lo ocurrido.",
        "Si el riesgo continúa, busca ayuda presencial inmediata.",
        "Tu seguridad es más importante que cualquier presión para guardar silencio."
      ]
    },
    threat: {
      a: [
        "Entiendo que una amenaza pueda hacerte sentir intranquilo.",
        "Gracias por avisar; no es necesario esperar a que pase algo más para pedir apoyo.",
        "Una amenaza merece atención aunque la otra persona diga que no hablaba en serio."
      ],
      v: [
        "No tienes que manejar el miedo en soledad.",
        "No es tu responsabilidad convencer a quien amenaza para que se detenga.",
        "Pedir ayuda es una decisión prudente."
      ],
      s: [
        "Informa hoy mismo a un familiar o adulto de confianza y comparte lo que te dijeron.",
        "No aceptes reunirte a solas para «arreglar» la amenaza.",
        "Pide que un adulto te acompañe en los trayectos o momentos que te preocupan.",
        "Si ocurrió por mensajes, muéstralos a un adulto sin responder con amenazas."
      ],
      c: [
        "Si crees que el riesgo es inmediato, busca un lugar con adultos y solicita ayuda de emergencia.",
        "No intentes comprobar si la amenaza era real exponiéndote.",
        "Mereces que tomen en serio lo que estás contando."
      ]
    },
    rumors: {
      a: [
        "Debe ser frustrante escuchar que circulan versiones sobre ti.",
        "Gracias por explicar que están hablando de tu vida sin respetar tu privacidad.",
        "Los comentarios repetidos pueden crear un ambiente muy incómodo."
      ],
      v: [
        "No tienes que responder a cada rumor para conservar tu dignidad.",
        "Tu intimidad no es material para entretener a otras personas.",
        "Que varias personas repitan algo no demuestra que sea cierto.",
        "No eres responsable de detener por tu cuenta todos los comentarios."
      ],
      s: [
        "Explica a un adulto qué comentario circula, dónde lo escuchaste y cómo te afecta.",
        "Evita reenviar el rumor para intentar desmentirlo, porque puede extenderse más.",
        "Si se publica en redes, pide ayuda para reportar la publicación.",
        "Solicita al colegio que intervenga si los rumores están afectando tu convivencia."
      ],
      c: [
        "Puedes aclarar lo necesario con personas de confianza sin exponerte públicamente.",
        "No respondas divulgando secretos de otras personas.",
        "Mereces que respeten tu privacidad."
      ]
    },
    friend: {
      a: [
        "Tu preocupación puede ser muy importante para esa persona.",
        "Es bueno que quieras acompañar sin juzgar.",
        "A veces escuchar con calma es un primer apoyo valioso."
      ],
      v: [
        "No prometas guardar en secreto algo que ponga a alguien en peligro.",
        "No tienes que enfrentarte a quienes están molestando a tu amigo.",
        "Tu amigo merece apoyo de adultos responsables, además de tu compañía.",
        "Evita compartir su historia con compañeros que no necesitan conocerla."
      ],
      s: [
        "Puedes decirle: «Te escucho y podemos buscar juntos a un adulto de confianza».",
        "Ofrécele acompañarlo a hablar con su familia, tutor u orientador.",
        "Si no quiere hablar contigo, recuérdale con respeto que hay adultos que pueden ayudar.",
        "Si te cuenta que está en peligro, avisa de inmediato a un adulto seguro."
      ],
      c: [
        "Acompañar también significa pedir ayuda cuando la situación supera lo que puedes manejar.",
        "No cargues tú solo con la seguridad de otra persona.",
        "Escuchar sin culpar puede ayudarle a sentirse menos aislado."
      ]
    },
    conflict: {
      a: [
        "Parece que este desacuerdo te está ocupando bastante energía.",
        "Gracias por buscar una salida en lugar de dejar que el problema crezca.",
        "Podemos distinguir entre un desacuerdo y una conducta que cruza límites."
      ],
      v: [
        "Puedes reconocer un error sin aceptar insultos o amenazas.",
        "Escuchar otra versión no significa renunciar a tus límites.",
        "Una conversación respetuosa requiere que ambas partes puedan hablar sin miedo."
      ],
      s: [
        "Cuando estén tranquilos, explica qué ocurrió usando frases como «me sentí… cuando…».",
        "Si la conversación se convierte en insultos, haz una pausa y retómala con mediación adulta.",
        "Si hay una diferencia por un trabajo, pide al docente que aclare las responsabilidades de cada integrante.",
        "No continúes una discusión si aparecen amenazas o empujones."
      ],
      c: [
        "No todos los desacuerdos terminan en amistad, pero sí pueden manejarse con respeto.",
        "Poner límites también forma parte de resolver un conflicto.",
        "No tienes que aceptar una disculpa ni darla bajo presión."
      ]
    },
    discrimination: {
      a: [
        "Lamento que te hayan tratado de manera injusta por una característica personal.",
        "Gracias por contarlo; los comentarios discriminatorios no deben normalizarse.",
        "Es comprensible que una situación así te haga sentir apartado o incómodo."
      ],
      v: [
        "No tienes que ocultar quién eres para merecer un trato digno.",
        "Los prejuicios de otras personas no determinan tu valor.",
        "La diversidad no justifica burlas, exclusión ni trato desigual."
      ],
      s: [
        "Describe a un adulto de confianza las palabras o acciones que ocurrieron y dónde sucedieron.",
        "Pide que el colegio intervenga y explique cómo evitar que se repita.",
        "Busca acompañamiento de un adulto si te preocupa volver a ese espacio.",
        "Si afecta tu participación en clase, solicita medidas para que puedas aprender en condiciones justas."
      ],
      c: [
        "No tienes que educar tú solo a quienes te discriminan.",
        "Mereces participar con las mismas oportunidades y respeto.",
        "Pedir apoyo frente a la discriminación es válido."
      ]
    },
    pain: {
      a: [
        "Gracias por avisar que tienes dolor; es importante no ignorarlo.",
        "Siento que estés pasando por una molestia física.",
        "No puedo saber la causa desde aquí, pero sí recomendarte que busques apoyo presencial."
      ],
      v: [
        "No necesitas aguantar el dolor para demostrar fortaleza.",
        "Es mejor que una persona adulta conozca lo que está pasando.",
        "No te automediques ni sigas consejos de compañeros sobre tratamientos."
      ],
      s: [
        "Dile a un familiar o adulto de confianza dónde te duele y desde cuándo.",
        "Pide que te acompañen a un profesional de salud si el dolor continúa.",
        "Si comenzó después de una agresión, informa también cómo ocurrió para que puedan protegerte.",
        "Si el dolor es fuerte o empeora, solicita atención médica urgente."
      ],
      c: [
        "Una evaluación presencial puede ayudarte a saber qué necesitas.",
        "Tu bienestar físico merece atención, incluso si no sabes explicar bien el dolor.",
        "No tienes que resolverlo sin ayuda adulta."
      ]
    }
  };

  for (const [topic, groups] of Object.entries(extraBanks)) {
    if (!BANKS[topic]) continue;
    for (const [group, phrases] of Object.entries(groups)) {
      if (!Array.isArray(BANKS[topic][group])) continue;
      BANKS[topic][group].push(...phrases);
    }
  }

  // Amplía expresiones que ya reconoce el detector original.
  const extraSignals = {
    teacher: {
      people: ["auxiliar", "coordinador", "coordinadora", "personal del colegio", "adulto del colegio"],
      actions: ["me grita", "me ridiculiza", "me trata mal", "me señala delante de todos", "me amenaza con reprobarme", "me hace sentir humillado", "me obliga a quedarme", "me escribe en privado"]
    },
    nickname: [
      "me dicen sobrenombres", "me llaman por un nombre que odio", "usan un apodo que no me gusta",
      "se meten con mi nombre", "se burlan de mi forma de hablar", "me ponen un mote"
    ],
    loneliness: [
      "en los recreos estoy sin compañía", "almuerzo siempre solo", "siento que no le importo a nadie",
      "no tengo alguien que me escuche", "me cuesta hacer amigos", "me siento aislado"
    ],
    exclusion: [
      "no me dejan entrar al grupo", "no me escogen para el equipo", "hacen planes sin incluirme",
      "me dejan fuera del grupo de trabajo", "no cuentan conmigo", "me apartan del salón"
    ],
    rumors: [
      "están inventando historias sobre mí", "comparten mentiras sobre mí", "hablan de mi vida privada",
      "están difundiendo un chisme", "me acusan de cosas falsas"
    ],
    discrimination: [
      "se burlan de mi acento", "me tratan diferente por mi forma de hablar", "me discriminan en clase",
      "hacen comentarios por mi cultura", "me excluyen por mis características"
    ],
    conflict: [
      "tuvimos un malentendido", "no nos ponemos de acuerdo", "mi grupo no colabora",
      "mis compañeros no respetan mis ideas", "discutimos por un trabajo", "quiero arreglar las cosas"
    ]
  };

  for (const [topic, additions] of Object.entries(extraSignals)) {
    if (!TOPIC_SIGNALS[topic]) continue;
    if (topic === "teacher") {
      TOPIC_SIGNALS.teacher.people.push(...additions.people);
      TOPIC_SIGNALS.teacher.actions.push(...additions.actions);
    } else if (Array.isArray(TOPIC_SIGNALS[topic])) {
      TOPIC_SIGNALS[topic].push(...additions);
    }
  }
}
