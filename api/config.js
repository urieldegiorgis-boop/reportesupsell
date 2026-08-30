// api/config.js  —  proyecto Vercel de reportesupsell
//
// Sustituye las llamadas directas del navegador a /rest/v1/appdata.
// La clave de servicio de Supabase vive SOLO aqui, en variables de entorno,
// y nunca se manda al cliente.
//
// Variables de entorno a crear en Vercel (Settings -> Environment Variables):
//   SUPABASE_URL          https://hseluvpwqjgallfyzori.supabase.co
//   SUPABASE_SERVICE_KEY  la clave service_role (Supabase -> Settings -> API)
//   APP_PASS              la contrasena que pedira la app para entrar
//
// IMPORTANTE: la service_role se salta RLS. No la pongas nunca en el HTML.

const CFG_ID = 3;

export default async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const APP_PASS = process.env.APP_PASS;

  if (!SB_URL || !SB_KEY || !APP_PASS) {
    return res.status(500).json({ error: 'Faltan variables de entorno en Vercel' });
  }

  // Toda peticion, de lectura o de escritura, exige la contrasena.
  const pass = req.headers['x-app-pass'];
  if (!pass || pass !== APP_PASS) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const H = {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json'
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(
        SB_URL + '/rest/v1/appdata?id=eq.' + CFG_ID + '&select=value',
        { headers: H }
      );
      if (!r.ok) throw new Error('Supabase ' + r.status);
      const rows = await r.json();
      const value = rows && rows[0] ? rows[0].value : null;
      return res.status(200).json({ value });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body.value !== 'string') {
        return res.status(400).json({ error: 'Falta value' });
      }
      // Upsert: crea la fila si no existe, la actualiza si existe.
      const r = await fetch(SB_URL + '/rest/v1/appdata', {
        method: 'POST',
        headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: CFG_ID, value: body.value })
      });
      if (!r.ok) {
        const txt = await r.text();
        return res.status(502).json({ error: 'Supabase ' + r.status, detail: txt });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Metodo no permitido' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
