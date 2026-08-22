import { z } from "zod";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { didRankUp, getRankForPoints } from "@/lib/rank-system";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import {
  dailyGuidanceNotifications,
  healthTaskCompletions,
  userProfiles,
  users,
} from "@/server/db/schema";

const exerciseKeys = ["pushup", "bicepCurl", "squat", "pullup"] as const;

type ExerciseKey = (typeof exerciseKeys)[number];
type DailyTask = {
  key: string;
  title: string;
  description: string;
  category: "Task" | "Mission";
  area: string;
  difficulty: "steady" | "strong" | "elite";
  actionType: "analyzer" | "tracker" | "onsite";
  exerciseKey?: ExerciseKey;
  targetReps?: number;
  targetDistanceMeters?: number;
  medal: {
    code: string;
    name: string;
    tier: "bronze" | "silver" | "gold" | "platinum";
    points: number;
  };
};

const DAILY_TASKS: DailyTask[] = [
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
];

const DAILY_GUIDANCE = [
  {
    title: "Start with one clear win",
    body: "Pick one task first. A clean start makes the rest of the day feel easier.",
    tone: "guide",
  },
  {
    title: "Train with proof",
    body: "Exercise medals unlock only when the website analyzer verifies the target reps.",
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

function getTask(taskKey: string) {
  const task = DAILY_TASKS.find((item) => item.key === taskKey);
  if (!task) {
    throw new Error("Task not found.");
  }
  return task;
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
            eq(healthTaskCompletions.taskDate, taskDate)
          )
        ),
    ]);

    const completionByKey = new Map(completions.map((item) => [item.taskKey, item]));
    const tasks = DAILY_TASKS.map((task) => {
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

      await ctx.db
        .insert(healthTaskCompletions)
        .values({
          userId: ctx.user.id,
          taskDate,
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
        source: z.enum(["analyzer", "tracker", "website"]).default("website"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const taskDate = todayIsoDate();
      const task = getTask(input.taskKey);
      const countedReps = input.countedReps ?? 0;

      if (task.actionType === "analyzer" && countedReps < (task.targetReps ?? 0)) {
        throw new Error(`Complete ${task.targetReps} verified reps before claiming this medal.`);
      }
      if (task.actionType === "tracker" && (input.distanceMeters ?? 0) < (task.targetDistanceMeters ?? 0)) {
        throw new Error(`Cover ${(task.targetDistanceMeters ?? 0) / 1000} km before claiming this medal.`);
      }

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
          taskDate,
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
          medalPoints: task.medal.points,
          proof: { source: input.source, countedReps, distanceMeters: input.distanceMeters ?? 0 },
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
            medalPoints: task.medal.points,
            proof: { source: input.source, countedReps, distanceMeters: input.distanceMeters ?? 0 },
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

      return {
        success: true,
        medal: task.medal,
        points: nextPoints,
        rankBefore,
        rankAfter,
        levelUp: didRankUp(previousPoints, nextPoints),
        message: `${task.medal.name} unlocked.`,
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
