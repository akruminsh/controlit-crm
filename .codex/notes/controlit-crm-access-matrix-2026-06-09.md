# Controlit CRM Access Matrix - 2026-06-09

## Source

Access list received from client on 2026-06-09.

Important instruction from project owner:

- Do not create user accounts from this list.
- Record the required access levels.
- Apply restrictions only for users that already exist in CRM.
- Users not yet present in CRM stay pending until the client invites/creates them.

## Production Check On 2026-06-09

Existing CRM users:

| Email | Current CRM role | Action |
| --- | --- | --- |
| crm@controlitfactory.eu | Admin | Keep as internal/admin account |
| erik@controlit.ae | Admin | Keep for now; not in new client list, confirm before changing |
| eriks@controlit.lv | Admin | Matches full access requirement |
| sofija@controlitfactory.eu | Admin | Matches full access requirement |

Current territory assignment rows in production:

| Table | Count |
| --- | ---: |
| core.controlitTerritoryAccess | 0 |

Meaning: territory filtering code is deployed, but no non-admin manager restrictions are active yet.

## Full Access, No Restrictions

These users should have unrestricted access to all CRM data.

| Name | Email | Desired access | Current status |
| --- | --- | --- | --- |
| Kristaps Draudiņš | kristaps@controlit.lv | Full admin | Pending account |
| Kārlis Šēnhofs | karlis@controlit.lv | Full admin | Pending account |
| Sofija Strelita Strēle | sofija@controlitfactory.eu | Full admin | Already Admin |
| Ēriks Stankevičs | eriks@controlit.lv | Full admin | Already Admin |
| Julien Neimard | julien@controlitfactory.eu | Full admin | Pending account |

## Limited Access By Territory

These users should be non-admin users restricted to assigned territories.

| Region / Territory | Name | Email | Desired access | Current status |
| --- | --- | --- | --- | --- |
| Finland | Aivar Kalda | info@katetekniikka.fi | Limited to Finland | Pending account |
| Finland | Kari Järvinen | kari.jarvinen@kattopojat.fi | Limited to Finland | Pending account |
| Estonia | Aivar Kalda | info@katuseseire.ee | Limited to Estonia | Pending account |
| Lithuania | KĘSTAS GUDELEVIČIUS | kestas@kecas.lt | Limited to Lithuania | Pending account |
| Czechia, Slovakia | Jiří PEŠEK | jiri.pesek@ossma.cz | Limited to Czechia and Slovakia | Pending account |
| Slovenia, Croatia | Uroš Dimnik | uros.dimnik@diming.si | Limited to Slovenia and Croatia | Pending account |
| Slovenia, Croatia | Blaž Zupan | blaz.zupan@diming.si | Limited to Slovenia and Croatia | Pending account |
| Romania, Hungary | Kolcsár Zoltán Zsolt | office@odu.ro | Limited to Romania and Hungary | Pending account |
| MENA region | George Hajj | george@controlitfactory.eu | Limited to MENA | Pending account |
| Australia, New Zealand | Malcolm Ross | sales@provenmembranenz.co.nz | Limited to Australia and New Zealand | Pending account |
| Australia, New Zealand | Greg Crocker | greg@provenmembranes.com.au | Limited to Australia and New Zealand | Pending account |

## Canonical Territory Values To Use

Use these canonical values when creating territory assignments:

| Display label | Canonical value |
| --- | --- |
| Finland | FINLAND |
| Estonia | ESTONIA |
| Lithuania | LITHUANIA |
| Czechia | CZECHIA |
| Slovakia | SLOVAKIA |
| Slovenia | SLOVENIA |
| Croatia | CROATIA |
| Romania | ROMANIA |
| Hungary | HUNGARY |
| MENA region | MENA |
| Australia | AUSTRALIA |
| New Zealand | NEW_ZEALAND |

## Assignment Payload For Future Application

When the corresponding users exist in CRM, apply this desired state:

```json
{
  "fullAccessAdmins": [
    "kristaps@controlit.lv",
    "karlis@controlit.lv",
    "sofija@controlitfactory.eu",
    "eriks@controlit.lv",
    "julien@controlitfactory.eu"
  ],
  "limitedTerritoryUsers": [
    {
      "email": "info@katetekniikka.fi",
      "territories": ["FINLAND"]
    },
    {
      "email": "kari.jarvinen@kattopojat.fi",
      "territories": ["FINLAND"]
    },
    {
      "email": "info@katuseseire.ee",
      "territories": ["ESTONIA"]
    },
    {
      "email": "kestas@kecas.lt",
      "territories": ["LITHUANIA"]
    },
    {
      "email": "jiri.pesek@ossma.cz",
      "territories": ["CZECHIA", "SLOVAKIA"]
    },
    {
      "email": "uros.dimnik@diming.si",
      "territories": ["SLOVENIA", "CROATIA"]
    },
    {
      "email": "blaz.zupan@diming.si",
      "territories": ["SLOVENIA", "CROATIA"]
    },
    {
      "email": "office@odu.ro",
      "territories": ["ROMANIA", "HUNGARY"]
    },
    {
      "email": "george@controlitfactory.eu",
      "territories": ["MENA"]
    },
    {
      "email": "sales@provenmembranenz.co.nz",
      "territories": ["AUSTRALIA", "NEW_ZEALAND"]
    },
    {
      "email": "greg@provenmembranes.com.au",
      "territories": ["AUSTRALIA", "NEW_ZEALAND"]
    }
  ]
}
```

## Implementation Notes

- Do not demote or remove `erik@controlit.ae` until the client explicitly confirms it should lose admin access.
- `karlis@controlit.lv` was corrected from the typo `karlis@conrolit.lv` after confirmation from the project owner.
- New territories were prepared on 2026-06-09:
  - Backend territory constants updated and deployed to production commit `5e09e406a163df7459feb3a3ac4e15a90e57dfcd`.
  - Operational scripts now accept/backfill these territories.
  - Production metadata dropdowns `companyCountry` and `projectCountry` now contain all 15 canonical territory values.
- Production metadata now also contains `personTerritory` and `taskTerritory`, both with the same 15 canonical territory values.
- Production metadata now also contains `noteTerritory`; Notes are restricted by territory in the deployed server code at commit `800de3999bd6956c240f471c0621f2635c944038`.
- The direct production metadata correction on 2026-06-09 required bumping workspace `metadataVersion` from 31 to 32 and clearing Redis workspace metadata cache, otherwise GraphQL kept the old metadata map and rejected `noteTerritory`.
- Full admin users do not need rows in `core.controlitTerritoryAccess` because admins bypass territory restrictions.
- Limited users should receive normal non-admin CRM roles plus one row in `core.controlitTerritoryAccess` with their allowed territory array.
- Pilot territory assignment was activated only for `ak@marketinghackers.lv`; no real partner/user restrictions were activated yet.

## Pilot Access Test On 2026-06-09

- Temporary pilot user: `ak@marketinghackers.lv`.
- Role: `Data Navigator` (read-only).
- Territory assignment: `FINLAND`.
- Password/token values were intentionally not written into notes.
- Metadata fields verified in production:
  - `company.companyCountry`
  - `opportunity.projectCountry`
  - `person.personTerritory`
  - `task.taskTerritory`
  - `note.noteTerritory`
- View fields verified visible:
  - `companyCountry` in Companies index/table view.
  - `projectCountry` in Projects index/table view and `By Stage` kanban.
  - `personTerritory` in People index/table view.
  - `taskTerritory` in Tasks index/table view.
- Pilot login verification:
  - REST login succeeded for `ak@marketinghackers.lv`.
  - Pilot Companies result returned `112` records.
  - All returned pilot companies had `companyCountry = FINLAND`.
  - Non-Finland companies returned by pilot account: `0`.
- In-app browser verification after deploy/cache refresh:
  - Companies: `All Companies · 112`; visible records show Finland, no visible Estonia/Lithuania.
  - People: initially `0` because `personTerritory` had not been backfilled; after backfill from linked company, `All People · 252`.
  - Notes: initially leaked `292` notes; fixed with `noteTerritory`; after cache refresh, `All Notes · 126`, no new GraphQL errors.
  - Projects: `By Stage · 0` for Finland pilot because existing projects have empty `projectCountry`.
  - Tasks: `All Tasks · 0` for Finland pilot because existing tasks have empty `taskTerritory`.
- Production company territory counts at verification time:
  - `FINLAND`: `112`
  - `ESTONIA`: `128`
  - `LITHUANIA`: `14`
  - empty territory: `8`
- Production person territory counts after backfill:
  - `FINLAND`: `252`
  - `ESTONIA`: `208`
  - `LITHUANIA`: `19`
  - empty territory: `7`
- Production note territory counts after backfill:
  - `FINLAND`: `126`
  - `ESTONIA`: `147`
  - `LITHUANIA`: `11`
  - empty territory: `8`
- Production projects/tasks still need explicit territory assignment if these should become visible to branch users:
  - Projects with empty `projectCountry`: `8`
  - Tasks with empty `taskTerritory`: `12`

## Backup / Safety Artifacts

- Backup before pilot access work:
  - `/opt/controlit-crm/backups/db-20260609-093912-pre-pilot-access.sql.gz`
- Local backup before Notes territory work:
  - `.codex/backups/controlit-notes-territory-20260609-131949.sql.gz`
- Local backup before People territory backfill:
  - `.codex/backups/controlit-person-territory-backfill-20260609-134547.sql.gz`
- Temporary metadata API key used for setup:
  - `codex-pilot-metadata-20260609`
  - Revoked after metadata setup.
