import { FacturasList } from "../crm/Facturas";
import type { Customer } from "../hooks";

export function FacturasTab({ customer }: { customer: Customer }) {
  return <FacturasList customerId={customer.id} />;
}
