"""
Flask backend for Abaqus ODB Field Output Extraction GUI.
Provides APIs for file browsing, ODB scanning, script generation, and execution.
"""

import json
import mimetypes
import os
import subprocess
import sys
import tempfile
import threading
import time
import queue
from pathlib import Path

from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS

# Fix MIME types on Windows (Python may serve .js as text/plain)
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# Global state for running process
_process = None
_process_lock = threading.Lock()
_log_queue = queue.Queue()
_run_start_time = None
_run_status = "idle"  # idle, running, completed, failed, cancelled


# ============================================================================
# FILE BROWSING (uses tkinter dialogs)
# ============================================================================

@app.route("/api/browse-file", methods=["POST"])
def browse_file():
    """Open a native file dialog to select an ODB file."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        file_path = filedialog.askopenfilename(
            title="Select Abaqus ODB File",
            filetypes=[("Abaqus ODB files", "*.odb"), ("All files", "*.*")],
        )
        root.destroy()
        return jsonify({"path": file_path if file_path else ""})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/browse-dir", methods=["POST"])
def browse_dir():
    """Open a native directory dialog."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        initial_dir = request.json.get("initialDir", "")
        dir_path = filedialog.askdirectory(
            title="Select Output Directory",
            initialdir=initial_dir if initial_dir else None,
        )
        root.destroy()
        return jsonify({"path": dir_path if dir_path else ""})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# ABAQUS DETECTION
# ============================================================================

ABAQUS_SEARCH_PATHS = [
    "abaqus",
    # Common SIMULIA installations (various versions)
    r"C:\SIMULIA\Abaqus\Commands\abaqus.bat",
    r"C:\SIMULIA\Commands\abaqus.bat",
    r"C:\SIMULIA\EstProducts\Commands\abaqus.bat",
    # Abaqus 2020-2025 (Dassault Systemes newer layout)
    r"C:\Program Files\Dassault Systemes\SimulationServices\V6R2023\win_b64\code\bin\ABQLauncher.exe",
    r"C:\Program Files\Dassault Systemes\SimulationServices\V6R2024\win_b64\code\bin\ABQLauncher.exe",
    r"C:\Program Files\Dassault Systemes\SimulationServices\V6R2025\win_b64\code\bin\ABQLauncher.exe",
    r"C:\Program Files\Dassault Systemes\SimulationServices\V6R2022\win_b64\code\bin\ABQLauncher.exe",
    r"C:\Program Files\Dassault Systemes\SimulationServices\V6R2021\win_b64\code\bin\ABQLauncher.exe",
    r"C:\Program Files\Dassault Systemes\SimulationServices\V6R2020\win_b64\code\bin\ABQLauncher.exe",
    r"C:\Program Files\Dassault Systemes\SimulationServices\V6R2014\win_b64\code\bin\ABQLauncher.exe",
]


@app.route("/api/detect-abaqus", methods=["POST"])
def detect_abaqus():
    """Try to auto-detect Abaqus installation."""
    custom_path = request.json.get("customPath", "")
    paths_to_try = [custom_path] if custom_path else ABAQUS_SEARCH_PATHS

    for abaqus_cmd in paths_to_try:
        if not abaqus_cmd:
            continue
        try:
            use_shell = sys.platform == "win32" and abaqus_cmd.lower().endswith(".bat")
            cmd = [abaqus_cmd, "information=release"]
            if use_shell:
                cmd = subprocess.list2cmdline(cmd)
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, timeout=15,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
                shell=use_shell,
            )
            output = result.stdout + result.stderr
            if "Abaqus" in output or "abaqus" in output.lower():
                version_line = ""
                for line in output.splitlines():
                    if "abaqus" in line.lower() and any(c.isdigit() for c in line):
                        version_line = line.strip()
                        break
                return jsonify({
                    "found": True,
                    "path": abaqus_cmd,
                    "version": version_line or "Abaqus detected",
                    "output": output.strip()[:500],
                })
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue

    return jsonify({"found": False, "error": "Abaqus not found. Please specify the path manually."})


# ============================================================================
# ODB PROBE / SCAN
# ============================================================================

PROBE_SCRIPT_TEMPLATE = r'''# Auto-generated ODB probe script for Abaqus Python 2.7
# Usage: abaqus cae noGUI=probe_odb.py
import json
import os
import sys

from odbAccess import *

ODB_PATH = r'{odb_path}'
OUTPUT_JSON = r'{output_json}'

print('Opening ODB for scanning: %s' % ODB_PATH)
odb = openOdb(path=ODB_PATH, readOnly=True)

result = {{
    'instances': [],
    'elementSets': [],
    'steps': [],
    'fieldOutputs': [],
    'boundingBox': None,
}}

# Instance names
for inst_name in odb.rootAssembly.instances.keys():
    result['instances'].append(inst_name)

# Element sets - rootAssembly level
ra_keys = list(odb.rootAssembly.elementSets.keys())
for k in ra_keys:
    elset = odb.rootAssembly.elementSets[k]
    count = 0
    try:
        first = elset.elements[0]
        if hasattr(first, 'label'):
            count = len(elset.elements)
        else:
            for arr in elset.elements:
                count += len(arr)
    except Exception:
        pass
    result['elementSets'].append({{
        'name': k,
        'source': 'rootAssembly',
        'elementCount': count,
    }})

# Element sets - instance level
for inst_name in odb.rootAssembly.instances.keys():
    inst = odb.rootAssembly.instances[inst_name]
    inst_keys = list(inst.elementSets.keys())
    for k in inst_keys:
        elset = inst.elementSets[k]
        count = 0
        try:
            first = elset.elements[0]
            if hasattr(first, 'label'):
                count = len(elset.elements)
            else:
                for arr in elset.elements:
                    count += len(arr)
        except Exception:
            pass
        result['elementSets'].append({{
            'name': '%s.%s' % (inst_name, k),
            'source': 'instance',
            'elementCount': count,
        }})

# Steps and frames
for step_name in odb.steps.keys():
    step = odb.steps[step_name]
    result['steps'].append({{
        'name': step_name,
        'frameCount': len(step.frames),
        'totalTime': step.totalTime,
    }})

# Field outputs (from the first step's last frame)
step_keys = list(odb.steps.keys())
if step_keys:
    first_step = odb.steps[step_keys[0]]
    if len(first_step.frames) > 0:
        frame = first_step.frames[-1]
        for fo_key in frame.fieldOutputs.keys():
            fo = frame.fieldOutputs[fo_key]
            comps = list(fo.componentLabels) if fo.componentLabels else []
            # Check available invariants
            invariants = []
            inv_names = ['mises', 'tresca', 'press', 'inv3',
                         'maxPrincipal', 'midPrincipal', 'minPrincipal',
                         'maxInPlanePrincipal', 'minInPlanePrincipal',
                         'outOfPlanePrincipal']
            if len(fo.values) > 0:
                fv0 = fo.values[0]
                for inv_attr in inv_names:
                    try:
                        val = getattr(fv0, inv_attr, None)
                        if val is not None:
                            invariants.append(inv_attr)
                    except Exception:
                        pass

            # Detect if nodal
            is_nodal = False
            if len(fo.values) > 0:
                fv0 = fo.values[0]
                if (hasattr(fv0, 'nodeLabel') and fv0.nodeLabel is not None and
                    (not hasattr(fv0, 'elementLabel') or fv0.elementLabel is None or
                     fv0.elementLabel == 0)):
                    is_nodal = True

            result['fieldOutputs'].append({{
                'key': fo_key,
                'description': fo.description if hasattr(fo, 'description') else '',
                'components': comps,
                'invariants': invariants,
                'isNodal': is_nodal,
            }})

# Bounding box from first instance nodes
if result['instances']:
    inst = odb.rootAssembly.instances[result['instances'][0]]
    x_min, x_max = 1e30, -1e30
    y_min, y_max = 1e30, -1e30
    z_min, z_max = 1e30, -1e30
    for node in inst.nodes:
        c = node.coordinates
        if c[0] < x_min: x_min = c[0]
        if c[0] > x_max: x_max = c[0]
        if c[1] < y_min: y_min = c[1]
        if c[1] > y_max: y_max = c[1]
        if len(c) > 2:
            if c[2] < z_min: z_min = c[2]
            if c[2] > z_max: z_max = c[2]
    result['boundingBox'] = {{
        'xMin': x_min, 'xMax': x_max,
        'yMin': y_min, 'yMax': y_max,
        'zMin': z_min if z_min < 1e29 else 0,
        'zMax': z_max if z_max > -1e29 else 0,
    }}

odb.close()
print('ODB scan complete.')

# Write JSON output
with open(OUTPUT_JSON, 'w') as f:
    json.dump(result, f, indent=2)

print('Results written to: %s' % OUTPUT_JSON)
'''


@app.route("/api/scan-odb", methods=["POST"])
def scan_odb():
    """Generate and run the ODB probe script, return metadata."""
    data = request.json
    odb_path = data.get("odbPath", "")
    abaqus_cmd = data.get("abaqusPath", "abaqus")

    if not odb_path or not os.path.isfile(odb_path):
        return jsonify({"error": "ODB file not found: %s" % odb_path}), 400

    # Create temp files for probe script and JSON output
    temp_dir = tempfile.mkdtemp(prefix="abq_probe_")
    probe_script = os.path.join(temp_dir, "probe_odb.py")
    output_json = os.path.join(temp_dir, "odb_metadata.json")

    # Generate probe script
    script_content = PROBE_SCRIPT_TEMPLATE.format(
        odb_path=odb_path.replace("\\", "\\\\"),
        output_json=output_json.replace("\\", "\\\\"),
    )
    with open(probe_script, "w") as f:
        f.write(script_content)

    # Run probe script via Abaqus
    try:
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        use_shell = sys.platform == "win32" and abaqus_cmd.lower().endswith(".bat")
        cmd = [abaqus_cmd, "cae", "noGUI=%s" % probe_script]
        if use_shell:
            cmd = subprocess.list2cmdline(cmd)
        result = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=300,
            cwd=temp_dir, creationflags=flags, shell=use_shell,
        )

        if not os.path.isfile(output_json):
            return jsonify({
                "error": "Probe script did not produce output. Abaqus output:\n%s\n%s"
                         % (result.stdout[-2000:], result.stderr[-2000:])
            }), 500

        with open(output_json, "r") as f:
            metadata = json.load(f)

        return jsonify(metadata)

    except subprocess.TimeoutExpired:
        return jsonify({"error": "ODB scan timed out after 5 minutes."}), 500
    except FileNotFoundError:
        return jsonify({"error": "Abaqus command not found: %s" % abaqus_cmd}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up temp files
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


# ============================================================================
# SCRIPT GENERATION
# ============================================================================

EXTRACTION_SCRIPT_TEMPLATE = r'''# ============================================================================
# Abaqus Python Script: Extract Field Outputs from Multiple Regions
# Auto-generated by Abaqus ODB Extractor
# Usage: abaqus cae noGUI=extract_region_sweep.py
#        or: abaqus python extract_region_sweep.py
#        or inside CAE: File > Run Script
# Compatible with Abaqus Python 2.7 (Abaqus 6.14+)
# ============================================================================

from odbAccess import *
from abaqusConstants import *
import os
import sys
import time
import json

# ============================================================================
# USER CONFIGURATION (Auto-Generated)
# ============================================================================

ODB_PATH = r'{odb_path}'
OUTPUT_DIR = r'{output_dir}'
INSTANCE_NAME = '{instance_name}'

MODEL_WIDTH_X  = {model_width}    # mm
MODEL_HEIGHT_Y = {model_height}    # mm

ELEMENT_SET_NAMES = [
{element_sets}
]

REGIONS = [
{regions}
]

X_LABELS = {x_labels}
Y_LABELS = {y_labels}
IS_2D_SWEEP = {is_2d}

OUTPUTS_TO_EXTRACT = [
{outputs}
]

STEPS_TO_EXTRACT = {steps_config}
FRAME_SELECTION  = '{frame_selection}'

# ============================================================================
# INVARIANT AND COMPONENT HELPERS
# ============================================================================

INVARIANT_MAP = {{
    'Mises':                    MISES,
    'Tresca':                   TRESCA,
    'Press':                    PRESS,
    'INV3':                     INV3,
    'Max. Principal':           MAX_PRINCIPAL,
    'Mid. Principal':           MID_PRINCIPAL,
    'Min. Principal':           MIN_PRINCIPAL,
    'Max. In-Plane Principal':  MAX_INPLANE_PRINCIPAL,
    'Min. In-Plane Principal':  MIN_INPLANE_PRINCIPAL,
    'Out-of-Plane Principal':   OUTOFPLANE_PRINCIPAL,
    'Magnitude':                MAGNITUDE,
}}

INVARIANT_ATTR = {{
    'Mises':                    'mises',
    'Tresca':                   'tresca',
    'Press':                    'press',
    'INV3':                     'inv3',
    'Max. Principal':           'maxPrincipal',
    'Mid. Principal':           'midPrincipal',
    'Min. Principal':           'minPrincipal',
    'Max. In-Plane Principal':  'maxInPlanePrincipal',
    'Min. In-Plane Principal':  'minInPlanePrincipal',
    'Out-of-Plane Principal':   'outOfPlanePrincipal',
    'Magnitude':                'magnitude',
}}


def is_invariant(comp_or_inv):
    return comp_or_inv in INVARIANT_MAP


def extract_value(fv, comp_or_inv, field_output):
    """Extract scalar value from a FieldValue."""
    if comp_or_inv is None:
        return fv.data

    if is_invariant(comp_or_inv):
        attr_name = INVARIANT_ATTR[comp_or_inv]
        return getattr(fv, attr_name)

    comp_labels = field_output.componentLabels
    if comp_or_inv in comp_labels:
        idx = comp_labels.index(comp_or_inv)
        return fv.data[idx]
    return None


# ============================================================================
# MAIN
# ============================================================================

print('=' * 70)
print('  ABAQUS FIELD OUTPUT EXTRACTION - REGION SWEEP')
print('  Auto-generated by Abaqus ODB Extractor')
print('=' * 70)

start_time = time.time()

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
    print('\nCreated output directory: %s' % OUTPUT_DIR)

print('\nOpening ODB: %s' % ODB_PATH)
odb = openOdb(path=ODB_PATH, readOnly=True)

instance = odb.rootAssembly.instances[INSTANCE_NAME.upper()]

# Build node coordinate map
print('\nBuilding node coordinate map...')
node_coord_map = {{}}
for node in instance.nodes:
    node_coord_map[node.label] = node.coordinates
print('  Nodes indexed: %d' % len(node_coord_map))

# Cache element set keys (Abaqus 6.14 safe)
ra_elset_keys = list(odb.rootAssembly.elementSets.keys())
inst_elset_keys = list(instance.elementSets.keys())

ra_elset_dict = {{}}
for k in ra_elset_keys:
    ra_elset_dict[k] = k
    ra_elset_dict[k.upper()] = k

inst_elset_dict = {{}}
for k in inst_elset_keys:
    inst_elset_dict[k] = k
    inst_elset_dict[k.upper()] = k

# Determine steps
if STEPS_TO_EXTRACT == 'ALL':
    step_names = list(odb.steps.keys())
else:
    step_names = STEPS_TO_EXTRACT

total_regions = len(REGIONS)
total_elsets = len(ELEMENT_SET_NAMES)

print('\nSteps to process (%d): %s' % (len(step_names), ', '.join(step_names)))
print('Regions to process: %d' % total_regions)
print('Element sets to process: %d' % total_elsets)
print('Output variables: %d' % len(OUTPUTS_TO_EXTRACT))
print('2D sweep: %s' % ('Yes' if IS_2D_SWEEP else 'No'))

header_labels = [out[2] for out in OUTPUTS_TO_EXTRACT]

# ============================================================================
# PRE-COMPUTE: element centroids and connectivity (ONE pass over all elements)
# ============================================================================
print('\nPre-computing element centroids (single pass)...')
precomp_start = time.time()
elem_centroid = {{}}   # label -> (cx, cy)
elem_node_map = {{}}   # label -> list of node labels
for elem in instance.elements:
    connectivity = elem.connectivity
    n_nodes = len(connectivity)
    cx, cy = 0.0, 0.0
    for nLabel in connectivity:
        coords = node_coord_map[nLabel]
        cx += coords[0]
        cy += coords[1]
    cx /= n_nodes
    cy /= n_nodes
    elem_centroid[elem.label] = (cx, cy)
    elem_node_map[elem.label] = list(connectivity)
print('  Elements pre-computed: %d (%.1f sec)' % (len(elem_centroid), time.time() - precomp_start))

sys.stdout.flush()


def find_element_set(set_name):
    """Find element set by name with multiple lookup strategies."""
    if '.' in set_name:
        inst_part, set_part = set_name.rsplit('.', 1)
    else:
        inst_part = INSTANCE_NAME
        set_part = set_name

    candidates_ra = [set_name, set_name.upper(),
                     '%s.%s' % (inst_part.upper(), set_part.upper()),
                     set_part, set_part.upper()]
    candidates_inst = [set_part, set_part.upper(), set_name, set_name.upper()]

    for candidate in candidates_ra:
        if candidate in ra_elset_dict:
            actual_key = ra_elset_dict[candidate]
            return odb.rootAssembly.elementSets[actual_key], actual_key

    for candidate in candidates_inst:
        if candidate in inst_elset_dict:
            actual_key = inst_elset_dict[candidate]
            return instance.elementSets[actual_key], actual_key

    # Partial match
    set_part_upper = set_part.upper()
    for k in ra_elset_keys:
        if k.upper().endswith(set_part_upper):
            return odb.rootAssembly.elementSets[k], k
    for k in inst_elset_keys:
        if k.upper().endswith(set_part_upper):
            return instance.elementSets[k], k

    return None, None


def get_element_labels(elset):
    """Collect element labels from an element set."""
    labels = set()
    try:
        first_item = elset.elements[0]
        if hasattr(first_item, 'label'):
            for elem in elset.elements:
                labels.add(elem.label)
        elif hasattr(first_item, '__iter__') or hasattr(first_item, '__getitem__'):
            for elemArray in elset.elements:
                for elem in elemArray:
                    labels.add(elem.label)
        else:
            for elem in elset.elements:
                labels.add(elem.label)
    except (TypeError, IndexError):
        for item in elset.elements:
            if hasattr(item, 'label'):
                labels.add(item.label)
            else:
                for elem in item:
                    labels.add(elem.label)
    return labels


# ============================================================================
# PROCESS EACH ELEMENT SET
# ============================================================================

total_csv_files = 0

for elset_name in ELEMENT_SET_NAMES:
    print('\n' + '=' * 70)
    print('Processing Element Set: %s' % elset_name)
    print('=' * 70)

    elset, found_key = find_element_set(elset_name)
    if elset is None:
        print('*** ERROR: Element set "%s" not found! Skipping. ***' % elset_name)
        continue

    print('  Found as: "%s"' % found_key)
    elset_element_labels = get_element_labels(elset)
    print('  Total elements in set: %d' % len(elset_element_labels))

    # -----------------------------------------------------------------
    # PRE-ASSIGN elements to regions (single pass over elset elements)
    # -----------------------------------------------------------------
    print('  Assigning elements to %d regions...' % total_regions)
    assign_start = time.time()

    # region_idx -> set of element labels
    region_elem_map = {{}}
    # region_idx -> set of node labels
    region_node_map = {{}}
    for ri in range(total_regions):
        region_elem_map[ri] = set()
        region_node_map[ri] = set()

    for elabel in elset_element_labels:
        if elabel not in elem_centroid:
            continue
        cx, cy = elem_centroid[elabel]
        nodes = elem_node_map[elabel]
        for ri, region_info in enumerate(REGIONS):
            if (region_info['x_min'] <= cx <= region_info['x_max'] and
                region_info['y_min'] <= cy <= region_info['y_max']):
                region_elem_map[ri].add(elabel)
                for nLabel in nodes:
                    region_node_map[ri].add(nLabel)

    assign_time = time.time() - assign_start
    non_empty = sum([1 for ri in range(total_regions) if len(region_elem_map[ri]) > 0])
    print('  Region assignment done: %d/%d non-empty (%.1f sec)' % (non_empty, total_regions, assign_time))
    sys.stdout.flush()

    # -----------------------------------------------------------------
    # EXTRACT: iterate steps/frames ONCE, gather data for ALL regions
    # -----------------------------------------------------------------
    # Instead of looping regions->steps->frames->fieldValues, we loop
    # steps->frames->fieldValues ONCE and bucket into all matching regions.
    # -----------------------------------------------------------------
    print('  Extracting field outputs across all regions...')
    extract_start = time.time()

    # Build element-to-regions and node-to-regions lookup
    elem_to_regions = {{}}
    node_to_regions = {{}}
    for ri in range(total_regions):
        for el in region_elem_map[ri]:
            elem_to_regions.setdefault(el, []).append(ri)
        for nl in region_node_map[ri]:
            node_to_regions.setdefault(nl, []).append(ri)

    # Storage: (region_idx, step_name, frame_idx) -> {{label: (max_val, min_val)}}
    results = {{}}
    frame_meta = {{}}  # (step_name, frame_idx) -> (frame_time, total_time)

    cumulative_time = 0.0
    for si, step_name in enumerate(step_names):
        step = odb.steps[step_name]

        if FRAME_SELECTION == 'LAST':
            frames_to_process = [step.frames[-1]]
        else:
            frames_to_process = list(step.frames)

        print('    Step %d/%d: %-12s | Frames: %d' % (si + 1, len(step_names), step_name, len(frames_to_process)))
        sys.stdout.flush()

        for frame in frames_to_process:
            frame_idx  = frame.frameId
            frame_time = frame.frameValue
            total_time = cumulative_time + frame_time
            frame_meta[(step_name, frame_idx)] = (frame_time, total_time)

            # Initialize results for all non-empty regions
            for ri in range(total_regions):
                if len(region_elem_map[ri]) == 0:
                    continue
                key = (ri, step_name, frame_idx)
                results[key] = {{}}
                for label in header_labels:
                    results[key][label] = (None, None)  # (max, min)

            for (field_key, comp_or_inv, label) in OUTPUTS_TO_EXTRACT:
                if field_key not in frame.fieldOutputs:
                    continue

                field_output = frame.fieldOutputs[field_key]

                is_nodal_field = False
                if len(field_output.values) > 0:
                    fv0 = field_output.values[0]
                    if (hasattr(fv0, 'nodeLabel') and fv0.nodeLabel is not None and
                        (not hasattr(fv0, 'elementLabel') or fv0.elementLabel is None or
                         fv0.elementLabel == 0)):
                        is_nodal_field = True

                # Single pass over field values, bucket into all matching regions
                for fv in field_output.values:
                    if is_nodal_field:
                        nl = fv.nodeLabel
                        if nl not in node_to_regions:
                            continue
                        matched_regions = node_to_regions[nl]
                    else:
                        if not hasattr(fv, 'elementLabel') or fv.elementLabel is None:
                            continue
                        el = fv.elementLabel
                        if el not in elem_to_regions:
                            continue
                        matched_regions = elem_to_regions[el]

                    try:
                        val = extract_value(fv, comp_or_inv, field_output)
                    except Exception:
                        continue
                    if val is None:
                        continue

                    for ri in matched_regions:
                        key = (ri, step_name, frame_idx)
                        if key not in results:
                            continue
                        cur_max, cur_min = results[key][label]
                        if cur_max is None or val > cur_max:
                            cur_max = val
                        if cur_min is None or val < cur_min:
                            cur_min = val
                        results[key][label] = (cur_max, cur_min)

        cumulative_time += step.totalTime

    extract_time = time.time() - extract_start
    print('  Extraction done (%.1f sec)' % extract_time)
    sys.stdout.flush()

    # -----------------------------------------------------------------
    # BUILD CSV ROWS from results dict
    # -----------------------------------------------------------------
    csv_rows = []
    for region_idx, region_info in enumerate(REGIONS):
        if len(region_elem_map[region_idx]) == 0:
            continue
        xi = region_info.get('xi', 0)
        yi = region_info.get('yi', 0)
        x_label = region_info.get('x_label', '')
        y_label = region_info.get('y_label', '')

        cumulative_time = 0.0
        for step_name in step_names:
            step = odb.steps[step_name]
            if FRAME_SELECTION == 'LAST':
                frames_to_process = [step.frames[-1]]
            else:
                frames_to_process = list(step.frames)

            for frame in frames_to_process:
                frame_idx = frame.frameId
                key = (region_idx, step_name, frame_idx)
                if key not in results:
                    continue
                fm = frame_meta.get((step_name, frame_idx), (0.0, 0.0))
                row = [step_name, frame_idx, '%.6e' % fm[0], '%.6e' % fm[1],
                       region_idx, xi, yi, x_label, y_label]
                for label in header_labels:
                    mv, nv = results[key].get(label, (None, None))
                    row.append('%.8e' % mv if mv is not None else 'N/A')
                    row.append('%.8e' % nv if nv is not None else 'N/A')
                csv_rows.append(row)

    print('  [%d/%d] Regions processed, %d data rows' % (non_empty, total_regions, len(csv_rows)))
    sys.stdout.flush()

    # Write consolidated CSV
    set_short = elset_name.split('.')[-1] if '.' in elset_name else elset_name
    csv_filename = '%s_consolidated.csv' % set_short
    csv_path = os.path.join(OUTPUT_DIR, csv_filename)

    csv_header = ['Step', 'Frame', 'StepTime_s', 'TotalTime_s',
                  'RegionIdx', 'Xi', 'Yi', 'XLabel', 'YLabel']
    for label in header_labels:
        csv_header.append('%s_Max' % label)
        csv_header.append('%s_Min' % label)

    with open(csv_path, 'w') as f:
        f.write('# Abaqus Field Output Extraction - Consolidated\n')
        f.write('# ODB: %s\n' % ODB_PATH)
        f.write('# Element Set: %s\n' % elset_name)
        f.write('# Total Regions: %d\n' % total_regions)
        f.write('# 2D Sweep: %s\n' % ('Yes' if IS_2D_SWEEP else 'No'))
        f.write('# X Labels: %s\n' % ','.join([str(x) for x in X_LABELS]))
        f.write('# Y Labels: %s\n' % ','.join([str(y) for y in Y_LABELS]))
        f.write('#\n')
        f.write(','.join(csv_header) + '\n')
        for row in csv_rows:
            f.write(','.join([str(v) for v in row]) + '\n')

    print('\n  >> Wrote consolidated CSV: %s (%d data rows)' % (csv_filename, len(csv_rows)))
    total_csv_files += 1

# ============================================================================
# SUMMARY
# ============================================================================
elapsed = time.time() - start_time
print('\n' + '=' * 70)
print('  EXTRACTION COMPLETE')
print('=' * 70)
print('  Consolidated CSV files written: %d' % total_csv_files)
print('  Output directory: %s' % OUTPUT_DIR)
print('  Elapsed time: %.1f seconds' % elapsed)
print('=' * 70)

# Write metadata JSON for post-processing
metadata = {{
    'output_dir': OUTPUT_DIR,
    'element_sets': ELEMENT_SET_NAMES,
    'header_labels': header_labels,
    'x_labels': X_LABELS,
    'y_labels': Y_LABELS,
    'is_2d': IS_2D_SWEEP,
    'step_names': step_names,
}}
meta_path = os.path.join(OUTPUT_DIR, '_extraction_metadata.json')
with open(meta_path, 'w') as f:
    json.dump(metadata, f, indent=2)
print('Metadata written to: %s' % meta_path)

odb.close()
print('\nDone. ODB closed.')
'''


def _build_extraction_script(data):
    """Build the Abaqus extraction Python script from configuration data."""
    odb_path = data.get("odbPath", "")
    output_dir = data.get("outputDir", "")
    instance_name = data.get("instanceName", "CARTILAGESAMPLE-1")
    model_width = data.get("modelWidth", 1.44)
    model_height = data.get("modelHeight", 1.22)
    element_sets = data.get("elementSets", [])
    regions = data.get("regions", [])
    x_labels = data.get("xLabels", [])
    y_labels = data.get("yLabels", [])
    is_2d = data.get("is2D", False)
    outputs = data.get("outputs", [])
    steps_mode = data.get("stepsMode", "ALL")
    custom_steps = data.get("customSteps", [])
    frame_selection = data.get("frameSelection", "LAST")

    # Format element sets
    elsets_str = "\n".join(
        "    '%s.%s'," % (instance_name, s) if "." not in s else "    '%s'," % s
        for s in element_sets
    )

    # Format regions with xi, yi, labels
    region_lines = []
    for i, r in enumerate(regions):
        xi = r.get("xi", 0)
        yi = r.get("yi", 0)
        x_label = r.get("xLabel", x_labels[xi] if xi < len(x_labels) else "")
        y_label = r.get("yLabel", y_labels[yi] if yi < len(y_labels) else "")
        region_lines.append(
            "    {'name': 'R_%02d', 'x_min': %.6f, 'x_max': %.6f, "
            "'y_min': %.6f, 'y_max': %.6f, 'xi': %d, 'yi': %d, "
            "'x_label': '%s', 'y_label': '%s'},"
            % (i + 1, r["xMin"], r["xMax"], r["yMin"], r["yMax"],
               xi, yi, x_label, y_label)
        )
    regions_str = "\n".join(region_lines)

    # Format outputs
    outputs_str = "\n".join(
        "    ('%s', %s, '%s')," % (
            o["fieldKey"],
            "None" if o.get("compOrInv") is None else "'%s'" % o["compOrInv"],
            o["label"],
        )
        for o in outputs
    )

    # Steps config
    if steps_mode == "ALL":
        steps_config = "'ALL'"
    else:
        steps_config = "[%s]" % ", ".join("'%s'" % s for s in custom_steps)

    return EXTRACTION_SCRIPT_TEMPLATE.format(
        odb_path=odb_path.replace("\\", "\\\\"),
        output_dir=output_dir.replace("\\", "\\\\"),
        instance_name=instance_name,
        model_width=model_width,
        model_height=model_height,
        element_sets=elsets_str,
        regions=regions_str,
        x_labels=repr(x_labels),
        y_labels=repr(y_labels),
        is_2d="True" if is_2d else "False",
        outputs=outputs_str,
        steps_config=steps_config,
        frame_selection=frame_selection,
    )


@app.route("/api/generate-script", methods=["POST"])
def generate_script():
    """Generate the Abaqus extraction script and save it."""
    data = request.json
    output_dir = data.get("outputDir", "")

    script_content = _build_extraction_script(data)

    # Determine save path
    if output_dir and os.path.isdir(output_dir):
        script_path = os.path.join(output_dir, "extract_region_sweep.py")
    else:
        script_path = os.path.join(tempfile.gettempdir(), "extract_region_sweep.py")

    with open(script_path, "w") as f:
        f.write(script_content)

    return jsonify({
        "scriptPath": script_path,
        "scriptContent": script_content,
    })


# ============================================================================
# SCRIPT EXECUTION
# ============================================================================

def _stream_output(proc):
    """Read stdout/stderr from process and put into log queue."""
    global _run_status

    # Abaqus writes license info, Intel MPI messages, etc. to stderr
    # These are not actual errors, so we only tag lines that look like real errors
    ERROR_KEYWORDS = ["error", "traceback", "exception", "syntaxerror", "nameerror",
                      "typeerror", "valueerror", "keyerror", "importerror", "runtimeerror"]

    def read_stream(stream, is_stderr):
        for line in iter(stream.readline, ""):
            if line:
                text = line.rstrip("\n\r")
                if is_stderr:
                    lower = text.lower()
                    is_real_error = any(kw in lower for kw in ERROR_KEYWORDS)
                    if is_real_error:
                        _log_queue.put("[ERROR] " + text)
                    else:
                        _log_queue.put(text)
                else:
                    _log_queue.put(text)
        stream.close()

    t_out = threading.Thread(target=read_stream, args=(proc.stdout, False))
    t_err = threading.Thread(target=read_stream, args=(proc.stderr, True))
    t_out.daemon = True
    t_err.daemon = True
    t_out.start()
    t_err.start()

    proc.wait()
    t_out.join(timeout=5)
    t_err.join(timeout=5)

    if proc.returncode == 0:
        _run_status = "completed"
        _log_queue.put("[SYSTEM] Extraction completed successfully.")
    else:
        _run_status = "failed"
        _log_queue.put("[SYSTEM] Process exited with code %d" % proc.returncode)


@app.route("/api/run-script", methods=["POST"])
def run_script():
    """Execute the generated script via Abaqus subprocess."""
    global _process, _run_start_time, _run_status

    with _process_lock:
        if _process is not None and _process.poll() is None:
            return jsonify({"error": "A script is already running."}), 400

    data = request.json
    script_path = data.get("scriptPath", "")
    abaqus_cmd = data.get("abaqusPath", "abaqus")
    exec_mode = data.get("execMode", "noGUI")  # noGUI, python, cae
    working_dir = data.get("workingDir", "")

    if not script_path or not os.path.isfile(script_path):
        return jsonify({"error": "Script file not found: %s" % script_path}), 400

    if not working_dir:
        working_dir = os.path.dirname(script_path)
    # Ensure working directory exists and is valid
    if not working_dir or not os.path.isdir(working_dir):
        working_dir = tempfile.gettempdir()

    # Clear log queue
    while not _log_queue.empty():
        try:
            _log_queue.get_nowait()
        except queue.Empty:
            break

    # Build command
    if exec_mode == "noGUI":
        cmd = [abaqus_cmd, "cae", "noGUI=%s" % script_path]
    elif exec_mode == "python":
        cmd = [abaqus_cmd, "python", script_path]
    elif exec_mode == "cae":
        # Just launch CAE
        cmd = [abaqus_cmd, "cae"]
    else:
        return jsonify({"error": "Unknown execution mode: %s" % exec_mode}), 400

    try:
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        # On Windows, .bat files must be run via shell with a string command
        use_shell = sys.platform == "win32" and abaqus_cmd.lower().endswith(".bat")
        if use_shell:
            cmd = subprocess.list2cmdline(cmd)
        _process = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, cwd=working_dir, creationflags=flags,
            bufsize=1, shell=use_shell,
        )
        _run_start_time = time.time()
        _run_status = "running"

        _log_queue.put("[SYSTEM] Started: %s" % (cmd if isinstance(cmd, str) else " ".join(cmd)))
        _log_queue.put("[SYSTEM] Working directory: %s" % working_dir)

        # Start output streaming thread
        t = threading.Thread(target=_stream_output, args=(_process,))
        t.daemon = True
        t.start()

        return jsonify({
            "status": "running",
            "pid": _process.pid,
            "command": " ".join(cmd),
        })

    except FileNotFoundError:
        return jsonify({"error": "Abaqus command not found: %s" % abaqus_cmd}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/run-status")
def run_status():
    """SSE endpoint for real-time log streaming."""
    def generate():
        while True:
            try:
                line = _log_queue.get(timeout=1)
                yield "data: %s\n\n" % json.dumps({"type": "log", "message": line})
            except queue.Empty:
                # Send heartbeat
                elapsed = time.time() - _run_start_time if _run_start_time else 0
                yield "data: %s\n\n" % json.dumps({
                    "type": "heartbeat",
                    "status": _run_status,
                    "elapsed": round(elapsed, 1),
                })
                if _run_status in ("completed", "failed", "cancelled"):
                    yield "data: %s\n\n" % json.dumps({
                        "type": "done",
                        "status": _run_status,
                        "elapsed": round(elapsed, 1),
                    })
                    break

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.route("/api/stop-run", methods=["POST"])
def stop_run():
    """Kill the running subprocess."""
    global _run_status

    with _process_lock:
        if _process is not None and _process.poll() is None:
            _process.kill()
            _run_status = "cancelled"
            _log_queue.put("[SYSTEM] Process killed by user.")
            return jsonify({"status": "cancelled"})
        else:
            return jsonify({"status": "not_running"})


# ============================================================================
# POST-PROCESSING: Consolidated CSV -> Excel
# ============================================================================

def _post_process_to_excel(output_dir):
    """
    Read consolidated CSVs and metadata from output_dir.
    Creates plot-ready Excel files organized by Loading vs Relaxation phases.

    Steps are classified as:
      - Loading:     1st, 3rd, 5th, 7th, 9th, ... (odd-indexed steps)
      - Relaxation:  2nd, 4th, 6th, 8th, 10th, ... (even-indexed steps)

    Sheet structure for 1D sweep (e.g. X sweep):
      "S22_Max_Loading"  => rows=X positions, columns=Loading step names
      "S22_Min_Loading"  => rows=X positions, columns=Loading step names
      "S22_Max_Relax"    => rows=X positions, columns=Relaxation step names
      "S22_Min_Relax"    => rows=X positions, columns=Relaxation step names

    For 2D sweep: one sheet per phase+stat with stacked blocks per step.

    Also creates a "Summary" sheet with peak values per step per variable.
    """
    import csv

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill, Border, Side, numbers
        from openpyxl.utils import get_column_letter
    except ImportError:
        return {"error": "openpyxl not installed. Run: pip install openpyxl"}

    meta_path = os.path.join(output_dir, "_extraction_metadata.json")
    if not os.path.isfile(meta_path):
        return {"error": "Metadata file not found. Run extraction first."}

    with open(meta_path, "r") as f:
        meta = json.load(f)

    header_labels = meta["header_labels"]
    x_labels = meta["x_labels"]
    y_labels = meta["y_labels"]
    is_2d = meta["is_2d"]
    step_names = meta["step_names"]
    element_sets = meta["element_sets"]

    # Classify steps into Loading (odd: 1st, 3rd, ...) and Relaxation (even: 2nd, 4th, ...)
    loading_steps = [s for i, s in enumerate(step_names) if i % 2 == 0]
    relaxation_steps = [s for i, s in enumerate(step_names) if i % 2 == 1]

    # If only 1 step, treat it as loading only
    if len(step_names) == 1:
        loading_steps = step_names
        relaxation_steps = []

    # Style definitions
    header_font = Font(bold=True, size=10)
    header_fill_dark = PatternFill(start_color="2D3748", end_color="2D3748", fill_type="solid")
    header_font_white = Font(bold=True, size=10, color="FFFFFF")
    loading_fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
    loading_font = Font(bold=True, size=10, color="90CDF4")
    relax_fill = PatternFill(start_color="322659", end_color="322659", fill_type="solid")
    relax_font = Font(bold=True, size=10, color="D6BCFA")
    summary_header_fill = PatternFill(start_color="1A202C", end_color="1A202C", fill_type="solid")
    summary_header_font = Font(bold=True, size=11, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC"),
    )
    pos_label_font = Font(bold=False, size=10, color="A0AEC0")
    pos_label_fill = PatternFill(start_color="1A202C", end_color="1A202C", fill_type="solid")

    def _auto_fit(ws):
        for col in ws.columns:
            max_len = 0
            for cell in col:
                if cell.value is not None:
                    max_len = max(max_len, len(str(cell.value)))
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 3, 22)

    def _style_header_row(ws, row_num, num_cols, fill=None, font=None):
        for c in range(1, num_cols + 1):
            cell = ws.cell(row=row_num, column=c)
            cell.font = font or header_font_white
            cell.fill = fill or header_fill_dark
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center")

    def _write_value(ws, row_num, col_num, val_str):
        try:
            val = float(val_str)
            cell = ws.cell(row=row_num, column=col_num, value=val)
            cell.number_format = '0.0000E+00'
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center")
        except (ValueError, TypeError):
            cell = ws.cell(row=row_num, column=col_num, value=val_str)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center")

    def _write_pos_label(ws, row_num, col_num, value):
        cell = ws.cell(row=row_num, column=col_num, value=value)
        cell.font = pos_label_font
        cell.fill = pos_label_fill
        cell.border = thin_border
        cell.alignment = Alignment(horizontal="center")

    def _safe_sheet_name(name, max_len=31):
        """Truncate and sanitize sheet name to Excel's 31-char limit."""
        # Remove invalid chars
        for ch in ['\\', '/', '*', '?', ':', '[', ']']:
            name = name.replace(ch, '')
        return name[:max_len]

    excel_files = []

    for elset_name in element_sets:
        set_short = elset_name.split(".")[-1] if "." in elset_name else elset_name
        csv_path = os.path.join(output_dir, "%s_consolidated.csv" % set_short)

        if not os.path.isfile(csv_path):
            continue

        # Read CSV data
        rows = []
        with open(csv_path, "r") as f:
            reader = csv.reader(f)
            header_row = None
            for row in reader:
                if not row or row[0].startswith("#"):
                    continue
                if header_row is None:
                    header_row = row
                    continue
                rows.append(row)

        if not header_row or not rows:
            continue

        col_map = {name: idx for idx, name in enumerate(header_row)}

        # Build data: data[(step, xi, yi)][var_label] = (max_val, min_val)
        data = {}
        for row in rows:
            step = row[col_map["Step"]]
            xi = int(row[col_map["Xi"]])
            yi = int(row[col_map["Yi"]])
            key = (step, xi, yi)
            if key not in data:
                data[key] = {}
            for label in header_labels:
                max_col = "%s_Max" % label
                min_col = "%s_Min" % label
                max_val = row[col_map[max_col]] if max_col in col_map else "N/A"
                min_val = row[col_map[min_col]] if min_col in col_map else "N/A"
                data[key][label] = (max_val, min_val)

        wb = Workbook()
        if wb.sheetnames:
            wb.remove(wb.active)

        # =============================================
        # SUMMARY SHEET
        # =============================================
        ws_sum = wb.create_sheet(title="Summary")
        ws_sum.cell(row=1, column=1, value="Element Set: %s" % set_short)
        ws_sum.cell(row=1, column=1).font = Font(bold=True, size=14, color="FFFFFF")
        ws_sum.cell(row=2, column=1, value="Steps: %d (%d Loading + %d Relaxation)" % (
            len(step_names), len(loading_steps), len(relaxation_steps)))
        ws_sum.cell(row=2, column=1).font = Font(size=10, color="A0AEC0")
        ws_sum.cell(row=3, column=1, value="Regions: %d" % (len(x_labels) * max(len(y_labels), 1)))
        ws_sum.cell(row=3, column=1).font = Font(size=10, color="A0AEC0")

        # Summary table: peak values across all regions per step per variable
        sum_row = 5
        ws_sum.cell(row=sum_row, column=1, value="Step")
        ws_sum.cell(row=sum_row, column=2, value="Phase")
        col_idx = 3
        for label in header_labels:
            ws_sum.cell(row=sum_row, column=col_idx, value="%s Max" % label)
            ws_sum.cell(row=sum_row, column=col_idx + 1, value="%s Min" % label)
            col_idx += 2
        _style_header_row(ws_sum, sum_row, col_idx - 1, summary_header_fill, summary_header_font)

        for step_idx, step in enumerate(step_names):
            r = sum_row + step_idx + 1
            phase = "Loading" if step in loading_steps else "Relaxation"
            ws_sum.cell(row=r, column=1, value=step).border = thin_border
            phase_cell = ws_sum.cell(row=r, column=2, value=phase)
            phase_cell.border = thin_border
            if phase == "Loading":
                phase_cell.font = loading_font
                phase_cell.fill = loading_fill
            else:
                phase_cell.font = relax_font
                phase_cell.fill = relax_fill

            col_idx = 3
            for label in header_labels:
                # Find peak across all regions for this step
                peak_max = None
                peak_min = None
                all_xi = range(len(x_labels)) if x_labels else [0]
                all_yi = range(len(y_labels)) if y_labels else [0]
                for xi in all_xi:
                    for yi in all_yi:
                        key = (step, xi, yi)
                        if key in data and label in data[key]:
                            try:
                                mv = float(data[key][label][0])
                                if peak_max is None or mv > peak_max:
                                    peak_max = mv
                            except (ValueError, TypeError):
                                pass
                            try:
                                nv = float(data[key][label][1])
                                if peak_min is None or nv < peak_min:
                                    peak_min = nv
                            except (ValueError, TypeError):
                                pass

                if peak_max is not None:
                    _write_value(ws_sum, r, col_idx, "%.8e" % peak_max)
                else:
                    ws_sum.cell(row=r, column=col_idx, value="N/A").border = thin_border
                if peak_min is not None:
                    _write_value(ws_sum, r, col_idx + 1, "%.8e" % peak_min)
                else:
                    ws_sum.cell(row=r, column=col_idx + 1, value="N/A").border = thin_border
                col_idx += 2

        _auto_fit(ws_sum)

        # =============================================
        # DATA SHEETS: one per variable x stat x phase
        # =============================================
        phases = [("Loading", loading_steps, loading_fill, loading_font),
                  ("Relax", relaxation_steps, relax_fill, relax_font)]

        for label in header_labels:
            for stat_type, stat_idx in [("Max", 0), ("Min", 1)]:
                for phase_name, phase_steps, phase_fill, phase_font in phases:
                    if not phase_steps:
                        continue

                    sheet_name = _safe_sheet_name("%s_%s_%s" % (label, stat_type, phase_name))
                    ws = wb.create_sheet(title=sheet_name)

                    if is_2d:
                        # 2D sweep: stacked blocks, one per step
                        # Each block: rows=Y positions, columns=X positions
                        current_row = 1
                        for step in phase_steps:
                            # Step header
                            ws.cell(row=current_row, column=1,
                                    value="%s  |  %s %s  |  %s" % (step, label, stat_type, phase_name))
                            ws.cell(row=current_row, column=1).font = phase_font
                            ws.cell(row=current_row, column=1).fill = phase_fill
                            ws.merge_cells(start_row=current_row, start_column=1,
                                           end_row=current_row, end_column=len(x_labels) + 1)
                            current_row += 1

                            # Column headers (X labels)
                            ws.cell(row=current_row, column=1, value="Y \\ X")
                            for ci, xl in enumerate(x_labels):
                                ws.cell(row=current_row, column=ci + 2, value=xl)
                            _style_header_row(ws, current_row, len(x_labels) + 1)
                            current_row += 1

                            # Data rows (Y labels)
                            for yi_idx, yl in enumerate(y_labels):
                                _write_pos_label(ws, current_row, 1, yl)
                                for xi_idx in range(len(x_labels)):
                                    key = (step, xi_idx, yi_idx)
                                    if key in data and label in data[key]:
                                        _write_value(ws, current_row, xi_idx + 2,
                                                     data[key][label][stat_idx])
                                current_row += 1

                            current_row += 1  # Blank row between blocks

                    else:
                        # 1D sweep: rows=positions, columns=step names
                        # This is the plot-friendly format!
                        pos_labels = x_labels if len(x_labels) > 1 else y_labels
                        pos_axis = "X" if len(x_labels) > 1 else "Y"

                        # Title row
                        ws.cell(row=1, column=1,
                                value="%s  |  %s %s  |  %s" % (set_short, label, stat_type, phase_name))
                        ws.cell(row=1, column=1).font = Font(bold=True, size=12, color="FFFFFF")
                        ws.merge_cells(start_row=1, start_column=1,
                                       end_row=1, end_column=len(phase_steps) + 1)
                        ws.cell(row=1, column=1).fill = phase_fill

                        # Header row: Position | Step1 | Step2 | ...
                        ws.cell(row=2, column=1, value="Position_%s (mm)" % pos_axis)
                        for si, step in enumerate(phase_steps):
                            ws.cell(row=2, column=si + 2, value=step)
                        _style_header_row(ws, 2, len(phase_steps) + 1, phase_fill, phase_font)

                        # Data rows
                        for ci, pl in enumerate(pos_labels):
                            row_num = ci + 3
                            _write_pos_label(ws, row_num, 1, pl)

                            for si, step in enumerate(phase_steps):
                                if pos_axis == "X":
                                    key = (step, ci, 0)
                                else:
                                    key = (step, 0, ci)

                                if key in data and label in data[key]:
                                    _write_value(ws, row_num, si + 2, data[key][label][stat_idx])

                    _auto_fit(ws)

        # =============================================
        # ALL-STEPS SHEETS (for single-step or custom use)
        # One sheet per variable+stat with ALL steps as columns
        # =============================================
        if len(step_names) > 1:
            for label in header_labels:
                for stat_type, stat_idx in [("Max", 0), ("Min", 1)]:
                    sheet_name = _safe_sheet_name("%s_%s_AllSteps" % (label, stat_type))
                    ws = wb.create_sheet(title=sheet_name)

                    pos_labels = x_labels if len(x_labels) > 1 else y_labels
                    pos_axis = "X" if len(x_labels) > 1 else "Y"

                    if is_2d:
                        # For 2D, create stacked blocks for all steps
                        current_row = 1
                        for step in step_names:
                            step_idx = step_names.index(step)
                            phase = "Loading" if step in loading_steps else "Relaxation"
                            pf = loading_fill if phase == "Loading" else relax_fill
                            pfont = loading_font if phase == "Loading" else relax_font

                            ws.cell(row=current_row, column=1,
                                    value="%s  |  %s %s  |  %s" % (step, label, stat_type, phase))
                            ws.cell(row=current_row, column=1).font = pfont
                            ws.cell(row=current_row, column=1).fill = pf
                            ws.merge_cells(start_row=current_row, start_column=1,
                                           end_row=current_row, end_column=len(x_labels) + 1)
                            current_row += 1

                            ws.cell(row=current_row, column=1, value="Y \\ X")
                            for ci, xl in enumerate(x_labels):
                                ws.cell(row=current_row, column=ci + 2, value=xl)
                            _style_header_row(ws, current_row, len(x_labels) + 1)
                            current_row += 1

                            for yi_idx, yl in enumerate(y_labels):
                                _write_pos_label(ws, current_row, 1, yl)
                                for xi_idx in range(len(x_labels)):
                                    key = (step, xi_idx, yi_idx)
                                    if key in data and label in data[key]:
                                        _write_value(ws, current_row, xi_idx + 2,
                                                     data[key][label][stat_idx])
                                current_row += 1
                            current_row += 1
                    else:
                        # 1D: rows=positions, columns=ALL step names
                        ws.cell(row=1, column=1,
                                value="%s  |  %s %s  |  All Steps" % (set_short, label, stat_type))
                        ws.cell(row=1, column=1).font = Font(bold=True, size=12, color="FFFFFF")
                        ws.merge_cells(start_row=1, start_column=1,
                                       end_row=1, end_column=len(step_names) + 1)
                        ws.cell(row=1, column=1).fill = header_fill_dark

                        # Header with color-coded step names
                        ws.cell(row=2, column=1, value="Position_%s (mm)" % pos_axis)
                        for si, step in enumerate(step_names):
                            cell = ws.cell(row=2, column=si + 2, value=step)
                            cell.border = thin_border
                            cell.alignment = Alignment(horizontal="center")
                            if step in loading_steps:
                                cell.font = loading_font
                                cell.fill = loading_fill
                            else:
                                cell.font = relax_font
                                cell.fill = relax_fill

                        # Style position header
                        pos_cell = ws.cell(row=2, column=1)
                        pos_cell.font = header_font_white
                        pos_cell.fill = header_fill_dark
                        pos_cell.border = thin_border

                        # Data rows
                        for ci, pl in enumerate(pos_labels):
                            row_num = ci + 3
                            _write_pos_label(ws, row_num, 1, pl)

                            for si, step in enumerate(step_names):
                                if pos_axis == "X":
                                    key = (step, ci, 0)
                                else:
                                    key = (step, 0, ci)
                                if key in data and label in data[key]:
                                    _write_value(ws, row_num, si + 2, data[key][label][stat_idx])

                    _auto_fit(ws)

        # Save Excel
        excel_filename = "%s_Results.xlsx" % set_short
        excel_path = os.path.join(output_dir, excel_filename)
        wb.save(excel_path)
        excel_files.append(excel_path)

    return {"excelFiles": excel_files, "count": len(excel_files)}


@app.route("/api/post-process-excel", methods=["POST"])
def post_process_excel():
    """Create consolidated Excel files from extraction CSVs."""
    data = request.json
    output_dir = data.get("outputDir", "")

    if not output_dir or not os.path.isdir(output_dir):
        return jsonify({"error": "Output directory not found: %s" % output_dir}), 400

    result = _post_process_to_excel(output_dir)
    if "error" in result:
        return jsonify(result), 500

    return jsonify(result)


@app.route("/api/open-folder", methods=["POST"])
def open_folder():
    """Open a folder in the system file explorer."""
    folder = request.json.get("path", "")
    if not folder or not os.path.isdir(folder):
        return jsonify({"error": "Directory not found"}), 400

    if sys.platform == "win32":
        os.startfile(folder)
    else:
        subprocess.Popen(["xdg-open", folder])
    return jsonify({"status": "opened"})


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    """Serve static assets with correct MIME types (fixes Windows issue)."""
    mimemap = {".js": "application/javascript", ".css": "text/css",
               ".map": "application/json", ".woff2": "font/woff2"}
    ext = os.path.splitext(filename)[1].lower()
    resp = send_from_directory(os.path.join(app.static_folder, "assets"), filename)
    if ext in mimemap:
        resp.headers["Content-Type"] = mimemap[ext]
    return resp


@app.route("/")
def serve_index():
    """Serve the built frontend."""
    return send_from_directory(app.static_folder, "index.html")


@app.errorhandler(404)
def fallback(e):
    """SPA fallback - serve index.html for non-API routes."""
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    print("Starting Abaqus ODB Extractor on http://localhost:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
