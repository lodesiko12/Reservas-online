import { PresupuestosList } from "../crm/Presupuestos";
import type { Customer } from "../hooks";

export function PresupuestosTab({ customer }: { customer: Customer }) {
  return <PresupuestosList customerId={customer.id} />;
}
