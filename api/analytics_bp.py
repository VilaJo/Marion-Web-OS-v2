"""
Analytics Blueprint - Aggregated analytics endpoint.
Provides time tracking summaries, conversion rates, monthly revenue,
and new client counts.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from flask import Blueprint, jsonify, request
from pathlib import Path

from api.shared import (
    DESKTOP_PATH, FOLDER_STATUS_MAP, load_project_data,
    error_response,
)

logger = logging.getLogger('marion.analytics')

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/v1/analytics')


def _collect_all_projects():
    """Scan all project folders and return (project_path, data, status) tuples."""
    results = []
    for folder_name, status in FOLDER_STATUS_MAP.items():
        status_path = DESKTOP_PATH / folder_name
        if not status_path.exists():
            continue
        for entry in status_path.iterdir():
            if entry.is_dir() and not entry.name.startswith('.'):
                if folder_name == "Archivé":
                    # Check archive sub-categories
                    for sub in entry.iterdir():
                        if sub.is_dir() and not sub.name.startswith('.'):
                            data = load_project_data(sub)
                            results.append((sub, data, status))
                else:
                    data = load_project_data(entry)
                    results.append((entry, data, status))
    return results


def _load_timesheet(project_path):
    """Load timesheet.json for a project."""
    sheet_path = project_path / ".99_Admin" / "timesheet.json"
    if sheet_path.exists():
        try:
            with open(sheet_path, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return []


@analytics_bp.route('/summary', methods=['GET'])
def analytics_summary():
    """
    Return aggregated analytics:
    - timeByClient: real hours per client from timesheet.json
    - conversionRates: estimate->invoice and invoice->paid rates
    - monthlyRevenue: revenue per month for last 12 months
    - newClientsByMonth: new clients per month
    - avgPaymentDelay: average days between invoice date and payment
    """
    try:
        now = datetime.now()
        twelve_months_ago = now - timedelta(days=365)

        projects = _collect_all_projects()

        # ── Time by client ──────────────────────────────────────────────
        time_by_client = {}
        for project_path, data, status in projects:
            client_name = project_path.name
            logs = _load_timesheet(project_path)
            total_seconds = 0
            for entry in logs:
                duration = entry.get('duration', 0)
                if isinstance(duration, (int, float)):
                    total_seconds += duration
            total_hours = round(total_seconds / 3600, 2) if total_seconds > 0 else 0
            if total_hours > 0 or logs:
                time_by_client[client_name] = {
                    'hours': total_hours,
                    'entries': len(logs),
                }

        # ── Collect all invoices across projects ────────────────────────
        all_invoices = []
        revenue_by_client = defaultdict(float)
        for project_path, data, status in projects:
            client_name = project_path.name
            for inv in data.get('invoices', []):
                inv_copy = dict(inv)
                inv_copy['_clientName'] = client_name
                all_invoices.append(inv_copy)
                if inv.get('status') == 'Paid' and inv.get('type', 'Invoice') == 'Invoice':
                    revenue_by_client[client_name] += float(inv.get('amount', 0))

        # ── Conversion rates ────────────────────────────────────────────
        estimates = [i for i in all_invoices if i.get('type') == 'Estimate']
        invoices_only = [i for i in all_invoices if i.get('type', 'Invoice') == 'Invoice']
        paid_invoices = [i for i in invoices_only if i.get('status') == 'Paid']

        estimate_to_invoice = 0
        if len(estimates) > 0:
            # Count estimates that have a matching invoice for the same client
            converted = 0
            for est in estimates:
                client = est.get('_clientName')
                if any(inv.get('_clientName') == client and inv.get('type', 'Invoice') == 'Invoice'
                       for inv in all_invoices if inv.get('id') != est.get('id')):
                    converted += 1
            estimate_to_invoice = round((converted / len(estimates)) * 100, 1)

        invoice_to_paid = 0
        if len(invoices_only) > 0:
            invoice_to_paid = round((len(paid_invoices) / len(invoices_only)) * 100, 1)

        # ── Average payment delay ───────────────────────────────────────
        payment_delays = []
        for inv in paid_invoices:
            inv_date = inv.get('date', '')
            payments = inv.get('payments', [])
            if inv_date and payments:
                try:
                    d_invoice = datetime.strptime(inv_date[:10], '%Y-%m-%d')
                    # Use the last payment date
                    last_payment = max(payments, key=lambda p: p.get('date', ''))
                    d_paid = datetime.strptime(last_payment.get('date', inv_date)[:10], '%Y-%m-%d')
                    delay = (d_paid - d_invoice).days
                    if delay >= 0:
                        payment_delays.append(delay)
                except (ValueError, TypeError):
                    pass

        avg_payment_delay = round(sum(payment_delays) / len(payment_delays), 1) if payment_delays else 0

        # ── Monthly revenue (last 12 months) ────────────────────────────
        monthly_revenue = defaultdict(float)
        monthly_revenue_prev = defaultdict(float)
        for inv in paid_invoices:
            inv_date = inv.get('date', '')
            if not inv_date:
                continue
            try:
                d = datetime.strptime(inv_date[:10], '%Y-%m-%d')
                key = d.strftime('%Y-%m')
                amount = float(inv.get('amount', 0))
                if d >= twelve_months_ago:
                    monthly_revenue[key] += amount
                # Also collect previous year for comparison
                prev_year_start = twelve_months_ago - timedelta(days=365)
                if prev_year_start <= d < twelve_months_ago:
                    monthly_revenue_prev[key] += amount
            except (ValueError, TypeError):
                pass

        # Build ordered list for last 12 months
        months_list = []
        for i in range(11, -1, -1):
            d = now - timedelta(days=i * 30)
            key = d.strftime('%Y-%m')
            # Also compute previous year key
            prev_d = d.replace(year=d.year - 1) if d.month <= 12 else d
            try:
                prev_key = prev_d.strftime('%Y-%m')
            except ValueError:
                prev_key = ''
            months_list.append({
                'month': key,
                'label': d.strftime('%b %Y'),
                'revenue': round(monthly_revenue.get(key, 0), 2),
                'revenuePrevYear': round(monthly_revenue_prev.get(prev_key, 0), 2),
            })

        # ── New clients by month ────────────────────────────────────────
        new_clients_by_month = defaultdict(int)
        for project_path, data, status in projects:
            created = data.get('createdAt', '')
            if created:
                try:
                    d = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    if d.replace(tzinfo=None) >= twelve_months_ago:
                        key = d.strftime('%Y-%m')
                        new_clients_by_month[key] += 1
                except (ValueError, TypeError):
                    pass

        # ── Top clients with real time & revenue ────────────────────────
        top_clients = []
        all_client_names = set()
        for project_path, data, status in projects:
            all_client_names.add(project_path.name)

        for client_name in all_client_names:
            hours = time_by_client.get(client_name, {}).get('hours', 0)
            revenue = revenue_by_client.get(client_name, 0)
            hourly_rate = round(revenue / hours, 2) if hours > 0 else 0
            if revenue > 0 or hours > 0:
                top_clients.append({
                    'client': client_name,
                    'hours': hours,
                    'revenue': round(revenue, 2),
                    'hourlyRate': hourly_rate,
                })

        top_clients.sort(key=lambda x: x['revenue'], reverse=True)

        return jsonify({
            'success': True,
            'timeByClient': time_by_client,
            'conversionRates': {
                'estimateToInvoice': estimate_to_invoice,
                'invoiceToPaid': invoice_to_paid,
            },
            'avgPaymentDelay': avg_payment_delay,
            'monthlyRevenue': months_list,
            'newClientsByMonth': dict(new_clients_by_month),
            'topClients': top_clients[:20],
            'totals': {
                'totalInvoices': len(invoices_only),
                'totalPaid': len(paid_invoices),
                'totalEstimates': len(estimates),
                'totalRevenue': round(sum(revenue_by_client.values()), 2),
            },
        })
    except Exception as e:
        return error_response(e, user_msg="Erreur lors du calcul des analytiques.")
