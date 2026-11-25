---
name: uteamup-sustainability-reporting
description: "Records and corrects UteamUP sustainability data through MCP: energy (utility meter) readings, water readings, waste disposal records and Scope 1/2/3 carbon emissions, then checks sustainability goal progress and energy anomalies and explains emission factors and energy benchmarks. Use when the user says things like: log this electricity meter reading, record the gas bill for March, add 200 litres of used oil from the pump overhaul, record our diesel emissions for Q1, fix the wrong water reading, which emission factor should I use, are we on track for the energy goal, why was this reading flagged as an anomaly."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP sustainability reporting

Captures the raw data behind a company's ESG reporting in UteamUP: utility meter readings,
water consumption, waste disposal and greenhouse gas emissions. After recording, it checks the
effect on sustainability goals and on detected energy anomalies, and helps pick an emission
factor or benchmark. Every identifier is a public GUID. Sustainability tools need the company's
Sustainability feature and the matching read or create permission.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm the active company | none |
| `uteamup_sustainability_energy_reading_list` / `uteamup_sustainability_energy_reading_get` | Energy readings, or one meter's history | `utilityMeterGuid`, `page`, `pageSize` / `readingGuid` |
| `uteamup_sustainability_energy_reading_create` | Record a meter reading | `utilityMeterGuid`, `readingValue`, `readingDate`, `consumption`, `readingType`, `utilityType`, `unit`, `costPerUnit`, `totalCost`, `notes` |
| `uteamup_sustainability_energy_reading_update` | Correct a reading; omitted fields kept | `readingGuid` plus fields to change |
| `uteamup_sustainability_water_reading_list` / `uteamup_sustainability_water_reading_get` | Water readings | `page`, `pageSize` / `readingGuid` |
| `uteamup_sustainability_water_reading_create` | Record water use at a location | `locationGuid`, `readingDate`, `consumption`, `utilityMeterGuid`, `unit`, `waterSource`, `costPerUnit`, `totalCost`, `notes` |
| `uteamup_sustainability_water_reading_update` | Correct a water reading | `readingGuid` plus fields to change |
| `uteamup_sustainability_waste_record_list` / `uteamup_sustainability_waste_record_get` | Waste records | `page`, `pageSize` / `recordGuid` |
| `uteamup_sustainability_waste_record_create` | Record disposed waste | `locationGuid`, `recordDate`, `wasteCategory`, `quantity`, `wasteType`, `disposalMethod`, `unit`, `assetGuid`, `workorderGuid`, `manifestNumber`, `regulatoryReference`, `cost`, `notes` |
| `uteamup_sustainability_waste_record_update` | Correct a waste record | `recordGuid` plus fields to change |
| `uteamup_sustainability_carbon_emission_list` / `uteamup_sustainability_carbon_emission_get` | Carbon entries | `page`, `pageSize` / `emissionGuid` |
| `uteamup_sustainability_carbon_emission_create` | Record an emission for a period | `scope`, `category`, `sourceDescription`, `periodStart`, `periodEnd`, `co2eKg`, `activityData`, `emissionFactorValue`, `activityUnit`, `calculationMethod`, `dataQuality`, `assetGuid`, `notes` |
| `uteamup_sustainability_carbon_emission_update` | Correct an emission | `emissionGuid` plus fields to change |
| `uteamup_sustainability_emission_factor_list` / `uteamup_sustainability_emission_factor_get` | CO2, CH4, N2O and CO2e per unit by region and year | `page`, `pageSize` / `emissionFactorGuid` |
| `uteamup_sustainability_energy_benchmark_list` / `uteamup_sustainability_energy_benchmark_get` | Reference values per utility type | `page`, `pageSize` / `benchmarkGuid` |
| `uteamup_sustainability_goal_list` / `uteamup_sustainability_goal_get` | Goals with baseline, target, current, progress and status | `includeInactive`, `page`, `pageSize` / `goalGuid` |
| `uteamup_sustainability_energy_anomaly_list` / `uteamup_sustainability_energy_anomaly_get` | Detected anomalies on readings | `status`, `severity`, `type`, `page`, `pageSize` / `anomalyGuid` |
| `uteamup_location_list` | Find a location GUID | `search`, `pageSize` |
| `uteamup_asset_search` | Find an asset GUID | `searchFilter` |
| `uteamup_workorder_search` | Find the work order that produced waste | `searchFilter` |

Allowed values: `utilityType` Electricity, NaturalGas, Water, Steam, CompressedAir, Diesel,
Propane, FuelOil. `readingType` Manual, Automated, Estimated. `waterSource` Municipal, Well,
Recycled, Rainwater, Surface. `wasteType` General, Hazardous, Recyclable, Electronic, Organic,
Construction. `disposalMethod` Landfill, Recycled, Incinerated, Composted, Reused,
HazardousDisposal. `scope` Scope1, Scope2, Scope3. `calculationMethod` LocationBased,
MarketBased, Direct. `dataQuality` Measured, Calculated, Estimated, Default.

## Workflow

1. **Company.** Call `uteamup_tenant_get_my_tenants` if unsure. If a tool reports no tenant, the
   wrong tenant or a missing Sustainability feature, tell the user and ask which company to use.
2. **Energy reading.** Find the meter GUID from its earlier readings:
   `uteamup_sustainability_energy_reading_list` and pick the `utilityMeterGuid` of the right
   meter (there is no meter search tool; if the meter has never had a reading, ask the user to
   add the first one in the web app). Check the latest value on that meter with
   `uteamup_sustainability_energy_reading_list` (`utilityMeterGuid`). A new value lower than the
   last one usually means a typo or a meter swap; ask before saving. Show meter, value, date
   (UTC), unit and cost, get a yes, then `uteamup_sustainability_energy_reading_create`. Only one
   reading per meter and date is accepted. The reading is checked for anomalies when saved.
3. **Water reading.** Find the site with `uteamup_location_list`, confirm, then
   `uteamup_sustainability_water_reading_create` with `locationGuid`, `readingDate`,
   `consumption`, and optional `utilityMeterGuid`, `unit`, `waterSource`, cost and notes.
4. **Waste record.** Find the location, and when the waste came from a job, the work order
   (`uteamup_workorder_search`) and asset (`uteamup_asset_search`). Confirm category, quantity,
   unit, type and disposal method; for hazardous waste ask for the manifest number. Then
   `uteamup_sustainability_waste_record_create`.
5. **Carbon emission.** Ask for scope, category, source, period and activity data with its unit.
   Find a factor with `uteamup_sustainability_emission_factor_list` (match utility or fuel,
   region and year; read one with `uteamup_sustainability_emission_factor_get`). Compute
   `co2eKg = activityData × factor` and show the calculation. Get a yes, then
   `uteamup_sustainability_carbon_emission_create` with `emissionFactorValue` set to the factor
   used; `co2eTonnes` is derived when left out. Purchased electricity is Scope2; fuel burned on
   site or in owned vehicles is Scope1; other value-chain sources are Scope3.
6. **Corrections.** Find the record with the list tool, read it with its matching get tool, show old and
   new values, get a yes, then call the matching update tool with only the fields that change
   (omitted fields keep their value).
7. **Effect on goals.** After recording, offer `uteamup_sustainability_goal_list` and report each
   relevant goal's progress percentage and status (on track, at risk, off track, achieved).
8. **Anomalies.** `uteamup_sustainability_energy_anomaly_list` with `status: "New"` and optionally
   `severity` shows flagged readings. Read one with `uteamup_sustainability_energy_anomaly_get`
   and the related reading with `uteamup_sustainability_energy_reading_get`, then explain the
   likely cause (typo, missing reading, real consumption change). Changing an anomaly's status is
   done in the web app.
9. **Benchmarks.** For "how do we compare", list `uteamup_sustainability_energy_benchmark_list`
   and compare the user's figures with the benchmark of the same utility type; state the
   benchmark type (industry average, best practice, regulatory or internal target).

## Rules

- Identifiers are GUIDs. Search or list first and reuse the returned GUID; never guess one or use
  an integer id.
- Make sure the right company is active.
- Before any create or update, show exactly what will be saved and get a clear yes. Records are
  archived, never deleted; there is no delete in this skill.
- Dates are UTC ISO 8601. Convert a local date or time the user gives and show both.
- Never invent consumption, quantities or emission factors. Show every calculation. Mark
  estimates with `readingType: "Estimated"` or `dataQuality: "Estimated"`.
- Do not double count: before recording a bill period, check the list for an entry on the same
  meter, location or period.
- Respect permission errors (for example `EnergyReading.Create`, `WasteRecord.Create`,
  `CarbonEmission.Create`): report them; do not retry with other tools.
- Keep results short: page lists (`pageSize` 10–25) and summarise totals instead of dumping rows.
- If a write tool is missing or refused because the connection is read-only, explain that
  writing requires the full UteamUP connection.
- Do not claim compliance with a reporting standard (GHG Protocol, CSRD, ISO 14064); describe the
  data only.

## Examples

**"Main electricity meter read 184,230 kWh this morning."**
`uteamup_sustainability_energy_reading_list` → pick the meter → check its last value →
confirm → `uteamup_sustainability_energy_reading_create` (`utilityMeterGuid`, `readingValue`,
`readingDate`, `utilityType: "Electricity"`, `unit: "kWh"`) → `uteamup_sustainability_goal_list`.

**"Record 200 L of used oil from the gearbox overhaul on work order 'Gearbox G3'."**
`uteamup_workorder_search` → `uteamup_location_list` → confirm →
`uteamup_sustainability_waste_record_create` (`wasteCategory: "Used oil"`, `quantity: 200`,
`unit: "L"`, `wasteType: "Hazardous"`, `disposalMethod: "HazardousDisposal"`, `workorderGuid`).

**"Add Q1 diesel emissions: 3,400 litres burned in our vans."**
`uteamup_sustainability_emission_factor_list` → pick the diesel factor → show
`3,400 × factor` → confirm → `uteamup_sustainability_carbon_emission_create` (`scope: "Scope1"`,
`category: "Mobile combustion"`, `activityData: 3400`, `activityUnit: "L"`, `emissionFactorValue`,
`co2eKg`, `periodStart`, `periodEnd`).
