---
name: uteamup-sustainability-overview
description: "Gives a read-only ESG and sustainability overview of a UteamUP company through MCP: progress toward sustainability goals, energy, water, waste and carbon trends, open energy anomalies, energy benchmarks and the energy used by maintenance jobs. Use when the user asks things like: how are we doing on our sustainability goals, give me an ESG summary, what is our carbon footprint this year, which sites use the most water, any energy anomalies this week, how much hazardous waste did we dispose of, how does our energy use compare to the benchmark, how much energy did maintenance jobs use."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP sustainability overview

Answers "how are we doing" questions about a company's environmental performance without
changing anything. It reads sustainability goals and their progress, recent energy, water, waste
and carbon records, flagged energy anomalies, benchmarks and the energy recorded on work orders,
and turns them into a short summary with trends. Sustainability tools need the company's
Sustainability feature and read permissions.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm the active company | none |
| `uteamup_sustainability_goal_list` | Goals with baseline, target, current value, progress % and status | `includeInactive`, `page`, `pageSize` |
| `uteamup_sustainability_goal_get` | One goal in detail | `goalGuid` |
| `uteamup_sustainability_energy_reading_list` | Energy readings, newest first; one meter's history | `utilityMeterGuid`, `page`, `pageSize` |
| `uteamup_sustainability_energy_reading_get` | One energy reading | `readingGuid` |
| `uteamup_sustainability_water_reading_list` | Water readings per location | `page`, `pageSize` |
| `uteamup_sustainability_waste_record_list` | Waste quantities, types, disposal methods, cost | `page`, `pageSize` |
| `uteamup_sustainability_carbon_emission_list` | Scope 1, 2, 3 emissions with CO2e kg and tonnes | `page`, `pageSize` |
| `uteamup_sustainability_carbon_emission_get` | One emission entry | `emissionGuid` |
| `uteamup_sustainability_emission_factor_list` | Factors used to convert activity data to CO2e | `page`, `pageSize` |
| `uteamup_sustainability_energy_benchmark_list` | Reference values per utility type | `page`, `pageSize` |
| `uteamup_sustainability_energy_anomaly_list` | Flagged readings | `status`, `severity`, `type`, `page`, `pageSize` |
| `uteamup_sustainability_energy_anomaly_get` | One anomaly in detail | `anomalyGuid` |
| `uteamup_workorder_energy_usage_list` | Energy and utility use recorded on work orders | `page`, `pageSize` |

Anomaly filters: `status` New, Acknowledged, Investigating, Resolved, FalsePositive; `severity`
Low, Medium, High, Critical; `type` ReadingOutOfRange, UnusualPattern, FrequencyDeviation,
MissingReading, SuddenChange.

## Workflow

1. **Company.** Call `uteamup_tenant_get_my_tenants` if unsure. If a tool reports no tenant, the
   wrong tenant or a missing Sustainability feature, say so and ask which company to use.
2. **Scope the question.** Agree the period (default: this year to date) and the areas (goals,
   energy, water, waste, carbon). Do not fetch everything for a narrow question.
3. **Goals first.** `uteamup_sustainability_goal_list` (`pageSize` 25). For each active goal give
   name, target date, baseline → current → target, progress % and status. Lead with goals that
   are at risk or off track.
4. **Trends.** Page through the relevant list tool (newest first) only as far back as the chosen
   period. Sum by month and by site, meter, scope or waste type, and compare with the previous
   period when the data reaches that far. Lists are paged (`pageSize` at most 100); say when a
   total is partial because the period has more rows than were read.
5. **Carbon.** From `uteamup_sustainability_carbon_emission_list`, total CO2e tonnes per scope and
   name the largest sources. `uteamup_sustainability_emission_factor_list` explains which factors
   were used when the user asks how a number was calculated.
6. **Anomalies.** `uteamup_sustainability_energy_anomaly_list` with `status: "New"` (and
   `severity: "High"` or `"Critical"` for a short list). For each, read the reading behind it
   with `uteamup_sustainability_energy_reading_get` and explain the likely cause. Recommend
   that someone with access reviews it in the web app.
7. **Benchmarks.** Compare the user's intensity figure with
   `uteamup_sustainability_energy_benchmark_list` entries of the same utility type, naming the
   benchmark type (industry average, best practice, regulatory or internal target).
8. **Maintenance energy.** `uteamup_workorder_energy_usage_list` shows consumption and cost
   recorded on jobs; group by work order or utility type when asked.
9. **Summary.** Five to ten lines: goal status, the biggest movements, open anomalies, and data
   gaps (missing months, meters without recent readings).

## Rules

- This skill only reads. If the user wants to record or correct data, say that it needs the
  sustainability reporting workflow and a full UteamUP connection.
- Identifiers are GUIDs. List first and reuse the returned GUID; never guess one or use an
  integer id.
- Make sure the right company is active.
- Never invent numbers. Show how totals were computed and state units; do not mix units (kWh and
  m3, kg and tonnes) without converting and saying so.
- Separate measured data from estimates when the records say so (reading type, data quality).
- Do not claim compliance with a reporting standard (GHG Protocol, CSRD, ISO 14064).
- Respect permission errors (for example `SustainabilityGoal.Read`, `CarbonEmission.Read`):
  report which area could not be read and continue with the rest; do not retry with other tools.
- Keep results short: summaries and small tables, not raw record dumps.

## Examples

**"How are we doing on our sustainability goals?"**
`uteamup_sustainability_goal_list` → table of goals with progress and status, at-risk first.

**"What is our carbon footprint this year, by scope?"**
`uteamup_sustainability_carbon_emission_list` (page until the start of the year) → totals per
scope in tonnes CO2e, top three sources, comparison with last year if available.

**"Any energy anomalies this week?"**
`uteamup_sustainability_energy_anomaly_list` (`status: "New"`) → for the top items
`uteamup_sustainability_energy_anomaly_get` and `uteamup_sustainability_energy_reading_get` →
short explanation per anomaly.
