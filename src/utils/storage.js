import fs from "fs";

const FILE = "./data/enviados.json";

// Crea el archivo si no existe
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({ ids: [] }, null, 2));
}

/**
 * Carga los datos actuales del archivo.
 */
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { ids: [] };
  }
}

/**
 * Guarda los datos actualizados.
 */
function saveData(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/**
 * Verifica si ya se postuló a una oferta.
 */
export function yaPostulado(id) {
  const data = loadData();
  return data.ids.some((item) => item.id === id);
}

/**
 * Marca una oferta como postulada (con fecha actual).
 */
export function marcarPostulado(id) {
  const data = loadData();
  data.ids.push({ id, fecha: Date.now() });
  saveData(data);
}

/**
 * Limpia las ofertas que ya tienen más de X días para liberar espacio.
 * Por defecto: 30 días.
 */
export function limpiarOfertasViejas(dias = 30) {
  const data = loadData();
  const ahora = Date.now();
  const limite = dias * 24 * 60 * 60 * 1000;

  const antes = data.ids.length;
  data.ids = data.ids.filter((item) => ahora - item.fecha < limite);

  const despues = data.ids.length;
  if (antes !== despues) {
    console.log(`🧹 Limpieza automática: ${antes - despues} ofertas antiguas eliminadas.`);
    saveData(data);
  }
}
