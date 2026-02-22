#!/usr/bin/env python3
"""
recenter_spritesheet.py
Recentre horizontalement ET verticalement les frames d'un spritesheet horizontal.
Usage : python3 recenter_spritesheet.py <fichier.png> [--dry-run]

Pour chaque frame :
  - trouve le bounding box (xmin/xmax/ymin/ymax) du contenu non-transparent
  - ancre le bas (ymax) et le centre horizontal (xmid) sur la médiane de toutes les frames
  - décale le contenu en conséquence

Produit un fichier _recentered.png à côté de l'original.
"""

import sys, os, struct, zlib

# ── PNG minimal reader/writer (stdlib only) ─────────────────────────────────

def read_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', "Not a PNG"
    chunks = []
    i = 8
    while i < len(data):
        length = struct.unpack('>I', data[i:i+4])[0]
        ctype  = data[i+4:i+8]
        cdata  = data[i+8:i+8+length]
        chunks.append((ctype, cdata))
        i += 12 + length
        if ctype == b'IEND':
            break
    return chunks

def parse_ihdr(cdata):
    w, h = struct.unpack('>II', cdata[:8])
    bit_depth, color_type = cdata[8], cdata[9]
    return w, h, bit_depth, color_type

def decode_pixels(chunks, w, h):
    raw_data = b''.join(c for t, c in chunks if t == b'IDAT')
    raw = zlib.decompress(raw_data)
    bpp = 4
    stride = w * bpp
    pixels = []
    idx = 0
    prev = [0] * stride
    for y in range(h):
        filter_type = raw[idx]; idx += 1
        scanline = list(raw[idx:idx+stride]); idx += stride
        if filter_type == 0:
            row = scanline
        elif filter_type == 1:
            row = scanline[:]
            for x in range(bpp, stride):
                row[x] = (row[x] + row[x-bpp]) & 0xff
        elif filter_type == 2:
            row = [(scanline[x] + prev[x]) & 0xff for x in range(stride)]
        elif filter_type == 3:
            row = scanline[:]
            for x in range(stride):
                a = row[x-bpp] if x >= bpp else 0
                b = prev[x]
                row[x] = (row[x] + (a + b) // 2) & 0xff
        elif filter_type == 4:
            row = scanline[:]
            for x in range(stride):
                a = row[x-bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x-bpp] if x >= bpp else 0
                pa = abs(b - c); pb = abs(a - c); pc = abs(a + b - 2*c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                row[x] = (row[x] + pr) & 0xff
        else:
            row = scanline
        prev = row
        pixels.append(row)
    return pixels

def encode_pixels(pixels, w, h):
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        raw.extend(row)
    return zlib.compress(bytes(raw), 9)

def make_chunk(ctype, cdata):
    length = struct.pack('>I', len(cdata))
    crc = struct.pack('>I', zlib.crc32(ctype + cdata) & 0xffffffff)
    return length + ctype + cdata + crc

def write_png(path, pixels, w, h):
    ihdr_data = struct.pack('>II', w, h) + bytes([8, 6, 0, 0, 0])
    idat_data = encode_pixels(pixels, w, h)
    out = b'\x89PNG\r\n\x1a\n'
    out += make_chunk(b'IHDR', ihdr_data)
    out += make_chunk(b'IDAT', idat_data)
    out += make_chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(out)

# ── Sprite logic ─────────────────────────────────────────────────────────────

def frame_bbox(pixels, fx, frame_size):
    """
    Bounding box (xmin, xmax, ymin, ymax) + xmid_feet.
    xmid_feet = centre horizontal des pixels non-transparents dans le tiers inférieur
    de la zone du personnage (les pieds), point d'ancrage stable entre animations.
    """
    xmin, xmax = frame_size, -1
    ymin, ymax = frame_size, -1
    for y in range(frame_size):
        row = pixels[y]
        for lx in range(frame_size):
            gx = fx + lx
            a = row[gx*4+3]
            if a > 10:
                if y < ymin: ymin = y
                if y > ymax: ymax = y
                if lx < xmin: xmin = lx
                if lx > xmax: xmax = lx

    # xmid des pieds : 20% inférieur du contenu (dernier 1/5 de la hauteur du perso)
    feet_xmin, feet_xmax = frame_size, -1
    if ymax >= ymin:
        feet_top = ymax - max(1, (ymax - ymin) // 5)
        for y in range(feet_top, ymax + 1):
            row = pixels[y]
            for lx in range(frame_size):
                gx = fx + lx
                a = row[gx*4+3]
                if a > 10:
                    if lx < feet_xmin: feet_xmin = lx
                    if lx > feet_xmax: feet_xmax = lx

    xmid_feet = (feet_xmin + feet_xmax) // 2 if feet_xmax >= feet_xmin else (xmin + xmax) // 2
    return xmin, xmax, ymin, ymax, xmid_feet

def median(values):
    s = sorted(values)
    return s[len(s) // 2]

def recenter_sheet(path, dry_run=False):
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Traitement : {os.path.basename(path)}")

    chunks = read_png(path)
    ihdr = next(c for t, c in chunks if t == b'IHDR')
    w, h, bit_depth, color_type = parse_ihdr(ihdr)

    if h not in (64, 96, 128, 192, 256):
        print(f"  ⚠ Hauteur inattendue {h}px — ignoré")
        return

    frame_size = h
    n_frames = w // frame_size
    print(f"  {w}x{h} → {n_frames} frames de {frame_size}x{frame_size}")

    if color_type not in (6,):
        print(f"  ⚠ color_type={color_type} sans canal alpha — ignoré")
        return

    pixels = decode_pixels(chunks, w, h)

    # 1. Calcul des bounding boxes
    bboxes = []
    for i in range(n_frames):
        fx = i * frame_size
        xmin, xmax, ymin, ymax, xmid_feet = frame_bbox(pixels, fx, frame_size)
        bboxes.append((xmin, xmax, ymin, ymax, xmid_feet))
        print(f"  Frame {i}: x=[{xmin},{xmax}] xmid_feet={xmid_feet}  y=[{ymin},{ymax}]")

    valid = [(xn, xx, yn, yx, xf) for xn, xx, yn, yx, xf in bboxes if xx >= xn and yx >= yn]
    if not valid:
        print("  ⚠ Aucun contenu détecté")
        return

    # 2. Ancrage médian sur les pieds
    anchor_ymax  = median([yx for _, _, _, yx, _ in valid])
    anchor_xfeet = median([xf for _, _, _, _, xf in valid])
    print(f"  → ancrage xfeet={anchor_xfeet} ymax={anchor_ymax}")

    # 3. Calcul des décalages dx, dy par frame
    shifts = []
    for i, (xmin, xmax, ymin, ymax, xmid_feet) in enumerate(bboxes):
        if xmax < xmin or ymax < ymin:
            shifts.append((0, 0))
            continue
        dx = anchor_xfeet - xmid_feet  # positif = déplacer vers la droite
        dy = anchor_ymax - ymax        # positif = déplacer vers le bas
        shifts.append((dx, dy))

    if all(dx == 0 and dy == 0 for dx, dy in shifts):
        print("  ✓ Déjà aligné, aucune modification")
        return

    print(f"  Décalages (dx,dy) : {shifts}")

    if dry_run:
        return

    # 4. Appliquer les décalages
    new_pixels = [[0] * (w * 4) for _ in range(frame_size)]

    for i in range(n_frames):
        fx = i * frame_size
        dx, dy = shifts[i]
        for y in range(frame_size):
            src_y = y - dy
            dst_row = new_pixels[y]
            if 0 <= src_y < frame_size:
                src_row = pixels[src_y]
                for lx in range(frame_size):
                    src_lx = lx - dx
                    if 0 <= src_lx < frame_size:
                        gx_dst = (fx + lx) * 4
                        gx_src = (fx + src_lx) * 4
                        dst_row[gx_dst:gx_dst+4] = src_row[gx_src:gx_src+4]

    # 5. Écrire le fichier (remplace l'original)
    write_png(path, new_pixels, w, frame_size)
    print(f"  ✓ Écrit : {os.path.basename(path)}")

# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    files = [a for a in args if not a.startswith('--')]

    if not files:
        print("Usage: python3 recenter_spritesheet.py <fichier.png> [<fichier2.png> ...] [--dry-run]")
        print("       python3 recenter_spritesheet.py path/to/folder/ [--dry-run]")
        sys.exit(1)

    all_files = []
    for f in files:
        if os.path.isdir(f):
            all_files += [os.path.join(f, fn) for fn in sorted(os.listdir(f)) if fn.endswith('.png') and '_recentered' not in fn]
        else:
            all_files.append(f)

    for path in all_files:
        try:
            recenter_sheet(path, dry_run=dry_run)
        except Exception as e:
            print(f"  ✗ Erreur : {e}")

    print("\nTerminé.")
