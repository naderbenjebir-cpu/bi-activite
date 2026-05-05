import { useState, useEffect } from 'react';
import { useFilters } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { fmtNum, fmtEur, formatMois } from '../../lib/utils';

// ── Helpers ─────────────────────────────────────────────────
function anciennete(dateEntree, dateSortie) {
  if (!dateEntree) return { label: '—', mois: 0 };
  const debut = new Date(dateEntree);
  const fin   = dateSortie ? new Date(dateSortie) : new Date();
  const mois  = (fin.getFullYear() - debut.getFullYear()) * 12 + (fin.getMonth() - debut.getMonth());
  const ans   = Math.floor(mois / 12);
  const m     = mois % 12;
  return { label: ans === 0 ? `${m} mois` : m === 0 ? `${ans} an${ans>1?'s':''}` : `${ans} an${ans>1?'s':''} ${m} mois`, mois };
}

function isNouveau(dateEntree) {
  if (!dateEntree) return false;
  const now  = new Date();
  const diff = (now.getFullYear() - new Date(dateEntree).getFullYear()) * 12
             + (now.getMonth() - new Date(dateEntree).getMonth());
  return diff < 2;
}

function statutColor(s) {
  if (s === 'mission')           return 'badge-green';
  if (s === 'inter-contrat')     return 'badge-red';
  if (s === 'mission-partielle') return 'badge-orange';
  return 'badge-gray';
}

function contratCourt(t) {
  if (!t) return '—';
  if (t.includes('indéterminée')) return 'CDI';
  if (t.includes('déterminée'))   return 'CDD';
  if (t.includes('apprentissage'))return 'Apprenti';
  if (t.includes('stage'))        return 'Stage';
  return t.slice(0,8);
}

const MOIS_NOMS = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

export default function RH() {
  const { filters } = useFilters();

  const [collabs,    setCollabs]    = useState([]);
  const [kpiData,    setKpiData]    = useState({});
  const [kpiPeriode, setKpiPeriode] = useState({});  // KPIs sur la période filtrée
  const [externes,   setExternes]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterCollab, setFilterCollab] = useState('');
  const [annees,     setAnnees]     = useState([]);
  const [filterAnneeDebut, setFilterAnneeDebut] = useState('');
  const [filterAnneeFin,   setFilterAnneeFin]   = useState('');
  const [filterMoisDebut,  setFilterMoisDebut]  = useState('');
  const [filterMoisFin,    setFilterMoisFin]    = useState('');

  useEffect(() => { loadData(); },
    [filters.entite, filterAnneeDebut, filterAnneeFin, filterMoisDebut, filterMoisFin]);

  async function loadData() {
    setLoading(true);

    // Bornes période
    const bd = filterMoisDebut ? parseInt(filterMoisDebut)
             : filterAnneeDebut ? parseInt(filterAnneeDebut)*100+1 : null;
    const bf = filterMoisFin   ? parseInt(filterMoisFin)
             : filterAnneeFin  ? parseInt(filterAnneeFin)*100+12  : null;

    // 1. Charger tous les collaborateurs
    const { data: collabData } = await supabase
      .from('collaborateurs').select('*').order('nom');

    // 2. KPI PRJ moyen 12 derniers mois (toujours sur 12 mois glissants)
    const now   = new Date();
    const m12   = (now.getFullYear()-1)*100 + (now.getMonth()+1);
    const { data: kpi12 } = await supabase.from('kpi_mensuels')
      .select('collaborateur, mois_annee, cout_moyen_j, statut_mois')
      .gte('mois_annee', m12);

    const kpiMap = {};
    (kpi12||[]).forEach(r => {
      const k = r.collaborateur;
      if (!kpiMap[k]) kpiMap[k] = { couts:[], dernierMois:0, dernierStatut:null };
      if (r.cout_moyen_j > 0) kpiMap[k].couts.push(r.cout_moyen_j);
      if (r.mois_annee > kpiMap[k].dernierMois) {
        kpiMap[k].dernierMois   = r.mois_annee;
        kpiMap[k].dernierStatut = r.statut_mois;
      }
    });
    Object.keys(kpiMap).forEach(k => {
      const c = kpiMap[k].couts;
      kpiMap[k].prj_moyen = c.length>0 ? c.reduce((s,v)=>s+v,0)/c.length : null;
    });

    // 3. KPI sur la période filtrée (pour KPIs dynamiques)
    let kpiQ = supabase.from('kpi_mensuels')
      .select('collaborateur, statut_mois, jours_produits, jours_intercontrat, cout_intercontrat');
    if (bd) kpiQ = kpiQ.gte('mois_annee', bd);
    if (bf) kpiQ = kpiQ.lte('mois_annee', bf);
    const { data: kpiPer } = await kpiQ;

    const kpiPerMap = {};
    (kpiPer||[]).forEach(r => {
      const k = r.collaborateur;
      if (!kpiPerMap[k]) kpiPerMap[k] = { statuts:[], joursIC:0, coutIC:0 };
      kpiPerMap[k].statuts.push(r.statut_mois);
      kpiPerMap[k].joursIC  += parseFloat(r.jours_intercontrat)||0;
      kpiPerMap[k].coutIC   += parseFloat(r.cout_intercontrat)||0;
    });
    // Dernier statut sur la période
    Object.keys(kpiPerMap).forEach(k => {
      const s = kpiPerMap[k].statuts;
      kpiPerMap[k].statutPeriode =
        s.includes('inter-contrat')     ? 'inter-contrat'     :
        s.includes('mission-partielle') ? 'mission-partielle' :
        s.includes('mission')           ? 'mission'           : 'inactif';
    });

    // 4. Statut auto : opérationnel actif sans KPI → inter-contrat
    (collabData||[]).forEach(c => {
      const nom = `${c.nom} ${c.prenom||''}`.trim();
      if (c.categorie==='operationnel' && !c.date_sortie && !kpiMap[nom]) {
        kpiMap[nom] = { couts:[], dernierMois:0, dernierStatut:'inter-contrat', prj_moyen:null };
      }
      if (c.categorie==='operationnel' && !c.date_sortie && !kpiPerMap[nom]) {
        kpiPerMap[nom] = { statuts:['inter-contrat'], joursIC:0, coutIC:0, statutPeriode:'inter-contrat' };
      }
    });

    // 5. Productions externes sur la période
    let prodQ = supabase.from('productions')
      .select('collaborateur, client, client_final, ref_affaire, objet_affaire, mois_annee, nb_jours, total_ht, cout_total, marge_brute, societe_intervenante')
      .eq('interne_externe', 'Externe');
    if (filters.entite) prodQ = prodQ.eq('entite_collab', filters.entite);
    if (bd) prodQ = prodQ.gte('mois_annee', bd);
    if (bf) prodQ = prodQ.lte('mois_annee', bf);
    const { data: prodExt } = await prodQ;

    // Agréger par collaborateur externe
    const extMap = {};
    (prodExt||[]).forEach(r => {
      const k = r.collaborateur;
      if (!extMap[k]) extMap[k] = {
        collaborateur: k, societe: r.societe_intervenante,
        affaires: {}, moisSet: new Set(),
        jours:0, ca:0, cout:0, marge:0,
      };
      extMap[k].jours += parseFloat(r.nb_jours)||0;
      extMap[k].ca    += parseFloat(r.total_ht)||0;
      extMap[k].cout  += parseFloat(r.cout_total)||0;
      extMap[k].marge += parseFloat(r.marge_brute)||0;
      extMap[k].moisSet.add(r.mois_annee);
      const affKey = r.ref_affaire;
      if (!extMap[k].affaires[affKey]) {
        extMap[k].affaires[affKey] = { ref:r.ref_affaire, objet:r.objet_affaire, client:r.client, client_final:r.client_final, jours:0, ca:0, moisMin:r.mois_annee, moisMax:r.mois_annee };
      }
      extMap[k].affaires[affKey].jours += parseFloat(r.nb_jours)||0;
      extMap[k].affaires[affKey].ca    += parseFloat(r.total_ht)||0;
      if (r.mois_annee < extMap[k].affaires[affKey].moisMin) extMap[k].affaires[affKey].moisMin = r.mois_annee;
      if (r.mois_annee > extMap[k].affaires[affKey].moisMax) extMap[k].affaires[affKey].moisMax = r.mois_annee;
    });
    const extList = Object.values(extMap)
      .map(e => ({ ...e, tjm: e.jours>0?e.ca/e.jours:0, taux: e.ca>0?e.marge/e.ca*100:0,
        affairesList: Object.values(e.affaires).sort((a,b)=>b.ca-a.ca), nbMois: e.moisSet.size }))
      .sort((a,b) => b.ca - a.ca);

    // Années disponibles
    const anneesSet = new Set();
    (collabData||[]).forEach(c => {
      if (c.date_entree) anneesSet.add(c.date_entree.slice(0,4));
      if (c.date_sortie) anneesSet.add(c.date_sortie.slice(0,4));
    });

    setCollabs(collabData||[]);
    setKpiData(kpiMap);
    setKpiPeriode(kpiPerMap);
    setExternes(extList);
    setAnnees([...anneesSet].sort().reverse());
    setLoading(false);
  }

  // Filtrage collaborateurs internes
  const collabFiltered = collabs.filter(c => {
    if (filterCollab && !(`${c.nom} ${c.prenom||''}`).toLowerCase().includes(filterCollab.toLowerCase())) return false;
    const bd = filterMoisDebut ? parseInt(filterMoisDebut)
             : filterAnneeDebut ? parseInt(filterAnneeDebut)*100+1 : null;
    const bf = filterMoisFin   ? parseInt(filterMoisFin)
             : filterAnneeFin  ? parseInt(filterAnneeFin)*100+12  : null;
    if (bd && c.date_entree) {
      const ma = parseInt(c.date_entree.slice(0,4))*100+parseInt(c.date_entree.slice(5,7));
      if (bf && ma > bf) return false;
    }
    if (bf && c.date_sortie) {
      const ma = parseInt(c.date_sortie.slice(0,4))*100+parseInt(c.date_sortie.slice(5,7));
      if (bd && ma < bd) return false;
    }
    return true;
  });

  const actifs   = collabFiltered.filter(c => !c.date_sortie);
  const sortants = collabFiltered.filter(c =>  c.date_sortie).sort((a,b)=>b.date_sortie.localeCompare(a.date_sortie));
  const now3m    = new Date(); now3m.setMonth(now3m.getMonth()-3);

  // KPIs dynamiques sur la période
  const nbActifs        = actifs.length;
  const nbOperationnels = actifs.filter(c=>c.categorie==='operationnel').length;
  const nbBackOffice    = actifs.filter(c=>c.categorie==='back-office').length;
  const nbNouveaux      = actifs.filter(c=>isNouveau(c.date_entree)).length;
  const nbSortantsR     = sortants.filter(c=>new Date(c.date_sortie)>now3m).length;
  const nbExternes      = externes.length;

  // IC dynamique depuis kpiPeriode
  const nbIC = actifs.filter(c => {
    const nom = `${c.nom} ${c.prenom||''}`.trim();
    const kp  = kpiPeriode[nom];
    if (!kp) return c.categorie==='operationnel'; // sans KPI = IC par défaut
    return kp.statutPeriode==='inter-contrat' || kp.statutPeriode==='mission-partielle';
  }).length;

  const totalJoursIC  = Object.values(kpiPeriode).reduce((s,k)=>s+k.joursIC,0);
  const totalCoutIC   = Object.values(kpiPeriode).reduce((s,k)=>s+k.coutIC,0);

  // ── Ligne collaborateur interne ──
  function CollabRow({ c, showSortie=false }) {
    const nom    = `${c.nom} ${c.prenom||''}`.trim();
    const kpi    = kpiData[nom]   || {};
    const kpiper = kpiPeriode[nom]|| {};
    const anc    = anciennete(c.date_entree, c.date_sortie);
    const nouveau     = !showSortie && isNouveau(c.date_entree);
    const sortieRecente = showSortie && c.date_sortie && new Date(c.date_sortie)>now3m;
    const statut = kpiper.statutPeriode || kpi.dernierStatut || (c.categorie==='operationnel'?'inter-contrat':'back-office');

    return (
      <tr>
        <td>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontWeight:500}}>{nom}</span>
            {nouveau      && <span className="badge" style={{background:'#dcfce7',color:'#15803d',fontSize:9}}>NOUVEAU</span>}
            {sortieRecente && <span className="badge" style={{background:'#fef2f2',color:'#b91c1c',fontSize:9}}>RÉCENT</span>}
          </div>
          <div style={{fontSize:10,color:'var(--muted)',marginTop:2}}>{c.intitule_poste||c.fonction||'—'}</div>
        </td>
        <td><span className={`badge ${c.categorie==='operationnel'?'badge-blue':'badge-purple'}`}>{c.categorie}</span></td>
        <td className="td-muted">{c.service||'—'}</td>
        <td style={{fontFamily:'var(--mono)',fontSize:11}}>{contratCourt(c.type_contrat)}</td>
        <td style={{fontSize:11}}>{c.date_entree?new Date(c.date_entree).toLocaleDateString('fr-FR'):'—'}</td>
        {showSortie && <td style={{fontSize:11,color:'var(--red)'}}>{c.date_sortie?new Date(c.date_sortie).toLocaleDateString('fr-FR'):'—'}</td>}
        {showSortie && <td className="td-muted" style={{fontSize:11}}>{c.motif_depart||'—'}</td>}
        <td className="td-muted" style={{fontSize:11}}>{anc.label}</td>
        {!showSortie && <td className="td-right" style={{fontFamily:'var(--mono)',fontSize:11}}>{kpi.prj_moyen?`${fmtNum(kpi.prj_moyen,0)} €/j`:'—'}</td>}
        {!showSortie && (
          <td>
            <span className={`badge ${statutColor(statut)}`}>{statut}</span>
            {kpiper.joursIC>0 && <span style={{fontSize:10,color:'var(--red)',marginLeft:4}}>{fmtNum(kpiper.joursIC,1)}j IC</span>}
          </td>
        )}
        {!showSortie && <td style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--muted)'}}>{kpi.dernierMois?formatMois(kpi.dernierMois):'—'}</td>}
      </tr>
    );
  }

  // ── Ligne externe ──
  const [expandedExt, setExpandedExt] = useState({});
  function toggleExt(nom) { setExpandedExt(p=>({...p,[nom]:!p[nom]})); }

  if (loading) return (
    <div>
      <div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--muted)'}}>RH / Effectifs</span></div>
      <div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>RH / Effectifs</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>
          {nbActifs} actifs · {sortants.length} sortis · {nbExternes} externes
        </span>
      </div>
      <div className="page-body">

        {/* ── KPIs dynamiques ── */}
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(6,1fr)',marginBottom:20}}>
          <div className="kpi-card" style={{borderTopColor:'#1e50a0'}}>
            <div className="kpi-label">Effectif actif</div>
            <div className="kpi-val" style={{color:'#1e50a0'}}>{nbActifs}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#16a34a'}}>
            <div className="kpi-label">Opérationnels</div>
            <div className="kpi-val" style={{color:'#16a34a'}}>{nbOperationnels}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#7c3aed'}}>
            <div className="kpi-label">Back-Office</div>
            <div className="kpi-val" style={{color:'#7c3aed'}}>{nbBackOffice}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#ef4444'}}>
            <div className="kpi-label">Inter-contrat</div>
            <div className="kpi-val" style={{color:'#ef4444'}}>{nbIC}</div>
            <div className="kpi-sub">{fmtNum(totalJoursIC,1)}j · {fmtEur(totalCoutIC)}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#0ea5e9'}}>
            <div className="kpi-label">Externes actifs</div>
            <div className="kpi-val" style={{color:'#0ea5e9'}}>{nbExternes}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#f97316'}}>
            <div className="kpi-label">Nouveaux / Sortants</div>
            <div className="kpi-val" style={{color:'#f97316'}}>{nbNouveaux} / {nbSortantsR}</div>
          </div>
        </div>

        {/* ── Filtres ── */}
        <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap',alignItems:'flex-end'}}>
          {[
            {label:'Année début', val:filterAnneeDebut, set:setFilterAnneeDebut, opts:annees, w:110},
            {label:'Mois début',  val:filterMoisDebut,  set:setFilterMoisDebut,  opts:null,   w:90},
          ].map(f => (
            <div key={f.label}>
              <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:3,fontFamily:'var(--mono)'}}>{f.label}</label>
              <select className="filter-select" style={{width:f.w}} value={f.val} onChange={e=>f.set(e.target.value)}>
                <option value="">—</option>
                {f.opts ? f.opts.map(a=><option key={a}>{a}</option>)
                  : ['01','02','03','04','05','06','07','08','09','10','11','12'].map(m=>(
                    <option key={m} value={m}>{MOIS_NOMS[parseInt(m)]}</option>
                  ))}
              </select>
            </div>
          ))}
          <div style={{color:'var(--muted)',paddingBottom:4,fontSize:16}}>→</div>
          {[
            {label:'Année fin', val:filterAnneeFin, set:setFilterAnneeFin, opts:annees, w:110},
            {label:'Mois fin',  val:filterMoisFin,  set:setFilterMoisFin,  opts:null,   w:90},
          ].map(f => (
            <div key={f.label}>
              <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:3,fontFamily:'var(--mono)'}}>{f.label}</label>
              <select className="filter-select" style={{width:f.w}} value={f.val} onChange={e=>f.set(e.target.value)}>
                <option value="">—</option>
                {f.opts ? f.opts.map(a=><option key={a}>{a}</option>)
                  : ['01','02','03','04','05','06','07','08','09','10','11','12'].map(m=>(
                    <option key={m} value={m}>{MOIS_NOMS[parseInt(m)]}</option>
                  ))}
              </select>
            </div>
          ))}
          <div>
            <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:3,fontFamily:'var(--mono)'}}>Rechercher</label>
            <input type="text" value={filterCollab} onChange={e=>setFilterCollab(e.target.value)}
              placeholder="Nom..." style={{padding:'5px 10px',border:'1px solid var(--border)',
                borderRadius:6,fontSize:12,background:'var(--bg)',color:'var(--text)',width:180}} />
          </div>
          {(filterAnneeDebut||filterAnneeFin||filterMoisDebut||filterMoisFin||filterCollab) && (
            <button className="btn btn-ghost" onClick={()=>{
              setFilterAnneeDebut('');setFilterAnneeFin('');
              setFilterMoisDebut('');setFilterMoisFin('');setFilterCollab('');
            }}>Réinitialiser</button>
          )}
        </div>

        {/* ── Bloc ACTIFS ── */}
        <div className="table-wrap" style={{marginBottom:24}}>
          <div className="table-header" style={{background:'rgba(30,80,160,.04)'}}>
            <span className="table-title" style={{color:'var(--blue)'}}>Collaborateurs actifs ({actifs.length})</span>
            <span style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>PRJ = Prix de Revient Journalier moyen 12 mois</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>Collaborateur</th><th>Catégorie</th><th>Service</th>
                <th>Contrat</th><th>Entrée</th><th>Ancienneté</th>
                <th>PRJ moy.</th><th>Statut période</th><th>Mois KPI</th>
              </tr></thead>
              <tbody>
                {actifs.length===0
                  ? <tr><td colSpan={9} style={{textAlign:'center',color:'var(--muted)',padding:20}}>Aucun collaborateur actif</td></tr>
                  : actifs.map(c=><CollabRow key={c.id} c={c}/>)}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bloc EXTERNES ── */}
        <div className="table-wrap" style={{marginBottom:24}}>
          <div className="table-header" style={{background:'rgba(14,165,233,.04)'}}>
            <span className="table-title" style={{color:'#0369a1'}}>Collaborateurs externes ({externes.length})</span>
            <span style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>Déduit des missions · cliquez ▶ pour le détail des affaires</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th></th>
                <th>Collaborateur</th><th>Société</th>
                <th>Nb affaires</th><th>Nb mois</th>
                <th>Jours</th><th>CA HT</th><th>TJM</th>
                <th>Marge</th><th>Taux</th>
              </tr></thead>
              <tbody>
                {externes.length===0
                  ? <tr><td colSpan={10} style={{textAlign:'center',color:'var(--muted)',padding:20}}>Aucun externe sur la période</td></tr>
                  : externes.map(e => {
                    const expanded = expandedExt[e.collaborateur];
                    const tc = e.taux>=20?'td-green':e.taux>=10?'':'td-red';
                    return [
                      <tr key={e.collaborateur} style={{cursor:'pointer'}} onClick={()=>toggleExt(e.collaborateur)}>
                        <td style={{width:24,color:'var(--muted)',fontSize:12}}>{expanded?'▼':'▶'}</td>
                        <td style={{fontWeight:500}}>{e.collaborateur}</td>
                        <td className="td-muted" style={{fontSize:11}}>{e.societe||'—'}</td>
                        <td className="td-right">{e.affairesList.length}</td>
                        <td className="td-right">{e.nbMois}</td>
                        <td className="td-right">{fmtNum(e.jours,1)}j</td>
                        <td className="td-right">{fmtEur(e.ca)}</td>
                        <td className="td-right">{fmtEur(e.tjm)}</td>
                        <td className={`td-right ${tc}`}>{fmtEur(e.marge)}</td>
                        <td className={`td-right ${tc}`}>{fmtNum(e.taux,1)}%</td>
                      </tr>,
                      expanded && e.affairesList.map((a,i) => (
                        <tr key={`${e.collaborateur}-${i}`} style={{background:'rgba(14,165,233,.04)'}}>
                          <td></td>
                          <td colSpan={2} style={{paddingLeft:24,fontSize:11}}>
                            <span style={{fontFamily:'var(--mono)',fontSize:10,color:'var(--blue)'}}>{a.ref}</span>
                            <span style={{color:'var(--muted)',marginLeft:8}}>{a.objet||'—'}</span>
                          </td>
                          <td className="td-muted" style={{fontSize:11}}>{a.client}</td>
                          <td className="td-muted" style={{fontSize:11}}>{a.client_final}</td>
                          <td className="td-right" style={{fontSize:11}}>{fmtNum(a.jours,1)}j</td>
                          <td className="td-right" style={{fontSize:11}}>{fmtEur(a.ca)}</td>
                          <td className="td-right td-muted" style={{fontSize:10}}>
                            {formatMois(a.moisMin)}{a.moisMax!==a.moisMin?` → ${formatMois(a.moisMax)}`:''}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      ))
                    ];
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bloc SORTANTS ── */}
        <div className="table-wrap">
          <div className="table-header" style={{background:'rgba(239,68,68,.03)'}}>
            <span className="table-title" style={{color:'#b91c1c'}}>Collaborateurs sortis ({sortants.length})</span>
            {nbSortantsR>0 && <span style={{fontSize:10,color:'#b91c1c',fontFamily:'var(--mono)'}}>{nbSortantsR} sortie{nbSortantsR>1?'s':''} récente{nbSortantsR>1?'s':''}</span>}
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>Collaborateur</th><th>Catégorie</th><th>Service</th>
                <th>Contrat</th><th>Entrée</th><th>Sortie</th>
                <th>Motif</th><th>Durée</th>
              </tr></thead>
              <tbody>
                {sortants.length===0
                  ? <tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:20}}>Aucun collaborateur sorti</td></tr>
                  : sortants.map(c=><CollabRow key={c.id} c={c} showSortie/>)}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
