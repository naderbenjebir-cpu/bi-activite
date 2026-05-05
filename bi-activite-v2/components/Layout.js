import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { formatMois } from '../lib/utils';

// ── Context filtres global ──────────────────────────────────
export const FiltersContext = createContext({});
export function useFilters() { return useContext(FiltersContext); }

// ── Icônes SVG simples ──────────────────────────────────────
const Icon = ({ name }) => {
  const icons = {
    chart:   <path d="M3 3v18h18M7 16l4-4 4 4 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    users:   <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    calendar:<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    briefcase:<path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    settings:<path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" fill="none"/>,
    home:    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    list:    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    trending:<path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    pause:   <path d="M10 9v6m4-6v6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    building:<path d="M6 2h12a2 2 0 012 2v18H4V4a2 2 0 012-2zM9 22v-4h6v4M9 6h1M14 6h1M9 10h1M14 10h1M9 14h1M14 14h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
  };
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{flexShrink:0}}>
      {icons[name]}
    </svg>
  );
};

const NAV_DASHBOARD = [
  { href: '/dashboard',                label: 'Vue globale',        icon: 'home' },
  { href: '/dashboard/comparaison',    label: 'Comparaison années', icon: 'trending' },
  { href: '/dashboard/par-client',     label: 'Par client',         icon: 'briefcase' },
  { href: '/dashboard/par-collaborateur', label: 'Par collaborateur', icon: 'users' },
  { href: '/dashboard/par-affaire',    label: 'Par affaire',        icon: 'list' },
  { href: '/dashboard/missions',       label: 'Missions',           icon: 'calendar' },
  { href: '/dashboard/inter-contrat',  label: 'Inter-contrat',      icon: 'pause' },
  { href: '/dashboard/back-office',    label: 'Back-Office',        icon: 'building' },
  { href: '/dashboard/rh',             label: 'RH / Effectifs',     icon: 'users' },
  { href: '/dashboard/detail',         label: 'Détail lignes',      icon: 'list' },
];

const NAV_ADMIN = [
  { href: '/admin',                    label: 'Import mensuel',     icon: 'chart' },
  { href: '/admin/kpi',                label: 'Import KPI',         icon: 'trending' },
  { href: '/admin/collaborateurs',     label: 'Collaborateurs',     icon: 'users' },
  { href: '/admin/corrections',        label: 'Corrections',        icon: 'settings' },
  { href: '/admin/referentiels',       label: 'Référentiels',       icon: 'list' },
];

export default function Layout({ children }) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/admin');

  // ── Filtres ──
  const [filters, setFilters] = useState({
    entite: '', anneeDebut: '', anneeFin: '', moisDebut: '', moisFin: '',
    client: '', clientFinal: '', collab: '', type: '', regie: '',
  });
  const [filterOptions, setFilterOptions] = useState({
    entites: [], annees: [], mois: [], clients: [], clientsFinals: [], collabs: [],
  });

  useEffect(() => {
    if (!isAdmin) loadFilterOptions();
  }, [isAdmin]);

  async function loadFilterOptions() {
    const { data } = await supabase
      .from('productions')
      .select('mois_annee, entite_collab, client, client_final, collaborateur')
      .order('mois_annee', { ascending: false });

    if (!data) return;

    const entites      = [...new Set(data.map(r => r.entite_collab).filter(Boolean))].sort();
    const annees       = [...new Set(data.map(r => String(r.mois_annee).slice(0,4)))].sort().reverse();
    const mois         = [...new Set(data.map(r => String(r.mois_annee)))].sort().reverse();
    const clients      = [...new Set(data.map(r => r.client).filter(Boolean))].sort();
    const clientsFinals= [...new Set(data.map(r => r.client_final).filter(Boolean))].sort();
    const collabs      = [...new Set(data.map(r => r.collaborateur).filter(Boolean))].sort();

    setFilterOptions({ entites, annees, mois, clients, clientsFinals, collabs });
  }

  function resetFilters() {
    setFilters({ entite:'', anneeDebut:'', anneeFin:'', moisDebut:'', moisFin:'', client:'', clientFinal:'', collab:'', type:'', regie:'' });
  }

  const nav = isAdmin ? NAV_ADMIN : NAV_DASHBOARD;

  return (
    <FiltersContext.Provider value={{ filters, setFilters, filterOptions }}>
      <div className="layout">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-dot" />
            <span className="sidebar-logo-text">CNEXT · BI Activité</span>
          </div>

          {/* Navigation */}
          <div className="sidebar-section">
            <div className="sidebar-section-label">{isAdmin ? 'Administration' : 'Dashboard'}</div>
            {nav.map(item => (
              <Link key={item.href} href={item.href}
                className={`sidebar-link ${router.pathname === item.href ? 'active' : ''}`}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Lien vers l'autre app */}
          <div className="sidebar-section">
            <Link href={isAdmin ? '/dashboard' : '/admin'}
              className="sidebar-link">
              <Icon name={isAdmin ? 'chart' : 'settings'} />
              {isAdmin ? '→ Dashboard' : '⚙ Admin'}
            </Link>
          </div>

          {/* Filtres (dashboard uniquement) */}
          {!isAdmin && (
            <div style={{flex:1, overflowY:'auto'}}>
              <div className="sidebar-section-label" style={{padding:'12px 12px 6px'}}>Filtres</div>

              <div className="filter-group">
                <label className="filter-label">Entité</label>
                <select className="filter-select" value={filters.entite}
                  onChange={e => setFilters(f => ({...f, entite: e.target.value}))}>
                  <option value="">Toutes</option>
                  {filterOptions.entites.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Année début</label>
                <select className="filter-select" value={filters.anneeDebut||''}
                  onChange={e => setFilters(f => ({...f, anneeDebut: e.target.value, moisDebut:''}))}>
                  <option value="">—</option>
                  {filterOptions.annees.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Mois début</label>
                <select className="filter-select" value={filters.moisDebut}
                  onChange={e => setFilters(f => ({...f, moisDebut: e.target.value}))}>
                  <option value="">—</option>
                  {filterOptions.mois
                    .filter(m => !filters.anneeDebut || m.startsWith(filters.anneeDebut))
                    .map(m => <option key={m} value={m}>{formatMois(m)}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Année fin</label>
                <select className="filter-select" value={filters.anneeFin||''}
                  onChange={e => setFilters(f => ({...f, anneeFin: e.target.value, moisFin:''}))}>
                  <option value="">—</option>
                  {filterOptions.annees.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Mois fin</label>
                <select className="filter-select" value={filters.moisFin}
                  onChange={e => setFilters(f => ({...f, moisFin: e.target.value}))}>
                  <option value="">—</option>
                  {filterOptions.mois
                    .filter(m => !filters.anneeFin || m.startsWith(filters.anneeFin))
                    .map(m => <option key={m} value={m}>{formatMois(m)}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Client</label>
                <select className="filter-select" value={filters.client}
                  onChange={e => setFilters(f => ({...f, client: e.target.value}))}>
                  <option value="">Tous</option>
                  {filterOptions.clients.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Client final</label>
                <select className="filter-select" value={filters.clientFinal}
                  onChange={e => setFilters(f => ({...f, clientFinal: e.target.value}))}>
                  <option value="">Tous</option>
                  {filterOptions.clientsFinals.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Collaborateur</label>
                <select className="filter-select" value={filters.collab}
                  onChange={e => setFilters(f => ({...f, collab: e.target.value}))}>
                  <option value="">Tous</option>
                  {filterOptions.collabs.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Interne / Externe</label>
                <select className="filter-select" value={filters.type}
                  onChange={e => setFilters(f => ({...f, type: e.target.value}))}>
                  <option value="">Tous</option>
                  <option value="Interne">Interne</option>
                  <option value="Externe">Externe</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Régie / Forfait</label>
                <select className="filter-select" value={filters.regie}
                  onChange={e => setFilters(f => ({...f, regie: e.target.value}))}>
                  <option value="">Tous</option>
                  <option value="REGIE">Régie</option>
                  <option value="FORFAIT">Forfait</option>
                </select>
              </div>

              <button className="btn-reset-filters" onClick={resetFilters}>
                Réinitialiser
              </button>
            </div>
          )}
        </aside>

        {/* ── Contenu principal ── */}
        <div className="main-content">
          {children}
        </div>
      </div>
    </FiltersContext.Provider>
  );
}
