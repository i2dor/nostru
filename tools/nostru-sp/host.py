#!/usr/bin/env python3
"""
Nostru Silent Payments native host.
Protocol: Chrome native messaging (4-byte LE length prefix).
Actions : identify | scan | scan_tx | scan_esplora | scan_frigate | sweep
Deps    : zero external packages; pure Python 3.9+ stdlib only.
"""
import sys, json, struct, hashlib, os, urllib.request, urllib.error, socket, ssl
from concurrent.futures import ThreadPoolExecutor
from typing import Any

# ── secp256k1 ──────────────────────────────────────────────────────────────

P  = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N  = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8

# A point is either a (x, y) tuple or None (point at infinity)
Point = tuple[int, int] | None
INF: Point = None


def _inv(x: int) -> int:
    return pow(x, P - 2, P)


def point_add(p1: Point, p2: Point) -> Point:
    if p1 is None: return p2
    if p2 is None: return p1
    x1, y1 = p1; x2, y2 = p2
    if x1 == x2:
        if y1 != y2: return INF
        lam = 3 * x1 * x1 * _inv(2 * y1) % P
    else:
        lam = (y2 - y1) * _inv(x2 - x1) % P
    x3 = (lam * lam - x1 - x2) % P
    return (x3, (lam * (x1 - x3) - y1) % P)


def point_mul(k: int, p: Point) -> Point:
    r: Point = INF
    while k:
        if k & 1: r = point_add(r, p)
        p = point_add(p, p)
        k >>= 1
    return r


G = (Gx, Gy)


def point_from_bytes(b: bytes):
    if len(b) != 33:
        raise ValueError("expected 33-byte compressed point")
    x = int.from_bytes(b[1:], 'big')
    y2 = (pow(x, 3, P) + 7) % P
    y  = pow(y2, (P + 1) // 4, P)
    if (y & 1) != (b[0] & 1): y = P - y
    return (x, y)


def point_to_bytes(pt: tuple[int, int]) -> bytes:
    x, y = pt
    return bytes([0x02 | (y & 1)]) + x.to_bytes(32, 'big')


# ── Tagged hash (BIP-340) ──────────────────────────────────────────────────

def tagged_hash(tag: str, data: bytes) -> bytes:
    h = hashlib.sha256(tag.encode()).digest()
    return hashlib.sha256(h + h + data).digest()


# ── BIP-340 Schnorr signing ────────────────────────────────────────────────

def schnorr_sign(msg: bytes, d: int) -> bytes:
    P_pt = point_mul(d, G)
    if P_pt is None: raise ValueError("invalid private key")
    Px, Py = P_pt
    a = d if not (Py & 1) else N - d            # normalise to even-Y point
    t = (a ^ int.from_bytes(tagged_hash('BIP0340/aux', os.urandom(32)), 'big')).to_bytes(32, 'big')
    rand = tagged_hash('BIP0340/nonce', t + Px.to_bytes(32, 'big') + msg)
    k0 = int.from_bytes(rand, 'big') % N
    if k0 == 0: raise ValueError("zero nonce")
    R = point_mul(k0, G)
    if R is None: raise ValueError("zero R point")
    Rx, Ry = R
    k = k0 if not (Ry & 1) else N - k0
    e = int.from_bytes(tagged_hash('BIP0340/challenge',
                                    Rx.to_bytes(32, 'big') + Px.to_bytes(32, 'big') + msg), 'big') % N
    s = (k + e * a) % N
    return Rx.to_bytes(32, 'big') + s.to_bytes(32, 'big')


# ── Segwit address decode (bech32 / bech32m) ──────────────────────────────

_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]


def _polymod(values: list[int]) -> int:
    chk = 1
    for v in values:
        b = chk >> 25
        chk = (chk & 0x1ffffff) << 5 ^ v
        for i in range(5): chk ^= _GEN[i] if (b >> i) & 1 else 0
    return chk


def _hrp_expand(hrp: str) -> list[int]:
    return [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp]


def decode_address(addr: str) -> tuple[int, bytes]:
    """Return (witness_version, witness_program). Raises ValueError on bad input."""
    addr = addr.lower()
    pos = addr.rfind('1')
    if pos < 1: raise ValueError("no bech32 separator")
    hrp = addr[:pos]
    try:
        data = [_CHARSET.index(c) for c in addr[pos + 1:]]
    except ValueError:
        raise ValueError("invalid character in address")
    if len(data) < 8: raise ValueError("address too short")
    ver = data[0]
    const = 1 if ver == 0 else 0x2bc830a3
    if _polymod(_hrp_expand(hrp) + data) != const:
        raise ValueError("bad checksum")
    acc = bits = 0
    prog: list[int] = []
    for v in data[1:-6]:
        acc = (acc << 5) | v
        bits += 5
        while bits >= 8:
            bits -= 8
            prog.append((acc >> bits) & 0xff)
    return ver, bytes(prog)


def spk_from_address(addr: str) -> bytes:
    ver, prog = decode_address(addr)
    op = 0x00 if ver == 0 else 0x50 + ver
    return bytes([op, len(prog)]) + prog


# ── Bitcoin primitives ─────────────────────────────────────────────────────

def varint(n: int) -> bytes:
    if n < 0xfd: return bytes([n])
    if n <= 0xffff: return b'\xfd' + n.to_bytes(2, 'little')
    if n <= 0xffffffff: return b'\xfe' + n.to_bytes(4, 'little')
    return b'\xff' + n.to_bytes(8, 'little')


def le32(n: int) -> bytes: return n.to_bytes(4, 'little')
def le64(n: int) -> bytes: return n.to_bytes(8, 'little')


# ── BIP-341 sighash (key path, SIGHASH_DEFAULT) ───────────────────────────

def bip341_sighash(version: int, locktime: int, inputs: list[dict[str, Any]],
                   outputs: list[dict[str, Any]], in_idx: int) -> bytes:
    sha = hashlib.sha256

    def h(*parts: bytes) -> bytes:
        return sha(b''.join(parts)).digest()

    prevouts  = h(*[bytes.fromhex(i['txid'])[::-1] + le32(i['vout']) for i in inputs])
    amounts   = h(*[le64(i['value']) for i in inputs])
    spks_data = b''.join(varint(len(bytes.fromhex(i['scriptpubkey']))) + bytes.fromhex(i['scriptpubkey']) for i in inputs)
    spks_hash = h(spks_data)
    seqs      = h(*[b'\xff\xff\xff\xff' for _ in inputs])
    outs_data = b''.join(le64(o['value']) + varint(len(bytes.fromhex(o['scriptpubkey']))) + bytes.fromhex(o['scriptpubkey']) for o in outputs)
    outs_hash = h(outs_data)

    inp = inputs[in_idx]
    inp_spk = bytes.fromhex(inp['scriptpubkey'])

    preimage = (
        b'\x00'              # epoch
        + b'\x00'            # hash_type SIGHASH_DEFAULT
        + le32(version)
        + le32(locktime)
        + prevouts
        + amounts
        + spks_hash
        + seqs
        + outs_hash
        + b'\x00'            # spend_type: key path, no annex
        + bytes.fromhex(inp['txid'])[::-1] + le32(inp['vout'])
        + le64(inp['value'])
        + varint(len(inp_spk)) + inp_spk
        + b'\xff\xff\xff\xff'
        + le32(in_idx)
    )
    return tagged_hash('TapSighash', preimage)


# ── BIP-352 scanning helpers ───────────────────────────────────────────────

def sp_shared_secret(b_scan: int, tweak_hex: str) -> bytes:
    """ECDH: b_scan * TWEAK_POINT -> 33-byte compressed point bytes."""
    pt = point_from_bytes(bytes.fromhex(tweak_hex))
    result = point_mul(b_scan, pt)
    if result is None: raise ValueError("degenerate ECDH point")
    return point_to_bytes(result)


def sp_output_pubkey(shared: bytes, B_spend_bytes: bytes, k: int) -> bytes:
    t_k = int.from_bytes(tagged_hash('BIP0352/SharedSecret',
                                      shared + k.to_bytes(4, 'big')), 'big') % N
    P_k = point_add(point_from_bytes(B_spend_bytes), point_mul(t_k, G))
    if P_k is None: raise ValueError("degenerate output point")
    return point_to_bytes(P_k)


def sp_spend_scalar(b_spend: int, shared: bytes, k: int) -> int:
    t_k = int.from_bytes(tagged_hash('BIP0352/SharedSecret',
                                      shared + k.to_bytes(4, 'big')), 'big') % N
    return (b_spend + t_k) % N


# ── Index server HTTP client ───────────────────────────────────────────────

def fetch_tweaks(server: str, start: int, end: int) -> list[Any]:
    url = f"{server.rstrip('/')}/v1/index/block-tweaks?start_height={start}&end_height={end}"
    req = urllib.request.Request(url, headers={
        'Accept': 'application/json',
        'User-Agent': 'nostru-sp/1.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.URLError as e:
        raise RuntimeError(f"Index server unreachable: {e}")


# ── Txid-targeted scan helpers ────────────────────────────────────────────

def fetch_tx(txid: str) -> dict[str, Any]:
    url = f'https://mempool.space/api/tx/{txid}'
    req = urllib.request.Request(url, headers={
        'Accept': 'application/json',
        'User-Agent': 'nostru-sp/1.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
            if not isinstance(data, dict):
                raise RuntimeError(f'Unexpected response: {type(data).__name__}')
            return data
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f'Could not fetch tx from mempool.space: {e}')


def extract_eligible_inputs(vin: list[dict[str, Any]]) -> list[tuple[bytes, bytes, bytes]]:
    """Return (txid_le_32, vout_le4, pubkey_33) for BIP-352 eligible inputs."""
    eligible: list[tuple[bytes, bytes, bytes]] = []
    for inp in vin:
        txid_le = bytes.fromhex(inp['txid'])[::-1]
        vout_le  = inp['vout'].to_bytes(4, 'little')
        prevout  = inp.get('prevout') or {}
        ptype    = prevout.get('scriptpubkey_type', '')
        witness  = inp.get('witness', [])

        # P2WPKH: witness = [sig, pubkey]
        if ptype in ('v0_p2wpkh', 'p2wpkh') and len(witness) == 2:
            try:
                pk = bytes.fromhex(witness[1])
                if len(pk) == 33:
                    eligible.append((txid_le, vout_le, pk))
            except ValueError:
                pass

        # P2SH-P2WPKH: p2sh prevout, witness = [sig, pubkey]
        elif ptype == 'p2sh' and len(witness) == 2:
            try:
                pk = bytes.fromhex(witness[1])
                if len(pk) == 33:
                    eligible.append((txid_le, vout_le, pk))
            except ValueError:
                pass

        # P2TR key path: witness = [schnorr_sig] only (64 bytes, no annex)
        elif ptype in ('v1_p2tr', 'p2tr') and len(witness) == 1:
            spk = prevout.get('scriptpubkey', '')
            if len(spk) == 68 and spk[:4] == '5120':
                x_only = bytes.fromhex(spk[4:])
                eligible.append((txid_le, vout_le, b'\x02' + x_only))  # lift_x -> even y

    return eligible


def sp_tweak_from_inputs(eligible: list[tuple[bytes, bytes, bytes]]) -> str:
    """Compute BIP-352 tweak point: input_hash * A_sum. Returns 33-byte compressed hex."""
    A_sum: Point = INF
    for _, _, pk in eligible:
        A_sum = point_add(A_sum, point_from_bytes(pk))
    if A_sum is None:
        raise ValueError('Sum of input pubkeys is point at infinity')
    A_sum_bytes = point_to_bytes(A_sum)

    outpoints = [txid_le + vout_le for txid_le, vout_le, _ in eligible]
    lowest = min(outpoints)

    h = int.from_bytes(tagged_hash('BIP0352/Inputs', lowest + A_sum_bytes), 'big') % N
    tweak_pt = point_mul(h, point_from_bytes(A_sum_bytes))
    if tweak_pt is None:
        raise ValueError('Tweak point is point at infinity')
    return point_to_bytes(tweak_pt).hex()


def _fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={
        'Accept': 'application/json', 'User-Agent': 'nostru-sp/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        raise RuntimeError(f'Fetch failed: {e}')


def _fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={
        'Accept': 'text/plain', 'User-Agent': 'nostru-sp/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read().decode().strip()
    except Exception as e:
        raise RuntimeError(f'Fetch failed: {e}')


def check_sp_in_tx(tx: dict[str, Any], b_scan: int, B_spend_b: bytes) -> list[dict[str, Any]]:
    """BIP-352 receive check on a single transaction. Returns matched UTXOs."""
    eligible = extract_eligible_inputs(tx.get('vin', []))
    if not eligible:
        return []
    p2tr: list[tuple[int, bytes, dict[str, Any]]] = []
    for i, out in enumerate(tx.get('vout', [])):
        try:
            spk = bytes.fromhex(out.get('scriptpubkey', ''))
        except ValueError:
            continue
        if len(spk) == 34 and spk[:2] == b'\x51\x20':
            p2tr.append((i, spk[2:], out))
    if not p2tr:
        return []
    try:
        shared = sp_shared_secret(b_scan, sp_tweak_from_inputs(eligible))
    except Exception:
        return []
    bh = (tx.get('status') or {}).get('block_height', 0)
    found: list[dict[str, Any]] = []
    matched: set[int] = set()
    k = 0
    while True:
        try:
            x_k = sp_output_pubkey(shared, B_spend_b, k)[1:]
        except Exception:
            break
        m = next((idx for idx, (vi, x, _) in enumerate(p2tr)
                  if vi not in matched and x == x_k), None)
        if m is None:
            break
        vi, x_only, out = p2tr[m]
        matched.add(vi)
        found.append({'txid': tx['txid'], 'vout': vi, 'value': out['value'],
                      'x_only_pubkey': x_only.hex(), 'k': k, 'block_height': bh,
                      'shared_secret': shared.hex()})
        k += 1
    return found


_ESPLORA_MAX_BLOCKS = 20
_ESPLORA_WORKERS    = 4


def action_scan_esplora(req: dict[str, Any]) -> dict[str, Any]:
    b_scan    = int(req['scan_priv'], 16)
    B_spend_b = bytes.fromhex(req['spend_pub'])
    birthday  = int(req.get('birthday_height', 0))
    tip_raw   = int(req.get('tip_height', 0))
    explorer  = req.get('explorer', 'https://mempool.space').rstrip('/')

    if not isinstance(explorer, str) or not explorer.startswith('https://'):
        return {'status': 'error', 'error': 'explorer must be an https:// URL'}

    if tip_raw == 0:
        try:
            tip_raw = int(_fetch_text(f'{explorer}/api/blocks/tip/height'))
        except Exception as e:
            return {'status': 'error', 'error': f'Could not fetch chain tip: {e}'}
    tip = tip_raw

    if tip < birthday:
        return {'status': 'error', 'error': f'tip ({tip}) < birthday ({birthday})'}

    n_blocks = tip - birthday + 1
    if n_blocks > _ESPLORA_MAX_BLOCKS:
        return {
            'status': 'error',
            'error': (f'Range too large ({n_blocks} blocks, max {_ESPLORA_MAX_BLOCKS}). '
                      f'Narrow the range or use the SP index server for larger scans.'),
        }

    found: list[dict[str, Any]] = []

    for height in range(birthday, tip + 1):
        try:
            bh_hash  = _fetch_text(f'{explorer}/api/block-height/{height}')
            info     = _fetch_json(f'{explorer}/api/block/{bh_hash}')
            if not isinstance(info, dict):
                raise RuntimeError(f'Unexpected block info for height {height}')
            tx_count = int(info.get('tx_count', 0))
        except Exception as e:
            return {'status': 'error', 'error': f'Block {height} fetch failed: {e}'}

        page_starts = list(range(0, tx_count, 25))

        def _get_page(start: int, _h: str = bh_hash) -> list[dict[str, Any]]:
            try:
                url = f'{explorer}/api/block/{_h}/txs' + (f'/{start}' if start else '')
                result = _fetch_json(url)
                return result if isinstance(result, list) else []
            except Exception:
                return []

        with ThreadPoolExecutor(max_workers=_ESPLORA_WORKERS) as pool:
            for page in pool.map(_get_page, page_starts):
                for tx in page:
                    found.extend(check_sp_in_tx(tx, b_scan, B_spend_b))

    return {'status': 'ok', 'utxos': found}


def action_scan_tx(req: dict[str, Any]) -> dict[str, Any]:
    b_scan    = int(req['scan_priv'], 16)
    B_spend_b = bytes.fromhex(req['spend_pub'])
    txid      = req.get('txid', '').strip()
    if not txid:
        return {'status': 'error', 'error': 'txid required'}
    try:
        tx = fetch_tx(txid)
    except RuntimeError as e:
        return {'status': 'error', 'error': str(e)}
    if not extract_eligible_inputs(tx.get('vin', [])):
        return {'status': 'error', 'error': 'No eligible inputs (need P2WPKH, P2SH-P2WPKH, or P2TR key-path)'}
    return {'status': 'ok', 'utxos': check_sp_in_tx(tx, b_scan, B_spend_b)}


# ── Sweep transaction builder ──────────────────────────────────────────────

def estimate_fee(n_inputs: int, fee_rate: int) -> int:
    # P2TR key-path: ~57.5 vB/input, P2TR/P2WPKH out: ~43 vB, overhead ~10.5 vB
    vsize = 11 + n_inputs * 58 + 43
    return vsize * fee_rate


def build_sweep_tx(utxos: list[dict[str, Any]], dest_spk: bytes, fee_rate: int, scalars: list[int]) -> tuple[bytes, int, int]:
    total = sum(u['value'] for u in utxos)
    fee   = estimate_fee(len(utxos), fee_rate)
    out_v = total - fee
    if out_v < 546:
        raise ValueError(f"Dust output after fee: {out_v} sats (fee {fee})")

    outputs = [{'value': out_v, 'scriptpubkey': dest_spk.hex()}]
    inputs  = [
        {
            'txid':        u['txid'],
            'vout':        u['vout'],
            'value':       u['value'],
            # P2TR scriptpubkey for this UTXO
            'scriptpubkey': ('5120' + u['x_only_pubkey']),
        }
        for u in utxos
    ]

    sigs = []
    for idx, (scalar) in enumerate(scalars):
        msg = bip341_sighash(2, 0, inputs, outputs, idx)
        sigs.append(schnorr_sign(msg, scalar))

    # Segwit tx serialization
    raw  = le32(2) + b'\x00\x01'               # version | marker | flag
    raw += varint(len(inputs))
    for inp in inputs:
        raw += bytes.fromhex(inp['txid'])[::-1]
        raw += le32(inp['vout'])
        raw += b'\x00'                          # empty scriptSig
        raw += b'\xff\xff\xff\xff'              # sequence
    raw += varint(1)
    raw += le64(out_v)
    raw += varint(len(dest_spk)) + dest_spk
    for sig in sigs:
        raw += varint(1) + varint(len(sig)) + sig   # witness: 1 item
    raw += le32(0)                                   # locktime
    return raw, fee, out_v


# ── Action handlers ────────────────────────────────────────────────────────

def action_identify(_req: dict[str, Any]) -> dict[str, Any]:
    return {'status': 'ok', 'version': '1.0.0', 'name': 'nostru.sp',
            'capabilities': ['scan', 'sweep']}


def action_scan(req: dict[str, Any]) -> dict[str, Any]:
    b_scan      = int(req['scan_priv'], 16)
    B_spend_hex = req['spend_pub']              # 33-byte compressed hex
    B_spend_b   = bytes.fromhex(B_spend_hex)
    server      = req.get('server', 'https://silentpayments.xyz/api')
    if not isinstance(server, str) or not server.startswith('https://'):
        return {'status': 'error', 'error': 'server must be an https:// URL'}
    birthday    = int(req.get('birthday_height', 0))
    tip_raw     = int(req.get('tip_height', 0))
    tip         = tip_raw if tip_raw > birthday else birthday + 1000

    CHUNK = 100
    found = []

    for start in range(birthday, tip + 1, CHUNK):
        end = min(start + CHUNK - 1, tip)
        try:
            blocks = fetch_tweaks(server, start, end)
        except RuntimeError as e:
            return {'status': 'error', 'error': str(e)}

        for block in blocks:
            bh = block.get('height') or block.get('block_height', 0)
            for tx in block.get('txs', []):
                tweak = tx.get('tweak') or tx.get('tweak_point')
                if not tweak:
                    continue
                try:
                    shared = sp_shared_secret(b_scan, tweak)
                    # BIP-352: k counts matched outputs, not vout index
                    p2tr: list[tuple[int, bytes, dict[str, Any]]] = []
                    for i, out in enumerate(tx.get('outputs', [])):
                        spk = bytes.fromhex(out.get('scriptpubkey', ''))
                        if len(spk) == 34 and spk[:2] == b'\x51\x20':
                            p2tr.append((i, spk[2:], out))
                    matched: set[int] = set()
                    k = 0
                    while True:
                        P_k = sp_output_pubkey(shared, B_spend_b, k)
                        x_k = P_k[1:]
                        m = next((idx for idx, (vi, x, _) in enumerate(p2tr)
                                  if vi not in matched and x == x_k), None)
                        if m is None:
                            break
                        vi, x_only, out = p2tr[m]
                        matched.add(vi)
                        found.append({
                            'txid':          tx['txid'],
                            'vout':          out.get('vout', vi),
                            'value':         out['value'],
                            'x_only_pubkey': x_only.hex(),
                            'k':             k,
                            'block_height':  bh,
                            'shared_secret': shared.hex(),
                        })
                        k += 1
                except Exception:
                    continue

    return {'status': 'ok', 'utxos': found}


def action_sweep(req: dict[str, Any]) -> dict[str, Any]:
    b_spend  = int(req['spend_priv'], 16)
    utxos    = req['utxos']
    dest     = req['destination']
    fee_rate = int(req.get('fee_rate', 10))

    try:
        dest_spk = spk_from_address(dest)
    except ValueError as e:
        return {'status': 'error', 'error': f"Bad destination: {e}"}

    scalars = [
        sp_spend_scalar(b_spend, bytes.fromhex(u['shared_secret']), u['k'])
        for u in utxos
    ]

    try:
        raw, fee, amount = build_sweep_tx(utxos, dest_spk, fee_rate, scalars)
    except ValueError as e:
        return {'status': 'error', 'error': str(e)}

    return {
        'status':     'ok',
        'raw_tx':     raw.hex(),
        'fee_sats':   fee,
        'amount_sats': amount,
    }


def action_scan_frigate(req: dict[str, Any]) -> dict[str, Any]:
    """Scan via a Frigate/Electrum SP server (blockchain.silentpayments.subscribe)."""
    b_scan    = int(req['scan_priv'], 16)
    B_spend_b = bytes.fromhex(req['spend_pub'])
    birthday  = int(req.get('birthday_height', 0))
    server    = req.get('server', '').strip()

    if not server:
        return {'status': 'error', 'error': 'server required (e.g. ssl://host:50002 or tcp://host:50001)'}

    if server.startswith('ssl://'):
        use_ssl, addr = True, server[6:]
    elif server.startswith('tcp://'):
        use_ssl, addr = False, server[6:]
    else:
        return {'status': 'error', 'error': 'server must start with ssl:// or tcp://'}

    if ':' in addr:
        host, port_str = addr.rsplit(':', 1)
        try:
            port = int(port_str)
        except ValueError:
            return {'status': 'error', 'error': f'invalid port: {port_str}'}
    else:
        host, port = addr, (50002 if use_ssl else 50001)

    b_scan_hex    = hex(b_scan)[2:].zfill(64)
    spend_pub_hex = B_spend_b.hex()

    try:
        raw_sock = socket.create_connection((host, port), timeout=30)
        if use_ssl:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode    = ssl.CERT_NONE   # allow self-signed certs
            raw_sock = ctx.wrap_socket(raw_sock, server_hostname=host)
        raw_sock.settimeout(60)   # per-recv timeout during scan
    except Exception as e:
        return {'status': 'error', 'error': f'Connection to {host}:{port} failed: {e}'}

    history_entries: list[dict[str, Any]] = []
    try:
        rpc = json.dumps({
            'id': 1,
            'method': 'blockchain.silentpayments.subscribe',
            'params': [b_scan_hex, spend_pub_hex, birthday, []],
        }) + '\n'
        raw_sock.sendall(rpc.encode())

        buf  = b''
        done = False
        while not done:
            try:
                chunk = raw_sock.recv(65536)
            except socket.timeout:
                break
            if not chunk:
                break
            buf += chunk
            while b'\n' in buf:
                line, buf = buf.split(b'\n', 1)
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue

                err = msg.get('error')
                if err:
                    raise RuntimeError(err.get('message', str(err)) if isinstance(err, dict) else str(err))

                if msg.get('method') == 'blockchain.silentpayments.subscribe':
                    params = msg.get('params', [])
                    # Params may be positional [subscription, progress, history]
                    # or a single dict {subscription, progress, history}
                    if params and isinstance(params[0], dict) and 'progress' in params[0]:
                        notif    = params[0]
                        progress = float(notif.get('progress', 0))
                        batch    = notif.get('history', [])
                    else:
                        progress = float(params[1]) if len(params) > 1 else 0.0
                        batch    = params[2]         if len(params) > 2 else []

                    if isinstance(batch, list):
                        history_entries.extend(batch)
                    if progress >= 1.0:
                        done = True
                        break
    except RuntimeError as e:
        raw_sock.close()
        return {'status': 'error', 'error': f'Server error: {e}'}
    except Exception as e:
        raw_sock.close()
        return {'status': 'error', 'error': f'Scan error: {e}'}
    finally:
        raw_sock.close()

    found: list[dict[str, Any]] = []
    for entry in history_entries:
        txid      = entry.get('tx_hash', '')
        tweak_key = entry.get('tweak_key', '')
        height    = int(entry.get('height', 0))
        if not txid or not tweak_key:
            continue
        try:
            shared = sp_shared_secret(b_scan, tweak_key)
        except Exception:
            continue
        try:
            tx = fetch_tx(txid)
        except RuntimeError:
            continue
        p2tr: list[tuple[int, bytes, dict[str, Any]]] = []
        for i, out in enumerate(tx.get('vout', [])):
            try:
                spk = bytes.fromhex(out.get('scriptpubkey', ''))
            except ValueError:
                continue
            if len(spk) == 34 and spk[:2] == b'\x51\x20':
                p2tr.append((i, spk[2:], out))
        matched: set[int] = set()
        k = 0
        while True:
            try:
                x_k = sp_output_pubkey(shared, B_spend_b, k)[1:]
            except Exception:
                break
            m = next((idx for idx, (vi, x, _) in enumerate(p2tr)
                      if vi not in matched and x == x_k), None)
            if m is None:
                break
            vi, x_only, out = p2tr[m]
            matched.add(vi)
            found.append({
                'txid': txid, 'vout': vi, 'value': out['value'],
                'x_only_pubkey': x_only.hex(), 'k': k, 'block_height': height,
                'shared_secret': shared.hex(),
            })
            k += 1

    return {'status': 'ok', 'utxos': found}


ACTIONS = {
    'identify':      action_identify,
    'scan':          action_scan,
    'scan_tx':       action_scan_tx,
    'scan_esplora':  action_scan_esplora,
    'scan_frigate':  action_scan_frigate,
    'sweep':         action_sweep,
}


# ── Native messaging protocol ──────────────────────────────────────────────

_MAX_MSG = 1_048_576  # Chrome native messaging hard cap: 1 MB

def recv() -> dict[str, Any]:
    header = sys.stdin.buffer.read(4)
    if len(header) < 4:
        raise EOFError
    length = struct.unpack('<I', header)[0]
    if length > _MAX_MSG:
        raise ValueError(f'message too large: {length} bytes')
    return json.loads(sys.stdin.buffer.read(length))  # type: ignore[no-any-return]


def send(msg: dict[str, Any]) -> None:
    data = json.dumps(msg, separators=(',', ':')).encode()
    sys.stdout.buffer.write(struct.pack('<I', len(data)) + data)
    sys.stdout.buffer.flush()


def main() -> None:
    while True:
        try:
            req = recv()
        except (EOFError, struct.error, json.JSONDecodeError):
            break
        action  = req.get('action', '')
        handler = ACTIONS.get(action)
        if handler is None:
            send({'status': 'error', 'error': f'unknown action: {action}'})
            continue
        try:
            send(handler(req))
        except Exception as e:
            send({'status': 'error', 'error': str(e)})


if __name__ == '__main__':
    main()
