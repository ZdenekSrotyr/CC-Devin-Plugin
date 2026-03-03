# Cowork support — TODO

## Problém

stdio MCP servery se spouštějí uvnitř Cowork VM sandboxu. Sandbox blokuje odchozí HTTP na `api.devin.ai`.

Ostatní pluginy (Gmail, Keboola, Linear) fungují, protože jsou **vzdálené HTTPS servery** — Cowork k nim přistupuje přes port 443 na veřejné URL.

## Co jsme zjistili (v0.4.0 experiment)

| Přístup | Výsledek |
|---------|----------|
| `type: stdio` uvnitř VM | Blokováno — `api.devin.ai` nedostupné |
| `type: sse` + `127.0.0.1:3742` | Nefunguje — VM má vlastní loopback |
| `type: sse` + `host.docker.internal:3742` | Blokováno sítovým whitelistem Coworku (non-standard port) |
| `type: sse` + `host.docker.internal:443` | Nevyzkoušeno — vyžaduje TLS cert |
| Devin OAuth / hosted MCP | Neexistuje pro session management (jen DeepWiki) |

**Závěr**: Potřebujeme **veřejnou HTTPS URL** (port 443). To je jediná varianta která projde whitelistem.

## Možná řešení

### Option A — ngrok se statickou doménou (nejrychlejší)
- ngrok free tier dává 1 statickou doménu zdarma
- Spustit `ngrok http --domain=<static> 3742` jako LaunchAgent
- `.mcp.json`: `{ "type": "sse", "url": "https://<static>.ngrok-free.app/sse" }`
- Pro: rychlé, zdarma, stálá URL
- Contra: musí běžet ngrok daemon + HTTP server jako dva procesy

**TODO**:
- [ ] Přidat `servers/install-ngrok-launchagent.sh` (ngrok daemon jako LaunchAgent)
- [ ] Dokumentovat v README krok po kroku
- [ ] Zjistit jak uložit statickou ngrok doménu do konfigurace

### Option B — Cloudflare Workers (robustní)
- Deploy `servers/index.js` na Cloudflare Workers (free tier, 100k req/den)
- Credentials jako Workers Secrets (DEVIN_API_TOKEN, DEVIN_ORG_ID, DEVIN_USER_ID)
- Trvalá URL bez dalšího procesu na Macu
- Pro: vždy online, žádné závislosti na host procesu
- Contra: credentials na Cloudflare, nutná registrace + deployment

**TODO**:
- [ ] Portovat `servers/index.js` na Cloudflare Workers (Workers API vs Node http)
- [ ] Přidat `wrangler.toml` a deployment instrukce
- [ ] Dokumentovat v README

### Option C — Kontaktovat Anthropic
- [ ] Zeptat se, jestli lze whitelist Coworku rozšířit o port 3742 pro `host.docker.internal`
- [ ] Nebo požádat Devin (Cognition) o hosting MCP serveru pro session management

## Aktuální stav

Plugin funguje **lokálně v Claude Code** (stdio, keychain). Cowork zatím nepodporuje bez
jedné z výše uvedených opcí.
