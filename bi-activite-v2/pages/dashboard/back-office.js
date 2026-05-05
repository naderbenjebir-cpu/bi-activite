import { useEffect, useState } from 'react';
import { useFilters } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { fmtEur, fmtNum, formatMois } from '../../lib/utils';

export default function BackOffice() {
  const { filters } = useFilters();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase.from('cout_backoffice_mensuel').select('*');
      if (filters.entite)    q = q.eq('entite', filters.entite);
      const bd = filters.moisDebut ? parseInt(filters.moisDebut) : filters.anneeDebut ? parseInt(filters.anneeDebut)*100+1 : null;
      const bf = filters.moisFin   ? parseInt(filters.moisFin)   : filters.anneeFin   ? parseInt(filters.anneeFin)*100+12  : null;
      if (bd) q = q.gte('mois_annee', bd);
      if (bf) q = q.lte('mois_annee', bf);
      q = q.order('mois_annee', { ascending: false });
      const { data } = await q;
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [filters.entite, filters.moisDebut, filters.moisFin, filters.anneeDebut, filters.anneeFin]);

  const totalCout = rows.reduce((s,r) => s+(parseFloat(r.cout_total)||0), 0);
  const nbCollabs = new Set(rows.map(r => r.collaborateur)).size;
  const moisU     = new Set(rows.map(r => r.mois_annee)).size;

  const byType = {};
  rows.forEach(r => {
    const t = r.sous_type||'autre';
    if (!byType[t]) byType[t] = 0;
    byType[t] += parseFloat(r.cout_total)||0;
  });

  if (loading) return <div><div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12}}>Back-Office</span></div><div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div></div>;

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Back-Office</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{rows.length} entrées</span>
      </div>
      <div className="page-body">

        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="kpi-card" style={{borderTopColor:'#1e50a0'}}>
            <div className="kpi-label">Coût back-office total</div>
            <div className="kpi-val" style={{color:'#1e50a0'}}>{fmtEur(totalCout)}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#7c3aed'}}>
            <div className="kpi-label">Collaborateurs BO</div>
            <div className="kpi-val" style={{color:'#7c3aed'}}>{nbCollabs}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#0ea5e9'}}>
            <div className="kpi-label">Coût moyen / mois</div>
            <div className="kpi-val" style={{color:'#0ea5e9'}}>{moisU>0?fmtEur(totalCout/moisU):'—'}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#f97316'}}>
            <div className="kpi-label">Périodes couvertes</div>
            <div className="kpi-val" style={{color:'#f97316'}}>{moisU}</div>
          </div>
        </div>

        {/* Répartition par type */}
        {Object.keys(byType).length > 0 && (
          <div style={{display:'flex',gap:10,marginBottom:24,flexWrap:'wrap'}}>
            {Object.entries(byType).map(([type, cout]) => (
              <div key={type} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 14px'}}>
                <div style={{fontSize:10,color:'var(--muted)',textTransform:'uppercase',fontFamily:'var(--mono)'}}>{type}</div>
                <div style={{fontSize:16,fontWeight:600,color:'var(--text)'}}>{fmtEur(cout)}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>{fmtNum(cout/totalCout*100,1)}% du total</div>
              </div>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="empty">
            <h3>Aucune donnée back-office</h3>
            <p>Renseignez les coûts des collaborateurs back-office dans Admin → Collaborateurs, puis générez les coûts mensuels.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-header"><span className="table-title">Coûts back-office par mois</span></div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>Mois</th>
                  <th>Collaborateur</th>
                  <th>Type</th>
                  <th>Coût/j</th>
                  <th>Jours ouv.</th>
                  <th>Coût total</th>
                  <th>Source</th>
                </tr></thead>
                <tbody>
                  {rows.map((r,i) => (
                    <tr key={i}>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{formatMois(r.mois_annee)}</td>
                      <td>{r.collaborateur}</td>
                      <td><span className="badge badge-blue">{r.sous_type||'—'}</span></td>
                      <td className="td-right">{fmtEur(r.cout_jour)}</td>
                      <td className="td-right">{r.nb_jours_ouvrables}j</td>
                      <td className="td-right" style={{fontWeight:500}}>{fmtEur(r.cout_total)}</td>
                      <td><span className={`badge ${r.source_cout==='manuel'?'badge-orange':'badge-gray'}`}>{r.source_cout}</span></td>
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
