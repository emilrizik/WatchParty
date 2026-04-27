import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ManageClient } from "./_components/manage-client";

export const dynamic = "force-dynamic";

export default async function AdminManagePage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
  return <ManageClient />;
}
