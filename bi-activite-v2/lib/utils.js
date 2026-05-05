// Calcul des jours ouvrables français
// Algorithme de Gauss pour Pâques + 11 jours fériés

function getFeries(year) {
  const a = year % 19, b = Math.floor(year/100), c = year % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const month = Math.floor((h+l-7*m+114)/31);
  const day   = ((h+l-7*m+114) % 31) + 1;
  const paques = new Date(year, month-1, day);

  const lundi_paques    = new Date(paques); lundi_paques.setDate(paques.getDate()+1);
  const ascension       = new Date(paques); ascension.setDate(paques.getDate()+39);
  const lundi_pentecote = new Date(paques); lundi_pentecote.setDate(paques.getDate()+50);

  return new Set([
    `${year}-01-01`,
    lundi_paques.toISOString().slice(0,10),
    `${year}-05-01`,
    `${year}-05-08`,
    ascension.toISOString().slice(0,10),
    lundi_pentecote.toISOString().slice(0,10),
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
}

const cache = {};

export function joursOuvrables(moisAnnee) {
  const s     = String(moisAnnee);
  const year  = parseInt(s.slice(0,4));
  const month = parseInt(s.slice(4,6)) - 1;
  const key   = `${year}-${month}`;
  if (cache[key] !== undefined) return cache[key];

  const feries = getFeries(year);
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !feries.has(d.toISOString().slice(0,10))) count++;
    d.setDate(d.getDate()+1);
  }
  cache[key] = count;
  return count;
}

export function formatMois(m) {
  if (!m) return '—';
  const s  = String(m);
  const y  = s.slice(0,4);
  const mo = s.slice(4,6);
  const names = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  return `${names[parseInt(mo)]} ${y}`;
}

export function fmtEur(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0
  }).format(n);
}

export function fmtNum(n, dec = 1) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: dec, maximumFractionDigits: dec
  }).format(n);
}

export function pct(a, b) {
  return b > 0 ? (a / b * 100) : 0;
}
