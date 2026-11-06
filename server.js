import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

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

