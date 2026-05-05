import { supabaseAdmin } from '../../../lib/supabase';
import formidable from 'formidable';
import fs from 'fs';
import * as XLSX from 'xlsx';

export const config = { api: { bodyParser: false } };

const KPI_FIELDS = {
  'Jours potentiels':                  'jours_potentiels',
  'Jours produits':                    'jours_produits',
  "Jours d'inter-contrat":             'jours_intercontrat',
  'Coût moyen (EUR HT)':               'cout_moyen_j',
  'TACE (%)':                          'tace',
  'TACI (%)':                          'taci',
  'TJM (EUR HT)':                      'tjm',
  'Ratio (%)':                         'ratio',
  'Heures supplémentaires (en jours)': 'heures_sup',
};

function parseMoisCol(col) {
  if (!col||typeof col!=='string') return null;
  const m = col.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return parseInt(m[2])*100+parseInt(m[1]);
}

function num(v) { if(v==null)return 0; if(typeof v==='number')return v; return parseFloat(String(v).replace(',','.'))||0; }

export default async function handler(req, res) {
  if (req.method!=='POST') return res.status(405).json({ error:'Method not allowed' });

  const form = formidable({ maxFileSize:20*1024*1024 });
  const [,files] = await form.parse(req);
  const file = Array.isArray(files.file)?files.file[0]:files.file;
  if (!file) return res.status(400).json({ error:'Fichier manquant' });

  const db  = supabaseAdmin();
  const buf = fs.readFileSync(file.filepath);
  const wb  = XLSX.read(buf,{type:'buffer'});
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  if (raw.length<2) return res.status(400).json({ error:'Fichier KPI vide' });

  const headers  = raw[0];
  const moisCols = [];
  for (let i=2;i<headers.length-1;i++) {
    const ma=parseMoisCol(headers[i]);
    if (ma) moisCols.push({idx:i,mois_annee:ma});
  }

  const byCollab = {};
  for (const row of raw.slice(1)) {
    const collab=row[0]; const indicCol=row[1];
    if (!collab||!indicCol) continue;
    const field=KPI_FIELDS[indicCol];
    if (!field) continue;
    if (!byCollab[collab]) byCollab[collab]={};
    for (const {idx,mois_annee} of moisCols) {
      const val=num(row[idx]);
      if (!byCollab[collab][mois_annee]) byCollab[collab][mois_annee]={};
      byCollab[collab][mois_annee][field]=val;
    }
  }

  const rows = [];
  for (const [collab,moisData] of Object.entries(byCollab)) {
    for (const [ma,kpis] of Object.entries(moisData)) {
      if ((kpis.jours_potentiels||0)===0) continue;
      rows.push({
        mois_annee:         parseInt(ma),
        collaborateur:      collab,
        jours_potentiels:   kpis.jours_potentiels  ||0,
        jours_produits:     kpis.jours_produits     ||0,
        jours_intercontrat: kpis.jours_intercontrat ||0,
        cout_moyen_j:       kpis.cout_moyen_j       ||0,
        tace:               kpis.tace               ||0,
        taci:               kpis.taci               ||0,
        tjm:                kpis.tjm                ||0,
        heures_sup:         kpis.heures_sup         ||0,
      });
    }
  }

  const moisList=[...new Set(rows.map(r=>r.mois_annee))];
  const {data:log}=await db.from('imports_log').insert({
    type_import:'kpi',filename:file.originalFilename||'kpi',mode:'fusion',
    mois_annee:moisList[0],lignes:rows.length,
  }).select('id').single();

  let nbAjoutes=0,nbMisAjour=0;
  const CHUNK=100;
  for (let i=0;i<rows.length;i+=CHUNK) {
    const chunk=rows.slice(i,i+CHUNK).map(r=>({...r,import_id:log.id}));
    const {error}=await db.from('kpi_mensuels').upsert(chunk,{onConflict:'mois_annee,collaborateur'});
    if (error) nbMisAjour+=chunk.length; else nbAjoutes+=chunk.length;
  }

  // Générer coûts back-office
  for (const mois of moisList) {
    await db.rpc('generer_cout_backoffice',{p_mois_annee:mois});
  }

  res.json({ ok:true, lignes:rows.length, nbAjoutes, nbMisAjour, moisList });
}
