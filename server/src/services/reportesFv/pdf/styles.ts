// CSS del reporte fotovoltaico, portado LITERAL del <style> de
// templates/reporte.html del sistema Python. Se extrajo tal cual para que el
// PDF se vea idéntico al que ya reciben los clientes. Marca Voltia azul #0a4f86.
//
// String.raw para no interpretar secuencias de escape dentro del CSS.

export const REPORTE_FV_STYLES = String.raw`
        @page {
            size: A4;
            margin: 14mm;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            color: #1f2937;
            background: #f3f6fa;
            line-height: 1.35;
        }

        .page {
            max-width: 980px;
            margin: 24px auto;
            background: #ffffff;
            padding: 28px 32px 32px 32px;
            box-shadow: 0 2px 14px rgba(0, 0, 0, 0.08);
        }

        .logo-wrap {
            text-align: center;
            margin-bottom: 14px;
        }

        .logo {
            max-width: 280px;
            max-height: 110px;
            height: auto;
        }

        .title {
            text-align: center;
            margin: 10px 0 2px 0;
            font-size: 22px;
            font-weight: 700;
            color: #0a4f86;
        }

        .subtitle {
            text-align: center;
            margin: 0 0 16px 0;
            font-size: 14px;
            color: #4b5563;
        }

        .section {
            border: 1.5px solid #2e3a46;
            margin-bottom: 14px;
            background: #ffffff;
        }

        .section-header {
            background: #0a4f86;
            color: white;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.6px;
            text-transform: uppercase;
            padding: 9px 12px;
        }

        .section-body {
            padding: 12px 14px;
        }

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }

        .grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .data-table td {
            padding: 7px 6px;
            border-bottom: 1px solid #d7dee6;
            vertical-align: top;
        }

        .data-table tr:last-child td {
            border-bottom: none;
        }

        .label {
            width: 44%;
            color: #334155;
            font-weight: 700;
        }

        .value {
            color: #111827;
            text-align: right;
        }

        .kpi-card {
            border: 1px solid #d6dde6;
            background: #f8fbff;
            padding: 12px 10px;
            min-height: 80px;
        }

        .roi-highlight {
            border: 2px solid #0a4f86;
            background: linear-gradient(135deg, #eef6ff 0%, #dbeafe 100%);
            padding: 18px 20px;
        }

        .roi-topline {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 16px;
            margin-bottom: 10px;
        }

        .roi-copy {
            flex: 1;
        }

        .roi-eyebrow {
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.7px;
            text-transform: uppercase;
            color: #0a4f86;
            margin-bottom: 4px;
        }

        .roi-headline {
            font-size: 22px;
            font-weight: 800;
            line-height: 1.15;
            color: #083e69;
            margin: 0;
        }

        .roi-subtitle {
            margin-top: 6px;
            font-size: 13px;
            color: #1d4f7a;
        }

        .roi-note {
            margin-top: 10px;
            font-size: 12px;
            line-height: 1.5;
            color: #7c2d12;
            background: rgba(255, 247, 237, 0.95);
            border: 1px solid #fed7aa;
            border-radius: 8px;
            padding: 10px 12px;
        }

        .roi-big-number {
            font-size: 42px;
            font-weight: 800;
            line-height: 1;
            color: #083e69;
            white-space: nowrap;
        }

        .roi-progress {
            width: 100%;
            height: 28px;
            background: #c7dbef;
            border-radius: 999px;
            overflow: hidden;
            border: 1px solid #93b9df;
        }

        .roi-progress-fill {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 12px;
            box-sizing: border-box;
            background: linear-gradient(90deg, #083e69 0%, #062f50 100%);
            color: white;
            font-size: 12px;
            font-weight: 800;
            min-width: 0;
        }

        .roi-progress-fill.is-small {
            justify-content: flex-start;
            padding-left: 12px;
            padding-right: 0;
        }

        .roi-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 12px;
        }

        .roi-stat {
            background: rgba(255, 255, 255, 0.75);
            border: 1px solid #bfd7ef;
            padding: 10px 12px;
            border-radius: 8px;
        }

        .roi-stat-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #0a4f86;
            margin-bottom: 4px;
        }

        .roi-stat-value {
            font-size: 18px;
            font-weight: 800;
            color: #083e69;
        }

        .kpi-label {
            font-size: 12px;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 6px;
            font-weight: 700;
            letter-spacing: 0.4px;
        }

        .kpi-value {
            font-size: 24px;
            font-weight: 700;
            color: #0a4f86;
            line-height: 1.1;
        }

        .kpi-unit {
            font-size: 13px;
            color: #475569;
            margin-top: 4px;
        }

        .summary-card {
            border: 1px solid #c9dff3;
            background: #f8fbff;
            padding: 12px 12px 10px 12px;
            min-height: 106px;
        }

        .summary-card-cost {
            background: #edf5fd;
        }

        .summary-card-current {
            background: #e3f0fb;
        }

        .summary-card-savings {
            background: linear-gradient(135deg, #0a4f86 0%, #083e69 100%);
            border-color: #083e69;
            color: white;
        }

        .summary-title {
            font-size: 12px;
            text-transform: uppercase;
            color: #4b5563;
            margin-bottom: 8px;
            font-weight: 800;
            letter-spacing: 0.4px;
        }

        .summary-card-savings .summary-title {
            color: #dbeafe;
        }

        .summary-lines {
            display: grid;
            gap: 4px;
        }

        .summary-line {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 10px;
            font-size: 12px;
        }

        .summary-line-label {
            font-weight: 700;
            color: #334155;
        }

        .summary-line-value {
            font-weight: 800;
            color: #083e69;
            white-space: nowrap;
        }

        .summary-card-savings .summary-line-label,
        .summary-card-savings .summary-line-value {
            color: white;
        }

        .compare-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .section,
        .section-body,
        .kpi-card,
        .bar-wrap,
        .note-box,
        .alert-box,
        .data-table,
        .compare-table,
        .data-table tr,
        .compare-table tr {
            break-inside: avoid-page;
            page-break-inside: avoid;
        }

        .compare-table th,
        .compare-table td {
            border: 1px solid #cbd5e1;
            padding: 9px 8px;
            overflow-wrap: break-word;
            word-break: normal;
        }

        .compare-table thead {
            display: table-header-group;
        }

        .compare-table th {
            background: #eaf3fb;
            color: #0a4f86;
            font-weight: 700;
            text-align: center;
        }

        .compare-table td {
            text-align: right;
        }

        .compare-table td:first-child,
        .compare-table th:first-child {
            text-align: left;
            font-weight: 700;
        }

        .total-row td {
            background: #f1f7fd;
            font-weight: 700;
            color: #0a4f86;
        }

        .compare-row-emphasis td {
            font-weight: 700;
        }

        .compare-row-cost td {
            background: #e8f1fb;
            color: #083e69;
        }

        .compare-row-current td {
            background: #d8e9f8;
            color: #062f50;
        }

        .compare-row-savings td {
            background: #0a4f86;
            color: #ffffff;
            font-weight: 800;
            font-size: 14px;
        }

        .compare-row-savings td:first-child {
            color: #ffffff;
        }

        .note-box {
            border: 1px solid #cbd5e1;
            background: #f8fbff;
            padding: 14px 16px;
            font-size: 12.5px;
            line-height: 1.6;
            color: #334155;
        }

        .additional-notes {
            min-height: 28px;
        }

        .alert-box {
            border: 2px solid #b91c1c;
            background: #fef2f2;
            color: #991b1b;
            padding: 14px 16px;
            font-size: 13px;
            line-height: 1.6;
            font-weight: 700;
        }

        .empty-notes {
            min-height: 24px;
        }

        .feedback-wrap {
            margin: 0 0 18px 0;
        }

        .feedback-banner {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 18px;
            padding: 16px 18px;
            border: 1px solid #bfd7ef;
            background: linear-gradient(135deg, #eef6ff 0%, #dbeafe 100%);
            border-radius: 12px;
        }

        .feedback-copy {
            flex: 1;
        }

        .feedback-title {
            margin: 0 0 4px 0;
            font-size: 15px;
            font-weight: 800;
            color: #083e69;
        }

        .feedback-text {
            margin: 0;
            font-size: 12.5px;
            line-height: 1.55;
            color: #334155;
        }

        .feedback-button {
            display: inline-block;
            text-decoration: none;
            border: none;
            background: #0a4f86;
            color: white;
            padding: 12px 18px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.3px;
            border-radius: 8px;
            box-shadow: 0 6px 14px rgba(10, 79, 134, 0.18);
            white-space: nowrap;
        }

        .feedback-contact {
            display: none;
            margin-top: 8px;
            font-size: 11.5px;
            color: #475569;
        }

        .footer {
            margin-top: 18px;
            padding-top: 10px;
            border-top: 1px solid #dbe3ec;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
        }

        .intro {
            font-size: 13px;
            line-height: 1.6;
            color: #334155;
        }

        ul {
            margin: 8px 0 0 18px;
            padding: 0;
        }

        li {
            margin-bottom: 6px;
        }

        .bar-wrap {
            margin-top: 8px;
            margin-bottom: 14px;
        }

        .bar-title {
            font-size: 13px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
        }

        .stacked-bar {
            width: 100%;
            height: 32px;
            background: #e5e7eb;
            display: flex;
            overflow: hidden;
            border-radius: 4px;
            border: 1px solid #cbd5e1;
        }

        .seg-autoconsumo {
            background: #0a4f86;
            color: white;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            padding: 0 8px;
            box-sizing: border-box;
        }

        .seg-red {
            background: #94a3b8;
            color: white;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            padding: 0 8px;
            box-sizing: border-box;
        }

        .seg-exportada {
            background: #60a5fa;
            color: white;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            padding: 0 8px;
            box-sizing: border-box;
        }

        .legend {
            display: flex;
            gap: 18px;
            margin-top: 8px;
            font-size: 12px;
            color: #475569;
            flex-wrap: wrap;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .legend-box {
            width: 14px;
            height: 14px;
            border-radius: 2px;
        }

        @media print {
            html, body {
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            body {
                background: white;
                font-size: 10.8px;
            }

            .feedback-wrap {
                margin-bottom: 10px;
            }

            .feedback-banner {
                padding: 12px 14px;
                border-radius: 10px;
                gap: 12px;
            }

            .feedback-title {
                font-size: 13px;
            }

            .feedback-text {
                font-size: 11px;
            }

            .feedback-button {
                display: none;
            }

            .feedback-contact {
                display: block;
            }

            .page {
                box-shadow: none;
                margin: 0;
                max-width: none;
                padding: 0;
            }

            .logo {
                max-width: 230px;
                max-height: 86px;
            }

            .title {
                margin: 6px 0 2px 0;
                font-size: 19px;
            }

            .subtitle {
                margin: 0 0 10px 0;
                font-size: 12px;
            }

            .section {
                margin-bottom: 8px;
            }

            .section-body {
                padding: 8px 9px;
            }

            .section-header {
                padding: 7px 10px;
                font-size: 12px;
            }

            .section-header {
                break-after: avoid-page;
                page-break-after: avoid;
            }

            .grid-2,
            .grid-3 {
                gap: 8px;
            }

            .kpi-card {
                padding: 8px;
                min-height: 60px;
            }

            .kpi-value {
                font-size: 18px;
            }

            .kpi-label {
                margin-bottom: 4px;
                font-size: 11px;
            }

            .kpi-unit {
                font-size: 11px;
                margin-top: 2px;
            }

            .roi-headline {
                font-size: 17px;
            }

            .roi-big-number {
                font-size: 30px;
            }

            .roi-progress {
                height: 20px;
            }

            .roi-stat-value {
                font-size: 14px;
            }

            .roi-highlight {
                padding: 14px 16px;
            }

            .roi-topline {
                margin-bottom: 8px;
            }

            .roi-subtitle {
                font-size: 12px;
            }

            .roi-note {
                font-size: 10.5px;
                padding: 8px 10px;
                margin-top: 8px;
            }

            .roi-stats {
                gap: 8px;
                margin-top: 10px;
            }

            .roi-stat {
                padding: 8px 10px;
            }

            .summary-card {
                padding: 10px 10px 8px 10px;
                min-height: 92px;
            }

            .summary-title {
                font-size: 11px;
                margin-bottom: 6px;
            }

            .summary-line {
                font-size: 11px;
            }

            .summary-lines {
                gap: 3px;
            }

            .compare-table,
            .data-table,
            .intro,
            .note-box,
            .alert-box {
                font-size: 11.5px;
            }

            .compare-table th,
            .compare-table td {
                padding: 7px 6px;
            }

            .data-table td {
                padding: 6px 5px;
            }

            .bar-title,
            .legend,
            .footer {
                font-size: 11px;
            }
        }
`;
