import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtNum } from '../../lib/utils';

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  const colors = { success:'#16a34a', error:'#ef4444', warn:'#f97316', info:'#1e50a0' };
  return (
    <div style={{ position:'fixed', bottom:24, right:24, background:'var(--bg2)',
      border:`1px solid ${colors[type]}`, borderLeft:`4px solid ${colors[type]}`,
      borderRadius:8, padding:'12px 16px', fontSize:13,
      boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:100 }}>
      {msg}
      <button onClick={onClose} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer'}}>×</button>
    </div>
  );
}

const SERVICE_MAP_DEFAULT = [
  { service: 'Conseil technique',     categorie: 'operationnel', sous_type: 'consultant' },
  { service: 'Conseil fonctionnelle', categorie: 'operationnel', sous_type: 'consultant' },
  { service: 'DSI',                   categorie: 'operationnel', sous_type: 'dsi'        },
  { service: 'Direction',             categorie: 'back-office',  sous_type: 'dirigeant'  },
  { service: 'Direction commerciale', categorie: 'back-office',  sous_type: 'commercial' },
  { service: 'DRH',                   categorie: 'back-office',  sous_type: 'rh'         },
  { service: 'Suivi RH',              categorie: 'back-office',  sous_type: 'rh'         },
];

export default function AdminConfiguration() {
  const [tab,       setTab]       = useState('greentech');
  const [greentech, setGreentech] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState(null);
  const [editGT,    setEditGT]    = useState({});
  const [newGT,     setNewGT]     = useState({ collaborateur:'', cout_jour:'' });
  const fileRef = useRef(null);

  useEffect(() => { loadGreentech(); }, []);

  async function loadGreentech() {
    setLoading(true);
    const { data } = await supabase.from('greentech_ref').select('*').order('collaborateur');
    setGreentech(data || []);
    setLoading(false);
  }

  function showToast(msg, type='info') { setToast({ msg, type }); }

  async function saveGT(id, field, value) {
    const { error } = await supabase.from('greentech_ref').update({ [field]: value }).eq('id', id);
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    setGreentech(prev => prev.map(r => r.id===id ? { ...r, [field]: value } : r));
    setEditGT(prev => { const n={...prev}; delete n[`${id}_${field}`]; return n; });
    showToast('✓ Mis à jour', 'success');
  }

  async function addGT() {
    if (!newGT.collaborateur || !newGT.cout_jour) { showToast('Remplissez tous les champs', 'warn'); return; }
    const { data, error } = await supabase.from('greentech_ref')
      .insert({ collaborateur: newGT.collaborateur, cout_jour: parseFloat(newGT.cout_jour) })
      .select().single();
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    setGreentech(prev => [...prev, data]);
    setNewGT({ collaborateur:'', cout_jour:'' });
    showToast('✓ Ajouté', 'success');
  }

  async function deleteGT(id) {
    await supabase.from('greentech_ref').delete().eq('id', id);
    setGreentech(prev => prev.filter(r => r.id !== id));
    showToast('Supprimé', 'warn');
  }

  async function importGT(file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: null });

      // Vider et réimporter
      await supabase.from('greentech_ref').delete().neq('id', 0);
      const rows = raw.map(r => ({
        collaborateur: r['Collaborateur'] || r['collaborateur'] || '',
        client:        r['Client'] || r['client'] || null,
        client_final:  r['Client final'] || r['client_final'] || null,
        cout_jour:     parseFloat(String(r['Coût/j']||r['cout_jour']||0).replace(',','.')) || 0,
      })).filter(r => r.collaborateur && r.cout_jour > 0);

      const { error } = await supabase.from('greentech_ref').insert(rows);
      if (error) throw new Error(error.message);
      showToast(`✓ ${rows.length} entrées importées`, 'success');
      await loadGreentech();
    } catch(e) {
      showToast('Erreur : ' + e.message, 'error');
    }
  }

  const tabStyle = (k) => ({
    padding:'8px 16px', fontSize:11, fontFamily:'var(--mono)',
    cursor:'pointer', borderBottom: tab===k ? '2px solid var(--orange)' : '2px solid transparent',
    color: tab===k ? 'var(--blue)' : 'var(--muted)', background:'none', border:'none',
    borderBottom: tab===k ? '2px solid var(--orange)' : '2px solid transparent',
    fontWeight: tab===k ? 500 : 400,
  });

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Configuration</span>
      </div>
      <div className="page-body">

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',marginBottom:24}}>
          <button style={tabStyle('greentech')} onClick={() => setTab('greentech')}>Référentiel GreenTech</button>
          <button style={tabStyle('mapping')}   onClick={() => setTab('mapping')}>Mapping services</button>
        </div>

        {/* ── GreenTech ── */}
        {tab === 'greentech' && (
          <div>
            <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
              <div style={{fontSize:13,color:'var(--muted)'}}>
                Coûts journaliers des collaborateurs CNEXT GreenTech — appliqués automatiquement à l'import.
              </div>
              <div style={{marginLeft:'auto',display:'flex',gap:8}}>
                <input ref={fileRef} type="file" accept=".xlsx" style={{display:'none'}}
                  onChange={e => e.target.files[0] && importGT(e.target.files[0])} />
                <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                  ↑ Importer xlsx
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <div className="table-header"><span className="table-title">Référentiel GreenTech ({greentech.length})</span></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Collaborateur</th><th>Client</th><th>Client final</th><th>Coût/j</th><th>Actions</th></tr></thead>
                  <tbody>
                    {greentech.map(r => (
                      <tr key={r.id}>
                        <td style={{fontWeight:500}}>{r.collaborateur}</td>
                        <td className="td-muted">{r.client||'—'}</td>
                        <td className="td-muted">{r.client_final||'—'}</td>
                        <td className="td-right">
                          {editGT[`${r.id}_cout`] !== undefined ? (
                            <input type="number" value={editGT[`${r.id}_cout`]}
                              onChange={e => setEditGT(prev => ({...prev, [`${r.id}_cout`]: e.target.value}))}
                              onBlur={() => saveGT(r.id, 'cout_jour', parseFloat(editGT[`${r.id}_cout`]))}
                              onKeyDown={e => e.key==='Enter' && saveGT(r.id, 'cout_jour', parseFloat(editGT[`${r.id}_cout`]))}
                              style={{width:80,fontFamily:'var(--mono)',fontSize:12,padding:'2px 6px',
                                border:'1px solid var(--orange)',borderRadius:4,background:'var(--bg)'}}
                              autoFocus />
                          ) : (
                            <span onClick={() => setEditGT(prev => ({...prev, [`${r.id}_cout`]: r.cout_jour}))}
                              style={{cursor:'pointer',padding:'2px 6px',borderRadius:4,fontFamily:'var(--mono)',
                                border:'1px solid transparent'}}
                              onMouseEnter={e => e.currentTarget.style.borderColor='var(--border2)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
                              {fmtNum(r.cout_jour, 0)} €/j
                            </span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-danger" style={{padding:'3px 10px',fontSize:11}}
                            onClick={() => deleteGT(r.id)}>Supprimer</button>
                        </td>
                      </tr>
                    ))}
                    {/* Ligne d'ajout */}
                    <tr style={{background:'rgba(30,80,160,.02)'}}>
                      <td>
                        <input value={newGT.collaborateur} onChange={e => setNewGT(p => ({...p, collaborateur:e.target.value}))}
                          placeholder="Nom collaborateur"
                          style={{width:'100%',fontSize:12,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:4,background:'var(--bg)'}} />
                      </td>
                      <td colSpan={2}><span style={{fontSize:11,color:'var(--muted)'}}>Optionnel</span></td>
                      <td>
                        <input type="number" value={newGT.cout_jour} onChange={e => setNewGT(p => ({...p, cout_jour:e.target.value}))}
                          placeholder="€/j"
                          style={{width:80,fontSize:12,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:4,
                            background:'var(--bg)',fontFamily:'var(--mono)'}} />
                      </td>
                      <td>
                        <button className="btn btn-primary" style={{padding:'4px 12px',fontSize:11}} onClick={addGT}>
                          + Ajouter
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Mapping services ── */}
        {tab === 'mapping' && (
          <div>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:16}}>
              Règle de catégorisation appliquée lors de l'import du fichier ListeSalaries.
              Modifiez directement dans Admin → Collaborateurs pour chaque collaborateur individuel.
            </div>
            <div className="table-wrap">
              <div className="table-header"><span className="table-title">Mapping Service → Catégorie</span></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Service</th><th>Catégorie</th><th>Sous-type</th></tr></thead>
                  <tbody>
                    {SERVICE_MAP_DEFAULT.map((r,i) => (
                      <tr key={i}>
                        <td style={{fontWeight:500}}>{r.service}</td>
                        <td>
                          <span className={`badge ${r.categorie==='operationnel'?'badge-blue':'badge-purple'}`}>
                            {r.categorie}
                          </span>
                        </td>
                        <td className="td-muted">{r.sous_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{marginTop:12,fontSize:12,color:'var(--muted)'}}>
              Pour modifier la catégorisation d'un collaborateur spécifique, allez dans <strong>Admin → Collaborateurs</strong> et cliquez sur la valeur à modifier.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
