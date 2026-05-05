import { useState } from 'react';
import { useFilters } from '../../components/Layout';
import { useProductions } from '../../lib/hooks';
import { fmtEur, fmtNum, formatMois } from '../../lib/utils';

function aggregateLines(rows) {
  const map = {};
  rows.forEach(r => {
    const key = `${r.mois_annee}||${r.collaborateur}||${r.ref_affaire}`;
    if (!map[key]) {
      map[key] = {
        mois_annee:      r.mois_annee,
        collaborateur:   r.collaborateur,
        entite_collab:   r.entite_collab,
        client:          r.client,
        client_final:    r.client_final,
        ref_affaire:     r.ref_affaire,
        objet_affaire:   r.objet_affaire,
        interne_externe: r.interne_externe,
        regie_forfait:   r.regie_forfait,
        pv_jour:         parseFloat(r.pv_jour) || 0,
        cout_jour:       parseFloat(r.cout_jour) || 0,
        nb_jours:  0, total_ht:  0,
        cout_total: 0, marge_brute: 0, nb_lignes: 0,
      };
    }
    map[key].nb_jours    += parseFloat(r.nb_jours)    || 0;
    map[key].total_ht    += parseFloat(r.total_ht)    || 0;
    map[key].cout_total  += parseFloat(r.cout_total)  || 0;
    map[key].marge_brute += parseFloat(r.marge_brute) || 0;
    map[key].nb_lignes   += 1;
    // Prendre le cout_jour le plus récent (non nul)
    if (parseFloat(r.cout_jour) > 0) map[key].cout_jour = parseFloat(r.cout_jour);
  });
  return Object.values(map).map(d => ({
    ...d,
    taux_marge: d.total_ht > 0 ? (d.marge_brute / d.total_ht * 100) : 0,
  }));
}

export default function Detail() {
  const { filters } = useFilters();
  const { data: rows, loading } = useProductions(filters);
  const [sort, setSort] = useState({ key: 'mois_annee', dir: -1 });

  const aggregated = aggregateLines(rows);

  const sorted = [...aggregated].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (sort.key === 'mois_annee') return sort.dir * ((parseInt(bv)||0) - (parseInt(av)||0));
    if (typeof av === 'string' && typeof bv === 'string') return sort.dir * av.localeCompare(bv);
    return sort.dir * ((parseFloat(bv)||0) - (parseFloat(av)||0));
  });

  function toggleSort(key) { setSort(s => ({ key, dir: s.key===key?-s.dir:-1 })); }
  const th = (key, label) => (
    <th onClick={() => toggleSort(key)} style={{cursor:'pointer'}}>
      {label}{sort.key===key?(sort.dir===-1?' ↓':' ↑'):''}
    </th>
  );

  if (loading) return (
    <div>
      <div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12}}>Détail lignes</span></div>
      <div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Détail lignes</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>
          {sorted.length.toLocaleString('fr-FR')} lignes agrégées
          {rows.length !== sorted.length && ` (${rows.length} sources)`}
        </span>
      </div>
      <div className="page-body">
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">Production par mois · collaborateur · affaire</span>
            <span style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)'}}>
              Agrégé sur Mois + Collaborateur + Réf. affaire
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                {th('mois_annee','Mois')}
                {th('collaborateur','Collaborateur')}
                {th('entite_collab','Entité')}
                {th('client','Client')}
                {th('ref_affaire','Réf. affaire')}
                {th('interne_externe','Type')}
                {th('nb_jours','Jours')}
                {th('pv_jour','PV/j')}
                {th('cout_jour','Coût/j')}
                {th('total_ht','CA HT')}
                {th('cout_total','Coûts')}
                {th('marge_brute','Marge')}
                {th('taux_marge','Taux')}
              </tr></thead>
              <tbody>
                {sorted.map((r, i) => {
                  const taux = parseFloat(r.taux_marge)||0;
                  const tc   = taux>=20?'td-green':taux>=10?'':'td-red';
                  return (
                    <tr key={i}>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{formatMois(r.mois_annee)}</td>
                      <td>{r.collaborateur}</td>
                      <td className="td-muted">{r.entite_collab}</td>
                      <td>{r.client}</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>
                        {r.ref_affaire}
                        {r.nb_lignes > 1 && (
                          <span className="badge badge-blue" style={{marginLeft:4}}>×{r.nb_lignes}</span>
                        )}
                      </td>
                      <td>{r.interne_externe}</td>
                      <td className="td-right" style={{fontWeight:r.nb_lignes>1?500:400}}>
                        {fmtNum(r.nb_jours,1)}
                      </td>
                      <td className="td-right td-muted">{fmtEur(r.pv_jour)}</td>
                      <td className="td-right td-muted">{r.cout_jour>0?fmtEur(r.cout_jour):'—'}</td>
                      <td className="td-right">{fmtEur(r.total_ht)}</td>
                      <td className="td-right">{fmtEur(r.cout_total)}</td>
                      <td className={`td-right ${tc}`}>{fmtEur(r.marge_brute)}</td>
                      <td className={`td-right ${tc}`}>{fmtNum(taux)}%</td>
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
