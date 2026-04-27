import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { UploadClient } from "./_components/upload-client";

export const dynamic = "force-dynamic";

export default async function AdminUploadPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
  return <UploadClient />;
}
