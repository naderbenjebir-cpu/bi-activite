import { useState } from 'react';
import { useFilters } from '../../components/Layout';
import { useProductions, aggregate } from '../../lib/hooks';
import { fmtEur, fmtNum, joursOuvrables } from '../../lib/utils';

function taceColor(v) {
  return v >= 80 ? 'td-green' : v >= 50 ? 'td-orange' : 'td-red';
}

export default function ParCollaborateur() {
  const { filters } = useFilters();
  const { data: rows, loading } = useProductions(filters);
  const [sort, setSort] = useState({ key: 'tace', dir: -1 });

  const collabMois = {};
  rows.forEach(r => {
    const c = r.collaborateur||'N/A';
    const m = String(r.mois_annee);
    if (!collabMois[c]) collabMois[c] = new Set();
    collabMois[c].add(m);
  });
  const moisJOMap = {};
  [...new Set(rows.map(r => String(r.mois_annee)))].forEach(m => { moisJOMap[m] = joursOuvrables(m); });

  const data = aggregate(rows, 'collaborateur').map(d => {
    const mois = collabMois[d.label] || new Set();
    const jo   = [...mois].reduce((s,m) => s+(moisJOMap[m]||0), 0);
    const tace = jo>0 ? Math.min(d.jours/jo*100, 100) : 0;
    const coutUnitaire = d.jours > 0 ? d.cout / d.jours : 0;
    return { ...d, jo, tace, coutUnitaire };
  }).sort((a,b) => sort.dir * ((b[sort.key]||0)-(a[sort.key]||0)));

  function toggleSort(key) { setSort(s => ({ key, dir: s.key===key ? -s.dir : -1 })); }
  const th = (key, label) => (
    <th onClick={() => toggleSort(key)} style={{cursor:'pointer'}}>
      {label}{sort.key===key?(sort.dir===-1?' ↓':' ↑'):''}
    </th>
  );

  if (loading) return (
    <div>
      <div className="topbar"><span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--muted)'}}>Par collaborateur</span></div>
      <div className="page-body"><div className="loading"><div className="spinner"/><span>Chargement...</span></div></div>
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Par collaborateur</span>
        <span style={{marginLeft:'auto',fontFamily:'var(--mono)',fontSize:11,color:'var(--muted)'}}>{data.length} collaborateurs</span>
      </div>
      <div className="page-body">
        <div className="table-wrap">
          <div className="table-header"><span className="table-title">Analyse par collaborateur</span></div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                {th('label','Collaborateur')}
                {th('tace','TACE')}
                {th('jours','Jours facturés')}
                {th('jo','Jours ouvrables')}
                {th('ca','CA HT')}
                {th('marge','Marge')}
                {th('taux','Tx marge')}
                {th('tjm','TJM')}
                {th('coutUnitaire','Coût/j moy.')}
              </tr></thead>
              <tbody>
                {data.map(d => {
                  const tc = d.taux>=20?'td-green':d.taux>=10?'':'td-red';
                  const taceW = Math.round(d.tace);
                  return (
                    <tr key={d.label}>
                      <td>{d.label}</td>
                      <td className={`td-right ${taceColor(d.tace)}`}>
                        <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                          <div style={{width:50,height:4,background:'var(--bg3)',borderRadius:2}}>
                            <div style={{height:4,width:taceW+'%',background:d.tace>=80?'#16a34a':d.tace>=50?'#f97316':'#ef4444',borderRadius:2}}/>
                          </div>
                          {fmtNum(d.tace,1)}%
                        </div>
                      </td>
                      <td className="td-right">{fmtNum(d.jours,1)}j</td>
                      <td className="td-right td-muted">{d.jo}j</td>
                      <td className="td-right">{fmtEur(d.ca)}</td>
                      <td className={`td-right ${tc}`}>{fmtEur(d.marge)}</td>
                      <td className={`td-right ${tc}`}>{fmtNum(d.taux)}%</td>
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
