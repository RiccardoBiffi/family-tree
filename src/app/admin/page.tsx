import type { Metadata } from "next";

import { FamilyTreeApp } from "@/components/FamilyTreeApp";

export const metadata: Metadata = {
  title: "Family Tree Archive | Admin",
  description:
    "Area di amministrazione locale per creare e modificare un albero genealogico salvato nel browser.",
};

export default function AdminPage() {
  return <FamilyTreeApp mode="admin" />;
}
