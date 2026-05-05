import { useState, useMemo } from 'react';
import { useFilters } from '../../components/Layout';
import { useProductions, aggregate } from '../../lib/hooks';
import { fmtEur, fmtNum, formatMois } from '../../lib/utils';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const MOIS_COURTS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const COLORS = ['#1e50a0','#f97316','#16a34a','#7c3aed','#0ea5e9'];

// ── Helpers ─────────────────────────────────────────────────
function delta(a, b) {
  if (!b || b === 0) return null;
  return (a - b) / b * 100;
}

function DeltaBadge({ pct }) {
  if (pct === null) return <span style={{color:'var(--muted)',fontSize:11}}>—</span>;
  const pos = pct >= 0;
  return (
    <span style={{
      fontSize:10, fontFamily:'var(--mono)', fontWeight:500,
      color: pos ? '#16a34a' : '#ef4444',
      background: pos ? '#dcfce7' : '#fef2f2',
      padding:'2px 7px', borderRadius:20,
    }}>
      {pos?'+':''}{fmtNum(pct,1)}%
    </span>
  );
}

// ── Détail client (modal/drawer) ─────────────────────────────
function ClientDetail({ client, rows, anneeDebut, anneeFin, onClose }) {
  const [metric, setMetric] = useState('ca');

  const rowsClient = rows.filter(r => r.client === client);

  // Données par mois pour chaque année
  const annees = [anneeDebut, anneeFin].filter(Boolean);

  const byMoisAnnee = {};
  rowsClient.forEach(r => {
    const a  = String(r.mois_annee).slice(0,4);
    const mo = parseInt(String(r.mois_annee).slice(4,6)) - 1;
    if (!byMoisAnnee[a]) byMoisAnnee[a] = Array(12).fill(null).map(()=>({ca:0,marge:0,jours:0,cout:0}));
    byMoisAnnee[a][mo].ca    += parseFloat(r.total_ht)   ||0;
    byMoisAnnee[a][mo].cout  += parseFloat(r.cout_total) ||0;
    byMoisAnnee[a][mo].marge += parseFloat(r.marge_brute)||0;
    byMoisAnnee[a][mo].jours += parseFloat(r.nb_jours)   ||0;
  });

  // Totaux par année
  const totaux = {};
  annees.forEach(a => {
    if (!byMoisAnnee[a]) { totaux[a] = {ca:0,marge:0,jours:0,taux:0,tjm:0}; return; }
    const t = byMoisAnnee[a].reduce((s,m)=>({ca:s.ca+m.ca,marge:s.marge+m.marge,jours:s.jours+m.jours,cout:s.cout+m.cout}),{ca:0,marge:0,jours:0,cout:0});
    totaux[a] = { ...t, taux: t.ca>0?t.marge/t.ca*100:0, tjm: t.jours>0?t.ca/t.jours:0 };
  });

  function getMetricVal(d) {
    if (metric==='ca')    return d.ca||0;
    if (metric==='marge') return d.marge||0;
    if (metric==='jours') return d.jours||0;
    if (metric==='taux')  return d.ca>0?d.marge/d.ca*100:0;
    if (metric==='tjm')   return d.jours>0?d.ca/d.jours:0;
    return 0;
  }

  function metricFmt(v) {
    if (metric==='jours') return fmtNum(v,1)+'j';
    if (metric==='taux')  return fmtNum(v,1)+'%';
    return fmtEur(v);
  }

  const metricLabel = {ca:'CA HT',marge:'Marge brute',jours:'Jours',taux:'Taux marge',tjm:'TJM'}[metric];

  // Graphique barres comparatif
  const barData = {
    labels: annees,
    datasets: [{
      label: metricLabel,
      data: annees.map(a => getMetricVal(totaux[a]||{})),
      backgroundColor: annees.map((_,i) => COLORS[i]+'60'),
      borderColor: annees.map((_,i) => COLORS[i]),
      borderWidth: 2, borderRadius: 6,
    }],
  };

  // Graphique courbes mensuelles
  const lineData = {
    labels: MOIS_COURTS,
    datasets: annees.map((a,i) => ({
      label: a,
      data: Array(12).fill(0).map((_,mo) => {
        const d = byMoisAnnee[a]?.[mo] || {ca:0,marge:0,jours:0,cout:0};
        return getMetricVal(d);
      }),
      borderColor: COLORS[i], backgroundColor: COLORS[i]+'20',
      borderWidth:2, tension:0.3, pointRadius:3, fill:false,
    })),
  };

  const chartOpts = (yFmt) => ({
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ labels:{ color:'#5a7296', font:{size:10}, boxWidth:10 } } },
    scales:{
      x:{ grid:{color:'rgba(15,40,80,0.05)'}, ticks:{color:'#5a7296',font:{size:10}} },
      y:{ grid:{color:'rgba(15,40,80,0.05)'}, ticks:{color:'#5a7296',font:{size:10},
        callback: v => yFmt(v) } },
    },
  });

  const yFmt = metric==='jours' ? v=>v+'j' : metric==='taux' ? v=>v+'%' : v=>(v/1000).toFixed(0)+'k€';

  // Affaires
  const affaires = Object.values(
    rowsClient.reduce((m,r) => {
      const k = r.ref_affaire||'N/A';
      if (!m[k]) m[k]={ref:k,objet:r.objet_affaire||'—',ca:0,marge:0,jours:0,moisMin:r.mois_annee,moisMax:r.mois_annee};
      m[k].ca    +=parseFloat(r.total_ht)||0;
      m[k].marge +=parseFloat(r.marge_brute)||0;
      m[k].jours +=parseFloat(r.nb_jours)||0;
      if(r.mois_annee<m[k].moisMin) m[k].moisMin=r.mois_annee;
      if(r.mois_annee>m[k].moisMax) m[k].moisMax=r.mois_annee;
      return m;
    }, {})
  ).sort((a,b)=>b.ca-a.ca);

  const btnM = (k,l) => (
    <button key={k} onClick={()=>setMetric(k)} style={{
      fontSize:11,padding:'4px 12px',borderRadius:20,cursor:'pointer',fontFamily:'var(--mono)',
      border: metric===k?'none':'1px solid var(--border)',
      background: metric===k?'var(--blue)':'var(--bg2)',
      color: metric===k?'#fff':'var(--muted)',
    }}>{l}</button>
  );

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:200,display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}}
      onClick={onClose}>
      <div style={{width:'70%',maxWidth:900,height:'100vh',background:'var(--bg)',overflowY:'auto',
        boxShadow:'-4px 0 24px rgba(0,0,0,0.15)'}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:'16px 24px',background:'var(--bg2)',borderBottom:'1px solid var(--border)',
          display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:'var(--blue)'}}>{client}</div>
            <div style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>
              {anneeDebut}{anneeFin&&anneeDebut!==anneeFin?` → ${anneeFin}`:''}
            </div>
          </div>
          <button onClick={onClose} style={{padding:'6px 14px',border:'1px solid var(--border)',
            borderRadius:6,background:'none',cursor:'pointer',fontSize:13,color:'var(--muted)'}}>✕ Fermer</button>
        </div>

        <div style={{padding:'20px 24px'}}>

          {/* KPIs comparatifs */}
          <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
            {annees.map((a,i) => {
              const t = totaux[a]||{};
              const tc = (t.taux||0)>=20?'#16a34a':(t.taux||0)>=10?'#f97316':'#ef4444';
              const prev = i>0 ? totaux[annees[i-1]]||{} : null;
              const d = prev ? delta(t.ca,prev.ca) : null;
              return (
                <div key={a} style={{background:'var(--bg2)',border:'1px solid var(--border)',
                  borderTop:`3px solid ${COLORS[i]}`,borderRadius:10,padding:'12px 16px',flex:1,minWidth:160}}>
                  <div style={{fontSize:15,fontWeight:600,color:COLORS[i],fontFamily:'var(--mono)',marginBottom:6}}>{a}</div>
                  <div style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>CA</div>
                  <div style={{fontSize:17,fontWeight:600}}>{fmtEur(t.ca||0)}</div>
                  {d!==null && <DeltaBadge pct={d}/>}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:8}}>
                    <div><div style={{fontSize:9,color:'var(--muted)'}}>Marge</div><div style={{fontSize:12,color:'#f97316'}}>{fmtEur(t.marge||0)}</div></div>
                    <div><div style={{fontSize:9,color:'var(--muted)'}}>Taux</div><div style={{fontSize:12,color:tc}}>{fmtNum(t.taux||0,1)}%</div></div>
                    <div><div style={{fontSize:9,color:'var(--muted)'}}>Jours</div><div style={{fontSize:12}}>{fmtNum(t.jours||0,1)}j</div></div>
                    <div><div style={{fontSize:9,color:'var(--muted)'}}>TJM</div><div style={{fontSize:12}}>{fmtEur(t.tjm||0)}</div></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sélecteur métrique */}
          <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
            {[['ca','CA HT'],['marge','Marge'],['jours','Jours'],['taux','Taux %'],['tjm','TJM']].map(([k,l])=>btnM(k,l))}
          </div>

          {/* Barres comparatives */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'16px',marginBottom:16}}>
            <div style={{fontSize:10,color:'var(--blue)',fontFamily:'var(--mono)',textTransform:'uppercase',
              letterSpacing:'.06em',marginBottom:12}}>{metricLabel} — comparaison annuelle</div>
            <div style={{height:160}}>
              <Bar data={barData} options={chartOpts(yFmt)}/>
            </div>
          </div>

          {/* Courbes mensuelles */}
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'16px',marginBottom:16}}>
            <div style={{fontSize:10,color:'var(--blue)',fontFamily:'var(--mono)',textTransform:'uppercase',
              letterSpacing:'.06em',marginBottom:12}}>{metricLabel} — évolution mensuelle</div>
            <div style={{height:200}}>
              <Line data={lineData} options={chartOpts(yFmt)}/>
            </div>
          </div>

          {/* Tableau mensuel */}
          {(() => {
            // Agréger par mois — filtré sur la période des années sélectionnées
            const byMois = {};
            rowsClient.filter(r => {
              const a = String(r.mois_annee).slice(0,4);
              return annees.includes(a);
            }).forEach(r => {
              const k = String(r.mois_annee);
              if (!byMois[k]) byMois[k] = { ca:0, marge:0, jours:0, cout:0 };
              byMois[k].ca    += parseFloat(r.total_ht)   ||0;
              byMois[k].marge += parseFloat(r.marge_brute)||0;
              byMois[k].jours += parseFloat(r.nb_jours)   ||0;
              byMois[k].cout  += parseFloat(r.cout_total) ||0;
            });
            const moisList = Object.keys(byMois).sort().reverse();
            const totCA    = moisList.reduce((s,k)=>s+byMois[k].ca,0);
            const totMarge = moisList.reduce((s,k)=>s+byMois[k].marge,0);
            const totJours = moisList.reduce((s,k)=>s+byMois[k].jours,0);
            return (
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
                <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',
                  display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:10,color:'var(--blue)',fontFamily:'var(--mono)',
                    textTransform:'uppercase',letterSpacing:'.06em'}}>
                    Détail mensuel ({moisList.length} mois)
                  </span>
                  <div style={{display:'flex',gap:16,fontSize:11,fontFamily:'var(--mono)'}}>
                    <span style={{color:'var(--blue)',fontWeight:500}}>{fmtEur(totCA)}</span>
                    <span style={{color:'#f97316'}}>{fmtEur(totMarge)}</span>
                    <span style={{color:'var(--muted)'}}>{fmtNum(totJours,1)}j</span>
                  </div>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'var(--bg3)'}}>
                      {['Mois','CA HT','Jours','Marge','Taux marge','TJM'].map(h=>(
                        <th key={h} style={{padding:'7px 12px',
                          textAlign: h==='Mois'?'left':'right',
                          fontSize:10,fontFamily:'var(--mono)',color:'var(--blue)',
                          textTransform:'uppercase',letterSpacing:'.06em',
                          borderBottom:'1px solid var(--border)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {moisList.map((k,i) => {
                      const d   = byMois[k];
                      const taux = d.ca>0 ? d.marge/d.ca*100 : 0;
                      const tjm  = d.jours>0 ? d.ca/d.jours : 0;
                      const tc   = taux>=20?'#16a34a':taux>=10?'#f97316':'#ef4444';
                      return (
                        <tr key={k} style={{borderBottom:'1px solid rgba(15,40,80,0.05)',
                          background:i%2?'var(--bg)':'var(--bg2)'}}>
                          <td style={{padding:'7px 12px',fontFamily:'var(--mono)',fontSize:11,
                            fontWeight:500,color:'var(--blue)'}}>{formatMois(k)}</td>
                          <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',
                            fontSize:11,fontWeight:500}}>{fmtEur(d.ca)}</td>
                          <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',
                            fontSize:11,color:'var(--muted)'}}>{fmtNum(d.jours,1)}j</td>
                          <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',
                            fontSize:11,color:tc}}>{fmtEur(d.marge)}</td>
                          <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',
                            fontSize:11,color:tc}}>{fmtNum(taux,1)}%</td>
                          <td style={{padding:'7px 12px',textAlign:'right',fontFamily:'var(--mono)',
                            fontSize:11,color:'var(--muted)'}}>{fmtEur(tjm)}</td>
                        </tr>
                      );
                    })}
                    {/* Ligne total */}
                    <tr style={{borderTop:'2px solid var(--border2)',background:'rgba(30,80,160,0.03)'}}>
                      <td style={{padding:'8px 12px',fontFamily:'var(--mono)',fontSize:11,fontWeight:600}}>TOTAL</td>
                      <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)',fontSize:11,fontWeight:600,color:'var(--blue)'}}>{fmtEur(totCA)}</td>
                      <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)',fontSize:11,fontWeight:500,color:'var(--muted)'}}>{fmtNum(totJours,1)}j</td>
                      <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)',fontSize:11,fontWeight:600,color:'#f97316'}}>{fmtEur(totMarge)}</td>
                      <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)',fontSize:11,fontWeight:600,
                        color:(totCA>0?totMarge/totCA*100:0)>=20?'#16a34a':(totCA>0?totMarge/totCA*100:0)>=10?'#f97316':'#ef4444'}}>
                        {fmtNum(totCA>0?totMarge/totCA*100:0,1)}%
                      </td>
                      <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'var(--mono)',fontSize:11,fontWeight:500,color:'var(--muted)'}}>{fmtEur(totJours>0?totCA/totJours:0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────
export default function ParClient() {
  const { filters } = useFilters();
  const { data: rows, loading } = useProductions(filters);
  const [tab,        setTab]    = useState('synthese');
  const [sort,       setSort]   = useState({ key:'ca', dir:-1 });
  const [anneeDebut, setAnneeDebut] = useState('');
  const [anneeFin,   setAnneeFin]   = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  // Années disponibles
  const annees = useMemo(()=>
    [...new Set(rows.map(r=>String(r.mois_annee).slice(0,4)))].sort().reverse()
  ,[rows]);

  // Données synthèse
  const dataAll = aggregate(rows, 'client');

  // Données croissance
  const croissance = useMemo(() => {
    if (!anneeDebut && !anneeFin) return [];
    const rowsA = anneeDebut ? rows.filter(r=>String(r.mois_annee).startsWith(anneeDebut)) : [];
    const rowsB = anneeFin   ? rows.filter(r=>String(r.mois_annee).startsWith(anneeFin))   : [];
    const aggA  = Object.fromEntries(aggregate(rowsA,'client').map(d=>[d.label,d]));
    const aggB  = Object.fromEntries(aggregate(rowsB,'client').map(d=>[d.label,d]));
    const clients = [...new Set([...Object.keys(aggA),...Object.keys(aggB)])];
    return clients.map(c => {
      const a = aggA[c]||{ca:0,marge:0,jours:0,taux:0,tjm:0};
      const b = aggB[c]||{ca:0,marge:0,jours:0,taux:0,tjm:0};
      return {
        client:    c,
        ca_a:      a.ca,    ca_b:    b.ca,    delta_ca:    delta(b.ca,a.ca),
        marge_a:   a.marge, marge_b: b.marge, delta_marge: delta(b.marge,a.marge),
        jours_a:   a.jours, jours_b: b.jours, delta_jours: delta(b.jours,a.jours),
        taux_a:    a.taux,  taux_b:  b.taux,
        tjm_a:     a.tjm,   tjm_b:   b.tjm,
      };
    }).sort((a,b) => (b.ca_b||b.ca_a) - (a.ca_b||a.ca_a));
  }, [rows, anneeDebut, anneeFin]);

  function toggleSort(key) { setSort(s=>({key,dir:s.key===key?-s.dir:-1})); }
  const th = (key,label) => (
    <th onClick={()=>toggleSort(key)} style={{cursor:'pointer'}}>
      {label}{sort.key===key?(sort.dir===-1?' ↓':' ↑'):''}
    </th>
  );

  const sorted = [...dataAll].sort((a,b)=>sort.dir*((b[sort.key]||0)-(a[sort.key]||0)));

  const tabStyle = (k) => ({
    padding:'8px 16px', fontSize:11, fontFamily:'var(--mono)', cursor:'pointer',
    background:'none', border:'none', textTransform:'uppercase', letterSpacing:'.06em',
    borderBottom: tab===k?'2px solid var(--orange)':'2px solid transparent',
    color: tab===k?'var(--blue)':'var(--muted)', fontWeight: tab===k?500:400,
    marginBottom:-1,
  });

  if (loading) return (
    <div>
      <div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--muted)'}}>Par client</span></div>
      <div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>
    </div>
  );

  return (
    <div>
      {selectedClient && (
        <ClientDetail
          client={selectedClient}
          rows={rows}
          anneeDebut={anneeDebut || annees[annees.length-1]}
          anneeFin={anneeFin || annees[0]}
          onClose={()=>setSelectedClient(null)}
        />
      )}

      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Par client</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{dataAll.length} clients</span>
      </div>
      <div className="page-body">

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:20}}>
          <button style={tabStyle('synthese')}  onClick={()=>setTab('synthese')}>Synthèse</button>
          <button style={tabStyle('croissance')} onClick={()=>setTab('croissance')}>Croissance clients</button>
        </div>

        {/* ── TAB SYNTHÈSE ── */}
        {tab==='synthese' && (
          <div className="table-wrap">
            <div className="table-header">
              <span className="table-title">Analyse par client</span>
              <span style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>Cliquez sur un client pour le détail</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  {th('label','Client')}
                  {th('ca','CA HT')}
                  {th('cout','Coûts')}
                  {th('marge','Marge')}
                  {th('taux','Taux marge')}
                  {th('jours','Jours')}
                  {th('tjm','TJM')}
                  {th('nb','Lignes')}
                </tr></thead>
                <tbody>
                  {sorted.map(d=>{
                    const tc=d.taux>=20?'td-green':d.taux>=10?'':'td-red';
                    const barW=Math.round(d.ca/(dataAll[0]?.ca||1)*100);
                    return (
                      <tr key={d.label} style={{cursor:'pointer'}}
                        onClick={()=>setSelectedClient(d.label)}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(30,80,160,0.04)'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{color:'var(--blue)',textDecoration:'underline',textDecorationStyle:'dotted'}}>{d.label}</span>
                            <span style={{fontSize:10,color:'var(--muted)'}}>↗</span>
                          </div>
                          <div style={{height:3,background:'var(--bg3)',borderRadius:2,marginTop:3,width:120}}>
                            <div style={{height:3,width:barW+'%',background:'#1e50a0',borderRadius:2}}/>
                          </div>
                        </td>
                        <td className="td-right">{fmtEur(d.ca)}</td>
                        <td className="td-right">{fmtEur(d.cout)}</td>
                        <td className={`td-right ${tc}`}>{fmtEur(d.marge)}</td>
                        <td className={`td-right ${tc}`}>{fmtNum(d.taux)}%</td>
                        <td className="td-right">{fmtNum(d.jours,1)}</td>
                        <td className="td-right">{fmtEur(d.tjm)}</td>
                        <td className="td-right td-muted">{d.nb}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB CROISSANCE ── */}
        {tab==='croissance' && (
          <div>
            {/* Sélecteurs années */}
            <div style={{display:'flex',gap:12,alignItems:'flex-end',marginBottom:20,flexWrap:'wrap',
              background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px'}}>
              <div>
                <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:4,fontFamily:'var(--mono)'}}>Année de référence (N)</label>
                <select className="filter-select" style={{width:130}} value={anneeDebut}
                  onChange={e=>setAnneeDebut(e.target.value)}>
                  <option value="">— Choisir</option>
                  {annees.map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
              <div style={{color:'var(--muted)',paddingBottom:6,fontSize:18}}>→</div>
              <div>
                <label style={{fontSize:10,color:'var(--muted)',display:'block',marginBottom:4,fontFamily:'var(--mono)'}}>Année de comparaison (N+1)</label>
                <select className="filter-select" style={{width:130}} value={anneeFin}
                  onChange={e=>setAnneeFin(e.target.value)}>
                  <option value="">— Choisir</option>
                  {annees.map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
              {anneeDebut && anneeFin && (
                <div style={{marginLeft:'auto',fontSize:12,color:'var(--muted)'}}>
                  <span style={{fontFamily:'var(--mono)',color:'var(--blue)',fontWeight:500}}>{croissance.length}</span> clients · cliquez sur un client pour le détail
                </div>
              )}
            </div>

            {!anneeDebut || !anneeFin ? (
              <div className="empty">
                <h3>Choisissez deux années à comparer</h3>
                <p>Sélectionnez une année de référence et une année de comparaison.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <div className="table-header">
                  <span className="table-title">Croissance {anneeDebut} → {anneeFin}</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{verticalAlign:'middle'}}>Client</th>
                        <th colSpan={3} style={{textAlign:'center',color:COLORS[0],borderBottom:'2px solid '+COLORS[0]}}>{anneeDebut}</th>
                        <th colSpan={3} style={{textAlign:'center',color:COLORS[1],borderBottom:'2px solid '+COLORS[1]}}>{anneeFin}</th>
                        <th colSpan={2} style={{textAlign:'center',color:'var(--muted)'}}>Évolution</th>
                      </tr>
                      <tr>
                        <th>CA</th><th>Marge</th><th>Jours</th>
                        <th>CA</th><th>Marge</th><th>Jours</th>
                        <th>CA</th><th>Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {croissance.map(c=>{
                        const tcA=(c.taux_a||0)>=20?'#16a34a':(c.taux_a||0)>=10?'#f97316':'#ef4444';
                        const tcB=(c.taux_b||0)>=20?'#16a34a':(c.taux_b||0)>=10?'#f97316':'#ef4444';
                        return (
                          <tr key={c.client} style={{cursor:'pointer'}}
                            onClick={()=>setSelectedClient(c.client)}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(30,80,160,0.04)'}
                            onMouseLeave={e=>e.currentTarget.style.background=''}>
                            <td>
                              <span style={{color:'var(--blue)',textDecoration:'underline',textDecorationStyle:'dotted'}}>{c.client}</span>
                              {!c.ca_a && c.ca_b>0 && <span className="badge badge-green" style={{marginLeft:6,fontSize:9}}>NOUVEAU</span>}
                              {c.ca_a>0 && !c.ca_b && <span className="badge badge-red" style={{marginLeft:6,fontSize:9}}>PERDU</span>}
                            </td>
                            <td className="td-right" style={{color:COLORS[0]}}>{c.ca_a>0?fmtEur(c.ca_a):'—'}</td>
                            <td className="td-right" style={{color:tcA,fontSize:11}}>{c.ca_a>0?fmtEur(c.marge_a):'—'}</td>
                            <td className="td-right" style={{fontSize:11}}>{c.jours_a>0?fmtNum(c.jours_a,1)+'j':'—'}</td>
                            <td className="td-right" style={{color:COLORS[1]}}>{c.ca_b>0?fmtEur(c.ca_b):'—'}</td>
                            <td className="td-right" style={{color:tcB,fontSize:11}}>{c.ca_b>0?fmtEur(c.marge_b):'—'}</td>
                            <td className="td-right" style={{fontSize:11}}>{c.jours_b>0?fmtNum(c.jours_b,1)+'j':'—'}</td>
                            <td className="td-right"><DeltaBadge pct={c.delta_ca}/></td>
                            <td className="td-right"><DeltaBadge pct={c.delta_marge}/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
