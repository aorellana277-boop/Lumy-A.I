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

// -----------------------------------------------------------------------------
// LUMY: motor conversacional local, sin API ni créditos.
// Usa señales por palabras/ideas, no depende de que estén en un orden exacto.
// El contexto se obtiene de los últimos mensajes que ya envía index.html.
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

function includesAny(text, terms) {
  return terms.some(term => text.includes(normalize(term)));
}

function hashText(value) {
  // FNV-1a: genera una selección estable para que la misma conversación
  // no cambie aleatoriamente cada vez que se procesa.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(options, seed, salt) {
  return options[hashText(`${seed}|${salt}`) % options.length];
}

function compose(seed, banks, salt, questionOverride = null) {
  // Cada bloque se combina con los demás. No son respuestas copiadas 500 veces:
  // son miles de combinaciones redactadas con piezas distintas y coherentes.
  return [
    pick(banks.openings, seed, `${salt}-opening`),
    pick(banks.validation, seed, `${salt}-validation`),
    pick(banks.nextSteps, seed, `${salt}-next`),
    questionOverride || pick(banks.questions, seed, `${salt}-question`)
  ].join(" ");
}

const stopNames = new Set([
  "esta", "este", "esa", "ese", "persona", "chico", "chica", "compañero",
  "compañera", "amigo", "amiga", "profesor", "profesora", "profe", "docente",
  "maestro", "maestra", "director", "directora", "me", "te", "se", "mi", "mis",
  "tu", "su", "que", "quien", "cuando", "donde", "alguien", "nadie", "todos",
  "todas", "porque", "pero", "tambien", "solo", "sola", "mucho", "mucha",
  "muchos", "muchas", "siempre", "nunca", "hoy", "ayer", "antes", "ahora"
]);

function formatFirstName(raw) {
  const normalized = normalize(raw).split(" ")[0] || "";
  if (normalized.length < 2 || normalized.length > 20 || stopNames.has(normalized)) return null;
  if (!/^[a-zñü]+$/i.test(normalized)) return null;
  return normalized.charAt(0).toLocaleUpperCase("es") + normalized.slice(1);
}

function extractPersonName(message = "") {
  const patterns = [
    /\b(?:persona|compañero|compañera|amigo|amiga|profesor|profesora|profe|docente|maestro|maestra)\s*\(\s*([a-zñü]{2,20})\s*\)/i,
    /\b(?:persona|compañero|compañera|amigo|amiga|profesor|profesora|profe|docente|maestro|maestra)\s+(?:llamado|llamada|de nombre|que se llama)\s+([a-zñü]{2,20})\b/i,
    /\b(?:se llama|le dicen|de nombre)\s+([a-zñü]{2,20})\b/i,
    /\b(?:esta persona|esa persona|mi compañero|mi compañera|mi amigo|mi amiga)\s*,?\s+([A-ZÑÜ][a-zñü]{1,19})\b/,
    /\b(?:profesor|profesora|profe|docente|maestro|maestra|compañero|compañera|amigo|amiga)\s+([A-ZÑÜ][a-zñü]{1,19})\b/,
    /^\s*([A-ZÑÜ][a-zñü]{1,19})\s+(?:me|nos)\s+(?:molesta|insulta|humilla|amenaza|excluye|acosa|hostiga)\b/
  ];

  for (const pattern of patterns) {
    const match = String(message).match(pattern);
    if (match?.[1]) {
      const name = formatFirstName(match[1]);
      if (name) return name;
    }
  }
  return null;
}

function findRecentPersonName(userMessages) {
  for (const message of [...userMessages].reverse()) {
    const name = extractPersonName(message);
    if (name) return name;
  }
  return null;
}

function hasNickname(message) {
  return /\b(?:me apoda|me apodan|me puso un apodo|me ponen apodos|me ponen un apodo|me llama|me llaman|me dice|me dicen|se burla llamandome|se burlan llamandome)\b/.test(normalize(message));
}

function detectNicknameTheme(text) {
  if (includesAny(text, ["gord", "flac", "peso", "cuerpo", "aspect", "aparienc", "fe", "nariz", "pelo", "piel", "altura", "bajit"])) {
    return "appearance";
  }
  if (includesAny(text, ["tont", "idiot", "inutil", "burro", "burra", "brut", "lent", "inteligencia", "notas"])) {
    return "ability";
  }
  return "general";
}

const signals = {
  authority: ["profesor", "profesora", "profe", "docente", "maestro", "maestra", "director", "directora", "entrenador", "entrenadora", "tutor", "tutora", "auxiliar"],
  authorityAbuse: ["acosa", "acosan", "acosando", "hostiga", "hostigando", "molesta", "molestan", "insulta", "insultan", "humilla", "humillan", "amenaza", "amenazan", "grita", "me toca", "me toca sin permiso", "me pide fotos", "me pide fotos intimas", "me pide que no cuente", "me dice que sea secreto", "me busca a solas", "me escribe cosas sexuales", "me hace comentarios sexuales", "me hace comentarios sobre mi cuerpo", "me invita a estar a solas", "me hace sentir incomodo", "me hace sentir incomoda", "me sigue", "me persigue"],
  physical: ["golpea", "golpean", "golpeo", "pega", "pegan", "empuja", "empujan", "empujo", "patada", "agrede", "agreden", "me tira al suelo", "me tira del pelo", "me toca sin permiso", "me fuerza"],
  online: ["whatsapp", "redes", "internet", "grupo de chat", "chat", "publica fotos", "sube fotos", "difunde", "mensaje", "mensajes", "cuenta falsa", "ciberacoso", "me escribe", "me manda mensajes", "me etiqueta", "me expone"],
  social: ["excluye", "excluyen", "me dejan fuera", "no me incluyen", "no me invitan", "me ignoran", "me aislan", "me apartan", "no me hablan"],
  verbal: ["insulta", "insultan", "insulto", "burl", "apodo", "apoda", "sobrenombre", "humilla", "ridiculiza", "se rie de mi", "se rien de mi", "se burla de mi", "me llama", "me dicen cosas", "me pone nombres", "me ponen nombres"],
  threat: ["amenaza", "amenazan", "chantaje", "intimida", "me espera afuera", "me persigue", "me da miedo que", "me advierte que"],
  general: ["molesta", "molestan", "acosa", "acosan", "hostiga", "hostigan", "me trata mal", "me hacen sentir mal", "me fastidia", "me fastidian"]
};

function classifyBehavior(text) {
  if (includesAny(text, signals.physical)) return "physical";
  if (includesAny(text, signals.online)) return "online";
  if (includesAny(text, signals.threat)) return "threat";
  if (includesAny(text, signals.social)) return "social";
  if (includesAny(text, signals.verbal)) return "verbal";
  if (includesAny(text, signals.general)) return "general";
  return "unknown";
}

function isAuthorityConcern(text) {
  return includesAny(text, signals.authority) && includesAny(text, signals.authorityAbuse);
}

function isImmediateDanger(text) {
  return includesAny(text, [
    "me esta pegando", "me esta golpeando", "me amenaza ahora",
    "esta aqui y me amenaza", "estoy en peligro", "no estoy a salvo",
    "me quiere hacer daño ahora", "me quiere hacer dano ahora", "no me deja salir",
    "me esta siguiendo ahora", "tengo miedo de que me haga daño ahora", "tengo miedo de que me haga dano ahora"
  ]);
}

function crisisReply(text) {
  const explicitlyDenyingRisk = /\bno\s+(?:quiero|pienso|voy a)\s+(?:suicidarme|suicidar|matarme|quitarme la vida|hacerme daño|hacerme dano)\b/.test(text);
  const directRisk = !explicitlyDenyingRisk && (
    /\b(?:quiero|voy a|pienso en|estoy pensando en|he pensado en|me quiero)\s+(?:suicidarme|suicidar|matarme|quitarme la vida|morir)\b/.test(text) ||
    includesAny(text, ["no quiero seguir viviendo", "no quiero vivir", "quiero acabar con mi vida", "voy a acabar con mi vida", "quiero desaparecer para siempre", "quiero hacerme daño", "quiero hacerme dano", "voy a lastimarme", "me voy a lastimar", "no puedo evitar hacerme daño", "no puedo evitar hacerme dano"])
  );

  if (directRisk) {
    return "Gracias por decirlo. Siento mucho que estés pasando por algo tan intenso. Esto necesita apoyo de una persona real ahora, no solo de un chat: busca a un adulto de confianza y dile claramente que podrías hacerte daño. Quédate acompañado y, si el peligro es inmediato, pide ayuda a los servicios de emergencia de tu zona. No tienes que explicar todo de golpe; puedes mostrarle este mensaje.";
  }
  if (isImmediateDanger(text)) {
    return "Tu seguridad es lo primero. Si puedes hacerlo sin aumentar el peligro, ve hacia un lugar donde haya otras personas y busca inmediatamente a un adulto de confianza. Si estás en peligro inmediato, pide ayuda a los servicios de emergencia locales. No esperes a que este chat resuelva la situación.";
  }
  return null;
}

// Bancos de frases. Las multiplicaciones dan miles de combinaciones posibles:
// bullying 8x8x8x10 = 5,120; soledad/apodos/amigos/general = 4,096 cada uno;
// situaciones con docentes = 8x8x8 = 512 (pregunta final de seguridad fija).
const bullyingBank = {
  openings: [
    "Gracias por confiarme lo que está pasando.",
    "Siento que estés viviendo una situación así.",
    "Te leo y quiero entender bien lo que ocurre.",
    "Gracias por contarlo con tus propias palabras.",
    "Debe ser agotador tener que lidiar con esto.",
    "Lo que cuentas merece atención y apoyo.",
    "No tienes que encontrar las palabras perfectas para explicarlo.",
    "Podemos ordenar lo que está pasando paso a paso."
  ],
  validation: [
    "Mereces que te traten con respeto, también en el colegio y por internet.",
    "No es tu culpa que otra persona decida tratarte mal.",
    "No tienes que aguantarlo para demostrar que eres fuerte.",
    "Que te afecte no significa que estés exagerando.",
    "Tus sentimientos importan y vale la pena escucharlos.",
    "Nadie tiene derecho a humillarte o intimidarte.",
    "Pedir apoyo es una decisión válida; no tienes que resolverlo en solitario.",
    "No tienes que aceptar ese comportamiento como si fuera normal."
  ],
  nextSteps: [
    "Puedes contarle a un adulto de confianza qué ocurrió, cuándo pasa y cómo te afecta.",
    "Si puedes, anota cuándo ocurre y quién estaba presente para explicarlo con claridad a una persona adulta.",
    "Busca a alguien que pueda acompañarte: un familiar, tutor u orientador escolar con quien te sientas seguro.",
    "Evita enfrentarte a esa persona a solas; pide que un adulto te ayude a manejar la situación.",
    "Si vuelve a ocurrir, intenta acercarte a un lugar con otras personas y avisa a un adulto de confianza.",
    "Puedes empezar la conversación diciendo: «Hay algo que me está pasando y necesito que me escuches».",
    "No necesitas reunir pruebas por tu cuenta ni exponerte para demostrar lo ocurrido; prioriza estar seguro.",
    "Si sucede en línea, conserva los mensajes solo si hacerlo es seguro y pide ayuda para reportar o bloquear la cuenta."
  ],
  questions: [
    "¿Qué suele pasar justo antes de que empiece?",
    "¿Te ocurre en persona, en internet o en ambos lugares?",
    "¿Es algo que ha pasado una vez o viene repitiéndose?",
    "¿Qué es lo que más te preocupa de esta situación ahora mismo?",
    "¿Hay alguien adulto con quien te sentirías seguro hablando hoy?",
    "¿Ocurre delante de otras personas o cuando están a solas?",
    "¿Quieres contarme qué pasó la última vez, sin compartir nombres completos ni datos del colegio?",
    "¿Qué tipo de apoyo te ayudaría más en este momento?",
    "¿Te sientes a salvo ahora mismo?",
    "¿Prefieres que pensemos en cómo contárselo a un adulto de confianza?"
  ]
};

const nicknameBank = {
  openings: [
    "Gracias por contarme que te ponen ese apodo.",
    "Siento que estén usando un apodo para molestarte.",
    "Entiendo que escuchar ese sobrenombre una y otra vez puede doler.",
    "Quiero que sepas algo: un apodo no define quién eres.",
    "Gracias por confiarme algo que puede ser difícil de explicar.",
    "No mereces que utilicen palabras para hacerte sentir menos.",
    "Podemos hablar de lo que ocurre sin repetir aquí el insulto.",
    "Tiene sentido que te incomode que te llamen de una forma que no elegiste."
  ],
  validation: [
    "Tu valor no depende de lo que esa persona diga.",
    "Tu aspecto, tu cuerpo, tu forma de aprender o cualquier característica tuya no justifican las burlas.",
    "Que otras personas repitan un apodo no lo convierte en verdad.",
    "No tienes que reírte del apodo para que los demás estén cómodos.",
    "Tienes derecho a pedir que dejen de llamarte así.",
    "No es culpa tuya que alguien use palabras para humillarte.",
    "Un sobrenombre deja de ser una broma cuando te hiere o no respeta tus límites.",
    "Mereces que te llamen por el nombre o la forma en que tú prefieres."
  ],
  nextSteps: [
    "Puedes decir, si te sientes seguro: «No me gusta que me llames así; deja de hacerlo» y después buscar apoyo adulto.",
    "Cuéntale a un docente de confianza, familiar u orientador qué apodo usan y en qué momentos ocurre.",
    "Si sucede delante de otras personas, intenta no quedarte solo con el problema: pide a alguien seguro que te acompañe a hablarlo.",
    "Si se repite, anota cuándo ocurre y quién estaba presente para explicárselo a una persona adulta.",
    "No tienes obligación de responder con otro insulto ni de demostrar que no te afecta.",
    "Si ocurre por mensajes, guarda el contenido solo si es seguro y pide a un adulto que te ayude a reportarlo.",
    "Puedes pedir apoyo diciendo: «Me llaman con un apodo que me hace sentir mal y necesito que intervengas».",
    "Si el apodo se refiere a tu cuerpo o apariencia, recuerda que no hay nada que tengas que cambiar para merecer respeto."
  ],
  questions: [
    "¿Te lo dice una sola persona o varias?",
    "¿Lo hacen delante de otras personas para que se rían?",
    "¿Ya les has pedido que dejen de hacerlo?",
    "¿Pasa en el colegio, por mensajes o en otro lugar?",
    "¿Desde hace cuánto tiempo ocurre?",
    "¿Hay algún adulto que sepa lo que está pasando?",
    "¿Qué sientes cuando te llaman de esa manera?",
    "¿Quieres que preparemos una frase para explicárselo a un docente o familiar?"
  ]
};

const teacherBank = {
  openings: [
    "Gracias por contármelo. Es importante que te escuchen.",
    "Siento que estés viviendo algo así con una persona que tiene autoridad en el colegio.",
    "Lo que describes merece atención y no tienes que manejarlo a solas.",
    "Gracias por confiarme una situación tan delicada.",
    "Quiero tomar en serio lo que estás diciendo.",
    "No tienes que demostrar que puedes soportarlo ni resolverlo por tu cuenta.",
    "Me importa que tengas apoyo y que puedas estar seguro en el entorno escolar.",
    "Lamento que una persona adulta del colegio te esté haciendo sentir así."
  ],
  validation: [
    "No es tu culpa y mereces que los adultos te traten con respeto.",
    "Que sea docente o tenga autoridad no significa que pueda intimidarte o cruzar tus límites.",
    "Tienes derecho a sentirte seguro y respetado en el colegio.",
    "No tienes que guardar el secreto ni proteger a la persona adulta implicada.",
    "Es válido que te sientas confundido, preocupado o incómodo.",
    "Tu relato merece ser escuchado por otro adulto que pueda protegerte.",
    "No es necesario que decidas por tu cuenta qué etiqueta ponerle a lo ocurrido para pedir ayuda.",
    "Pedir ayuda por el comportamiento de un adulto no es portarse mal ni meterse en problemas."
  ],
  nextSteps: [
    "Cuéntaselo cuanto antes a un adulto de confianza que no esté implicado, como un familiar o tutor seguro.",
    "También puedes acudir a un orientador, responsable de protección o directivo de confianza distinto de la persona señalada.",
    "Evita quedarte a solas con esa persona para hablar del tema; pide que otro adulto te acompañe.",
    "Si existen mensajes, guárdalos solo si es seguro y muéstraselos a un adulto de confianza.",
    "No tienes que investigar ni enfrentarte a esa persona. Un adulto seguro debe ayudarte a dar los siguientes pasos.",
    "Puedes mostrarle a un familiar este mensaje si te resulta difícil explicar lo que ocurre.",
    "Si el primer adulto no te escucha, busca a otro adulto seguro fuera de esa situación y vuelve a pedir ayuda.",
    "Si ahora te sientes en peligro, ve hacia un lugar acompañado y pide ayuda inmediata."
  ],
  questions: [
    "¿Estás a salvo ahora mismo?",
    "¿Hay un familiar u otro adulto de confianza a quien puedas contárselo hoy?",
    "¿Lo que ocurre pasa durante las clases, por mensajes o en otro momento?",
    "¿Hay otro docente u orientador con quien te sientas seguro?",
    "¿Te preocupa tener que volver a estar a solas con esa persona?",
    "¿Quieres que te ayude a escribir un mensaje para pedir apoyo a un familiar?",
    "No hace falta que me cuentes detalles íntimos ni compartas nombres completos: ¿puedes buscar a un adulto seguro ahora?",
    "¿Hay alguien que pueda acompañarte mientras cuentas lo que ha pasado?"
  ]
};

const lonelyBank = {
  openings: [
    "Gracias por decirme cómo te sientes.",
    "Debe ser duro sentir que no tienes con quién hablar.",
    "No tienes que ordenar todo lo que sientes antes de pedir compañía.",
    "Me alegra que hayas podido ponerlo en palabras aquí.",
    "Quiero escucharte sin juzgarte.",
    "Sentirse sin apoyo puede pesar mucho; no tienes que fingir que todo está bien.",
    "Podemos ir despacio, una cosa a la vez.",
    "No estás molestando por necesitar que alguien te escuche."
  ],
  validation: [
    "Mereces tener personas que te escuchen con respeto.",
    "No tienes que pasar por un momento difícil sin apoyo.",
    "No es necesario que seas amigo íntimo de alguien para pedirle que te escuche.",
    "Pedir compañía no te hace débil ni una carga.",
    "Lo que sientes importa, incluso si todavía no sabes cómo explicarlo.",
    "A veces cuesta encontrar a la primera persona adecuada; eso no significa que no exista ayuda.",
    "No tienes que contarlo todo de golpe.",
    "Un primer paso pequeño también cuenta."
  ],
  nextSteps: [
    "Piensa en un familiar, docente, orientador escolar, entrenador o adulto de confianza con quien te sientas algo más seguro.",
    "Puedes empezar con un mensaje sencillo: «¿Tienes un momento? Necesito hablar y que me escuches».",
    "Si hablar cara a cara cuesta, escribir lo que te pasa y enseñárselo a una persona adulta puede ser más fácil.",
    "También puedes acercarte a un orientador o psicólogo escolar y pedir una conversación privada.",
    "Si la primera persona no puede ayudarte, intenta con otra persona adulta segura.",
    "No necesitas compartir aquí datos personales; podemos pensar juntos qué tipo de persona podría escucharte.",
    "Si estás pasando por algo que te hace sentir inseguro, busca a un adulto ahora y no te quedes solo con ello.",
    "Podrías elegir a alguien que haya sido paciente contigo antes, aunque no hablen todos los días."
  ],
  questions: [
    "¿Hay alguien, aunque no sea muy cercano, con quien te hayas sentido escuchado alguna vez?",
    "¿Te resultaría más fácil hablar con un familiar, un docente o un orientador?",
    "¿Lo que necesitas ahora es desahogarte, pedir consejo o buscar ayuda para algo que está pasando?",
    "¿Quieres contarme qué te hizo sentir que no tienes a nadie?",
    "¿Hay una persona adulta segura a la que puedas acercarte hoy?",
    "¿Prefieres que pensemos en un mensaje corto para empezar la conversación?",
    "¿Te sientes a salvo en este momento?",
    "¿Qué te gustaría que una persona te dijera o hiciera para sentirte acompañado?"
  ]
};

const friendBank = {
  openings: [
    "Es importante que quieras estar presente para tu amigo o amiga.",
    "Qué bueno que estés buscando una forma de apoyar sin empeorar la situación.",
    "Gracias por preocuparte por lo que está viviendo tu compañero o compañera.",
    "A veces, escuchar con calma ya es una ayuda importante.",
    "Tu intención de acompañar puede marcar una diferencia.",
    "Podemos pensar en un apoyo que sea seguro para ambos.",
    "No tienes que convertirte en quien resuelva todo el problema.",
    "Lo mejor es que tu amigo o amiga no tenga que afrontar esto en soledad."
  ],
  validation: [
    "Escúchale y toma en serio lo que te cuenta, sin presionarle para contar más de lo que desea.",
    "Recuérdale que no merece que lo traten mal.",
    "Evita culparle o preguntarle por qué no respondió de otra manera.",
    "No prometas guardar en secreto una situación en la que alguien pueda estar en peligro.",
    "No difundas capturas ni detalles; protege su privacidad.",
    "No te enfrentes a quien le molesta ni te pongas en riesgo.",
    "Puedes preguntarle qué tipo de apoyo necesita en vez de decidir por él o ella.",
    "Es mejor acompañarle a pedir ayuda que intentar investigar por tu cuenta."
  ],
  nextSteps: [
    "Anímale a hablar con un adulto de confianza y ofrécele acompañarle.",
    "Si ocurre en el colegio, pueden buscar a un tutor u orientador que sea seguro para ambos.",
    "Si hay mensajes de acoso, ayúdale a mostrarlos a un adulto sin reenviarlos a otras personas.",
    "Si hay peligro inmediato, avisa a una persona adulta enseguida, aunque tu amigo te haya pedido secreto.",
    "Puedes decirle: «Te creo, no es tu culpa y puedo acompañarte a buscar ayuda».",
    "Pregúntale si quiere estar acompañado durante el recreo o al hablar con un docente.",
    "Si la primera persona adulta no escucha, ayúdale a encontrar otra persona segura.",
    "Respeta su ritmo, pero no cargues tú solo con una situación que necesita apoyo adulto."
  ],
  questions: [
    "¿Tu amigo o amiga está a salvo ahora mismo?",
    "¿Él o ella sabe que quieres apoyarle?",
    "¿Hay algún adulto de confianza que pueda intervenir?",
    "¿Quieres que preparemos una frase para ofrecerle ayuda sin presionarle?",
    "¿Está ocurriendo en persona, en internet o en ambos?",
    "¿Te preocupa que pueda estar en peligro ahora?",
    "¿Tu amigo o amiga te ha pedido que le acompañes a contarlo?",
    "¿Qué es lo que más necesita en este momento: compañía, que le escuchen o ayuda de un adulto?"
  ]
};

const generalBank = {
  openings: [
    "Gracias por escribir a Lumy.",
    "Estoy aquí para orientarte con información y pasos seguros.",
    "Podemos explorar el tema con calma.",
    "Gracias por acercarte a Contigo.",
    "Cuéntame un poco más y trataré de orientarte.",
    "No hace falta que uses palabras especiales para explicarlo.",
    "Podemos empezar por lo que te resulte más fácil contar.",
    "Quiero asegurarme de entender lo que necesitas."
  ],
  validation: [
    "Tu pregunta merece una respuesta clara y respetuosa.",
    "No tienes que compartir información que te identifique.",
    "Es válido pedir orientación cuando algo te preocupa.",
    "Podemos centrarnos en opciones que no te pongan en riesgo.",
    "Si esto te está pasando, también puede ayudarte hablar con una persona adulta segura.",
    "Pedir apoyo a tiempo puede evitar que tengas que manejarlo en solitario.",
    "No tienes que resolver una situación difícil de una sola vez.",
    "Podemos dividirlo en pasos pequeños."
  ],
  nextSteps: [
    "Puedes contarme qué ocurrió, qué te preocupa y qué te gustaría que cambiara.",
    "Si se relaciona con el colegio, un familiar o un orientador de confianza puede ayudarte a pensar los siguientes pasos.",
    "Si alguien está en peligro, busca inmediatamente a un adulto de confianza.",
    "No compartas apellidos, direcciones, el nombre de tu colegio ni datos privados aquí.",
    "Puedes explicar la situación con tus propias palabras, incluso si está desordenada.",
    "Si prefieres, podemos preparar una forma sencilla de pedir ayuda.",
    "Cuéntame si buscas información, apoyo para ti o ideas para ayudar a otra persona.",
    "Puedo orientarte sobre bullying, ciberacoso, convivencia escolar y cómo pedir apoyo."
  ],
  questions: [
    "¿Qué es lo principal que te gustaría resolver?",
    "¿Puedes contarme un ejemplo de lo que ocurrió?",
    "¿Esto te está pasando a ti o quieres ayudar a otra persona?",
    "¿Qué te gustaría que sucediera después?",
    "¿Hay algo que te haga sentir inseguro ahora?",
    "¿Quieres información o prefieres pensar en un siguiente paso?",
    "¿En qué parte te gustaría que nos enfoquemos?",
    "¿Qué es lo que más te preocupa de todo esto?"
  ]
};

const teacherKeywordsForSafety = ["me toca", "me toca sin permiso", "me pide fotos", "me pide fotos intimas", "me pide que no cuente", "secreto entre nosotros", "me escribe cosas sexuales", "me quiere ver a solas", "me besa sin permiso", "me hace comentarios sexuales", "me pide que envie fotos"];

function isLoneliness(text) {
  return includesAny(text, [
    "no tengo con quien hablar", "no tengo con quien hablarme", "no tengo a nadie con quien hablar",
    "no hay nadie que me escuche", "nadie me escucha", "no tengo amigos", "no tengo amigas",
    "me siento solo", "me siento sola", "estoy solo", "estoy sola", "no puedo hablar con nadie",
    "no se a quien contarle", "no tengo a quien contarle", "no hay nadie para mi"
  ]);
}

function isFriendSupport(text) {
  return includesAny(text, ["mi amigo", "mi amiga", "ayudar a un amigo", "ayudar a una amiga", "un compañero", "una compañera", "mi mejor amigo", "mi mejor amiga"]) &&
    includesAny(text, ["bullying", "acoso", "molest", "insult", "burl", "exclu", "ayudar", "que hago", "que puedo hacer", "esta triste", "tiene miedo", "le pegan"]);
}

function hasBullyingContext(text) {
  return classifyBehavior(text) !== "unknown" || includesAny(text, ["bullying", "acoso escolar", "me humilla", "me hostiga", "me intimida"]);
}

function buildBullyingReply(seed, name, behavior) {
  let reply = compose(seed, bullyingBank, "bullying");
  if (name) reply = `Sobre ${name}, quiero que sepas esto: ${reply}`;

  if (behavior === "physical") {
    return `${pick(["Si hay empujones o agresiones físicas, no intentes enfrentarte a esa persona.", "Cuando hay agresiones físicas, lo primero es mantenerte acompañado y pedir ayuda.", "Si alguien te golpea o empuja, no tienes que resolverlo a solas."], seed, "physical-a")} ${pick(["Busca cuanto antes a un adulto de confianza y cuéntale lo ocurrido.", "Aléjate hacia un lugar con otras personas si puedes hacerlo sin aumentar el riesgo, y avisa a un adulto.", "Pide que una persona adulta segura te acompañe y ayude a tomar medidas."], seed, "physical-b")} ${pick(["¿Estás a salvo ahora?", "¿Hay un adulto cerca a quien puedas acudir?", "¿Ha ocurrido recientemente o está pasando en este momento?"], seed, "physical-q")}`;
  }

  if (behavior === "online") {
    return `${pick(["El acoso por mensajes o redes también merece atención.", "Que ocurra detrás de una pantalla no hace que sea menos importante.", "Los mensajes que te humillan o intimidan no son algo que tengas que aceptar."], seed, "online-a")} ${pick(["Si es seguro, conserva el contenido y enséñaselo a un adulto de confianza; no lo difundas ni respondas con insultos.", "Pide ayuda a un adulto para bloquear o reportar la cuenta y conservar los mensajes importantes.", "No compartas más información personal y busca apoyo adulto para reportar lo ocurrido."], seed, "online-b")} ${pick(["¿Ocurre en un grupo, por mensajes privados o en una publicación?", "¿Hay alguien adulto que pueda ayudarte a revisar y reportar esos mensajes?", "¿Te han amenazado o publicado información privada?"], seed, "online-q")}`;
  }

  if (behavior === "threat") {
    return `${pick(["Las amenazas deben tomarse en serio.", "No tienes que esperar a que una amenaza se convierta en una agresión para pedir ayuda.", "Es importante que no cargues con esa preocupación a solas."], seed, "threat-a")} ${pick(["No te reúnas a solas con esa persona; cuéntaselo a un adulto de confianza cuanto antes.", "Busca compañía y explica a un adulto qué se dijo, cuándo y si hay mensajes que lo documenten.", "Pide que un adulto seguro te acompañe y ayude a decidir qué hacer."], seed, "threat-b")} ${pick(["¿Te sientes en peligro ahora mismo?", "¿La amenaza fue por mensaje o en persona?", "¿Hay una persona adulta que pueda ayudarte hoy?"], seed, "threat-q")}`;
  }

  return reply;
}

let responseSequence = 0;

function respond(messages) {
  const userMessages = messages.filter(message => message.role === "user").map(message => message.content);
  const current = userMessages[userMessages.length - 1] || "";
  const currentText = normalize(current);
  const conversationSeed = messages.slice(-10).map(message => `${message.role}:${normalize(message.content)}`).join("|") || currentText;
  // Añade un contador para que dos consultas iguales también puedan recibir
  // combinaciones diferentes dentro del mismo despliegue.
  const seed = `${conversationSeed}|variation:${++responseSequence}`;
  const recentUserMessages = userMessages.slice(-6);
  const recentText = normalize(recentUserMessages.join(" "));
  const name = findRecentPersonName(recentUserMessages);

  // Primero se atienden las señales de mayor prioridad.
  const crisis = crisisReply(normalize(userMessages.slice(-3).join(" ")));
  if (crisis) return crisis;

  if (isAuthorityConcern(recentText)) {
    let reply = compose(
      seed,
      teacherBank,
      "teacher",
      "¿Estás a salvo ahora mismo y puedes acudir a un adulto de confianza que no esté implicado?"
    );
    if (includesAny(recentText, teacherKeywordsForSafety)) {
      reply += " Si esa persona te pide guardar secretos, enviar imágenes o estar a solas, cuéntaselo cuanto antes a un adulto seguro fuera de esa situación. No tienes que aceptar esas peticiones.";
    }
    return reply;
  }

  if (/^(hola|holi|hey|buenas|buenos dias|buenas tardes|buenas noches)\b/.test(currentText) && currentText.length < 50) {
    return pick([
      "¡Hola! 💙 Soy Lumy. Puedes contarme lo que ocurre con tus propias palabras; no hace falta que lo ordenes todo. ¿Qué te gustaría conversar?",
      "¡Hola! Qué bueno tenerte por aquí. Puedo orientarte sobre bullying, ciberacoso y convivencia escolar. ¿Qué tienes en mente hoy?",
      "¡Hola! Soy Lumy, de Contigo. Este es un espacio para buscar orientación con respeto. ¿Cómo puedo acompañarte hoy?",
      "¡Holi! 💙 Cuéntame qué te preocupa. No necesitas compartir nombres completos ni datos de tu colegio."
    ], seed, "greeting");
  }

  if (isLoneliness(recentText) && (isLoneliness(currentText) || currentText.length < 55 || includesAny(currentText, ["hablar", "escuchar", "solo", "sola", "nadie", "amigo", "amiga"]))) {
    return compose(seed, lonelyBank, "lonely");
  }

  if (isFriendSupport(recentText)) {
    return compose(seed, friendBank, "friend");
  }

  if (hasNickname(current) || (hasNickname(recentUserMessages.join(" ")) && includesAny(currentText, ["si", "no", "eso", "apodo", "me hace sentir", "me dice"]))) {
    const theme = detectNicknameTheme(recentText);
    let reply = compose(seed, nicknameBank, "nickname");
    if (name) reply = `Sobre ${name}: ${reply}`;
    if (theme === "appearance") {
      reply += " Recuerda: tu cuerpo o apariencia no necesitan cambiar para que merezcas respeto.";
    } else if (theme === "ability") {
      reply += " Un insulto sobre tus capacidades no determina lo que puedes aprender o conseguir.";
    }
    return reply;
  }

  const behavior = classifyBehavior(recentText);
  if (hasBullyingContext(recentText)) {
    return buildBullyingReply(seed, name, behavior);
  }

  if (includesAny(currentText, ["que es bullying", "que significa bullying", "tipos de bullying", "como reconocer el bullying", "como saber si es bullying", "que es el acoso escolar"])) {
    return pick([
      "El bullying es una forma de intimidación que suele repetirse y puede incluir burlas, insultos, exclusión, amenazas o agresiones. También puede ocurrir por internet. Un desacuerdo aislado no siempre es bullying, pero cualquier situación que te haga sentir inseguro merece atención. ¿Quieres hablar de algún ejemplo?",
      "Se suele hablar de bullying cuando hay comportamientos de intimidación que se repiten y existe una diferencia de poder o dificultad para defenderse. Puede ser verbal, social, físico o digital. Aunque no sepas cómo llamarlo, puedes pedir ayuda si te está afectando. ¿Qué situación te hizo preguntarlo?",
      "El acoso escolar no siempre se ve igual: puede ocurrir con palabras, exclusión, amenazas, agresiones o mensajes en línea. Lo importante es no minimizarlo y buscar apoyo. ¿Te gustaría que revisemos una situación concreta sin compartir datos personales?"
    ], seed, "definition");
  }

  if (includesAny(currentText, ["que hago", "como puedo responder", "que le digo", "como hago para que pare", "como lo soluciono", "no se que hacer"])) {
    return compose(seed, generalBank, "how-to");
  }

  if (includesAny(currentText, ["gracias", "muchas gracias", "vale gracias"])) {
    return pick([
      "De nada. 💙 Gracias por confiar en Contigo. Recuerda que mereces respeto y apoyo; no tienes que llevar una situación difícil en soledad.",
      "Me alegra que hayas podido hablarlo. Si vuelve a preocuparte, busca también a una persona adulta de confianza que pueda acompañarte en la vida real.",
      "Aquí tienes un espacio para ordenar tus ideas. Y recuerda que pedir apoyo a alguien seguro también es importante. 💙"
    ], seed, "thanks");
  }

  return compose(seed, generalBank, "general");
}

app.post("/api/chat", (req, res) => {
  try {
    const incoming = req.body?.messages;
    if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > 12) {
      return res.status(400).json({ error: "Formato de conversación no válido." });
    }

    const messages = incoming.map(message => {
      if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") {
        throw new Error("Mensaje no válido.");
      }
      return { role: message.role, content: message.content.slice(0, 1200) };
    });

    if (!messages.some(message => message.role === "user")) {
      return res.status(400).json({ error: "No se encontró un mensaje del estudiante." });
    }

    const reply = respond(messages);
    return res.json({ reply });
  } catch (error) {
    console.error("Error en el chatbot:", error?.message || "Error desconocido");
    return res.status(400).json({ error: "No se pudo procesar el mensaje. Inténtalo de nuevo." });
  }
});

app.get("/health", (_req, res) => res.json({
  ok: true,
  chatbot: "local-rules",
  openaiRequired: false,
  responseCombinations: {
    bullying: 8 * 8 * 8 * 10,
    loneliness: 8 * 8 * 8 * 8,
    teacherConcern: 8 * 8 * 8,
    nicknames: 8 * 8 * 8 * 8,
    helpingFriends: 8 * 8 * 8 * 8,
    general: 8 * 8 * 8 * 8
  }
}));

app.listen(port, () => {
  console.log(`Lumy está funcionando en el puerto ${port}`);
});

function urgentObjectAssaultReply(text) {
  
function urgentObjectAssaultReply(text) {
  const normalized = normalize(text);

  // Reconoce distintas maneras de describir una agresión
  // con introducción forzada de objetos.
  const insertionAction =
    /\b(?:me|nos|le)\s+(?:metieron|introdujeron|insertaron|pusieron|forzaron)\b/.test(normalized);

  const objectMention =
    /\b(?:palo|escoba|objeto|barra|botella)\b/.test(normalized);

  const bodyMention =
    /\b(?:culo|ano|recto|trasero)\b/.test(normalized);

  const explicitInsertion =
    insertionAction && objectMention && bodyMention;

  const assaultSignals = [
    "me metieron una escoba",
    "metieron una escoba",
    "me metieron un objeto",
    "me introdujeron un objeto",
    "me metieron algo por el ano",
    "me metieron algo en el ano",
    "me metieron algo por el culo",
    "me metieron algo en el culo",
    "me introdujeron algo por el ano",
    "me introdujeron algo en el culo",
    "me metieron un palo",
    "me introdujeron un palo",
    "me penetraron por la fuerza",
    "me violaron",
    "sufri una agresion sexual",
    "sufri abuso sexual",
    "me hicieron algo sexual sin mi consentimiento",
    "me tocaron sin mi consentimiento"
  ];

  if (!explicitInsertion && !includesAny(normalized, assaultSignals)) {
    return null;
  }

  return "Quiero que sepas que lo que describes es muy grave y no es tu culpa. Si esto te ocurrió a ti, busca ahora mismo a un adulto de confianza que pueda acompañarte y solicita atención médica urgente, aunque no notes lesiones. No tienes que contarme detalles íntimos ni enfrentarte a la persona que te hizo daño. Si estás en peligro inmediato, pide ayuda a los servicios de emergencia. Tu seguridad es lo primero.";
}
  const assaultSignals = [
    "me metieron una escoba",
    "metieron una escoba",
    "me introdujeron una escoba",
    "me metieron un objeto",
    "me introdujeron un objeto",
    "me metieron algo por el ano",
    "me penetraron por la fuerza",
    "me violaron",
    "sufri una agresion sexual",
    "sufri abuso sexual",
    "me obligaron a tener contacto sexual",
    "me hicieron algo sexual sin mi consentimiento",
    "me tocaron sin mi consentimiento"
  ];

  if (!includesAny(text, assaultSignals)) return null;

  return "Quiero que sepas que lo que describes es muy grave y no es tu culpa. Si esto te ocurrió a ti, busca ahora mismo a un adulto de confianza que pueda acompañarte y solicita atención médica urgente, aunque no notes lesiones. Si hay algún objeto que todavía no ha sido retirado, no intentes retirarlo ni manipularlo por tu cuenta: deja que te atienda personal sanitario. Aléjate de la persona que te hizo daño si puedes hacerlo de forma segura. Si estás en peligro inmediato, pide ayuda a los servicios de emergencia. No necesitas contarme detalles íntimos para merecer ayuda.";
}

const expandedBanks = {

  nickname: {
    openings: [
      "Gracias por contarme lo que te están diciendo.",
      "Entiendo que ese apodo te esté afectando.",
      "Quiero que sepas que mereces respeto.",
      "Siento que tengas que escuchar esas palabras.",
      "Podemos hablar de esto sin repetir el insulto.",
      "No tienes que fingir que te hace gracia.",
      "Lo que cuentas merece ser tomado en serio.",
      "Gracias por confiarme una situación que puede ser incómoda."
    ],
    validation: [
      "Un apodo no define tu identidad ni tu valor.",
      "No es culpa tuya que alguien decida burlarse.",
      "Tu apariencia no justifica que te humillen.",
      "Tienes derecho a pedir que dejen de llamarte así.",
      "Una broma deja de serlo cuando te lastima.",
      "No tienes que responder con otro insulto.",
      "Mereces que utilicen el nombre que tú prefieres.",
      "No tienes que cambiar quién eres para recibir respeto."
    ],
    nextSteps: [
      "Puedes explicar a un adulto de confianza qué apodo utilizan y cuándo sucede.",
      "Si te sientes seguro, puedes decir que no aceptas ese sobrenombre.",
      "Pide a un docente u orientador que intervenga si continúa.",
      "Si sucede en línea, conserva los mensajes solo si es seguro y pide ayuda para reportarlos.",
      "Busca la compañía de alguien que te trate con respeto.",
      "Puedes escribir lo sucedido para explicarlo con mayor tranquilidad.",
      "No te enfrentes a varias personas por tu cuenta.",
      "Pide que un adulto te acompañe si necesitas hablar con quienes lo hacen."
    ],
    questions: [
      "¿Quién suele utilizar ese apodo?",
      "¿Te ocurre delante de otras personas?",
      "¿Desde hace cuánto tiempo pasa?",
      "¿Ya le has contado esto a alguien de confianza?",
      "¿El apodo se repite incluso después de pedir que paren?",
      "¿Sucede en el colegio o también en internet?",
      "¿Qué es lo que más te duele de esa situación?",
      "¿Quieres que preparemos una manera de pedir que se detenga?"
    ]
  },

  loneliness: {
    openings: [
      "Gracias por contarme cómo te sientes.",
      "Debe ser difícil sentir que no tienes compañía.",
      "Te leo y quiero entender lo que estás viviendo.",
      "No tienes que ocultar que necesitas hablar con alguien.",
      "Podemos ir despacio, sin presión.",
      "Es importante que hayas podido expresar esto.",
      "No estás molestando por necesitar que te escuchen.",
      "A veces encontrar apoyo cuesta, pero mereces tenerlo."
    ],
    validation: [
      "Sentirte solo no significa que no seas importante.",
      "Mereces amistades donde puedas ser tú mismo.",
      "No tienes que agradarle a todo el mundo.",
      "Pedir compañía no te hace una carga.",
      "No necesitas tener muchos amigos para merecer apoyo.",
      "Es válido que quieras sentirte incluido.",
      "No tienes que solucionar todos tus sentimientos hoy.",
      "Tu necesidad de ser escuchado es importante."
    ],
    nextSteps: [
      "Podrías acercarte a un familiar o docente con quien te sientas cómodo.",
      "Intenta comenzar con una conversación pequeña con alguien amable.",
      "Puedes pedirle a un orientador escolar un espacio para conversar.",
      "Escribe lo que sientes y compártelo con una persona adulta segura.",
      "Busca una actividad escolar donde puedas conocer personas con intereses similares.",
      "No te obligues a confiar rápidamente; puedes ir conociendo a las personas poco a poco.",
      "Piensa en alguien que alguna vez te haya escuchado sin juzgarte.",
      "Si alguien te excluye intencionalmente, también puedes pedir apoyo a un adulto."
    ],
    questions: [
      "¿Te sientes así desde hace mucho tiempo?",
      "¿Hay alguien con quien te gustaría recuperar la comunicación?",
      "¿Te sientes solo en el colegio o también fuera de él?",
      "¿Qué te gustaría que cambiara en tus amistades?",
      "¿Hay algún adulto con quien puedas conversar hoy?",
      "¿Te cuesta acercarte a otras personas o sientes que te rechazan?",
      "¿Qué actividad disfrutas y podrías compartir con alguien?",
      "¿Quieres contarme qué ocurrió para que te sintieras así?"
    ]
  },

  rumors: {
    openings: [
      "Gracias por contarme lo que está sucediendo.",
      "Los rumores pueden generar mucha preocupación.",
      "Entiendo que te afecte que otras personas hablen de ti.",
      "Quiero ayudarte a pensar en una manera segura de manejarlo.",
      "No tienes que enfrentar todos esos comentarios por tu cuenta.",
      "Es difícil sentirse observado o juzgado por otros.",
      "Lo que estás viviendo merece atención.",
      "Podemos distinguir qué está ocurriendo y qué puedes hacer."
    ],
    validation: [
      "Un rumor no demuestra que algo sea verdad.",
      "No eres responsable de los comentarios que otras personas inventan.",
      "Tu privacidad y dignidad merecen respeto.",
      "No tienes que justificar cada aspecto de tu vida ante los demás.",
      "Difundir información privada para humillar puede causar mucho daño.",
      "No tienes que entrar en discusiones públicas para defenderte.",
      "Mereces que te escuchen antes de sacar conclusiones.",
      "No es necesario devolver el daño para protegerte."
    ],
    nextSteps: [
      "Cuéntale a un adulto de confianza qué se está difundiendo y cómo te afecta.",
      "Evita reenviar los rumores o compartirlos con más personas.",
      "Si aparecen en redes, pide ayuda para reportar las publicaciones.",
      "Conserva información relevante solo si hacerlo es seguro.",
      "Puedes pedir a un docente que te ayude a detener la difusión en el colegio.",
      "Habla con alguien que pueda escuchar tu versión sin juzgarte.",
      "No publiques datos privados para intentar demostrar algo.",
      "Pide apoyo si los rumores incluyen amenazas o información íntima."
    ],
    questions: [
      "¿Los comentarios se están difundiendo en el colegio o por internet?",
      "¿Sabes si comenzó con una persona o con varias?",
      "¿Se está compartiendo información privada?",
      "¿Hay amenazas relacionadas con esos rumores?",
      "¿Algún adulto de confianza conoce la situación?",
      "¿Qué es lo que más te preocupa que otras personas crean?",
      "¿Quieres pensar en cómo hablar con tu tutor?",
      "¿Te sientes seguro en el lugar donde está ocurriendo?"
    ]
  },

  digital: {
    openings: [
      "Gracias por explicarme lo que ocurre en internet.",
      "Lo que sucede en redes también puede afectar mucho.",
      "Quiero ayudarte a encontrar una forma segura de actuar.",
      "No tienes que soportar mensajes que te intimiden.",
      "Es importante que podamos tomar en serio el ciberacoso.",
      "Gracias por confiarme esta situación.",
      "Que ocurra detrás de una pantalla no lo hace menos importante.",
      "Vamos a pensar en los siguientes pasos."
    ],
    validation: [
      "Nadie tiene derecho a amenazarte por mensajes.",
      "No tienes que responder con insultos.",
      "Tu privacidad debe ser respetada.",
      "No eres culpable de recibir mensajes abusivos.",
      "No tienes que aceptar solicitudes que te hagan sentir inseguro.",
      "Mereces usar internet sin intimidación.",
      "Puedes pedir ayuda aunque el mensaje ya haya sido eliminado.",
      "No tienes que solucionar el problema enfrentando a la cuenta."
    ],
    nextSteps: [
      "Pide a un adulto de confianza que te ayude a bloquear o reportar la cuenta.",
      "Conserva los mensajes importantes si hacerlo es seguro.",
      "Revisa tu privacidad con ayuda de una persona adulta.",
      "No compartas contraseñas, direcciones ni información personal.",
      "Evita entrar en discusiones que puedan aumentar el conflicto.",
      "Si comparten imágenes privadas, pide ayuda adulta inmediatamente para reportarlo.",
      "Si alguien se hace pasar por ti, informa a la plataforma y a un adulto seguro.",
      "Si recibes amenazas, no te reúnas con esa persona y pide ayuda."
    ],
    questions: [
      "¿Ocurre en WhatsApp, Instagram, TikTok u otra plataforma?",
      "¿Te están enviando mensajes privados o publicando comentarios?",
      "¿Han compartido algo personal sin tu permiso?",
      "¿La cuenta pertenece a alguien que conoces?",
      "¿Hay amenazas o intentos de intimidarte?",
      "¿Tienes a un adulto que pueda ayudarte a revisar la situación?",
      "¿Esto ocurre desde hace días o comenzó recientemente?",
      "¿Quieres que pensemos cómo reportarlo?"
    ]
  },

  exclusion: {
    openings: [
      "Siento que estés viviendo una situación de exclusión.",
      "Gracias por contarme cómo te están tratando.",
      "Es importante que puedas sentirte incluido y respetado.",
      "No tienes que fingir que no te importa que te aparten.",
      "Quiero entender mejor qué está pasando.",
      "Lo que cuentas merece ser escuchado.",
      "Podemos pensar en pequeños pasos para buscar apoyo.",
      "No tienes que enfrentar esto en soledad."
    ],
    validation: [
      "Mereces formar parte de un ambiente donde te respeten.",
      "Que un grupo te excluya no determina tu valor.",
      "No tienes que cambiar tu personalidad para ser aceptado.",
      "Es válido que te duela sentirte apartado.",
      "La amistad debe permitir que todos se sientan respetados.",
      "No eres responsable de las decisiones hirientes de otras personas.",
      "Tienes derecho a pedir ayuda cuando te aíslan intencionalmente.",
      "No tienes que perseguir la aceptación de quienes te hacen daño."
    ],
    nextSteps: [
      "Busca a una persona con quien puedas compartir el recreo o una actividad.",
      "Puedes contarle a tu tutor cómo te está afectando la exclusión.",
      "Intenta acercarte a compañeros que hayan mostrado amabilidad.",
      "Pide ayuda si el aislamiento forma parte de burlas o intimidación repetida.",
      "Puedes explicar a un adulto los momentos concretos en que te dejan fuera.",
      "Busca un espacio escolar donde te sientas acompañado.",
      "No te obligues a entrar en un grupo que te trata mal.",
      "Considera pedir apoyo al orientador escolar."
    ],
    questions: [
      "¿Te excluyen de actividades o también dejan de hablarte?",
      "¿Sucede con un grupo específico?",
      "¿Desde cuándo notas ese comportamiento?",
      "¿Hay alguien en el colegio con quien sí te sientas cómodo?",
      "¿Has podido hablar de esto con un adulto?",
      "¿Te excluyen de manera intencional o no sabes qué está pasando?",
      "¿Qué momento del día te resulta más difícil?",
      "¿Quieres que pensemos cómo acercarte a alguien de confianza?"
    ]
  },

  friend: {
    openings: [
      "Es valioso que quieras acompañar a tu amigo.",
      "Gracias por preocuparte por otra persona.",
      "Podemos pensar en una forma segura de ayudar.",
      "Tu interés por escucharle puede ser importante.",
      "No tienes que resolver tú solo lo que está ocurriendo.",
      "Es bueno que busques orientación antes de actuar.",
      "Tu amigo merece sentirse escuchado.",
      "Vamos a considerar qué puede ayudarle sin ponerlos en peligro."
    ],
    validation: [
      "Escuchar sin juzgar puede ser un primer paso.",
      "No le culpes por lo que le está sucediendo.",
      "Respeta su privacidad y evita difundir lo que te cuenta.",
      "No prometas guardar secretos cuando exista peligro.",
      "No necesitas enfrentarte a quien lo está intimidando.",
      "Recuérdale que merece respeto y apoyo.",
      "Puedes acompañarle sin presionarle para que cuente todo.",
      "También es válido que tú pidas orientación adulta."
    ],
    nextSteps: [
      "Ofrécele acompañarle a hablar con un docente de confianza.",
      "Pregúntale qué apoyo necesita y escucha su respuesta.",
      "Si hay peligro inmediato, avisa a un adulto aunque te haya pedido guardar silencio.",
      "No difundas capturas ni detalles de su historia.",
      "Puedes decirle que no tiene que afrontar la situación sin compañía.",
      "Anímale a contar lo ocurrido a un familiar seguro.",
      "Si no sabes qué hacer, pide orientación a un adulto.",
      "Si la situación ocurre en línea, ayúdale a pedir apoyo para reportarla."
    ],
    questions: [
      "¿Tu amigo está a salvo ahora mismo?",
      "¿Él o ella sabe que quieres ayudarle?",
      "¿Ha podido hablar con un adulto de confianza?",
      "¿Quieres que preparemos una frase para ofrecerle compañía?",
      "¿La situación sucede en el colegio o por internet?",
      "¿Hay amenazas o agresiones?",
      "¿Te preocupa que pueda estar en peligro?",
      "¿Qué es lo que más necesita de ti en este momento?"
    ]
  },

  teacher: {
    openings: [
      "Gracias por contarme algo tan delicado.",
      "Quiero tomar en serio lo que estás explicando.",
      "Siento que estés pasando por esta situación con un adulto del colegio.",
      "Mereces sentirte seguro en tu centro educativo.",
      "Es importante que otra persona adulta pueda escucharte.",
      "No tienes que resolver esto sin ayuda.",
      "Gracias por confiarme lo que ocurre.",
      "Podemos pensar en cómo encontrar apoyo fuera de esa situación."
    ],
    validation: [
      "Tener autoridad no le da permiso a una persona para intimidarte.",
      "No es tu culpa si un adulto cruza tus límites.",
      "Tienes derecho a que te traten con respeto.",
      "No tienes que guardar secretos que te hacen sentir inseguro.",
      "Tu relato merece ser escuchado sin presiones.",
      "No tienes que enfrentarte a esa persona por tu cuenta.",
      "Puedes pedir ayuda incluso si no sabes cómo describir exactamente lo sucedido.",
      "No estás haciendo nada malo al contar lo que te preocupa."
    ],
    nextSteps: [
      "Habla cuanto antes con un familiar o adulto seguro que no esté implicado.",
      "Busca a un orientador o responsable de protección distinto de la persona señalada.",
      "No te quedes a solas con esa persona para resolver el problema.",
      "Pide a un adulto de confianza que te acompañe al hablar del tema.",
      "Si hay mensajes, consérvalos solo si es seguro y muéstralos a una persona adulta.",
      "Si la primera persona no te escucha, busca otro adulto seguro.",
      "No investigues ni intentes obtener pruebas exponiéndote a más riesgos.",
      "Si te sientes en peligro ahora, busca compañía y ayuda inmediata."
    ],
    questions: [
      "¿Estás a salvo ahora mismo?",
      "¿Hay un familiar que pueda acompañarte?",
      "¿Existe otro docente con quien sí te sientas seguro?",
      "¿Te preocupa volver a estar a solas con esa persona?",
      "¿Ocurre durante las clases o fuera del horario escolar?",
      "¿Quieres ayuda para escribir un mensaje a un familiar?",
      "¿Puedes acudir a una persona adulta que no esté implicada?",
      "¿Necesitas ayuda inmediata para estar en un lugar seguro?"
    ]
  },

  conflict: {
    openings: [
      "Gracias por explicar lo que pasó.",
      "Los conflictos pueden ser difíciles de manejar.",
      "Quiero entender las dos partes de la situación sin juzgarte.",
      "Podemos buscar una manera respetuosa de abordar el problema.",
      "Es positivo que quieras encontrar una solución.",
      "Vamos a separar lo que ocurrió de cómo te hizo sentir.",
      "No tienes que resolverlo en medio del enojo.",
      "Podemos pensar en una respuesta que no empeore las cosas."
    ],
    validation: [
      "Tus sentimientos importan, incluso cuando existe un desacuerdo.",
      "No es necesario responder con agresiones para defender tu punto de vista.",
      "Tienes derecho a expresar tus límites con respeto.",
      "Escuchar a otra persona no significa aceptar malos tratos.",
      "Un desacuerdo no justifica amenazas ni humillaciones.",
      "Puedes pedir tiempo antes de continuar una conversación difícil.",
      "No tienes que aceptar una discusión que te haga sentir inseguro.",
      "Buscar apoyo para resolver un conflicto es válido."
    ],
    nextSteps: [
      "Cuando ambos estén tranquilos, puedes explicar qué te molestó.",
      "Intenta hablar de lo ocurrido sin insultos ni amenazas.",
      "Si no pueden dialogar con calma, pide mediación de un adulto neutral.",
      "Puedes escribir tus ideas antes de hablar.",
      "Escucha la otra versión sin abandonar tus propios límites.",
      "Si aparecen amenazas o agresiones, busca ayuda adulta.",
      "No difundas el conflicto en redes para conseguir apoyo.",
      "Puedes pedir una pausa si la conversación se vuelve demasiado intensa."
    ],
    questions: [
      "¿Qué ocurrió antes de que comenzara la discusión?",
      "¿Qué te gustaría que cambiara?",
      "¿Ambos han podido explicar cómo se sienten?",
      "¿Se trata de un desacuerdo o hay intimidación repetida?",
      "¿Te sientes seguro al hablar con esa persona?",
      "¿Hay un adulto neutral que pueda ayudar?",
      "¿Qué resultado te parecería justo?",
      "¿Quieres que pensemos en cómo expresar lo que necesitas?"
    ]
  }
};

function detectExpandedTopic(text) {
  if (isAuthorityConcern(text)) return "teacher";
  if (isLoneliness(text)) return "loneliness";
  if (isFriendSupport(text)) return "friend";

  if (hasNickname(text)) return "nickname";

  if (includesAny(text, [
    "inventan cosas de mi", "hablan mal de mi", "difunden rumores",
    "chismes sobre mi", "estan hablando de mi", "dicen mentiras de mi",
    "publicaron rumores", "me acusan de algo que no hice",
    "comparten informacion privada", "estan difundiendo cosas"
  ])) return "rumors";

  if (includesAny(text, [
    "whatsapp", "instagram", "tiktok", "redes sociales",
    "grupo de chat", "chat del colegio", "me mandan mensajes",
    "publicaron una foto", "subieron una foto", "cuenta falsa",
    "me amenazan por internet", "me escriben por redes"
  ]) && includesAny(text, [
    "molestan", "acoso", "insultan", "burlan", "amenazan",
    "foto", "mensaje", "humillan", "excluyen", "difunden",
    "me hacen", "me escriben"
  ])) return "digital";

  if (includesAny(text, [
    "me dejan fuera", "no me invitan", "me excluyen",
    "no me incluyen", "me ignoran", "me apartan",
    "nadie quiere sentarse conmigo", "no me dejan participar",
    "me dejan solo en el recreo", "me dejan sola en el recreo"
  ])) return "exclusion";

  if (includesAny(text, [
    "discuti con", "discutimos", "tuvimos una pelea",
    "me enoje con", "esta enojado conmigo", "esta enojada conmigo",
    "nos llevamos mal", "no nos entendemos", "tuvimos un problema",
    "quiero solucionar un conflicto", "me pelee con"
  ])) return "conflict";

  return null;
}
