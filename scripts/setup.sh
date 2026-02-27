#!/bin/bash
# Devin Plugin Setup
# Securely saves DEVIN_API_TOKEN and DEVIN_ORG_ID

CONFIG_DIR="$HOME/.config/claude-plugins/devin"
CONFIG_FILE="$CONFIG_DIR/config.json"

echo ""
echo "╔════════════════════════════════════╗"
echo "║       Devin Plugin Setup           ║"
echo "╚════════════════════════════════════╝"
echo ""

# Show current status
if [ -f "$CONFIG_FILE" ]; then
  echo "✅ Config already exists at $CONFIG_FILE"
  echo "   (press Enter to keep existing value, or type a new one)"
  echo ""
  EXISTING_TOKEN=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('DEVIN_API_TOKEN',''))" 2>/dev/null)
  EXISTING_ORG=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('DEVIN_ORG_ID',''))" 2>/dev/null)
else
  echo "ℹ️  No config found — let's set it up."
  echo ""
  EXISTING_TOKEN=""
  EXISTING_ORG=""
fi

# Get token (hidden input)
echo "1. DEVIN_API_TOKEN"
echo "   → app.devin.ai → Settings → API → Create Token"
if [ -n "$EXISTING_TOKEN" ]; then
  echo -n "   Token [current: ${EXISTING_TOKEN:0:8}...]: "
else
  echo -n "   Token: "
fi
read -s NEW_TOKEN
echo ""
TOKEN="${NEW_TOKEN:-$EXISTING_TOKEN}"

# Get org ID (visible input, not sensitive)
echo ""
echo "2. DEVIN_ORG_ID"
echo "   → app.devin.ai → Settings → Organization → Organization ID"
if [ -n "$EXISTING_ORG" ]; then
  echo -n "   Org ID [current: $EXISTING_ORG]: "
else
  echo -n "   Org ID: "
fi
read NEW_ORG
ORG_ID="${NEW_ORG:-$EXISTING_ORG}"

# Validate
if [ -z "$TOKEN" ] || [ -z "$ORG_ID" ]; then
  echo ""
  echo "❌ Token and Org ID are required. Setup cancelled."
  exit 1
fi

# Save config
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" << EOF
{
  "DEVIN_API_TOKEN": "$TOKEN",
  "DEVIN_ORG_ID": "$ORG_ID"
}
EOF
chmod 600 "$CONFIG_FILE"

# Set for current macOS session
launchctl setenv DEVIN_API_TOKEN "$TOKEN" 2>/dev/null
launchctl setenv DEVIN_ORG_ID "$ORG_ID" 2>/dev/null

# Verify connection
echo ""
echo "🔍 Ověřuji připojení k Devin API..."
STATUS=$(node -e "
const cfg = JSON.parse(require('fs').readFileSync('$CONFIG_FILE'));
fetch('https://api.devin.ai/v3beta1/organizations/' + cfg.DEVIN_ORG_ID + '/sessions?limit=1', {
  headers: { 'Authorization': 'Bearer ' + cfg.DEVIN_API_TOKEN }
}).then(r => { console.log(r.status); process.exit(0); })
  .catch(e => { console.log('ERROR: ' + e.message); process.exit(1); });
" 2>/dev/null)

echo ""
if [ "$STATUS" = "200" ]; then
  echo "✅ Připojení OK! Credentials jsou uloženy."
  echo ""
  echo "👉 Restartuj Claude a Devin plugin bude připraven."
else
  echo "⚠️  Připojení selhalo (status: $STATUS)"
  echo "   Zkontroluj token a org ID na app.devin.ai"
fi
echo ""
