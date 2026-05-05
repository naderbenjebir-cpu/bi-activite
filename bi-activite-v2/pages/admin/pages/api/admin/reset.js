import { supabaseAdmin } from '../../../lib/supabase';

const ALLOWED = ['productions','kpi_mensuels','cout_backoffice_mensuel','collaborateurs','greentech_ref','imports_log','corrections_log','suivi_missions'];
const VALID_CONFIRMS = ['vider-kpi','vider-productions','vider-collaborateurs','reset-complet'];
const ORDER = ['productions','kpi_mensuels','cout_backoffice_mensuel','corrections_log','suivi_missions','imports_log','collaborateurs','greentech_ref'];

export default async function handler(req, res) {
  if (req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });
  const { tables, confirm } = req.body;
  if (!VALID_CONFIRMS.includes(confirm)) return res.status(400).json({ error:'Confirmation invalide' });
  if (!Array.isArray(tables)||!tables.length) return res.status(400).json({ error:'Tables manquantes' });
  const invalid = tables.filter(t=>!ALLOWED.includes(t));
  if (invalid.length) return res.status(400).json({ error:`Tables non autorisées : ${invalid.join(', ')}` });

  const db = supabaseAdmin();
  const results = [];
  for (const table of ORDER.filter(t=>tables.includes(t))) {
    const {error} = await db.from(table).delete().neq('id',0);
    if (error) return res.status(500).json({ error:`Erreur sur ${table} : ${error.message}` });
    results.push({ table });
  }
  res.json({ ok:true, results });
}
