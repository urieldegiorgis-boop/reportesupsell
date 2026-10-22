// /api/cc  ·  llamadas del dia de cold caller (tabla reportes_cc)
// Misma autenticacion que /api/reportes: cabecera x-app-pass = APP_PASS.
// Variables de entorno (las mismas del resto de funciones): SUPABASE_URL, SUPABASE_SERVICE_KEY, APP_PASS.
const PERMITIDOS = ['Ivan P.'];                 // quien puede guardar aqui
const CAMPOS = ['assigned','valid','attempts','responses','convos','offers','booked'];

module.exports = async function handler(req, res){
  res.setHeader('Cache-Control','no-store');
  const pass = req.headers['x-app-pass'];
  if(!process.env.APP_PASS || pass !== process.env.APP_PASS){
    return res.status(401).json({ error:'unauthorized' });
  }
  const base = String(process.env.SUPABASE_URL||'').replace(/\/$/,'') + '/rest/v1/reportes_cc';
  const key = process.env.SUPABASE_SERVICE_KEY;
  if(!base.startsWith('http') || !key) return res.status(500).json({ error:'config' });
  const H = { apikey:key, Authorization:'Bearer '+key, 'Content-Type':'application/json' };

  try{
    if(req.method === 'GET'){
      const q = req.query && req.query.quien;
      const quien = PERMITIDOS.includes(q) ? q : PERMITIDOS[0];
      const r = await fetch(base+'?select=*&quien=eq.'+encodeURIComponent(quien)+'&order=fecha.desc&limit=500', { headers:H });
      return res.status(r.ok?200:502).json({ data: r.ok ? await r.json() : [] });
    }
    if(req.method === 'POST'){
      const b = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body||{});
      if(!PERMITIDOS.includes(b.quien)) return res.status(400).json({ error:'quien no permitido' });
      if(!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha||'')) return res.status(400).json({ error:'fecha' });
      const fila = { quien:b.quien, fecha:b.fecha, ts:Date.now() };
      for(const c of CAMPOS){
        const n = Math.round(Number(b[c])||0);
        fila[c] = n < 0 ? 0 : n;
      }
      // sustituye el reporte de ese dia si ya existia
      const d = await fetch(base+'?quien=eq.'+encodeURIComponent(fila.quien)+'&fecha=eq.'+fila.fecha, { method:'DELETE', headers:{...H, Prefer:'return=minimal'} });
      if(!d.ok) return res.status(502).json({ error:'no se pudo sustituir el anterior' });
      const i = await fetch(base, { method:'POST', headers:{...H, Prefer:'return=representation'}, body:JSON.stringify(fila) });
      if(!i.ok) return res.status(502).json({ error:'insert', detalle: await i.text() });
      return res.status(200).json({ ok:true, data: await i.json() });
    }
    if(req.method === 'DELETE'){
      const q = req.query || {};
      if(!PERMITIDOS.includes(q.quien)) return res.status(400).json({ error:'quien no permitido' });
      if(!/^\d{4}-\d{2}-\d{2}$/.test(q.fecha||'')) return res.status(400).json({ error:'fecha' });
      const d = await fetch(base+'?quien=eq.'+encodeURIComponent(q.quien)+'&fecha=eq.'+q.fecha, { method:'DELETE', headers:{...H, Prefer:'return=minimal'} });
      return res.status(d.ok?200:502).json({ ok:d.ok });
    }
    return res.status(405).json({ error:'method' });
  }catch(e){
    return res.status(500).json({ error:'server' });
  }
};
