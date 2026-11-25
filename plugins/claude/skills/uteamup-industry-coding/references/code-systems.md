# Common industrial code systems

General background to help read and explain codes. A company's own catalog in UteamUP is
authoritative: its separators, level names and custom codes can differ from the standards.
Never correct a user's code to fit these descriptions without asking.

## KKS (Kraftwerk-Kennzeichensystem, power plant classification system)

Hierarchical designation used mainly in power plants, published by VGB.
- **Level 0 – plant**: identifies the plant or unit (for example a site code or unit number).
- **Level 1 – function / system**: a prefix number plus three letters and a number, for
  example `1LAB10`. The first letter is the main group: `A` grid and distribution,
  `B` power transmission and auxiliary power, `C` instrumentation and control,
  `E` fuel supply, `H` conventional heat generation, `L` steam, water and gas cycles,
  `M` main machine sets, `P` cooling water, `Q` auxiliary systems, `U` structures.
- **Level 2 – equipment unit**: two letters and a number, for example `AP001` (pump),
  `AA001` (valve), `CT001` (temperature measurement), `CP001` (pressure measurement).
- **Level 3 – component**: two letters and a number for a part of the equipment unit, for
  example a motor or a sensor element.
Printed form often looks like `1LAB10 AP001 -M01`; separators vary by company.

## RDS-PP (Reference Designation System for Power Plants)

Successor to KKS, built on IEC/ISO 81346 and published by VGB.
- Designations are split into **aspects**, each marked by a prefix sign:
  `=` function, `-` product, `+` location. A conjoint (plant-level) prefix may precede them.
- The function aspect keeps a KKS-like system breakdown; the product aspect uses the letter
  classes of IEC 81346-2.
- One object can have several designations, one per aspect.

## IEC/ISO 81346

The generic standard behind RDS-PP: structuring principles and reference designations.
- Three main aspects: function (`=`), product (`-`), location (`+`).
- Each level of a designation is a letter code for the object class plus a number.
- Part 2 defines the object classes (letter codes) used in the product aspect.

## ISO 14224

Standard for collecting reliability and maintenance data, originally for petroleum,
petrochemical and natural gas industries.
- **Taxonomy of nine levels**: 1 industry, 2 business category, 3 installation,
  4 plant/unit, 5 section/system, 6 equipment unit, 7 subunit, 8 component or maintainable
  item, 9 part.
- Defines **equipment classes** (for example centrifugal pumps, compressors) with
  boundaries that state what belongs to each equipment unit.
- Defines code lists for **failure modes** (for example `FTS` fail to start on demand,
  `ELP` external leakage of process medium, `VIB` vibration), failure mechanisms, failure
  causes and detection methods. These map naturally to UteamUP failure codes.

## EN 13306

Maintenance terminology standard. UteamUP uses its failure classification (degradation,
breakdown, hidden, intermittent, systematic, random) when an asset failure is classified.

## Product classification standards (compliance codes)

`UNSPSC` and `ECLASS` classify products and services for purchasing and catalogues. In
UteamUP they appear as compliance standards and are attached as compliance codes, not as
industry-code catalog entries.
