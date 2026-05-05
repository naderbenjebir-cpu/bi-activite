#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# BI Activité — Script de lancement
# CNEXT Consulting · SmatVia
# ═══════════════════════════════════════════════════════════════

APP_DIR="/Users/nader.benjebir/Library/CloudStorage/OneDrive-CNEXTConsulting/Documents/01_CNEXT/63_ProjetsInterne/2026/02-SuiviProdActivity/10-ApplicationIA/bi-activite-v2"
PORT=3000
APP_URL="http://localhost:$PORT"

# Couleurs
BLUE='\033[0;34m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}${BOLD}  BI Activité — CNEXT Consulting · SmatVia${RESET}"
echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Vérifier le dossier ──────────────────────────────────────
if [ ! -d "$APP_DIR" ]; then
  echo -e "${RED}✗ Dossier introuvable :${RESET}"
  echo -e "  $APP_DIR"
  echo ""
  echo -e "${ORANGE}Modifiez la variable APP_DIR dans ce script.${RESET}"
  exit 1
fi

cd "$APP_DIR"

# ── Vérifier Node.js ─────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js non installé.${RESET}"
  echo -e "  Téléchargez depuis https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js${RESET} $NODE_VERSION"

# ── Vérifier .env.local ──────────────────────────────────────
if [ ! -f ".env.local" ]; then
  echo -e "${RED}✗ Fichier .env.local manquant.${RESET}"
  echo -e "  Créez-le avec vos clés Supabase :"
  echo -e "  ${ORANGE}NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co${RESET}"
  echo -e "  ${ORANGE}NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...${RESET}"
  echo -e "  ${ORANGE}SUPABASE_SERVICE_ROLE_KEY=eyJ...${RESET}"
  exit 1
fi

# Vérifier que les clés sont renseignées
if grep -q "xxxx\|votre_cle\|VOTRE_CLE" .env.local; then
  echo -e "${RED}✗ .env.local contient des valeurs exemples non remplacées.${RESET}"
  exit 1
fi

echo -e "${GREEN}✓ .env.local${RESET} trouvé"

# ── Vérifier node_modules ────────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo ""
  echo -e "${ORANGE}⟳ Installation des dépendances...${RESET}"
  npm install --silent
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Erreur lors de npm install.${RESET}"
    exit 1
  fi
  echo -e "${GREEN}✓ Dépendances installées${RESET}"
else
  echo -e "${GREEN}✓ Dépendances${RESET} déjà installées"
fi

# ── Libérer le port si occupé ────────────────────────────────
PIDS=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo -e "${ORANGE}⟳ Port $PORT occupé — libération...${RESET}"
  echo $PIDS | xargs kill -9 2>/dev/null
  sleep 1
  echo -e "${GREEN}✓ Port $PORT libéré${RESET}"
fi

# ── Lancer l'application ─────────────────────────────────────
echo ""
echo -e "${BLUE}${BOLD}⟳ Démarrage de l'application...${RESET}"
echo ""

# Lancer Next.js en arrière-plan
npm run dev -- --port $PORT > /tmp/bi-activite.log 2>&1 &
APP_PID=$!

# Attendre que le serveur soit prêt
echo -ne "${ORANGE}  En attente du serveur"
TIMEOUT=30
COUNT=0
while [ $COUNT -lt $TIMEOUT ]; do
  if curl -s "$APP_URL" > /dev/null 2>&1; then
    break
  fi
  echo -n "."
  sleep 1
  COUNT=$((COUNT+1))
done
echo ""

if [ $COUNT -eq $TIMEOUT ]; then
  echo -e "${RED}✗ Le serveur n'a pas démarré après ${TIMEOUT}s.${RESET}"
  echo -e "  Consultez les logs : ${ORANGE}cat /tmp/bi-activite.log${RESET}"
  kill $APP_PID 2>/dev/null
  exit 1
fi

# ── Succès ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ Application démarrée !${RESET}"
echo ""
echo -e "  ${BOLD}Dashboard :${RESET}  ${BLUE}$APP_URL/dashboard${RESET}"
echo -e "  ${BOLD}Admin :${RESET}      ${BLUE}$APP_URL/admin${RESET}"
echo ""
echo -e "${ORANGE}  Appuyez sur Entrée pour ouvrir dans le navigateur,${RESET}"
echo -e "${ORANGE}  ou Ctrl+C pour arrêter l'application.${RESET}"
echo ""

# Ouvrir le navigateur
read -r -t 5 && open "$APP_URL/dashboard" 2>/dev/null || open "$APP_URL/dashboard" 2>/dev/null

# Garder le script actif
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  PID : $APP_PID  |  Logs : /tmp/bi-activite.log"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Attendre Ctrl+C
trap "echo ''; echo -e '${ORANGE}Arrêt de l application...${RESET}'; kill $APP_PID 2>/dev/null; echo -e '${GREEN}✓ Arrêté${RESET}'; exit 0" INT
wait $APP_PID
