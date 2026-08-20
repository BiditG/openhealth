import { GoogleGenerativeAI, type Schema, SchemaType } from "@google/generative-ai";
import type { NutritionRecognitionResult } from "@open-health/shared/types";

const nutritionLabelSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    foodName: { type: SchemaType.STRING, description: "Food name" },
    brand: { type: SchemaType.STRING, description: "Brand name", nullable: true },
    servingSize: { type: SchemaType.NUMBER, description: "Serving size number" },
    servingUnit: { type: SchemaType.STRING, description: "Serving unit such as g, ml, piece, cup, or plate" },
    calories: { type: SchemaType.NUMBER, description: "Calories in kcal" },
    proteinG: { type: SchemaType.NUMBER, description: "Protein in grams" },
    fatG: { type: SchemaType.NUMBER, description: "Fat in grams" },
    carbsG: { type: SchemaType.NUMBER, description: "Carbohydrates in grams" },
    sodiumMg: { type: SchemaType.NUMBER, description: "Sodium in mg", nullable: true },
    sugarG: { type: SchemaType.NUMBER, description: "Sugar in grams", nullable: true },
    fiberG: { type: SchemaType.NUMBER, description: "Fiber in grams", nullable: true },
    saturatedFatG: { type: SchemaType.NUMBER, description: "Saturated fat in grams", nullable: true },
    transFatG: { type: SchemaType.NUMBER, description: "Trans fat in grams", nullable: true },
    cholesterolMg: { type: SchemaType.NUMBER, description: "Cholesterol in mg", nullable: true },
    calciumMg: { type: SchemaType.NUMBER, description: "Calcium in mg", nullable: true },
    ironMg: { type: SchemaType.NUMBER, description: "Iron in mg", nullable: true },
    potassiumMg: { type: SchemaType.NUMBER, description: "Potassium in mg", nullable: true },
    vitaminAMcg: { type: SchemaType.NUMBER, description: "Vitamin A in mcg RAE", nullable: true },
    vitaminCMg: { type: SchemaType.NUMBER, description: "Vitamin C in mg", nullable: true },
    vitaminDMcg: { type: SchemaType.NUMBER, description: "Vitamin D in mcg", nullable: true },
    notes: { type: SchemaType.STRING, description: "Food recognition notes, visible portion assumptions, label details, allergens, vegetarian marks, origin, or storage instructions", nullable: true },
    inferredFields: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Fields inferred by AI from visible food portions or food knowledge instead of read directly from a label. Use camelCase field names.",
    },
  },
  required: ["foodName", "servingSize", "servingUnit", "calories", "proteinG", "fatG", "carbsG", "inferredFields"],
};

const LABEL_SYSTEM_PROMPT = `You are a food photo and nutrition label analysis assistant for consumer calorie tracking.

Rules:
1. If the image shows a nutrition label or packaged food facts panel, extract the label values and prefer per-serving nutrition values. If only per-100g/ml values are available, use 100 as servingSize.
2. If the image shows prepared food, identify the visible dish or combined meal and estimate nutrition for the visible edible portion.
3. For mixed meals, return one concise foodName such as "Dal bhat with chicken curry" and combine total calories/macros for the whole visible portion.
4. Read the brand from the package when visible; otherwise use null.
5. servingUnit is usually "g", "ml", "piece", "cup", "bowl", "plate", or "serving". For food photos, use a natural servingUnit and set servingSize to the estimated portion quantity or weight.
6. Convert values to the correct units: kcal for calories, g for protein/fat/carbs/fiber/sugar, mg for sodium/calcium/iron/potassium/cholesterol, mcg for vitamins A/D, and mg for vitamin C.
7. If energy is shown as kJ, convert to kcal by dividing by 4.184.
8. Optional fields that cannot be read or reasonably estimated should be null.
9. For labels or foods from Nepal, India, or other South Asian markets, carefully handle familiar foods, portion sizes, per-serving, per-100g, and daily value formats.
10. notes should briefly explain the visible portion, key assumptions, allergens, vegetarian/vegan marks, origin, storage instructions, or preparation notes. Use null if none are present.
11. If the photo is a prepared food photo, most nutrition values are estimates. List estimated field names in inferredFields, especially calories, proteinG, fatG, carbsG, servingSize, and optional nutrients.
12. If a label value is directly read, do not list that field in inferredFields. If a value is inferred from food knowledge or visible portion size, list its camelCase field name.
13. If the image is too unclear to identify food, return foodName "Unknown food", calories 0, proteinG 0, fatG 0, carbsG 0, servingSize 1, servingUnit "serving", notes explaining that the image was unclear, and inferredFields ["foodName"].`;

const ESTIMATION_SYSTEM_PROMPT = `You are a nutrition estimation assistant for Nepal and South Asian meals. Users may describe food in English, Nepali Unicode, or Romanized Nepali such as "dal bhat tarkari", "2 plate momo", "dherai bhat khaye", or "chiura ra masu".

Rules:
1. Estimate a reasonable portion from the user's description. If the user provides weight or volume, use that.
2. servingSize is the total estimated weight or volume for the described portion. servingUnit is usually "g", "ml", "piece", "cup", "bowl", or "plate".
3. Nutrition values are totals for the user's described portion.
4. Use kcal for calories, g for protein/fat/carbs/fiber/sugar, mg for sodium/calcium/iron/potassium/cholesterol, mcg for vitamins A/D, and mg for vitamin C.
5. Estimate fields when reasonable; optional fields that cannot be estimated should be null.
6. Return foodName in English or Romanized Nepali, concise and user-friendly.
7. If the description is vague, use common Nepal/South Asian household portions.
8. notes should summarize ingredients, portion, and preparation when available. Use null if no details are available.
9. Nutrition estimates are not medically precise and can vary by portion size and preparation.

Return strict JSON only, with no extra text:
{
  "foodName": "Food name",
  "brand": null,
  "servingSize": number,
  "servingUnit": "g",
  "calories": number,
  "proteinG": number,
  "fatG": number,
  "carbsG": number,
  "sodiumMg": number or null,
  "sugarG": number or null,
  "fiberG": number or null,
  "saturatedFatG": number or null,
  "transFatG": number or null,
  "cholesterolMg": number or null,
  "calciumMg": number or null,
  "ironMg": number or null,
  "potassiumMg": number or null,
  "vitaminAMcg": number or null,
  "vitaminCMg": number or null,
  "vitaminDMcg": number or null,
  "notes": "Ingredient and preparation notes, or null"
}

Return JSON only.`;

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gpt-oss:20b";
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash";

function getOllamaApiBaseUrl() {
  const baseUrl = OLLAMA_BASE_URL.replace(/\/$/, "");
  if (baseUrl.endsWith("/api")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl.slice(0, -3)}/api`;
  return `${baseUrl}/api`;
}

function getOllamaHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  }
  return headers;
}

function extractJsonObject(text: string) {
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  const objectStart = jsonStr.indexOf("{");
  const arrayStart = jsonStr.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
  const objectEnd = jsonStr.lastIndexOf("}");
  const arrayEnd = jsonStr.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);
  if (start >= 0 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
  }
  return JSON.parse(jsonStr);
}

async function callOllamaJson(
  system: string,
  user: string,
  images?: string[]
) {
  const response = await fetch(`${getOllamaApiBaseUrl()}/chat`, {
    method: "POST",
    headers: getOllamaHeaders(),
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: { temperature: 0.2 },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: user,
          ...(images?.length ? { images } : {}),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const content = result.message?.content ?? result.response;
  if (!content) {
    throw new Error("Ollama did not return a response");
  }
  return extractJsonObject(content);
}

async function callGeminiNutritionLabel(base64Image: string) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_VISION_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: nutritionLabelSchema,
    },
  });

  const result = await model.generateContent([
    {
      text: `${LABEL_SYSTEM_PROMPT}

Return strict JSON only. Do not include markdown, prose, or extra keys.`,
    },
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image,
      },
    },
  ]);

  const normalized = normalizeNutritionData(extractJsonObject(result.response.text()));
  if (!normalized) {
    throw new Error("Gemini returned an incomplete nutrition format");
  }

  return normalized;
}

function normalizeNutritionData(data: unknown): NutritionRecognitionResult | null {
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (data.length === 1) return normalizeNutritionData(data[0]);

    const rows = data.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    const names = rows.map((d) => d.foodName).filter(Boolean);
    const notes = rows.map((d) => d.notes).filter(Boolean).join("; ");
    const sumNum = (key: string) => {
      const vals = rows
        .map((d) => d[key])
        .filter((v: unknown): v is number => typeof v === "number" && Number.isFinite(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };

    return {
      foodName: names.join(" + ") || "Mixed meal",
      brand: null,
      servingSize: sumNum("servingSize") ?? 100,
      servingUnit: String(rows[0]?.servingUnit || "g"),
      calories: sumNum("calories") ?? 0,
      proteinG: sumNum("proteinG") ?? 0,
      fatG: sumNum("fatG") ?? 0,
      carbsG: sumNum("carbsG") ?? 0,
      sodiumMg: sumNum("sodiumMg"),
      sugarG: sumNum("sugarG"),
      fiberG: sumNum("fiberG"),
      saturatedFatG: sumNum("saturatedFatG"),
      transFatG: sumNum("transFatG"),
      cholesterolMg: sumNum("cholesterolMg"),
      calciumMg: sumNum("calciumMg"),
      ironMg: sumNum("ironMg"),
      potassiumMg: sumNum("potassiumMg"),
      vitaminAMcg: sumNum("vitaminAMcg"),
      vitaminCMg: sumNum("vitaminCMg"),
      vitaminDMcg: sumNum("vitaminDMcg"),
      notes: notes || null,
      inferredFields: [
        ...new Set(rows.flatMap((d) => (Array.isArray(d.inferredFields) ? d.inferredFields : []))),
      ] as string[],
    };
  }

  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (!row.foodName || row.calories == null) return null;

  return {
    foodName: String(row.foodName),
    brand: row.brand ? String(row.brand) : null,
    servingSize: Number(row.servingSize ?? 100),
    servingUnit: String(row.servingUnit ?? "g"),
    calories: Number(row.calories ?? 0),
    proteinG: Number(row.proteinG ?? 0),
    fatG: Number(row.fatG ?? 0),
    carbsG: Number(row.carbsG ?? 0),
    sodiumMg: row.sodiumMg == null ? null : Number(row.sodiumMg),
    sugarG: row.sugarG == null ? null : Number(row.sugarG),
    fiberG: row.fiberG == null ? null : Number(row.fiberG),
    saturatedFatG: row.saturatedFatG == null ? null : Number(row.saturatedFatG),
    transFatG: row.transFatG == null ? null : Number(row.transFatG),
    cholesterolMg: row.cholesterolMg == null ? null : Number(row.cholesterolMg),
    calciumMg: row.calciumMg == null ? null : Number(row.calciumMg),
    ironMg: row.ironMg == null ? null : Number(row.ironMg),
    potassiumMg: row.potassiumMg == null ? null : Number(row.potassiumMg),
    vitaminAMcg: row.vitaminAMcg == null ? null : Number(row.vitaminAMcg),
    vitaminCMg: row.vitaminCMg == null ? null : Number(row.vitaminCMg),
    vitaminDMcg: row.vitaminDMcg == null ? null : Number(row.vitaminDMcg),
    notes: row.notes ? String(row.notes) : null,
    inferredFields: Array.isArray(row.inferredFields) ? row.inferredFields.map(String) : [],
  };
}

export type NutritionLabelResult =
  | { success: true; data: NutritionRecognitionResult }
  | { success: false; error: string };

export type NutritionEstimationResult =
  | { success: true; data: NutritionRecognitionResult }
  | { success: false; error: string };

export async function recognizeNutritionLabel(
  base64Image: string
): Promise<NutritionLabelResult> {
  if (process.env.GOOGLE_AI_API_KEY) {
    try {
      const data = await callGeminiNutritionLabel(base64Image);
      return { success: true, data };
    } catch (error) {
      console.warn("Gemini nutrition label recognition failed, checking Ollama fallback:", error);
    }
  }

  try {
    const data = await callOllamaJson(
      LABEL_SYSTEM_PROMPT,
      "Extract nutrition facts from this image and return strict JSON matching the requested schema.",
      [base64Image]
    );
    const normalized = normalizeNutritionData(data);
    if (normalized) {
      return { success: true, data: normalized };
    }
  } catch (error) {
    console.warn("Ollama nutrition label recognition failed, checking fallback:", error);
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    return {
      success: false,
      error: "Gemini vision is not configured. Add GOOGLE_AI_API_KEY to enable Snap recognition.",
    };
  }

  return {
    success: false,
    error: "Vision recognition failed. Please retake the photo in good light and try again.",
  };
}

export async function estimateNutritionFromText(
  description: string
): Promise<NutritionEstimationResult> {
  if (!description.trim()) {
    return { success: false, error: "Please enter a food description" };
  }

  try {
    const data = await callOllamaJson(ESTIMATION_SYSTEM_PROMPT, description);
    const normalized = normalizeNutritionData(data);
    if (!normalized) {
      return { success: false, error: "AI returned an incomplete format" };
    }
    return { success: true, data: normalized };
  } catch (error) {
    console.warn("Ollama food estimation failed, checking fallback:", error);
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return { success: false, error: "Ollama is unavailable and no fallback text AI key is configured" };
  }

  try {
    const response = await fetch(
      "https://api.minimax.io/v1/text/chatcompletion_v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "MiniMax-M2.7",
          messages: [
            { role: "system", content: ESTIMATION_SYSTEM_PROMPT },
            { role: "user", content: description },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MiniMax API error:", response.status, errorText);
      return { success: false, error: `API request failed (${response.status})` };
    }

    const result = await response.json();

    if (result.base_resp?.status_code !== 0) {
      console.error("MiniMax API error:", result.base_resp);
      return {
        success: false,
        error: `AI service error: ${result.base_resp?.status_msg || "Unknown error"}`,
      };
    }

    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: "AI did not return a result" };
    }

    const data = normalizeNutritionData(extractJsonObject(content));
    if (!data) {
      return { success: false, error: "AI returned an incomplete format" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Food estimation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Estimation failed. Please try again.",
    };
  }
}
