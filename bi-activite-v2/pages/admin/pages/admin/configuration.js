import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtNum } from '../../lib/utils';

function Toast({ msg, type, onClose }) {
  useEffect(()=>{const t=setTimeout(onClose,3500);return()=>clearTimeout(t);},[]);
  const c={success:'#16a34a',error:'#ef4444',warn:'#f97316',info:'#1e50a0'}[type]||'#1e50a0';
  return(<div style={{position:'fixed',bottom:24,right:24,background:'var(--bg2)',border:`1px solid ${c}`,borderLeft:`4px solid ${c}`,borderRadius:8,padding:'12px 18px',fontSize:13,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:200,maxWidth:440,lineHeight:1.5}}>{msg}<button onClick={onClose} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:16}}>×</button></div>);
}

const SERVICE_MAP = [
  {service:'Conseil technique',    categorie:'operationnel',sous_type:'consultant'},
  {service:'Conseil fonctionnelle',categorie:'operationnel',sous_type:'consultant'},
  {service:'DSI',                  categorie:'operationnel',sous_type:'dsi'},
  {service:'Direction',            categorie:'back-office', sous_type:'dirigeant'},
  {service:'Direction commerciale',categorie:'back-office', sous_type:'commercial'},
  {service:'DRH',                  categorie:'back-office', sous_type:'rh'},
  {service:'Suivi RH',             categorie:'back-office', sous_type:'rh'},
];

const FICHIERS = [
  {prefix:'ProductionMensuelle_',     exemple:'ProductionMensuelle_20260412.xlsx',     page:'Admin → Import mensuel',   couleur:'#1e50a0',
   desc:"Export mensuel de l'outil de gestion. Lignes de production facturées : collaborateurs, clients, affaires, jours, PV et coûts.",
   colonnes:['Mois/Année','Entité du collab.','Collaborateur','Client','Client final','Réf. affaire','Objet de l\'affaire','Nb de jours','PV/j','Total HT','Coût/j']},
  {prefix:'IndicateursSurActiviteJ_', exemple:'IndicateursSurActiviteJ_20260412.xlsx',  page:'Admin → Import KPI',       couleur:'#7c3aed',
   desc:"Fichier matriciel collaborateurs × indicateurs × mois. Alimente Inter-contrat, Back-Office, TACE et Suivi mission.",
   colonnes:['Collaborateurs','Indicateurs','1/2025 … 12/2025'],
   indicateurs:["Jours potentiels","Jours produits","Jours d'inter-contrat","Coût moyen (EUR HT)","TACE (%)","TACI (%)","TJM (EUR HT)"]},
  {prefix:'ListeSalaries_',           exemple:'ListeSalaries_20260412.xlsx',           page:'Admin → Collaborateurs',   couleur:'#16a34a',
   desc:"Référentiel RH complet. Tous les salariés avec dates d'entrée et sortie. Date sortie vide = encore en poste.",
   colonnes:["Entité d'appartenance","Matricule","Nom d'usage","Prénom","Service","Type de contrat","Date d'entrée","Date de sortie","Motif de départ"]},
  {prefix:'Correction_CENXTGreenTech',exemple:'Correction_CENXTGreenTech.xlsx',        page:'Admin → Configuration → GreenTech', couleur:'#f97316',
   desc:"Coûts journaliers des collaborateurs CNEXT GreenTech. Appliqué automatiquement si la règle GreenTech est activée à l'import.",
   colonnes:['Collaborateur','Client','Client final','Coût/j']},
];

function ResetCard({ action, showToast }) {
  const [confirmText,setConfirmText]=useState('');
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false);

  async function doReset(){
    if(confirmText!==action.confirm){showToast(`Tapez exactement : ${action.confirm}`,'warn');return;}
    setLoading(true);
    try{
      const r=await fetch('/api/admin/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tables:action.tables,confirm:confirmText})});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Erreur');
      showToast(`✓ ${action.label} effectué`,'success');
      setOpen(false);setConfirmText('');
    }catch(e){showToast('Erreur : '+e.message,'error');}
    setLoading(false);
  }

  return(
    <div style={{background:'var(--bg2)',border:`1px solid ${action.color}30`,borderLeft:`4px solid ${action.color}`,borderRadius:10,padding:'16px 20px',marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:500,color:action.color,marginBottom:3}}>{action.label}</div>
          <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>{action.desc}</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {action.tables.map(t=><span key={t} style={{fontSize:10,fontFamily:'var(--mono)',background:'var(--bg3)',color:'var(--muted)',padding:'2px 7px',borderRadius:4}}>{t}</span>)}
          </div>
        </div>
        <button onClick={()=>setOpen(o=>!o)} style={{padding:'7px 16px',borderRadius:7,border:`1px solid ${action.color}`,background:'transparent',color:action.color,fontSize:12,cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}>
          {open?'Annuler':'Réinitialiser'}
        </button>
      </div>
      {open&&(
        <div style={{marginTop:14,padding:'14px 16px',background:'rgba(239,68,68,.04)',borderRadius:8,border:'1px solid #fecaca'}}>
          <div style={{fontSize:12,color:'#b91c1c',marginBottom:8}}>
            Tapez pour confirmer : <strong style={{fontFamily:'var(--mono)'}}>{action.confirm}</strong>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder={action.confirm}
              style={{padding:'6px 10px',border:'1px solid #fca5a5',borderRadius:6,fontSize:12,fontFamily:'var(--mono)',background:'var(--bg)',color:'var(--text)',width:220}}/>
            <button onClick={doReset} disabled={loading||confirmText!==action.confirm}
              style={{padding:'7px 16px',borderRadius:7,border:'none',background:confirmText===action.confirm?action.color:'#d1d5db',color:'#fff',fontSize:12,cursor:confirmText===action.confirm?'pointer':'not-allowed',fontWeight:500}}>
              {loading?'En cours...':'Confirmer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminConfiguration() {
  const [tab,      setTab]      = useState('greentech');
  const [greentech,setGreentech]= useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [editGT,   setEditGT]   = useState({});
  const [newGT,    setNewGT]    = useState({collaborateur:'',cout_jour:''});
  const fileRef = useRef(null);

  useEffect(()=>{loadGreentech();},[]);

  async function loadGreentech(){
    setLoading(true);
    const {data}=await supabase.from('greentech_ref').select('*').order('collaborateur');
    setGreentech(data||[]);setLoading(false);
  }

  function showToast(msg,type='info'){setToast({msg,type});}

  async function saveGT(id,field,value){
    const {error}=await supabase.from('greentech_ref').update({[field]:value}).eq('id',id);
    if(error){showToast('Erreur : '+error.message,'error');return;}
    setGreentech(prev=>prev.map(r=>r.id===id?{...r,[field]:value}:r));
    setEditGT(prev=>{const n={...prev};delete n[`${id}_${field}`];return n;});
    showToast('✓ Mis à jour','success');
  }

  async function addGT(){
    if(!newGT.collaborateur||!newGT.cout_jour){showToast('Remplissez tous les champs','warn');return;}
    const {data,error}=await supabase.from('greentech_ref').insert({collaborateur:newGT.collaborateur,cout_jour:parseFloat(newGT.cout_jour)}).select().single();
    if(error){showToast('Erreur : '+error.message,'error');return;}
    setGreentech(prev=>[...prev,data]);setNewGT({collaborateur:'',cout_jour:''});
    showToast('✓ Ajouté','success');
  }

  async function deleteGT(id){
    await supabase.from('greentech_ref').delete().eq('id',id);
    setGreentech(prev=>prev.filter(r=>r.id!==id));
    showToast('Supprimé','warn');
  }

  async function importGT(file){
    try{
      const XLSX=await import('xlsx');
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const raw=XLSX.utils.sheet_to_json(ws,{defval:null});
      await supabase.from('greentech_ref').delete().neq('id',0);
      const rows=raw.map(r=>({
        collaborateur:r['Collaborateur']||r['collaborateur']||'',
        client:r['Client']||r['client']||null,
        client_final:r['Client final']||r['client_final']||null,
        cout_jour:parseFloat(String(r['Coût/j']||r['cout_jour']||0).replace(',','.'))||0,
      })).filter(r=>r.collaborateur&&r.cout_jour>0);
      const {error}=await supabase.from('greentech_ref').insert(rows);
      if(error)throw new Error(error.message);
      showToast(`✓ ${rows.length} entrées importées`,'success');
      await loadGreentech();
    }catch(e){showToast('Erreur : '+e.message,'error');}
  }

  const tabStyle=(k)=>({padding:'8px 16px',fontSize:11,fontFamily:'var(--mono)',cursor:'pointer',background:'none',border:'none',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:tab===k?'2px solid var(--orange)':'2px solid transparent',color:tab===k?'var(--blue)':'var(--muted)',fontWeight:tab===k?500:400,marginBottom:-1});

  const RESETS=[
    {label:'Vider les KPIs',       desc:'Supprime kpi_mensuels et cout_backoffice_mensuel.',tables:['kpi_mensuels','cout_backoffice_mensuel'],color:'#f97316',confirm:'vider-kpi'},
    {label:'Vider les productions', desc:'Supprime toutes les lignes de production.',        tables:['productions'],                          color:'#ef4444',confirm:'vider-productions'},
    {label:'Vider les collaborateurs',desc:'Supprime le référentiel RH.',                   tables:['collaborateurs'],                       color:'#ef4444',confirm:'vider-collaborateurs'},
    {label:'Reset complet',         desc:'Supprime TOUTES les données. Repart de zéro.',    tables:['productions','kpi_mensuels','cout_backoffice_mensuel','suivi_missions','corrections_log','imports_log','collaborateurs','greentech_ref'],color:'#7f1d1d',confirm:'reset-complet'},
  ];

  return(
    <div>
      {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Configuration</span>
      </div>
      <div className="page-body">

        <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:24}}>
          <button style={tabStyle('greentech')} onClick={()=>setTab('greentech')}>GreenTech</button>
          <button style={tabStyle('fichiers')}  onClick={()=>setTab('fichiers')}>Fichiers sources</button>
          <button style={tabStyle('mapping')}   onClick={()=>setTab('mapping')}>Mapping services</button>
          <button style={{...tabStyle('reset'),color:tab==='reset'?'#ef4444':undefined}} onClick={()=>setTab('reset')}>⚠ Reset base</button>
        </div>

        {/* ── GreenTech ── */}
        {tab==='greentech'&&(
          <div>
            <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
              <div style={{fontSize:13,color:'var(--muted)',flex:1}}>Coûts journaliers CNEXT GreenTech — appliqués automatiquement à l'import si la règle est activée.</div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={e=>{if(e.target.files[0])importGT(e.target.files[0]);e.target.value='';}}/>
              <button className="btn btn-ghost" onClick={()=>fileRef.current?.click()}>↑ Importer xlsx</button>
            </div>
            <div className="table-wrap">
              <div className="table-header"><span className="table-title">Référentiel GreenTech ({greentech.length})</span></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Collaborateur</th><th>Client</th><th>Client final</th><th>Coût/j</th><th>Actions</th></tr></thead>
                  <tbody>
                    {greentech.map(r=>(
                      <tr key={r.id}>
                        <td style={{fontWeight:500}}>{r.collaborateur}</td>
                        <td className="td-muted">{r.client||'—'}</td>
                        <td className="td-muted">{r.client_final||'—'}</td>
                        <td className="td-right">
                          {editGT[`${r.id}_cout`]!==undefined?(
                            <input type="number" value={editGT[`${r.id}_cout`]} autoFocus
                              onChange={e=>setEditGT(p=>({...p,[`${r.id}_cout`]:e.target.value}))}
                              onBlur={()=>saveGT(r.id,'cout_jour',parseFloat(editGT[`${r.id}_cout`]))}
                              onKeyDown={e=>e.key==='Enter'&&saveGT(r.id,'cout_jour',parseFloat(editGT[`${r.id}_cout`]))}
                              style={{width:80,fontFamily:'var(--mono)',fontSize:12,padding:'2px 6px',border:'1px solid var(--orange)',borderRadius:4,background:'var(--bg)'}}/>
                          ):(
                            <span onClick={()=>setEditGT(p=>({...p,[`${r.id}_cout`]:r.cout_jour}))}
                              style={{cursor:'pointer',padding:'2px 6px',borderRadius:4,fontFamily:'var(--mono)',border:'1px solid transparent'}}
                              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
                              onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}>
                              {fmtNum(r.cout_jour,0)} €/j
                            </span>
                          )}
                        </td>
                        <td><button className="btn btn-danger" style={{padding:'3px 10px',fontSize:11}} onClick={()=>deleteGT(r.id)}>Supprimer</button></td>
                      </tr>
                    ))}
                    <tr style={{background:'rgba(30,80,160,.02)'}}>
                      <td><input value={newGT.collaborateur} onChange={e=>setNewGT(p=>({...p,collaborateur:e.target.value}))} placeholder="Nom collaborateur" style={{width:'100%',fontSize:12,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:4,background:'var(--bg)'}}/></td>
                      <td colSpan={2}><span style={{fontSize:11,color:'var(--muted)'}}>Optionnel</span></td>
                      <td><input type="number" value={newGT.cout_jour} onChange={e=>setNewGT(p=>({...p,cout_jour:e.target.value}))} placeholder="€/j" style={{width:80,fontSize:12,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:4,background:'var(--bg)',fontFamily:'var(--mono)'}}/></td>
                      <td><button className="btn btn-primary" style={{padding:'4px 12px',fontSize:11}} onClick={addGT}>+ Ajouter</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Fichiers sources ── */}
        {tab==='fichiers'&&(
          <div>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:20}}>Référence des fichiers sources attendus par l'application.</div>
            {FICHIERS.map(f=>(
              <div key={f.prefix} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderLeft:`4px solid ${f.couleur}`,borderRadius:10,padding:'16px 20px',marginBottom:16,display:'flex',gap:16,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:280}}>
                  <div style={{fontFamily:'var(--mono)',fontSize:13,fontWeight:500,color:f.couleur,marginBottom:4}}>
                    {f.prefix}<span style={{color:'var(--muted)'}}>YYYYMMDD.xlsx</span>
                  </div>
                  <div style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>{f.desc}</div>
                  <div style={{fontSize:11,color:'var(--blue)',fontFamily:'var(--mono)'}}>↗ {f.page}</div>
                </div>
                <div style={{minWidth:200}}>
                  <div style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Colonnes clés</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {f.colonnes.map(c=><span key={c} style={{fontSize:10,fontFamily:'var(--mono)',background:'var(--bg3)',color:'var(--text)',padding:'2px 7px',borderRadius:4}}>{c}</span>)}
                  </div>
                  {f.indicateurs&&<div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:4}}>
                    {f.indicateurs.map(i=><span key={i} style={{fontSize:10,fontFamily:'var(--mono)',background:'rgba(124,58,237,.08)',color:'var(--purple)',padding:'2px 7px',borderRadius:4}}>{i}</span>)}
                  </div>}
                  <div style={{marginTop:10,fontSize:11,color:'var(--muted)'}}>Ex : <span style={{fontFamily:'var(--mono)',color:'var(--text)'}}>{f.exemple}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Mapping ── */}
        {tab==='mapping'&&(
          <div>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:16}}>Règle appliquée à l'import du fichier ListeSalaries. Modifiez individuellement dans Admin → Collaborateurs.</div>
            <div className="table-wrap">
              <div className="table-header"><span className="table-title">Mapping Service → Catégorie</span></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Service</th><th>Catégorie</th><th>Sous-type</th></tr></thead>
                  <tbody>
                    {SERVICE_MAP.map((r,i)=>(
                      <tr key={i}>
                        <td style={{fontWeight:500}}>{r.service}</td>
                        <td><span className={`badge ${r.categorie==='operationnel'?'badge-blue':'badge-purple'}`}>{r.categorie}</span></td>
                        <td className="td-muted">{r.sous_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Reset ── */}
        {tab==='reset'&&(
          <div>
            <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'16px 20px',marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:500,color:'#b91c1c',marginBottom:6}}>⚠ Zone dangereuse — opérations irréversibles</div>
              <div style={{fontSize:12,color:'#7f1d1d'}}>Ces actions suppriment définitivement des données de Supabase. Elles ne peuvent pas être annulées.</div>
            </div>
            {RESETS.map(a=><ResetCard key={a.label} action={a} showToast={showToast}/>)}
          </div>
        )}

      </div>
    </div>
  );
}
