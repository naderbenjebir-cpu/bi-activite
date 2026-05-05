// pages/api/admin/collaborateur-update.js
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { id, cout_jour_manuel, categorie, sous_type } = req.body;
  if (!id) return res.status(400).json({ error: 'ID manquant' });

  const db = supabaseAdmin();
  const update = { source_cout: 'manuel' };
  if (cout_jour_manuel !== undefined) update.cout_jour_manuel = parseFloat(cout_jour_manuel) || null;
  if (categorie  !== undefined) update.categorie  = categorie;
  if (sous_type  !== undefined) update.sous_type  = sous_type;

  const { error } = await db.from('collaborateurs').update(update).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
}
