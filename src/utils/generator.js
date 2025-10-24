import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export async function generarCarta({ title, description }) {
  const prompt = `
Escribe una carta de presentación profesional en español, lista para enviar por email, 
sin encabezados tipo "Asunto" ni campos entre corchetes.
Debe parecer escrita directamente por la persona que se postula.
Datos del postulante:
- Nombre: ${process.env.NOMBRE_COMPLETO}
- Email: ${process.env.EMAIL_USER}
- LinkedIn: ${process.env.LINKEDIN}

Puesto: ${title}
Descripción del puesto: ${description.slice(0, 400)}

Estilo:
- Tono entusiasta, sincero y profesional.
- Breve (8–12 líneas máximo).
- Perfil junior con conocimientos en JavaScript, TypeScript y React.
- Terminar con un saludo final y firma con los datos del postulante.
  `;

  const response = await axios.post(
   "https://router.huggingface.co/v1/chat/completions"
,
    {
      model: process.env.HF_MODEL,
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
 let carta = response.data.choices?.[0]?.message?.content?.trim() || "";

  // 🧹 Limpieza por si el modelo deja frases introductorias
  carta = carta
    .replace(/^.*(aquí tienes|claro|por supuesto|te dejo|esta es|he redactado).*$/gim, "")
    .replace(/\[.*?\]/g, "")
    .replace(/---+/g, "")
    .replace(/^\s+|\s+$/g, "")
    .trim();

  // Mensaje de fallback si no devuelve texto
  if (!carta) carta = "Estimado equipo, me interesa postularme para este puesto.";

  return carta;
}
