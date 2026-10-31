import Inventory from "@/screens/inventory";
import { Invoices, Orders } from "@/screens/documents";
import { can, useSession } from "@/lib/session";
export default function Work() {
  const user = useSession((state) => state.user);
  if (can("sales.view")) return <Orders />;
  if (can("invoices.view")) return <Invoices />;
  return <Inventory />;
}
