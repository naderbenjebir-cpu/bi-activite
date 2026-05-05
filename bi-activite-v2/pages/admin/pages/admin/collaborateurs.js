import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtNum } from '../../lib/utils';

function Toast({ msg, type, onClose }) {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[]);
  const c={success:'#16a34a',error:'#ef4444',warn:'#f97316',info:'#1e50a0'}[type]||'#1e50a0';
  return(<div style={{position:'fixed',bottom:24,right:24,background:'var(--bg2)',border:`1px solid ${c}`,borderLeft:`4px solid ${c}`,borderRadius:8,padding:'12px 18px',fontSize:13,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:200}}>{msg}<button onClick={onClose} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',color:'var(--muted)',fontSize:16}}>×</button></div>);
}

const CATS = ['operationnel','back-office'];
const SOUS = ['consultant','dsi','commercial','rh','dirigeant','autre'];

function EditCell({ value, onSave, type='number', options }) {
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(value||'');
  const ref=useRef(null);
  useEffect(()=>{if(editing&&ref.current)ref.current.focus();},[editing]);
  useEffect(()=>{setVal(value||'');},[value]);
  function save(){setEditing(false);if(String(val)!==String(value||''))onSave(val);}
  if(!editing)return(
    <div onClick={()=>setEditing(true)} style={{cursor:'pointer',padding:'2px 6px',borderRadius:4,minWidth:60,border:'1px solid transparent',transition:'all .15s'}}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}>
      {value?type==='number'?`${fmtNum(value,0)} €/j`:value:<span style={{color:'var(--red)',fontSize:11}}>⚠ Manquant</span>}
    </div>
  );
  if(options)return(<select ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={save} style={{fontSize:12,padding:'2px 6px',border:'1px solid var(--orange)',borderRadius:4,background:'var(--bg)'}}>{options.map(o=><option key={o}>{o}</option>)}</select>);
  return(<input ref={ref} type={type} value={val} onChange={e=>setVal(e.target.value)} onBlur={save} onKeyDown={e=>e.key==='Enter'&&save()} style={{width:80,fontSize:12,padding:'2px 6px',border:'1px solid var(--orange)',borderRadius:4,background:'var(--bg)',fontFamily:'var(--mono)'}}/>);
}

export default function AdminCollaborateurs() {
  const [collabs, setCollabs]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast,   setToast]     = useState(null);
  const [filter,  setFilter]    = useState('all');
  const [importing,setImporting]= useState(false);
  const fileRef = useRef(null);

  useEffect(()=>{loadCollabs();},[]);

  async function loadCollabs(){
    setLoading(true);
    const {data}=await supabase.from('v_collaborateurs_statut').select('*').order('nom');
    setCollabs(data||[]);setLoading(false);
  }

  function showToast(msg,type='info'){setToast({msg,type});}

  async function updateCollab(id,field,value){
    try{
      const body={id};
      if(field==='cout_jour_manuel')body.cout_jour_manuel=value;
      if(field==='categorie')body.categorie=value;
      if(field==='sous_type')body.sous_type=value;
      const r=await fetch('/api/admin/collaborateur-update',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok)throw new Error('Erreur serveur');
      setCollabs(prev=>prev.map(c=>c.id===id?{...c,[field]:value}:c));
      showToast('✓ Mis à jour','success');
    }catch(e){showToast('Erreur : '+e.message,'error');}
  }

  async function importSalaries(f){
    if(!f?.name?.startsWith('ListeSalaries_')){showToast(`⚠ Fichier refusé : "${f?.name}"\nAttendu : ListeSalaries_YYYYMMDD.xlsx`,'error');return;}
    setImporting(true);
    try{
      const fd=new FormData();fd.append('file',f);
      const r=await fetch('/api/import/salaries',{method:'POST',body:fd});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error);
      showToast(`✓ ${data.nbAjoutes} ajoutés · ${data.nbMisAjour} mis à jour`,'success');
      await loadCollabs();
    }catch(e){showToast('Erreur : '+e.message,'error');}
    setImporting(false);
  }

  const actifs    = collabs.filter(c=>c.actif);
  const manquants = actifs.filter(c=>!c.cout_jour_effectif).length;

  const filtered = collabs.filter(c=>{
    if(filter==='actifs')    return c.actif;
    if(filter==='bo')        return c.actif&&c.categorie==='back-office';
    if(filter==='manquants') return c.actif&&!c.cout_jour_effectif;
    return true;
  });

  const btnTab=(k,l)=>(
    <button onClick={()=>setFilter(k)} style={{fontSize:11,padding:'5px 14px',borderRadius:20,cursor:'pointer',fontFamily:'var(--mono)',
      border:filter===k?'none':'1px solid var(--border)',background:filter===k?'var(--blue)':'var(--bg2)',color:filter===k?'#fff':'var(--muted)'}}>
      {l}
    </button>
  );

  return(
    <div>
      {toast&&<Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Collaborateurs</span>
        {manquants>0&&<span style={{marginLeft:12,background:'#fef2f2',color:'#b91c1c',border:'1px solid #fecaca',padding:'2px 10px',borderRadius:20,fontSize:11,fontFamily:'var(--mono)'}}>{manquants} sans coût</span>}
      </div>
      <div className="page-body">

        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <input ref={fileRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={e=>{if(e.target.files[0])importSalaries(e.target.files[0]);e.target.value='';}}/>
          <button className="btn btn-primary" onClick={()=>fileRef.current?.click()} disabled={importing}>
            {importing?'Import...':'↑ Importer ListeSalaries.xlsx'}
          </button>
          <div style={{marginLeft:'auto',display:'flex',gap:6,flexWrap:'wrap'}}>
            {btnTab('all',`Tous (${collabs.length})`)}
            {btnTab('actifs',`Actifs (${actifs.length})`)}
            {btnTab('bo','Back-Office')}
            {btnTab('manquants',`⚠ Sans coût (${manquants})`)}
          </div>
        </div>

        {loading?<div className="loading"><div className="spinner"/><span>Chargement...</span></div>:(
          <div className="table-wrap">
            <div className="table-header">
              <span className="table-title">Référentiel collaborateurs</span>
              <span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>Cliquez sur une valeur pour modifier</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>Nom</th><th>Statut</th><th>Catégorie</th><th>Sous-type</th>
                  <th>Service</th><th>Contrat</th><th>Coût/j (manuel)</th>
                  <th>Coût/j effectif</th><th>Source</th><th>Dernier statut</th>
                </tr></thead>
                <tbody>
                  {filtered.map(c=>(
                    <tr key={c.id}>
                      <td style={{fontWeight:500}}>{c.nom} {c.prenom}</td>
                      <td><span className={`badge ${c.actif?'badge-green':'badge-gray'}`}>{c.actif?'Actif':'Sorti'}</span></td>
                      <td><EditCell value={c.categorie} options={CATS} onSave={v=>updateCollab(c.id,'categorie',v)} type="text"/></td>
                      <td><EditCell value={c.sous_type} options={SOUS} onSave={v=>updateCollab(c.id,'sous_type',v)} type="text"/></td>
                      <td className="td-muted">{c.service||'—'}</td>
                      <td style={{fontSize:11,fontFamily:'var(--mono)'}}>{(c.type_contrat||'').replace('CDI - Contrat à durée indéterminée','CDI').replace('CDD - Contrat à durée déterminée','CDD').slice(0,6)}</td>
                      <td><EditCell value={c.cout_jour_manuel} onSave={v=>updateCollab(c.id,'cout_jour_manuel',v)}/></td>
                      <td className="td-right" style={{fontFamily:'var(--mono)',fontSize:11}}>{c.cout_jour_effectif?`${fmtNum(c.cout_jour_effectif,0)} €`:'—'}</td>
                      <td><span className={`badge ${c.source_cout==='manuel'?'badge-orange':'badge-gray'}`}>{c.source_cout||'—'}</span></td>
                      <td>{c.dernier_statut&&<span className={`badge ${c.dernier_statut==='mission'?'badge-green':c.dernier_statut==='inter-contrat'?'badge-red':c.dernier_statut==='mission-partielle'?'badge-orange':'badge-gray'}`}>{c.dernier_statut}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
