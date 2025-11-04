import { chromium } from "playwright"; // 👈 usamos Chromium
import dotenv from "dotenv";
import cron from "node-cron";
import fs from "fs";
import { generarCarta } from "./utils/generator.js";
import { yaPostulado, marcarPostulado, limpiarOfertasViejas } from "./utils/storage.js";

dotenv.config();

const MODO_PRUEBA = false; // 👈 modo prueba
const URL = "https://www.computrabajo.com.ar/ofertas-de-trabajo/?q=programador";

// 🧹 Limpieza semanal (domingo 00:00)
// 🧹 Limpieza semanal
cron.schedule("0 0 * * 0", () => {
  console.log("🧹 Limpiando ofertas antiguas...");
  limpiarOfertasViejas(30);
});

// 🕘 Ejecución diaria
cron.schedule("0 12 * * *", () => {
  console.log("🚀 Iniciando bot de postulaciones diarias...");
  runBot();
});

runBot(); // para correrlo manualmente también

async function runBot() {
  const browser = await chromium.launchPersistentContext(
    "./perfil-computrabajo", // 📁 cookies/sesión se guardan acá
    {
      headless: false, // podés poner true en servidor
      slowMo: 50,
    }
  );

  const page = await browser.newPage();

  console.log("🌐 Abriendo Computrabajo...");
  await loginSiEsNecesario(page);

  console.log("✅ Sesión activa, buscando ofertas...");
  await page.goto(URL, { waitUntil: "domcontentloaded" });

  await page
    .waitForSelector("a.js-o-link.fc_base", { timeout: 10000 })
    .catch(() =>
      console.log("⚠️ No se encontró el selector dentro del tiempo esperado")
    );

  console.log("🔄 Haciendo scroll para cargar todas las ofertas...");
  await autoScroll(page);
  console.log("✅ Scroll completo, extrayendo ofertas...");

  await page.waitForTimeout(3000);

  const ofertas = await page.$$eval("a.js-o-link.fc_base", els =>
    els.map(el => ({
      title: el.innerText.trim(),
      link: el.href.startsWith("http")
        ? el.href
        : `https://www.computrabajo.com.ar${el.getAttribute("href")}`,
    }))
  );

  console.log(`🔎 Se encontraron ${ofertas.length} ofertas`);
  let count = 0;

  for (const [i, oferta] of ofertas.entries()) {
    console.log(`\n📌 Oferta #${i + 1}: ${oferta.title}`);
    console.log("Link:", oferta.link);
    if (count >= 3) break; // máximo 3 por día

    const title = oferta.title.toLowerCase();

    if (!title.includes("remoto")) {
      console.log("❌ Se omite por no ser remoto");
      continue;
    }

    if (!title.includes("junior") && !title.includes("trainee")) {
      console.log("❌ Se omite por no ser junior o trainee");
      continue;
    }

    await page.goto(oferta.link, { waitUntil: "domcontentloaded" });
    const description = await page.$eval(".box_detail", el => el.innerText);

    const tecnologias = [
      "javascript", "typescript", "react", "next", "node",
      "nestjs", "express", "bootstrap", "tailwind"
    ];

    const descripcionMin = description.toLowerCase();
    const tieneTecnologia = tecnologias.some(
      tech => title.includes(tech) || descripcionMin.includes(tech)
    );

    if (!tieneTecnologia) {
      console.log(`⚠️ Omitiendo oferta sin tecnologías relevantes: ${oferta.title}`);
      continue;
    }

    const id = oferta.link;
    if (yaPostulado(id)) continue;

    console.log("💼 Nueva oferta:", oferta.title);
    const carta = await generarCarta({ title: oferta.title, description });
    console.log("📝 Carta generada:\n", carta);

    try {
      if (MODO_PRUEBA) {
        console.log("🧩 [MODO PRUEBA] Simulando postulación...");
        marcarPostulado(id);
        count++;
        continue;
      }

      const boton = await page.$('a[data-qa="btn-postularme"]');
      if (!boton) {
        console.log("⚠️ No se encontró el botón de postulación, saltando...");
        continue;
      }

      await boton.click();
      await page.waitForTimeout(3000);

      await page.waitForSelector('textarea[name="mensaje"]', { timeout: 10000 });
      await page.type('textarea[name="mensaje"]', carta);

      const inputCV = await page.$('input[type="file"]');
      if (inputCV) {
        await inputCV.setInputFiles(process.env.CV_PATH);
      }

      const enviarBtn = await page.$('button[type="submit"], input[type="submit"]');
      if (enviarBtn) {
        await enviarBtn.click();
        console.log("✅ Postulación enviada correctamente.");
      } else {
        console.log("⚠️ No se encontró el botón de envío.");
      }

      marcarPostulado(id);
      count++;
      await page.waitForTimeout(5000);
    } catch (err) {
      console.error("❌ Error al postular:", err.message);
    }
  }

  await browser.close();
  console.log(`🎯 Proceso completado. Postulaciones: ${count}`);
}

// 🔐 Login automático solo si hace falta
async function loginSiEsNecesario(page) {
  await page.goto("https://candidato.ar.computrabajo.com/candidate/home", {
    waitUntil: "domcontentloaded",
  });

  const loginForm = await page.$('form[action*="login"], input[name="password"]');
  if (loginForm) {
    console.log("🔐 No estás logueado. Iniciando sesión...");
    await page.fill('input[name="email"]', process.env.EMAIL);
    await page.fill('input[name="password"]', process.env.PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    console.log("✅ Login exitoso. Sesión guardada en ./perfil-computrabajo/");
  } else {
    console.log("✅ Ya estás logueado.");
  }
}

// 🖱️ Scroll automático
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
}