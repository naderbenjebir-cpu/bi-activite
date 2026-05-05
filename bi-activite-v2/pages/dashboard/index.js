import { useFilters } from '../../components/Layout';
import { useProductions, computeKPIs, aggregate } from '../../lib/hooks';
import { fmtEur, fmtNum, formatMois, joursOuvrables } from '../../lib/utils';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const COLORS = ['#1e50a0','#f97316','#0ea5e9','#7c3aed','#16a34a','#ef4444','#ca8a04','#0891b2'];

function KPICard({ label, value, sub, color = '#1e50a0' }) {
  return (
    <div className="kpi-card" style={{ borderTopColor: color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-val" style={{ color }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function DashboardHome() {
  const { filters } = useFilters();
  const { data: rows, loading } = useProductions(filters);

  const kpis = computeKPIs(rows);
  const tauxCol = kpis.taux >= 20 ? '#16a34a' : kpis.taux >= 10 ? '#f97316' : '#ef4444';

  // TACE global
  const collabsU = [...new Set(rows.map(r => r.collaborateur).filter(Boolean))];
  const moisU    = [...new Set(rows.map(r => String(r.mois_annee)).filter(Boolean))];
  const capTotal = collabsU.length * moisU.reduce((s, m) => s + joursOuvrables(m), 0);
  const tace     = capTotal > 0 ? Math.min(kpis.jours / capTotal * 100, 100) : 0;
  const taceCol  = tace >= 80 ? '#16a34a' : tace >= 50 ? '#f97316' : '#ef4444';

  // Évolution mensuelle
  const byMois = {};
  rows.forEach(r => {
    const m = String(r.mois_annee);
    if (!byMois[m]) byMois[m] = { ca: 0, cout: 0 };
    byMois[m].ca   += parseFloat(r.total_ht)   || 0;
    byMois[m].cout += parseFloat(r.cout_total) || 0;
  });
  const moisKeys   = Object.keys(byMois).sort();
  const evolLabels = moisKeys.map(formatMois);

  const evolData = {
    labels: evolLabels,
    datasets: [
      { label: 'CA',    data: moisKeys.map(m => byMois[m].ca),                 backgroundColor: '#1e50a030', borderColor: '#1e50a0', borderWidth: 1.5, borderRadius: 3 },
      { label: 'Coûts', data: moisKeys.map(m => byMois[m].cout),               backgroundColor: '#0ea5e930', borderColor: '#0ea5e9', borderWidth: 1.5, borderRadius: 3 },
      { label: 'Marge', data: moisKeys.map(m => byMois[m].ca - byMois[m].cout),backgroundColor: '#f9731640', borderColor: '#f97316', borderWidth: 1.5, borderRadius: 3 },
    ],
  };

  const byClient = aggregate(rows, 'client').slice(0, 8);
  const donutData = {
    labels: byClient.map(d => d.label),
    datasets: [{ data: byClient.map(d => d.ca), backgroundColor: COLORS, borderWidth: 0 }],
  };

  const byCollab = aggregate(rows, 'collaborateur').slice(0, 12);
  const collabData = {
    labels: byCollab.map(d => d.label),
    datasets: [{ data: byCollab.map(d => d.jours), backgroundColor: '#1e50a030', borderColor: '#1e50a0', borderWidth: 1.5, borderRadius: 4 }],
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#5a7296', font: { size: 10 }, boxWidth: 10 } } },
    scales: {
      x: { grid: { color: 'rgba(15,40,80,0.05)' }, ticks: { color: '#5a7296', font: { size: 10 } } },
      y: { grid: { color: 'rgba(15,40,80,0.05)' }, ticks: { color: '#5a7296', font: { size: 10 }, callback: v => (v/1000).toFixed(0)+'k€' } },
    },
  };

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { color: '#5a7296', font: { size: 10 }, padding: 8, boxWidth: 10 } } },
  };

  const hbarOpts = {
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(15,40,80,0.05)' }, ticks: { color: '#5a7296', font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: '#0d1f3c', font: { size: 11 } } },
    },
  };

  if (loading) return (
    <div>
      <div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--muted)'}}>Vue globale</span></div>
      <div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Vue globale</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{rows.length.toLocaleString('fr-FR')} lignes</span>
      </div>
      <div className="page-body">

        <div className="kpi-grid">
          <KPICard label="CA total"      value={fmtEur(kpis.ca)}         sub={`${rows.length} lignes`}               color="#1e50a0" />
          <KPICard label="Coûts"         value={fmtEur(kpis.cout)}       sub={`${fmtNum(kpis.jours,1)} j facturés`}  color="#0ea5e9" />
          <KPICard label="Marge brute"   value={fmtEur(kpis.marge)}                                                  color="#f97316" />
          <KPICard label="Taux de marge" value={`${fmtNum(kpis.taux)}%`}                                             color={tauxCol} />
          <KPICard label="TJM moyen"     value={fmtEur(kpis.tjm)}        sub="€ / jour"                              color="#7c3aed" />
          <KPICard label="TACE global"   value={`${fmtNum(tace)}%`}      sub={`${fmtNum(kpis.jours,0)}j / ${capTotal}j · ${collabsU.length} collabs`} color={taceCol} />
        </div>

        <div className="charts-grid">
          <div className="chart-card full">
            <div className="chart-label">Évolution mensuelle — CA · Coûts · Marge</div>
            <div style={{height:220}}><Bar data={evolData} options={chartOpts} /></div>
          </div>
          <div className="chart-card">
            <div className="chart-label">Répartition CA par client</div>
            <div style={{height:240}}><Doughnut data={donutData} options={donutOpts} /></div>
          </div>
          <div className="chart-card">
            <div className="chart-label">Jours produits par collaborateur (top 12)</div>
            <div style={{height: Math.max(200, byCollab.length * 28 + 60)}}><Bar data={collabData} options={hbarOpts} /></div>
          </div>
        </div>

        <div className="table-wrap">
          <div className="table-header"><span className="table-title">Synthèse par client</span></div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>Client</th><th>CA HT</th><th>Coûts</th><th>Marge</th><th>Taux</th><th>Jours</th><th>TJM</th>
              </tr></thead>
              <tbody>
                {aggregate(rows, 'client').map(d => {
                  const tc = d.taux >= 20 ? 'td-green' : d.taux >= 10 ? '' : 'td-red';
                  return (
                    <tr key={d.label}>
                      <td>{d.label}</td>
                      <td className="td-right">{fmtEur(d.ca)}</td>
                      <td className="td-right">{fmtEur(d.cout)}</td>
                      <td className={`td-right ${tc}`}>{fmtEur(d.marge)}</td>
                      <td className={`td-right ${tc}`}>{fmtNum(d.taux)}%</td>
                      <td className="td-right">{fmtNum(d.jours,1)}</td>
                      <td className="td-right">{fmtEur(d.tjm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}