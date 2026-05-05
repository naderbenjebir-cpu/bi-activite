import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFilters } from '../../components/Layout';
import { useProductions } from '../../lib/hooks';
import { supabase } from '../../lib/supabase';
import { fmtEur, fmtNum, formatMois } from '../../lib/utils';

const COLORS = ['#1e50a0','#f97316','#16a34a','#7c3aed','#0ea5e9','#ef4444','#ca8a04','#0891b2','#db2777','#65a30d'];
const MOIS_COURTS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function getMoisRange(m) {
  const s = String(m);
  return { year: parseInt(s.slice(0,4)), month: parseInt(s.slice(4,6)) };
}
function moisToIndex(m, minM) {
  const { year:y, month:mo } = getMoisRange(m);
  const { year:my, month:mmo } = getMoisRange(minM);
  return (y-my)*12+(mo-mmo);
}
function moisAnneeToDate(m) {
  const { year, month } = getMoisRange(m);
  return new Date(year, month-1, 1);
}

// ── Cellule éditable inline ──────────────────────────────────
function EditCell({ value, type='text', onSave, placeholder='' }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(value || '');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { setVal(value || ''); }, [value]);

  async function save() {
    setEditing(false);
    if (val === (value || '')) return;
    setSaving(true);
    await onSave(val);
    setSaving(false);
  }

  if (!editing) return (
    <div onClick={() => setEditing(true)}
      title="Cliquer pour modifier"
      style={{
        cursor:'pointer', padding:'3px 8px', borderRadius:4, minWidth:type==='date'?110:140,
        border:'1px solid transparent', transition:'all .15s',
        color: value ? 'var(--text)' : 'var(--muted)',
        fontSize:11, fontFamily: type==='date'?'var(--mono)':'inherit',
        opacity: saving ? .5 : 1,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
      {value || <span style={{fontStyle:'italic',fontSize:10}}>{placeholder}</span>}
      {saving && <span style={{marginLeft:4,fontSize:9,color:'var(--orange)'}}>…</span>}
    </div>
  );

  return (
    <input
      autoFocus
      type={type}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if(e.key==='Enter') save(); if(e.key==='Escape') setEditing(false); }}
      style={{
        width: type==='date'?130:200, fontSize:11, padding:'3px 8px',
        border:'1px solid var(--orange)', borderRadius:4,
        background:'var(--bg)', color:'var(--text)',
        fontFamily: type==='date'?'var(--mono)':'inherit',
      }}
    />
  );
}

// ── Onglet Suivi mission ─────────────────────────────────────
function SuiviMission({ rows }) {
  const [suivi,   setSuivi]   = useState({});  // { 'collab||ref': { date_fin_prevue, remarques } }
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);

  // Charger les données suivi
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('suivi_missions').select('*');
      const map = {};
      (data||[]).forEach(r => { map[`${r.collaborateur}||${r.ref_affaire}`] = r; });
      setSuivi(map);
      setLoading(false);
    }
    load();
  }, []);

  // Dernier mois disponible
  const dernierMois = useMemo(() => {
    if (!rows.length) return null;
    return Math.max(...rows.map(r => parseInt(r.mois_annee)));
  }, [rows]);

  // Lignes actives = collaborateurs présents dans le dernier mois
  const lignesActives = useMemo(() => {
    if (!dernierMois) return [];
    const rowsDernierMois = rows.filter(r => parseInt(r.mois_annee) === dernierMois);

    // Agréger par collaborateur + affaire
    const map = {};
    rowsDernierMois.forEach(r => {
      const k = `${r.collaborateur}||${r.ref_affaire}`;
      if (!map[k]) map[k] = {
        collaborateur: r.collaborateur, ref_affaire: r.ref_affaire,
        objet: r.objet_affaire||'—', client: r.client||'—',
        interne_externe: r.interne_externe||'Interne',
        moisMin: null, moisMax: null,
        jours: 0, ca: 0, cout: 0,
      };
      map[k].jours += parseFloat(r.nb_jours)||0;
      map[k].ca    += parseFloat(r.total_ht)||0;
      map[k].cout  += parseFloat(r.cout_total)||0;
    });

    // Calculer durée totale de chaque mission (toute la période)
    rows.forEach(r => {
      const k = `${r.collaborateur}||${r.ref_affaire}`;
      if (!map[k]) return;
      const ma = parseInt(r.mois_annee);
      if (!map[k].moisMin || ma < map[k].moisMin) map[k].moisMin = ma;
      if (!map[k].moisMax || ma > map[k].moisMax) map[k].moisMax = ma;
    });

    return Object.values(map).sort((a,b) => {
      // Internes en premier, puis externes
      const aExt = a.interne_externe==='Externe' ? 1 : 0;
      const bExt = b.interne_externe==='Externe' ? 1 : 0;
      if (aExt !== bExt) return aExt - bExt;
      // Puis par collaborateur
      if (a.collaborateur !== b.collaborateur) return a.collaborateur.localeCompare(b.collaborateur);
      // Puis par affaire
      return (a.ref_affaire||'').localeCompare(b.ref_affaire||'');
    });
  }, [rows, dernierMois]);

  // Timeline : bornes globales
  const { allMois, minMois, nbMois } = useMemo(() => {
    if (!lignesActives.length) return { allMois:[], minMois:null, nbMois:0 };
    const min = Math.min(...lignesActives.map(l => l.moisMin));
    const max = Math.max(...lignesActives.map(l => l.moisMax));
    const list = [];
    let cur = min;
    while (cur <= max) {
      list.push(cur);
      const { year, month } = getMoisRange(cur);
      cur = month===12 ? (year+1)*100+1 : year*100+(month+1);
    }
    return { allMois: list, minMois: min, nbMois: list.length };
  }, [lignesActives]);

  async function updateSuivi(collaborateur, ref_affaire, field, value) {
    const k = `${collaborateur}||${ref_affaire}`;
    const current = suivi[k] || {};
    const updated = { ...current, [field]: value || null };
    setSuivi(prev => ({ ...prev, [k]: updated }));

    await fetch('/api/admin/suivi-mission', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collaborateur, ref_affaire, [field]: value }),
    });
  }

  // Couleur selon date fin
  function dateFinColor(dateStr) {
    if (!dateStr) return 'var(--muted)';
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = (d - now) / (1000*60*60*24);
    if (diff < 0)   return '#ef4444';  // dépassée
    if (diff < 30)  return '#f97316';  // < 1 mois
    if (diff < 90)  return '#ca8a04';  // < 3 mois
    return '#16a34a';
  }

  function formatDateFin(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  }

  if (loading) return <div className="loading"><div className="spinner"/><span>Chargement suivi...</span></div>;

  if (!dernierMois) return (
    <div className="empty"><h3>Aucune donnée disponible</h3></div>
  );

  return (
    <div>
      {/* Header info */}
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,
        padding:'12px 18px',marginBottom:20,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div>
          <span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>Dernier mois disponible : </span>
          <span style={{fontSize:13,fontWeight:600,color:'var(--blue)',fontFamily:'var(--mono)'}}>{formatMois(dernierMois)}</span>
        </div>
        <div style={{color:'var(--border)',fontSize:16}}>|</div>
        <div>
          <span style={{fontSize:11,color:'var(--muted)'}}>Internes : </span>
          <span style={{fontSize:13,fontWeight:600,color:'var(--blue)'}}>{[...new Set(lignesActives.filter(l=>l.interne_externe!=='Externe').map(l=>l.collaborateur))].length}</span>
        </div>
        <div style={{color:'var(--border)',fontSize:16}}>|</div>
        <div>
          <span style={{fontSize:11,color:'var(--muted)'}}>Externes : </span>
          <span style={{fontSize:13,fontWeight:600,color:'#f97316'}}>{[...new Set(lignesActives.filter(l=>l.interne_externe==='Externe').map(l=>l.collaborateur))].length}</span>
        </div>
        <div style={{color:'var(--border)',fontSize:16}}>|</div>
        <div>
          <span style={{fontSize:11,color:'var(--muted)'}}>Affaires actives : </span>
          <span style={{fontSize:13,fontWeight:600,color:'var(--blue)'}}>{lignesActives.length}</span>
        </div>
        <div style={{marginLeft:'auto',fontSize:11,color:'var(--muted)',fontStyle:'italic'}}>
          Internes + Externes · Cliquez sur Date fin ou Remarques pour modifier
        </div>
      </div>

      {/* Légende dates fin */}
      <div style={{display:'flex',gap:16,marginBottom:14,flexWrap:'wrap'}}>
        {[['#ef4444','Date dépassée'],['#f97316','< 1 mois'],['#ca8a04','< 3 mois'],['#16a34a','> 3 mois'],['var(--muted)','Non renseignée']].map(([c,l])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--muted)'}}>
            <div style={{width:10,height:10,borderRadius:2,background:c}}/>
            {l}
          </div>
        ))}
      </div>

      {/* Timeline + tableau */}
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>

        {/* En-tête colonnes fixes + mois */}
        <div style={{display:'flex',borderBottom:'2px solid var(--border)',background:'var(--bg3)',position:'sticky',top:0,zIndex:5}}>
          <div style={{width:180,minWidth:180,padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',
            color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',borderRight:'1px solid var(--border)'}}>
            Collaborateur
          </div>
          <div style={{width:220,minWidth:220,padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',
            color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',borderRight:'1px solid var(--border)'}}>
            Affaire · Client
          </div>
          <div style={{flex:1,overflow:'hidden',borderRight:'1px solid var(--border)'}}>
            <div style={{display:'flex',minWidth:nbMois*36}}>
              {allMois.map((m,i) => {
                const { year, month } = getMoisRange(m);
                const isCurrentMois  = m === dernierMois;
                return (
                  <div key={m} style={{width:36,minWidth:36,padding:'4px 2px',textAlign:'center',
                    borderRight:'1px solid var(--border)',position:'relative',
                    background: isCurrentMois ? 'rgba(249,115,22,0.08)' : 'transparent'}}>
                    {(month===1||i===0) && (
                      <div style={{position:'absolute',top:0,left:2,fontSize:8,color:'var(--blue)',
                        fontFamily:'var(--mono)',fontWeight:600}}>{year}</div>
                    )}
                    <div style={{fontSize:9,color: isCurrentMois?'var(--orange)':'var(--muted)',
                      fontFamily:'var(--mono)',marginTop:8,fontWeight:isCurrentMois?600:400}}>
                      {MOIS_COURTS[month-1]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{width:120,minWidth:120,padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',
            color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',borderRight:'1px solid var(--border)',textAlign:'center'}}>
            Date fin
          </div>
          <div style={{width:200,minWidth:200,padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',
            color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em'}}>
            Remarques
          </div>
        </div>

        {/* Lignes */}
        <div style={{maxHeight:600,overflowY:'auto'}}>
          {lignesActives.length === 0 ? (
            <div className="empty" style={{padding:40}}>
              <p>Aucune mission active dans le dernier mois disponible.</p>
            </div>
          ) : (
            lignesActives.map((l, i) => {
              const k           = `${l.collaborateur}||${l.ref_affaire}`;
              const sv          = suivi[k] || {};
              const color       = COLORS[i % COLORS.length];
              const left        = moisToIndex(l.moisMin, minMois) * 36;
              const width       = Math.max((moisToIndex(l.moisMax, minMois) - moisToIndex(l.moisMin, minMois) + 1) * 36, 18);
              const dateFinC    = dateFinColor(sv.date_fin_prevue);
              const dateFin     = sv.date_fin_prevue
                ? new Date(sv.date_fin_prevue).toLocaleDateString('fr-FR')
                : '';

              return (
                <div key={k} style={{display:'flex',borderBottom:'1px solid rgba(15,40,80,0.06)',
                  background: i%2===0?'var(--bg2)':'var(--bg)',
                  alignItems:'center', minHeight:40}}>

                  {/* Collaborateur */}
                  <div style={{width:180,minWidth:180,padding:'6px 12px',borderRight:'1px solid var(--border)'}}>
                    <div style={{fontWeight:500,fontSize:12,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {l.collaborateur}
                    </div>
                    <span className={`badge ${l.interne_externe==='Externe'?'badge-orange':'badge-blue'}`}
                      style={{fontSize:9}}>{l.interne_externe||'Interne'}</span>
                  </div>

                  {/* Affaire + Client */}
                  <div style={{width:220,minWidth:220,padding:'6px 12px',borderRight:'1px solid var(--border)'}}>
                    <div style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--blue)',
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.ref_affaire}</div>
                    <div style={{fontSize:10,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {l.client}
                    </div>
                  </div>

                  {/* Gantt */}
                  <div style={{flex:1,position:'relative',minWidth:nbMois*36,height:40,borderRight:'1px solid var(--border)'}}>
                    {/* Bande mois courant */}
                    <div style={{position:'absolute',top:0,bottom:0,
                      left: moisToIndex(dernierMois, minMois)*36,
                      width:36,background:'rgba(249,115,22,0.06)'}}/>

                    {/* Barre mission */}
                    <div
                      style={{position:'absolute',top:10,left,width,height:20,borderRadius:4,
                        background:`${color}25`,border:`1.5px solid ${color}`,cursor:'pointer',
                        display:'flex',alignItems:'center',overflow:'hidden'}}
                      onMouseEnter={e=>{const r=e.currentTarget.getBoundingClientRect();setTooltip({l,sv,x:r.left,y:r.top});}}
                      onMouseLeave={()=>setTooltip(null)}>
                      {width>60&&(
                        <span style={{fontSize:9,fontFamily:'var(--mono)',color,padding:'0 5px',whiteSpace:'nowrap'}}>
                          {fmtNum(l.jours,0)}j
                        </span>
                      )}
                    </div>

                    {/* Marqueur date fin si renseignée */}
                    {sv.date_fin_prevue && (() => {
                      const d = new Date(sv.date_fin_prevue);
                      const finMois = d.getFullYear()*100+(d.getMonth()+1);
                      if (finMois >= minMois && finMois <= allMois[allMois.length-1]) {
                        const finIdx = moisToIndex(finMois, minMois);
                        return (
                          <div style={{position:'absolute',top:4,left:finIdx*36+16,
                            width:4,height:32,background:dateFinC,borderRadius:2,opacity:.8}}
                            title={`Date fin : ${dateFin}`}/>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Date fin */}
                  <div style={{width:120,minWidth:120,padding:'0 8px',borderRight:'1px solid var(--border)',
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{color:dateFinC}}>
                      <EditCell
                        value={sv.date_fin_prevue||''}
                        type="date"
                        placeholder="jj/mm/aaaa"
                        onSave={v => updateSuivi(l.collaborateur, l.ref_affaire, 'date_fin_prevue', v)}
                      />
                    </div>
                  </div>

                  {/* Remarques */}
                  <div style={{width:200,minWidth:200,padding:'0 8px',display:'flex',alignItems:'center'}}>
                    <EditCell
                      value={sv.remarques||''}
                      type="text"
                      placeholder="Ajouter une remarque..."
                      onSave={v => updateSuivi(l.collaborateur, l.ref_affaire, 'remarques', v)}
                    />
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{position:'fixed',top:tooltip.y-160,left:tooltip.x,
          background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:8,
          padding:'10px 14px',zIndex:50,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',
          minWidth:220,pointerEvents:'none'}}>
          <div style={{fontSize:12,fontWeight:500,color:'var(--blue)',marginBottom:4}}>{tooltip.l.collaborateur}</div>
          <div style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--muted)',marginBottom:6}}>{tooltip.l.ref_affaire}</div>
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'3px 10px',fontSize:11}}>
            {[
              ['Client',   tooltip.l.client],
              ['Période',  `${formatMois(tooltip.l.moisMin)} → ${formatMois(tooltip.l.moisMax)}`],
              ['Jours (dernier mois)', `${fmtNum(tooltip.l.jours,1)}j`],
              ['CA (dernier mois)',    fmtEur(tooltip.l.ca)],
              ['Date fin prévue', tooltip.sv.date_fin_prevue
                ? new Date(tooltip.sv.date_fin_prevue).toLocaleDateString('fr-FR')
                : '—'],
              ['Remarques', tooltip.sv.remarques||'—'],
            ].map(([k,v])=>[
              <span key={k} style={{color:'var(--muted)',whiteSpace:'nowrap'}}>{k}</span>,
              <span key={k+'v'} style={{fontFamily:'var(--mono)',fontSize:10}}>{v}</span>
            ])}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PAGE PRINCIPALE MISSIONS
// ════════════════════════════════════════════════════════════
export default function Missions() {
  const { filters } = useFilters();
  const { data: rows, loading } = useProductions(filters);
  const [tab,    setTab]    = useState('gantt');
  const [axis,   setAxis]   = useState('collaborateur');
  const [sortBy, setSortBy] = useState('ca');
  const [tooltip, setTooltip] = useState(null);

  const missions = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const axisKey    = axis==='collaborateur'?r.collaborateur:axis==='client'?r.client:r.ref_affaire;
      const missionKey = `${axisKey}||${r.ref_affaire}`;
      if (!map[missionKey]) {
        map[missionKey] = {
          axisLabel:r.axisKey||axisKey||'N/A', ref:r.ref_affaire||'—',
          objet:r.objet_affaire||'—', client:r.client||'—',
          collaborateur:r.collaborateur||'—',
          moisMin:r.mois_annee, moisMax:r.mois_annee,
          ca:0, cout:0, marge:0, jours:0, coutJourSum:0, coutJourNb:0,
        };
        map[missionKey].axisLabel = axisKey||'N/A';
      }
      const m = map[missionKey];
      if (r.mois_annee<m.moisMin) m.moisMin=r.mois_annee;
      if (r.mois_annee>m.moisMax) m.moisMax=r.mois_annee;
      m.ca    +=parseFloat(r.total_ht)   ||0;
      m.cout  +=parseFloat(r.cout_total) ||0;
      m.marge +=parseFloat(r.marge_brute)||0;
      m.jours +=parseFloat(r.nb_jours)   ||0;
      if (parseFloat(r.cout_jour)>0) { m.coutJourSum+=parseFloat(r.cout_jour)*(parseFloat(r.nb_jours)||0); m.coutJourNb+=parseFloat(r.nb_jours)||0; }
    });
    return Object.values(map).map(m=>({...m,
      taux:m.ca>0?m.marge/m.ca*100:0, tjm:m.jours>0?m.ca/m.jours:0,
      coutJourMoy:m.coutJourNb>0?m.coutJourSum/m.coutJourNb:0,
      duree:moisToIndex(m.moisMax,m.moisMin)+1,
    }));
  },[rows,axis]);

  const allMois = useMemo(()=>{
    if(!missions.length) return [];
    const min=Math.min(...missions.map(m=>m.moisMin));
    const max=Math.max(...missions.map(m=>m.moisMax));
    const list=[]; let cur=min;
    while(cur<=max){list.push(cur);const{year,month}=getMoisRange(cur);cur=month===12?(year+1)*100+1:year*100+(month+1);}
    return list;
  },[missions]);
  const minMois=allMois[0]; const nbMois=allMois.length;

  const grouped=useMemo(()=>{
    const g={};
    missions.forEach(m=>{if(!g[m.axisLabel])g[m.axisLabel]={label:m.axisLabel,missions:[],ca:0,marge:0,jours:0};g[m.axisLabel].missions.push(m);g[m.axisLabel].ca+=m.ca;g[m.axisLabel].marge+=m.marge;g[m.axisLabel].jours+=m.jours;});
    return Object.values(g).sort((a,b)=>sortBy==='ca'?b.ca-a.ca:b.jours-a.jours);
  },[missions,sortBy]);

  const totalCA=missions.reduce((s,m)=>s+m.ca,0);
  const totalMarge=missions.reduce((s,m)=>s+m.marge,0);
  const totalJours=missions.reduce((s,m)=>s+m.jours,0);
  const tauxGlobal=totalCA>0?totalMarge/totalCA*100:0;
  const tauxCol=tauxGlobal>=20?'#16a34a':tauxGlobal>=10?'#f97316':'#ef4444';
  const dureeAvg=missions.length?missions.reduce((s,m)=>s+m.duree,0)/missions.length:0;

  const btnS=(active)=>({fontSize:11,padding:'4px 12px',borderRadius:20,cursor:'pointer',fontFamily:'var(--mono)',border:active?'none':'1px solid var(--border)',background:active?'var(--blue)':'var(--bg2)',color:active?'#fff':'var(--muted)'});
  const tabStyle=(k)=>({padding:'8px 16px',fontSize:11,fontFamily:'var(--mono)',cursor:'pointer',background:'none',border:'none',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:tab===k?'2px solid var(--orange)':'2px solid transparent',color:tab===k?'var(--blue)':'var(--muted)',fontWeight:tab===k?500:400,marginBottom:-1});

  if(loading) return(<div><div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--muted)'}}>Missions</span></div><div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div></div>);

  return(
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Missions</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{missions.length} missions · {grouped.length} {axis==='collaborateur'?'collaborateurs':axis==='client'?'clients':'affaires'}</span>
      </div>
      <div className="page-body">

        {/* KPIs */}
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(6,1fr)',marginBottom:20}}>
          {[
            ['CA total',     fmtEur(totalCA),              '#1e50a0'],
            ['Marge brute',  fmtEur(totalMarge),           '#f97316'],
            ['Taux marge',   fmtNum(tauxGlobal,1)+'%',     tauxCol],
            ['Nb missions',  missions.length,               '#7c3aed'],
            ['Jours facturés',fmtNum(totalJours,0)+'j',    '#0ea5e9'],
            ['Durée moy.',   fmtNum(dureeAvg,1)+' mois',   '#16a34a'],
          ].map(([l,v,c])=>(
            <div key={l} className="kpi-card" style={{borderTopColor:c}}>
              <div className="kpi-label">{l}</div>
              <div className="kpi-val" style={{color:c,fontSize:16}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:20}}>
          <button style={tabStyle('gantt')}  onClick={()=>setTab('gantt')}>Vue Gantt</button>
          <button style={tabStyle('suivi')}  onClick={()=>setTab('suivi')}>Suivi mission</button>
          <button style={tabStyle('table')}  onClick={()=>setTab('table')}>Tableau récapitulatif</button>
        </div>

        {/* ── TAB GANTT ── */}
        {tab==='gantt'&&(
          <div>
            <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>Axe :</span>
              {['collaborateur','client','ref_affaire'].map(a=>(
                <button key={a} style={btnS(axis===a)} onClick={()=>setAxis(a)}>
                  {a==='collaborateur'?'Collaborateur':a==='client'?'Client':'Affaire'}
                </button>
              ))}
              <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>Trier :</span>
                <button style={btnS(sortBy==='ca')} onClick={()=>setSortBy('ca')}>CA</button>
                <button style={btnS(sortBy==='jours')} onClick={()=>setSortBy('jours')}>Jours</button>
              </div>
            </div>

            {missions.length===0?<div className="empty"><h3>Aucune mission</h3></div>:(
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
                <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'var(--bg3)'}}>
                  <div style={{width:200,minWidth:200,padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',borderRight:'1px solid var(--border)'}}>
                    {axis==='collaborateur'?'Collaborateur':axis==='client'?'Client':'Affaire'}
                  </div>
                  <div style={{flex:1,overflow:'hidden'}}>
                    <div style={{display:'flex',minWidth:nbMois*40}}>
                      {allMois.map((m,i)=>{const{year,month}=getMoisRange(m);return(
                        <div key={m} style={{width:40,minWidth:40,padding:'4px 2px',textAlign:'center',borderRight:'1px solid var(--border)',position:'relative'}}>
                          {(month===1||i===0)&&<div style={{position:'absolute',top:0,left:2,fontSize:8,color:'var(--blue)',fontFamily:'var(--mono)',fontWeight:600}}>{year}</div>}
                          <div style={{fontSize:9,color:'var(--muted)',fontFamily:'var(--mono)',marginTop:8}}>{MOIS_COURTS[month-1]}</div>
                        </div>
                      );})}
                    </div>
                  </div>
                  <div style={{width:140,minWidth:140,padding:'8px 12px',fontSize:10,fontFamily:'var(--mono)',color:'var(--blue)',textTransform:'uppercase',letterSpacing:'.06em',borderLeft:'1px solid var(--border)',textAlign:'right'}}>CA · Marge</div>
                </div>
                <div style={{maxHeight:520,overflowY:'auto'}}>
                  {grouped.map((group,gi)=>{
                    const color=COLORS[gi%COLORS.length];
                    return(
                      <div key={group.label}>
                        <div style={{display:'flex',background:`${color}08`,borderBottom:'1px solid var(--border)'}}>
                          <div style={{width:200,minWidth:200,padding:'8px 12px',borderRight:'1px solid var(--border)'}}>
                            <div style={{fontSize:12,fontWeight:500,color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{group.label}</div>
                            <div style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>{group.missions.length} mission{group.missions.length>1?'s':''}</div>
                          </div>
                          <div style={{flex:1,position:'relative',minWidth:nbMois*40}}>
                            {(()=>{const gMin=Math.min(...group.missions.map(m=>m.moisMin));const gMax=Math.max(...group.missions.map(m=>m.moisMax));const left=moisToIndex(gMin,minMois)*40;const width=(moisToIndex(gMax,minMois)-moisToIndex(gMin,minMois)+1)*40;return<div style={{position:'absolute',top:8,left,width,height:6,background:`${color}20`,borderRadius:3}}/>;})()}
                          </div>
                          <div style={{width:140,minWidth:140,padding:'8px 12px',borderLeft:'1px solid var(--border)',textAlign:'right'}}>
                            <div style={{fontSize:11,fontWeight:500,fontFamily:'var(--mono)',color}}>{fmtEur(group.ca)}</div>
                            <div style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>{fmtEur(group.marge)}</div>
                          </div>
                        </div>
                        {group.missions.sort((a,b)=>a.moisMin-b.moisMin).map((m,mi)=>{
                          const left=moisToIndex(m.moisMin,minMois)*40;const width=Math.max(m.duree*40,20);const tc=m.taux>=20?'#16a34a':m.taux>=10?'#f97316':'#ef4444';
                          return(
                            <div key={`${m.ref}-${mi}`} style={{display:'flex',borderBottom:'1px solid rgba(15,40,80,0.05)',background:mi%2===0?'var(--bg2)':'var(--bg)'}}>
                              <div style={{width:200,minWidth:200,padding:'6px 12px 6px 24px',borderRight:'1px solid var(--border)'}}>
                                <div style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.ref}</div>
                                <div style={{fontSize:10,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.objet}</div>
                              </div>
                              <div style={{flex:1,position:'relative',minWidth:nbMois*40,overflow:'hidden'}}>
                                <div style={{position:'absolute',top:6,left,width,height:20,borderRadius:4,background:`${color}30`,border:`1.5px solid ${color}`,cursor:'pointer',display:'flex',alignItems:'center',overflow:'hidden'}}
                                  onMouseEnter={e=>{const rect=e.currentTarget.getBoundingClientRect();setTooltip({m,x:rect.left,y:rect.top});}}
                                  onMouseLeave={()=>setTooltip(null)}>
                                  {width>60&&<span style={{fontSize:9,fontFamily:'var(--mono)',color,padding:'0 6px',whiteSpace:'nowrap'}}>{fmtNum(m.jours,0)}j</span>}
                                </div>
                              </div>
                              <div style={{width:140,minWidth:140,padding:'6px 12px',borderLeft:'1px solid var(--border)',textAlign:'right'}}>
                                <div style={{fontSize:11,fontFamily:'var(--mono)'}}>{fmtEur(m.ca)}</div>
                                <div style={{fontSize:10,fontFamily:'var(--mono)',color:tc}}>{fmtNum(m.taux,1)}%</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tooltip&&(
              <div style={{position:'fixed',top:tooltip.y-140,left:tooltip.x,background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:8,padding:'10px 14px',zIndex:50,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',minWidth:220,pointerEvents:'none'}}>
                <div style={{fontSize:12,fontWeight:500,marginBottom:4,color:'var(--blue)'}}>{tooltip.m.ref}</div>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:6}}>{tooltip.m.objet}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 12px',fontSize:11}}>
                  {[['Période',`${formatMois(tooltip.m.moisMin)}${tooltip.m.duree>1?` → ${formatMois(tooltip.m.moisMax)}`:''}`],['Durée',`${tooltip.m.duree} mois`],['Jours',`${fmtNum(tooltip.m.jours,1)}j`],['CA',fmtEur(tooltip.m.ca)],['Marge',`${fmtEur(tooltip.m.marge)} (${fmtNum(tooltip.m.taux,1)}%)`],['TJM',fmtEur(tooltip.m.tjm)],['Coût/j',tooltip.m.coutJourMoy>0?fmtEur(tooltip.m.coutJourMoy):'—'],['Client',tooltip.m.client]].map(([k,v])=>[
                    <span key={k} style={{color:'var(--muted)'}}>{k}</span>,
                    <span key={k+'v'} style={{textAlign:'right',fontFamily:'var(--mono)',fontSize:10}}>{v}</span>
                  ])}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB SUIVI MISSION ── */}
        {tab==='suivi' && <SuiviMission rows={rows}/>}

        {/* ── TAB TABLEAU ── */}
        {tab==='table'&&(
          <div className="table-wrap">
            <div className="table-header">
              <span className="table-title">Récapitulatif des missions</span>
              <span style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>{missions.length} missions</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>Réf. affaire</th><th>Objet</th>
                  <th>{axis==='collaborateur'?'Collaborateur':axis==='client'?'Client':'Entité'}</th>
                  <th>Début</th><th>Fin</th><th>Durée</th>
                  <th>Jours</th><th>CA HT</th><th>Marge</th>
                  <th>Taux</th><th>TJM</th><th>Coût/j</th>
                </tr></thead>
                <tbody>
                  {missions.sort((a,b)=>b.ca-a.ca).map((m,i)=>{
                    const tc=m.taux>=20?'td-green':m.taux>=10?'':'td-red';
                    return(
                      <tr key={i}>
                        <td style={{fontFamily:'var(--mono)',fontSize:11}}>{m.ref}</td>
                        <td style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11}}>{m.objet}</td>
                        <td style={{fontSize:11}}>{m.axisLabel}</td>
                        <td style={{fontFamily:'var(--mono)',fontSize:11}}>{formatMois(m.moisMin)}</td>
                        <td style={{fontFamily:'var(--mono)',fontSize:11}}>{formatMois(m.moisMax)}</td>
                        <td className="td-right" style={{fontFamily:'var(--mono)',fontSize:11}}>{m.duree} mois</td>
                        <td className="td-right">{fmtNum(m.jours,1)}j</td>
                        <td className="td-right">{fmtEur(m.ca)}</td>
                        <td className={`td-right ${tc}`}>{fmtEur(m.marge)}</td>
                        <td className={`td-right ${tc}`}>{fmtNum(m.taux,1)}%</td>
                        <td className="td-right">{fmtEur(m.tjm)}</td>
                        <td className="td-right td-muted">{m.coutJourMoy>0?fmtEur(m.coutJourMoy):'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
