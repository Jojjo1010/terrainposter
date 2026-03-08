"""Generate synthetic population and nightlights test data as GeoTIFFs.

Creates realistic-looking raster datasets for testing the TerrainPoster
pipeline without requiring the full 6 GB Kontur download.

Only depends on numpy (no rasterio/scipy needed). Writes GeoTIFF files
directly using struct for TIFF encoding.

Outputs (in data/processed/):
  - kontur_pop_20km.tif   (2000x1000, ~0.18 deg/pixel)
  - kontur_pop_5km.tif    (8000x4000, ~0.045 deg/pixel)
  - viirs_nightlights_20km.tif
  - viirs_nightlights_5km.tif

Usage::

    python3 pipeline/generate_test_data.py
"""

from __future__ import annotations

import logging
import struct
import zlib
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"

# ---------------------------------------------------------------------------
# City definitions: (name, lat, lon, pop_weight, sigma_deg, nightlight_mult)
# ---------------------------------------------------------------------------
MAJOR_CITIES = [
    ("Tokyo",        35.68,  139.69, 1.00, 1.8, 1.2),
    ("Delhi",        28.61,   77.21, 0.85, 1.5, 0.7),
    ("Shanghai",     31.23,  121.47, 0.80, 1.6, 1.1),
    ("Sao Paulo",   -23.55,  -46.63, 0.70, 1.4, 0.9),
    ("Mumbai",       19.08,   72.88, 0.75, 1.2, 0.8),
    ("New York",     40.71,  -74.01, 0.65, 1.5, 1.3),
    ("London",       51.51,   -0.13, 0.55, 1.3, 1.2),
    ("Paris",        48.86,    2.35, 0.50, 1.2, 1.1),
    ("Stockholm",    59.33,   18.07, 0.20, 0.8, 1.0),
    ("Lagos",         6.52,    3.38, 0.60, 1.0, 0.5),
    ("Cairo",        30.04,   31.24, 0.55, 1.1, 0.7),
    ("Sydney",      -33.87,  151.21, 0.30, 1.0, 1.1),
    ("Mexico City",  19.43,  -99.13, 0.60, 1.3, 0.8),
    ("Jakarta",      -6.21,  106.85, 0.65, 1.2, 0.7),
    ("Moscow",       55.76,   37.62, 0.50, 1.4, 1.0),
    ("Berlin",       52.52,   13.41, 0.30, 1.0, 1.1),
    ("Los Angeles",  34.05, -118.24, 0.50, 1.8, 1.4),
    ("Beijing",      39.90,  116.40, 0.75, 1.6, 1.0),
    ("Seoul",        37.57,  126.98, 0.55, 1.0, 1.2),
    ("Bangkok",      13.76,  100.50, 0.50, 1.1, 0.9),
]


def _generate_minor_cities(rng: np.random.Generator, n: int = 200):
    """Generate random minor city locations."""
    cities = []
    for _ in range(n):
        lat = rng.uniform(-55, 70)
        lon = rng.uniform(-180, 180)
        weight = rng.uniform(0.02, 0.15)
        sigma = rng.uniform(0.3, 0.7)
        nightlight_mult = rng.uniform(0.3, 1.0)
        cities.append(("minor", lat, lon, weight, sigma, nightlight_mult))
    return cities


def _gaussian_blur_numpy(data: np.ndarray, sigma_pixels: float = 2.0) -> np.ndarray:
    """Simple separable gaussian blur using numpy only."""
    if sigma_pixels < 0.5:
        return data
    kernel_size = int(sigma_pixels * 4) * 2 + 1
    x = np.arange(kernel_size) - kernel_size // 2
    kernel_1d = np.exp(-x ** 2 / (2 * sigma_pixels ** 2))
    kernel_1d /= kernel_1d.sum()

    # Convolve rows then columns (separable)
    # Use numpy convolve on each row/col -- for large arrays do it via FFT-like approach
    # For efficiency, use np.apply_along_axis or manual loop
    from numpy import convolve

    # Blur along axis=1 (columns direction)
    padded = np.pad(data, ((0, 0), (kernel_size // 2, kernel_size // 2)), mode='reflect')
    out = np.zeros_like(data)
    for i in range(data.shape[0]):
        out[i] = convolve(padded[i], kernel_1d, mode='valid')[:data.shape[1]]

    # Blur along axis=0 (rows direction)
    padded = np.pad(out, ((kernel_size // 2, kernel_size // 2), (0, 0)), mode='reflect')
    result = np.zeros_like(data)
    for j in range(data.shape[1]):
        result[:, j] = convolve(padded[:, j], kernel_1d, mode='valid')[:data.shape[0]]

    return result


def _make_grid(width: int, height: int):
    """Create lon/lat coordinate grids for the full globe."""
    lon = np.linspace(-180, 180, width, endpoint=False)
    lat = np.linspace(90, -90, height, endpoint=False)
    lon_grid, lat_grid = np.meshgrid(lon, lat)
    return lon_grid, lat_grid


def _add_city_blobs(
    data: np.ndarray,
    lon_grid: np.ndarray,
    lat_grid: np.ndarray,
    cities: list,
    scale_factor: float = 1.0,
    use_nightlight: bool = False,
):
    """Add gaussian blobs for each city to the data array."""
    for city in cities:
        _name, lat, lon, weight, sigma, nl_mult = city
        sigma_scaled = sigma * scale_factor
        dist_sq = (lon_grid - lon) ** 2 + (lat_grid - lat) ** 2
        blob = weight * np.exp(-dist_sq / (2 * sigma_scaled ** 2))
        if use_nightlight:
            blob *= nl_mult
        data += blob


def _add_land_noise(
    data: np.ndarray,
    rng: np.random.Generator,
    strength: float = 0.005,
):
    """Add low-level noise across the grid for realism."""
    noise = rng.exponential(scale=strength, size=data.shape).astype(np.float32)
    noise = _gaussian_blur_numpy(noise, sigma_pixels=2)
    data += noise


def _add_coastline_glow(
    data: np.ndarray,
    lon_grid: np.ndarray,
    lat_grid: np.ndarray,
    strength: float = 0.03,
):
    """Add faint linear features along approximate coastlines/corridors."""
    corridors = [
        ((25, 45), (-78, -72), "lat"),
        ((35, 55), (-5, 5), "lat"),
        ((20, 45), (118, 125), "lat"),
        ((40, 42), (-74, 0), "lon"),
        ((24, 31), (30, 32), "lat"),
        ((8, 20), (72, 78), "lat"),
    ]
    for (lat_min, lat_max), (lon_min, lon_max), _axis in corridors:
        mask = (
            (lat_grid >= lat_min) & (lat_grid <= lat_max) &
            (lon_grid >= lon_min) & (lon_grid <= lon_max)
        )
        data[mask] += strength


# ---------------------------------------------------------------------------
# Minimal GeoTIFF writer (no rasterio dependency)
# ---------------------------------------------------------------------------

def _write_geotiff(path: Path, data: np.ndarray, bounds=(-180, -90, 180, 90)):
    """Write a float32 array as a valid GeoTIFF with EPSG:4326 georeferencing.

    Uses TIFF 6.0 spec with GeoTIFF tags. Data is stored as strips with
    DEFLATE compression.

    Parameters
    ----------
    path : Path
        Output file path.
    data : np.ndarray
        2D float32 array (height, width).
    bounds : tuple
        (west, south, east, north) in degrees.
    """
    height, width = data.shape
    west, south, east, north = bounds

    # GeoTransform: pixel_size_x, rotation, origin_x, rotation, pixel_size_y, origin_y
    pixel_w = (east - west) / width
    pixel_h = (north - south) / height

    # ModelTiepointTag: (col, row, z, x, y, z) -- tie pixel (0,0) to (west, north)
    tiepoint = struct.pack('<6d', 0.0, 0.0, 0.0, west, north, 0.0)

    # ModelPixelScaleTag: (sx, sy, sz)
    pixel_scale = struct.pack('<3d', pixel_w, pixel_h, 0.0)

    # GeoKeyDirectoryTag for EPSG:4326
    # Version=1, Revision=1, Minor=0, NumberOfKeys=3
    # GTModelTypeGeoKey(1024) = ModelTypeGeographic(2)
    # GTRasterTypeGeoKey(1025) = RasterPixelIsArea(1)
    # GeographicTypeGeoKey(2048) = GCS_WGS_84(4326)
    geo_keys = struct.pack('<16H',
        1, 1, 0, 3,          # directory header
        1024, 0, 1, 2,       # GTModelTypeGeoKey = Geographic
        1025, 0, 1, 1,       # GTRasterTypeGeoKey = PixelIsArea
        2048, 0, 1, 4326,    # GeographicTypeGeoKey = EPSG:4326
    )

    # Compress data in strips (one strip per N rows for efficiency)
    rows_per_strip = max(1, min(256, height))
    num_strips = (height + rows_per_strip - 1) // rows_per_strip

    compressed_strips = []
    for i in range(num_strips):
        r0 = i * rows_per_strip
        r1 = min(r0 + rows_per_strip, height)
        strip_data = data[r0:r1].astype('<f4').tobytes()
        compressed = zlib.compress(strip_data, level=6)
        compressed_strips.append(compressed)

    # Build TIFF structure
    # We'll use classic TIFF (not BigTIFF) -- sufficient for < 4GB files
    BYTE_ORDER = b'II'  # little-endian
    MAGIC = 42

    # Layout:
    # 0-7: TIFF header (byte order + magic + IFD offset)
    # 8: IFD
    # After IFD: tag extra data, then strip data

    # Tags we need (sorted by tag number as required by TIFF spec):
    # 256 ImageWidth          SHORT/LONG
    # 257 ImageLength         SHORT/LONG
    # 258 BitsPerSample       SHORT = 32
    # 259 Compression         SHORT = 8 (Deflate)
    # 262 PhotometricInterp   SHORT = 1 (MinIsBlack)
    # 273 StripOffsets         LONG[] -- filled later
    # 278 RowsPerStrip        SHORT/LONG
    # 279 StripByteCounts      LONG[]
    # 282 XResolution          RATIONAL = 1/1
    # 283 YResolution          RATIONAL = 1/1
    # 296 ResolutionUnit       SHORT = 1 (No unit)
    # 339 SampleFormat         SHORT = 3 (IEEE float)
    # 33550 ModelPixelScaleTag  DOUBLE[3]
    # 33922 ModelTiepointTag    DOUBLE[6]
    # 34735 GeoKeyDirectoryTag  SHORT[16]
    # 42113 GDAL_NODATA         ASCII "0"

    tags = []

    def add_tag(code, dtype, count, value_or_offset):
        tags.append((code, dtype, count, value_or_offset))

    # We'll collect all "overflow" data (data that doesn't fit in 4 bytes)
    overflow_data = bytearray()
    overflow_refs = {}  # tag_index -> position in overflow_data

    # dtype codes: 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL, 12=DOUBLE

    add_tag(256, 4, 1, width)                # ImageWidth
    add_tag(257, 4, 1, height)               # ImageLength
    add_tag(258, 3, 1, 32)                   # BitsPerSample
    add_tag(259, 3, 1, 8)                    # Compression (Deflate)
    add_tag(262, 3, 1, 1)                    # PhotometricInterpretation
    # StripOffsets -- placeholder, fill later
    strip_offsets_tag_idx = len(tags)
    add_tag(273, 4, num_strips, 0)
    add_tag(278, 4, 1, rows_per_strip)       # RowsPerStrip
    # StripByteCounts -- placeholder
    strip_counts_tag_idx = len(tags)
    add_tag(279, 4, num_strips, 0)

    # XResolution (RATIONAL = 1/1)
    xres_offset = len(overflow_data)
    overflow_data += struct.pack('<II', 1, 1)
    xres_tag_idx = len(tags)
    add_tag(282, 5, 1, 0)  # offset filled later

    # YResolution (RATIONAL = 1/1)
    yres_offset = len(overflow_data)
    overflow_data += struct.pack('<II', 1, 1)
    yres_tag_idx = len(tags)
    add_tag(283, 5, 1, 0)

    add_tag(296, 3, 1, 1)                    # ResolutionUnit = No unit
    add_tag(339, 3, 1, 3)                    # SampleFormat = IEEE float

    # ModelPixelScaleTag (33550)
    pixel_scale_offset = len(overflow_data)
    overflow_data += pixel_scale
    pixel_scale_tag_idx = len(tags)
    add_tag(33550, 12, 3, 0)

    # ModelTiepointTag (33922)
    tiepoint_offset = len(overflow_data)
    overflow_data += tiepoint
    tiepoint_tag_idx = len(tags)
    add_tag(33922, 12, 6, 0)

    # GeoKeyDirectoryTag (34735)
    geokey_offset = len(overflow_data)
    overflow_data += geo_keys
    geokey_tag_idx = len(tags)
    add_tag(34735, 3, 16, 0)

    # GDAL_NODATA (42113) = ASCII "0\0"
    nodata_str = b'0\x00'
    nodata_offset = len(overflow_data)
    overflow_data += nodata_str
    nodata_tag_idx = len(tags)
    add_tag(42113, 2, len(nodata_str), 0)

    # Sort tags by code (they should already be sorted but ensure)
    tag_order = sorted(range(len(tags)), key=lambda i: tags[i][0])
    tags = [tags[i] for i in tag_order]

    # Rebuild index mapping after sort
    def find_tag_pos(original_idx):
        return tag_order.index(original_idx) if original_idx in tag_order else -1

    # Actually, let me redo this more cleanly -- track by tag code
    tag_code_to_sorted_idx = {tags[i][0]: i for i in range(len(tags))}

    # Now compute actual byte layout
    header_size = 8
    num_tags_field = 2
    tag_entry_size = 12
    ifd_end = 4  # next IFD offset (0 = no more IFDs)
    ifd_size = num_tags_field + len(tags) * tag_entry_size + ifd_end
    ifd_offset = header_size

    overflow_start = header_size + ifd_size
    # After overflow: strip offset array, strip count array, then strip data

    strip_offsets_array_start = overflow_start + len(overflow_data)
    strip_counts_array_start = strip_offsets_array_start + num_strips * 4
    strip_data_start = strip_counts_array_start + num_strips * 4

    # Compute strip offsets
    strip_offsets = []
    offset = strip_data_start
    for cs in compressed_strips:
        strip_offsets.append(offset)
        offset += len(cs)

    strip_byte_counts = [len(cs) for cs in compressed_strips]

    # Now build the file
    out = bytearray()

    # Header
    out += BYTE_ORDER
    out += struct.pack('<H', MAGIC)
    out += struct.pack('<I', ifd_offset)

    # IFD
    out += struct.pack('<H', len(tags))

    for i, (code, dtype, count, value) in enumerate(tags):
        # Determine if value fits inline (<=4 bytes) or needs offset
        dtype_sizes = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 12: 8}
        total_bytes = count * dtype_sizes.get(dtype, 1)

        if code == 256:  # ImageWidth
            val_bytes = struct.pack('<I', width)
        elif code == 257:  # ImageLength
            val_bytes = struct.pack('<I', height)
        elif code == 258:  # BitsPerSample
            val_bytes = struct.pack('<H', 32) + b'\x00\x00'
        elif code == 259:  # Compression
            val_bytes = struct.pack('<H', 8) + b'\x00\x00'
        elif code == 262:  # PhotometricInterpretation
            val_bytes = struct.pack('<H', 1) + b'\x00\x00'
        elif code == 273:  # StripOffsets
            if num_strips == 1:
                val_bytes = struct.pack('<I', strip_offsets[0])
            else:
                val_bytes = struct.pack('<I', strip_offsets_array_start)
        elif code == 278:  # RowsPerStrip
            val_bytes = struct.pack('<I', rows_per_strip)
        elif code == 279:  # StripByteCounts
            if num_strips == 1:
                val_bytes = struct.pack('<I', strip_byte_counts[0])
            else:
                val_bytes = struct.pack('<I', strip_counts_array_start)
        elif code == 282:  # XResolution
            val_bytes = struct.pack('<I', overflow_start + xres_offset)
        elif code == 283:  # YResolution
            val_bytes = struct.pack('<I', overflow_start + yres_offset)
        elif code == 296:  # ResolutionUnit
            val_bytes = struct.pack('<H', 1) + b'\x00\x00'
        elif code == 339:  # SampleFormat
            val_bytes = struct.pack('<H', 3) + b'\x00\x00'
        elif code == 33550:  # ModelPixelScaleTag
            val_bytes = struct.pack('<I', overflow_start + pixel_scale_offset)
        elif code == 33922:  # ModelTiepointTag
            val_bytes = struct.pack('<I', overflow_start + tiepoint_offset)
        elif code == 34735:  # GeoKeyDirectoryTag
            val_bytes = struct.pack('<I', overflow_start + geokey_offset)
        elif code == 42113:  # GDAL_NODATA
            if total_bytes <= 4:
                val_bytes = nodata_str + b'\x00' * (4 - len(nodata_str))
            else:
                val_bytes = struct.pack('<I', overflow_start + nodata_offset)
        else:
            val_bytes = struct.pack('<I', value)

        out += struct.pack('<HHI', code, dtype, count)
        out += val_bytes

    # Next IFD offset = 0
    out += struct.pack('<I', 0)

    # Overflow data
    out += bytes(overflow_data)

    # Strip offsets array
    if num_strips > 1:
        for so in strip_offsets:
            out += struct.pack('<I', so)

    # Strip byte counts array
    if num_strips > 1:
        for sc in strip_byte_counts:
            out += struct.pack('<I', sc)

    # Strip data
    for cs in compressed_strips:
        out += cs

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'wb') as f:
        f.write(out)


# ---------------------------------------------------------------------------
# Main generation logic
# ---------------------------------------------------------------------------

def generate_raster(
    width: int,
    height: int,
    output_path: Path,
    use_nightlight: bool = False,
    sigma_scale: float = 1.0,
    noise_strength: float = 0.005,
    seed: int = 42,
):
    """Generate a single synthetic raster and save as GeoTIFF."""
    rng = np.random.default_rng(seed)
    label = "nightlights" if use_nightlight else "population"
    logger.info("Generating %dx%d %s raster", width, height, label)

    lon_grid, lat_grid = _make_grid(width, height)
    data = np.zeros((height, width), dtype=np.float64)

    all_cities = MAJOR_CITIES + _generate_minor_cities(rng)

    _add_city_blobs(
        data, lon_grid, lat_grid, all_cities,
        scale_factor=sigma_scale,
        use_nightlight=use_nightlight,
    )

    # Add noise (skip gaussian blur for the 5km grids to save time/memory)
    noise = rng.exponential(scale=noise_strength, size=data.shape).astype(np.float32)
    if width <= 2000:
        noise = _gaussian_blur_numpy(noise, sigma_pixels=2)
    data += noise

    if use_nightlight:
        _add_coastline_glow(data, lon_grid, lat_grid, strength=0.03)

    # Scale to realistic value ranges
    max_val = data.max()
    if use_nightlight:
        if max_val > 0:
            data = (data / max_val) * 63.0
    else:
        if max_val > 0:
            data = (data / max_val) * 50000.0

    data = data.astype(np.float32)

    _write_geotiff(output_path, data)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("Wrote %s (%.1f MB)", output_path.name, size_mb)


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    configs = [
        # (width, height, filename, nightlight, sigma_scale, noise_strength)
        (2000, 1000, "kontur_pop_20km.tif",          False, 1.0,  0.005),
        (8000, 4000, "kontur_pop_5km.tif",           False, 0.25, 0.003),
        (2000, 1000, "viirs_nightlights_20km.tif",   True,  1.0,  0.004),
        (8000, 4000, "viirs_nightlights_5km.tif",    True,  0.25, 0.002),
    ]

    for width, height, filename, nightlight, sigma_scale, noise_str in configs:
        generate_raster(
            width=width,
            height=height,
            output_path=OUTPUT_DIR / filename,
            use_nightlight=nightlight,
            sigma_scale=sigma_scale,
            noise_strength=noise_str,
        )

    logger.info("All test data generated successfully.")
    print("\nOutput files:")
    for _, _, filename, *_ in configs:
        p = OUTPUT_DIR / filename
        size_mb = p.stat().st_size / (1024 * 1024)
        print(f"  {p}  ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
