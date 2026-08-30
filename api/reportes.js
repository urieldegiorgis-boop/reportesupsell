// api/reportes.js  —  proyecto Vercel de reportesupsell
//
// Sustituye las llamadas directas del navegador a /rest/v1/reportes_onboarding.
// Esa tabla guarda, dentro del campo `llamadas`, el nombre, el email, la nota y
// el enlace de Fathom de cada llamada, asi que se cierra con RLS y solo se
// accede desde aqui con la clave de servicio.
//
// Usa las mismas variables de entorno que api/config.js:
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY   (service_role, la secreta)
//   APP_PASS
//
// Rutas:
//   GET                                  -> lista de reportes, mas reciente primero
//   POST { action:'insert', row }        -> crea un reporte, devuelve el guardado
//   POST { action:'update', ts, row }    -> actualiza el reporte con ese ts
//   POST { action:'delete', ts }         -> borra el reporte con ese ts

const TABLE = 'reportes_onboarding';

export default async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const APP_PASS = process.env.APP_PASS;

  if (!SB_URL || !SB_KEY || !APP_PASS) {
    return res.status(500).json({ error: 'Faltan variables de entorno en Vercel' });
  }

  const pass = req.headers['x-app-pass'];
  if (!pass || pass !== APP_PASS) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const H = {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json'
  };
  const base = SB_URL + '/rest/v1/' + TABLE;

  try {
    if (req.method === 'GET') {
      const r = await fetch(base + '?select=*&order=fecha.desc', { headers: H });
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return res.status(200).json({ data: await r.json() });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !body.action) {
        return res.status(400).json({ error: 'Falta action' });
      }

      if (body.action === 'insert') {
        if (!body.row) return res.status(400).json({ error: 'Falta row' });
        const r = await fetch(base, {
          method: 'POST',
          headers: { ...H, Prefer: 'return=representation' },
          body: JSON.stringify(body.row)
        });
        const txt = await r.text();
        if (!r.ok) return res.status(502).json({ error: 'Supabase ' + r.status, detail: txt });
        let rows = [];
        try { rows = JSON.parse(txt); } catch (e) {}
        return res.status(200).json({ data: rows[0] || null });
      }

      if (body.action === 'update') {
        if (!body.ts || !body.row) return res.status(400).json({ error: 'Faltan ts o row' });
        const r = await fetch(base + '?ts=eq.' + encodeURIComponent(body.ts), {
          method: 'PATCH',
          headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify(body.row)
        });
        if (!r.ok) {
          const txt = await r.text();
          return res.status(502).json({ error: 'Supabase ' + r.status, detail: txt });
        }
        return res.status(200).json({ ok: true });
      }

      if (body.action === 'delete') {
        if (!body.ts) return res.status(400).json({ error: 'Falta ts' });
        const r = await fetch(base + '?ts=eq.' + encodeURIComponent(body.ts), {
          method: 'DELETE',
          headers: { ...H, Prefer: 'return=minimal' }
        });
        if (!r.ok) {
          const txt = await r.text();
          return res.status(502).json({ error: 'Supabase ' + r.status, detail: txt });
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Action desconocida: ' + body.action });
    }

    return res.status(405).json({ error: 'Metodo no permitido' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
