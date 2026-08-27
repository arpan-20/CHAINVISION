from pathlib import Path

out = Path(__file__).parent.parent / 'shared' / 'seed-data' / 'sample_invoices' / 'invoice_sku_matching.pdf'
lines = [
    'MEDCARE PHARMA', 'SUPPLIER INVOICE', 'Invoice Number: INV-SKU-TEST-001',
    'PO Number: PO-SKU-TEST-001', 'Vendor: MedSure Life Sciences', 'SKU: MED-107',
    'Quantity: 900', 'Unit Price: 96.00', 'Total Amount: 86400.00',
]
stream = 'BT\n/F1 14 Tf\n50 760 Td\n' + ''.join(f'({line}) Tj\n0 -28 Td\n' for line in lines) + 'ET\n'
objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    f'<< /Length {len(stream.encode())} >>\nstream\n{stream}endstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]
pdf = bytearray(b'%PDF-1.4\n')
offsets = [0]
for number, body in enumerate(objects, 1):
    offsets.append(len(pdf))
    pdf.extend(f'{number} 0 obj\n{body}\nendobj\n'.encode())
xref = len(pdf)
pdf.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
for offset in offsets[1:]:
    pdf.extend(f'{offset:010d} 00000 n \n'.encode())
pdf.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode())
out.write_bytes(pdf)
print(out)
