# Vehicle and equipment rentals

Rentals in UteamUP follow a fixed order: configure rates → reserve → release as ready → check
out → return → release as ready again. Every step after the reads changes data: show the user what will happen and
get a clear yes first. Billing amounts are recorded only; nothing is charged or refunded.

## Tools

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_assetrental_get_available` / `uteamup_assetrental_get_rented` | What can be rented / what is out | none |
| `uteamup_assetrental_get_expiring_soon` | Rentals ending within N days | `days` (default 30) |
| `uteamup_assetrental_revenue_summary` | Rental revenue for a period | `startDate`, `endDate` |
| `uteamup_assetrental_get_by_asset` | Rental settings of an asset (rates, deposit, `updatedAt`) | `assetGuid` |
| `uteamup_assetrental_get_history` | Rentals of an asset (`externalGuid`, `status`, `updatedAt`) | `assetGuid` |
| `uteamup_assetrental_create_or_update` | Set rates, deposit and availability | `assetGuid`, `model` |
| `uteamup_assetrental_start` | Reserve a future rental (no handover) | `assetGuid`, `model` |
| `uteamup_assetrental_ready` | Release the vehicle as ready to rent | `assetGuid`, `model` |
| `uteamup_assetrental_checkout` | Hand the vehicle to the renter | `rentalGuid`, `model` |
| `uteamup_assetrental_end` | Record the return | `rentalGuid`, `model` |
| `uteamup_assetrental_extend` / `uteamup_assetrental_cancel` | Move the end date / cancel a reservation | `rentalGuid`, `model` |
| `uteamup_customer_search` / `uteamup_contact_list` | Renter | `nameFilter` / `page`, `pageSize` |
| `uteamup_currency_list` | Currency GUID for rates | `nameFilter` |
| `uteamup_vehicle_inspection_list` | Completed inspection to use as evidence | `assetGuid`, `status` |
| `uteamup_assetreadiness_get_holds` / `uteamup_assetreadiness_release_hold` | Holds that block release | `assetGuid` / `holdGuid`, `model` |

## Version check

Every lifecycle step carries `expectedUpdatedAtUtc` so two people cannot change the same rental at
once. Take it from a fresh read just before the call:

- `ready`: `updatedAt` of `uteamup_assetrental_get_by_asset` (the rental settings).
- `checkout`, `end`, `extend`, `cancel`: `updatedAt` of the rental in
  `uteamup_assetrental_get_history`.

If the call says the rental or readiness changed, read again, show the user what changed and ask
before retrying.

## Steps

1. **Rates (once per asset).** `uteamup_assetrental_get_by_asset`. To set or change, confirm, then
   `uteamup_assetrental_create_or_update` with `model`: `assetGuid`, `isAvailable`,
   `currencyGuid`, any of `hourlyRate`, `dailyRate`, `weeklyRate`, `monthlyRate`, `yearlyRate`,
   `securityDeposit`, `defaultIncludedKmCapPerDay`, `defaultExcessKmRate`, `rentalTerms`, `notes`.
   Send the existing values for fields you are not changing.
2. **Reserve.** Find the renter with `uteamup_customer_search` (or a contact). Check
   `uteamup_assetrental_get_history` for overlapping rentals. Then `uteamup_assetrental_start`
   with `model`: a new random `requestGuid` (reuse the same one if you retry the same request),
   `customerGuid` or `contactGuid`, `rentalStartDate`, `expectedEndDate`, `rateType` (`Hourly`,
   `Daily`, `Weekly`, `Monthly` or `Yearly`; the asset must have that rate), optional `notes`,
   `contractGuid`, `deliveryWorkorderGuid`, `collectionWorkorderGuid`.
3. **Release as ready.** Required before checkout and after every return.
   - `uteamup_assetreadiness_get_holds`: every operational hold must be released first (only
     when the user confirms the cause is fixed).
   - A **passing** vehicle inspection from the last 24 hours, done at or after the latest return
     (`uteamup_vehicle_inspection_list` with `assetGuid`). If there is none, the inspection must be
     done in the UteamUP app first.
   - `uteamup_assetrental_ready` with handover `model` (below).
4. **Check out.** `uteamup_assetrental_checkout` (`rentalGuid` = the reservation's
   `externalGuid`) with handover `model`. The handover time must fall inside the reservation and
   the inspection must be a pass from the 24 hours before it.
5. **Return.** `uteamup_assetrental_end` with handover `model` plus: `securityDepositReturned`
   (not more than the deposit), `additionalCharges` and `additionalChargeReason` (required when
   charges are not 0), `requiresCleaning`, `requiresCharging`, and optional `damage` (same fields
   as a damage case: `requestGuid`, `description`, `discoveredAtUtc`, `category`,
   `discoveredDuring`, `photoUrls`, `estimatedCost`, `currencyGuid`, `billingHold`). Use the same
   meter basis as at checkout; the meter cannot be lower than at checkout. The inspection must be
   completed (it may have failed). Afterwards the vehicle needs step 3 again.
6. **Extend or cancel.** `uteamup_assetrental_extend` (`expectedEndDate`, `reason`) or
   `uteamup_assetrental_cancel` (`reason`), each with `expectedUpdatedAtUtc`. Cancelling keeps the
   history.

## Handover model

| Field | Meaning |
|-------|---------|
| `expectedUpdatedAtUtc` | Version from the fresh read (see above) |
| `observedAtUtc` | When the handover happened, UTC, not in the future |
| `inspectionGuid` | Completed vehicle inspection for this vehicle from the 24 hours before |
| `meterBasis` | `distance` (km) or `engineHours` (h) |
| `odometerKm` / `meterValue` | Reading at handover; `meterValue` is required for engine hours |
| `fuelLevelPercent` / `stateOfChargePercent` | 0-100, optional |
| `photoUrls`, `signatureUrl`, `notes` | Optional evidence |

The reading is checked against the meter ledger: a quarantined reading (for example a backwards
jump) blocks the handover until it is corrected or the meter replacement is registered (see the
`uteamup-meter-readings` skill). A wrong unit on the asset type's meter also blocks it; ask the
user to correct the type in the web app.
