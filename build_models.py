"""Headless Blender build of accurate load-cell parts -> glTF for the web deck.

Run:  blender --background --factory-startup --python build_models.py
Each part is built in an isolated scene with real booleans (bored holes/slots),
bevels, PBR materials and silkscreen text, then exported to public/models/*.glb.
Dimensions are in mm; the deck auto-scales each model to its `fit` size.
"""
import bpy
import math
import os

OUT = r"D:\Coding\Codex\Load Cell Presentation\public\models"
os.makedirs(OUT, exist_ok=True)


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.objects):
        for b in list(coll):
            try:
                coll.remove(b)
            except Exception:
                pass


def mat(name, color, metallic=0.0, rough=0.5, emis=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    if emis is not None:
        try:
            b.inputs['Emission Color'].default_value = (emis[0], emis[1], emis[2], 1.0)
            b.inputs['Emission Strength'].default_value = 0.6
        except Exception:
            pass
    return m


def active(o):
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def box(name, sx, sy, sz, loc=(0, 0, 0), m=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        md = o.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = 4
        active(o)
        bpy.ops.object.modifier_apply(modifier=md.name)
    if m:
        o.data.materials.append(m)
    return o


def cyl(name, r, depth, loc=(0, 0, 0), axis='Z', m=None, verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    if axis == 'X':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'Y':
        o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    if m:
        o.data.materials.append(m)
    return o


def subtract(target, cutter):
    active(target)
    md = target.modifiers.new('bool', 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.solver = 'EXACT'
    md.object = cutter
    bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def text(body, loc, size, m, rot=(0, 0, 0)):
    cu = bpy.data.curves.new('t', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = 0.06
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    o = bpy.data.objects.new('text', cu)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    if m:
        o.data.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT')
    active(o)
    bpy.ops.object.convert(target='MESH')
    return o


def shade_smooth_all():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        return
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = meshes[0]
    # auto-smooth: round the bevels/cylinders but keep machined faces crisp
    try:
        bpy.ops.object.shade_auto_smooth(angle=0.5236)
    except Exception:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass
    bpy.ops.object.select_all(action='DESELECT')


def export(name):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, name + '.glb'),
        export_format='GLB',
        use_selection=True,
    )
    print('EXPORTED', name)


# ---------------------------------------------------------------- HX711 -------
def build_hx711():
    clear()
    pcb_red = mat('pcbRed', (0.7, 0.06, 0.09), 0.0, 0.3)
    chip = mat('chip', (0.04, 0.04, 0.05), 0.3, 0.45)
    gold = mat('gold', (0.83, 0.62, 0.2), 0.95, 0.28)
    tin = mat('tin', (0.74, 0.76, 0.8), 0.85, 0.3)
    silk = mat('silk', (0.94, 0.94, 0.94), 0.0, 0.6, emis=(0.4, 0.4, 0.4))
    tan = mat('cap', (0.76, 0.64, 0.46), 0.05, 0.6)

    pcb = box('pcb', 34, 21, 1.6, (0, 0, 0), pcb_red, bevel=0.5)
    for (x, y) in [(-13, 7.5), (13, -7.5)]:
        subtract(pcb, cyl('h', 1.6, 6, (x, y, 0), 'Z'))

    # HX711 SOIC-16 chip, proud of the board, toward -X
    box('chip', 10, 4, 1.2, (-7.5, 0, 0.8 + 0.6), chip, bevel=0.12)
    # leads
    for i in range(8):
        lx = -7.5 - 4.45 + i * 1.27
        box('lead', 0.5, 1.4, 0.2, (lx, 2.6, 0.95), tin)
        box('lead', 0.5, 1.4, 0.2, (lx, -2.6, 0.95), tin)
    # electrolytic cap + passives
    cyl('cap', 1.7, 3.0, (-13, 4.5, 0.8 + 1.5), 'Z', tan)
    for (x, y) in [(0.5, 2.2), (3, -1.4), (4.8, 3), (-1, -3)]:
        box('mlcc', 1.8, 1.0, 0.8, (x, y, 0.8 + 0.4), tan)
    for (x, y) in [(7.5, -3), (10, 1.8), (5.5, 5.2)]:
        box('res', 1.6, 0.8, 0.6, (x, y, 0.8 + 0.3), chip)

    # headers: 6 pins on +Y edge, 5 pins on -Y edge (the 6-vs-5 tell)
    box('hdr6', 6 * 2.54, 2.4, 1.0, (0, 9.0, 0.8 + 0.5), chip)
    box('hdr5', 5 * 2.54, 2.4, 1.0, (0, -9.0, 0.8 + 0.5), chip)
    for i in range(6):
        px = -(5 * 2.54) / 2 + i * 2.54
        cyl('pin', 0.42, 4.4, (px, 9.0, 0.8 + 2.2), 'Z', gold, verts=12)
    for i in range(5):
        px = -(4 * 2.54) / 2 + i * 2.54
        cyl('pin', 0.42, 4.4, (px, -9.0, 0.8 + 2.2), 'Z', gold, verts=12)
    # silver oscillator can + pin-1 dot on the chip
    box('xtal', 3.4, 1.8, 1.1, (3.5, 5.0, 0.8 + 0.55), tin, bevel=0.25)
    cyl('pin1', 0.45, 0.2, (-11.4, -1.4, 0.8 + 1.22), 'Z', silk, verts=10)

    # silkscreen text on the top face
    top = 0.8 + 0.05
    text('SparkFun', (11, 0, top), 2.4, silk)
    text('HX711', (-7.5, 0, 0.8 + 1.2 + 0.04), 1.7, silk)
    text('E+ E- A- A+ B- B+', (0, 6.6, top), 1.5, silk)
    text('GND DAT CLK VCC VDD', (0, -6.6, top), 1.4, silk)

    shade_smooth_all()
    export('hx711')


# --------------------------------------------------------------- TAL220 -------
def build_tal220():
    clear()
    alu = mat('alu', (0.82, 0.84, 0.86), 0.9, 0.3)
    dark = mat('hole', (0.13, 0.15, 0.18), 0.4, 0.5)
    gauge = mat('gauge', (0.13, 0.42, 0.78), 0.2, 0.4)
    silk = mat('silk', (0.94, 0.94, 0.94), 0.0, 0.6, emis=(0.4, 0.4, 0.4))

    # Body 80 x 12.7 x 12.7, long axis along X
    bar = box('bar', 80, 12.7, 12.7, (0, 0, 0), alu, bevel=0.8)

    # Figure-8 flexure: two bores + waist slot cut through the depth (Y)
    subtract(bar, cyl('b1', 4.3, 16, (-13, 0, 0), 'Y'))
    subtract(bar, cyl('b2', 4.3, 16, (13, 0, 0), 'Y'))
    subtract(bar, box('slot', 26, 16, 2.0, (0, 0, 0)))

    # Mounting holes: M5 pair one end, M4 pair other end (through Z)
    for x in (-33, 33):
        r = 2.5 if x < 0 else 2.0
        subtract(bar, cyl('m', r, 16, (x, 4, 0), 'Z'))
        subtract(bar, cyl('m', r, 16, (x, -4, 0), 'Z'))

    # blue gauge marking + domed silicone sealant over the thinned section
    box('pad', 18, 8, 0.5, (0, 0, 6.35 + 0.15), gauge)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(0, 0, 6.35))
    dome = bpy.context.active_object
    dome.name = 'seal'
    dome.scale = (11, 4.6, 2.2)
    bpy.ops.object.transform_apply(scale=True)
    dome.data.materials.append(mat('seal', (0.85, 0.82, 0.62), 0.0, 0.5))
    # spec sticker
    text('TAL220  10kg', (24, 0, 6.35 + 0.1), 2.0, silk, rot=(0, 0, math.radians(90)))

    shade_smooth_all()
    export('tal220')


# --------------------------------------------------------------- TAS501 -------
def build_tas501():
    clear()
    steel = mat('steel', (0.78, 0.81, 0.85), 0.92, 0.28)
    dark = mat('hole', (0.13, 0.15, 0.18), 0.4, 0.5)
    drag = mat('drag', (0.78, 0.22, 0.26), 0.2, 0.45)
    white = mat('label', (0.95, 0.95, 0.95), 0.0, 0.55)
    ink = mat('ink', (0.1, 0.13, 0.22), 0.0, 0.6, emis=(0.05, 0.05, 0.1))

    # Flat S-plate: X=76 (load axis), Y=16 (depth, thin), Z=51 (height).
    # After glTF Y-up: X=76, Y=51 height, Z=16 depth -> stands upright; the
    # front face (glTF +Z) is Blender -Y, so the label goes on the -Y side.
    body = box('body', 76, 16, 51, (0, 0, 0), steel, bevel=0.6)

    # Two slots opening from alternating edges leave the S-shaped web:
    # upper slot opens the TOP edge (+Z), offset +X; lower opens BOTTOM (-Z), -X.
    subtract(body, box('s1', 34, 22, 15, (9, 0, 21)))
    subtract(body, box('s2', 34, 22, 15, (-9, 0, -21)))
    # small stress-relief holes at the inner slot ends (through depth Y)
    for (x, z) in [(-8, 13.5), (8, -13.5)]:
        subtract(body, cyl('sr', 2.6, 22, (x, 0, z), 'Y'))
    # M12 axial bores on the load axis (through X at each end)
    subtract(body, cyl('m12a', 6, 22, (33, 0, 0), 'X'))
    subtract(body, cyl('m12b', 6, 22, (-33, 0, 0), 'X'))

    # gauge web accent (center) + white spec label on the front (glTF +Z = -Y)
    box('web', 14, 1.2, 14, (0, 8.0, 0), drag)
    box('label', 42, 0.6, 28, (0, -8.0, 0), white, bevel=0.3)
    text('TAS501', (0, -8.7, 9), 4.2, ink, rot=(math.radians(-90), 0, 0))
    text('200kg  C3', (0, -8.7, 1), 3.2, ink, rot=(math.radians(-90), 0, 0))
    text('HT Sensor', (0, -8.7, -7), 3.0, ink, rot=(math.radians(-90), 0, 0))

    shade_smooth_all()
    export('tas501')


build_hx711()
build_tal220()
build_tas501()
print('ALL DONE')
