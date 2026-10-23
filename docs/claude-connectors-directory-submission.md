# Claude Connectors Directory: umsókn fyrir UteamUP read-only

Gátt: https://claude.ai/directory/manage → **Submit new** → **MCP connector**.
Kröfur Anthropic: https://claude.com/docs/connectors/building/submission

Textinn sem fer í skráninguna er á ensku (hún er opinber og á ensku). Leiðbeiningarnar eru á íslensku.

---

## 0. Áður en þú opnar gáttina

| # | Atriði | Staða |
|---|---|---|
| 1 | Endapunktur yfir HTTPS: `https://api.uteamup.com/mcp/read-only` | ✅ Svarar 401 með `resource_metadata` |
| 2 | OAuth 2.0 + PKCE (S256) + dynamic client registration (`/oauth/register`) | ✅ Skráð í `/.well-known/oauth-authorization-server` |
| 3 | Callback Claude í leyfislistanum (`https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`) | ✅ `McpOAuth:AllowedRedirectUris` í `appsettings.json` |
| 4 | Hvert verkfæri með `title` + `readOnlyHint`/`destructiveHint` | ✅ `McpReadOnlyPilotService.DescribeReadOnlyTool` setur `readOnlyHint: true`, `destructiveHint: false` |
| 5 | Prófað sem custom connector í Claude, öll 5 verkfærin kölluð | ⏳ Bíður innskráningar á claude.ai (sjá kafla 8) |
| 6 | Prófunar-tenant með gögnum | ✅ **Demo - Solid Energy** (`13f4751e-be00-4428-babd-f0d27e68bb40`, prod): 351 eignir, verkbeiðnir með H2S/turbine |
| 7 | Prófunarnotandi með read-only hlutverk í Demo - Solid Energy | ⏳ Ekki stofnaður (sjá kafla 8) |
| 8 | Greidd Claude-áskrift á reikningnum sem sækir um | ⏳ Staðfesta |

Mikilvægast: fyrirtækið (tenant) verður að hafa kveikt á **Allow members to connect AI
assistants** (`Tenant.AllowAssistantAccountLinking`, sjálfgefið *slökkt*). Annars hafnar
samþykkissíðan tengingunni með 403. Stillingin er undir **Company → API Keys** á
`https://app.uteamup.com/tenants/manage` og krefst `Tenant.Update`.
**Kveikt á Demo - Solid Energy 2026-10-22** (`PUT /api/mcp-oauth/settings`, staðfest með GET).

---

## 1. Connection

- **Server URL:** `https://api.uteamup.com/mcp/read-only`
- **Users connect to different URLs:** Nei (ein slóð fyrir alla).

## 2. Tools

Gáttin sækir þetta sjálf. Þú átt að sjá nákvæmlega fimm lestrarverkfæri, engin skrifverkfæri:

| Verkfæri | Hvað það gerir |
|---|---|
| `uteamup_asset_list` | Listar eignir (assets) í valda vinnusvæðinu |
| `uteamup_asset_search` | Leitar í eignum eftir texta |
| `uteamup_asset_get_by_guid` | Sækir eina eign eftir GUID |
| `uteamup_workorder_list` | Listar verkbeiðnir |
| `uteamup_workorder_search` | Leitar í verkbeiðnum eftir texta |

Ef færri en fimm birtast: verkfæri sjást bara ef samsvarandi UPMate-hæfni er virk í
tenantinum (`asset.status`, `asset.details`, `asset.search.read`, `workorders.read`,
`workorder.search.read`) og notandinn hefur lesheimild. Ef gáttin flaggar verkfæri án
annotations skaltu stoppa og láta mig vita.

## 3. Listing

**Server name** (≤100):
```
UteamUP CMMS
```

**One-liner** (≤200):
```
Look up assets and maintenance work orders in your UteamUP workspace. Read-only access that uses your own permissions.
```

**Description** (≤2000):
```
UteamUP is a maintenance management (CMMS) platform for teams that look after equipment, facilities and field work. This connector lets Claude look up records in your UteamUP workspace so you can ask questions in plain language instead of clicking through lists.

What Claude can do:
- List and search assets (equipment, machines, facilities) and open an asset's full details.
- List and search maintenance work orders to see what is open, scheduled or done.

How it works:
- You sign in with your own UteamUP account and choose which company workspace to connect.
- Claude only sees what your UteamUP role already allows you to see in that workspace.
- The connector is read-only. It cannot create, change, close or delete anything.
- Your company administrator decides whether members may connect AI assistants, can see every connection, and can revoke any of them at any time. You can disconnect yourself under Profile → Accounts.
- Access tokens last 60 minutes and refresh tokens rotate on every use.
- These lookups do not use UteamUP AI credits.

Example requests:
- "List the first five assets in my workspace."
- "Find assets whose name contains pump and show the details of the first one."
- "Which work orders mention H2S?"

You need a UteamUP account in a company that has turned on "Allow members to connect AI assistants".
```

**Categories** (1–5, veldu úr því sem gáttin býður): fyrsta val *Operations* eða *Productivity*;
svo *Business* / *Data & analytics* ef það er til. Ekki velja *Developer tools*.

**Documentation URL:**
```
https://github.com/UteamUP/uteamup-mcp#read-only-access-for-claude-grok-grok-bot-and-chatgpt
```

**Privacy policy URL:**
```
https://app.uteamup.com/privacypolicy
```

**Support contact:** `gisli@uteamup.com` (eða `https://github.com/UteamUP/uteamup-mcp/issues`)

**Icon:** `UteamUP_MCP/assets/logo.png` (512×512 PNG). Einnig til sem SVG í `assets/logo.svg`.

**URL slug** (varanlegt eftir birtingu):
```
uteamup
```

## 4. Use cases

**Primary use cases:**
```
1. Maintenance planners and technicians ask Claude which work orders are open or mention a given machine, instead of filtering lists by hand.
2. Teams look up an asset's details (location, type, status, identifiers) while discussing a fault or planning work.
3. Managers get a quick read-only overview of assets and work orders to prepare reports or meetings.
```

**What users need before connecting:**
```
A UteamUP account (https://app.uteamup.com) that belongs to a company workspace where an administrator has turned on "Allow members to connect AI assistants" under Company → API Keys. The user's existing UteamUP role decides which records they can read.
```

**Reads / writes:** Reads data only.

## 5. Company

- **Company name:** UteamUP
- **Website:** `https://uteamup.com`
- **Primary contact:** Gísli Guðmundsson, `gisli@uteamup.com`

## 6. Authentication

- Veldu **OAuth with dynamic client registration**.
- Ekki merkja við að verkfæri biðji um innskráningu eftir á; allur endapunkturinn krefst OAuth.

Til upplýsinga ef spurt er:
- Authorization server metadata: `https://api.uteamup.com/.well-known/oauth-authorization-server`
- Protected resource metadata: `https://api.uteamup.com/.well-known/oauth-protected-resource/mcp/read-only`
- Scope: `mcp:read`. PKCE S256 er skylda. Notandinn velur vinnusvæði á samþykkissíðu UteamUP.

## 7. Data handling

- **Underlying API:** Our own API (first-party).
- **Personal health data:** Nei.
- **Sponsored content:** Nei.

Ef reitur er fyrir lýsingu:
```
The connector reads asset and work-order records from UteamUP's own API. Records can contain names or contact details of the customer's staff or vendors. Access is limited to the workspace and permissions the signed-in user already has. UteamUP stores records under its privacy policy and the workspace's retention settings; the connector itself stores no conversation content.
```

## 8. Test & launch

### Prófunarumhverfið (production, `https://app.uteamup.com`)

1. ✅ Fyrirtæki: **Demo - Solid Energy** (demo-gögn úr jarðvarmavirkjun, enginn viðskiptavinur).
2. ✅ Gögn sem prófunarbeiðnirnar finna (staðfest 2026-10-22 með `ut asset search` / `ut workorder search`):
   eignir *pump* (5), *turbine* (3); verkbeiðnir *H2S* (5), *turbine* (6).
3. ✅ Kveikt á **Allow members to connect AI assistants**.
4. ⏳ Prófunarnotandi, t.d. `claude-review@uteamup.com`, með **read-only hlutverk** í
   Demo - Solid Energy einu. Ekki nota `debug@uteamup.com` (global admin).
5. ⏳ Staðfesta að prófunarnotandinn sjái öll 5 verkfærin (sjá kafla 2).
6. Lykilorðið fer **bara** í reitinn í gáttinni, aldrei í git eða þetta skjal.

### Leiðbeiningar fyrir prófunaraðila (líma inn)

```
1. In Claude, open Settings → Connectors and add the UteamUP CMMS connector (or add a custom connector with the URL https://api.uteamup.com/mcp/read-only).
2. Click Connect. Claude registers itself automatically and opens the UteamUP sign-in page.
3. Sign in with the reviewer account below (email and password, no SSO needed).
4. On the UteamUP consent page, choose the company "Demo - Solid Energy" and click Allow. You are sent back to Claude.
5. Try these prompts (the demo workspace is a geothermal power plant):
   - "List the first five assets in my workspace."  → uteamup_asset_list
   - "Find assets whose name contains pump."  → uteamup_asset_search (5 matches)
   - "Find the turbine assets and show the full details of the first one."  → uteamup_asset_search, uteamup_asset_get_by_guid
   - "List the first five work orders in my workspace."  → uteamup_workorder_list
   - "Which work orders mention H2S?"  → uteamup_workorder_search (5 matches)
6. Expected limits: the connector is read-only. A request such as "Close the first open work order" should be declined, and no write tool exists.
7. To disconnect: in UteamUP, Profile → Accounts → remove the Claude connection, or remove the connector in Claude.

Reviewer account (workspace "Demo - Solid Energy", read-only role):
Email: <fylla út í gáttinni>
Password: <fylla út í gáttinni>
```

- **Confirm you ran every tool:** merktu við bara eftir að þú hefur sjálfur tengt sem custom
  connector í Claude og kallað öll fimm verkfærin (dæmin í lið 5 duga).

## 9. Compliance

Sjö staðfestingar. Allar eiga við UteamUP eins og er:

| Staðfesting | Svar / athugasemd |
|---|---|
| Directory guidelines | Já. [Terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms), [Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) |
| First-party API usage | Já, eigið API UteamUP |
| Financial transactions | Engar, bara lestur |
| AI media generation | Engin |
| Prompt injection | Verkfærin skila bara gögnum úr UteamUP-skrám, engum fyrirmælum |
| Conversation data collection | Tengingin safnar ekki samtölum, hún fær bara verkfærakall með leitarorðum og skilar gögnum |
| Public documentation | GitHub README (kafli 3) |

## 10. Review and submit

Lestu yfir viðvaranirnar sem gáttin sýnir, sendu og fylgstu með stöðunni á
`https://claude.ai/directory/manage`. Ef eitthvað festist: `mcp-review@anthropic.com`.

## Eftir birtingu

- Breytingar á verkfærum (t.d. ef `/mcp/read-only` fær fleiri verkfæri) koma sjálfkrafa inn,
  en uppfæra þarf lýsinguna í gáttinni ef þær breyta því sem connectorinn gerir.
- Fulla `/mcp` (skrifaðgangur) er ekki hægt að senda inn fyrr en öll ~2000 verkfærin hafa
  `title` og `readOnlyHint`/`destructiveHint`.
