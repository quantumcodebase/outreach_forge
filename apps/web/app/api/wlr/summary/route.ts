import { NextResponse } from 'next/server';
import { prisma } from '@cockpit/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') || 'intakevault';

  const [totalRecipes, activeRecipes, runsRecent, latestSync, newWlrLeads24h] = await Promise.all([
    prisma.wlr_search_recipes.count({ where: { project_id: projectId } }),
    prisma.wlr_search_recipes.count({ where: { project_id: projectId, enabled: true } }),
    prisma.wlr_runs.count({ where: { project_id: projectId, started_at: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } } }),
    prisma.wlr_sync_state.findFirst({ where: { project_id: projectId }, orderBy: { last_synced_at: 'desc' } }),
    prisma.leads.count({ where: { tags: { has: 'source:wlr' }, created_at: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } } })
  ]);

  return NextResponse.json({
    totalRecipes,
    activeRecipes,
    runsRecent,
    lastSyncAt: latestSync?.last_synced_at || null,
    lastSyncCounts: latestSync
      ? {
          created: latestSync.last_created_count,
          updated: latestSync.last_updated_count,
          skipped: latestSync.last_skipped_count,
          runId: latestSync.last_synced_run_id,
        }
      : null,
    newWlrLeads24h,
  });
}
