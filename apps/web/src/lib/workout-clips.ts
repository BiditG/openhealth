export type WorkoutClip = {
  id: string;
  name: string;
  muscle: string;
  exerciseKey?: string;
  src: string;
};

const CLIP_BASE = "/Workout/workoutclips";

export const WORKOUT_CLIPS: WorkoutClip[] = [
  { id: "crunch", name: "Crunch", muscle: "Abs", exerciseKey: "crunch", src: `${CLIP_BASE}/Abs/Crunch.mp4` },
  { id: "hollow-hold", name: "Hollow hold", muscle: "Abs", src: `${CLIP_BASE}/Abs/hollowhold.mp4` },
  { id: "leg-raises", name: "Leg raises", muscle: "Abs", exerciseKey: "legRaise", src: `${CLIP_BASE}/Abs/Legraises.mp4` },
  { id: "plank", name: "Plank", muscle: "Abs", exerciseKey: "plank", src: `${CLIP_BASE}/Abs/plank.mp4` },
  { id: "situps", name: "Sit-ups", muscle: "Abs", exerciseKey: "situp", src: `${CLIP_BASE}/Abs/Situps.mp4` },
  { id: "toe-touch", name: "Toe touch", muscle: "Abs", src: `${CLIP_BASE}/Abs/Toetouch.mp4` },
  { id: "lateral-lunge", name: "Lateral lunge", muscle: "Adductors", exerciseKey: "forwardLunge", src: `${CLIP_BASE}/Adductors/laterallunge.mp4` },
  { id: "side-lying-leg-raise", name: "Side lying leg raise", muscle: "Adductors", exerciseKey: "legRaise", src: `${CLIP_BASE}/Adductors/sidelyinglegraise.mp4` },
  { id: "calf-pulses", name: "Calf pulses", muscle: "Calves", exerciseKey: "calfRaise", src: `${CLIP_BASE}/Calves/calfpulses.mp4` },
  { id: "pogo-jumps", name: "Pogo jumps", muscle: "Calves", exerciseKey: "squatJump", src: `${CLIP_BASE}/Calves/pogojumps.mp4` },
  { id: "single-leg-calf-raise", name: "Single leg calf raise", muscle: "Calves", exerciseKey: "calfRaise", src: `${CLIP_BASE}/Calves/singlelegcalfraise.mp4` },
  { id: "standing-calf-raise", name: "Standing calf raise", muscle: "Calves", exerciseKey: "calfRaise", src: `${CLIP_BASE}/Calves/standingcalfraise.mp4` },
  { id: "diamond-pushup", name: "Diamond push-up", muscle: "Chest", exerciseKey: "pushup", src: `${CLIP_BASE}/Chest/diamondpushup.mp4` },
  { id: "hindu-pushup", name: "Hindu push-up", muscle: "Chest", exerciseKey: "pushup", src: `${CLIP_BASE}/Chest/hindupushup.mp4` },
  { id: "pike-pushup", name: "Pike push-up", muscle: "Chest", exerciseKey: "pushup", src: `${CLIP_BASE}/Chest/pikepushup.mp4` },
  { id: "plyometric-pushup", name: "Plyometric push-up", muscle: "Chest", exerciseKey: "pushup", src: `${CLIP_BASE}/Chest/polymetricpushup.mp4` },
  { id: "pushup", name: "Push-up", muscle: "Chest", exerciseKey: "pushup", src: `${CLIP_BASE}/Chest/pushup.mp4` },
  { id: "shoulder-tap-chest", name: "Shoulder tap", muscle: "Chest", exerciseKey: "shoulderTaps", src: `${CLIP_BASE}/Chest/shouldertap.mp4` },
  { id: "fingertip-plank", name: "Fingertip plank", muscle: "Forearms", exerciseKey: "plank", src: `${CLIP_BASE}/Forearms/Finertipplank.mp4` },
  { id: "knuckle-pushups", name: "Knuckle push-ups", muscle: "Forearms", exerciseKey: "pushup", src: `${CLIP_BASE}/Forearms/knucklepushups.mp4` },
  { id: "donkey-kick", name: "Donkey kick", muscle: "Glutes", exerciseKey: "gluteBridge", src: `${CLIP_BASE}/Glutes/donkeykick.mp4` },
  { id: "glute-bridge", name: "Glute bridge", muscle: "Glutes", exerciseKey: "gluteBridge", src: `${CLIP_BASE}/Glutes/glutebridge.mp4` },
  { id: "hip-thrust", name: "Hip thrust", muscle: "Glutes", exerciseKey: "gluteBridge", src: `${CLIP_BASE}/Glutes/hipthrust.mp4` },
  { id: "single-leg-glute-bridge", name: "Single leg glute bridge", muscle: "Glutes", exerciseKey: "gluteBridge", src: `${CLIP_BASE}/Glutes/singlelegglutebridge.mp4` },
  { id: "good-morning", name: "Good morning", muscle: "Hamstrings", exerciseKey: "gluteBridge", src: `${CLIP_BASE}/Hamstrings/goodmorning.mp4` },
  { id: "single-leg-romanian-deadlift", name: "Single leg Romanian deadlift", muscle: "Hamstrings", src: `${CLIP_BASE}/Hamstrings/singlelegromaniandeadlift.mp4` },
  { id: "cobra-raise", name: "Cobra raise", muscle: "Lower back", src: `${CLIP_BASE}/lowerback/cobraraise.mp4` },
  { id: "superman-hold", name: "Superman hold", muscle: "Lower back", src: `${CLIP_BASE}/lowerback/supermanhold.mp4` },
  { id: "bicycle-crunch", name: "Bicycle crunch", muscle: "Obliques", exerciseKey: "crunch", src: `${CLIP_BASE}/Obliques/bicyclecrunch.mp4` },
  { id: "mountain-climber", name: "Mountain climber", muscle: "Obliques", exerciseKey: "mountainClimbers", src: `${CLIP_BASE}/Obliques/mountainclimber.mp4` },
  { id: "russian-twist", name: "Russian twist", muscle: "Obliques", src: `${CLIP_BASE}/Obliques/russiantwist.mp4` },
  { id: "side-plank-hip-dip", name: "Side plank hip dip", muscle: "Obliques", exerciseKey: "sidePlank", src: `${CLIP_BASE}/Obliques/sideplanckhipdip.mp4` },
  { id: "bodyweight-squat", name: "Bodyweight squat", muscle: "Quadriceps", exerciseKey: "squat", src: `${CLIP_BASE}/Quadriceps/Bodyweightsquat.mp4` },
  { id: "jump-squats", name: "Jump squats", muscle: "Quadriceps", exerciseKey: "squatJump", src: `${CLIP_BASE}/Quadriceps/jumpsquats.mp4` },
  { id: "lunges", name: "Lunges", muscle: "Quadriceps", exerciseKey: "forwardLunge", src: `${CLIP_BASE}/Quadriceps/Lunges.mp4` },
  { id: "split-squat", name: "Split squat", muscle: "Quadriceps", exerciseKey: "squat", src: `${CLIP_BASE}/Quadriceps/Splitsquat.mp4` },
  { id: "wall-sit-hold", name: "Wall sit hold", muscle: "Quadriceps", exerciseKey: "wallSit", src: `${CLIP_BASE}/Quadriceps/Wallsithold.mp4` },
  { id: "pike-pushup-shoulder", name: "Pike push-up", muscle: "Shoulder", exerciseKey: "pushup", src: `${CLIP_BASE}/Shoulder/pikepushup.mp4` },
  { id: "pushup-shoulder", name: "Push-up", muscle: "Shoulder", exerciseKey: "pushup", src: `${CLIP_BASE}/Shoulder/pushup.mp4` },
  { id: "shoulder-tap", name: "Shoulder tap", muscle: "Shoulder", exerciseKey: "shoulderTaps", src: `${CLIP_BASE}/Shoulder/shouldertap.mp4` },
  { id: "side-plank-reach", name: "Side plank reach", muscle: "Shoulder", exerciseKey: "sidePlank", src: `${CLIP_BASE}/Shoulder/sideplankreach.mp4` },
  { id: "diamond-pushup-triceps", name: "Diamond push-up", muscle: "Triceps", exerciseKey: "pushup", src: `${CLIP_BASE}/Triceps/diamondpushup.mp4` },
  { id: "hindu-pushup-triceps", name: "Hindu push-up", muscle: "Triceps", exerciseKey: "pushup", src: `${CLIP_BASE}/Triceps/hindupushup.mp4` },
  { id: "prone-y-raise", name: "Prone Y raise", muscle: "Upper back", src: `${CLIP_BASE}/upperback/proneYraise.mp4` },
  { id: "prone-w-raise", name: "Prone W raise", muscle: "Upper back", src: `${CLIP_BASE}/upperback/pronWraise.mp4` },
  { id: "reverse-snow-angel", name: "Reverse snow angel", muscle: "Upper back", src: `${CLIP_BASE}/upperback/reversesnowangel.mp4` },
  { id: "superman", name: "Superman", muscle: "Upper back", src: `${CLIP_BASE}/upperback/superman.mp4` },
];

const MUSCLE_ALIASES: Record<string, string[]> = {
  abs: ["abs", "rectus abdominis", "abdominals"],
  obliques: ["obliques", "external oblique", "internal oblique"],
  chest: ["chest", "pectorals", "pectoralis major", "upper chest", "lower chest"],
  shoulder: ["shoulder", "shoulders", "deltoids", "front delts", "side delts", "rear delts"],
  triceps: ["triceps", "triceps brachii"],
  forearms: ["forearms", "forearm"],
  quadriceps: ["quadriceps", "quads", "thighs", "rectus femoris"],
  hamstrings: ["hamstrings", "biceps femoris"],
  glutes: ["glutes", "gluteus", "gluteus maximus"],
  calves: ["calves", "calf", "gastrocnemius", "soleus"],
  adductors: ["adductors", "inner thigh"],
  "lower back": ["lower back", "erector spinae", "lumbar"],
  "upper back": ["upper back", "trapezius", "traps", "lats", "latissimus dorsi", "rhomboids"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").trim();
}

export function getWorkoutClipsForMuscle(muscle: string) {
  const normalized = normalize(muscle);
  const matchingGroup = Object.entries(MUSCLE_ALIASES).find(([group, aliases]) =>
    group === normalized || aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
  )?.[0];

  return WORKOUT_CLIPS.filter((clip) => normalize(clip.muscle) === matchingGroup);
}

export function getWorkoutClipForExercise(exerciseKey?: string, label?: string) {
  if (exerciseKey) {
    const match = WORKOUT_CLIPS.find((clip) => clip.exerciseKey === exerciseKey);
    if (match) return match;
  }

  if (!label) return null;
  const normalizedLabel = normalize(label);
  return (
    WORKOUT_CLIPS.find((clip) => normalize(clip.name) === normalizedLabel) ??
    WORKOUT_CLIPS.find((clip) => normalizedLabel.includes(normalize(clip.name)) || normalize(clip.name).includes(normalizedLabel)) ??
    null
  );
}
