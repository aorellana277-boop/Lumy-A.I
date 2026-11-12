import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const port = process.env.PORT || 3000;

// Configuración indispensable para Render y proxies inversos:
// permite que express-rate-limit identifique correctamente la IP de cada cliente
// sin bloquear globalmente a todos los usuarios detrás del balanceador de Render.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
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
  })
);

app.use(express.json({ limit: "25kb" }));

app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Has enviado demasiados mensajes seguidos. Espera unos segundos y vuelve a intentarlo."
    }
  })
);

app.use(express.static("public"));

// =============================================================================
// LUMY v2.0 — MOTOR CONVERSACIONAL EDUCATIVO DE ORIENTACIÓN Y PROTECCIÓN ESCOLAR
// Arquitectura NLP basada en reglas semánticas, análisis contextual multi-turno,
// extracción segura de entidades, priorización de riesgos y composición modular.
// No requiere claves de API externas ni servicios de pago para funcionar.
// =============================================================================

// -----------------------------------------------------------------------------
// 1. RECURSOS OFICIALES VERIFICADOS (PERÚ E INTERNACIONAL)
// -----------------------------------------------------------------------------
const OFFICIAL_RESOURCES = {
  emergencyPeru:
    "Si estás en peligro inmediato en Perú, comunícate gratis con la Policía Nacional al 105, atención médica móvil SAMU al 106, Bomberos al 116 o la Línea 100 (atención 24 horas). Si estás en otro país, llama al número local de emergencias (como 911 o 112).",
  sexualViolencePeru:
    "En Perú puedes recibir orientación y protección gratuita las 24 horas en la Línea 100 (llamando al 100 desde cualquier teléfono), en el Chat 100 (chat100.warminan.gob.pe), en un Centro Emergencia Mujer (CEM) o en la Línea ANNA 1810 para niñas, niños y adolescentes. Además, todo establecimiento de salud del MINSA brinda atención médica de urgencia gratuita.",
  familyViolencePeru:
    "En Perú puedes pedir ayuda gratuita y confidencial llamando a la Línea 100 (las 24 horas), a la Línea ANNA 1810 (exclusiva para protección de niñas, niños y adolescentes en riesgo familiar), escribiendo al Chat 100 o acudiendo a la DEMUNA de tu municipalidad o a un Centro Emergencia Mujer (CEM).",
  schoolBullyingPeru:
    "En Perú, los casos de violencia escolar (entre estudiantes o del personal del colegio hacia estudiantes) se pueden reportar de forma confidencial en el portal SíseVe del MINEDU (siseve.minedu.gob.pe), llamando gratis al 0800-76-888 o por WhatsApp al 991 410 000, además de acudir a Tutoría, Convivencia Escolar o la DEMUNA.",
  mentalHealthPeru:
    "En Perú puedes llamar gratis las 24 horas a la Línea 113, opción 5 (Salud Mental y Psicología del MINSA) o acudir al Centro de Salud Mental Comunitaria más cercano. También puedes llamar a la Línea 100 o a la Línea ANNA 1810.",
  authorityAbusePeru:
    "Según los protocolos del MINEDU (D.S. N.° 004-2018-MINEDU), todo maltrato o conducta inapropiada de personal del colegio debe reportarse de inmediato en SíseVe (siseve.minedu.gob.pe, línea gratuita 0800-76-888 o WhatsApp 991 410 000), en la UGEL, en la DEMUNA o en la Línea 100."
};

// -----------------------------------------------------------------------------
// 2. NORMALIZACIÓN DE TEXTO Y CORRECCIÓN ORTOGRÁFICA / INFORMAL
// -----------------------------------------------------------------------------
const COLLOQUIAL_REPLACEMENTS = [
  [/\bxq\b/g, "porque"],
  [/\bporq\b/g, "porque"],
  [/\bpq\b/g, "porque"],
  [/\bxfa\b/g, "por favor"],
  [/\bporfa\b/g, "por favor"],
  [/\bpf\b/g, "por favor"],
  [/\btmb\b/g, "tambien"],
  [/\btb\b/g, "tambien"],
  [/\bk\b/g, "que"],
  [/\bq\b/g, "que"],
  [/\bke\b/g, "que"],
  [/\bqe\b/g, "que"],
  [/\bd\b/g, "de"],
  [/\bpa\b/g, "para"],
  [/\bm\b/g, "me"],
  [/\bc\b/g, "se"],
  [/\bbullyng\b/g, "bullying"],
  [/\bbuling\b/g, "bullying"],
  [/\bbullin\b/g, "bullying"],
  [/\bbulin\b/g, "bullying"],
  [/\bbulying\b/g, "bullying"],
  [/\bciberbuling\b/g, "ciberbullying"],
  [/\bciberbulling\b/g, "ciberbullying"],
  [/\bcyberbullying\b/g, "ciberbullying"],
  [/\bwsp\b/g, "whatsapp"],
  [/\bwasap\b/g, "whatsapp"],
  [/\bguasap\b/g, "whatsapp"],
  [/\big\b/g, "instagram"],
  [/\bfb\b/g, "facebook"],
  [/\bprofe\b/g, "profesor"],
  [/\bmiss\b/g, "profesora"],
  [/\bcole\b/g, "colegio"],
  [/\bsalon\b/g, "salon de clases"],
  [/\bpata\b/g, "amigo"],
  [/\bflaca\b/g, "chica"],
  [/\bflaco\b/g, "chico"],
  [/\bchibolo\b/g, "chico"],
  [/\bchibola\b/g, "chica"],
  [/\bpegan\b/g, "golpean"],
  [/\bpega\b/g, "golpea"],
  [/\bpego\b/g, "golpeo"],
  [/\bme pegaron\b/g, "me golpearon"],
  [/\bme pego\b/g, "me golpeo"],
  [/\bfastidia\b/g, "molesta"],
  [/\bfastidian\b/g, "molestan"],
  [/\bfastidiando\b/g, "molestando"],
  [/\bfastidiarme\b/g, "molestarme"],
  [/\bjode\b/g, "molesta"],
  [/\bjoden\b/g, "molestan"],
  [/\bjodiendo\b/g, "molestando"],
  [/\bchapa\b/g, "apodo"],
  [/\bchapas\b/g, "apodos"],
  [/\bsobrenombre\b/g, "apodo"],
  [/\bsobrenombres\b/g, "apodos"],
  [/\bamenazo\b/g, "amenazar"],
  [/\bamenazaron\b/g, "amenazar"],
  [/\biolaron\b/g, "violaron"],
  [/\bbiolaron\b/g, "violaron"],
  [/\bbolaron\b/g, "violaron"],
  [/\babusaron\b/g, "abuso sexual"],
  [/\bago\b/g, "hago"],
  [/\bazer\b/g, "hacer"],
  [/\baser\b/g, "hacer"],
  [/\bayudame\b/g, "ayuda"],
  [/\bayudenme\b/g, "ayuda"],
  [/\bsuicidarme\b/g, "quitarme la vida"],
  [/\bmatarme\b/g, "quitarme la vida"]
];

function normalizeRaw(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9ñü\s]/gi, " ")
    .replace(/(.)\1{2,}/g, "$1$1") // reduce letras repetidas como "holaaa" -> "holaa"
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value = "") {
  let text = normalizeRaw(value);
  for (const [pattern, replacement] of COLLOQUIAL_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s+/g, " ").trim();
}

// Búsqueda segura por palabras o frases completas para evitar falsos positivos
// como "fe" dentro de "profe" o "defensa".
function matchTerm(normalizedText, rawTerm) {
  const term = normalize(rawTerm);
  if (!term) return false;
  if (term.endsWith("*")) {
    const stem = term.slice(0, -1).trim();
    const regex = new RegExp(`(?:^|\\s)${stem}[a-z0-9ñü]*(?:\\s|$)`, "i");
    return regex.test(normalizedText);
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i");
  return regex.test(normalizedText);
}

function includesAny(normalizedText, terms = []) {
  return terms.some(term => matchTerm(normalizedText, term));
}

function countMatches(normalizedText, terms = []) {
  let count = 0;
  for (const term of terms) {
    if (matchTerm(normalizedText, term)) count += 1;
  }
  return count;
}

// -----------------------------------------------------------------------------
// 3. EXTRACCIÓN SEGURA DE ENTIDADES Y NOMBRES PROPIOS
// -----------------------------------------------------------------------------
const NON_PERSON_WORDS = new Set([
  "hola", "holi", "hey", "buenas", "buenos", "dias", "tardes", "noches",
  "esta", "este", "esa", "ese", "aquel", "aquella", "persona", "personas",
  "chico", "chica", "chicos", "chicas", "compañero", "compañera", "compañeros",
  "compañeras", "amigo", "amiga", "amigos", "amigas", "profesor", "profesora",
  "profe", "docente", "maestro", "maestra", "director", "directora", "tutor",
  "tutora", "auxiliar", "entrenador", "entrenadora", "coord", "coordinador",
  "padre", "madre", "papa", "mama", "padres", "tio", "tia", "hermano", "hermana",
  "primo", "prima", "abuelo", "abuela", "padrastro", "madrastra", "familiar",
  "familia", "adulto", "adultos", "gente", "grupo", "clase", "salon", "colegio",
  "escuela", "casa", "hogar", "internet", "redes", "whatsapp", "instagram",
  "tiktok", "facebook", "mensaje", "mensajes", "foto", "fotos", "video", "videos",
  "alguien", "nadie", "todos", "todas", "uno", "una", "unos", "unas", "otro",
  "otra", "otros", "otras", "el", "ella", "ellos", "ellas", "yo", "tu", "usted",
  "nosotros", "nosotras", "me", "te", "se", "nos", "mi", "mis", "su", "sus",
  "que", "quien", "quienes", "cuando", "donde", "como", "porque", "pero", "aunque",
  "tambien", "solo", "sola", "solos", "solas", "mucho", "mucha", "muchos", "muchas",
  "poco", "poca", "siempre", "nunca", "jamas", "hoy", "ayer", "mañana", "antes",
  "despues", "ahora", "ya", "todavia", "aun", "mas", "menos", "muy", "tan",
  "tengo", "tiene", "tienen", "estoy", "esta", "estan", "soy", "eres", "es", "son",
  "siento", "siente", "quiero", "quiere", "puedo", "puede", "debo", "debe",
  "hago", "hace", "hacen", "dice", "dicen", "dijo", "dijeron", "creo", "pienso",
  "necesito", "ayuda", "auxilio", "por", "para", "con", "sin", "sobre", "entre",
  "hasta", "desde", "hacia", "durante", "mediante", "segun", "contra", "bajo",
  "gracias", "disculpa", "perdon", "miedo", "temor", "verguenza", "triste",
  "cansado", "cansada", "harto", "harta", "asustado", "asustada", "peligro",
  "bullying", "acoso", "ciberacoso", "violencia", "abuso", "golpe", "golpes",
  "insulto", "insultos", "apodo", "apodos", "burla", "burlas", "rumor", "rumores",
  "lumy", "contigo", "chat", "chatbot", "ia", "bot", "sistema", "cole", "recreo",
  "salir", "entrar", "volver", "ir", "venir", "hablar", "contar", "decir", "pedir",
  "publicaron", "subieron", "crearon", "inventan", "excluyen", "ignoran", "amenazan",
  "molesta", "molestan", "fastidia", "fastidian", "burla", "burlan", "pega", "pegan"
]);

function formatSafeName(rawCandidate = "") {
  const cleaned = normalizeRaw(rawCandidate).split(" ")[0] || "";
  if (cleaned.length < 3 || cleaned.length > 18) return null;
  if (NON_PERSON_WORDS.has(cleaned)) return null;
  if (!/^[a-zñü]+$/i.test(cleaned)) return null;
  // Evitar verbos conjugados típicos en primera/tercera persona o gerundios/participios
  if (/(?:ando|iendo|aron|ieron|arme|arte|arse|arnos|aban|ian)$/i.test(cleaned)) return null;
  return cleaned.charAt(0).toLocaleUpperCase("es") + cleaned.slice(1);
}

function extractPersonName(message = "") {
  const text = String(message).trim();
  if (!text) return null;

  const explicitPatterns = [
    /\b(?:se llama|llamado|llamada|de nombre)\s+([A-ZÁÉÍÓÚÑÜa-záéíóúñü]{3,18})\b/i,
    /\b(?:compañero|compañera|amigo|amiga|chico|chica|persona|profesor|profesora|profe|docente|maestro|maestra|tio|tia|primo|prima|hermano|hermana)\s*\(\s*([A-ZÁÉÍÓÚÑÜa-záéíóúñü]{3,18})\s*\)/i,
    /\b(?:mi\s+)?(?:compañero|compañera|amigo|amiga|profesor|profesora|profe|docente|maestro|maestra|tio|tia|primo|prima)\s+([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,17})\b/,
    /\b([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]{2,17})\s+(?:siempre\s+|todos los dias\s+|a veces\s+|hoy\s+|ayer\s+)?(?:me|nos|se|le)\s+(?:molesta|molesto|fastidia|fastidio|insulta|insulto|burla|humilla|amenaza|amenazo|excluye|ignora|acosa|hostiga|pega|pego|golpea|golpeo|empuja|empujo|toca|toco|quita|quito|dice|dijo|pone|puso|hace|hizo|trata)\b/,
    /(?:^|[.,;!?]\s+)([a-záéíóúñü]{3,18})\s+(?:siempre\s+|todos los dias\s+)?(?:me|se)\s+(?:molesta|fastidia|insulta|burla de mi|humilla|amenaza|pega|golpea|acosa)\b/i
  ];

  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const formatted = formatSafeName(match[1]);
      if (formatted) return formatted;
    }
  }
  return null;
}

function findRecentPersonName(userMessages = []) {
  for (let i = userMessages.length - 1; i >= 0; i -= 1) {
    const name = extractPersonName(userMessages[i]);
    if (name) return name;
  }
  return null;
}

// -----------------------------------------------------------------------------
// 4. DICCIONARIOS DE SEÑALES SEMÁNTICAS POR INTENCIÓN Y ESCENARIO
// -----------------------------------------------------------------------------
const SIGNALS = {
  // 4.1 Protocolo crítico 1: Violencia sexual, violación, abuso, tocamientos y coerción
  sexualAssaultUrgent: [
    "me violaron", "me violo", "abusaron de mi", "abusaron sexualmente", "abuso sexual",
    "abuso sexualmente de mi", "me abuso", "agresion sexual", "me agredieron sexualmente",
    "me tocaron sin mi consentimiento", "me toco sin mi consentimiento", "me toca sin mi consentimiento",
    "me tocaron sin permiso", "me toco sin permiso", "me toca mis partes", "me toco mis partes",
    "toco mis partes intimas", "me tocaron mis partes", "tocamientos indebidos", "me manoseo",
    "me manosearon", "me obligo a hacer algo sexual", "me obligaron a hacer algo sexual",
    "me obligo a realizar algo sexual", "me obligaron a realizar algo sexual",
    "me obligaron a tener relaciones", "me obligo a tener relaciones", "me forzo sexualmente",
    "me forzaron a", "introdujo por la fuerza", "me introdujeron por la fuerza",
    "metio por la fuerza", "me metieron por la fuerza", "me metieron un objeto",
    "me introdujeron un objeto", "me metieron una escoba", "metieron una escoba",
    "en el ano", "por el ano", "en la vagina", "zona intima", "zonas intimas",
    "partes intimas", "parte intima", "me lastimaron en una zona intima",
    "me lastimo en una zona intima", "me duele mi parte intima", "sangrado intimo",
    "me penetraron", "me penetro", "me obligo a tocarlo", "me obligo a tocarla",
    "me obligo a besarlo", "me obligo a besarla", "me beso a la fuerza", "me beso sin permiso"
  ],
  sexualGroomingCoercion: [
    "pide fotografias intimas", "pide fotos intimas", "me pide fotos desnuda", "me pide fotos desnudo",
    "me pide fotos sin ropa", "pide fotos de mi cuerpo", "me presiona para enviar fotos",
    "me presionan para enviar fotografias", "me amenaza con publicar mis fotos intimas",
    "difundieron fotos intimas", "publicaron fotos intimas", "pack sin permiso",
    "comportamientos sexuales inapropiados", "comportamiento sexual inapropiado",
    "comentarios sexuales", "cosas sexuales", "propuestas sexuales", "insinuaciones sexuales",
    "me mira el cuerpo con morbo", "secreto entre nosotros", "amenaza para que no cuente",
    "me dijo que no cuente lo que me hizo"
  ],

  // 4.2 Protocolo crítico 2: Autolesión y riesgo suicida
  selfHarmCrisis: [
    "quiero quitarme la vida", "pienso en quitarme la vida", "voy a quitarme la vida",
    "quiero suicidarme", "pienso en suicidarme", "me quiero morir", "quiero morir",
    "ya no quiero vivir", "no quiero seguir viviendo", "quiero acabar con mi vida",
    "voy a acabar con mi vida", "quiero desaparecer para siempre", "mejor muerto", "mejor muerta",
    "nadie me extrañaria si muero", "quiero hacerme daño", "me estoy haciendo daño",
    "me corto", "me estoy cortando", "autolesion", "autolesionarme", "me voy a lastimar",
    "voy a lastimarme", "no puedo seguir con mi vida"
  ],

  // 4.3 Protocolo crítico 3: Peligro inmediato y emergencia activa
  immediateDanger: [
    "no me siento a salvo", "no estoy a salvo", "estoy en peligro", "peligro inmediato",
    "tengo miedo de que me hagan daño", "tengo miedo de que me haga daño",
    "me quieren hacer daño ahora", "me quiere hacer daño ahora",
    "me estan golpeando", "me esta golpeando", "me estan pegando", "me esta pegando",
    "no puedo salir", "no me dejan salir", "no me deja salir", "estoy encerrado", "estoy encerrada",
    "me estan siguiendo", "me esta siguiendo", "me esperan afuera para pegarme",
    "me estan amenazando ahora", "tiene un cuchillo", "tiene un arma", "ayuda urgente",
    "necesito ayuda urgente", "necesito ayuda ahora", "auxilio me quieren pegar"
  ],

  // 4.4 Violencia familiar y maltrato en el hogar
  familyActors: [
    "mis padres", "mi padre", "mi madre", "mi papa", "mi mama", "papa", "mama",
    "padrastro", "madrastra", "mi tio", "mi tia", "mi hermano", "mi hermana",
    "mi abuelo", "mi abuela", "mi primo", "mi prima", "un familiar", "mi familia",
    "en mi casa", "en mi hogar", "volver a casa", "llegar a casa"
  ],
  familyViolenceDirect: [
    "mis padres me golpean", "mis padres me pegan", "mi papa me golpea", "mi mama me golpea",
    "mi padre me golpea", "mi madre me golpea", "en mi casa me golpean",
    "un familiar me amenaza", "un familiar me golpea", "tengo miedo de volver a casa",
    "me da miedo volver a mi casa", "miedo de ir a mi casa", "problemas en mi familia",
    "violencia familiar", "maltrato familiar", "me botan de la casa", "me corrieron de mi casa",
    "mis padres me insultan", "mis padres me humillan", "en mi casa me tratan mal",
    "mi padrastro me golpea", "mi padrastro me amenaza", "peleas en mi casa"
  ],

  // 4.5 Problemas e intimidación por profesores o adultos del colegio
  authorityActors: [
    "profesor", "profesora", "docente", "maestro", "maestra", "director", "directora",
    "subdirector", "subdirectora", "tutor", "tutora", "auxiliar", "entrenador",
    "entrenadora", "psicologo del colegio", "coordinador", "coordinadora",
    "adulto del colegio", "personal del colegio"
  ],
  authorityAbuseDirect: [
    "profesor me intimida", "profesora me intimida", "docente me intimida",
    "profesor me humilla", "profesora me humilla", "profesor me grita", "profesora me grita",
    "profesor me insulta", "profesor se burla de mi", "profesor me trata mal",
    "profesor me amenaza", "profesor me acosa", "profesor me tiene bronca",
    "adulto me humilla", "adulto me intimida", "auxiliar me grita", "auxiliar me trata mal",
    "director no me escucha", "profesor me jala por venganza", "profesor me ridiculiza"
  ],

  // 4.6 Violencia física escolar
  physicalViolence: [
    "me golpeo", "me golpearon", "me golpea", "me golpean", "me empujo", "me empujaron",
    "me empuja", "me empujan", "me lastimo", "me lastimaron", "me lastime",
    "me pateo", "me patearon", "patadas", "puñete", "puñetes", "puñetazo", "cachetada",
    "bofetada", "me jalaron el pelo", "me jalo el cabello", "me tiraron al piso",
    "me tiro al suelo", "me metieron cabe", "agresion fisica", "violencia fisica",
    "volver a agredirme", "vuelvan a agredirme", "miedo de que me peguen",
    "miedo de que me golpeen", "amenazando fisicamente", "me amenazan fisicamente",
    "me escupieron", "me lanzan cosas", "me tiran papeles", "me encerraron en el baño"
  ],

  // 4.7 Amenazas, intimidación, extorsión y miedo en el colegio/recreo
  threatsIntimidation: [
    "me amenazaron", "me amenaza", "me amenazan", "me estan amenazando",
    "amenazan al salir del colegio", "me esperan a la salida", "me espera a la salida",
    "me intimida", "me intimidan", "intimidacion", "me chantajea", "me chantajean",
    "chantaje", "extorsion", "me quitan mi propina", "me quitan mi lonchera",
    "me roban mis cosas", "me esconden mi mochila", "rompieron mis cuadernos",
    "miedo durante el recreo", "miedo en el recreo", "inseguro en mi colegio",
    "insegura en mi colegio", "miedo de ir al colegio", "no quiero ir al colegio por miedo",
    "me acorralan", "me persiguen"
  ],

  // 4.8 Ciberacoso y violencia digital
  cyberbullying: [
    "ciberacoso", "ciberbullying", "acoso virtual", "por internet", "en redes", "redes sociales",
    "whatsapp", "instagram", "tiktok", "facebook", "discord", "telegram", "juego online",
    "grupo de chat", "grupo del salon", "chat del salon", "publicaron fotografias mias",
    "publicaron fotos mias", "publicaron fotos sin permiso", "subieron fotos mias",
    "subieron un video mio", "grabaron sin permiso", "memes de mi", "stickers mios",
    "cuenta falsa", "perfil falso", "se hacen pasar por mi", "suplantacion",
    "amenazan por mensajes", "insultan por mensajes", "mensajes ofensivos",
    "difunden informacion privada", "publicaron mi numero", "doxeo"
  ],

  // 4.9 Discriminación (racismo, xenofobia, discapacidad, origen, género/LGBTIQ+, aspecto)
  discrimination: [
    "discriminan", "discriminacion", "racismo", "racistas", "xenofobia",
    "por mi color de piel", "por mi piel", "por ser negro", "por ser moreno", "por ser cholo",
    "por ser de provincia", "por ser de la sierra", "por ser de la selva", "por mi acento",
    "por mi forma de hablar", "por ser extranjero", "por ser venezolano", "por mi nacionalidad",
    "por mi religion", "por mi discapacidad", "por usar silla de ruedas", "por usar lentes",
    "por tener autismo", "por tener tdah", "por mi orientacion sexual", "por ser gay",
    "por ser lesbiana", "por ser trans", "homofobia", "por no tener dinero", "por ser pobre"
  ],

  // 4.10 Rumores, difamación y chismes
  rumorsGossip: [
    "inventan rumores", "difunden rumores", "rumores sobre mi", "chismes sobre mi",
    "inventan chismes", "hablan mal de mi", "hablan a mis espaldas", "dicen mentiras de mi",
    "inventaron que yo", "me culpan de algo que no hice", "me acusan sin pruebas",
    "difamacion", "arruinan mi reputacion", "ponen a todos en mi contra"
  ],

  // 4.11 Exclusión social y aislamiento escolar
  socialExclusion: [
    "me excluyen", "excluyen de los grupos", "nadie quiere trabajar conmigo",
    "nadie hace grupo conmigo", "me quedo sin grupo", "me dejan fuera", "me dejan de lado",
    "no me incluyen", "no me invitan", "me ignoran", "me hacen la ley del hielo",
    "nadie me habla en el salon", "nadie se sienta conmigo", "me aislan", "me apartan",
    "en el recreo paro solo", "en el recreo estoy sola"
  ],

  // 4.12 Apodos ofensivos, insultos y humillaciones públicas
  nicknamesHumiliation: [
    "ponen apodos", "pusieron un apodo", "me apodan", "apodos por mi apariencia",
    "burlan de mi delante de toda la clase", "burlan de mi en clase", "se burlan de mi",
    "se burla de mi", "se rien de mi", "se rie de mi", "me insulta", "me insultan",
    "insultos", "me humilla", "me humillan", "humillaciones", "me ridiculizan",
    "me hacen quedar mal", "burlas por mi cuerpo", "burlas por mi peso", "me dicen gordo",
    "me dicen gorda", "me dicen feo", "me dicen fea", "me dicen bruto", "me dicen tonto"
  ],

  // 4.13 Bullying y acoso escolar general (molestias repetidas)
  bullyingGeneral: [
    "bullying", "acoso escolar", "me estan acosando", "me acosa", "me acosan",
    "me hostiga", "me hostigan", "me molesta", "me molestan", "no deja de molestarme",
    "me tratan mal", "me trata mal", "se meten conmigo", "se la agarran conmigo",
    "me agarran de punto", "me hacen la vida imposible"
  ],

  // 4.14 Soledad, tristeza, inseguridad emocional y vergüenza de pedir ayuda
  lonelinessEmotional: [
    "estoy solo", "estoy sola", "me siento solo", "me siento sola", "soledad",
    "no tengo amigos", "no tengo amigas", "nadie me escucha", "no tengo con quien hablar",
    "no tengo a quien contarle", "siento que no le importo a nadie", "no le importo a nadie",
    "nadie me entiende", "nadie me comprende", "soy invisible", "estoy muy triste",
    "me siento triste", "tengo ganas de llorar", "lloro todos los dias",
    "me da verguenza pedir ayuda", "verguenza contar", "miedo de contar", "miedo a que no me crean"
  ],

  // 4.15 Problemas de amistad, peleas entre pares y presión de grupo
  peerConflictFriendship: [
    "discuti con mi amigo", "discuti con mi amiga", "pelee con mi amigo", "pelee con mi amiga",
    "pelee con mi mejor amiga", "pelee con mi mejor amigo", "mi amiga se enojo conmigo",
    "mi amigo se enojo conmigo", "problemas con mis amigos", "amistad toxica",
    "mis amigos me presionan", "presion de grupo", "me obligan a hacer cosas para encajar",
    "mi amigo cambio conmigo", "mi mejor amiga me traiciono", "conflicto con un compañero"
  ],

  // 4.16 Cómo apoyar a un amigo/compañero o actuar como testigo
  helpingFriendWitness: [
    "quiero ayudar a mi amiga", "quiero ayudar a mi amigo", "ayudar a un amigo",
    "ayudar a una amiga", "ayudar a un compañero", "ayudar a una compañera",
    "quiero ayudar a alguien", "a mi amigo le hacen bullying", "a mi amiga la molestan",
    "veo que molestan a", "soy testigo", "vi que golpearon a", "como apoyar a un amigo",
    "mi amiga sufre acoso", "mi amigo sufre bullying", "mi amiga esta muy triste"
  ],

  // 4.17 Cómo pedir ayuda a un adulto de confianza
  howToAskHelp: [
    "adulto de confianza", "como pedir ayuda", "a quien le cuento", "a quien acudir",
    "no se como decirle a mis padres", "como le cuento a mi mama", "como hablar con el tutor",
    "me cuesta pedir ayuda", "necesito ayuda para pensar en un adulto"
  ],

  // 4.18 Consultas informativas / educativas sobre qué es el bullying
  educationalInfo: [
    "que es el bullying", "que es bullying", "que significa bullying", "tipos de bullying",
    "como reconocer el bullying", "como saber si es bullying", "que es el acoso escolar",
    "que es el ciberacoso", "aprender sobre bullying", "diferencia entre broma y bullying"
  ]
};

// -----------------------------------------------------------------------------
// 5. ANÁLISIS DEL CONTEXTO RECIENTE Y DETECCIÓN DE PARÁMETROS
// -----------------------------------------------------------------------------
function analyzeContext(messages = []) {
  const userMessages = messages.filter(m => m.role === "user").map(m => m.content);
  const assistantMessages = messages.filter(m => m.role === "assistant").map(m => m.content);

  const currentRaw = userMessages[userMessages.length - 1] || "";
  const currentText = normalize(currentRaw);
  const previousUserMessages = userMessages.slice(-5, -1);
  const previousText = normalize(previousUserMessages.join(" "));
  const recentText = normalize(userMessages.slice(-5).join(" "));

  // 5.1 Lugar donde ocurre
  let location = "unspecified";
  if (includesAny(currentText, ["internet", "redes", "whatsapp", "instagram", "tiktok", "facebook", "chat", "mensaje", "mensajes", "online", "virtual"])) {
    location = "online";
  } else if (includesAny(currentText, ["casa", "hogar", "familia", "padres", "papa", "mama", "cuarto"])) {
    location = "home";
  } else if (includesAny(currentText, ["colegio", "escuela", "clase", "salon", "recreo", "patio", "salida del colegio", "baño del colegio", "bus escolar"])) {
    location = "school";
  } else if (includesAny(previousText, ["internet", "redes", "whatsapp", "instagram", "tiktok"])) {
    location = "online";
  } else if (includesAny(previousText, ["casa", "hogar", "familia", "padres"])) {
    location = "home";
  } else if (includesAny(previousText, ["colegio", "clase", "salon", "recreo"])) {
    location = "school";
  }

  // 5.2 Quién está involucrado (sin exigir ni inventar nombres)
  let actorRole = "unspecified";
  if (includesAny(currentText, SIGNALS.familyActors)) {
    actorRole = "family";
  } else if (includesAny(currentText, SIGNALS.authorityActors)) {
    actorRole = "authority";
  } else if (includesAny(currentText, ["amigo", "amiga", "mejor amigo", "mejor amiga"])) {
    actorRole = "friend";
  } else if (includesAny(currentText, ["compañero", "compañera", "compañeros", "chico", "chica", "chicos", "chicas", "grupo", "salon", "clase"])) {
    actorRole = "peers";
  } else if (includesAny(currentText, ["adulto", "persona mayor", "señor", "señora", "vecino"])) {
    actorRole = "adult";
  }

  // 5.3 Frecuencia (hecho repetido vs. hecho puntual)
  let frequency = "unspecified";
  if (includesAny(currentText, ["todos los dias", "siempre", "cada dia", "a diario", "todo el tiempo", "no deja de", "no dejan de", "desde hace meses", "desde hace semanas", "constantemente", "otra vez", "sigue", "siguen", "vuelve a"])) {
    frequency = "repeated";
  } else if (includesAny(currentText, ["hoy paso", "ayer paso", "una vez", "por primera vez", "acaba de pasar", "recien paso"])) {
    frequency = "isolated";
  } else if (includesAny(previousText, ["todos los dias", "siempre", "constantemente", "no deja de"])) {
    frequency = "repeated";
  }

  // 5.4 ¿El estudiante solicita pasos directos ("¿qué hago?", "dime qué hacer")?
  const asksDirectAction =
    includesAny(currentText, [
      "que hago", "que debo hacer", "que puedo hacer", "no se que hacer",
      "como lo soluciono", "como hago para que pare", "como actuar", "dame consejos",
      "que me recomiendas", "orientame", "necesito orientacion", "como le digo",
      "que le digo", "a quien acudo", "a quien le cuento", "como pido ayuda"
    ]) || /\b(?:que|como)\s+(?:hago|actuo|procedo|respondo)\b/.test(currentText);

  // 5.5 Nombre propio mencionado (solo si es explícito y seguro)
  const currentName = extractPersonName(currentRaw);
  const recentName = currentName || findRecentPersonName(userMessages.slice(-4));

  return {
    userMessages,
    assistantMessages,
    currentRaw,
    currentText,
    previousText,
    recentText,
    location,
    actorRole,
    frequency,
    asksDirectAction,
    currentName,
    recentName,
    turnCount: userMessages.length
  };
}

// -----------------------------------------------------------------------------
// 6. CLASIFICADOR JERÁRQUICO DE INTENCIONES Y PRIORIDAD DE RIESGOS
// -----------------------------------------------------------------------------
function classifyIntent(ctx) {
  const { currentText, previousText, recentText, actorRole, location } = ctx;

  // 6.0 Comprobar negaciones explícitas de autolesión ("no quiero matarme, solo estoy triste")
  const explicitlyDeniesSelfHarm =
    /\bno\s+(?:quiero|pienso|voy a|intento)\s+(?:quitarme la vida|suicidarme|matarme|morir|hacerme daño|lastimarme)\b/.test(
      currentText
    );

  // ---------------------------------------------------------------------------
  // NIVEL 1: PROTOCOLOS DE MÁXIMA PRIORIDAD (EVALUADOS SOBRE MENSAJE ACTUAL)
  // ---------------------------------------------------------------------------

  // 1A. Violencia sexual, violación, abuso sexual, lesiones íntimas o grooming
  if (
    includesAny(currentText, SIGNALS.sexualAssaultUrgent) ||
    includesAny(currentText, SIGNALS.sexualGroomingCoercion) ||
    (includesAny(currentText, ["violar*", "abuso sexual*", "tocamiento*", "partes intimas", "zona intima", "fotos intimas"]) &&
      !includesAny(currentText, ["que es", "definicion"]))
  ) {
    const isAuthority =
      actorRole === "authority" || includesAny(currentText, SIGNALS.authorityActors);
    const isFamily =
      actorRole === "family" || includesAny(currentText, SIGNALS.familyActors);
    const isPhysicalInjuryOrObject = includesAny(currentText, [
      "objeto", "escoba", "forza*", "fuerza", "ano", "vagina", "sangr*", "lastim*", "duel*", "violaron", "violo", "penetr*"
    ]);
    const isDigitalSexual = includesAny(currentText, [
      "foto*", "fotografia*", "video*", "pack", "enviar", "redes", "internet", "mensaje*"
    ]);

    return {
      category: "sexual_violence_protocol",
      priority: 100,
      subType: isPhysicalInjuryOrObject
        ? "assault_medical_urgent"
        : isDigitalSexual
        ? "grooming_or_sextortion"
        : "sexual_abuse_general",
      aggressorContext: isFamily ? "family" : isAuthority ? "authority" : "other"
    };
  }

  // 1B. Crisis de autolesión o ideación suicida
  if (!explicitlyDeniesSelfHarm && includesAny(currentText, SIGNALS.selfHarmCrisis)) {
    return {
      category: "self_harm_crisis",
      priority: 99,
      subType: "suicide_or_self_harm"
    };
  }

  // 1C. Peligro físico inmediato o emergencia activa
  if (includesAny(currentText, SIGNALS.immediateDanger)) {
    return {
      category: "immediate_danger",
      priority: 98,
      subType: location === "home" || actorRole === "family" ? "danger_at_home" : "danger_general"
    };
  }

  // ---------------------------------------------------------------------------
  // NIVEL 2: INTERACCIONES CONVERSACIONALES CORTAS (SALUDOS, GRACIAS, CIERRE)
  // Se evalúan antes de arrastrar temas viejos para que "Gracias por escucharme"
  // reciba una respuesta cálida de cierre y no repita el bloque de crisis anterior.
  // ---------------------------------------------------------------------------
  const wordCount = currentText.split(" ").filter(Boolean).length;

  if (
    wordCount <= 8 &&
    includesAny(currentText, ["gracias", "muchas gracias", "te lo agradezco", "gracias por escucharme", "gracias por ayudarme", "me ayudaste mucho", "gracias lumy"])
  ) {
    return { category: "gratitude_closing", priority: 20, subType: "thanks" };
  }

  if (
    wordCount <= 6 &&
    /^(?:hola|holi|hey|buenas|buenos dias|buenas tardes|buenas noches|que tal|hola lumy)\b/.test(currentText) &&
    !includesAny(currentText, ["molesta*", "pega*", "golpea*", "triste", "solo", "sola", "miedo", "ayuda", "bullying", "acoso"])
  ) {
    return { category: "greeting", priority: 15, subType: "hello" };
  }

  if (
    wordCount <= 6 &&
    includesAny(currentText, ["adios", "chao", "chau", "hasta luego", "nos vemos", "me voy", "bye"])
  ) {
    return { category: "farewell", priority: 15, subType: "goodbye" };
  }

  // ---------------------------------------------------------------------------
  // NIVEL 3: SITUACIONES ESPECÍFICAS EN EL MENSAJE ACTUAL
  // ---------------------------------------------------------------------------

  // 3A. Apoyo a un amigo/compañero o testigo de violencia (prioridad sobre bullying propio
  // para que "Quiero ayudar a mi amiga que sufre bullying" no se confunda con bullying propio)
  if (
    includesAny(currentText, SIGNALS.helpingFriendWitness) ||
    (includesAny(currentText, ["mi amigo", "mi amiga", "un compañero", "una compañera", "a un chico", "a una chica"]) &&
      includesAny(currentText, ["ayudar*", "apoyar*", "defender*", "le hacen", "la molestan", "lo molestan", "le pegan", "sufre", "llorando"]))
  ) {
    return { category: "helping_friend", priority: 85, subType: "peer_support" };
  }

  // 3B. Violencia familiar y maltrato en casa
  if (
    includesAny(currentText, SIGNALS.familyViolenceDirect) ||
    (actorRole === "family" &&
      includesAny(currentText, [
        "golpea*", "pega*", "amenaza*", "humilla*", "insulta*", "grita*", "miedo", "castiga*", "maltrata*", "violencia"
      ]))
  ) {
    return { category: "family_violence", priority: 90, subType: "domestic_abuse" };
  }

  // 3C. Problemas, abuso de autoridad o intimidación por profesores / adultos del colegio
  if (
    includesAny(currentText, SIGNALS.authorityAbuseDirect) ||
    (actorRole === "authority" &&
      includesAny(currentText, [
        "intimida*", "humilla*", "grita*", "insulta*", "burla*", "amenaza*", "acosa*",
        "molesta*", "miedo", "incomodo", "incomoda", "trata mal", "injust*"
      ]))
  ) {
    return { category: "authority_problem", priority: 88, subType: "teacher_intimidation" };
  }

  // 3D. Violencia física escolar
  if (includesAny(currentText, SIGNALS.physicalViolence)) {
    return { category: "physical_violence", priority: 86, subType: "school_aggression" };
  }

  // 3E. Ciberacoso y problemas digitales
  if (
    includesAny(currentText, SIGNALS.cyberbullying) &&
    (includesAny(currentText, [
      "foto*", "fotografia*", "video*", "cuenta falsa", "perfil falso", "amenaza*", "burla*",
      "insulta*", "molesta*", "acoso", "ciberacoso", "ciberbullying", "difund*", "publica*",
      "privad*", "presion*", "meme*", "sticker*", "mensaje*"
    ]) ||
      location === "online")
  ) {
    const isPhotoOrPrivacy = includesAny(currentText, [
      "foto*", "fotografia*", "video*", "privad*", "permiso", "presion*"
    ]);
    const isFakeAccount = includesAny(currentText, ["cuenta falsa", "perfil falso", "suplant*"]);
    return {
      category: "cyberbullying",
      priority: 82,
      subType: isPhotoOrPrivacy ? "privacy_photos" : isFakeAccount ? "fake_account" : "online_harassment"
    };
  }

  // 3F. Amenazas, intimidación o miedo en el recreo / salida
  if (includesAny(currentText, SIGNALS.threatsIntimidation)) {
    return {
      category: "threats_intimidation",
      priority: 84,
      subType: includesAny(currentText, ["recreo", "salir", "salida", "insegur*"])
        ? "school_fear"
        : "direct_threat"
    };
  }

  // 3G. Discriminación
  if (includesAny(currentText, SIGNALS.discrimination)) {
    return { category: "discrimination", priority: 80, subType: "prejudice_exclusion" };
  }

  // 3H. Rumores, chismes y difamación
  if (includesAny(currentText, SIGNALS.rumorsGossip)) {
    return { category: "rumors_gossip", priority: 78, subType: "false_rumors" };
  }

  // 3I. Exclusión social y aislamiento en grupos
  if (includesAny(currentText, SIGNALS.socialExclusion)) {
    return { category: "social_exclusion", priority: 76, subType: "group_exclusion" };
  }

  // 3J. Insultos, apodos ofensivos y humillaciones
  if (includesAny(currentText, SIGNALS.nicknamesHumiliation)) {
    const byAppearance = includesAny(currentText, [
      "apariencia", "cuerpo", "peso", "gord*", "flac*", "fe*", "nariz", "pelo", "altura", "bajit*", "aspecto", "cara"
    ]);
    const inPublic = includesAny(currentText, ["delante de", "toda la clase", "todos", "publico", "salon"]);
    return {
      category: "nicknames_humiliation",
      priority: 75,
      subType: byAppearance ? "appearance_mockery" : inPublic ? "public_humiliation" : "verbal_insults"
    };
  }

  // 3K. Conflictos entre amigos o presión de grupo
  if (includesAny(currentText, SIGNALS.peerConflictFriendship)) {
    const isPeerPressure = includesAny(currentText, ["presion*", "obligan a", "para encajar"]);
    return {
      category: "peer_conflict",
      priority: 72,
      subType: isPeerPressure ? "peer_pressure" : "friendship_dispute"
    };
  }

  // 3L. Bullying y acoso escolar general
  if (includesAny(currentText, SIGNALS.bullyingGeneral)) {
    return { category: "bullying_general", priority: 74, subType: "repeated_harassment" };
  }

  // 3M. Soledad, tristeza, bienestar emocional y vergüenza de pedir ayuda
  if (includesAny(currentText, SIGNALS.lonelinessEmotional)) {
    const isShameOrFearToSpeak = includesAny(currentText, [
      "verguenza", "miedo de contar", "miedo a que no me crean", "no se como pedir ayuda"
    ]);
    return {
      category: "loneliness_emotional",
      priority: 70,
      subType: isShameOrFearToSpeak ? "fear_to_ask_help" : "loneliness"
    };
  }

  // 3N. Cómo pedir ayuda o identificar a un adulto de confianza
  if (includesAny(currentText, SIGNALS.howToAskHelp)) {
    return { category: "how_to_ask_help", priority: 68, subType: "trusted_adult_guide" };
  }

  // 3O. Consultas informativas sobre qué es el bullying / ciberacoso
  if (includesAny(currentText, SIGNALS.educationalInfo)) {
    return { category: "educational_info", priority: 65, subType: "concept_explanation" };
  }

  // ---------------------------------------------------------------------------
  // NIVEL 4: RESOLUCIÓN CONTEXTUAL MULTI-TURNO
  // Si el estudiante envía un mensaje de seguimiento ("¿Y qué hago si no me creen?",
  // "Pasa todos los días en el recreo", "Tengo miedo de decirlo", "Es de mi salón"),
  // heredamos el contexto de los últimos mensajes de la conversación.
  // ---------------------------------------------------------------------------
  if (previousText) {
    const contextFollowUp = classifyIntent({
      ...ctx,
      currentText: recentText,
      previousText: ""
    });
    if (contextFollowUp.category !== "general_orientation") {
      return {
        ...contextFollowUp,
        isContextualFollowUp: true
      };
    }
  }

  // Si pregunta directamente "¿qué hago?" sin contexto previo específico
  if (ctx.asksDirectAction) {
    return { category: "how_to_ask_help", priority: 60, subType: "direct_action_request" };
  }

  return { category: "general_orientation", priority: 10, subType: "open_listening" };
}

// -----------------------------------------------------------------------------
// 7. MOTOR DE SELECCIÓN DETERMINISTA CON MEMORIA ANTI-REPETICIÓN
// -----------------------------------------------------------------------------
let responseCounter = 0;

function hashText(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickVariant(options = [], seed = "", salt = "", previousAssistantText = "") {
  if (!Array.isArray(options) || options.length === 0) return "";
  const baseIndex = hashText(`${seed}|${salt}`) % options.length;
  for (let offset = 0; offset < options.length; offset += 1) {
    const candidate = options[(baseIndex + offset) % options.length];
    if (!previousAssistantText || !previousAssistantText.includes(candidate)) {
      return candidate;
    }
  }
  return options[baseIndex];
}

// -----------------------------------------------------------------------------
// 8. BANCOS MODULARES DE RESPUESTAS (6 A 10 VARIANTES POR COMPONENTE)
// -----------------------------------------------------------------------------
const RESPONSE_BANKS = {
  // 8.1 PROTOCOLO ESPECIAL: VIOLENCIA SEXUAL Y ABUSO (10 PUNTOS OBLIGATORIOS)
  sexual_violence_protocol: {
    recognitionAndNoBlame: [
      "Lo que me estás contando es sumamente grave e importante. Quiero decirte con total claridad que nada de lo ocurrido es tu culpa: ninguna persona tiene derecho a tocar tu cuerpo, forzarte ni cruzar tus límites sin tu consentimiento.",
      "Gracias por tener la valentía de expresar algo tan delicado. Lo que describes es una agresión grave y jamás es responsabilidad de quien la sufre; tú no hiciste nada malo y mereces protección inmediata.",
      "Te escucho con total respeto y sin juzgarte. Lo que mencionas es muy serio y quiero que tengas la seguridad de que la culpa nunca es tuya, sin importar quién sea la persona ni lo que te haya dicho.",
      "Siento profundamente que hayas pasado por una situación tan grave. Nadie, bajo ninguna circunstancia, tiene permiso para lastimarte ni obligarte a algo sexual; tú no tienes la culpa de lo sucedido.",
      "Lo que relatas es una situación grave que vulnera tu integridad. No estás exagerando ni tienes por qué cargar con culpa o vergüenza: la responsabilidad es únicamente de quien cometió la agresión.",
      "Quiero que sepas que te creo y que tomo muy en serio lo que dices. Es un hecho grave, no es tu culpa en ningún sentido y tienes derecho a recibir cuidado, protección y ayuda segura ahora mismo."
    ],
    medicalAndSafetyUrgent: [
      "Tu salud y tu seguridad física son lo primero: si sufriste una agresión física reciente, tienes dolor o alguna lesión en una zona íntima, es fundamental que recibas atención médica urgente en el centro de salud u hospital más cercano (en Perú, todos los establecimientos del MINSA entregan atención de emergencia gratuita). Si estás en peligro en este instante, aléjate hacia un lugar donde haya otras personas y pide auxilio inmediato.",
      "Por favor prioriza tu bienestar físico ahora mismo: si hay dolor, lesión o fue una agresión reciente, acude cuanto antes a un hospital o centro de salud con un adulto protector para que personal médico te revise con cuidado. Si sientes que corres peligro inmediato, sal hacia un espacio seguro acompañado y comunícate con emergencias.",
      "Es muy importante cuidar tu cuerpo y tu seguridad: ante cualquier lesión íntima, dolor o contacto forzado reciente, necesitas valoración médica urgente por personal de salud, incluso si te da temor o vergüenza. Nunca intentes resolver una lesión por tu cuenta ni te quedes a solas cerca de quien te lastimó.",
      "Lo más urgente en este momento es que estés en un lugar seguro y recibas atención médica inmediata si hubo fuerza física, dolor o lesiones. Un médico o centro de salud sabrá atenderte con reserva y cuidado; no enfrentes nunca a la persona agresora por tu cuenta.",
      "Tu protección inmediata es prioritaria: aléjate de cualquier espacio donde puedas volver a quedar a solas con esa persona y busca atención médica de urgencia si el hecho fue reciente o sientes malestar físico. No tienes que pasar por esto en soledad.",
      "Ante una agresión de este tipo, lo primordial es resguardar tu vida y tu salud física: busca un entorno seguro lejos del agresor y acude con urgencia a un servicio médico para recibir atención integral y preventiva."
    ],
    trustedAdultByContext: {
      family: [
        "Como la persona involucrada forma parte de tu entorno familiar o de tu casa, busca de inmediato a otro adulto seguro que no esté implicado y que sí pueda protegerte (como otro familiar de confianza, tu tutor o psicólogo del colegio, o personal de un centro de salud).",
        "Si quien te hizo daño vive contigo o es un familiar, no guardes silencio: acude hoy mismo a una persona adulta fuera de esa situación —como un docente, orientador escolar, vecina de confianza o autoridad de protección— que pueda ponerte a salvo."
      ],
      authority: [
        "Si la persona implicada es un profesor o adulto del colegio, recuerda que su autoridad no le da ningún derecho sobre ti. Acude de inmediato a tu mamá, papá, familiar cercano o a otra autoridad segura que no esté involucrada para que te protejan y no vuelvas a quedar a solas con esa persona.",
        "Cuando el agresor es un adulto de la escuela, nunca debes quedarte a solas con él ni aceptar guardar secretos. Cuéntaselo enseguida a tu familia o a un adulto protector fuera de ese vínculo para que activen tu protección inmediata."
      ],
      other: [
        "Busca ahora mismo a un adulto de tu entera confianza que pueda protegerte y acompañarte, como tu mamá, tu papá, un familiar cercano, tu tutora o el psicólogo de tu colegio.",
        "Acércate hoy mismo a una persona adulta segura que no esté implicada en lo ocurrido —un familiar protector, docente de confianza u orientador escolar— para que no tengas que cargar con esto a solas."
      ]
    },
    privacyAndSimplePhrase: [
      "No necesitas contarme detalles íntimos ni responder preguntas sobre tu cuerpo aquí, y tampoco tienes que sentirte presionado a hacer una denuncia formal antes de estar protegido y recibir atención médica. Para pedir ayuda hoy mismo a un adulto de confianza, puedes decirle o mostrarle esta frase: «Me pasó algo grave con una persona, tengo miedo y necesito que me protejas y me lleves al médico sin hacerme sentir culpable».",
      "Recuerda que soy un sistema de orientación y no reemplazo la atención médica ni psicológica profesional; además, no hace falta que escribas detalles íntimos en el chat para merecer ayuda. Cuando hables con el adulto de confianza que elijas, puedes leerle esto: «Alguien cruzó mis límites sin mi consentimiento, no me siento bien y necesito tu apoyo y protección ahora mismo».",
      "Aquí nunca te pediré descripciones gráficas ni detalles privados, y nadie debe presionarte antes de garantizar tu seguridad y tu salud. Si te cuesta encontrar las palabras frente a un adulto seguro, muéstrale este mensaje o dile: «Necesito contarte algo muy delicado que me hicieron; por favor escúchame con calma y ayúdame a estar a salvo».",
      "No tienes obligación de relatar detalles íntimos en este chat ni de enfrentar a quien te agredió; primero está tu resguardo físico y emocional con profesionales reales. Puedes iniciar la conversación con un adulto protector diciendo simplemente: «Alguien me lastimó y me hizo daño sin mi permiso; necesito que me acompañes y me cuides».",
      "Tranquilo: no necesitas dar más detalles íntimos por aquí ni apresurarte a trámites antes de recibir resguardo y cuidado médico. Para romper el silencio con una persona adulta segura, puedes escribirle en un papel o por mensaje: «Pasó algo muy grave que no es mi culpa y necesito ayuda urgente de un adulto en quien confío».",
      "Tu privacidad y tranquilidad emocional son sagradas: no hace falta que expliques detalles físicos aquí. Lo esencial es que un adulto protector te acompañe ya; puedes decirle: «Me sucedió algo grave que me da miedo contar, por favor acompáñame a recibir ayuda médica y protección»."
    ],
    groomingSpecificAdvice: [
      "Lo que describes sobre el pedido o presión de fotografías íntimas o amenazas para callar es una forma grave de abuso y coacción: nunca envíes imágenes ni cedas a chantajes, porque tú no tienes la culpa.",
      "Que un adulto o cualquier persona te pida fotos íntimas, te haga comentarios sexuales o te amenace para guardar silencio es un delito y una forma de violencia sexual; no tienes por qué obedecer ni sentir vergüenza."
    ]
  },

  // 8.2 PROTOCOLO INDEPENDIENTE: RIESGO DE AUTOLESIÓN O SUICIDIO
  self_harm_crisis: {
    openings: [
      "Siento muchísimo que estés sintiendo un dolor tan grande en este momento. Quiero que sepas que tu vida tiene un valor inmenso y que no tienes que atravesar esta oscuridad en soledad.",
      "Gracias por confiar y expresar lo que estás sintiendo. Sé que ahora mismo todo puede parecer insoportable, pero lo que te pasa importa de verdad y mereces recibir apoyo real hoy mismo.",
      "Te leo con mucho respeto y cuidado. Sentirse así de abrumado duele profundamente, pero no estás solo y existen personas preparadas para acompañarte y ayudarte a aliviar este peso.",
      "Lamento de corazón que estés pasando por un momento tan difícil. Aunque ahora sientas que no hay salida, este dolor se puede atender con ayuda humana y profesional; tu bienestar es lo más importante.",
      "Qué importante que hayas puesto en palabras lo que sientes en lugar de callarlo. No eres una carga para nadie y mereces estar a salvo y acompañado en este instante.",
      "Escucho cuánto estás sufriendo ahora mismo. Por favor no te quedes a solas con estos pensamientos: tu vida importa muchísimo y hay apoyo seguro disponible para ti."
    ],
    safetyAction: [
      "Como soy un chatbot educativo, no puedo sustituir la ayuda de un profesional ni protegerte físicamente, por eso te pido que des un paso inmediato: aléjate de cualquier objeto con el que puedas lastimarte, sal a un espacio donde haya otras personas y busca ahora mismo a un adulto de confianza (un familiar, docente, tutor o vecino seguro).",
      "En este momento lo primordial es mantenerte a salvo: no te quedes encerrado ni a solas, acércate enseguida a una persona adulta en quien confíes y dile con claridad que no te sientes seguro contigo mismo y que necesitas compañía.",
      "Tu seguridad hoy no puede esperar: deja cualquier cosa que pueda hacerte daño, busca la compañía inmediata de un familiar, profesor, orientador o adulto protector y permíteles ayudarte a contactar a un profesional de salud.",
      "Por favor prioriza tu vida en este instante: ve junto a una persona adulta segura de tu entorno y pídele que se quede contigo y te lleve a recibir apoyo médico o psicológico de urgencia.",
      "Necesitas el acompañamiento de una persona real ahora mismo: acude a un adulto de confianza en casa o en el colegio y muéstrale lo que escribiste si te cuesta hablar en voz alta.",
      "No tienes que explicar todo lo que sientes de golpe; basta con que te acerques ahora mismo a un adulto seguro y le digas: «Me siento muy mal, tengo pensamientos de hacerme daño y necesito que me acompañes hoy»."
    ]
  },

  // 8.3 PROTOCOLO INDEPENDIENTE: PELIGRO INMEDIATO Y AYUDA URGENTE
  immediate_danger: {
    openings: [
      "Tu seguridad física en este momento es la prioridad absoluta. Si sientes que estás en peligro o que pueden hacerte daño ahora mismo, no esperes a resolverlo por este chat.",
      "Te leo y lo más importante ahora mismo es que te pongas a salvo. Nadie tiene derecho a golpearte, encerrarte ni amenazarte.",
      "Esta es una situación de urgencia y tu protección va primero que cualquier otra cosa. No intentes enfrentar a quien te amenaza ni quedarte a solas.",
      "Lamento mucho que estés viviendo este momento de temor. Tu integridad es lo principal y necesitas resguardo inmediato de personas reales.",
      "Escucho que no te sientes a salvo ahora mismo y quiero darte pasos directos para protegerte de inmediato.",
      "Si estás corriendo riesgo en este instante, actúa primero para resguardar tu seguridad física antes de seguir escribiendo."
    ],
    urgentSteps: [
      "Si puedes hacerlo sin aumentar el riesgo, aléjate de inmediato hacia un lugar iluminado o donde haya otras personas (la dirección del colegio, la casa de un familiar o vecino seguro, una tienda o una comisaría) y pide ayuda en voz alta a un adulto de confianza.",
      "No te quedes a solas: busca enseguida a un adulto protector cercano —un docente, director, familiar seguro, sereno o policía— y dile claramente: «Estoy en peligro ahora mismo y necesito que me protejan».",
      "Si estás en el colegio, dirígete directo a Tutoría, Dirección o donde haya varios profesores; si estás en la calle o en casa y hay agresión activa, sal a un sitio seguro con vecinos de confianza o comunícate de inmediato con los servicios de emergencia.",
      "Prioriza salir de la zona de riesgo sin confrontar a la persona agresora. Acércate a adultos que puedan resguardarte físicamente en este momento y llama a los teléfonos de emergencia.",
      "Si no puedes salir del lugar donde estás, comunícate de inmediato por teléfono o mensaje con un familiar seguro o con la central de emergencias indicando dónde te encuentras para que acudan a ayudarte.",
      "Recuerda que Lumy es una herramienta de orientación y no puede acudir físicamente: busca compañía adulta inmediata y activa la ayuda de emergencia de tu localidad."
    ]
  },

  // 8.4 VIOLENCIA FAMILIAR Y PROBLEMAS EN EL HOGAR
  family_violence: {
    openings: [
      "Siento mucho que estés viviendo agresiones o miedo dentro de tu propia casa.",
      "Gracias por animarte a contar algo tan difícil; lo que pasa en tu familia merece atención y cuidado.",
      "Te escucho con mucho respeto. Tener miedo de volver a casa o sufrir maltrato de familiares es una carga muy dura.",
      "Lamento profundamente que las personas adultas de tu hogar te estén tratando de esa manera.",
      "Es muy valiente de tu parte hablar sobre lo que ocurre en tu familia; no tienes por qué callarlo.",
      "Comprendo que te sientas atrapado o asustado cuando el problema ocurre en tu propio hogar."
    ],
    validations: [
      "Quiero que tengas muy claro que ningún golpe, amenaza ni humillación constante está justificado como forma de crianza o castigo. Tú no tienes la culpa.",
      "La casa debería ser un lugar seguro para ti; la violencia física o psicológica de los padres o familiares vulnera tus derechos y nunca es responsabilidad tuya.",
      "Mereces crecer en un ambiente libre de golpes, gritos e insultos. Que sean tus padres o familiares no les da derecho a lastimarte.",
      "Es totalmente comprensible que sientas miedo o confusión, pero no tienes que soportar maltratos en silencio por tratarse de tu familia.",
      "Tus derechos como estudiante y menor de edad te protegen también dentro de tu hogar; pedir ayuda externa es legítimo y necesario.",
      "No eres un mal hijo ni estás traicionando a tu familia por buscar protección cuando te lastiman o te amenazan."
    ],
    actions: [
      "Busca apoyo en un adulto seguro fuera de ese conflicto: puedes hablar hoy mismo con tu tutora, el psicólogo del colegio, el responsable de Convivencia Escolar o un familiar cercano que sí te proteja (como una tía o abuelos de confianza).",
      "Si hoy tienes miedo de regresar a tu casa porque pueden golpearte, avísale antes de la hora de salida a tu tutor, psicólogo escolar o director para que activen el protocolo de protección con las autoridades.",
      "No intentes enfrentar físicamente a un adulto enojado en casa. Si empieza una agresión, resguárdate en un lugar seguro y pide ayuda a otro familiar, vecino de confianza o institución de protección infantil.",
      "Puedes contarle lo que ocurre a un docente u orientador del colegio diciendo: «En mi casa me están golpeando / amenazando, tengo miedo de volver y necesito que me ayuden a buscar protección».",
      "Además del colegio, recuerda que existen defensorías y líneas especializadas gratuitas que protegen a niñas, niños y adolescentes cuando sufren violencia en su propio hogar.",
      "Si tienes marcas, golpes o amenazas recientes, muéstraselas o cuéntaselas al responsable de tutoría o a la DEMUNA de tu distrito para que intervengan por tu seguridad."
    ],
    questions: [
      "¿En este momento estás en el colegio o en un lugar donde te sientes a salvo?",
      "¿Hay algún familiar fuera de tu casa o algún profesor de confianza a quien puedas contarle esto hoy antes de regresar?",
      "¿Necesitas que preparemos juntos una frase breve para explicárselo a tu tutor o al psicólogo del colegio?"
    ]
  },

  // 8.5 PROBLEMAS CON PROFESORES Y ADULTOS DEL COLEGIO
  authority_problem: {
    openings: [
      "Gracias por confiarme esta situación; sé que es muy difícil hablar cuando el problema viene de un profesor o adulto del colegio.",
      "Lamento mucho que un docente o autoridad escolar te esté haciendo sentir intimidado o humillado.",
      "Te escucho y tomo muy en serio lo que cuentas. En el colegio todos los adultos tienen la obligación de tratarte con respeto.",
      "Entiendo perfectamente que sientas temor o incomodidad al tratarse de una persona que tiene autoridad en tu escuela.",
      "Qué bueno que no te quedes callado ante este trato; lo que describes con ese adulto del colegio merece ser atendido.",
      "Nadie debería ir a clases con miedo a la actitud de un docente o auxiliar; gracias por contarlo."
    ],
    validations: [
      "Que una persona sea profesor, auxiliar o autoridad jamás le da derecho a humillarte, gritarte, amenazarte ni ridiculizarte frente a los demás.",
      "No es tu culpa si un adulto del colegio abusa de su posición; pedir ayuda o reportar un mal trato docente no es portarse mal ni faltar el respeto.",
      "Tienes derecho a aprender en un ambiente seguro y digno. Las normas educativas prohíben estrictamente cualquier trato humillante o intimidación del personal hacia los estudiantes.",
      "Es normal que temas represalias en tus notas o que pienses que no te van a creer, pero la ley protege a los estudiantes frente al maltrato de cualquier trabajador escolar.",
      "Tu bienestar vale mucho más que guardar silencio para evitar problemas; ningún docente puede exigirte callar un trato inadecuado.",
      "No tienes que soportar gritos, burlas ni intimidaciones de un adulto como si fueran parte normal de la disciplina escolar."
    ],
    actions: [
      "Cuéntaselo hoy mismo a tu mamá, papá o apoderado con detalles claros de qué dijo o hizo ese adulto y en qué momento ocurrió, para que ellos acudan a la Dirección del colegio.",
      "Dentro del colegio, acude a otra autoridad que no sea la persona involucrada —como el coordinador de Tutoría, el psicólogo escolar, el responsable de Convivencia o el director— y pide que te escuchen en presencia de un adulto de confianza.",
      "Evita quedarte a solas con ese profesor o adulto para reclamarle por tu cuenta; siempre es más seguro que intervenga tu familia o el área de tutoría.",
      "Si ocurrió delante de tu salón, anota la fecha, la hora y qué compañeros estuvieron presentes; eso ayuda mucho cuando tus padres o el comité de convivencia revisen el caso.",
      "Puedes explicárselo a tu familia diciendo: «Un profesor en el colegio me está intimidando / tratando mal en clase y necesito que me acompañen a hablar con dirección».",
      "Recuerda que cuando el agresor es personal de la institución educativa, el colegio tiene la obligación legal de registrar el caso y tomar medidas de protección para que no sufras represalias."
    ],
    questions: [
      "¿Ya pudiste comentarle a tu mamá, papá o algún familiar lo que está pasando con ese adulto del colegio?",
      "¿Ocurre durante las clases delante de tus compañeros o cuando estás a solas?",
      "¿Hay otro docente o tutor en tu colegio con quien sí te sientas seguro para hablar hoy?"
    ]
  },

  // 8.6 VIOLENCIA FÍSICA ESCOLAR
  physical_violence: {
    openings: [
      "Siento mucho que te hayan golpeado o lastimado; ninguna agresión física debe pasarse por alto.",
      "Lo que me cuentas es serio: cuando hay golpes, empujones o daño físico, tu protección tiene que ser inmediata.",
      "Gracias por decírmelo. Entiendo perfectamente que tengas miedo de que vuelvan a agredirte.",
      "Lamento que hayas pasado por una situación de violencia física en tu entorno escolar.",
      "Te escucho con atención. Nadie tiene derecho a tocar tu cuerpo para empujarte, golpearte o hacerte daño.",
      "Es muy importante actuar a tiempo cuando alguien pasa de las palabras a las agresiones físicas."
    ],
    validations: [
      "La violencia física nunca es un juego ni una broma pesada, y tú no tienes la culpa de que alguien haya decidido agredirte.",
      "Defender tu integridad pidiendo ayuda adulta no es ser cobarde ni «soplón»; es la forma más inteligente y segura de cortar la violencia.",
      "No tienes que devolver el golpe ni pelear para hacerte respetar: responder con violencia suele ponerte en mayor peligro y causarte sanciones injustas.",
      "Es completamente válido sentir miedo o rabia después de que te lastiman; mereces estudiar sin temor a que te golpeen.",
      "Ningún compañero tiene permiso para agredirte físicamente bajo ninguna excusa.",
      "Tu seguridad física en el colegio es una responsabilidad directa de los adultos de la institución y de tu familia."
    ],
    actions: [
      "Si te lastimaste o tienes dolor por el golpe o empujón, avisa de inmediato a un profesor, auxiliar o a tu familia para que te revisen en el tópico o en un centro de salud.",
      "No te quedes a solas en los lugares donde te agredieron (como baños, escaleras o la salida); mantente cerca de tus amigos o de zonas vigiladas por docentes y auxiliares.",
      "Informa hoy mismo a tu tutor, al encargado de Convivencia Escolar o a tus padres indicando quién te agredió, dónde fue y si te están amenazando con volver a hacerlo.",
      "Pide a tu familia que solicite en el colegio medidas de protección inmediatas y el registro del hecho en el Libro de Registro de Incidencias.",
      "Si tienes miedo a la hora de la salida o en el recreo, acuerda con tu tutor o con tus padres que un adulto te acompañe o supervise ese momento.",
      "Puedes decirle directamente a tu profesor o familiar: «Me golpearon / empujaron hoy y tengo miedo de que vuelvan a agredirme; necesito que intervengan por mi seguridad»."
    ],
    questions: [
      "¿Tienes alguna herida o dolor físico en este momento que necesite revisión médica?",
      "¿Le avisaste ya a algún profesor, auxiliar o a tu familia sobre esta agresión?",
      "¿En qué momento del día sientes más riesgo de que intenten agredirte de nuevo?"
    ]
  },

  // 8.7 AMENAZAS, INTIMIDACIÓN Y MIEDO EN EL COLEGIO / RECREO / SALIDA
  threats_intimidation: {
    openings: [
      "Comprendo que sientas miedo o intranquilidad; las amenazas y la intimidación deben tomarse muy en serio desde el primer momento.",
      "Siento mucho que te estén haciendo pasar miedo en el colegio o a la hora de salir.",
      "Gracias por contarme lo que ocurre. Nadie debería sentirse inseguro durante el recreo ni al terminar las clases.",
      "Te escucho. Cuando alguien te amenaza o te intimida, es normal sentir tensión y temor, pero no estás solo.",
      "Lo que describes no es algo menor: amenazar o quitar tus cosas mediante el miedo es una forma clara de violencia escolar.",
      "Qué importante que busques orientación ahora; no hay que esperar a que una amenaza se cumpla para pedir protección."
    ],
    validations: [
      "Sentir miedo ante una amenaza es una reacción natural para protegerte; contar lo que pasa demuestra valentía, no debilidad.",
      "No tienes por qué caminar con miedo en tu propio colegio ni entregar tus cosas o tu tranquilidad porque alguien te intimida.",
      "Las amenazas buscan aislarte para que no hables, por eso romper el silencio con un adulto seguro les quita ese poder sobre ti.",
      "Tú no provocaste esta intimidación y tienes todo el derecho de exigir que el colegio cuide tu integridad en el recreo y a la salida.",
      "Ninguna amenaza («si hablas te pego», «te espero afuera») debe guardarse en secreto.",
      "Mereces disfrutar tus recreos y regresar a casa con total tranquilidad."
    ],
    actions: [
      "Si te amenazan con esperarte a la salida del colegio, no salgas solo hoy: avisa antes a tu tutor, auxiliar o director y llama a un familiar para que vaya a recogerte.",
      "Durante el recreo o cambios de hora,Ubícate cerca del patio principal donde estén los docentes o auxiliares de turno, o quédate acompañado de compañeros de confianza.",
      "Cuéntale con precisión a tus padres y a tu tutor quién te está amenazando y qué te dijo exactamente, para que el colegio active medidas de resguardo inmediato.",
      "Nunca aceptes ir a hablar «a solas» a un rincón, baño o callejón con la persona o grupo que te intimida.",
      "Si las amenazas también te llegan por celular o redes, no las borres: muéstraselas a tus padres y al responsable de Convivencia Escolar como evidencia.",
      "Puedes pedir apoyo hoy mismo diciendo: «Me están amenazando en el colegio / a la salida y no me siento seguro; necesito que me acompañen y tomen medidas»."
    ],
    questions: [
      "¿La amenaza es para hoy a la salida del colegio o ocurre durante los recreos?",
      "¿Cuentas con un familiar que pueda ir a recogerte hoy o hablar con la dirección del colegio?",
      "¿Las amenazas han sido en persona o también te han escrito por mensajes?"
    ]
  },

  // 8.8 CIBERACOSO Y VIOLENCIA EN REDES / INTERNET
  cyberbullying: {
    openings: [
      "Lamento mucho lo que estás pasando en redes o por mensajes; el ciberacoso duele y afecta tanto como el acoso en persona.",
      "Gracias por contármelo. Que ocurra a través de una pantalla no lo hace menos grave ni menos real.",
      "Entiendo tu preocupación y malestar: ver que suben fotos sin tu permiso, crean cuentas falsas o te atacan por chat es muy invasivo.",
      "Te escucho y quiero ayudarte a actuar con calma y seguridad frente a lo que está pasando en internet.",
      "Es muy agotador sentir que las burlas o amenazas continúan hasta en el celular; no tienes que enfrentar esto por tu cuenta.",
      "Haces muy bien en buscar orientación: la violencia digital vulnera tu privacidad y tiene formas concretas de frenarse y denunciarse."
    ],
    validations: [
      "Nadie tiene derecho a publicar fotografías tuyas sin tu consentimiento, difundir tus datos privados ni crear perfiles falsos para dañarte.",
      "No es tu culpa que otras personas usen la tecnología para agredir, humillar o presionar; tu intimidad merece respeto absoluto.",
      "No tienes obligación de responder a mensajes ofensivos ni de ceder ante presiones para enviar fotografías tuyas.",
      "En el mundo digital también existen reglas y responsabilidades: el ciberacoso entre estudiantes también es atendido y sancionado por el colegio.",
      "Sentir enojo, ansiedad o vergüenza cuando exponen tu imagen sin permiso es totalmente comprensible, pero quienes actuaron mal son ellos, no tú.",
      "Nunca cedas a chantajes por internet: entregar lo que te piden no detiene al agresor, en cambio pedir ayuda adulta sí te protege."
    ],
    actions: [
      "No respondas a las provocaciones ni entres en discusiones en el chat. Antes de bloquear la cuenta, toma capturas de pantalla (donde se vea el usuario, fecha y enlaces) y muéstraselas a tus padres o a un adulto de confianza.",
      "Si publicaron fotos tuyas sin permiso o crearon una cuenta falsa para burlarse, pide ayuda a un adulto para denunciar la publicación o el perfil directamente en las opciones de reporte de la red social (Instagram, TikTok, WhatsApp o Facebook) para que la eliminen.",
      "Si te están presionando para enviar fotografías personales o íntimas, di que no cortando toda comunicación de inmediato, bloquea al usuario y cuéntaselo hoy mismo a un adulto seguro.",
      "Configura tus cuentas como privadas, restringe quién puede enviarte mensajes o etiquetarte y nunca compartas contraseñas ni ubicación.",
      "Si quienes hacen esto son compañeros de tu colegio o de un grupo de WhatsApp del salón, informa con las capturas a tu tutor y a Convivencia Escolar, ya que el colegio debe intervenir.",
      "No reenvíes tú mismo las capturas o enlaces a otros compañeros para quejarte, así evitas que el contenido siga circulando; entrégalas solo a tu familia o a la autoridad escolar."
    ],
    questions: [
      "¿Las personas que hacen esto son compañeros de tu colegio o es una cuenta desconocida?",
      "¿Ya pudiste guardar capturas de pantalla para mostrárselas a un familiar o a tu tutor?",
      "¿En qué red social o aplicación está ocurriendo esto?"
    ]
  },

  // 8.9 DISCRIMINACIÓN
  discrimination: {
    openings: [
      "Siento mucho que estés recibiendo tratos discriminatorios; nadie merece ser rechazado ni burlado por quién es.",
      "Gracias por compartir esto conmigo. La discriminación duele profundamente, pero habla mal de quienes la ejercen, nunca de ti.",
      "Te escucho con total respeto. Tu origen, tu piel, tu forma de hablar, tus capacidades o tu identidad son parte valiosa de ti.",
      "Lamento que en tu entorno escolar haya personas que usen prejuicios para hacerte sentir menos.",
      "Lo que cuentas es una forma de violencia e intolerancia que ningún estudiante tiene por qué soportar.",
      "Qué importante que lo expreses: todas las personas tienen exactamente los mismos derechos y la misma dignidad."
    ],
    validations: [
      "No hay absolutamente nada malo en tu origen, tu apariencia, tu cultura, tu condición o tu forma de ser; jamás debes sentir vergüenza de tu identidad.",
      "En el Perú y en todo entorno educativo, la discriminación por raza, origen, idioma, discapacidad, condición económica o género está prohibida por ley.",
      "La ignorancia o los prejuicios de otros compañeros no definen cuánto vales ni lo que eres capaz de lograr.",
      "No tienes que cambiar tu forma de hablar ni esconder tus raíces para encajar con personas que no saben respetar.",
      "Mereces estudiar en un aula donde la diversidad se respete y donde nadie use tus características personales como insulto.",
      "Pedir que se detenga un trato discriminatorio es defender tu dignidad y también ayuda a que otros estudiantes no pasen por lo mismo."
    ],
    actions: [
      "Habla con tu tutor, el área de Psicología o Convivencia Escolar y explica claramente que estás recibiendo burlas o exclusión por motivos de discriminación.",
      "Cuéntaselo a tu familia para que respalden tu reclamo en el colegio; las escuelas están obligadas a intervenir y realizar acciones formativas y correctivas frente al racismo o cualquier discriminación.",
      "No respondas con otros insultos; si te sientes seguro, puedes marcar un límite firme diciendo: «Mis raíces / mi persona merecen respeto y esos comentarios no son graciosos».",
      "Acércate a compañeros y espacios del colegio donde valoren el respeto mutuo y evita aislarte.",
      "Si la discriminación es repetida, pide a tus padres o tutor que se registre formalmente el caso en los canales de convivencia escolar."
    ],
    questions: [
      "¿Estos comentarios o rechazos ocurren dentro del salón de clases o en los recreos?",
      "¿Algún profesor ha escuchado cuando te dicen eso o todavía no lo saben en tutoría?",
      "¿Te gustaría que pensemos cómo explicárselo a tu tutor o a tu familia?"
    ]
  },

  // 8.10 RUMORES, CHISMES Y DIFAMACIÓN
  rumors_gossip: {
    openings: [
      "Entiendo lo frustrante y doloroso que es saber que están inventando rumores o mentiras sobre ti.",
      "Gracias por contarme lo que pasa; sentir que hablan a tus espaldas o te culpan de algo injusto genera mucha impotencia.",
      "Siento mucho que tus compañeros estén difundiendo chismes para dañarte o poner a otros en tu contra.",
      "Te escucho. Los rumores buscan incomodarte y aislarte, pero podemos manejarlo con calma e inteligencia.",
      "Es muy pesado llegar al salón y sentir miradas o comentarios por algo que inventaron sobre ti.",
      "Haces bien en desahogarte aquí; la difamación y los rumores malintencionados son una forma de acoso escolar relacional."
    ],
    validations: [
      "Que varias personas repitan una mentira o un rumor jamás lo convierte en verdad ni cambia la persona que realmente eres.",
      "Tú no eres culpable de lo que otros inventan por malicia, envidia o por querer llamar la atención del grupo.",
      "No necesitas darle explicaciones desesperadas a todo el colegio ni entrar en peleas públicas para defender tu dignidad.",
      "Es normal que te dé rabia o tristeza que crean algo falso, pero quienes quedan mal al final son quienes inventan mentiras.",
      "Tu privacidad y tu buen nombre merecen respeto dentro y fuera del aula.",
      "No tienes que vengarte inventando otro rumor; actuar con madurez y apoyo adulto es lo que realmente frena la situación."
    ],
    actions: [
      "Habla en privado con tu tutor o con el psicólogo del colegio y explícale qué rumor están difundiendo, quiénes lo empezaron y cómo está afectando la convivencia en el salón.",
      "Con tus amigos cercanos o las personas que realmente te importan, aclara la verdad una sola vez con serenidad: «Eso que están diciendo no es cierto y me hace daño que lo repitan».",
      "Si el rumor se está esparciendo por grupos de WhatsApp o redes sociales, toma captura y pide ayuda a tus padres y a Tutoría para que intervengan.",
      "Evita confrontar a gritos al grupo que esparce el chisme, porque muchas veces buscan justamente provocar una reacción tuya para seguir molestando.",
      "Apóyate en tu familia y en compañeros que te conocen bien para no quedarte solo mientras el tutor frena el problema en el aula."
    ],
    questions: [
      "¿El rumor lo están comentando solo en el salón o también lo han escrito en grupos de chat?",
      "¿Has podido conversar de esto con tu tutor o con algún amigo que sí te apoye?",
      "¿Qué es lo que más te preocupa de lo que están diciendo?"
    ]
  },

  // 8.11 EXCLUSIÓN SOCIAL Y AISLAMIENTO EN GRUPOS
  social_exclusion: {
    openings: [
      "Siento mucho que te estén dejando de lado; que te excluyan de los grupos o nadie quiera trabajar contigo duele de verdad.",
      "Gracias por confiarme cómo te tratan en tu salón. Sentirse ignorado o apartado por los compañeros es muy duro.",
      "Te escucho y te comprendo: pasar el recreo sin compañía o quedar fuera de los trabajos grupales hace que el colegio se sienta pesado.",
      "Lamento que estés viviendo esta exclusión en tu clase; no tienes por qué fingir que no te afecta.",
      "Es totalmente comprensible que te sientas triste o incómodo cuando tus compañeros te apartan a propósito.",
      "Qué bueno que lo cuentes aquí; la exclusión intencional y «la ley del hielo» también son formas de acoso social que deben atenderse."
    ],
    validations: [
      "Que un grupo decida excluirte o no hacer equipo contigo no significa que tengas un defecto ni que valgas menos que ellos.",
      "Mereces estar en un salón donde te incluyan con respeto en las actividades académicas y en la convivencia diaria.",
      "No tienes que rogar la amistad ni cambiar tu forma de ser para agradarle a personas que tienen actitudes excluyentes.",
      "A veces un grupo actúa por imitación o presión de un líder negativo; el problema está en la actitud de ellos, no en ti.",
      "Es válido que te duela quedarte sin grupo en clase, y los profesores tienen la responsabilidad de organizar el aula para que nadie quede excluido.",
      "Tu valor como persona y como estudiante está muy por encima de la actitud cerrada de algunos compañeros."
    ],
    actions: [
      "Cuando los profesores pidan formar grupos y nadie te incluya, acércate en privado al docente o a tu tutor y pídele que sea él quien arme los equipos por sorteo o lista para evitar exclusiones.",
      "Observa en tu salón o en otras secciones si hay compañeros tranquilos o amables que no formen parte del grupo que te excluye, y empieza acercándote a ellos con conversaciones sencillas.",
      "Durante el recreo, puedes sumarte a talleres, biblioteca, deportes o clubes del colegio donde compartas gustos con estudiantes de otros salones.",
      "Coméntale a tu tutor o al psicólogo escolar que te están aislando intencionalmente para que trabajen la integración del aula sin exponerte de forma incómoda.",
      "Conversa también con tu familia sobre cómo te sientes en el salón para que te brinden respaldo emocional y hablen con el tutor si la exclusión continúa."
    ],
    questions: [
      "¿Esto pasa sobre todo cuando toca hacer trabajos en grupo o también durante los recreos?",
      "¿Es todo el salón o hay una persona en particular que les dice a los demás que no se junten contigo?",
      "¿Hay algún compañero tranquilo en tu clase con quien sí hayas conversado bien alguna vez?"
    ]
  },

  // 8.12 INSULTOS, APODOS OFENSIVOS Y HUMILLACIONES
  nicknames_humiliation: {
    openings: [
      "Siento mucho que te estén poniendo apodos ofensivos o burlándose de ti; escuchar eso constantemente cansa y lastima.",
      "Gracias por contarme lo que te dicen. Que se burlen de ti, y más aún delante de la clase, es una falta de respeto que no debes callar.",
      "Te escucho con mucha empatía. Ningún apodo ni insulto tiene por qué ser tolerado como si fuera un chiste.",
      "Comprendo que estés harto de esas burlas y sobrenombres; lo que estás viviendo merece parar.",
      "Lamento que tus compañeros usen palabras hirientes o se rían para hacerte sentir mal en el salón.",
      "Haces muy bien en hablarlo: humillar a alguien en público o ponerle apodos por su físico o forma de ser es acoso verbal."
    ],
    validations: [
      "Quiero que recuerdes algo fundamental: ningún apodo ni insulto define quién eres, ni cuánto vales, ni tu inteligencia ni tu apariencia.",
      "Una broma solo es broma cuando todos se divierten; desde el momento en que a ti te incomoda o te hiere, deja de ser un juego y se convierte en agresión.",
      "Tu cuerpo, tu aspecto físico, tu voz o tu ritmo de aprendizaje no tienen absolutamente nada de malo y nadie tiene derecho a usarlos para burlarse.",
      "No tienes obligación de reírte de los apodos para disimular o para que los demás no te digan que «no aguantas bromas».",
      "Tienes todo el derecho de exigir que te llamen únicamente por tu nombre.",
      "La culpa de una humillación nunca es de quien la recibe, sino de quien necesita rebajar a otro para llamar la atención."
    ],
    actions: [
      "Si no corres riesgo físico, puedes poner un límite corto, serio y sin gritar: «Tengo nombre, no me llames así porque no me da risa», y luego retirarte sin entrar en discusión.",
      "No respondas con otro apodo ni con insultos, porque eso hace que parezca una pelea mutua; en lugar de eso, informa de inmediato a tu tutor o profesor de aula.",
      "Si se burlan de ti delante de toda la clase, pídele a tu tutor que intervenga aplicando las normas de convivencia del salón para frenar las burlas grupales.",
      "Cuéntaselo a tus padres o a un adulto de confianza en casa explicando qué apodos usan, quiénes lo hacen y desde hace cuánto tiempo se repite.",
      "Puedes pedir la intervención de tu docente diciendo: «Profesor, hay compañeros que todos los días me ponen apodos / me humillan en clase y necesito su ayuda para que se detenga»."
    ],
    questions: [
      "¿Es una sola persona quien empieza con los apodos e insultos o es un grupo del salón?",
      "¿Ocurre cuando el profesor está presente en el aula o aprovechan cuando no los ven?",
      "¿Ya le comentaste a tu tutor o a tus padres cómo te están llamando?"
    ]
  },

  // 8.13 BULLYING Y ACOSO ESCOLAR GENERAL
  bullying_general: {
    openings: [
      "Siento mucho que estés pasando por esta situación de acoso y molestia constante en tu colegio.",
      "Gracias por confiar en mí y contarlo con tus propias palabras; es agotador que alguien no deje de fastidiarte.",
      "Te escucho con atención. Nadie tiene por qué ir a estudiar sintiendo que sus compañeros lo tratan mal o lo hostigan.",
      "Comprendo perfectamente que estés cansado de ese trato; lo que describes merece atención y apoyo real.",
      "Qué bueno que decidiste escribirlo hoy: el bullying no es algo que tengas que aguantar ni resolver en soledad.",
      "Lamento que esa persona o grupo se esté metiendo contigo; vamos a ver pasos seguros para que esto cambie."
    ],
    validations: [
      "Nada de lo que haces o eres justifica que otra persona decida molestarte o acosarte; la responsabilidad es de quien agrede, nunca tuya.",
      "Aguantar en silencio no hace que el bullying desaparezca por sí solo; pedir ayuda a los adultos es un acto de valentía y cuidado propio.",
      "Tus emociones son totalmente válidas: sentir rabia, cansancio, tristeza o miedo ante el acoso no es exagerar.",
      "Mereces respeto y tranquilidad todos los días en tu salón, en el recreo y fuera del colegio.",
      "Ningún estudiante tiene derecho a quitarte tu paz ni a hacerte sentir menos.",
      "El acoso escolar se detiene cuando deja de ser un secreto y los adultos responsables intervienen."
    ],
    actions: [
      "Habla hoy mismo con un adulto de confianza —tu mamá, papá, tutor, psicólogo escolar o encargado de Convivencia— y cuéntale quién te molesta, qué hace exactamente y con qué frecuencia ocurre.",
      "Evita quedarte a solas en lugares apartados donde esa persona suela molestarte, y procura mantenerte cerca de compañeros que te traten bien o de docentes.",
      "No intentes vengarte ni enfrentarte a golpes, ya que eso puede ponerte en riesgo; deja que las autoridades del colegio apliquen las medidas correctivas.",
      "Anota en un cuaderno en casa qué días ha ocurrido y quiénes lo vieron, para que tu familia y tu tutor tengan datos claros al intervenir.",
      "Si no sabes cómo empezar a contarlo a un adulto, puedes decirle: «Hay alguien en mi salón que no deja de molestarme, ya me siento muy cansado de esto y necesito tu ayuda para que intervengan en el colegio».",
      "Recuerda que tu familia o tú pueden solicitar que el caso se atienda formalmente mediante el comité de tutoría y convivencia escolar de tu institución."
    ],
    questions: [
      "¿Qué tipo de cosas hace esa persona para molestarte (burlas, quitarte cosas, empujones o mensajes)?",
      "¿Desde hace cuánto tiempo viene ocurriendo esto y en qué momentos del día pasa más?",
      "¿Hay algún adulto en tu casa o en el colegio con quien te sientas con confianza para hablar hoy?"
    ]
  },

  // 8.14 SOLEDAD, BIENESTAR EMOCIONAL Y VERGÜENZA DE PEDIR AYUDA
  loneliness_emotional: {
    openings: [
      "Gracias por abrir tu corazón y contarme cómo te sientes; aquí sí te escucho y sí me importa lo que estás pasando.",
      "Siento mucho que te sientas tan solo en este momento; llevar esa tristeza o vacío por dentro pesa muchísimo.",
      "Te leo con mucha calidez y sin juzgarte. No estás molestando para nada al expresar que necesitas ser escuchado.",
      "Comprendo lo duro que es sentir que nadie te presta atención o que te da vergüenza pedir ayuda.",
      "Qué valioso que hayas decidido escribir hoy en lugar de guardarte todo ese sentimiento en silencio.",
      "A veces parece que a nadie le importamos cuando estamos tristes, pero tu vida y tus emociones tienen muchísimo valor."
    ],
    validations: [
      "Sentirte solo hoy no significa que vayas a estar solo siempre ni que haya algo malo en ti.",
      "Sentir vergüenza o miedo al pedir ayuda es muy común, pero necesitar apoyo humano no te hace débil ni una carga.",
      "Todas las personas, incluso las más fuertes, necesitan en algún momento alguien que las escuche con cariño y respeto.",
      "Lo que sientes importa de verdad, aunque todavía te cueste ordenarlo en palabras.",
      "No tienes que fingir una sonrisa todo el tiempo cuando por dentro te sientes triste o inseguro.",
      "Mereces amistades sinceras y adultos que te escuchen con paciencia y empatía."
    ],
    actions: [
      "Si te da vergüenza hablar cara a cara con un adulto de confianza, una excelente opción es escribir lo que sientes en una carta o mensaje de texto y entregárselo a tu mamá, papá, familiar cercano o al psicólogo del colegio.",
      "Piensa en una sola persona adulta que alguna vez haya sido amable y paciente contigo —un profesor, tutor, tía, abuelo u orientador— y acércate a pedirle unos minutos para conversar en privado.",
      "Puedes romper el hielo con una frase muy sencilla: «Últimamente me siento muy solo / triste y me da un poco de vergüenza decirlo, pero necesito que alguien me escuche».",
      "Para ir conociendo compañeros poco a poco sin presión, intenta participar en alguna actividad que te guste (arte, música, deporte, lectura o clubes escolares) donde el trato surge de forma natural.",
      "No te exijas resolver todo hoy mismo: dar un primer paso pequeño, como hablar con el área de Psicología de tu colegio o llamar a una línea gratuita de orientación emocional, ya hace una gran diferencia."
    ],
    questions: [
      "¿Hay algo en especial que haya ocurrido en el colegio o en casa que te haya hecho sentir así de solo?",
      "¿Te resultaría más fácil escribirle una nota a un adulto de confianza en vez de decírselo en voz alta?",
      "¿Qué te ayudaría a sentirte un poquito más tranquilo en este momento?"
    ]
  },

  // 8.15 PROBLEMAS CON AMISTADES, CONFLICTOS ENTRE PARES Y PRESIÓN DE GRUPO
  peer_conflict: {
    openings: [
      "Entiendo que estés preocupado; tener problemas o peleas con un amigo o compañero cercano siempre incomoda y duele.",
      "Gracias por contarme lo que pasó con tus amistades; vamos a pensarlo con calma para que tomes la mejor decisión.",
      "Te escucho. Los desacuerdos entre amigos o la presión de un grupo pueden ser confusos de manejar.",
      "Siento que estés pasando por este mal momento con tu amigo o compañero.",
      "Qué bueno que busques orientación antes de reaccionar con enojo; eso demuestra mucha madurez de tu parte.",
      "Vamos a diferenciar qué parte es un malentendido que se puede conversar y dónde están tus límites personales."
    ],
    validations: [
      "En cualquier amistad verdadera debe haber respeto mutuo: un desacuerdo nunca justifica que te insulten, te humillen ni te amenacen.",
      "Si tus amigos te presionan para hacer algo que no quieres o que daña a otros, decir «no» es cuidar tu integridad: los verdaderos amigos respetan tus decisiones.",
      "Es normal enojarse o tener malentendidos con un amigo, pero tú tienes derecho a expresar cómo te sentiste sin que te falten el respeto.",
      "Escuchar la versión de la otra persona no significa que tengas que aceptar malos tratos ni pedir perdón por cosas que no hiciste.",
      "Si una amistad te hace sentir mal constantemente, te manipula o te expone, tienes derecho a tomar distancia para cuidar tu bienestar."
    ],
    actions: [
      "Espera a que ambos estén más tranquilos y pídele hablar en privado sin terceros alrededor, usando frases desde cómo te sientes tú: «Cuando pasó esto me sentí mal y me gustaría que lo aclaremos».",
      "Evita ventilar la pelea en estados de redes sociales o grupos de WhatsApp, porque eso suele agrandar el conflicto e involucrar a más gente.",
      "Si se trata de presión de grupo para hacer algo indebido, aléjate del lugar con una respuesta firme («No quiero meterme en eso») y busca compañeros que respeten tus límites.",
      "Si intentas conversar de buena manera y la otra persona responde con agresividad, burlas o amenazas, no insistas a solas y pide la mediación de tu tutor o del psicólogo escolar.",
      "Recuerda que una amistad sana suma tranquilidad a tu vida; si el conflicto se vuelve acoso constante, apóyate en un adulto de confianza."
    ],
    questions: [
      "¿Sientes que fue un malentendido puntual entre amigos o esa persona suele tratarte mal con frecuencia?",
      "¿Crees que puedas conversar a solas y con calma con tu amigo, o prefieres que un tutor los ayude a mediar?",
      "¿Qué te gustaría que cambie en la relación con ese compañero?"
    ]
  },

  // 8.16 CÓMO APOYAR A UN AMIGO / COMPAÑERO O ACTUAR COMO TESTIGO
  helping_friend: {
    openings: [
      "Habla muy bien de ti que quieras ayudar y no quedarte indiferente ante lo que está sufriendo tu amigo o compañero.",
      "Qué valioso que te preocupes por el bienestar de otra persona; para alguien que sufre acoso, contar con un amigo cambia todo.",
      "Gracias por buscar una forma segura e inteligente de apoyar a tu amiga o amigo.",
      "Te felicito por tu empatía: muchas veces quienes sufren bullying o violencia callan por miedo, y tu apoyo puede ser clave.",
      "Es muy importante lo que quieres hacer; vamos a ver cómo puedes ayudarle de verdad sin ponerte en peligro tú.",
      "Escuchar y acompañar a un compañero que la está pasando mal es una de las mejores formas de mejorar la convivencia escolar."
    ],
    validations: [
      "Acercarte a decirle «Te creo, no estás solo y no es tu culpa» ya le brinda un alivio emocional enorme.",
      "Recuerda algo muy importante: ser un buen amigo no significa que tengas que resolver tú solo un problema grave ni pelear contra los agresores.",
      "Cuando la vida, la salud o la seguridad física de tu amigo están en riesgo, buscar ayuda de un adulto responsable no es traicionar su confianza: es proteger su vida.",
      "Cuidar la privacidad de tu compañero es fundamental: nunca difundas lo que te contó ni reenvíes fotos o videos donde lo humillen.",
      "Tú también mereces estar seguro mientras ayudas; apoyar desde la compañía y el aviso a adultos es mucho más efectivo que confrontar."
    ],
    actions: [
      "Escúchale con paciencia sin juzgarle ni culparle, y acompáñale en los momentos difíciles como el recreo o la salida para que no se sienta aislado.",
      "Anímale a contar lo que ocurre a un adulto de confianza (su familia, el tutor o el psicólogo del colegio) y ofrécele ir juntos: «Si te da miedo ir solo a hablar con la tutora, yo te acompaño ahora mismo».",
      "Si ves que están difundiendo burlas o fotos contra tu compañero en redes, no te rías ni las compartas; repórtalas y avisa a un adulto.",
      "Si tu amigo o amiga está sufriendo violencia física, abuso sexual, violencia familiar o tiene ideas de hacerse daño, avisa de inmediato a un docente de confianza, al psicólogo escolar o a tu propia familia para que lo protejan hoy mismo, incluso si te pidió guardar el secreto.",
      "También puedes reportar casos de violencia escolar como testigo de manera confidencial en los canales oficiales para que el colegio intervenga sin exponerte."
    ],
    questions: [
      "¿Sabes si tu amigo o amiga corre peligro físico inmediato en el colegio o en su casa?",
      "¿Crees que aceptaría que lo acompañes hoy a conversar con el tutor o el psicólogo del colegio?",
      "¿Quieres que preparemos una frase para decirle a tu amigo y animarlo a pedir ayuda adulta?"
    ]
  },

  // 8.17 CÓMO PEDIR AYUDA A UN ADULTO DE CONFIANZA
  how_to_ask_help: {
    openings: [
      "Pensar en cómo pedir ayuda a un adulto de confianza es el paso más importante y valiente que puedes dar.",
      "Me alegra mucho ayudarte a preparar este paso; pedir apoyo a una persona adulta segura hace que dejes de cargar el problema a solas.",
      "Es totalmente normal sentir nervios antes de hablar con un adulto, pero podemos hacerlo sencillo y paso a paso.",
      "Vamos a organizar juntos cómo elegir a esa persona de confianza y qué decirle para que te escuche con atención.",
      "Pedir ayuda no requiere un discurso largo ni perfecto; basta con elegir a alguien seguro y ser claro."
    ],
    validations: [
      "Un adulto de confianza es alguien que te escucha con respeto, no te culpa por lo que te pasa y busca protegerte.",
      "Puede ser tu mamá, tu papá, un hermano mayor, abuelos, tíos, o dentro del colegio tu tutor, un profesor amable, el psicólogo o el encargado de Convivencia Escolar.",
      "Si alguna vez hablaste con un adulto y sentiste que no te prestó suficiente atención, no te rindas: busca a un segundo adulto seguro hasta que te escuchen.",
      "No tienes que saber todas las soluciones antes de hablar; el trabajo del adulto es justamente ayudarte a encontrarlas."
    ],
    actions: [
      "Elige un momento tranquilo y pide conversar en privado: «¿Tienes unos minutos? Necesito contarte algo importante que me está pasando y necesito tu apoyo».",
      "Explica tres puntos básicos: qué está ocurriendo (burlas, amenazas, exclusión, golpes), quién o quiénes lo hacen y dónde sucede (en el salón, en el recreo, por redes o en casa).",
      "Si te da mucha vergüenza o sientes que vas a llorar al hablar, escríbelo en una hoja o en un mensaje del celular y entrégaselo diciendo: «Me cuesta decirlo en voz alta, por favor lee esto y ayúdame».",
      "Si además necesitas orientación profesional inmediata, recuerda que en Perú existen líneas gratuitas y confidenciales donde especialistas te escuchan y orientan."
    ],
    questions: [
      "De las personas adultas que conoces en tu familia o en tu colegio, ¿con cuál sientes un poco más de confianza para empezar?",
      "¿Prefieres hablarlo en persona o te gustaría que redactemos juntos un mensaje corto para mostrárselo?"
    ]
  },

  // 8.18 INFORMACIÓN EDUCATIVA SOBRE BULLYING Y CIBERACOSO
  educational_info: {
    explanations: [
      "Según organismos como UNICEF y el Ministerio de Educación (MINEDU), el bullying o acoso escolar es un comportamiento agresivo e intencional que se repite en el tiempo entre estudiantes y donde existe un desequilibrio de poder (por fuerza, grupo o intimidación). No es un simple desacuerdo puntual entre amigos, sino un trato que busca dañar, humillar o excluir.",
      "El acoso escolar puede presentarse de varias formas: verbal (insultos, apodos ofensivos, burlas públicas), social o relacional (exclusión intencional de los grupos, «ley del hielo», rumores), físico (golpes, empujones, esconder o romper pertenencias), psicológico (amenazas, intimidación) y ciberacoso (cuando se usan redes sociales, WhatsApp, fotos sin permiso o cuentas falsas para agredir).",
      "Para diferenciar una broma del bullying, recuerda esta regla clara: en una broma sana hay confianza y todos se divierten; cuando una sola parte se ríe, la otra persona se siente humillada o con miedo y la conducta se repite pese a incomodar, ya es acoso y requiere intervención."
    ],
    guidance: [
      "Para detener el bullying no se recomienda enfrentar a golpes al agresor ni quedarse callado esperando que pase solo. Lo más efectivo y seguro es contarlo a un adulto de confianza (familia, tutor o psicólogo escolar), guardar pruebas si ocurre por internet y pedir que el colegio active sus protocolos de convivencia.",
      "Si eres testigo de bullying hacia un compañero, no te rías ni compartas burlas: acompáñalo para que no esté solo y avisa a un docente o repórtalo de manera confidencial."
    ],
    questions: [
      "¿Preguntas porque quieres informarte sobre el tema o porque tú o alguien que conoces está viviendo algo parecido?",
      "¿Te gustaría saber cómo actuar ante algún caso específico en el colegio o en redes sociales?"
    ]
  },

  // 8.19 ORIENTACIÓN GENERAL / ESCUCHA ABIERTA (RESPALDO EMPÁTICO)
  general_orientation: {
    openings: [
      "Gracias por escribirle a Lumy. Estoy aquí para escucharte con respeto y orientarte paso a paso.",
      "Te leo con calma. Este es un espacio seguro pensado para acompañarte y darte orientación práctica.",
      "Gracias por compartir eso conmigo; no necesitas usar palabras complicadas para explicarme lo que sientes o necesitas.",
      "Aquí estoy para apoyarte. Podemos conversar con tranquilidad sobre cualquier situación que te preocupe.",
      "Me interesa entender bien lo que estás viviendo para darte una orientación clara y segura.",
      "Cuenta conmigo para ordenar tus ideas con calma y sin ningún tipo de juicio."
    ],
    validations: [
      "Cualquier situación que te quite tranquilidad en el colegio, en internet o en tu entorno merece ser escuchada con seriedad.",
      "Recuerda que por tu privacidad no necesitas escribir apellidos, direcciones ni el nombre de tu colegio.",
      "Pedir orientación cuando algo te incomoda o te genera dudas es una decisión muy valiosa.",
      "No tienes que resolver un problema difícil todo de una sola vez; podemos ir viendo opciones seguras paso a paso.",
      "Tu bienestar emocional y tu seguridad son siempre lo más importante.",
      "Siempre hay formas seguras de pedir apoyo a personas adultas de confianza cuando algo te supera."
    ],
    actions: [
      "Puedo orientarte sobre bullying, apodos o burlas, exclusión de grupos, amenazas, ciberacoso, problemas con amigos o docentes, situaciones difíciles en casa o cómo ayudar a un compañero.",
      "Cuéntame con tus propias palabras qué ocurrió recientemente, dónde está pasando y cómo te está haciendo sentir.",
      "Si prefieres ir directo a la práctica, dime si buscas un consejo para actuar tú, cómo hablar con un adulto de confianza o información sobre canales de ayuda."
    ],
    questions: [
      "¿Me cuentas un poquito más sobre qué es lo que más te preocupa en este momento?",
      "¿Esta situación te está pasando a ti directamente o buscas cómo apoyar a otra persona?",
      "¿Ocurre en tu colegio, por redes sociales o en tu casa?"
    ]
  },

  // 8.20 SALUDOS, AGRADECIMIENTOS Y DESPEDIDAS
  greetings: [
    "¡Hola! 💙 Soy Lumy, tu asistente de orientación escolar. Puedes contarme con tus propias palabras lo que te preocupa, sin necesidad de dar tus datos personales. ¿En qué te puedo apoyar hoy?",
    "¡Hola! Qué bueno que estés aquí. Soy Lumy y estoy disponible para escucharte y orientarte sobre convivencia escolar, bullying, ciberacoso, amistades o cualquier situación que te haga sentir inseguro. ¿De qué te gustaría conversar?",
    "¡Holi! 💙 Bienvenido a Lumy. Este es un espacio seguro y respetuoso para ti. Cuéntame con confianza: ¿te está pasando algo en el colegio, en redes o en casa, o buscas cómo ayudar a alguien?",
    "¡Hola! Soy Lumy. Estoy aquí para escucharte con calma y darte consejos seguros y prácticos. No necesitas poner nombres completos ni el nombre de tu colegio. ¿Qué tienes en mente hoy?",
    "¡Buenas! 💙 Soy Lumy. Si estás pasando por un momento difícil, tienes dudas sobre el acoso escolar o necesitas saber cómo pedir ayuda a un adulto de confianza, cuéntame y lo vemos paso a paso.",
    "¡Hola! Gracias por escribir a Lumy. Puedes desahogarte o hacerme cualquier consulta con tranquilidad. ¿Cómo te sientes hoy?"
  ],
  gratitude: [
    "No tienes nada que agradecer. 💙 Me alegra mucho haberte escuchado y acompañado hoy en Lumy. Recuerda que vales muchísimo, que mereces respeto y que apoyarte en un adulto de confianza en la vida real siempre será tu mejor respaldo.",
    "Con mucho gusto, para eso está Lumy. 💙 Qué bueno que te hayas animado a expresar lo que sientes. No olvides que no tienes que llevar ninguna carga a solas y que puedes volver a escribir cuando lo necesites.",
    "Gracias a ti por la confianza de contarlo. 💙 Cuida mucho tu bienestar, pon en práctica los pasos seguros que conversamos y acércate a una persona adulta protectora. ¡Mucho ánimo!",
    "Me alegra saber que te sirvió conversar aquí en Lumy. 💙 Recuerda siempre que tu seguridad y tu tranquilidad van primero, y que pedir ayuda a tiempo es una señal de gran fortaleza.",
    "De nada. 💙 Fue muy valioso conversar contigo. Si en algún momento vuelve a surgir una duda o necesitas repasar cómo hablar con un adulto de confianza, aquí estaré para orientarte.",
    "Gracias a ti por darte este espacio para hablar. 💙 Mereces estudiar y vivir tranquilo y respetado; apóyate en tu familia, tutores o en las líneas oficiales siempre que lo necesites."
  ],
  farewells: [
    "Cuídate mucho. 💙 Recuerda que en Lumy siempre tendrás un espacio seguro para orientarte, y que ante cualquier peligro debes acudir de inmediato a un adulto de confianza. ¡Hasta pronto!",
    "¡Hasta luego! 💙 Espero que todo mejore pronto. No olvides apoyarte en las personas adultas que te quieren y te cuidan.",
    "Nos vemos pronto. 💙 Recuerda que no estás solo y que tu bienestar importa muchísimo. ¡Mucho ánimo!"
  ]
};

// -----------------------------------------------------------------------------
// 9. COMPOSICIÓN MODULAR COHERENTE Y CONTEXTUAL
// -----------------------------------------------------------------------------
function buildContextualBridge(ctx, intent) {
  const parts = [];

  // Mencionar el nombre propio de forma natural y sin inventar detalles
  // (solo en categorías donde el nombre corresponde a un compañero, amigo o docente mencionado)
  if (
    ctx.recentName &&
    [
      "nicknames_humiliation",
      "bullying_general",
      "physical_violence",
      "threats_intimidation",
      "social_exclusion",
      "rumors_gossip",
      "cyberbullying",
      "peer_conflict",
      "authority_problem",
      "helping_friend"
    ].includes(intent.category)
  ) {
    if (intent.category === "helping_friend") {
      parts.push(`Respecto a lo que está viviendo ${ctx.recentName}:`);
    } else if (intent.category === "peer_conflict") {
      parts.push(`Sobre lo que ocurrió con ${ctx.recentName}:`);
    } else {
      parts.push(`Sobre lo que mencionas acerca de ${ctx.recentName}:`);
    }
  }

  // Reconocer si el problema es repetido ("todos los días", "siempre", "no deja de")
  if (
    ctx.frequency === "repeated" &&
    [
      "nicknames_humiliation",
      "bullying_general",
      "physical_violence",
      "threats_intimidation",
      "social_exclusion",
      "cyberbullying",
      "discrimination"
    ].includes(intent.category)
  ) {
    parts.push(
      "Como me cuentas que esto viene repitiéndose de manera constante, es aún más importante no dejarlo pasar y actuar con apoyo adulto."
    );
  }

  return parts.join(" ");
}

function selectResourceNote(intent, ctx) {
  switch (intent.category) {
    case "sexual_violence_protocol":
      return OFFICIAL_RESOURCES.sexualViolencePeru;
    case "self_harm_crisis":
      return `${OFFICIAL_RESOURCES.mentalHealthPeru} ${OFFICIAL_RESOURCES.emergencyPeru}`;
    case "immediate_danger":
      return OFFICIAL_RESOURCES.emergencyPeru;
    case "family_violence":
      return OFFICIAL_RESOURCES.familyViolencePeru;
    case "authority_problem":
      return OFFICIAL_RESOURCES.authorityAbusePeru;
    case "physical_violence":
    case "threats_intimidation":
    case "cyberbullying":
    case "discrimination":
    case "bullying_general":
      return OFFICIAL_RESOURCES.schoolBullyingPeru;
    case "loneliness_emotional":
      return OFFICIAL_RESOURCES.mentalHealthPeru;
    case "how_to_ask_help":
      return `${OFFICIAL_RESOURCES.schoolBullyingPeru} También cuentas con la Línea 100 y la Línea 113 (opción 5).`;
    default:
      if (ctx.asksDirectAction) {
        return OFFICIAL_RESOURCES.schoolBullyingPeru;
      }
      return "";
  }
}

export function respond(messages = []) {
  const ctx = analyzeContext(messages);
  const intent = classifyIntent(ctx);
  const lastAssistant = ctx.assistantMessages[ctx.assistantMessages.length - 1] || "";

  const conversationFingerprint = messages
    .slice(-8)
    .map(m => `${m.role}:${normalize(m.content)}`)
    .join("|");
  const seed = `${conversationFingerprint}|turn:${ctx.turnCount}|seq:${++responseCounter}`;

  // ---------------------------------------------------------------------------
  // CASO A: PROTOCOLO ESPECIAL DE VIOLENCIA SEXUAL Y ABUSO (10 PUNTOS OBLIGATORIOS)
  // ---------------------------------------------------------------------------
  if (intent.category === "sexual_violence_protocol") {
    const bank = RESPONSE_BANKS.sexual_violence_protocol;
    const part1 = pickVariant(bank.recognitionAndNoBlame, seed, "sv-rec", lastAssistant);
    const groomingNote =
      intent.subType === "grooming_or_sextortion"
        ? pickVariant(bank.groomingSpecificAdvice, seed, "sv-groom", lastAssistant)
        : "";
    const part2 = pickVariant(bank.medicalAndSafetyUrgent, seed, "sv-med", lastAssistant);
    const adultOptions =
      bank.trustedAdultByContext[intent.aggressorContext] || bank.trustedAdultByContext.other;
    const part3 = pickVariant(adultOptions, seed, "sv-adult", lastAssistant);
    const part4 = pickVariant(bank.privacyAndSimplePhrase, seed, "sv-priv", lastAssistant);

    return [
      part1,
      groomingNote,
      part2,
      part3,
      part4,
      OFFICIAL_RESOURCES.sexualViolencePeru
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // CASO B: PROTOCOLO DE RIESGO DE AUTOLESIÓN O SUICIDIO
  // ---------------------------------------------------------------------------
  if (intent.category === "self_harm_crisis") {
    const bank = RESPONSE_BANKS.self_harm_crisis;
    return [
      pickVariant(bank.openings, seed, "sh-open", lastAssistant),
      pickVariant(bank.safetyAction, seed, "sh-act", lastAssistant),
      OFFICIAL_RESOURCES.mentalHealthPeru,
      OFFICIAL_RESOURCES.emergencyPeru
    ].join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // CASO C: PROTOCOLO DE PELIGRO INMEDIATO Y EMERGENCIA ACTIVA
  // ---------------------------------------------------------------------------
  if (intent.category === "immediate_danger") {
    const bank = RESPONSE_BANKS.immediate_danger;
    return [
      pickVariant(bank.openings, seed, "id-open", lastAssistant),
      pickVariant(bank.urgentSteps, seed, "id-step", lastAssistant),
      OFFICIAL_RESOURCES.emergencyPeru
    ].join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // CASO D: SALUDOS, AGRADECIMIENTOS Y DESPEDIDAS
  // ---------------------------------------------------------------------------
  if (intent.category === "greeting") {
    return pickVariant(RESPONSE_BANKS.greetings, seed, "greet", lastAssistant);
  }

  if (intent.category === "gratitude_closing") {
    return pickVariant(RESPONSE_BANKS.gratitude, seed, "thanks", lastAssistant);
  }

  if (intent.category === "farewell") {
    return pickVariant(RESPONSE_BANKS.farewells, seed, "bye", lastAssistant);
  }

  // ---------------------------------------------------------------------------
  // CASO E: CONSULTAS EDUCATIVAS ("¿QUÉ ES EL BULLYING?")
  // ---------------------------------------------------------------------------
  if (intent.category === "educational_info") {
    const bank = RESPONSE_BANKS.educational_info;
    const parts = [
      pickVariant(bank.explanations, seed, "edu-exp", lastAssistant),
      pickVariant(bank.guidance, seed, "edu-gui", lastAssistant),
      OFFICIAL_RESOURCES.schoolBullyingPeru
    ];
    if (!ctx.asksDirectAction) {
      parts.push(pickVariant(bank.questions, seed, "edu-q", lastAssistant));
    }
    return parts.join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // CASO F: CATEGORÍAS MODULARES DE ORIENTACIÓN ESCOLAR Y FAMILIAR
  // ---------------------------------------------------------------------------
  const bank = RESPONSE_BANKS[intent.category] || RESPONSE_BANKS.general_orientation;
  const bridge = buildContextualBridge(ctx, intent);
  const opening = pickVariant(bank.openings, seed, `${intent.category}-open`, lastAssistant);
  const validation = pickVariant(bank.validations, seed, `${intent.category}-val`, lastAssistant);
  const action1 = pickVariant(bank.actions, seed, `${intent.category}-act1`, lastAssistant);

  // Si el estudiante pregunta directamente qué hacer ("¿qué hago?", "orientación"),
  // entregamos un segundo consejo práctico complementario y omitimos preguntas innecesarias.
  let action2 = "";
  if (ctx.asksDirectAction && bank.actions.length > 1) {
    action2 = pickVariant(
      bank.actions.filter(a => a !== action1),
      seed,
      `${intent.category}-act2`,
      lastAssistant
    );
  }

  // Matiz específico si los apodos son sobre apariencia física
  let specificSubNote = "";
  if (intent.category === "nicknames_humiliation" && intent.subType === "appearance_mockery") {
    specificSubNote =
      "Recuerda especialmente esto: no tienes que cambiar absolutamente nada de tu cuerpo ni de tu apariencia física para merecer respeto.";
  }

  const resourceNote = selectResourceNote(intent, ctx);

  // Regla de preguntas finales:
  // Evitar terminar todos los mensajes con preguntas automáticas innecesarias.
  // Cuando el estudiante pide qué hacer o ya estamos en seguimiento avanzado,
  // cerramos con orientación directa y práctica sin pregunta.
  const shouldIncludeQuestion =
    !ctx.asksDirectAction &&
    ctx.turnCount <= 2 &&
    Array.isArray(bank.questions) &&
    bank.questions.length > 0 &&
    ["general_orientation", "peer_conflict", "social_exclusion", "rumors_gossip"].includes(
      intent.category
    );

  const closingQuestion = shouldIncludeQuestion
    ? pickVariant(bank.questions, seed, `${intent.category}-q`, lastAssistant)
    : "";

  const firstParagraph = [bridge, opening, validation, specificSubNote].filter(Boolean).join(" ");
  const secondParagraph = [action1, action2].filter(Boolean).join(" ");

  return [firstParagraph, secondParagraph, resourceNote, closingQuestion]
    .filter(Boolean)
    .join("\n\n");
}

// -----------------------------------------------------------------------------
// 10. ENDPOINTS HTTP COMPATIBLES CON public/index.html Y RENDER
// -----------------------------------------------------------------------------
app.post("/api/chat", (req, res) => {
  try {
    const incoming = req.body?.messages;
    if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > 16) {
      return res.status(400).json({ error: "Formato de conversación no válido." });
    }

    const sanitizedMessages = [];
    for (const message of incoming.slice(-12)) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string"
      ) {
        return res.status(400).json({ error: "Uno de los mensajes enviados no tiene un formato válido." });
      }
      const trimmed = message.content.trim().slice(0, 1200);
      if (trimmed.length > 0) {
        sanitizedMessages.push({ role: message.role, content: trimmed });
      }
    }

    if (!sanitizedMessages.some(message => message.role === "user")) {
      return res.status(400).json({ error: "No se encontró ningún mensaje del estudiante." });
    }

    const reply = respond(sanitizedMessages);
    return res.json({ reply });
  } catch (error) {
    console.error("Error procesando solicitud en Lumy:", error?.message || "Error desconocido");
    return res.status(500).json({
      error:
        "No se pudo procesar el mensaje en este momento. Si estás en una situación urgente, acude de inmediato a un adulto de confianza o llama al 105 / Línea 100."
    });
  }
});

app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    project: "Lumy",
    version: "2.0.0",
    chatbot: "lumy-contextual-safety-engine",
    openaiRequired: false,
    categoriesSupported: [
      "sexual_violence_protocol",
      "self_harm_crisis",
      "immediate_danger",
      "family_violence",
      "authority_problem",
      "physical_violence",
      "threats_intimidation",
      "cyberbullying",
      "discrimination",
      "rumors_gossip",
      "social_exclusion",
      "nicknames_humiliation",
      "bullying_general",
      "loneliness_emotional",
      "peer_conflict",
      "helping_friend",
      "how_to_ask_help",
      "educational_info",
      "general_orientation"
    ]
  })
);

// Solo inicia el servidor HTTP si el archivo se ejecuta directamente
// (permite importar `respond` o `app` en baterías de pruebas sin conflicto de puertos)
if (process.env.LUMY_TEST_MODE !== "1") {
  app.listen(port, () => {
    console.log(`Lumy v2.0 está funcionando correctamente en el puerto ${port}`);
  });
}

export default app;
