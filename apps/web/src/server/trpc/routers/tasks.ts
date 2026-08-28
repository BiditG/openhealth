import { z } from "zod";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { didRankUp, getRankForPoints } from "@/lib/rank-system";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { sendPushToUser } from "@/server/services/push";
import {
  dailyGuidanceNotifications,
  healthTaskCompletions,
  userProfiles,
  users,
} from "@/server/db/schema";

const exerciseKeys = [
  "squat",
  "pushup",
  "plank",
  "gluteBridge",
  "reverseLunge",
  "forwardLunge",
  "jumpingJacks",
  "highKnees",
  "mountainClimbers",
  "crunch",
  "situp",
  "burpee",
  "calfRaise",
  "wallSit",
  "sidePlank",
  "legRaise",
  "shoulderTaps",
  "squatJump",
  "bicepCurl",
  "overheadPress",
  "pullup",
] as const;

type ExerciseKey = (typeof exerciseKeys)[number];

const proofSources = ["analyzer", "tracker", "motion", "tempo", "audio", "tap", "trust", "website"] as const;

type ProofSource = (typeof proofSources)[number];

const proofStrengthBySource: Record<
  ProofSource,
  { label: string; multiplier: number }
> = {
  analyzer: { label: "Camera verification", multiplier: 4 },
  tracker: { label: "GPS tracker verification", multiplier: 0.95 },
  motion: { label: "Motion sensor verification", multiplier: 4 },
  tempo: { label: "Tempo checkpoint verification", multiplier: 0.9 },
  audio: { label: "Audio rep verification", multiplier: 2 },
  tap: { label: "Tap confirmation", multiplier: 2 },
  trust: { label: "Self confirmation", multiplier: 1 },
  website: { label: "Website confirmation", multiplier: 0.65 },
};

function applyProofMultiplier(points: number, source: ProofSource) {
  return Math.max(1, Math.round(points * proofStrengthBySource[source].multiplier));
}

type DailyTask = {
  key: string;
  title: string;
  description: string;
  category: "Task" | "Mission" | "Workout";
  area: string;
  difficulty: "steady" | "strong" | "elite";
  actionType: "analyzer" | "tracker" | "onsite";
  exerciseKey?: ExerciseKey;
  targetReps?: number;
  targetDistanceMeters?: number;
  medal: {
    code: string;
    name: string;
    tier: "bronze" | "silver" | "gold" | "platinum" | "training";
    points: number;
  };
};

const DAILY_TASK_POOL: DailyTask[] = [
  {
    key: "pushups-20",
    title: "20 push-ups",
    description: "A simple strength task verified by the camera rep counter.",
    category: "Task",
    area: "Strength",
    difficulty: "steady",
    actionType: "analyzer",
    exerciseKey: "pushup",
    targetReps: 20,
    medal: { code: "pushup-spark-20", name: "Push-up Spark", tier: "bronze", points: 20 },
  },
  {
    key: "bicep-curls-10",
    title: "10 bicep curls",
    description: "A short verified curl set to build consistency.",
    category: "Task",
    area: "Strength",
    difficulty: "steady",
    actionType: "analyzer",
    exerciseKey: "bicepCurl",
    targetReps: 10,
    medal: { code: "curl-starter-10", name: "Curl Starter", tier: "bronze", points: 12 },
  },
  {
    key: "squats-20",
    title: "20 squats",
    description: "A quick lower-body task counted inside the analyzer.",
    category: "Task",
    area: "Strength",
    difficulty: "steady",
    actionType: "analyzer",
    exerciseKey: "squat",
    targetReps: 20,
    medal: { code: "squat-spark-20", name: "Squat Spark", tier: "bronze", points: 18 },
  },
  {
    key: "log-main-meal",
    title: "Log one main meal",
    description: "Complete this inside Swastha so your day has useful nutrition context.",
    category: "Task",
    area: "Nutrition",
    difficulty: "steady",
    actionType: "onsite",
    medal: { code: "mindful-plate", name: "Mindful Plate Badge", tier: "bronze", points: 15 },
  },
  {
    key: "walk-800m",
    title: "Walk 800 m",
    description: "An easy GPS walk that also updates your food guide.",
    category: "Task",
    area: "Movement",
    difficulty: "steady",
    actionType: "tracker",
    targetDistanceMeters: 800,
    medal: { code: "walk-starter-800", name: "Walk Starter", tier: "bronze", points: 16 },
  },
  {
    key: "run-1k",
    title: "Run or walk 1 km",
    description: "A short outdoor movement task verified by the tracker.",
    category: "Task",
    area: "Movement",
    difficulty: "steady",
    actionType: "tracker",
    targetDistanceMeters: 1000,
    medal: { code: "one-k-spark", name: "1K Spark", tier: "bronze", points: 22 },
  },
  {
    key: "squats-15",
    title: "15 squats",
    description: "A quick lower-body set with verified camera reps.",
    category: "Task",
    area: "Strength",
    difficulty: "steady",
    actionType: "analyzer",
    exerciseKey: "squat",
    targetReps: 15,
    medal: { code: "squat-starter-15", name: "Squat Starter", tier: "bronze", points: 14 },
  },
  {
    key: "jumping-jacks-30",
    title: "30 jumping jacks",
    description: "A light cardio burst counted by the analyzer.",
    category: "Task",
    area: "Cardio",
    difficulty: "steady",
    actionType: "analyzer",
    exerciseKey: "jumpingJacks",
    targetReps: 30,
    medal: { code: "jack-spark-30", name: "Jack Spark", tier: "bronze", points: 18 },
  },
  {
    key: "plank-hold-6",
    title: "30 sec plank",
    description: "Hold steady. The analyzer counts hold reps every few seconds.",
    category: "Task",
    area: "Core",
    difficulty: "steady",
    actionType: "analyzer",
    exerciseKey: "plank",
    targetReps: 6,
    medal: { code: "plank-steady-30", name: "Plank Steady", tier: "bronze", points: 20 },
  },
];

const WEEKLY_MISSION_POOL: DailyTask[] = [
  {
    key: "pushups-100",
    title: "100 push-ups",
    description: "A serious verified strength mission.",
    category: "Mission",
    area: "Elite",
    difficulty: "strong",
    actionType: "analyzer",
    exerciseKey: "pushup",
    targetReps: 100,
    medal: { code: "hundred-rep-crown", name: "Hundred Rep Crown", tier: "platinum", points: 150 },
  },
  {
    key: "pushups-500",
    title: "500 push-ups",
    description: "A mission built for the very top of the leaderboard.",
    category: "Mission",
    area: "Elite",
    difficulty: "elite",
    actionType: "analyzer",
    exerciseKey: "pushup",
    targetReps: 500,
    medal: { code: "pushup-legend-500", name: "Push-up Legend", tier: "platinum", points: 900 },
  },
  {
    key: "bicep-curls-100",
    title: "100 bicep curls",
    description: "A hard curl mission verified by the analyzer.",
    category: "Mission",
    area: "Elite",
    difficulty: "strong",
    actionType: "analyzer",
    exerciseKey: "bicepCurl",
    targetReps: 100,
    medal: { code: "curl-forge-100", name: "Curl Forge Medal", tier: "gold", points: 160 },
  },
  {
    key: "pullups-30",
    title: "30 pull-ups",
    description: "A high-strength mission for verified pull-up reps.",
    category: "Mission",
    area: "Elite",
    difficulty: "elite",
    actionType: "analyzer",
    exerciseKey: "pullup",
    targetReps: 30,
    medal: { code: "bar-commander-30", name: "Bar Commander", tier: "platinum", points: 220 },
  },
  {
    key: "distance-5k",
    title: "Cover 5 km",
    description: "Record a GPS walk or run through the tracker.",
    category: "Mission",
    area: "Distance",
    difficulty: "strong",
    actionType: "tracker",
    targetDistanceMeters: 5000,
    medal: { code: "five-k-trail", name: "5K Trail Medal", tier: "gold", points: 180 },
  },
  {
    key: "distance-10k",
    title: "Cover 10 km",
    description: "A weekly distance mission for a serious walking or running effort.",
    category: "Mission",
    area: "Distance",
    difficulty: "elite",
    actionType: "tracker",
    targetDistanceMeters: 10000,
    medal: { code: "ten-k-trail", name: "10K Trail Medal", tier: "platinum", points: 320 },
  },
  {
    key: "squats-250",
    title: "250 squats",
    description: "A hard weekly lower-body mission counted through verified sets.",
    category: "Mission",
    area: "Elite",
    difficulty: "strong",
    actionType: "analyzer",
    exerciseKey: "squat",
    targetReps: 250,
    medal: { code: "squat-forge-250", name: "Squat Forge", tier: "gold", points: 260 },
  },
];

const DAILY_GUIDANCE = [
  {
    title: "Start with one clear win",
    body: "Pick one task first. A clean start makes the rest of the day feel easier.",
    tone: "guide",
  },
  {
    title: "Train with proof",
    body: "Exercise medals support camera, motion, audio, tempo, tap, and trust proof with fair point weighting.",
    tone: "task",
  },
  {
    title: "Keep food simple today",
    body: "Protein plus fiber at one meal is enough to make your nutrition easier to understand.",
    tone: "nutrition",
  },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateFromIso(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  return Math.floor(diff / 86_400_000);
}

function weekStartIsoDate(isoDate = todayIsoDate()) {
  const date = dateFromIso(isoDate);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function pickRotatingTasks(pool: DailyTask[], count: number, seed: number) {
  return Array.from({ length: Math.min(count, pool.length) }, (_, index) => pool[(seed + index * 2) % pool.length]);
}

function getActiveTasks(taskDate = todayIsoDate()) {
  const date = dateFromIso(taskDate);
  const dailySeed = dayOfYear(date);
  const weekSeed = Math.floor(dayOfYear(date) / 7);
  const tasks = pickRotatingTasks(DAILY_TASK_POOL, 4, dailySeed);
  const missions = pickRotatingTasks(WEEKLY_MISSION_POOL, 3, weekSeed);
  return [...tasks, ...missions];
}

function taskCompletionDate(task: DailyTask, taskDate = todayIsoDate()) {
  return task.category === "Mission" ? weekStartIsoDate(taskDate) : taskDate;
}

function getTask(taskKey: string) {
  const task = [...DAILY_TASK_POOL, ...WEEKLY_MISSION_POOL].find((item) => item.key === taskKey);
  if (!task) {
    throw new Error("Task not found.");
  }
  return task;
}

async function sendTaskPush(userId: string, title: string, body: string, url: string, tag: string) {
  try {
    await sendPushToUser(userId, {
      type: "task",
      title,
      body,
      tag,
      url,
    });
  } catch {
    // Push should never block task progress.
  }
}

function analyzerHref(task: DailyTask) {
  if (task.actionType === "tracker" && task.targetDistanceMeters) {
    const params = new URLSearchParams({
      taskId: task.key,
      targetDistance: String(task.targetDistanceMeters),
    });
    return `/hub/track?${params.toString()}`;
  }
  if (task.actionType !== "analyzer" || !task.exerciseKey || !task.targetReps) return "/hub/daily-tasks";
  const params = new URLSearchParams({
    mode: "workout",
    taskId: task.key,
    exercise: task.exerciseKey,
    target: String(task.targetReps),
  });
  return `/hub/food/scan-label?${params.toString()}`;
}

export const tasksRouter = router({
  getTeamScores: publicProcedure.query(async ({ ctx }) => {
    const [memberRows, pointRows] = await Promise.all([
      ctx.db
        .select({
          teamColor: userProfiles.teamColor,
          members: sql<number>`count(distinct ${userProfiles.userId})`,
        })
        .from(userProfiles)
        .where(inArray(userProfiles.teamColor, ["red", "blue"]))
        .groupBy(userProfiles.teamColor),
      ctx.db
        .select({
          teamColor: userProfiles.teamColor,
          points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
          completions: sql<number>`count(${healthTaskCompletions.id})`,
        })
        .from(healthTaskCompletions)
        .innerJoin(userProfiles, eq(healthTaskCompletions.userId, userProfiles.userId))
        .where(and(isNotNull(healthTaskCompletions.completedAt), inArray(userProfiles.teamColor, ["red", "blue"])))
        .groupBy(userProfiles.teamColor),
    ]);

    const teams = (["red", "blue"] as const).map((teamColor) => {
      const memberRow = memberRows.find((row) => row.teamColor === teamColor);
      const pointRow = pointRows.find((row) => row.teamColor === teamColor);
      return {
        teamColor,
        label: teamColor === "red" ? "Team RED" : "Team Blue",
        points: Number(pointRow?.points ?? 0),
        members: Number(memberRow?.members ?? 0),
        completions: Number(pointRow?.completions ?? 0),
      };
    });

    const [red, blue] = teams;
    const leader =
      red.points === blue.points
        ? red.members <= blue.members
          ? red
          : blue
        : red.points > blue.points
          ? red
          : blue;
    const needsYou =
      red.points === blue.points
        ? red.members <= blue.members
          ? red
          : blue
        : red.points < blue.points
          ? red
          : blue;

    return { teams, leaderTeam: leader.teamColor, needsYouTeam: needsYou.teamColor };
  }),

  getDaily: protectedProcedure.query(async ({ ctx }) => {
    const taskDate = todayIsoDate();
    const weekDate = weekStartIsoDate(taskDate);
    const activeTasks = getActiveTasks(taskDate);
    const existingGuidance = await ctx.db
      .select({ id: dailyGuidanceNotifications.id })
      .from(dailyGuidanceNotifications)
      .where(
        and(
          eq(dailyGuidanceNotifications.userId, ctx.user.id),
          eq(dailyGuidanceNotifications.notificationDate, taskDate)
        )
      )
      .limit(1);

    await ctx.db
      .insert(dailyGuidanceNotifications)
      .values(
        DAILY_GUIDANCE.map((item) => ({
          userId: ctx.user.id,
          notificationDate: taskDate,
          ...item,
        }))
      )
      .onConflictDoNothing();

    if (!existingGuidance.length) {
      await sendTaskPush(
        ctx.user.id,
        "Today's tasks are ready",
        "New daily tasks refreshed, and weekly missions are waiting.",
        "/hub/daily-tasks",
        `daily-tasks-${taskDate}`
      );
    }

    const [notifications, completions] = await Promise.all([
      ctx.db
        .select()
        .from(dailyGuidanceNotifications)
        .where(
          and(
            eq(dailyGuidanceNotifications.userId, ctx.user.id),
            eq(dailyGuidanceNotifications.notificationDate, taskDate)
          )
        ),
      ctx.db
        .select()
        .from(healthTaskCompletions)
        .where(
          and(
            eq(healthTaskCompletions.userId, ctx.user.id),
            inArray(healthTaskCompletions.taskDate, [taskDate, weekDate])
          )
        ),
    ]);

    const completionByKey = new Map(completions.map((item) => [item.taskKey, item]));
    const tasks = activeTasks.map((task) => {
      const completion = completionByKey.get(task.key);
      return {
        ...task,
        actionHref: analyzerHref(task),
        status: completion?.status ?? "new",
        countedReps: completion?.countedReps ?? 0,
        completedAt: completion?.completedAt ?? null,
        startedAt: completion?.startedAt ?? null,
      };
    });

    return {
      notifications,
      tasks,
      completedCount: tasks.filter((task) => task.completedAt).length,
      totalCount: tasks.length,
      allComplete: tasks.every((task) => !!task.completedAt),
      taskCount: tasks.filter((task) => task.category === "Task").length,
      missionCount: tasks.filter((task) => task.category === "Mission").length,
      completedTaskCount: tasks.filter((task) => task.category === "Task" && task.completedAt).length,
      completedMissionCount: tasks.filter((task) => task.category === "Mission" && task.completedAt).length,
    };
  }),

  startTask: protectedProcedure
    .input(z.object({ taskKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const taskDate = todayIsoDate();
      const task = getTask(input.taskKey);
      const completionDate = taskCompletionDate(task, taskDate);

      await ctx.db
        .insert(healthTaskCompletions)
        .values({
          userId: ctx.user.id,
          taskDate: completionDate,
          taskKey: task.key,
          title: task.title,
          category: task.category,
          status: "started",
          exerciseKey: task.exerciseKey,
          targetReps: task.targetReps,
          medalCode: task.medal.code,
          medalName: task.medal.name,
          medalTier: task.medal.tier,
          medalPoints: task.medal.points,
        })
        .onConflictDoUpdate({
          target: [
            healthTaskCompletions.userId,
            healthTaskCompletions.taskDate,
            healthTaskCompletions.taskKey,
          ],
          set: {
            status: "started",
            startedAt: new Date(),
          },
        });

      return { success: true, actionHref: analyzerHref(task) };
    }),

  completeTask: protectedProcedure
    .input(
      z.object({
        taskKey: z.string().min(1),
        countedReps: z.number().int().min(0).optional(),
        distanceMeters: z.number().min(0).optional(),
        source: z.enum(proofSources).default("website"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const taskDate = todayIsoDate();
      const task = getTask(input.taskKey);
      const completionDate = taskCompletionDate(task, taskDate);
      const countedReps = input.countedReps ?? 0;

      if (task.actionType === "analyzer" && countedReps < (task.targetReps ?? 0)) {
        throw new Error(`Complete ${task.targetReps} verified reps before claiming this medal.`);
      }
      if (task.actionType === "tracker" && (input.distanceMeters ?? 0) < (task.targetDistanceMeters ?? 0)) {
        throw new Error(`Cover ${(task.targetDistanceMeters ?? 0) / 1000} km before claiming this medal.`);
      }

      const proofStrength = proofStrengthBySource[input.source];
      const awardedPoints = applyProofMultiplier(task.medal.points, input.source);

      const previousPoints = await ctx.db
        .select({
          points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
        })
        .from(healthTaskCompletions)
        .where(and(eq(healthTaskCompletions.userId, ctx.user.id), isNotNull(healthTaskCompletions.completedAt)))
        .then((rows) => Number(rows[0]?.points ?? 0));

      await ctx.db
        .insert(healthTaskCompletions)
        .values({
          userId: ctx.user.id,
          taskDate: completionDate,
          taskKey: task.key,
          title: task.title,
          category: task.category,
          status: "completed",
          exerciseKey: task.exerciseKey,
          targetReps: task.targetReps,
          countedReps,
          medalCode: task.medal.code,
          medalName: task.medal.name,
          medalTier: task.medal.tier,
          medalPoints: awardedPoints,
          proof: {
            source: input.source,
            proofStrength,
            countedReps,
            distanceMeters: input.distanceMeters ?? 0,
            basePoints: task.medal.points,
            awardedPoints,
          },
          completedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            healthTaskCompletions.userId,
            healthTaskCompletions.taskDate,
            healthTaskCompletions.taskKey,
          ],
          set: {
            status: "completed",
            countedReps,
            medalCode: task.medal.code,
            medalName: task.medal.name,
            medalTier: task.medal.tier,
            medalPoints: awardedPoints,
            proof: {
              source: input.source,
              proofStrength,
              countedReps,
              distanceMeters: input.distanceMeters ?? 0,
              basePoints: task.medal.points,
              awardedPoints,
            },
            completedAt: new Date(),
          },
        });

      const nextPoints = await ctx.db
        .select({
          points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
        })
        .from(healthTaskCompletions)
        .where(and(eq(healthTaskCompletions.userId, ctx.user.id), isNotNull(healthTaskCompletions.completedAt)))
        .then((rows) => Number(rows[0]?.points ?? 0));
      const rankBefore = getRankForPoints(previousPoints);
      const rankAfter = getRankForPoints(nextPoints);
      await sendTaskPush(
        ctx.user.id,
        `${task.medal.name} unlocked`,
        `${task.title} complete. ${awardedPoints} points added with ${proofStrength.label.toLowerCase()}.`,
        "/hub/daily-tasks",
        `task-complete-${task.key}-${completionDate}`
      );

      return {
        success: true,
        medal: task.medal,
        pointsAwarded: awardedPoints,
        points: nextPoints,
        rankBefore,
        rankAfter,
        levelUp: didRankUp(previousPoints, nextPoints),
        message: `${task.medal.name} unlocked. ${awardedPoints} points earned.`,
      };
    }),

  completeWorkoutSet: protectedProcedure
    .input(
      z.object({
        exerciseKey: z.enum(exerciseKeys),
        exerciseLabel: z.string().min(1).max(120),
        countedReps: z.number().int().min(1).max(1000),
        seconds: z.number().int().min(0).max(86_400),
        source: z.enum(proofSources).default("analyzer"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const taskDate = todayIsoDate();
      const basePoints = Math.min(25, Math.max(1, Math.floor(input.countedReps / 4)));
      const points = applyProofMultiplier(basePoints, input.source);
      const proofStrength = proofStrengthBySource[input.source];
      const completedAt = new Date();
      const taskKey = `workout-${input.exerciseKey}-${completedAt.getTime().toString(36)}`;

      await ctx.db.insert(healthTaskCompletions).values({
        userId: ctx.user.id,
        taskDate,
        taskKey,
        title: `${input.exerciseLabel} set`,
        category: "Workout",
        status: "completed",
        exerciseKey: input.exerciseKey,
        countedReps: input.countedReps,
        medalCode: "verified-workout-set",
        medalName: "Verified Workout Set",
        medalTier: "training",
        medalPoints: points,
        proof: {
          source: input.source,
          proofStrength,
          countedReps: input.countedReps,
          seconds: input.seconds,
          basePoints,
          awardedPoints: points,
          pointRate: "1 point per 4 reps, capped at 25 per set",
        },
        completedAt,
      });

      await sendTaskPush(
        ctx.user.id,
        "Verified workout saved",
        `${input.exerciseLabel} set complete. ${points} training points earned with ${proofStrength.label.toLowerCase()}.`,
        "/hub/daily-tasks",
        `workout-set-${taskKey}`
      );

      return {
        success: true,
        points,
        message: `+${points} training point${points === 1 ? "" : "s"} earned.`,
      };
    }),

  claimDailyLogin: protectedProcedure.mutation(async ({ ctx }) => {
    const taskDate = todayIsoDate();
    const taskKey = "daily-login";
    const points = 10;

    const previousPoints = await ctx.db
      .select({
        points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
      })
      .from(healthTaskCompletions)
      .where(and(eq(healthTaskCompletions.userId, ctx.user.id), isNotNull(healthTaskCompletions.completedAt)))
      .then((rows) => Number(rows[0]?.points ?? 0));

    const existing = await ctx.db
      .select({ id: healthTaskCompletions.id })
      .from(healthTaskCompletions)
      .where(
        and(
          eq(healthTaskCompletions.userId, ctx.user.id),
          eq(healthTaskCompletions.taskDate, taskDate),
          eq(healthTaskCompletions.taskKey, taskKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: true,
        claimed: false,
        pointsAwarded: 0,
        points: previousPoints,
        rankBefore: getRankForPoints(previousPoints),
        rankAfter: getRankForPoints(previousPoints),
        levelUp: false,
        message: "Daily login points already claimed.",
      };
    }

    await ctx.db.insert(healthTaskCompletions).values({
      userId: ctx.user.id,
      taskDate,
      taskKey,
      title: "Daily login",
      category: "Login",
      status: "completed",
      countedReps: 0,
      medalCode: "daily-login",
      medalName: "Daily Check-in",
      medalTier: "daily",
      medalPoints: points,
      proof: {
        source: "website",
        awardedPoints: points,
      },
      completedAt: new Date(),
    });

    const nextPoints = previousPoints + points;
    const rankBefore = getRankForPoints(previousPoints);
    const rankAfter = getRankForPoints(nextPoints);

    await sendTaskPush(
      ctx.user.id,
      "Daily points added",
      `Welcome back. +${points} login points added.`,
      "/hub/daily-tasks",
      `daily-login-${taskDate}`
    );

    return {
      success: true,
      claimed: true,
      pointsAwarded: points,
      points: nextPoints,
      rankBefore,
      rankAfter,
      levelUp: didRankUp(previousPoints, nextPoints),
      message: `Daily check-in complete. +${points} points added.`,
    };
  }),

  getLeaderboard: protectedProcedure
    .input(
      z
        .object({
          metric: z.enum(["overall", "pushup", "bicepCurl", "pullup", "squat"]).default("overall"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
    const metric = input?.metric ?? "overall";
    const where =
      metric === "overall"
        ? isNotNull(healthTaskCompletions.completedAt)
        : and(isNotNull(healthTaskCompletions.completedAt), eq(healthTaskCompletions.exerciseKey, metric));
    const scoreSql =
      metric === "overall"
        ? sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`
        : sql<number>`coalesce(sum(${healthTaskCompletions.countedReps}), 0)`;
    const rows = await ctx.db
      .select({
        userId: healthTaskCompletions.userId,
        name: users.name,
        teamColor: userProfiles.teamColor,
        medalCount: sql<number>`count(${healthTaskCompletions.id})`,
        points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
        score: scoreSql,
        todayPoints: sql<number>`coalesce(sum(case when ${healthTaskCompletions.completedAt} >= current_date then ${healthTaskCompletions.medalPoints} else 0 end), 0)`,
        taskCount: sql<number>`sum(case when ${healthTaskCompletions.category} = 'Task' then 1 else 0 end)`,
        missionCount: sql<number>`sum(case when ${healthTaskCompletions.category} = 'Mission' then 1 else 0 end)`,
        eliteMedals: sql<number>`sum(case when ${healthTaskCompletions.medalTier} = 'platinum' then 1 else 0 end)`,
        pushups: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'pushup' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
        bicepCurls: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'bicepCurl' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
        pullups: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'pullup' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
        squats: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'squat' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
      })
      .from(healthTaskCompletions)
      .innerJoin(users, eq(healthTaskCompletions.userId, users.id))
      .leftJoin(userProfiles, eq(healthTaskCompletions.userId, userProfiles.userId))
      .where(where)
      .groupBy(healthTaskCompletions.userId, users.name, userProfiles.teamColor)
      .orderBy(
        desc(scoreSql),
        desc(sql<number>`sum(case when ${healthTaskCompletions.category} = 'Mission' then 1 else 0 end)`),
        desc(sql<number>`count(${healthTaskCompletions.id})`)
      )
      .limit(20);

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      isCurrentUser: row.userId === ctx.user.id,
      rankTitle: getRankForPoints(Number(row.points)).title,
      rankTier: getRankForPoints(Number(row.points)).tier,
    }));
  }),

  getMyStats: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        medals: sql<number>`count(${healthTaskCompletions.id})`,
        points: sql<number>`coalesce(sum(${healthTaskCompletions.medalPoints}), 0)`,
        tasks: sql<number>`sum(case when ${healthTaskCompletions.category} = 'Task' then 1 else 0 end)`,
        missions: sql<number>`sum(case when ${healthTaskCompletions.category} = 'Mission' then 1 else 0 end)`,
        pushups: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'pushup' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
        bicepCurls: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'bicepCurl' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
        pullups: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'pullup' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
        squats: sql<number>`coalesce(sum(case when ${healthTaskCompletions.exerciseKey} = 'squat' then ${healthTaskCompletions.countedReps} else 0 end), 0)`,
      })
      .from(healthTaskCompletions)
      .where(and(eq(healthTaskCompletions.userId, ctx.user.id), isNotNull(healthTaskCompletions.completedAt)))
      .then((result) => result[0]);

    const medals = await ctx.db
      .select({
        id: healthTaskCompletions.id,
        title: healthTaskCompletions.title,
        medalName: healthTaskCompletions.medalName,
        medalTier: healthTaskCompletions.medalTier,
        medalPoints: healthTaskCompletions.medalPoints,
        completedAt: healthTaskCompletions.completedAt,
      })
      .from(healthTaskCompletions)
      .where(and(eq(healthTaskCompletions.userId, ctx.user.id), isNotNull(healthTaskCompletions.completedAt)))
      .orderBy(desc(healthTaskCompletions.completedAt))
      .limit(12);

    return {
      medals: Number(rows?.medals ?? 0),
      points: Number(rows?.points ?? 0),
      tasks: Number(rows?.tasks ?? 0),
      missions: Number(rows?.missions ?? 0),
      pushups: Number(rows?.pushups ?? 0),
      bicepCurls: Number(rows?.bicepCurls ?? 0),
      pullups: Number(rows?.pullups ?? 0),
      squats: Number(rows?.squats ?? 0),
      recentMedals: medals,
    };
  }),
});
