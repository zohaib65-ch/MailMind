import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getEnv, isAiConfigured } from "@/lib/utils/env";
import { requireUser } from "@/services/auth/dal";
import { getDashboardStats } from "@/services/dashboard/dashboard.service";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const stats = await getDashboardStats(user.id);
  const counts = { needsReply: stats.needsReply, pendingDrafts: stats.pendingDrafts };

  return (
    <div className="flex min-h-screen">
      <AppSidebar counts={counts} mockMode={getEnv().MOCK_EMAIL_MODE} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader user={user} counts={counts} aiConfigured={isAiConfigured()} autoProcess={getEnv().AI_AUTO_PROCESS} />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
