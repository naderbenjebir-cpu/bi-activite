import { supabaseAdmin } from '../../../lib/supabase';
import formidable from 'formidable';
import fs from 'fs';
import * as XLSX from 'xlsx';

export const config = { api: { bodyParser: false } };

const SERVICE_MAP = {
  'Conseil technique':     { categorie:'operationnel', sous_type:'consultant' },
  'Conseil fonctionnelle': { categorie:'operationnel', sous_type:'consultant' },
  'DSI':                   { categorie:'operationnel', sous_type:'dsi'        },
  'Direction':             { categorie:'back-office',  sous_type:'dirigeant'  },
  'Direction commerciale': { categorie:'back-office',  sous_type:'commercial' },
  'DRH':                   { categorie:'back-office',  sous_type:'rh'         },
  'Suivi RH':              { categorie:'back-office',  sous_type:'rh'         },
};

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0,10);
  if (typeof v==='string'&&v.match(/\d{4}-\d{2}-\d{2}/)) return v.slice(0,10);
  if (typeof v==='number') return new Date((v-25569)*86400*1000).toISOString().slice(0,10);
  return null;
}

export default async function handler(req, res) {
  if (req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });

  const form=formidable({maxFileSize:10*1024*1024});
  const [,files]=await form.parse(req);
  const file=Array.isArray(files.file)?files.file[0]:files.file;
  if (!file) return res.status(400).json({ error:'Fichier manquant' });

  const db  = supabaseAdmin();
  const buf = fs.readFileSync(file.filepath);
  const wb  = XLSX.read(buf,{type:'buffer',cellDates:true});
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws,{defval:null});

  const rows = raw.map(r=>{
    const service=r['Service']||'';
    const cat=SERVICE_MAP[service]||{categorie:'operationnel',sous_type:'consultant'};
    return {
      matricule:      r['Matricule']||null,
      autre_id:       r['Autre Id']||null,
      nom:            r["Nom d'usage"]||r['Nom de naissance']||'',
      prenom:         (r['Prénom']||'').trim(),
      entite:         r["Entité d'appartenance"]||r['Entité juridique']||'CNEXT Consulting',
      service:        service||null,
      categorie:      cat.categorie,
      sous_type:      cat.sous_type,
      fonction:       r['Fonction (utilisateur)']||null,
      intitule_poste: r['Intitulé du poste']||null,
      type_contrat:   r['Type de contrat']||null,
      date_entree:    parseDate(r["Date d'entrée"]),
      date_sortie:    parseDate(r['Date de sortie']),
      motif_depart:   r['Motif de départ']||null,
      source_cout:    'manuel',
    };
  }).filter(r=>r.nom);

  let nbAjoutes=0,nbMisAjour=0;
  for (const row of rows) {
    const {data:ex}=await db.from('collaborateurs').select('id,cout_jour_manuel,source_cout')
      .eq('nom',row.nom).eq('prenom',row.prenom||'').maybeSingle();
    if (ex) {
      if (ex.source_cout==='manuel'&&ex.cout_jour_manuel) { row.cout_jour_manuel=ex.cout_jour_manuel; }
      await db.from('collaborateurs').update(row).eq('id',ex.id);
      nbMisAjour++;
    } else {
      await db.from('collaborateurs').insert(row);
      nbAjoutes++;
    }
  }

  await db.from('imports_log').insert({
    type_import:'salaries',filename:file.originalFilename||'salaries',
    lignes:rows.length,summary:`${nbAjoutes} ajoutés, ${nbMisAjour} mis à jour`,
  });

  res.json({ ok:true, nbAjoutes, nbMisAjour, total:rows.length });
}
