import Pos from "@/screens/pos";
import { Documents } from "@/screens/documents";
import { can, useSession } from "@/lib/session";
export default function Sales() {
  useSession((state) => state.user);
  return can("sales.create") ? <Pos /> : <Documents />;
}
