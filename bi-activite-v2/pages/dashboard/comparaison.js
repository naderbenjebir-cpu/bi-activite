import { useState } from 'react';
import { useFilters } from '../../components/Layout';
import { useProductions } from '../../lib/hooks';
import { fmtEur, fmtNum, formatMois } from '../../lib/utils';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const COLORS = ['#1e50a0','#f97316','#16a34a','#7c3aed','#0ea5e9','#ef4444'];
const MOIS_COURTS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function metricLabel(m) {
  return { ca:'CA HT', marge:'Marge brute', jours:'Jours facturés', taux:'Taux marge %' }[m];
}
function metricFmt(m, v) {
  if (m === 'ca' || m === 'marge') return fmtEur(v);
  if (m === 'jours') return fmtNum(v,1) + 'j';
  return fmtNum(v,1) + '%';
}
function getVal(d, m) {
  if (m === 'ca')    return d.ca    || 0;
  if (m === 'marge') return d.marge || 0;
  if (m === 'jours') return d.jours || 0;
  if (m === 'taux')  return d.ca > 0 ? (d.marge / d.ca * 100) : 0;
  return 0;
}

export default function Comparaison() {
  const { filters } = useFilters();
  const { data: rows, loading } = useProductions({ ...filters, moisDebut: '', moisFin: '', anneeDebut: '', anneeFin: '' });
  const [axis,   setAxis]   = useState('mois');
  const [metric, setMetric] = useState('ca');

  // Bornes de période (appliquées sur les données pour masquer les mois hors période)
  const borneDebut = filters.moisDebut
    ? parseInt(filters.moisDebut)
    : filters.anneeDebut ? parseInt(filters.anneeDebut) * 100 + 1 : null;
  const borneFin = filters.moisFin
    ? parseInt(filters.moisFin)
    : filters.anneeFin ? parseInt(filters.anneeFin) * 100 + 12 : null;

  const annees = [...new Set(rows.map(r => String(r.mois_annee).slice(0,4)))].sort();

  // KPIs par année
  const kpiByAnnee = {};
  annees.forEach(a => { kpiByAnnee[a] = { ca:0, cout:0, marge:0, jours:0 }; });
  rows.forEach(r => {
    const a = String(r.mois_annee).slice(0,4);
    if (!kpiByAnnee[a]) return;
    kpiByAnnee[a].ca    += parseFloat(r.total_ht)   || 0;
    kpiByAnnee[a].cout  += parseFloat(r.cout_total) || 0;
    kpiByAnnee[a].marge += (parseFloat(r.total_ht)||0) - (parseFloat(r.cout_total)||0);
    kpiByAnnee[a].jours += parseFloat(r.nb_jours)   || 0;
  });

  // Données graphique selon axis
  let chartLabels = [], chartDatasets = [];

  if (axis === 'mois') {
    chartLabels = MOIS_COURTS;
    annees.forEach((a, i) => {
      const byMois = Array(12).fill(0);
      const caByMois = Array(12).fill(0);
      const margeByMois = Array(12).fill(0);
      rows.filter(r => {
        if (String(r.mois_annee).slice(0,4) !== a) return false;
        const ma = parseInt(r.mois_annee);
        if (borneDebut && ma < borneDebut) return false;
        if (borneFin   && ma > borneFin)   return false;
        return true;
      }).forEach(r => {
        const mo = parseInt(String(r.mois_annee).slice(4,6)) - 1;
        caByMois[mo]    += parseFloat(r.total_ht)   || 0;
        margeByMois[mo] += (parseFloat(r.total_ht)||0) - (parseFloat(r.cout_total)||0);
        if (metric === 'jours') byMois[mo] += parseFloat(r.nb_jours) || 0;
      });
      const data = metric === 'ca'    ? caByMois
                 : metric === 'marge' ? margeByMois
                 : metric === 'taux'  ? caByMois.map((c,j) => c>0 ? margeByMois[j]/c*100 : 0)
                 : byMois;
      chartDatasets.push({
        label: a, data,
        borderColor: COLORS[i], backgroundColor: COLORS[i]+'25',
        borderWidth: 2, tension: 0.3, pointRadius: 3,
      });
    });
  } else {
    const KEY = axis === 'entite' ? 'entite_collab' : axis;
    const allKeys = [...new Set(rows.map(r => r[KEY]||'N/A'))];
    const keyCA = {};
    rows.forEach(r => { const k=r[KEY]||'N/A'; keyCA[k]=(keyCA[k]||0)+(parseFloat(r.total_ht)||0); });
    chartLabels = allKeys.sort((a,b)=>(keyCA[b]||0)-(keyCA[a]||0)).slice(0,12);
    annees.forEach((a, i) => {
      const byKey = {};
      rows.filter(r => String(r.mois_annee).slice(0,4) === a).forEach(r => {
        const k = r[KEY]||'N/A';
        if (!byKey[k]) byKey[k] = { ca:0, cout:0, marge:0, jours:0 };
        byKey[k].ca    += parseFloat(r.total_ht)   || 0;
        byKey[k].cout  += parseFloat(r.cout_total) || 0;
        byKey[k].marge += (parseFloat(r.total_ht)||0)-(parseFloat(r.cout_total)||0);
        byKey[k].jours += parseFloat(r.nb_jours)   || 0;
      });
      chartDatasets.push({
        label: a,
        data: chartLabels.map(k => getVal(byKey[k]||{}, metric)),
        backgroundColor: COLORS[i]+'60', borderColor: COLORS[i], borderWidth: 1.5, borderRadius: 4,
      });
    });
  }

  const chartData = { labels: chartLabels, datasets: chartDatasets };
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color:'#5a7296', font:{size:10}, boxWidth:10 } } },
    scales: {
      x: { grid:{color:'rgba(15,40,80,0.05)'}, ticks:{color:'#5a7296',font:{size:10}} },
      y: { grid:{color:'rgba(15,40,80,0.05)'}, ticks:{color:'#5a7296',font:{size:10},
        callback: v => metric==='taux'?v+'%':metric==='jours'?v+'j':(v/1000).toFixed(0)+'k€' } },
    },
  };

  const btnStyle = (active) => ({
    fontSize:11, padding:'4px 12px', borderRadius:20,
    border: active ? 'none' : '1px solid var(--border)',
    background: active ? 'var(--blue)' : 'var(--bg2)',
    color: active ? '#fff' : 'var(--muted)',
    cursor:'pointer', fontFamily:'var(--mono)',
  });

  if (loading) return (
    <div>
      <div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--muted)'}}>Comparaison années</span></div>
      <div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Comparaison années</span>
      </div>
      <div className="page-body">

        {/* KPIs par année */}
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
          {annees.map((a,i) => {
            const d = kpiByAnnee[a];
            const taux = d.ca>0 ? d.marge/d.ca*100 : 0;
            const prev = i>0 ? kpiByAnnee[annees[i-1]] : null;
            const delta = prev && prev.ca>0 ? (d.ca-prev.ca)/prev.ca*100 : null;
            return (
              <div key={a} style={{background:'var(--bg2)',border:'1px solid var(--border)',
                borderTop:`3px solid ${COLORS[i]}`,borderRadius:10,padding:'14px 16px',minWidth:160,flex:1}}>
                <div style={{fontSize:16,fontWeight:600,color:COLORS[i],fontFamily:'var(--mono)',marginBottom:8}}>{a}</div>
                <div style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)',textTransform:'uppercase'}}>CA</div>
                <div style={{fontSize:18,fontWeight:600}}>{fmtEur(d.ca)}</div>
                {delta !== null && (
                  <div style={{fontSize:10,color:delta>=0?'#16a34a':'#ef4444',fontFamily:'var(--mono)'}}>
                    {delta>=0?'+':''}{fmtNum(delta,1)}% vs {annees[i-1]}
                  </div>
                )}
                <div style={{marginTop:8,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  <div><div style={{fontSize:10,color:'var(--muted)'}}>Marge</div><div style={{fontSize:13,color:'#f97316'}}>{fmtEur(d.marge)}</div></div>
                  <div><div style={{fontSize:10,color:'var(--muted)'}}>Taux</div><div style={{fontSize:13,color:taux>=20?'#16a34a':taux>=10?'#f97316':'#ef4444'}}>{fmtNum(taux,1)}%</div></div>
                  <div><div style={{fontSize:10,color:'var(--muted)'}}>Jours</div><div style={{fontSize:13}}>{fmtNum(d.jours,1)}</div></div>
                  <div><div style={{fontSize:10,color:'var(--muted)'}}>TJM</div><div style={{fontSize:13}}>{d.jours>0?fmtEur(d.ca/d.jours):'—'}</div></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contrôles */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>Axe :</span>
          {['mois','client','collaborateur','entite'].map(a => (
            <button key={a} style={btnStyle(axis===a)} onClick={() => setAxis(a)}>
              {a==='entite'?'Entité':a.charAt(0).toUpperCase()+a.slice(1)}
            </button>
          ))}
          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
            {['ca','marge','jours','taux'].map(m => (
              <button key={m} style={btnStyle(metric===m)} onClick={() => setMetric(m)}>
                {metricLabel(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Graphique */}
        <div className="chart-card" style={{marginBottom:24}}>
          <div className="chart-label">{metricLabel(metric)} — comparaison années</div>
          <div style={{height:280}}>
            {axis==='mois'
              ? <Line data={chartData} options={chartOpts} />
              : <Bar  data={chartData} options={chartOpts} />
            }
          </div>
        </div>

        {/* Tableau */}
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">{metricLabel(metric)} par {axis==='entite'?'entité':axis} — comparaison</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>{axis==='entite'?'Entité':axis.charAt(0).toUpperCase()+axis.slice(1)}</th>
                {annees.map(a => <th key={a} style={{color:COLORS[annees.indexOf(a)]}}>{a}</th>)}
                {annees.length>1 && <th style={{color:'var(--muted)'}}>Évolution</th>}
              </tr></thead>
              <tbody>
                {axis==='mois'
                  ? MOIS_COURTS.map((mois, mo) => {
                      const vals = annees.map(a => {
                        const d = { ca:0, cout:0, marge:0, jours:0 };
                        rows.filter(r => {
                          if (String(r.mois_annee).slice(0,4) !== a) return false;
                          if (parseInt(String(r.mois_annee).slice(4,6))-1 !== mo) return false;
                          const ma = parseInt(r.mois_annee);
                          if (borneDebut && ma < borneDebut) return false;
                          if (borneFin   && ma > borneFin)   return false;
                          return true;
                        })
                          .forEach(r => {
                            d.ca    += parseFloat(r.total_ht)||0;
                            d.cout  += parseFloat(r.cout_total)||0;
                            d.marge += (parseFloat(r.total_ht)||0)-(parseFloat(r.cout_total)||0);
                            d.jours += parseFloat(r.nb_jours)||0;
                          });
                        return getVal(d, metric);
                      });
                      if (vals.every(v=>v===0)) return null;
                      const evol = annees.length>1 && vals[0]>0 ? (vals[vals.length-1]-vals[0])/vals[0]*100 : null;
                      return (
                        <tr key={mois}>
                          <td>{mois}</td>
                          {vals.map((v,i) => <td key={i} className="td-right">{metricFmt(metric,v)}</td>)}
                          {evol!==null && <td className="td-right" style={{color:evol>=0?'#16a34a':'#ef4444'}}>{evol>=0?'+':''}{fmtNum(evol,1)}%</td>}
                        </tr>
                      );
                    })
                  : chartLabels.map(label => {
                      const KEY = axis==='entite'?'entite_collab':axis;
                      const vals = annees.map(a => {
                        const d = { ca:0, cout:0, marge:0, jours:0 };
                        rows.filter(r => String(r.mois_annee).slice(0,4)===a && (r[KEY]||'N/A')===label)
                          .forEach(r => {
                            d.ca    += parseFloat(r.total_ht)||0;
                            d.cout  += parseFloat(r.cout_total)||0;
                            d.marge += (parseFloat(r.total_ht)||0)-(parseFloat(r.cout_total)||0);
                            d.jours += parseFloat(r.nb_jours)||0;
                          });
                        return getVal(d, metric);
                      });
                      const evol = annees.length>1 && vals[0]>0 ? (vals[vals.length-1]-vals[0])/vals[0]*100 : null;
                      return (
                        <tr key={label}>
                          <td>{label}</td>
                          {vals.map((v,i) => <td key={i} className="td-right">{metricFmt(metric,v)}</td>)}
                          {evol!==null && <td className="td-right" style={{color:evol>=0?'#16a34a':'#ef4444'}}>{evol>=0?'+':''}{fmtNum(evol,1)}%</td>}
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
