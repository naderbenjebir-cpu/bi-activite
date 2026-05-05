import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useProductions(filters = {}) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        let q = supabase.from('productions').select('*');

        if (filters.entite)      q = q.eq('entite_collab', filters.entite);
        if (filters.client)      q = q.eq('client',        filters.client);
        if (filters.clientFinal) q = q.eq('client_final',  filters.clientFinal);
        if (filters.collab)      q = q.eq('collaborateur', filters.collab);
        if (filters.type)        q = q.eq('interne_externe', filters.type);
        if (filters.regie)       q = q.eq('regie_forfait', filters.regie);
        // Borne début : mois + année début
        const borneDebut = filters.moisDebut
          ? parseInt(filters.moisDebut)
          : filters.anneeDebut
          ? parseInt(filters.anneeDebut) * 100 + 1
          : null;
        // Borne fin : mois + année fin
        const borneFin = filters.moisFin
          ? parseInt(filters.moisFin)
          : filters.anneeFin
          ? parseInt(filters.anneeFin) * 100 + 12
          : null;
        if (borneDebut) q = q.gte('mois_annee', borneDebut);
        if (borneFin)   q = q.lte('mois_annee', borneFin);

        q = q.order('mois_annee', { ascending: false });

        const { data: rows, error: err } = await q;
        if (cancelled) return;
        if (err) throw err;
        setData(rows || []);
        setError(null);
      } catch(e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [
    filters.entite, filters.client, filters.clientFinal,
    filters.collab, filters.type, filters.regie,
    filters.moisDebut, filters.moisFin,
    filters.anneeDebut, filters.anneeFin,
  ]);

  return { data, loading, error };
}

export function useKpiMensuels(filters = {}) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      let q = supabase.from('kpi_mensuels').select('*');

      if (filters.entite)    q = q.eq('entite', filters.entite);
      if (filters.collab)    q = q.eq('collaborateur', filters.collab);
      if (filters.statut)    q = q.eq('statut_mois', filters.statut);
      if (filters.moisDebut) q = q.gte('mois_annee', parseInt(filters.moisDebut));
      if (filters.moisFin)   q = q.lte('mois_annee', parseInt(filters.moisFin));
      if (filters.annee && !filters.moisDebut && !filters.moisFin) {
        q = q.gte('mois_annee', parseInt(filters.annee) * 100 + 1)
             .lte('mois_annee', parseInt(filters.annee) * 100 + 12);
      }
      q = q.order('mois_annee', { ascending: false });

      const { data: rows } = await q;
      if (!cancelled) { setData(rows || []); setLoading(false); }
      return () => { cancelled = true; };
    }
    fetch();
    return () => { cancelled = true; };
  }, [filters.entite, filters.collab, filters.statut, filters.moisDebut, filters.moisFin, filters.annee]);

  return { data, loading };
}

export function useCollaborateurs() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('v_collaborateurs_statut').select('*').order('nom')
      .then(({ data: rows }) => { setData(rows || []); setLoading(false); });
  }, []);

  return { data, loading };
}

// Agrégation côté client
export function aggregate(rows, key) {
  const map = {};
  rows.forEach(r => {
    const k = r[key] || 'N/A';
    if (!map[k]) map[k] = { label: k, ca: 0, cout: 0, jours: 0, nb: 0 };
    map[k].ca    += parseFloat(r.total_ht)    || 0;
    map[k].cout  += parseFloat(r.cout_total)  || 0;
    map[k].jours += parseFloat(r.nb_jours)    || 0;
    map[k].nb    += 1;
  });
  return Object.values(map)
    .map(d => ({
      ...d,
      marge: d.ca - d.cout,
      taux:  d.ca > 0 ? (d.ca - d.cout) / d.ca * 100 : 0,
      tjm:   d.jours > 0 ? d.ca / d.jours : 0,
    }))
    .sort((a, b) => b.ca - a.ca);
}

export function computeKPIs(rows) {
  const ca    = rows.reduce((s, r) => s + (parseFloat(r.total_ht)   || 0), 0);
  const cout  = rows.reduce((s, r) => s + (parseFloat(r.cout_total) || 0), 0);
  const jours = rows.reduce((s, r) => s + (parseFloat(r.nb_jours)   || 0), 0);
  const marge = ca - cout;
  return {
    ca, cout, marge, jours,
    taux: ca > 0 ? marge / ca * 100 : 0,
    tjm:  jours > 0 ? ca / jours : 0,
    nb:   rows.length,
  };
}
