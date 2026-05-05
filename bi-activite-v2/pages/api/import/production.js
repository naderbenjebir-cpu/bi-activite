import { supabaseAdmin } from '../../../lib/supabase';
import formidable from 'formidable';
import fs from 'fs';
import * as XLSX from 'xlsx';

export const config = { api: { bodyParser: false } };

function normalizeKey(k) {
  return String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

const COL_MAP = {
  mois_annee:          ['mois/annee','mois annee','mois_annee'],
  entite_collab:       ["entite du collab.","entite collab","entite d'appartenance"],
  collaborateur:       ['collaborateur'],
  nom:                 ['nom','nom d\'usage'],
  prenom:              ['prenom'],
  client:              ['client'],
  client_final:        ['client final'],
  ref_affaire:         ['ref. affaire','ref affaire','reference affaire'],
  objet_affaire:       ["objet de l'affaire",'objet affaire'],
  regie_forfait:       ['regie/forfait','regie forfait'],
  interne_externe:     ['interne/externe','interne externe'],
  societe_intervenante:['societe intervenante'],
  nb_jours:            ['nb de jours','nb jours','nombre de jours'],
  nb_heures:           ["nb d'heures",'nb heures'],
  pv_jour:             ['pv/j','pv jour','prix vente jour'],
  total_ht:            ['total ht'],
  cout_jour:           ['cout/j','cout jour','cou/j'],
  autre_id:            ['autre id','matricule'],
  axes_analytiques:    ['axes analytiques'],
  ref_client:          ['ref client','reference client'],
  commercial:          ['commercial'],
};

function detectColumns(headers) {
  const map = {};
  for (const [field, variants] of Object.entries(COL_MAP)) {
    for (const h of headers) {
      const hn = normalizeKey(h);
      if (variants.some(v => hn.includes(v))) { map[field] = h; break; }
    }
  }
  return map;
}

function parseNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(',','.')) || 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
  const [fields, files] = await form.parse(req);

  const file    = Array.isArray(files.file) ? files.file[0] : files.file;
  const mode    = (Array.isArray(fields.mode) ? fields.mode[0] : fields.mode) || 'fusion';
  const ruleCnext     = (Array.isArray(fields.rule_cnext)     ? fields.rule_cnext[0]     : fields.rule_cnext)     !== 'false';
  const ruleGreentech = (Array.isArray(fields.rule_greentech) ? fields.rule_greentech[0] : fields.rule_greentech) !== 'false';

  if (!file) return res.status(400).json({ error: 'Fichier manquant' });

  const db = supabaseAdmin();

  // Charger référentiel GreenTech
  const { data: gtData } = await db.from('greentech_ref').select('*');
  const greentechMap = {};
  (gtData||[]).forEach(r => { greentechMap[r.collaborateur] = r.cout_jour; });

  // Lire fichier Excel
  const buffer = fs.readFileSync(file.filepath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null });

  if (!raw.length) return res.status(400).json({ error: 'Fichier vide' });

  const colMap = detectColumns(Object.keys(raw[0]));
  let supprimees = 0, couts_corriges = 0;
  const manquants = [];

  const rows = raw.map(r => {
    const out = {};
    for (const [field, col] of Object.entries(colMap)) {
      let v = r[col] ?? null;
      if (['nb_jours','nb_heures','pv_jour','total_ht','cout_jour'].includes(field)) v = parseNum(v);
      out[field] = v;
    }
    return out;
  })
  .filter(r => {
    if (!r.mois_annee) return false;
    if (ruleCnext) {
      const c = (r.client||'').toUpperCase().trim();
      if (c === 'CNEXT CONSULTING' || c === 'CNEXT_INTERNE') { supprimees++; return false; }
    }
    return true;
  })
  .map(r => {
    if (ruleGreentech) {
      const soc = (r.societe_intervenante||'').toUpperCase();
      if (soc.includes('GREENTECH') || soc.includes('GREEN TECH')) {
        const corr = greentechMap[r.collaborateur];
        if (corr != null) { r.cout_jour = corr; couts_corriges++; }
        else manquants.push(r.collaborateur);
      }
    }
    return r;
  });

  // Enregistrer import log
  const moisList = [...new Set(rows.map(r => r.mois_annee).filter(Boolean))];
  const { data: log, error: logErr } = await db.from('imports_log').insert({
    type_import: 'production',
    filename:    file.originalFilename || 'import',
    mode,
    mois_annee:  moisList[0],
    entites:     [...new Set(rows.map(r => r.entite_collab).filter(Boolean))].join(', '),
    lignes:      rows.length,
    ca_total:    rows.reduce((s,r) => s+(r.total_ht||0), 0),
    nb_supprimees: supprimees,
  }).select('id').single();

  if (logErr) return res.status(500).json({ error: logErr.message });
  const importId = log.id;
  const rowsWithId = rows.map(r => ({ ...r, import_id: importId }));

  let nbAjoutes = 0, nbMisAjour = 0, nbRemplaces = 0;

  if (mode === 'remplacement') {
    for (const mois of moisList) {
      const entites = [...new Set(rowsWithId.filter(r => r.mois_annee == mois).map(r => r.entite_collab))];
      for (const entite of entites) {
        await db.from('productions').delete()
          .eq('mois_annee', mois).eq('entite_collab', entite);
        nbRemplaces++;
      }
    }
    // Insert par chunks
    const CHUNK = 200;
    for (let i = 0; i < rowsWithId.length; i += CHUNK) {
      await db.from('productions').insert(rowsWithId.slice(i, i+CHUNK));
    }
    nbAjoutes = rowsWithId.length;
  } else {
    // Fusion par chunks upsert
    const CHUNK = 200;
    for (let i = 0; i < rowsWithId.length; i += CHUNK) {
      const chunk = rowsWithId.slice(i, i+CHUNK);
      const { error } = await db.from('productions').upsert(chunk, {
        onConflict: 'mois_annee,ref_affaire,collaborateur',
        ignoreDuplicates: false,
      });
      if (error) {
        // Fallback : insert un par un
        for (const row of chunk) {
          const { data: ex } = await db.from('productions').select('id')
            .eq('mois_annee', row.mois_annee)
            .eq('ref_affaire', row.ref_affaire||'')
            .eq('collaborateur', row.collaborateur||'')
            .maybeSingle();
          if (ex) { await db.from('productions').update(row).eq('id', ex.id); nbMisAjour++; }
          else { await db.from('productions').insert(row); nbAjoutes++; }
        }
      } else {
        nbAjoutes += chunk.length;
      }
    }
  }

  // Mettre à jour le log
  await db.from('imports_log').update({
    summary: mode === 'remplacement'
      ? `Remplacement : ${nbAjoutes} insérées`
      : `Fusion : ${nbAjoutes} ajoutées / ${nbMisAjour} mises à jour`,
  }).eq('id', importId);

  res.json({
    ok: true, importId, nbAjoutes, nbMisAjour, nbRemplaces,
    supprimees, couts_corriges,
    manquants: [...new Set(manquants)],
    lignes: rows.length,
  });
}
