import { useState } from 'react';
import { useFilters } from '../../components/Layout';
import { useProductions, aggregate } from '../../lib/hooks';
import { fmtEur, fmtNum } from '../../lib/utils';

export default function ParAffaire() {
  const { filters } = useFilters();
  const { data: rows, loading } = useProductions(filters);
  const [sort, setSort] = useState({ key: 'ca', dir: -1 });

  const data = aggregate(rows, 'ref_affaire').map(d => {
    const r0 = rows.find(r => r.ref_affaire === d.label);
    const coutUnitaire = d.jours > 0 ? d.cout / d.jours : 0;
    return { ...d, objet: r0?.objet_affaire||'—', client: r0?.client||'—', coutUnitaire };
  }).sort((a,b) => sort.dir * ((b[sort.key]||0)-(a[sort.key]||0)));

  function toggleSort(key) { setSort(s => ({ key, dir: s.key===key?-s.dir:-1 })); }
  const th = (key, label) => (
    <th onClick={() => toggleSort(key)} style={{cursor:'pointer'}}>
      {label}{sort.key===key?(sort.dir===-1?' ↓':' ↑'):''}
    </th>
  );

  if (loading) return (
    <div>
      <div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12}}>Par affaire</span></div>
      <div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Par affaire</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{data.length} affaires</span>
      </div>
      <div className="page-body">
        <div className="table-wrap">
          <div className="table-header"><span className="table-title">Analyse par affaire</span></div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                {th('label','Réf. affaire')}
                {th('objet','Objet')}
                {th('client','Client')}
                {th('ca','CA HT')}
                {th('marge','Marge')}
                {th('taux','Taux')}
                {th('jours','Jours')}
                {th('tjm','TJM')}
                {th('coutUnitaire','Coût/j moy.')}
              </tr></thead>
              <tbody>
                {data.map(d => {
                  const tc = d.taux>=20?'td-green':d.taux>=10?'':'td-red';
                  return (
                    <tr key={d.label}>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{d.label}</td>
                      <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}}>{d.objet}</td>
                      <td>{d.client}</td>
                      <td className="td-right">{fmtEur(d.ca)}</td>
                      <td className={`td-right ${tc}`}>{fmtEur(d.marge)}</td>
                      <td className={`td-right ${tc}`}>{fmtNum(d.taux)}%</td>
                      <td className="td-right">{fmtNum(d.jours,1)}</td>
                      <td className="td-right">{fmtEur(d.tjm)}</td>
                      <td className="td-right td-muted">{d.coutUnitaire>0?fmtEur(d.coutUnitaire):'—'}</td>
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
