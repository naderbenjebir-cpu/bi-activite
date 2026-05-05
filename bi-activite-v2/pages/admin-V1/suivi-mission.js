import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { collaborateur, ref_affaire, date_fin_prevue, remarques } = req.body;

  if (!collaborateur || !ref_affaire) {
    return res.status(400).json({ error: 'collaborateur et ref_affaire requis' });
  }

  const db = supabaseAdmin();
  const update = { updated_at: new Date().toISOString() };
  if (date_fin_prevue !== undefined) update.date_fin_prevue = date_fin_prevue || null;
  if (remarques       !== undefined) update.remarques       = remarques || null;

  const { error } = await db.from('suivi_missions')
    .upsert({ collaborateur, ref_affaire, ...update },
      { onConflict: 'collaborateur,ref_affaire' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}
