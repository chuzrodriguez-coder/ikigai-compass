import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  ikigaiHypothesesTable,
  growthPlansTable,
  milestonesTable,
  taskActionsTable,
  checkInsTable,
  obstaclesTable,
  progressSnapshotsTable,
  discoverySessionsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { getWeekStart } from "../lib/momentum";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = req.dbUserId!;

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  const activeHypothesis = await db.query.ikigaiHypothesesTable.findFirst({
    where: and(
      eq(ikigaiHypothesesTable.userId, userId),
      eq(ikigaiHypothesesTable.status, "accepted")
    ),
  });

  const activePlan = await db.query.growthPlansTable.findFirst({
    where: and(
      eq(growthPlansTable.userId, userId),
      eq(growthPlansTable.status, "active")
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const upcomingMilestones = activePlan
    ? await db.query.milestonesTable.findMany({
        where: and(
          eq(milestonesTable.planId, activePlan.id),
          eq(milestonesTable.status, "pending")
        ),
        orderBy: (t, { asc }) => [asc(t.targetDate)],
        limit: 3,
      })
    : [];

  const weekStart = getWeekStart(new Date());
  const allActions = activePlan
    ? await db.query.taskActionsTable.findMany({
        where: eq(taskActionsTable.planId, activePlan.id),
      })
    : [];

  const pendingActionsCount = allActions.filter(
    (a) => a.status === "pending"
  ).length;
  const completedActionsThisWeek = allActions.filter(
    (a) =>
      a.status === "completed" &&
      a.completedAt &&
      new Date(a.completedAt) >= new Date(weekStart)
  ).length;

  const activeObstacles = await db.query.obstaclesTable.findMany({
    where: and(
      eq(obstaclesTable.userId, userId),
      eq(obstaclesTable.status, "active")
    ),
  });
  const activeObstaclesCount = activeObstacles.length;

  const recentCheckIn = await db.query.checkInsTable.findFirst({
    where: eq(checkInsTable.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const momentumScore = recentCheckIn?.momentumScore ?? 0;
  const { label, explanation } = getMomentumLabel(momentumScore);

  const discoverySessions = await db.query.discoverySessionsTable.findMany({
    where: eq(discoverySessionsTable.userId, userId),
  });

  const discoveryComplete = discoverySessions.some(
    (s) => s.status === "completed"
  );

  res.json({
    user,
    activeHypothesis: activeHypothesis ?? null,
    activePlan: activePlan ?? null,
    momentumScore,
    momentumLabel: label,
    momentumExplanation: explanation,
    pendingActionsCount,
    completedActionsThisWeek,
    activeObstaclesCount,
    upcomingMilestones,
    recentCheckIn: recentCheckIn ?? null,
    discoveryComplete,
    hasHypothesis: !!activeHypothesis,
    hasPlan: !!activePlan,
  });
});

router.get("/dashboard/momentum", requireAuth, async (req, res) => {
  const snapshots = await db.query.progressSnapshotsTable.findMany({
    where: eq(progressSnapshotsTable.userId, req.dbUserId!),
    orderBy: (t, { asc }) => [asc(t.week)],
    limit: 12,
  });
  res.json(snapshots);
});

router.get("/dashboard/activity", requireAuth, async (req, res) => {
  const userId = req.dbUserId!;
  const events: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    timestamp: Date;
  }> = [];

  const checkIns = await db.query.checkInsTable.findMany({
    where: eq(checkInsTable.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 5,
  });
  for (const c of checkIns) {
    events.push({
      id: `checkin-${c.id}`,
      type: "check_in",
      title: "Submitted a check-in",
      description: `Period: ${c.period}`,
      timestamp: c.createdAt,
    });
  }

  const hypotheses = await db.query.ikigaiHypothesesTable.findMany({
    where: and(
      eq(ikigaiHypothesesTable.userId, userId),
      eq(ikigaiHypothesesTable.status, "accepted")
    ),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
    limit: 3,
  });
  for (const h of hypotheses) {
    events.push({
      id: `hyp-${h.id}`,
      type: "hypothesis_accepted",
      title: `Accepted hypothesis: ${h.title}`,
      timestamp: h.updatedAt,
    });
  }

  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  res.json(events.slice(0, 10));
});

function getMomentumLabel(score: number): {
  label: string;
  explanation: string;
} {
  if (score >= 80)
    return {
      label: "Strong Momentum",
      explanation: "You are making excellent progress. Keep going.",
    };
  if (score >= 60)
    return {
      label: "Good Momentum",
      explanation: "You are moving in the right direction. Stay consistent.",
    };
  if (score >= 40)
    return {
      label: "Building Momentum",
      explanation: "Progress is happening. Each step counts.",
    };
  if (score >= 20)
    return {
      label: "Getting Started",
      explanation: "Your journey is beginning. Small steps lead to big change.",
    };
  return {
    label: "Ready to Begin",
    explanation: "Complete your first check-in to start tracking momentum.",
  };
}

export default router;
