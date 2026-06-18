# Real product models (drop-in)

The 3D scene uses hand-built (procedural) parts by default. To replace any part
with the **exact real product mesh**, drop a glTF binary here and enable it.

## Steps

1. Put the file in this folder with the matching name:

   | Part | File |
   |------|------|
   | SparkFun HX711 amp | `hx711.glb` |
   | TAL220 bar load cell | `tal220.glb` |
   | TAS501 S-type load cell | `tas501.glb` |
   | FMS Fox glider | `fox.glb` |

2. In `src/main.jsx`, find `PART_MODELS` and set `enabled: true` for that part.
   - `fit` = longest-axis size in scene units (1 unit = 100 mm), so the mesh is
     auto-scaled to the right size. e.g. HX711 `fit: 0.34` ≈ 34 mm.
   - `rot: [x, y, z]` (radians) re-orients the mesh if it imports facing the
     wrong way — no need to edit the geometry.

3. Save. The deck swaps the procedural part for the real model automatically;
   if the file is missing it silently falls back to the procedural one.

## Where to get accurate meshes

- **Generate from the real photos** (license-clean): enable *Hyper3D Rodin* in
  the BlenderMCP panel, then it can be generated from `src/assets/*.jpg`.
- **Sketchfab**: enable *Sketchfab* in the BlenderMCP panel (community models,
  check each model's license / add attribution).
- **Vendor CAD**: SparkFun publishes the HX711 board design; load-cell vendors
  (HT Sensor) publish STEP files — convert STEP → glTF in Blender/FreeCAD.

Keep files small (Draco-compress if large) so the deck stays fast.
