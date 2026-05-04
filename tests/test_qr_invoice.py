"""
Tests for the Swiss QR-bill generator.

Locks the v2.6.x fix where the creditor name was hardcoded to 'Marion Web'
instead of using the payload (Marion Kindynis or whatever the user sends).
"""

import pytest
from unittest.mock import patch, MagicMock


def _make_qr_payload(**overrides):
    base = {
        'amount': 1234.50,
        'currency': 'CHF',
        'iban': 'CH9100206206785080G',
        'creditor': {
            'name': 'Marion Kindynis',
            'address': '4A chemin du Port',
            'zip': '1246',
            'city': 'Corsier',
            'country': 'CH',
        },
        'debtor': {
            'name': 'LN Avocats SA',
            'address': 'Rue de Bourg 12',
            'zip': '1003',
            'city': 'Lausanne',
            'country': 'CH',
        },
        'message': 'Facture 2025-001',
    }
    base.update(overrides)
    return base


class TestSwissQrCreditor:
    """The QR creditor must come from the payload, not be hardcoded."""

    def test_creditor_name_is_not_hardcoded_to_marion_web(self, client, auth_headers):
        """Regression test: payload {'creditor': {'name': 'Marion Kindynis'}}
        must end up in the QR data, not 'Marion Web'.
        """
        captured = {}

        def fake_make(payload_bytes, **kw):
            captured['payload'] = payload_bytes.decode('iso-8859-1', errors='replace')
            mock = MagicMock()
            # Simulate segno save() writing a tiny PNG to the buffer
            def save(buff, **kwargs):
                buff.write(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
            mock.save = save
            return mock

        with patch('api.ai_bp.segno.make', side_effect=fake_make):
            with patch('api.ai_bp.Image.open') as mock_img_open:
                # Stub PIL chain to avoid actually decoding the fake PNG
                mock_img = MagicMock()
                mock_img.size = (200, 200)
                mock_img.convert.return_value = mock_img
                mock_img_open.return_value = mock_img
                mock_img.save = lambda buff, **kw: buff.write(b'fakepng')

                resp = client.post(
                    '/api/v1/generate-qr',
                    json=_make_qr_payload(),
                    headers=auth_headers,
                )

        assert resp.status_code == 200, f"Failed: {resp.get_json()}"
        payload_str = captured['payload']
        lines = payload_str.split('\r\n')

        # Swiss QR-bill v2.0 layout:
        # [0] SPC, [1] 0200, [2] 1, [3] IBAN
        # [4] addr type, [5] creditor name, [6] street, [7] zip+city, ...
        assert lines[5] == 'Marion Kindynis', \
            f"REGRESSION: creditor name is {lines[5]!r}, must be 'Marion Kindynis' (was 'Marion Web')"
        assert lines[6] == '4A chemin du Port', f"Street wrong: {lines[6]!r}"
        assert lines[7] == '1246 Corsier', f"Zip+city wrong: {lines[7]!r}"
        assert lines[10] == 'CH', f"Country wrong: {lines[10]!r}"

    def test_debtor_uses_payload(self, client, auth_headers):
        """Same fix on the debtor side."""
        captured = {}

        def fake_make(payload_bytes, **kw):
            captured['payload'] = payload_bytes.decode('iso-8859-1', errors='replace')
            mock = MagicMock()
            mock.save = lambda buff, **kw: buff.write(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
            return mock

        with patch('api.ai_bp.segno.make', side_effect=fake_make):
            with patch('api.ai_bp.Image.open') as mock_img_open:
                mock_img = MagicMock()
                mock_img.size = (200, 200)
                mock_img.convert.return_value = mock_img
                mock_img_open.return_value = mock_img
                mock_img.save = lambda buff, **kw: buff.write(b'fakepng')

                resp = client.post(
                    '/api/v1/generate-qr',
                    json=_make_qr_payload(),
                    headers=auth_headers,
                )

        assert resp.status_code == 200
        lines = captured['payload'].split('\r\n')
        # Debtor block starts at line 21 (after the empty creditor reference + amount/currency)
        assert lines[21] == 'LN Avocats SA', f"Debtor name wrong: {lines[21]!r}"
        assert lines[22] == 'Rue de Bourg 12', f"Debtor street wrong: {lines[22]!r}"
        assert lines[23] == '1003 Lausanne', f"Debtor zip+city wrong: {lines[23]!r}"

    def test_debtor_block_empty_when_zip_missing(self, client, auth_headers):
        """If the user didn't fill an address, the debtor block is left empty
        instead of falling back to '1000 Lausanne' (which used to print on
        every invoice incorrectly)."""
        captured = {}

        def fake_make(payload_bytes, **kw):
            captured['payload'] = payload_bytes.decode('iso-8859-1', errors='replace')
            mock = MagicMock()
            mock.save = lambda buff, **kw: buff.write(b'\x89PNG\r\n\x1a\n' + b'\x00' * 100)
            return mock

        with patch('api.ai_bp.segno.make', side_effect=fake_make):
            with patch('api.ai_bp.Image.open') as mock_img_open:
                mock_img = MagicMock()
                mock_img.size = (200, 200)
                mock_img.convert.return_value = mock_img
                mock_img_open.return_value = mock_img
                mock_img.save = lambda buff, **kw: buff.write(b'fakepng')

                payload = _make_qr_payload()
                payload['debtor'] = {'name': 'Bob'}  # no zip/city
                resp = client.post('/api/v1/generate-qr', json=payload, headers=auth_headers)

        assert resp.status_code == 200
        lines = captured['payload'].split('\r\n')
        # Debtor block (positions 20-26 after creditor) should be empty
        assert lines[20] == '', f"Empty debtor type expected, got {lines[20]!r}"
        # No fallback to '1000 Lausanne'
        joined = '\r\n'.join(lines)
        assert '1000 Lausanne' not in joined, \
            "REGRESSION: '1000 Lausanne' is back as a fallback (should be empty)"
