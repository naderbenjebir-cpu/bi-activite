import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtEur, fmtNum, formatMois } from '../../lib/utils';

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const colors = { success:'#16a34a', error:'#ef4444', warn:'#f97316', info:'#1e50a0' };
  return (
    <div style={{ position:'fixed', bottom:24, right:24, background:'var(--bg2)', border:`1px solid ${colors[type]||'#1e50a0'}`,
      borderLeft:`4px solid ${colors[type]||'#1e50a0'}`, borderRadius:8, padding:'12px 16px',
      fontSize:13, boxShadow:'0 4px 12px rgba(0,0,0,0.1)', zIndex:100, maxWidth:400 }}>
      {msg}
      <button onClick={onClose} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',color:'var(--muted)'}}>×</button>
    </div>
  );
}

export default function AdminImport() {
  const [dragging,   setDragging]   = useState(false);
  const [file,       setFile]       = useState(null);
  const [preview,    setPreview]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [toast,      setToast]      = useState(null);
  const [mode,       setMode]       = useState('fusion');
  const [ruleCnext,  setRuleCnext]  = useState(true);
  const [ruleGT,     setRuleGT]     = useState(true);
  const [history,    setHistory]    = useState([]);
  const fileRef = useRef(null);
  let isDragging = false;

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const { data } = await supabase.from('imports_log')
      .select('*').eq('type_import','production')
      .order('imported_at', { ascending: false }).limit(10);
    setHistory(data || []);
  }

  function showToast(msg, type='info') { setToast({ msg, type }); }

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      // Aperçu côté client avec XLSX
      const XLSX = (await import('xlsx')).default || await import('xlsx');
      const buf  = await f.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { defval: null });

      const total  = raw.length;
      const mois   = [...new Set(raw.map(r => r['Mois/Année'] || r['mois_annee']).filter(Boolean))];
      const entites= [...new Set(raw.map(r => r["Entité du collab."] || r['entite_collab']).filter(Boolean))];
      const sample = raw.slice(0, 5);

      setPreview({ total, mois, entites, sample, headers: Object.keys(raw[0]||{}) });
      showToast(`Aperçu : ${total} lignes · ${mois.length} mois`, 'info');
    } catch(e) {
      showToast('Erreur lecture : ' + e.message, 'error');
    }
    setLoading(false);
  }

  async function doImport() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      fd.append('rule_cnext',     String(ruleCnext));
      fd.append('rule_greentech', String(ruleGT));

      const r = await fetch('/api/import/production', { method: 'POST', body: fd });
      const data = await r.json();

      if (!r.ok) throw new Error(data.error || 'Erreur import');

      showToast(
        `✓ Import terminé — ${data.lignes} lignes · ${data.supprimees} supprimées · ${data.couts_corriges} coûts corrigés`,
        'success'
      );
      if (data.manquants?.length) showToast(`⚠ GreenTech manquants : ${data.manquants.join(', ')}`, 'warn');

      setFile(null); setPreview(null);
      await loadHistory();
    } catch(e) {
      showToast('Erreur : ' + e.message, 'error');
    }
    setLoading(false);
  }

  const dropZoneStyle = {
    border: `1.5px dashed ${dragging ? 'var(--orange)' : 'var(--border2)'}`,
    borderRadius: 12, padding: '48px 32px', textAlign: 'center',
    cursor: 'pointer', transition: 'all .2s',
    background: dragging ? 'rgba(249,115,22,0.04)' : 'var(--bg2)',
  };

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="topbar">
        <span style={{fontFamily:'var(--mono)',fontSize:12,color:'var(--blue)',fontWeight:500}}>Import mensuel</span>
      </div>
      <div className="page-body">

        {/* Règles et mode */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',gap:24,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>Règles :</span>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
              <input type="checkbox" checked={ruleCnext} onChange={e => setRuleCnext(e.target.checked)} style={{accentColor:'var(--orange)'}} />
              Supprimer lignes CNEXT interne
            </label>
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
              <input type="checkbox" checked={ruleGT} onChange={e => setRuleGT(e.target.checked)} style={{accentColor:'var(--orange)'}} />
              Appliquer coûts GreenTech
            </label>
          </div>
          <div style={{display:'flex',gap:16,alignItems:'center',marginLeft:'auto'}}>
            <span style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--mono)'}}>Mode :</span>
            {['fusion','remplacement'].map(m => (
              <label key={m} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,cursor:'pointer'}}>
                <input type="radio" name="mode" value={m} checked={mode===m} onChange={() => setMode(m)} style={{accentColor:'var(--orange)'}} />
                <span>
                  <strong style={{color: m==='fusion'?'var(--blue)':'#ef4444'}}>
                    {m.charAt(0).toUpperCase()+m.slice(1)}
                  </strong>
                  {m==='fusion' ? ' — ajoute et met à jour' : ' — écrase le mois/entité'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        {!preview && (
          <div
            style={dropZoneStyle}
            onClick={() => fileRef.current?.click()}
            onDragEnter={e => { e.preventDefault(); isDragging=true; setDragging(true); }}
            onDragOver={e => { e.preventDefault(); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) { isDragging=false; setDragging(false); } }}
            onDrop={async e => {
              e.preventDefault(); isDragging=false; setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) await handleFile(f);
            }}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}}
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            <div style={{fontSize:40,marginBottom:12,opacity:.3}}>⬆</div>
            <div style={{fontSize:15,fontWeight:500,marginBottom:6}}>
              {loading ? 'Lecture...' : 'Glissez votre fichier mensuel ici'}
            </div>
            <div style={{fontSize:12,color:'var(--muted)'}}>
              ProductionMensuelle_AAAAMMJJ.xlsx · ou cliquez pour parcourir
            </div>
          </div>
        )}

        {/* Aperçu */}
        {preview && (
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'16px 20px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
              <span style={{fontFamily:'var(--mono)',fontSize:11,background:'rgba(30,80,160,.10)',color:'var(--blue)',padding:'3px 10px',borderRadius:20}}>{file?.name}</span>
              <span style={{fontFamily:'var(--mono)',fontSize:11,background:'#dcfce7',color:'#15803d',padding:'3px 10px',borderRadius:20}}>{preview.total} lignes</span>
              {preview.mois.map(m => <span key={m} style={{fontFamily:'var(--mono)',fontSize:11,background:'var(--bg3)',color:'var(--muted)',padding:'3px 10px',borderRadius:20}}>{formatMois(m)}</span>)}
              {preview.entites.map(e => <span key={e} style={{fontFamily:'var(--mono)',fontSize:11,background:'rgba(124,58,237,.10)',color:'var(--purple)',padding:'3px 10px',borderRadius:20}}>{e}</span>)}
            </div>

            {/* Colonnes détectées */}
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:12,fontFamily:'var(--mono)'}}>
              {preview.headers.length} colonnes détectées
            </div>

            {/* Actions */}
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-primary" onClick={doImport} disabled={loading}>
                {loading ? 'Import en cours...' : `Importer (${mode})`}
              </button>
              <button className="btn btn-ghost" onClick={() => { setFile(null); setPreview(null); }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Historique */}
        <div className="table-wrap" style={{marginTop:24}}>
          <div className="table-header"><span className="table-title">Historique des imports</span></div>
          {history.length === 0 ? (
            <div className="empty"><p>Aucun import enregistré</p></div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>Date</th><th>Fichier</th><th>Mode</th><th>Mois</th><th>Lignes</th><th>CA total</th><th>Entités</th>
                </tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{new Date(h.imported_at).toLocaleString('fr-FR')}</td>
                      <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}}>{h.filename}</td>
                      <td><span className={`badge ${h.mode==='fusion'?'badge-blue':'badge-orange'}`}>{h.mode}</span></td>
                      <td style={{fontFamily:'var(--mono)',fontSize:11}}>{formatMois(h.mois_annee)}</td>
                      <td className="td-right">{h.lignes}</td>
                      <td className="td-right">{fmtEur(h.ca_total)}</td>
                      <td className="td-muted">{h.entites}</td>
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
