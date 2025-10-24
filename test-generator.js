import { generarCarta } from "./src/utils/generator.js";

const carta = await generarCarta({
  title: "Desarrollador Junior",
  description: "Buscamos programador con ganas de aprender React y Node.js."
});

console.log(carta);
