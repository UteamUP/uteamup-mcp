---
name: uteamup-fleet-management
description: "Runs day-to-day fleet work in UteamUP: fleet dashboard, utilization, costs and pre-trip compliance; VIN decoding for new vehicles; fuel transactions and fuel efficiency; energy and CO2 records; fuel and idling anomalies, tire readiness and replacement cost of ownership; statutory odometer readings and distance-tax reports; readiness holds and damage; and the vehicle rental lifecycle from rates and reservation through checkout, return and release. Use when the user says things like: how is the fleet doing, decode this VIN, log a fuel fill-up for truck 7, what is the fuel consumption of the van, which vehicles missed their pre-trip check, which odometer readings are due for kilometragjald, rent the excavator to Acme next week, check the car out, the car came back with a dent, is the van ready to rent again."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP fleet management

Covers vehicles, vessels and mobile machinery that are registered as assets. Reading is free;
every fuel record, energy record, statutory reading, hold, damage case or rental step is shown to
the user first and needs a clear yes. Registering a new vehicle is done with the
`uteamup-asset-onboarding` skill, ordinary meter readings with `uteamup-meter-readings`, and work
orders with `uteamup-workorder-triage` (each if available). The rental lifecycle has its own
reference: `references/rentals.md`.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_asset_search` | Find a vehicle by name, plate or VIN (serial number) | `searchFilter` |
| `uteamup_fleet_dashboard_get` | Fleet overview: vehicles in service, PM and inspection status, fuel | none |
| `uteamup_fleet_dashboard_get_utilization` / `uteamup_fleet_dashboard_get_costs` | Utilization / cost breakdown | none / `dateFrom`, `dateTo` |
| `uteamup_fleet_dashboard_get_compliance` | Pre-trip/DVIR compliance, last 24 h | none |
| `uteamup_vehicle_inspection_get_overdue` | Road vehicles with no pre-trip/DVIR in 24 h | none |
| `uteamup_vehicle_inspection_list` / `uteamup_vehicle_inspection_get` | Inspections and their results | `assetGuid`, `status`, `page`, `pageSize` / `inspectionGuid` |
| `uteamup_fleet_vin_decode` | Make, model, year, body, fuel type from a VIN | `vin` |
| `uteamup_fuel_transaction_list` / `uteamup_fuel_transaction_get` | Fuel fills | `assetGuid`, `dateFrom`, `dateTo`, `page`, `pageSize` / `transactionGuid` |
| `uteamup_fuel_transaction_create` | Record a fill | `model` |
| `uteamup_fuel_transaction_update` | Replace a fill (send every field) | `transactionGuid`, `model` |
| `uteamup_fuel_transaction_get_summary` / `uteamup_fuel_transaction_get_efficiency` | Totals / L per 100 km for one vehicle | `assetGuid`, `dateFrom`, `dateTo` / `assetGuid` |
| `uteamup_asset_energy_record_list` / `uteamup_asset_energy_record_get` | Energy, fuel and CO2 records | `assetGuid`, `from`, `to` / `recordGuid` |
| `uteamup_asset_energy_record_create` / `uteamup_asset_energy_record_update` | Add / replace an energy record | `assetGuid`, `model` / `recordGuid`, `model` |
| `uteamup_asset_energy_record_get_summary` | Sustainability totals | `assetGuid` (optional), `from`, `to` |
| `uteamup_fleet_intelligence_get_anomalies` | Fuel and idling anomalies | `lookbackDays`, `minimumHistory` |
| `uteamup_fleet_intelligence_get_tire_readiness` | Tread, pressure and related open work | `assetGuid` |
| `uteamup_fleet_intelligence_get_replacement_tco` | Replace-or-keep cost scenario | `assetGuid`, `currency`, `horizonMonths`, cost inputs |
| `uteamup_distance_tax_schemes` / `uteamup_distance_tax_report` | Distance-tax schemes / report for a period | none / `schemeKey`, `from`, `to` |
| `uteamup_distance_tax_statutory_due` | Rental road vehicles whose statutory odometer reading is due | none |
| `uteamup_meterreading_get_current` | Odometer or hour meter GUID and latest value | `assetGuid` |
| `uteamup_meterreading_record_statutory` | Statutory odometer reading (legal record) | `assetGuid`, `attributeDefinitionGuid`, `request` |
| `uteamup_assetreadiness_get_holds` / `uteamup_assetreadiness_get_damage` | Holds and damage cases on a vehicle | `assetGuid` |
| `uteamup_assetreadiness_create_hold` / `uteamup_assetreadiness_release_hold` | Put on / release a hold | `assetGuid`, `model` / `holdGuid`, `model` |
| `uteamup_assetreadiness_create_damage` / `uteamup_assetreadiness_resolve_damage` | Open / resolve a damage case | `assetGuid`, `model` / `damageGuid`, `model` |
| `uteamup_fleet_maintenance_propose` | Preview a maintenance work order from a failed inspection, DTC or asset package (saves nothing) | `sourceType`, `sourceGuid`, `idempotencyKey` |
| Rental tools (`uteamup_assetrental_*`) | Rates, reservation, checkout, return, release | see `references/rentals.md` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use.
2. **Vehicle.** `uteamup_asset_search` with the name, plate or VIN; confirm if several match.
3. **Overview questions.** `uteamup_fleet_dashboard_get`, then `_get_utilization`, `_get_costs`
   (`dateFrom`/`dateTo`) or `_get_compliance` as asked. For missed daily checks,
   `uteamup_vehicle_inspection_get_overdue`. Summarise; never mix currencies in one total.
4. **New vehicle from a VIN.** `uteamup_fleet_vin_decode` (17 characters, no I, O or Q). Show
   make, model, year, body and fuel type, then hand off to `uteamup-asset-onboarding` with
   `manufacturer`, `modelNumber`, `manufactureYear` and the VIN as `serialNumber`. Check
   `uteamup_asset_search` with the VIN first so the vehicle is not registered twice.
5. **Fuel fill.** Confirm, then `uteamup_fuel_transaction_create` with `model`: `assetGuid`,
   `transactionDate` (UTC), `fuelType` (required, e.g. Diesel, Petrol, AdBlue, Electric),
   `quantity`, `quantityUnit` (default `L`), `totalCost`, `currency` (ISO code), optional
   `unitPrice`, `odometerAtFill`, `stationName`, `driverGuid`, `notes`. Never store a full fuel
   card number the user did not ask to store. To fix a fill, read it with
   `uteamup_fuel_transaction_get`, copy every field, change only what is wrong and call
   `uteamup_fuel_transaction_update`. Efficiency: `uteamup_fuel_transaction_get_efficiency` (null
   means not enough fills with odometer values).
6. **Energy and CO2.** `uteamup_asset_energy_record_list` / `_get_summary` with `assetGuid`. To add:
   `uteamup_asset_energy_record_create` with `assetGuid` and `model` (`recordDate`,
   `fuelConsumedLitres`, `energyConsumedKWh`, `co2EmittedGrams`, `odometerStart`, `odometerEnd`,
   `distanceKm`, `source`: `Manual`, `Calculated` or `IoT`). Always pass GUIDs (`assetGuid`,
   `recordGuid`), never the integer `assetId`/`id` parameters.
7. **Analysis.** `uteamup_fleet_intelligence_get_anomalies` (`lookbackDays`, default 90),
   `uteamup_fleet_intelligence_get_tire_readiness` (`assetGuid`), and for replace-or-keep
   `uteamup_fleet_intelligence_get_replacement_tco` with figures the user supplies (`currency`,
   `horizonMonths`, `replacementEstimate`, `residualValue`, `financingCost`,
   `downtimeCostPerHour`, `replacementAnnualMaintenanceCost`, `replacementFuelReductionPercent`).
   Ask for missing figures; do not invent prices.
8. **Statutory odometer (distance tax).** `uteamup_distance_tax_statutory_due` lists vehicles due.
   For each reading the user gives: `uteamup_meterreading_get_current` for the odometer
   `attributeDefinitionGuid`, confirm, then `uteamup_meterreading_record_statutory` with `request`:
   `readingValue`, `context` (`periodicCadence`, `rentalCheckout`, `rentalReturn`,
   `ownershipChange`, `deregistration`, `reregistration`, `temporaryExport`,
   `seasonalDeactivation`), optional `observedAt`, `evidenceDocumentUrl`, `notes`. A statutory
   reading cannot be edited; mistakes go through `uteamup_meterreading_correct`. Reports:
   `uteamup_distance_tax_schemes` then `uteamup_distance_tax_report` (`schemeKey`, `from`, `to`).
9. **Holds and damage.** Read with `uteamup_assetreadiness_get_holds` / `_get_damage`. Create a
   hold with `model`: new random `requestGuid`, `holdType` (`Maintenance`, `Damage`,
   `Compliance`, `Manual`, `Cleaning`, `Charging`), `reason`. Release only when the user confirms
   the cause is fixed: `uteamup_assetreadiness_release_hold` (`holdGuid`, `model.releaseNotes`).
   Damage: `uteamup_assetreadiness_create_damage` with `requestGuid`, `description`,
   `discoveredAtUtc`, `discoveredDuring`, `category`, optional `rentalGuid`, `photoUrls`,
   `estimatedCost` + `currencyGuid`, `billingHold`; resolve with
   `uteamup_assetreadiness_resolve_damage` (`resolutionNotes`, optional `actualCost`,
   `repairWorkorderGuid`, `releaseBillingHold`). Repairs never release a vehicle by themselves.
10. **Maintenance from findings.** `uteamup_fleet_maintenance_propose` with `sourceType`
    (`vehicle-inspection`, `telematics-event` or `asset-maintenance-package`), `sourceGuid` and a
    new `idempotencyKey` gives an editable proposal. Show it, then hand off to
    `uteamup-workorder-triage` to create the work order.
11. **Rentals.** Follow `references/rentals.md`.
12. **Report.** What was recorded or changed, with GUIDs, and anything skipped.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess or use
  integer ids.
- Before any create, update, hold, release, damage case, statutory reading or rental step, show
  the user what will happen and get a clear yes.
- Records are archived, never deleted. Do not call `uteamup_fuel_transaction_delete`,
  `uteamup_asset_energy_record_delete` or `uteamup_vehicle_inspection_delete`; correct with an
  update instead and tell the user if a record must be removed (web app).
- Updates to fuel and energy records replace every field; start from a fresh read.
- Money: keep each amount with its currency; never add amounts in different currencies.
  Rental billing figures are recorded, not charged or refunded.
- Vehicle inspections (checklists, signatures) are carried out in the UteamUP web or mobile app;
  this skill reads them and uses a completed inspection's GUID as evidence.
- Respect permission and feature errors (Fleet.Read, FuelTransaction.*, MeterReading.Update, the
  Fleet VIN Decode feature, …): report them and stop; do not try another tool to get around them.
- Keep results short: use date windows and `page`/`pageSize`; summarise.
- If a write tool is unavailable (read-only connection), explain that recording fleet data needs
  the full UteamUP connection.

## Examples

**"Truck 7 filled 182 litres of diesel for 54,600 ISK at 128,450 km."**
`uteamup_asset_search` → confirm → `uteamup_fuel_transaction_create` (`fuelType: "Diesel"`,
`quantity: 182`, `totalCost: 54600`, `currency: "ISK"`, `odometerAtFill: 128450`) →
`uteamup_fuel_transaction_get_efficiency`.

**"Which rental cars need their six-month kilometre reading, and record 61,204 km for the Yaris."**
`uteamup_distance_tax_statutory_due` → `uteamup_asset_search` → `uteamup_meterreading_get_current`
→ confirm → `uteamup_meterreading_record_statutory` (`context: "periodicCadence"`).

**"Decode WVWZZZ1KZAW000001 and register the car."**
`uteamup_fleet_vin_decode` → `uteamup_asset_search` (VIN) → hand off to `uteamup-asset-onboarding`.
