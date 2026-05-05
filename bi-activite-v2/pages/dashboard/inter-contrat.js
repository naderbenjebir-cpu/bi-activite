import { useEffect, useState } from 'react';
import { useFilters } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { fmtEur, fmtNum, formatMois } from '../../lib/utils';

export default function InterContrat() {
  const { filters } = useFilters();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let q = supabase.from('v_intercontrat').select('*');
      if (filters.entite)    q = q.eq('entite', filters.entite);
      if (filters.collab)    q = q.eq('collaborateur', filters.collab);
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
  }, [filters.entite, filters.collab, filters.moisDebut, filters.moisFin, filters.anneeDebut, filters.anneeFin]);

  // KPIs
  const totalIC    = rows.reduce((s,r) => s + (parseFloat(r.jours_intercontrat)||0), 0);
  const totalCout  = rows.reduce((s,r) => s + (parseFloat(r.cout_intercontrat)||0), 0);
  const nbCollabs  = new Set(rows.map(r => r.collaborateur)).size;
  const avgDuree   = nbCollabs > 0 ? totalIC / nbCollabs : 0;

  if (loading) return <div><div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12}}>Inter-contrat</span></div><div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div></div>;

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Inter-contrat</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{rows.length} entrées</span>
      </div>
      <div className="page-body">

        {/* KPIs */}
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="kpi-card" style={{borderTopColor:'#ef4444'}}>
            <div className="kpi-label">Collaborateurs en IC</div>
            <div className="kpi-val" style={{color:'#ef4444'}}>{nbCollabs}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#f97316'}}>
            <div className="kpi-label">Jours IC total</div>
            <div className="kpi-val" style={{color:'#f97316'}}>{fmtNum(totalIC,1)}j</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#1e50a0'}}>
            <div className="kpi-label">Coût inter-contrat</div>
            <div className="kpi-val" style={{color:'#1e50a0'}}>{fmtEur(totalCout)}</div>
          </div>
          <div className="kpi-card" style={{borderTopColor:'#7c3aed'}}>
            <div className="kpi-label">Durée moy. / collab</div>
            <div className="kpi-val" style={{color:'#7c3aed'}}>{fmtNum(avgDuree,1)}j</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <h3>Aucune donnée inter-contrat</h3>
            <p>Importez le fichier KPI mensuel dans l'admin pour voir les données inter-contrat.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-header"><span className="table-title">Détail inter-contrat</span></div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>Mois</th>
                  <th>Collaborateur</th>
                  <th>Service</th>
                  <th>Statut</th>
                  <th>Jours IC</th>
                  <th>Jours prod.</th>
                  <th>Jours pot.</th>
                  <th>Taux IC</th>
                  <th>TACE</th>
                  <th>Coût/j effectif</th>
                  <th>Coût IC</th>
                  <th>Source</th>
                </tr></thead>
                <tbody>
                  {rows.map((r,i) => (
                    <tr key={i}>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{formatMois(r.mois_annee)}</td>
                      <td>{r.collaborateur}</td>
                      <td className="td-muted">{r.service||'—'}</td>
                      <td>
                        <span className={`badge ${r.statut_mois==='inter-contrat'?'badge-red':'badge-orange'}`}>
                          {r.statut_mois}
                        </span>
                      </td>
                      <td className="td-right">{fmtNum(r.jours_intercontrat,1)}j</td>
                      <td className="td-right">{fmtNum(r.jours_produits,1)}j</td>
                      <td className="td-right td-muted">{fmtNum(r.jours_potentiels,1)}j</td>
                      <td className="td-right td-red">{fmtNum(r.taux_ic,1)}%</td>
                      <td className="td-right">{fmtNum(r.tace,1)}%</td>
                      <td className="td-right td-muted">{fmtEur(r.cout_jour_effectif || r.cout_moyen_j)}</td>
                      <td className="td-right" style={{color:'#ef4444',fontWeight:500}}>{fmtEur(r.cout_intercontrat)}</td>
                      <td>
                        {r.cout_intercontrat > 0
                          ? <span className={`badge ${
                              r.source_cout==='kpi'         ? 'badge-green'  :
                              r.source_cout==='kpi_proche'  ? 'badge-blue'   :
                              r.source_cout==='production'  ? 'badge-orange' : 'badge-gray'
                            }`}>{r.source_cout || 'kpi'}</span>
                          : <span className="badge badge-red">manquant</span>
                        }
                      </td>
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
