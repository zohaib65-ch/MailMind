import { apiRoute } from "@/lib/utils/http";
import { getDashboardStats, getPriorityEmails } from "@/services/dashboard/dashboard.service";

export const GET = apiRoute({}, async (_req, { user }) => {
  const [stats, priority] = await Promise.all([getDashboardStats(user.id), getPriorityEmails(user.id)]);
  return { stats, priority };
});
