---
name: uteamup-iot-monitoring
description: "Investigates IoT and sensor data in UteamUP (UPSense) without changing anything: monitoring dashboard and device health, devices, sensors and whether they are connected, alerts and alarms with their details, telemetry and energy over a time window, network meters on assets, parts and tools, and the baseline, threshold and heartbeat rules. Links an alert to its device, asset and any existing work order, and recommends a triage hand-off when work is needed. Use when the user asks things like: what alarms are open, why did the sensor alarm fire, show critical alerts from last night, is the temperature sensor online, which devices stopped reporting, show the readings for chiller 2 today, what rules are configured, is there already a work order for this alert, how much power did we use this week."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP IoT monitoring

Answers "what are the sensors telling us?" from UteamUP's IoT data, read-only. It finds the
alerts that matter, explains each one with the device, sensor, asset and readings around it, and
checks whether a work order already exists. It never acknowledges alerts, creates work orders,
changes devices or keys, or sends commands to equipment. When work is needed it recommends a
hand-off to `uteamup-workorder-triage` (if available); asset condition questions go to
`uteamup-asset-health`.

The IoT tools need the IoT Integration feature on the company's plan and the IOT.View permission.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`). Every tool here only reads.

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_io_t_monitoring_dashboard` | Device health, ingestion, recent alerts, data freshness, credential expiry | none |
| `uteamup_io_t_environment_status` | The company's IoT environment, sizing and usage | none |
| `uteamup_io_t_alerts_list` | Alerts, newest first | `from`, `to`, `severity`, `deviceGuid`, `sensorGuid`, `text`, `status`, `page`, `pageSize` |
| `uteamup_io_t_alert_get` | One alert in full | `alertGuid` |
| `uteamup_io_t_alert_workorder_get` | Work order already linked to an alert (null if none) | `alertGuid` |
| `uteamup_io_t_devices_list` | Devices with status, type, location, asset, `connectionState` | `search`, `page`, `pageSize`, `isActive` |
| `uteamup_io_t_device_get` | One device with sensors, tags, `connectionState` | `deviceGuid` |
| `uteamup_io_t_sensors_list` | Sensor metadata across active devices | `search`, `page`, `pageSize` |
| `uteamup_io_t_rules_list` | Baseline, threshold and heartbeat rules | none |
| `uteamup_io_t_telemetry_points` | Raw telemetry, cursor paged | `from`, `to`, `deviceGuid`, `assetGuid`, `partGuid`, `toolGuid`, `attributeDefinitionGuid`, `limit`, `beforeReceivedAt`, `beforePointGuid` |
| `uteamup_io_t_telemetry_overview` | Electrical power and kWh over a window (max 31 days) | `from`, `to` |
| `uteamup_io_t_resource_meters` | Current network meters on an asset, part or tool | `resourceType`, `resourceGuid` |
| `uteamup_io_t_resource_meter_history` | History of one network meter | `resourceType`, `resourceGuid`, `attributeDefinitionGuid`, `page`, `pageSize`, `from`, `to` |
| `uteamup_asset_search` / `uteamup_asset_get_by_guid` | Find or read the linked asset | `searchFilter` / `guid` |
| `uteamup_meterreading_get_current` | Latest meter values on the asset (IoT readings included) | `assetGuid` |
| `uteamup_meterreading_list` | Readings, filterable to IoT source | `assetGuid`, `source`, `from`, `to`, `page`, `pageSize` |
| `uteamup_workorder_list` | Open work orders on the asset | `assetGuid`, `openOnly` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use. A feature or
   permission error means IoT is not enabled for this company or user; say so and stop.
2. **Big picture.** For "how are things", start with `uteamup_io_t_monitoring_dashboard`: devices
   online vs offline, stale telemetry, recent alerts, keys about to expire. Mention backlog or
   dead-letter counts only if they are not zero.
3. **Alerts.** `uteamup_io_t_alerts_list` with filters from the question: `status` (`open`,
   `acknowledged`, `resolved`, `all`; default all), `severity` (`Info`, `Warning`, `Error`,
   `Critical`), `from`/`to` in UTC ("last night" = a concrete window), `deviceGuid`,
   `sensorGuid`, or `text` (an IP address, protocol or event id). `pageSize` at most 100. Group
   repeats of the same alert on the same device and give counts.
4. **Explain one alert.** `uteamup_io_t_alert_get` for the full description, device and sensor.
   Then:
   - `uteamup_io_t_device_get` (`deviceGuid`) for the device, its location and linked asset;
     `connectionState` is `noActiveKey`, `neverConnected` or `connected`.
   - `uteamup_io_t_telemetry_points` with `deviceGuid` (or `assetGuid`) and a window around the
     alert, for example one hour before to 30 minutes after. Use `limit` (default 100) and continue
     with `beforeReceivedAt` + `beforePointGuid` from the last point only if needed.
   - `uteamup_io_t_rules_list` to name the rule and threshold that fired.
   - `uteamup_io_t_alert_workorder_get` (`alertGuid`): is there already a work order?
   - If the device has an asset: `uteamup_asset_get_by_guid`, and
     `uteamup_workorder_list` (`assetGuid`, `openOnly: true`) for related open work.
5. **Devices that stopped reporting.** Telemetry freshness comes from
   `uteamup_io_t_monitoring_dashboard`; then `uteamup_io_t_devices_list` (`search`, `pageSize`
   25-100) for each device's status and `connectionState`. `noActiveKey` needs a key issued;
   `neverConnected` has a key but sent nothing; `connected` with old data points to the device or
   its network. Archived devices appear only with `isActive: false`.
6. **Readings for an asset.** `uteamup_asset_search`, then `uteamup_meterreading_get_current` and
   `uteamup_meterreading_list` (`assetGuid`, `source: "IoT"`, `from`/`to`) for meter values fed by
   sensors, or `uteamup_io_t_telemetry_points` (`assetGuid`) for raw points. Network meters
   (traffic, latency and similar from a gateway): `uteamup_io_t_resource_meters` with
   `resourceType` `asset`, `part` or `tool` and the GUID, then
   `uteamup_io_t_resource_meter_history` for one meter.
7. **Energy.** `uteamup_io_t_telemetry_overview` (`from`/`to`, at most 31 days, default 24 hours).
   Report kWh per signal and point out gaps and counter resets the tool flags; do not fill them in.
8. **Answer and recommend.** For each alert or issue: what happened (time, value, rule), which
   device and asset, whether it is still open, whether a work order exists (ticket and status).
   Then one recommendation:
   - Work order exists → follow it; give its ticket.
   - Needs work and none exists → recommend the `uteamup-workorder-triage` skill. Tell the user
     that a work order can be created straight from the alert (tool
     `uteamup_io_t_alert_convert_to_workorder`, one per alert, needs WorkOrder.Create and the
     full connection); this skill does not call it.
   - Looks like a false alarm or a rule that is too tight → say so with the readings as evidence
     and suggest reviewing the rule in the web app.
   - Asset condition question → `uteamup-asset-health`.

## Rules

- This skill only reads. Do not call create, update, archive, restore, key, command, link,
  unlink or convert tools, even if the user asks in passing; explain that the change needs the
  full UteamUP connection and the right skill or the web app.
- Acknowledging or resolving an alert is not available through MCP; ask the user to do it in the
  web app.
- Identifiers are GUIDs. List or search first and use the returned GUID; never guess or use
  integer ids.
- Never reveal or ask for device keys or secrets. Key lists show prefixes only; that is enough.
- Base every conclusion on returned data. Label a likely cause as your assessment and show the
  readings it rests on. Times are UTC unless you convert them, and say when you do.
- Respect permission and feature errors (IOT.View, Asset.View, WorkOrder.View, IoT Integration):
  report them and continue with what you can see; do not try another tool to get around them.
- Keep results short: narrow time windows, filters and `pageSize`; summarise telemetry as
  first/last/min/max and when thresholds were crossed instead of listing points.

## Examples

**"What critical alarms fired last night?"**
`uteamup_io_t_alerts_list` (`severity: "Critical"`, `from`/`to` = 18:00-07:00 UTC) → group by
device → `uteamup_io_t_alert_workorder_get` for each distinct alert → summary with
recommendations.

**"Why did the freezer temperature alarm go off, and is someone on it?"**
`uteamup_io_t_alerts_list` (`text: "freezer"`, `status: "open"`) → `uteamup_io_t_alert_get` →
`uteamup_io_t_device_get` → `uteamup_io_t_telemetry_points` (window around the alert) →
`uteamup_io_t_rules_list` → `uteamup_io_t_alert_workorder_get` → `uteamup_workorder_list`
(`assetGuid`, `openOnly: true`) → explanation and triage recommendation.

**"Which sensors stopped reporting?"**
`uteamup_io_t_monitoring_dashboard` → `uteamup_io_t_devices_list` (`pageSize: 100`) → list devices
with stale data by `connectionState`, with next steps.
