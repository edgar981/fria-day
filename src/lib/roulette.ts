/**
 * Catálogo de la ruleta (Pasada RU) — lógica pura, sin dependencias de servidor.
 *
 * Seis dinámicas, tres retos cada una (18). El catálogo vive EN CÓDIGO (son pocos y los
 * cura Edgar); la base solo guarda las CLAVES estables (`dynamicKey`, `challengeKey`),
 * nunca el texto, que puede cambiar sin migración.
 *
 * Reglas no negociables (RU · §6 y §7), codificadas también como tests:
 *  - Ningún reto ordena beber, sirve ni castiga con alcohol.
 *  - "Paso" es un derecho absoluto y sin penalización: ningún reto se lo quita.
 *
 * Corrección aplicada (RU · §6, decisión de Edgar = Opción A): la nota original de
 * `tapazo-1` decía "ronda extra sin derecho a paso" — contradecía el derecho al paso.
 * Reescrita para quitar el castigo.
 */

export interface RouletteChallenge {
  /** Clave estable `${dynamicKey}-${n}` — es lo que se persiste, no el texto. */
  key: string;
  text: string;
  note: string;
}

export interface RouletteDynamic {
  /** Clave estable de la dinámica — lo que se persiste. */
  key: string;
  name: string;
  /** Frase corta para el menú de dinámicas. */
  pitch: string;
  /** Cómo funciona; se muestra en la pantalla de jugadores. */
  rule: string;
  challenges: RouletteChallenge[];
}

export const ROULETTE_DYNAMICS: RouletteDynamic[] = [
  {
    key: "tapazo",
    name: "El tapazo",
    pitch: "Cada quien pone su tapa. La ruleta elige una.",
    rule: "Todos ponen su tapa boca arriba en el centro. La ruleta reparte una casilla por tapa y gira: a quien le caiga, le tocó el tapazo.",
    challenges: [
      // §6 Opción A: nota reescrita (antes: "Si pierdes una, ronda extra sin derecho a paso").
      { key: "tapazo-1", text: "Te toca el tapazo: guardas todas las tapas de la mesa hasta el final de la noche.", note: "Al final se cuenta cuántas conservaste. Nada más." },
      { key: "tapazo-2", text: "Destapas todo lo que llegue a la mesa durante la próxima media hora.", note: "Sin quejarte y sin delegar." },
      { key: "tapazo-3", text: "Tu tapa se queda de trofeo: la pegas en la foto de la salida.", note: "Súbela al registro antes de irse." },
    ],
  },
  {
    key: "cronista",
    name: "El cronista",
    pitch: "Al que pierda le toca dejar el registro.",
    rule: "Gira una vez. Quien pierda queda a cargo del registro de la salida durante la próxima hora: fotos, nombres, calificaciones.",
    challenges: [
      { key: "cronista-1", text: "Calificas las próximas tres bebidas de la mesa. En voz alta y con argumento.", note: "Queda escrito en el catálogo con tu nombre." },
      { key: "cronista-2", text: "Subes la foto de la salida. Una, buena, ahora.", note: "Si a los diez minutos no hay foto, gira otra vez." },
      { key: "cronista-3", text: "Le pones nombre a esta salida y así queda para siempre en el feed.", note: "El parche no puede vetarlo." },
    ],
  },
  {
    key: "bautizo",
    name: "El bautizo",
    pitch: "El que pierde nombra — y carga con el nombre.",
    rule: "Gira. Al perdedor le toca bautizar algo del parche, pero el parche escoge qué: el grupo de WhatsApp, la salida, o a sí mismo.",
    challenges: [
      { key: "bautizo-1", text: "Cambias el nombre del grupo de WhatsApp y no se toca en una semana.", note: "Tú eliges el nombre. Ahí está la trampa." },
      { key: "bautizo-2", text: "Te ganas un apodo puesto por la mesa. Rige hasta la próxima salida.", note: "En la app se te pone como nota de la salida." },
      { key: "bautizo-3", text: "Bautizas la ronda con un nombre que tengas que decir completo cada vez que la pidas.", note: "Mínimo cuatro palabras." },
    ],
  },
  {
    key: "estatua",
    name: "La estatua",
    pitch: "Tonto, físico, inmediato.",
    rule: "Gira. Al perdedor le toca algo ridículo y corto ahí mismo, en la mesa. Se acaba en dos minutos y no deja consecuencias.",
    challenges: [
      { key: "estatua-1", text: "No puedes usar las manos hasta que llegue lo próximo a la mesa.", note: "Alguien de la mesa te ayuda. Alguien, no todos." },
      { key: "estatua-2", text: "Contestas solo con preguntas durante los próximos cinco minutos.", note: "Si afirmas algo, se gira de nuevo." },
      { key: "estatua-3", text: "Te quedas de pie hasta que alguien más pierda una ronda.", note: "Puedes moverte. Sentarte no." },
    ],
  },
  {
    key: "embajador",
    name: "El embajador",
    pitch: "Social: te toca hablar con gente de afuera.",
    rule: "Gira. El perdedor sale de la burbuja del parche: le toca una misión social breve con alguien que no está en la mesa.",
    challenges: [
      { key: "embajador-1", text: "Le preguntas al bar cuál es la que más sale y la traes como recomendación.", note: "No tienes que pedirla. Solo traer el dato." },
      { key: "embajador-2", text: "Consigues que otra mesa te diga a qué vinieron a celebrar.", note: "Vuelves con la historia completa." },
      { key: "embajador-3", text: "Le pides al que pone la música una canción que elija la mesa por ti.", note: "Tú la pides. Ellos la eligen." },
    ],
  },
  {
    key: "cuenta",
    name: "La cuenta chiquita",
    pitch: "Plata simbólica, nunca la cuenta entera.",
    rule: "Gira. Al perdedor le toca un gasto pequeño y ridículo: nunca la cuenta, nunca una bebida de nadie.",
    challenges: [
      { key: "cuenta-1", text: "Pagas la próxima canción de la rocola. La elige el de tu izquierda.", note: "Si no hay rocola, pagas el domicilio del regreso de uno." },
      { key: "cuenta-2", text: "Pagas el primer taxi que salga de aquí, sea de quien sea.", note: "Aunque no sea el tuyo." },
      { key: "cuenta-3", text: "Traes algo de comer para la mesa. Lo que sea, pero para todos.", note: "Mínimo lo que alcance a probar cada uno." },
    ],
  },
];

const DYN_BY_KEY = new Map(ROULETTE_DYNAMICS.map((d) => [d.key, d]));
const CHALLENGE_BY_KEY = new Map(
  ROULETTE_DYNAMICS.flatMap((d) => d.challenges.map((c) => [c.key, { dynamic: d, challenge: c }] as const)),
);

export const ROULETTE_DYNAMIC_KEYS = ROULETTE_DYNAMICS.map((d) => d.key);

export function isRouletteDynamicKey(key: string): boolean {
  return DYN_BY_KEY.has(key);
}

export function getRouletteDynamic(key: string): RouletteDynamic | undefined {
  return DYN_BY_KEY.get(key);
}

/** Resuelve una clave de reto a su dinámica + reto (para render y validación). */
export function getRouletteChallenge(
  challengeKey: string,
): { dynamic: RouletteDynamic; challenge: RouletteChallenge } | undefined {
  return CHALLENGE_BY_KEY.get(challengeKey);
}

/** Claves de los retos de una dinámica — el servidor elige una al azar. */
export function challengeKeysFor(dynamicKey: string): string[] {
  return DYN_BY_KEY.get(dynamicKey)?.challenges.map((c) => c.key) ?? [];
}
