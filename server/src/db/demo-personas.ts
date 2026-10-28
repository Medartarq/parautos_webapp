/**
 * Generador determinista de personas ficticias para la base demo.
 *
 * No usa `Math.random`: el mismo índice produce siempre la misma persona, de
 * modo que la carga es reproducible en local y en Hostinger.
 */

const FIRST_NAMES = [
  "José", "María", "Carlos", "Ana", "Luis", "Rosa", "Jorge", "Carmen", "Miguel", "Patricia",
  "Juan", "Lucía", "Pedro", "Elena", "Ricardo", "Sofía", "Fernando", "Gabriela", "Julio", "Verónica",
  "Andrés", "Daniela", "Raúl", "Mónica", "Óscar", "Claudia", "Eduardo", "Silvia", "Marco", "Natalia",
  "Diego", "Carolina", "Víctor", "Paola", "Hugo", "Andrea", "César", "Rocío", "Iván", "Teresa",
  "Sergio", "Isabel", "Álvaro", "Milagros", "Renzo", "Fiorella", "Gianfranco", "Vanessa", "Bryan", "Yuliana",
  "Kevin", "Melisa", "Anthony", "Katherine", "Braulio", "Lesly", "Jhon", "Marisol", "Percy", "Elsa",
  "Rubén", "Gladys", "Wilfredo", "Norma", "Édgar", "Alicia", "Orlando", "Beatriz", "Frank", "Liliana",
  "Cristian", "Yolanda", "Alonso", "Pilar", "Rodrigo", "Cecilia", "Emilio", "Roxana", "Pablo", "Miriam",
] as const;

const LAST_NAMES = [
  "Quispe", "Flores", "Sánchez", "Huamán", "García", "Rodríguez", "Torres", "Ramírez", "Vargas", "Castillo",
  "Rojas", "Mendoza", "Chávez", "Salazar", "Paredes", "Vega", "Medina", "Cruz", "Gutiérrez", "Aguilar",
  "Espinoza", "Mamani", "Condori", "Ccahuana", "Puma", "Nina", "Apaza", "Choque", "Coaquira", "Ticona",
  "Lupaca", "Cáceres", "Fernández", "López", "Martínez", "Pérez", "González", "Díaz", "Muñoz", "Romero",
  "Herrera", "Jiménez", "Ruiz", "Ortiz", "Silva", "Núñez", "Cabrera", "Ríos", "Campos", "Fuentes",
  "Carrasco", "Palacios", "Rivera", "Sandoval", "Contreras", "Maldonado", "Valdez", "Benites", "Yupanqui", "Sullca",
  "Pariona", "Ñaupari", "Valerio", "Ayala", "Bravo", "Delgado", "Ponce", "Zamora", "Berrocal", "Echevarría",
] as const;

export type DemoPersona = { fullName: string; email: string; phone: string };

/** Hash entero de 32 bits, estable para un mismo número. */
export function demoHash(value: number): number {
  let x = (value + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Devuelve nombre, correo y teléfono ficticios para el índice indicado.
 * El correo conserva el dominio reservado `demo.parautos.pe`, que identifica
 * el lote para una limpieza controlada.
 */
export function personaFor(index: number): DemoPersona {
  const seed = demoHash(index);
  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const paternalIndex = (seed >>> 8) % LAST_NAMES.length;
  const rawMaternalIndex = (seed >>> 16) % LAST_NAMES.length;
  const maternalIndex = rawMaternalIndex === paternalIndex ? (rawMaternalIndex + 1) % LAST_NAMES.length : rawMaternalIndex;
  const paternal = LAST_NAMES[paternalIndex];
  const maternal = LAST_NAMES[maternalIndex];

  return {
    fullName: `${first} ${paternal} ${maternal}`,
    email: `${slug(first)}.${slug(paternal)}${(seed % 90) + 10}@demo.parautos.pe`,
    phone: `9${String(10_000_000 + (seed % 90_000_000)).slice(0, 8)}`,
  };
}
