import puppeteer from "puppeteer";
import dotenv from "dotenv";
import cron from "node-cron";
import fs from "fs";
import { generarCarta } from "./utils/generator.js";
import { yaPostulado, marcarPostulado, limpiarOfertasViejas } from "./utils/storage.js";

dotenv.config();

const URL = "https://www.computrabajo.com.ar/trabajos-de-programador";

// 🧹 Limpieza semanal (domingo 00:00)
cron.schedule("0 0 * * 0", () => {
  console.log("🧹 Limpiando ofertas antiguas...");
  limpiarOfertasViejas(30);
});

// 🕘 Ejecutar cada día a las 9 AM (hora Argentina → 12 UTC)
cron.schedule("0 12 * * *", () => {
  console.log("🚀 Iniciando bot de postulaciones diarias (hora Argentina)...");
  runBot();
});


async function runBot() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // 🧠 Buscar ofertas
  const ofertas = await page.$$eval(".bRS.bClick", (els) =>
    els.map((el) => ({
      title: el.innerText,
      link: el.getAttribute("href"),
    }))
  );

  let count = 0;

  for (const oferta of ofertas) {
    if (count >= 3) break; // solo 3 por día

    const title = oferta.title.toLowerCase();
    if (!title.includes("remoto")) continue;
    if (!title.includes("junior") && !title.includes("trainee")) continue;

    const id = oferta.link;
    if (yaPostulado(id)) continue;

    console.log("💼 Nueva oferta:", oferta.title);

    await page.goto("https://www.computrabajo.com.ar" + oferta.link, { waitUntil: "domcontentloaded" });

    const description = await page.$eval(".box_detail", (el) => el.innerText);

    const carta = await generarCarta({ title: oferta.title, description });
    console.log("📝 Carta generada:\n", carta);

    try {
      // 💬 Hacer clic en "Postularme"
      const boton = await page.$('a[data-qa="btn-postularme"]');
      if (!boton) {
        console.log("⚠️ No se encontró el botón de postulación, saltando...");
        continue;
      }
      await boton.click();
      await page.waitForTimeout(3000);

      // ✍️ Completar el formulario
      await page.waitForSelector('textarea[name="mensaje"]', { timeout: 10000 });
      await page.type('textarea[name="mensaje"]', carta);

      // 📎 Subir CV si hay campo disponible
      const inputCV = await page.$('input[type="file"]');
      if (inputCV) {
        await inputCV.uploadFile(process.env.CV_PATH);
      }

      // 📤 Enviar formulario
      const enviarBtn = await page.$('button[type="submit"], input[type="submit"]');
      if (enviarBtn) {
        await enviarBtn.click();
        console.log("✅ Postulación enviada correctamente.");
      } else {
        console.log("⚠️ No se encontró el botón de envío.");
      }

      marcarPostulado(id);
      count++;
      await page.waitForTimeout(5000); // espera entre postulaciones

    } catch (err) {
      console.error("❌ Error al postular:", err.message);
    }
  }

  await browser.close();
  console.log(`🎯 Proceso completado. Postulaciones realizadas: ${count}`);
}


