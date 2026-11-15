import type { Metadata } from "next";

import { FamilyTreeApp } from "@/components/FamilyTreeApp";

export const metadata: Metadata = {
  title: "Archivio di famiglia | Amministrazione",
  description:
    "Area di amministrazione locale per creare e modificare un albero genealogico salvato nel browser.",
};

export default function AdminPage() {
  return <FamilyTreeApp mode="admin" />;
}
