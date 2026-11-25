# How intervals and triggers are written

Enum fields accept the numeric value shown here. Dates are ISO 8601 UTC
(`2026-03-01T00:00:00Z`).

## Maintenance plan (`uteamup_asset_maintenance_plan_create` / `uteamup_asset_maintenance_plan_update`, argument `model`)

| Field | Meaning |
|-------|---------|
| `name` (required), `description`, `isActive` | Plan header |
| `templateExternalGuid` | Copy items from a reusable plan template version |
| `effectiveDate` | Calendar anchor, for an asset joining the plan mid-life |
| `baselineMeterValue`, `baselineMeterDate`, `baselineMeterAttributeExternalGuid` | Known meter value at onboarding, so meter items do not start from zero |
| `nestingPolicy` | `0` Independent (every due item creates work), `1` SkipShorterWhenLongerDue (a due longer item replaces the shorter one it is nested under) |
| `dueTriggerPolicy` | `0` EarliestValid (only value): the first valid due date wins |
| `consolidationWindowDays` | 0–365; compatible due work within this window is combined |
| `schedulingHorizonDays` | 1–365, default 14; how far ahead work is generated |
| `cycleStartOffset` | 0–36; shifts where the nested cycle starts |

## Plan item (`uteamup_asset_maintenance_plan_add_item` / `uteamup_asset_maintenance_plan_update_item`, argument `model`)

| Field | Meaning |
|-------|---------|
| `name` (required), `sortOrder` | Item label and order |
| `triggerType` | `0` Calendar, `1` MeterBased, `2` InspectionResult, `3` IoTSignal |
| `frequencyPreset` | `0` CustomDays (use `calendarIntervalDays`), `1` Weekly, `2` Monthly, `3` Quarterly, `4` SemiAnnual, `5` Annual |
| `calendarIntervalDays` | 1–3650, for CustomDays |
| `meterIntervalValue` | Meter units between services (for example 500 hours) |
| `meterAttributeDefinitionExternalGuid` | The meter: `attributeDefinitionGuid` from `uteamup_meterreading_get_current` |
| `workorderTemplateExternalGuid` | The job to create when the item is due |
| `parentItemExternalGuid` | Nest under another item (or use `uteamup_asset_maintenance_plan_nest_item` later) |
| `requiredPartsJson`, `requiredToolsJson`, `requiredChemicalItemsJson` | Optional JSON text, up to 8,000 characters each |
| `isRequiredForWarranty`, `isRequiredForCertification` | Compliance flags |

Read-only on the response: `nextDueAt`, `lastTriggeredAt`, `lastTriggeredMeterValue`,
`lastWorkorderGuid`. The next meter due point counts from `lastTriggeredMeterValue`.

**Nesting.** The nested (child) item must have a longer calendar interval than its parent, for
example an annual item nested under a quarterly item. A child at or below the parent's interval is
rejected, as is nesting an item under itself; nesting depth is limited to 9 levels.

**Projection.** `uteamup_asset_maintenance_due_projection_get` returns per item: `state` (`0`
Projected, `1` Confirmed, `2` NotEnoughData), `dueSource` (`0` Calendar, `1` Meter, `2` InspectionResult, `3` IoTAlert), `dueAt`,
`reason`, `currentMeterValue`, `targetMeterValue`, `calculatedRatePerDay`, `confidence`, and
`wouldSkipBecauseLongerDue`. It writes nothing.

## Work-order template schedule (`uteamup_workorder_template_schedule_create`, argument `model`)

| Field | Meaning |
|-------|---------|
| `workorderTemplateGuid`, `name`, `startDate` | Required |
| `recurrenceType` | `0` None, `1` Daily, `2` Weekly, `3` Monthly, `4` Yearly, `5` Hourly |
| `recurrenceInterval` | 1–10,000; every N of the recurrence unit |
| `daysOfWeek` | Weekly: list of day numbers, `0` = Sunday … `6` = Saturday |
| `dayOfMonth` (1–31) or `useLastDayOfMonth` | Monthly |
| `monthOfYear` (1–12) with `dayOfMonth` | Yearly |
| `scheduledTime` | `"HH:mm"` |
| `endDate`, `timeZone` (default `"UTC"`), `daysInAdvance` (0–3650), `autoAssign`, `isActive` | Optional |
| `cronExpression` | Advanced; prefer the fields above |

"Tyres every spring and autumn" = two Yearly schedules (`monthOfYear: 4` and `10`) or one
Monthly schedule with `recurrenceInterval: 6`.

## Meter reading cadence (`uteamup_meterschedule_create_by_guid`)

Flat arguments, not a `model`: `assetGuid`, `attributeDefinitionGuid`, `intervalSeconds`
(minimum 300, used only when `recurrenceType` is `"none"`; pass `0` for calendar recurrence),
`recurrenceType` (`"none"`, `"weekly"`, `"monthly"`, `"yearly"`), `daysOfWeek`,
`dayOfMonthMode` (`"specificDay"`, `"firstDay"`, `"lastDay"`, `"firstWorkday"`,
`"lastWorkday"`), `dayOfMonth`, `monthOfYear`, `preferredTimeOfDay` (`"08:00:00"`),
`timeZoneId` (IANA), `scheduleLabel`. A daily sliding reading is `intervalSeconds: 86400`.
