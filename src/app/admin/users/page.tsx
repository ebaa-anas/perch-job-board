import type { Metadata } from "next";

import { getAllUsersAdmin } from "@/features/admin/data";
import { UsersTable } from "@/features/admin/components/users-table";

export const metadata: Metadata = { title: "Admin · Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await getAllUsersAdmin();
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {users.length} accounts. Deleting a user cascades to everything they own.
      </p>
      <div className="mt-4">
        <UsersTable users={users} />
      </div>
    </div>
  );
}
