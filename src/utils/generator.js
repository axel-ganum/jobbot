import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export async function generarCarta({ title, description }) {
  const prompt = `
Redacta una carta de presentación corta y profesional en español, ideal para pegar en el campo "Mensaje al reclutador" de Computrabajo.
Debe parecer escrita por la persona que se postula, sin encabezados ni plantillas, y con un tono humano y natural.

Datos del postulante:
- Nombre: ${process.env.NOMBRE_COMPLETO}
- Email: ${process.env.EMAIL_USER}
- LinkedIn: ${process.env.LINKEDIN}

Detalles del puesto:
- Cargo: ${title}
- Descripción del puesto: ${description.slice(0, 400)}

Requisitos de estilo:
- Extensión: entre 8 y 12 líneas.
- Tono: entusiasta, natural y profesional.
- Perfil junior con conocimientos en JavaScript, TypeScript, React, Node.js y NestJS.
- Mencionar experiencia en proyectos personales y académicos, trabajo en equipo y aprendizaje continuo.
- Enfocarse en cómo puede aportar al equipo y crecer profesionalmente.
- No incluir saludos ni encabezados formales ("Estimado/a", "Asunto", etc.).
- Finalizar con un cierre amable y los datos de contacto (nombre, email y LinkedIn).
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
