# NASA Ames Wind Tunnel & Force Balance — Working Reference

One place for everything we scraped from NASA's own pages, for the Fox 3000mm wind-tunnel
load-cell project. Every fact below is sourced to a NASA URL at the bottom. Compiled 2026-06-22.

> **How this was gathered:** NASA Ames runs several wind tunnels — which specific one this
> project will use is still TBD. The two most relevant for a glider-scale test are the
> **Unitary Plan Wind Tunnel** sections (**11×11 transonic**, **9×7 supersonic**) plus the Model
> Prep Room; the giant **NFAC** (**40×80** and **80×120 ft**) is for full-scale tests. Pages were
> fetched directly from nasa.gov. Where a page only exposes data via a downloadable spreadsheet,
> that's noted.

---

## 1. The Unitary Plan test sections (verified from the official section pages)

| Spec | 11×11 ft Transonic (TWT) | 9×7 ft Supersonic (SWT) |
|---|---|---|
| **Mach** | 0.20 – 1.40 | **1.55 – 2.50** (continuously variable) |
| **Reynolds #** | 0.30 – 9.6 million/ft | 0.50 – 5.7 million/ft |
| **Stagnation pressure** | 3.0 – 32.0 psia | 4.4 – 29.5 psia |
| **Max stagnation temp** | ~150 °F | 600 °R (≈140 °F) |
| **Test section H×W×L** | 11.0 × 11.0 × 22.0 ft | 7.0 × 9.0 × 18.0 ft (≈11 ft usable) |
| **Vertical load limit** | ± 8,000 lb | ± 4,000 lb |
| **Lateral load limit** | ± 4,000 lb | ± 8,000 lb |
| **Axial load limit** | ± 3,000 lb | ± 3,000 lb |
| **Rolling moment** | ± 104,000 in-lb | ± 104,000 in-lb |
| **Combined bending** | ± 800,000 in-lb | ± 800,000 in-lb |

**Note the vertical/lateral swap** between the two tunnels — the strut traverses vertically in
the TWT and horizontally in the SWT, so the big load axis flips.

⚠️ **Correction confirmed twice:** the 9×7 is **Mach 1.55–2.50**. A figure of "1.54–2.56"
(and anything up to 3.5) wrongly mixes in the **inactive 8×7-ft** leg. The official 9×7 page says 1.55–2.50.

⚠️ **One spec disagreement to flag:** the official 9×7 page gives Reynolds **0.50–5.7 M/ft**;
our customer-guide PDF said 0.9–6.5 M/ft. Treat the live section page as authoritative, or
confirm with the Test Manager.

---

## 2. What NASA's force balance actually is ("Balance Basics" — their words)

NASA's own definition is, almost exactly, your bench rig scaled up:

- *"A balance is just a multiple axis force transducer."*
- It measures **6 components**: 3 forces (**Normal, Side, Axial**) + 3 moments (**Pitch, Yaw, Roll**).
- *"Balances are made of flexures that deflect [when] load is applied."*
- Strain gauges are **bonded to the flexures**; *"when a strain gauge changes length its electrical resistance changes."*
- The gauges are wired in a **Wheatstone bridge** → output voltage ∝ load.

**That is the TAL220 / TAS501 + HX711 concept**, just (a) all six axes in one machined block and
(b) mounted *inside* the model on a sting instead of under a plate.

---

## 3. The Ames Balance Calibration Laboratory (the part we'd missed)

A whole sub-site documents how NASA calibrates these balances. Highlights:

### Capabilities (hard numbers)
- Calibrates **internal strain-gauge balances 0.75 – 4.00 in diameter**; limited capability for
  single-element load cells & custom configs.
- Dead-weight calibration with **weights 0.5 – 1000 lb, accurate to 0.03% of value**.
- Reference **uniaxial load cells: 0.03% full-scale, ranges 1,000 – 10,000 lb**.
- Data reduction by **BALFIT** (NASA-Ames software): *"computes a data reduction matrix for a given
  balance calibration data set."* Follows **AIAA R-091-2003** load-iteration practice + an automatic
  math-model-selection algorithm.
- DAQ on **National Instruments PXI**.
- **Two sting support rigs** (0.75–4.0 in). Leveling by **2-axis quartz-flexure accelerometers,
  0.0001° resolution**; optical reference to **2 arc-seconds**.

### Rcal / shunt calibration — the direct EE tie-in ⚡
NASA verifies a bridge's output *electrically*, with a **shunt (Rcal) resistor across a bridge
arm** that simulates a known load — no hanging weights needed.

- Output estimate: `Rcal (volts) = (gage_res · exc · gain) / (gage_res + 2·rcal_res) / 2`
- Digital: `INCAL (counts) = Rcal_volts · 3200`
- Signal conditioning on a **Precision Filters PF2310** card; max output **±10.24 V**
  (= Preston A/D input limit) → **±32767 SDS counts**.
- "Creating shunt values" procedure: measure excitation at ±SENSE, take a **No-Load Zero**, apply
  the shunt across −Exc/−Sig, re-measure, subtract → mV, then normalize to **µV/volt**. Gear: HP3458A
  voltmeter, HP6612B supply.

> **Why you care:** this is the pro version of calibration. You calibrate by hanging known masses
> (dead-weight). NASA does that too, *plus* a shunt-resistor trick for a fast, repeatable electrical
> reference. Your HX711 has no hardware Rcal, but the idea — inject a known reference to pin down the
> scale factor — is the same one behind your `calibration_factor`.

### Taper pins (balance cable connectors — not the sting joint)
- Non-solder **force-insertion contacts** for balance wiring; *"years of fault-tolerant connection."*
- AMP **66071-3 (22 AWG)** / **66072-3 (20 AWG)**, brass, gold-over-nickel.
- Tools: crimp **90026**, insertion **380431-2** (pull-test spring, 12–13 lb trip) / **380430-2**,
  extraction **91012-1**. Strip wire to **0.218 in**, one steady stroke.
- (Distinct from the *tapered sting joint*, which needs ≥80% even contact per the customer guide.)

### Balance inventory
- Ames stocks **Internal** and **Semi-Span** balances.
- Actual **load capacities** + **electrical characteristics** (gage resistance, lead length,
  excitation) live in downloadable spreadsheets, not page text:
  - Inventory & Load Capacities: `nasa-ames-balance-inventory.xlsx`
  - Electrical Characteristics: `nasa-ames-balance-electrical-characteristics.xlsx`

### Borrowing a balance (logistics — advisor/PI lane, noted for completeness)
- NASA balances are **loaned for U.S.-Government-sponsored tests**; the requestor takes **full
  financial responsibility** and signs a **contract**; **≥1 month** lead before cal/test.
- Contacts: **Hiep Khuc** (Hiep.H.Khuc@nasa.gov), **James Bell**, Wind Tunnel Systems Branch Chief
  (James.H.Bell@nasa.gov), **Maureen Delgado**, Wind Tunnel Division Chief
  (Maureen.A.Delgado@nasa.gov, (650) 604-1620).

---

## 4. EE tie-ins (bench rig ↔ NASA practice) — for the slide / your understanding

| Your bench rig | NASA Ames equivalent |
|---|---|
| TAL220 bar / TAS501 S-beam load cell | Flexure with bonded strain gauges (same physics) |
| One cell = one axis | One balance block = **6 axes** (N/S/A force + P/Y/R moment) |
| Wheatstone bridge in each cell | Same — bridge output ∝ load |
| HX711 (24-bit ADC + amp) | Precision Filters PF2310 amp → Preston A/D → SDS (±10.24 V / ±32767 cts) |
| Hang known masses to calibrate | Dead-weight (0.5–1000 lb @ 0.03%) **+ shunt/Rcal** electrical cal |
| Single `calibration_factor` per cell | **BALFIT calibration matrix** (solves axis cross-talk) |
| Right-size the drag cell to expected load | Same rule: pick balance capacity to bracket expected loads, keep resolution |

---

## 5. Student-friendly color (from NASA's "Testing on the Ground" article)
- NFAC (the giant tunnels) is driven by **six 40-ft fans, 22,500 hp each**; its air intake is
  **football-field-sized**; the **80×120 ft** section fits **two Boeing 737s**.
- A Mars parachute tested there was **165+ ft long** (51-ft diameter).
- Engineers use **hot-pink pressure-sensitive paint** to see air forces on models.
- Models are fitted with **hundreds of pressure sensors and strain gauges** before a run.

---

## 6. Key references to cite (from the Balance Lab "Published Papers" + "Technical Notes")
- **AIAA R-091-2003** — *Recommended Practice for Calibration and Use of Internal Strain-Gage
  Balances with Application to Wind Tunnel Testing.* (the industry standard NASA follows)
- Ulbrich & Volden — *Strain-Gage Balance Calibration Analysis Using Automatically Selected Math
  Models* (AIAA 2005-4084) and the BALFIT software-tool papers (AIAA 2006-3434, 2007-0145, etc.).
- Parker et al. — *A Single-Vector Force Calibration Method* (AIAA 2001-0170).
- Roberts & Smith — *Flow-Through Force Measurement Balance* (AIAA 88-2059).
- NASA Ames tech notes: McMurchy 1977 (*max gage excitation voltage limits*), Laut 1976
  (*lubrication of balance & sting*), Smith 1972, Chabra 1963.

---

## 7. Source inventory (what was read vs. pending)

| URL | Type | Status |
|---|---|---|
| /nasa-ames-unitary-plan-wind-tunnel/ames-unitary-plan-wind-tunnel-11-by-11-foot-twt-test-section/ | Specs | ✅ read |
| /nasa-ames-unitary-plan-wind-tunnel/ames-unitary-plan-wind-tunnel-9-by-7-foot-swt-test-section/ | Specs | ✅ read |
| /nasa-ames-unitary-plan-wind-tunnel/ames-unitary-plan-wind-tunnel-overview/ | Overview | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-basics/ | Balance concept | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-calibration-laboratory-capabilities/ | Cal lab specs | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-calibration-rcal-resistor/ | Shunt/Rcal | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-calibration-creating-shunt-calibration-values/ | Shunt procedure | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-calibration-taper-pins/ | Taper pins | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-inventory/ | Inventory index | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-inventory/nasa-ames-balance-calibration-electrical/ | Electricals (XLSX) | ✅ read (data in spreadsheet) |
| /ames-balance-calibration-laboratory/nasa-ames-balance-calibration-laboratory-requests/.../submitting-request/ | Loan logistics | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-calibration-laboratory-published-papers/ | References | ✅ read |
| /ames-balance-calibration-laboratory/nasa-ames-balance-calibration-technical-notes/ | Tech notes | ✅ read |
| /centers-and-facilities/ames/testing-on-the-ground-before-you-fly-wind-tunnels-at-nasa-ames/ | Article | ✅ read |
| Balance Inventory & Load Capacities spreadsheet (nasa-ames-balance-inventory.xlsx) | XLSX | ⬜ not downloaded (has the actual capacity numbers) |
| taper-pins-installation / inspection-instructions / constant-conversion | Procedures | ⬜ pending (low priority) |
| /ames-balance-calibration-laboratory/ (home), /gallery/...balance-calibration-laboratory | Hub / photos | ⬜ pending |
| /ames-capabilities-facilities/, /ames-aeronautics-facilities/, /ames-fluid-mechanics-lab/, /aeronautics-at-ames/ | Context | ⬜ pending |
| /directorates/armd/aetc/ (+ 9x7 facility page), rotorcraft.arc.nasa.gov/.../windtunnels.html | Context/NFAC | ⬜ pending |
| Test Request Form & planning, contact, directions | Logistics | ⬜ pending (advisor/PI lane) |

The ⬜ pending pages were queued in the 28-agent scrape but got cut off by a session rate-limit
(resets 3:20 pm PT). They can be finished with WebFetch (no agents needed) or by resuming the workflow.

---

## 8. ⭐ External 3-axis load cells — the closest match to our rig (Dudley, 1985)

**NTRS 19870019113 — "Experimental Techniques for Three-Axis Load Cells used at the National
Full-Scale Aerodynamics Complex," M. R. Dudley, NASA Ames, 1985.**
Citation: https://ntrs.nasa.gov/citations/19870019113 · Full text:
https://archive.org/details/NASA_NTRS_Archive_19870019113

This describes the **40×80 external load-cell balance** — a model on *multiple discrete load cells*,
outputs combined into forces + moments. That is OUR architecture (not the internal sting balance),
so it is the best engineering reference we have.

### The data-reduction algorithm (what the Arduino should do)
1. **Per cell:** `Force = slope × (reading − zero) × CALCOR`
   (counts→force; `slope` from calibration; `zero` = no-load tare; `CALCOR` = lab RCAL / field RCAL).
2. **Sum forces across cells (model axes):** ΣAxial = **drag**, ΣNormal = **lift**, ΣSide = side.
3. **Moments = force × moment-arm (cross-product), summed:**
   `Pitch = Σ(F_axial·Z_arm − F_normal·X_arm)`, similar for roll/yaw.
   → Our deck's `pitch = (front−rear)×spacing/2` is the **symmetric two-cell special case** of this.

### Hardware specifics that match our rig
- **10 V bridge excitation**, **four-arm resistance strain-gage bridges** (same family as TAL220/TAS501).
- Signal path: amp (selectable gain) → RMDU at **3200/3333 counts per volt** → A/D. (Cf. our HX711's
  24-bit ADC; same job, different converter.)
- **Resistance / RCAL calibration:** *"a known precision resistor is placed across a leg of the strain-
  gage bridge"* — identical to the Balance-Lab shunt method; corrects supply drift + lead resistance.
- **Interaction (cross-talk) coefficients:** six per cell; apparent off-axis force is measured and
  subtracted. Our 3 mechanically-separated cells minimize this by design.
- **Accuracy:** ~0.1% (1-axis cell), ~0.3% (3-axis cell).
- **Temperature:** slope drifts ~ −0.00025/°F for 17-4 PH stainless (E drops with temp).

## 9. ⭐ Picking which balance to request for our model

Source: **NASA Ames Balance Inventory & Load Ranges** spreadsheet
(`nasa-ames-balance-inventory.xlsx`, linked from
https://www.nasa.gov/ames-balance-calibration-laboratory/nasa-ames-balance-inventory/ ).
Saved locally at `tmp/nasa/balance-inventory.xlsx`. Internal balances are grouped by **diameter**
(0.75 / 1.0 / 1.5 / 1.75 / 2.0 / 2.5 … up to 4.0 in). Columns: **NF** = normal force (≈ lift, lb),
**AF** = axial force (≈ drag, lb), **SF** = side force (lb), **PM** = pitch moment (in-lb),
**YM** = yaw (in-lb), **RM** = roll (in-lb).

### How to choose (same logic as picking an ADC range or a load-cell rating)
1. **Estimate the model's loads at test conditions** (body axes):
   - Lift ≈ `q·S·CL`, Drag ≈ `q·S·CD`, Pitch ≈ `q·S·c̄·Cm`
   - `q = ½ρV²` (tunnel dynamic pressure), `S` = model wing area, `c̄` = mean chord.
2. **Match to the smallest balance whose every-component limit brackets your loads** — aim for your
   max load ≈ **50–80% of that component's full-scale** (good resolution + headroom for tares,
   transients/start loads, and combined-load interaction). Never exceed ANY component limit.
3. **Check it physically fits**: balance **diameter ≤ the model's internal cavity**, and it matches an
   available sting/taper. (0.75 in is the smallest — the model needs ≥0.75 in inside.)
4. **Confirm** availability + calibration with the Balance Cal Lab (Balance Request Form, ≥1 month).
   They size/loan the balance; we just bring the load estimate.

### The smallest balances (0.75 in — the relevant range for a scaled glider)
| Balance | NF (lift, lb) | AF (drag, lb) | PM (pitch, in-lb) | SF (lb) |
|---|---|---|---|---|
| Mk12A/B, Mk32A/B | 10 | 10 | 10.2 | 5 |
| Mk20A/B/C | 50 | 50 | 51 | 25 |
| Mk15A / Mk18A / Mk33A / Mk34A / Mk41A | 200 | 20–60 | 300 | 100 |
| Mk29A/B | 400 | 30–100 | 600 | 200 |
| (1.0 in) Mk4A | 250 | 250 | 256 | 250 |

### Worked example (illustrative — needs real scaled size + Mach to finalize)
Scaled Fox, wing area `S ≈ 0.1 m²`, mean chord `c̄ ≈ 0.15 m`, test speed `V ≈ 50 m/s`
→ `q = ½·1.2·50² ≈ 1500 Pa`. With CL≈1.2, CD≈0.05, Cm≈0.1:
- Lift ≈ 1500·0.1·1.2 ≈ **180 N ≈ 40 lb** → drives the choice (normal force).
- Drag ≈ 1500·0.1·0.05 ≈ **7.5 N ≈ 1.7 lb**.
- Pitch ≈ 1500·0.1·0.15·0.1 ≈ **2.3 N·m ≈ 20 in-lb**.
→ A 0.75 in balance with **NF ≈ 50–200 lb** (e.g. **Mk20A** at NF 50, or **Mk33A/Mk41A** at NF 200
for more headroom) brackets this; AF and PM limits are easily satisfied. A 400 lb balance would put
our 40 lb lift at only ~10% FS → wasted resolution, so don't oversize (same mistake as the 200 kg
drag cell on our bench rig).

> **What to bring to the grad student:** the scaled model's **wing area, mean chord, and the test
> Mach/q**, so the loads above can be computed for real — then point the Balance Cal Lab at a 0.75 in
> balance in the NF ≈ 50–200 lb class.

### Validations + cautions for our build
- *"The third load cell is permitted to slide on the pin to allow for [thermal] growth"* —
  validates our **horizontal-compliance / floating** element.
- *"Wires [must] not be draped across [the] metric joint, or unmeasured interference forces can
  result"* — route HX711 leads so they don't bridge the moving plate to the fixed frame.
- **Side force is unreliable** — hysteresis loops (~600 kg on heavy models) + strut-deflection error;
  trust **drag (axial)** and **lift (normal)**, treat side force as noisy.
- **Preload/zero shift:** model dead weight shifts the zero; record tares and subtract.
