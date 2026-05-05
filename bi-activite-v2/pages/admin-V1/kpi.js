import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMois } from '../../lib/utils';

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const colors = { success:'#16a34a', error:'#ef4444', warn:'#f97316', info:'#1e50a0' };
  return (
    <div style={{ position:'fixed', bottom:24, right:24, background:'var(--bg2)',
      border:`1px solid ${colors[type]}`, borderLeft:`4px solid ${colors[type]}`,
      borderRadius:8, padding:'12px 16px', fontSize:13,
      boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:100, maxWidth:400 }}>
      {msg}
      <button onClick={onClose} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',color:'var(--muted)'}}>×</button>
    </div>
  );
}

export default function AdminKPI() {
  const [file,    setFile]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast,   setToast]   = useState(null);
  const [history, setHistory] = useState([]);
  const [dragging,setDragging]= useState(false);
  const fileRef = useRef(null);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const { data } = await supabase.from('imports_log')
      .select('*').eq('type_import','kpi')
      .order('imported_at', { ascending: false }).limit(10);
    setHistory(data || []);
  }

  function showToast(msg, type='info') { setToast({ msg, type }); }

  async function doImport() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r    = await fetch('/api/import/kpi', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      showToast(`✓ ${data.lignes} KPIs importés · ${data.moisList?.length} mois`, 'success');
      setFile(null);
      await loadHistory();
    } catch(e) {
      showToast('Erreur : ' + e.message, 'error');
    }
    setLoading(false);
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Import KPI mensuel</span>
      </div>
      <div className="page-body">

        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>Fichier attendu : IndicateursSurActiviteJ_AAAAMMJJ.xlsx</div>
          <div style={{fontSize:12,color:'var(--muted)'}}>
            Format matriciel : collaborateurs × indicateurs × mois. Ce fichier alimente les modules Inter-contrat, Back-Office et TACE.
          </div>
        </div>

        {/* Drop zone */}
        <div
          style={{
            border: `1.5px dashed ${dragging||file ? 'var(--orange)' : 'var(--border2)'}`,
            borderRadius: 12, padding: '40px 32px', textAlign: 'center',
            cursor: 'pointer', background: dragging ? 'rgba(249,115,22,0.04)' : 'var(--bg2)',
          }}
          onClick={() => fileRef.current?.click()}
          onDragEnter={e => { e.preventDefault(); setDragging(true); }}
          onDragOver={e => e.preventDefault()}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) {
              if (!f.name.startsWith('IndicateursSurActiviteJ_')) {
                showToast(`⚠ Fichier non reconnu : "${f.name}" — attendu : IndicateursSurActiviteJ_YYYYMMDD.xlsx`, 'error');
                return;
              }
              setFile(f);
            }
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:'none'}}
            onChange={e => {
              const f = e.target.files[0];
              if (!f) return;
              if (!f.name.startsWith('IndicateursSurActiviteJ_')) {
                showToast(`⚠ Fichier non reconnu : "${f.name}" — attendu : IndicateursSurActiviteJ_YYYYMMDD.xlsx`, 'error');
                return;
              }
              setFile(f);
            }} />
          {file ? (
            <div>
              <div style={{fontSize:15,fontWeight:500,marginBottom:6,color:'var(--orange)'}}>{file.name}</div>
              <div style={{fontSize:12,color:'var(--muted)'}}>Prêt à importer</div>
            </div>
          ) : (
            <div>
              <div style={{fontSize:36,marginBottom:10,opacity:.3}}>⬆</div>
              <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Glissez le fichier KPI ici</div>
              <div style={{fontSize:12,color:'var(--muted)'}}>ou cliquez pour parcourir</div>
            </div>
          )}
        </div>

        {file && (
          <div style={{display:'flex',gap:10,marginTop:14}}>
            <button className="btn btn-primary" onClick={doImport} disabled={loading}>
              {loading ? 'Import en cours...' : 'Importer les KPIs'}
            </button>
            <button className="btn btn-ghost" onClick={() => setFile(null)}>Annuler</button>
          </div>
        )}

        {/* Historique */}
        <div className="table-wrap" style={{marginTop:24}}>
          <div className="table-header"><span className="table-title">Historique imports KPI</span></div>
          {history.length === 0 ? (
            <div className="empty"><p>Aucun import KPI enregistré</p></div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Date</th><th>Fichier</th><th>Lignes</th><th>Mois</th></tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{new Date(h.imported_at).toLocaleString('fr-FR')}</td>
                      <td>{h.filename}</td>
                      <td className="td-right">{h.lignes}</td>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{formatMois(h.mois_annee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
