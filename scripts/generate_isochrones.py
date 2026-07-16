#!/usr/bin/env python3
"""Generate the isochrone grid asset for the HR-diagram (cluster CMD) feature.

Fetches PARSEC v1.2S isochrones from the CMD web service (stev.oapd.inaf.it,
CMD 3.9, YBC bolometric corrections) in the Pan-STARRS1 photometric system and
writes the model-agnostic columnar JSON asset consumed by the frontend fitting
UI (see ptr_datalab/datalab/datalab_session/data_operations/HR_DIAGRAM_DESIGN.md,
section 6).

BANZAI reduces only gp/rp/ip/zs and zero-points them against ATLAS-REFCAT2,
which is on the PS1 system (LCO 'zs' is the PS1-z filter), so PS1 gP1/rP1/iP1/zP1
AB magnitudes are the matching absolute system for all four filters.

Each isochrone is decimated to a fixed number of points sampled uniformly by
arc length in magnitude space (evolutionary-stage boundaries are always kept),
which makes the shipped size independent of the source model's native sampling.

This is offline developer tooling: run it by hand, commit the JSON it writes.
Requires only python3 + requests. Examples:

  # single-slice spike
  python scripts/generate_isochrones.py --feh 0.0 --out /tmp/parsec_feh0.json

  # production grid
  python scripts/generate_isochrones.py --feh-min -2.0 --feh-max 0.3 --feh-step 0.1 \
      --out public/isochrones/parsec.json

The CMD server sends an incomplete TLS chain (leaf only, missing the ZeroSSL
intermediate), so default certificate verification fails on most Linux systems.
Pass --cacert with a bundle that includes the intermediate, or --insecure.
"""

import argparse
import datetime
import gzip
import json
import math
import re
import sys
import time
from pathlib import Path

import requests

CMD_ROOT = 'https://stev.oapd.inaf.it'
CMD_FORM_URL = f'{CMD_ROOT}/cgi-bin/cmd_3.9'
REQUEST_TIMEOUT_SECONDS = 300
SECONDS_BETWEEN_REQUESTS = 5
# The CMD server drops connections now and then (RemoteDisconnected mid-run has
# been observed), so every request gets a few attempts with growing pauses
MAX_FETCH_ATTEMPTS = 4
SECONDS_BETWEEN_ATTEMPTS = 15

PHOTSYS_FILE = 'YBC_tab_mag_odfnew/tab_mag_panstarrs1.dat'   # Pan-STARRS1, AB mags
# datalab filter name -> CMD table column
MAG_COLUMNS = {'gp': 'gP1mag', 'rp': 'rP1mag', 'ip': 'iP1mag', 'zs': 'zP1mag'}
FILTERS = list(MAG_COLUMNS)
MAG_SYSTEM = {name: 'AB' for name in FILTERS}

# PARSEC evolutionary-stage labels: 0=PMS 1=MS 2=SGB 3=RGB 4-6=core-He 7=E-AGB
# 8=TP-AGB 9=post-AGB. TP-AGB and beyond are dropped: a handful of stars per
# cluster, model mags dominated by pulsation/dust choices, and they add wild
# excursions the fitting UI doesn't want.
MAX_STAGE_LABEL = 7

# Complete CMD 3.9 form (defaults read from the live form 2026-07-06), so the
# CGI never falls back on server-side defaults we didn't choose. Values we vary
# are overridden per request in build_form().
CMD_FORM_DEFAULTS = {
    'cmd_version': '3.9',
    'track_parsec': 'parsec_CAF09_v1.2S',
    'track_omegai': '0.00',
    'track_colibri': 'parsec_CAF09_v1.2S_S_LMC_08_web',
    'track_postagb': 'no',
    'n_inTPC': '10',
    'eta_reimers': '0.2',
    'kind_interp': '1',
    'kind_postagb': '-1',
    'photsys_file': PHOTSYS_FILE,
    'photsys_version': 'YBCnewVega',
    'dust_sourceM': 'dpmod60alox40',
    'dust_sourceC': 'AMCSIC15',
    'kind_mag': '2',
    'kind_dust': '0',
    'extinction_av': '0.0',
    'extinction_coeff': 'constant',
    'extinction_curve': 'cardelli',
    'kind_LPV': '4',
    'imf_file': 'tab_imf/imf_kroupa_orig.dat',
    'isoc_isagelog': '1',               # age grid in log10(yr)
    'isoc_agelow': '1.0e9',
    'isoc_ageupp': '1.0e10',
    'isoc_dage': '0.0',
    'isoc_lagelow': '',                 # per request
    'isoc_lageupp': '',                 # per request
    'isoc_dlage': '',                   # per request
    'isoc_ismetlog': '1',               # metallicity as [M/H] (= [Fe/H], scaled solar)
    'isoc_zlow': '0.0152',
    'isoc_zupp': '0.03',
    'isoc_dz': '0.0',
    'isoc_metlow': '',                  # per request
    'isoc_metupp': '',                  # per request
    'isoc_dmet': '0.0',
    'output_kind': '0',                 # isochrone tables
    'output_evstage': '1',              # include the stage label column
    'lf_maginf': '-15',
    'lf_magsup': '20',
    'lf_deltamag': '0.5',
    'sim_mtot': '1.0e4',
    'submit_form': 'Submit',
}
CGI_FIELDS = [
    'dust_sourceC', 'dust_sourceM', 'extinction_coeff', 'extinction_curve',
    'isoc_isagelog', 'isoc_ismetlog', 'kind_LPV', 'output_gzip', 'output_kind',
    'photsys_version', 'track_colibri', 'track_parsec', 'track_postagb',
]


def build_form(feh, lage_min, lage_max, lage_step):
    form = dict(CMD_FORM_DEFAULTS)
    form['isoc_metlow'] = f'{feh:g}'
    form['isoc_metupp'] = f'{feh:g}'
    form['isoc_lagelow'] = f'{lage_min:g}'
    form['isoc_lageupp'] = f'{lage_max:g}'
    form['isoc_dlage'] = f'{lage_step:g}'
    # .cgifields is a repeated key, so send the form as a list of tuples
    return list(form.items()) + [('.cgifields', name) for name in CGI_FIELDS]


def request_with_retry(session, method, url, **kwargs):
    """Issue one HTTP request, retrying dropped connections/timeouts/5xx."""
    for attempt in range(1, MAX_FETCH_ATTEMPTS + 1):
        try:
            response = session.request(method, url, timeout=REQUEST_TIMEOUT_SECONDS, **kwargs)
            response.raise_for_status()
            return response
        except requests.exceptions.SSLError:
            raise   # not transient; let main() print the CA-chain hint
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout,
                requests.exceptions.HTTPError) as error:
            status = getattr(getattr(error, 'response', None), 'status_code', None)
            if status is not None and status < 500:
                raise
            if attempt == MAX_FETCH_ATTEMPTS:
                raise
            wait = SECONDS_BETWEEN_ATTEMPTS * attempt
            print(f'    attempt {attempt} failed ({type(error).__name__}), '
                  f'retrying in {wait}s ...', flush=True)
            time.sleep(wait)


def fetch_isochrone_table(session, feh, args):
    """POST one [Fe/H] slice request; return the ASCII isochrone table."""
    cache_file = None
    if args.raw_dir:
        grid = f'lage{args.lage_min:g}-{args.lage_max:g}-{args.lage_step:g}'
        cache_file = Path(args.raw_dir) / f'cmd39_panstarrs1_feh{feh:+.2f}_{grid}.dat'
        if cache_file.exists():
            print(f'  [Fe/H]={feh:+.2f}: using cached {cache_file}')
            return cache_file.read_text()

    form = build_form(feh, args.lage_min, args.lage_max, args.lage_step)
    print(f'  [Fe/H]={feh:+.2f}: querying CMD ...', flush=True)
    page = request_with_retry(session, 'POST', CMD_FORM_URL, data=form)
    match = re.search(r'output\d+\.dat', page.text)
    if not match:
        snippet = re.sub(r'<[^>]+>', ' ', page.text)
        snippet = ' '.join(snippet.split())[:600]
        raise RuntimeError(f'CMD returned no output link. Server said: {snippet}')
    data_url = f'{CMD_ROOT}/tmp/{match.group(0)}'
    table = request_with_retry(session, 'GET', data_url)
    if cache_file:
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(table.text)
    time.sleep(SECONDS_BETWEEN_REQUESTS)
    return table.text


def parse_cmd_table(text):
    """Parse a CMD .dat table into (column_names, rows of floats)."""
    columns = None
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith('#'):
            tokens = line.lstrip('#').split()
            if 'Zini' in tokens and 'logAge' in tokens:
                columns = tokens
            continue
        if columns is None:
            raise RuntimeError('CMD table data began before any column header line')
        values = line.split()
        if len(values) != len(columns):
            raise RuntimeError(f'CMD row has {len(values)} values for {len(columns)} columns')
        rows.append([float(v) for v in values])
    if not rows:
        raise RuntimeError('CMD table contained no data rows')
    return columns, rows


def group_by_isochrone(columns, rows):
    """Split table rows into per-(feh, log_age) isochrones, in file order.

    Returns {(feh, log_age): {'mass': [...], 'label': [...], '<filter>': [...]}}
    with TP-AGB/post-AGB rows dropped.
    """
    index = {name: columns.index(name) for name in ['MH', 'logAge', 'Mini', 'label']}
    for cmd_name in MAG_COLUMNS.values():
        index[cmd_name] = columns.index(cmd_name)

    isochrones = {}
    for row in rows:
        if row[index['label']] > MAX_STAGE_LABEL:
            continue
        key = (round(row[index['MH']], 3), round(row[index['logAge']], 3))
        entry = isochrones.setdefault(key, {'mass': [], 'label': []})
        entry['mass'].append(row[index['Mini']])
        entry['label'].append(int(row[index['label']]))
        for filter_name, cmd_name in MAG_COLUMNS.items():
            entry.setdefault(filter_name, []).append(row[index[cmd_name]])
    return isochrones


def decimate_indices(isochrone, n_target):
    """Pick ~n_target original points, uniform by arc length in mag space.

    Arc length is measured across all four magnitudes together so curvature in
    any blue/red CMD projection stays resolved. The first point of every
    evolutionary-stage run and the endpoints are always kept.
    """
    n = len(isochrone['mass'])
    if n <= n_target:
        return list(range(n))

    arc = [0.0]
    for i in range(1, n):
        step = math.sqrt(sum((isochrone[f][i] - isochrone[f][i - 1]) ** 2 for f in FILTERS))
        arc.append(arc[-1] + step)
    total = arc[-1]

    keep = {0, n - 1}
    for i in range(1, n):
        if isochrone['label'][i] != isochrone['label'][i - 1]:
            keep.add(i)
    if total > 0:
        j = 0
        for k in range(n_target):
            target = total * k / (n_target - 1)
            while j < n - 1 and arc[j + 1] < target:
                j += 1
            nearer = j if (j == n - 1 or target - arc[j] <= arc[j + 1] - target) else j + 1
            keep.add(nearer)
    return sorted(keep)


def build_asset(isochrones_by_key, args):
    feh_nodes = sorted({key[0] for key in isochrones_by_key})
    log_age_nodes = sorted({key[1] for key in isochrones_by_key})
    isochrones = []
    points_before, points_after = 0, 0
    for (feh, log_age), isochrone in sorted(isochrones_by_key.items()):
        indices = decimate_indices(isochrone, args.points)
        points_before += len(isochrone['mass'])
        points_after += len(indices)
        isochrones.append({
            'feh': feh,
            'log_age': log_age,
            'mass': [round(isochrone['mass'][i], 4) for i in indices],
            'mags': {f: [round(isochrone[f][i], 3) for i in indices] for f in FILTERS},
        })
    asset = {
        'model': 'PARSEC v1.2S + COLIBRI S_LMC (CMD 3.9, YBC bolometric corrections)',
        'generated': datetime.date.today().isoformat(),
        'source': CMD_FORM_URL,
        'photsys_file': PHOTSYS_FILE,
        'mag_system': MAG_SYSTEM,
        'filters': FILTERS,
        'feh_nodes': feh_nodes,
        'log_age_nodes': log_age_nodes,
        'isochrones': isochrones,
    }
    return asset, points_before, points_after


def summarize(asset, points_before, points_after, out_path):
    raw = json.dumps(asset, separators=(',', ':')).encode()
    gzipped = gzip.compress(raw, 6)
    n = len(asset['isochrones'])
    print(f'\nWrote {out_path}')
    print(f'  isochrones: {n} '
          f'({len(asset["feh_nodes"])} [Fe/H] x {len(asset["log_age_nodes"])} log-age nodes)')
    print(f'  points: {points_before} -> {points_after} after decimation '
          f'(mean {points_after / n:.0f}/isochrone)')
    print(f'  size: {len(raw) / 1e6:.2f} MB raw, {len(gzipped) / 1e6:.2f} MB gzip')
    per_isochrone = len(gzipped) / n
    # extrapolate single-slice spikes to the production default: 24 [Fe/H] nodes
    full_grid = 24 * len(asset['log_age_nodes'])
    print(f'  full-grid estimate (24 [Fe/H] x {len(asset["log_age_nodes"])} ages = '
          f'{full_grid} isochrones): ~{per_isochrone * full_grid / 1e6:.1f} MB gzip')


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--feh', type=float, action='append',
                        help='[Fe/H] node (repeatable); overrides --feh-min/max/step')
    # 0.1 dex [Fe/H] steps move the lower main sequence by 0.006-0.06 mag in
    # gp-rp (metal-poor -> metal-rich), about one photometric error bar per
    # slider stop; finer steps are indistinguishable on the plot. The +0.3 top
    # node keeps super-solar open clusters (e.g. NGC 6791) covered.
    parser.add_argument('--feh-min', type=float, default=-2.0)
    parser.add_argument('--feh-max', type=float, default=0.3)
    parser.add_argument('--feh-step', type=float, default=0.1)
    parser.add_argument('--lage-min', type=float, default=6.6)
    # CMD's age stepping excludes the upper bound, so ask past the last node we
    # want (10.10, old globulars); 10.13 is PARSEC's own upper validity limit
    parser.add_argument('--lage-max', type=float, default=10.13)
    parser.add_argument('--lage-step', type=float, default=0.05)
    parser.add_argument('--points', type=int, default=200,
                        help='decimation target per isochrone (default 200)')
    parser.add_argument('--out', required=True, help='output JSON path')
    parser.add_argument('--raw-dir', help='cache raw CMD responses here (skips refetching)')
    parser.add_argument('--cacert', help='CA bundle for stev.oapd.inaf.it (see module docstring)')
    parser.add_argument('--insecure', action='store_true',
                        help='disable TLS verification for the CMD server')
    return parser.parse_args()


def main():
    args = parse_args()
    if args.feh:
        feh_values = args.feh
    else:
        count = int(round((args.feh_max - args.feh_min) / args.feh_step)) + 1
        feh_values = [round(args.feh_min + i * args.feh_step, 3) for i in range(count)]

    session = requests.Session()
    # fresh socket per request: the CMD server silently closes idle keep-alive
    # connections, which surfaces as RemoteDisconnected on the next POST
    session.headers['Connection'] = 'close'
    if args.insecure:
        session.verify = False
        requests.packages.urllib3.disable_warnings()
    elif args.cacert:
        session.verify = args.cacert

    print(f'Fetching {len(feh_values)} [Fe/H] slice(s) from {CMD_FORM_URL}')
    isochrones_by_key = {}
    try:
        for feh in feh_values:
            text = fetch_isochrone_table(session, feh, args)
            columns, rows = parse_cmd_table(text)
            isochrones_by_key.update(group_by_isochrone(columns, rows))
    except requests.exceptions.SSLError:
        sys.exit('TLS verification failed: stev.oapd.inaf.it sends an incomplete '
                 'certificate chain. Re-run with --cacert <bundle including the '
                 'ZeroSSL intermediate> or --insecure.')

    asset, points_before, points_after = build_asset(isochrones_by_key, args)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w') as out_file:
        json.dump(asset, out_file, separators=(',', ':'))
    summarize(asset, points_before, points_after, out_path)


if __name__ == '__main__':
    main()
