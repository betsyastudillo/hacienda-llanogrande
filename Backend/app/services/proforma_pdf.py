import os
from datetime import datetime, timedelta
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session
from app.models.company import Company 

PROFORMAS_DIR = "uploads/proformas"
LOGO_PATH = "assets/logo.png"

GREEN = colors.HexColor("#2f5d3a")
LIGHT = colors.HexColor("#f1f0ea")
LINE = colors.HexColor("#d9d5cb")


def _money(value) -> str:
  return "$ " + f"{float(value or 0):,.0f}".replace(",", ".")


def _doc(company: Company) -> str:
  return f"{company.document_type or ''} {company.document_number or ''}".strip()


def generate_proforma_pdf(db: Session, payment, order, bank_account) -> str:
  seller = (
      db.query(Company)
      .filter(Company.company_type == "own", Company.is_active == True)  # noqa: E712
      .first()
  )
  customer = db.query(Company).filter(Company.id == order.company_id).first()

  if not seller:
      raise ValueError("Own company not found, cannot generate the proforma")
  if not customer:
      raise ValueError("Order company not found, cannot generate the proforma")

  folder = os.path.join(PROFORMAS_DIR, str(payment.id))
  os.makedirs(folder, exist_ok=True)
  file_path = os.path.join(folder, f"{payment.proforma_number}.pdf")

  base = getSampleStyleSheet()["Normal"]
  normal = ParagraphStyle("n", parent=base, fontName="Helvetica", fontSize=9, leading=12)
  bold = ParagraphStyle("b", parent=normal, fontName="Helvetica-Bold")
  small = ParagraphStyle("s", parent=normal, fontSize=8, textColor=colors.grey)
  title = ParagraphStyle("t", parent=normal, fontName="Helvetica-Bold", fontSize=18, textColor=GREEN, alignment=2, leading=22)
  right = ParagraphStyle("r", parent=normal, alignment=2)
  section = ParagraphStyle("sec", parent=bold, fontSize=10, textColor=GREEN)

  def p(text, style=normal):
    return Paragraph(escape(str(text)) if text not in (None, "") else "—", style)

  # Hora de Colombia (UTC-5, sin horario de verano)
  now = datetime.utcnow() - timedelta(hours=5)

  doc = SimpleDocTemplate(
    file_path,
    pagesize=A4,
    leftMargin=2 * cm,
    rightMargin=2 * cm,
    topMargin=1.8 * cm,
    bottomMargin=1.8 * cm,
    title=f"Proforma {payment.proforma_number}",
    author=seller.legal_name,
  )
  story = []

  # --- Encabezado: logo + número de proforma ---
  if os.path.exists(LOGO_PATH):
    w, h = ImageReader(LOGO_PATH).getSize()
    logo_w = 3.6 * cm
    logo = Image(LOGO_PATH, width=logo_w, height=logo_w * h / w)
  else:
    logo = p(seller.display_name or seller.legal_name, bold)

  header = Table(
    [[logo, [Paragraph("PROFORMA", title),
            Paragraph(f"No. {escape(payment.proforma_number)}", ParagraphStyle("x", parent=right, fontName="Helvetica-Bold")),
            Paragraph(f"Fecha: {now.strftime('%d/%m/%Y')}", right)]]],
    colWidths=[8 * cm, 9 * cm],
  )
  header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
  story += [header, Spacer(1, 0.5 * cm)]

  # --- Vendedor y cliente ---
  def party(label, c):
    return [
      Paragraph(label, section),
      p(c.legal_name, bold),
      p(_doc(c)),
      p(c.fiscal_address or c.address),
      p(f"Tel. {c.fiscal_phone or c.phone or '—'}"),
      p(c.fiscal_email or c.email),
    ]

  parties = Table([[party("Emisor", seller), party("Cliente", customer)]], colWidths=[8.5 * cm, 8.5 * cm])
  parties.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("LINEBEFORE", (1, 0), (1, 0), 0.5, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
  ]))
  story += [parties, Spacer(1, 0.6 * cm)]

  # --- Productos ---
  rows = [[p("Producto", bold), p("Cantidad", bold), p("Precio unitario", bold), p("Subtotal", bold)]]
  for item in order.items:
    unit = item.product.unit if item.product else ""
    rows.append([
      p(item.product.name if item.product else "Producto"),
      p(f"{item.quantity_m3} {unit}".strip()),
      p(_money(item.unit_price), right),
      p(_money(item.subtotal), right),
    ])

  items_table = Table(rows, colWidths=[7.2 * cm, 3 * cm, 3.4 * cm, 3.4 * cm], repeatRows=1)
  items_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
    ("LINEBELOW", (0, 0), (-1, -1), 0.25, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
  ]))
  story += [items_table, Spacer(1, 0.3 * cm)]

  # --- Totales (el IVA siempre se muestra, aunque sea 0) ---
  totals = Table(
    [
      [p("Subtotal"), p(_money(order.subtotal), right)],
      [p("IVA"), p(_money(order.tax), right)],
      [p("Total a pagar", bold), p(_money(order.total), ParagraphStyle("tt", parent=right, fontName="Helvetica-Bold", fontSize=11))],
    ],
    colWidths=[3.4 * cm, 3.4 * cm],
    hAlign="RIGHT",
  )
  totals.setStyle(TableStyle([
    ("LINEABOVE", (0, 2), (-1, 2), 0.75, GREEN),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
  ]))
  story += [totals, Spacer(1, 0.7 * cm)]

  # --- Cuenta para consignar ---
  holder_doc = f"{bank_account.account_holder_document_type or ''} {bank_account.account_holder_document_number or ''}".strip()
  bank_rows = [
    [p("Banco", bold), p(bank_account.bank_name)],
    [p("Tipo de cuenta", bold), p(str(bank_account.account_type).capitalize())],
    [p("Número de cuenta", bold), p(bank_account.account_number)],
    [p("Titular", bold), p(bank_account.account_holder_name)],
    [p("Documento del titular", bold), p(holder_doc)],
  ]
  if bank_account.agreement_number:
    bank_rows.append([p("Convenio", bold), p(bank_account.agreement_number)])

  bank_table = Table(bank_rows, colWidths=[5 * cm, 12 * cm])
  bank_table.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("BACKGROUND", (0, 0), (0, -1), LIGHT),
    ("LINEBELOW", (0, 0), (-1, -2), 0.25, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
  ]))
  story += [Paragraph("Datos para consignar", section), Spacer(1, 0.2 * cm), bank_table, Spacer(1, 0.2 * cm)]
  story.append(p(f"Consigna el valor exacto y sube el comprobante en la plataforma, indicando la referencia {payment.proforma_number}.", small))

  fiscal_mail = customer.fiscal_email or customer.email
  story += [
    Spacer(1, 0.4 * cm),
    p(
      f"Una vez confirmado el pago, se emitirá la factura electrónica de venta "
      f"y se enviará al correo {fiscal_mail}.",
      small,
    ),
  ]

  story += [
    Spacer(1, 0.8 * cm),
    p("Este documento es una proforma y no constituye factura de venta.", small),
  ]

  doc.build(story)
  return f"/{file_path}"