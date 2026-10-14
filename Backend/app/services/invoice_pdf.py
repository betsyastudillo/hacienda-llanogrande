import os
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from num2words import num2words
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.models.company import Company
from app.services.pdf_helpers import full_address

INVOICES_DIR = "uploads/invoices"
LOGO_PATH = "assets/logo.png"
LOCAL_TZ = ZoneInfo("America/Bogota")

# Configurable: con la integración, esto vendrá de la empresa o del proveedor
SELLER_TAX_REGIME = "No responsable de IVA"
SELLER_DIAN_AUTH = "PRUEBA 00000000000000 (rango SIM1 a SIM1000)"

LINE = colors.HexColor("#444444")
PENDING = colors.HexColor("#a12a2a")


def _money(value) -> str:
  return "$" + f"{float(value or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _watermark(canvas, doc):
  canvas.saveState()
  canvas.setFont("Helvetica-Bold", 80)
  canvas.setFillColor(colors.Color(0.8, 0.2, 0.2, alpha=0.07))
  canvas.translate(A4[0] / 2, A4[1] / 2)
  canvas.rotate(40)
  canvas.drawCentredString(0, 0, "SIMULACIÓN")
  canvas.restoreState()


def _in_words(value) -> str:
  return f"{num2words(int(value), lang='es')} pesos con cero centavos"


def generate_invoice_pdf(db: Session, invoice, order, qr_data: str) -> str:
  seller = db.query(Company).filter(Company.company_type == "own", Company.is_active == True).first()  # noqa: E712
  customer = db.query(Company).filter(Company.id == order.company_id).first()

  if not seller or not customer:
    raise ValueError("No se encontró la empresa emisora o el cliente")

  folder = os.path.join(INVOICES_DIR, str(invoice.id))
  os.makedirs(folder, exist_ok=True)
  file_path = os.path.join(folder, f"{invoice.invoice_number}.pdf")

  base = getSampleStyleSheet()["Normal"]
  n = ParagraphStyle("n", parent=base, fontName="Helvetica", fontSize=8, leading=10.5)
  b = ParagraphStyle("b", parent=n, fontName="Helvetica-Bold")
  s = ParagraphStyle("s", parent=n, fontSize=7, textColor=colors.HexColor("#666666"))
  r = ParagraphStyle("r", parent=n, alignment=2)
  rb = ParagraphStyle("rb", parent=r, fontName="Helvetica-Bold")
  c = ParagraphStyle("c", parent=n, alignment=1)
  cb = ParagraphStyle("cb", parent=c, fontName="Helvetica-Bold")
  pend = ParagraphStyle("p", parent=n, fontName="Helvetica-Bold", textColor=PENDING)

  def p(text, style=n):
      return Paragraph(escape(str(text)) if text not in (None, "") else "—", style)

  number = invoice.invoice_number
  issued = invoice.issued_at.astimezone(LOCAL_TZ)
  signed = invoice.signed_at.astimezone(LOCAL_TZ)

  doc = SimpleDocTemplate(
    file_path, pagesize=A4,
    leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.3 * cm, bottomMargin=1.3 * cm,
    title=f"Factura electrónica de venta {number}",
  )
  story = []

  # ---------- Encabezado: logo + datos del emisor ----------
  if os.path.exists(LOGO_PATH):
    w, h = ImageReader(LOGO_PATH).getSize()
    logo = Image(LOGO_PATH, width=3.3 * cm, height=3.0 * cm * h / w)
  else:
    logo = p(seller.display_name or seller.legal_name, b)

  seller_info = [
    p(seller.legal_name.upper(), b),
    p(f"{seller.document_type or ''}: {seller.document_number or ''}"),
    p(f"Régimen: {SELLER_TAX_REGIME}"),
    p("Persona Jurídica" if seller.person_type == "juridica" else "Persona Natural"),
    p(f"Dirección: {full_address(seller)}"),
    p(f"Tel. {seller.fiscal_phone or seller.phone or '—'}"),
    p(f"Email. {seller.fiscal_email or seller.email}"),
    p(f"Autorización de numeración DIAN: {SELLER_DIAN_AUTH}", pend),
  ]
  header = Table([[logo, seller_info]], colWidths=[4.6 * cm, 13.4 * cm])
  header.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LINEBELOW", (0, 0), (-1, 0), 0.8, LINE),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
  ]))
  story += [header, Spacer(1, 0.3 * cm)]

  # ---------- Cliente (izq.) y datos de la factura (der.) ----------
  client_rows = [
    [p("Nombre/Razón Social:", b), p(customer.legal_name)],
    [p(f"{customer.document_type or 'Doc'}:", b), p(customer.document_number)],
    [p("Dirección:", b), p(full_address(customer))],
    [p("Teléfono:", b), p(customer.fiscal_phone or customer.phone)],
    [p("Email:", b), p(customer.fiscal_email or customer.email)],
    [p("Forma de pago:", b), p("Contado")],
    [p("Medio de pago:", b), p("Transferencia Débito Interbancario")],
    [p("Total de Líneas:", b), p(len(order.items))],
  ]
  client_box = Table(client_rows, colWidths=[3.5 * cm, 5.0 * cm])
  client_box.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ("LINEBELOW", (0, 4), (-1, 4), 0.4, LINE),
  ]))

  def date_grid(d, m, y):
    return Table(
      [[p("DIA", c), p("MES", c), p("AÑO", c)], [p(d, cb), p(m, cb), p(y, cb)]],
      colWidths=[1.2 * cm] * 3,
      style=[("GRID", (0, 0), (-1, -1), 0.5, LINE)],
    )

  dates = Table(
    [[p("FECHA DE EMISIÓN", cb), p("FECHA DE VENCIMIENTO", cb)],
      [date_grid(f"{issued:%d}", f"{issued:%m}", f"{issued:%Y}"), date_grid("--", "--", "--")]],
    colWidths=[4.2 * cm, 4.2 * cm],
  )
  info_top = Table(
    [[p("FACTURA ELECTRÓNICA DE VENTA:", b), p(number, b)],
      [p("MONEDA:", b), p("COP Peso colombiano")],
      [p("HORA EMISIÓN:", b), p(f"{issued:%H:%M:%S}")],
      [p("FECHA FIRMADO:", b), p(f"{signed:%d/%m/%Y %H:%M:%S}")]],
    colWidths=[4.2 * cm, 4.2 * cm],
  )
  info_top.setStyle(TableStyle([
    ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
  ]))
  info_box = Table([[info_top], [Spacer(1, 4)], [dates]], colWidths=[8.6 * cm])

  two = Table([[client_box, info_box]], colWidths=[9.2 * cm, 8.8 * cm])
  two.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("BOX", (0, 0), (0, 0), 0.8, LINE),
    ("BOX", (1, 0), (1, 0), 0.8, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
  ]))
  story += [two, Spacer(1, 0.3 * cm)]

  # ---------- Productos ----------
  rows = [[p("#", cb), p("CÓDIGO", cb), p("DESCRIPCIÓN", cb), p("U.M", cb), p("CTD", cb),
          p("PRECIO U.", cb), p("IVA %", cb), p("IVA MONTO", cb), p("TOTAL", cb)]]
  for i, item in enumerate(order.items, start=1):
    product = item.product
    rate = float(product.tax_rate or 0) if product else 0.0
    rows.append([
      p(i, c), p("—", c), p(product.name if product else "Producto"),
      p(product.unit if product else "", c), p(f"{item.quantity_m3:,}".replace(",", "."), c),
      p(_money(item.unit_price), r), p(f"{rate * 100:g}%", c),
      p(_money(float(item.subtotal) * rate), r), p(_money(item.subtotal), r),
    ])
  items = Table(rows, colWidths=[x * cm for x in [0.7, 1.6, 4.7, 1.3, 1.6, 2.2, 1.1, 2.2, 2.6]], repeatRows=1)
  items.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.8, LINE),
    ("LINEBELOW", (0, 0), (-1, 0), 0.6, LINE),
    ("LINEBEFORE", (0, 0), (-1, -1), 0.3, LINE),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
  ]))
  story += [items, Spacer(1, 0.3 * cm)]

  # ---------- Notas + totales ----------
  notes = [
    p("Notas:", b), Spacer(1, 6),
    p(f"SON: ({_in_words(invoice.total)})"), Spacer(1, 4),
    p(f"CUFE: {invoice.cufe}", pend),
  ]
  totals = Table(
    [[p("Subtotal:", b), p(_money(invoice.subtotal), r)],
      [p("Cargos:", b), p(_money(0), r)],
      [p("Descuentos:", b), p(_money(0), r)],
      [p("IVA:", b), p(_money(invoice.tax), r)],
      [p("Total de la operación:", b), p(_money(float(invoice.subtotal) + float(invoice.tax)), r)],
      [p("Total:", b), p(_money(invoice.total), rb)]],
    colWidths=[3.6 * cm, 3.4 * cm],
  )
  totals.setStyle(TableStyle([
    ("GRID", (0, 0), (-1, -1), 0.4, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
  ]))
  nt = Table([[notes, totals]], colWidths=[11 * cm, 7 * cm])
  nt.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("BOX", (0, 0), (0, 0), 0.8, LINE),
    ("LEFTPADDING", (0, 0), (0, 0), 6), ("TOPPADDING", (0, 0), (0, 0), 6),
  ]))
  story += [nt, Spacer(1, 0.3 * cm)]

  # ---------- Impuestos por tarifa ----------
  by_rate = {}
  for item in order.items:
    rate = float(item.product.tax_rate or 0) if item.product else 0.0
    base_, tax_ = by_rate.get(rate, (0.0, 0.0))
    by_rate[rate] = (base_ + float(item.subtotal), tax_ + float(item.subtotal) * rate)

  tax_rows = [[p("IMPUESTO", cb), p("BASE", cb), p("TARIFA / VALOR NOMINAL", cb), p("IMPORTE", cb)]]
  for rate, (base_, tax_) in sorted(by_rate.items()):
    tax_rows.append([p("01 IVA", c), p(_money(base_), r), p(f"{rate * 100:.2f}%", c), p(_money(tax_), r)])
  taxes = Table(tax_rows, colWidths=[4 * cm, 5 * cm, 4.5 * cm, 4.5 * cm])
  taxes.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.8, LINE), ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
  ]))
  story += [taxes, Spacer(1, 1.0 * cm)]

  # ---------- Pie: firma digital + QR ----------
  size = 3.6 * cm
  widget = QrCodeWidget(qr_data)
  x1, y1, x2, y2 = widget.getBounds()
  drawing = Drawing(size, size, transform=[size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0])
  drawing.add(widget)

  sign = [
    p(f"Firma Digital: {invoice.signature}", s),
    Spacer(1, 6),
    p("Representación gráfica de SIMULACIÓN de la factura electrónica de venta. "
      "No fue transmitida a la DIAN, no tiene validez fiscal ni es un título valor.", s),
  ]
  footer = Table([[sign, drawing]], colWidths=[13.6 * cm, 4.4 * cm])
  footer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
  story.append(footer)

  doc.build(story, 
            # onFirstPage=_watermark, 
            # onLaterPages=_watermark
            )
  
  return f"/{file_path}"