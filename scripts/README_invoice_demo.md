# Invoice demo

`shared/seed-data/sample_invoices/invoice_demo.pdf` is a small, uploadable invoice fixture:

- Invoice: `INV-DEMO-001`
- PO reference: `PO-DEMO-001`
- Vendor: `MedSure Life Sciences`
- Quantity: `100`
- Unit price: `96.00`
- Total: `9600.00`

## UI walkthrough

1. Create a requisition for quantity **100** in **Requisitions**.
2. Open **Purchase Orders**, click **Generate PO**, review the supplier ranking, then click **Confirm & generate PO**.
3. Open **Goods Receipt**, enter quantity **100**, a batch number (for example `DEMO-001`), and an expiry date (for example `2027-12-31`), then confirm.
4. Open **Invoices**, select the PO with a goods receipt, choose `invoice_demo.pdf`, and upload it.
5. Review the extracted fields and click **Run 3-way match**. With a PO priced at `96.00`, the result is `MATCHED` and payment is auto-approved.

The invoice parser also has a deterministic labelled-text fallback when Gemini is unavailable, so this fixture remains testable offline from the AI provider.
