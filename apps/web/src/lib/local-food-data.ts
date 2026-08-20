export type LocalFood = {
  id: string;
  name: string;
  aliases: string[];
  category?: string;
  basis?: string;
  calories: number;
  fat: number;
  saturatedFat: number;
  carbs: number;
  sugar: number;
  protein: number;
  fiber: number;
  sodium: number;
  vitaminA: number;
  vitaminB1: number;
  vitaminB11: number;
  vitaminB12: number;
  vitaminB2: number;
  vitaminB3: number;
  vitaminB5: number;
  vitaminB6: number;
  vitaminC: number;
  vitaminD: number;
  vitaminE: number;
  vitaminK: number;
  calcium: number;
  copper: number;
  iron: number;
  magnesium: number;
  manganese: number;
  phosphorus: number;
  potassium: number;
  selenium: number;
  zinc: number;
};

const FOOD_DATA_FILES = [
  "/fooddata/FOOD-DATA-GROUP1.csv",
  "/fooddata/FOOD-DATA-GROUP2.csv",
  "/fooddata/FOOD-DATA-GROUP3.csv",
  "/fooddata/FOOD-DATA-GROUP4.csv",
  "/fooddata/FOOD-DATA-GROUP5.csv",
  "/fooddata/nepali_foods_nutrition.csv",
  "/fooddata/nepali_foods_additional_250.csv",
  "/fooddata/nepali_foods_additional_250_part2.csv",
];

const NEPALI_FOOD_HEADERS = [
  "Unnamed: 0",
  "English Name",
  "Nepali Romanized",
  "Nepali Script",
  "food",
  "Category",
  "Preparation",
  "Basis",
  "Caloric Value",
  "Fat",
  "Saturated Fats",
  "Monounsaturated Fats",
  "Polyunsaturated Fats",
  "Carbohydrates",
  "Sugars",
  "Protein",
  "Dietary Fiber",
  "Cholesterol",
  "Sodium",
  "Water",
  "Vitamin A",
  "Vitamin B1",
  "Vitamin B11",
  "Vitamin B12",
  "Vitamin B2",
  "Vitamin B3",
  "Vitamin B5",
  "Vitamin B6",
  "Vitamin C",
  "Vitamin D",
  "Vitamin E",
  "Vitamin K",
  "Calcium",
  "Copper",
  "Iron",
  "Magnesium",
  "Manganese",
  "Phosphorus",
  "Potassium",
  "Selenium",
  "Zinc",
  "Nutrition Density",
  "Data Quality",
];

let cachedFoods: LocalFood[] | null = null;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function toNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getFirstAvailable(values: string[], headers: string[], names: string[]) {
  for (const name of names) {
    const index = headers.indexOf(name);
    const value = index >= 0 ? values[index]?.trim() : "";
    if (value) return value;
  }
  return "";
}

function parseFoodCsv(csv: string, groupIndex: number) {
  const [firstLine, ...remainingLines] = csv.trim().split(/\r?\n/);
  const firstValues = parseCsvLine(firstLine);
  const hasHeader = firstValues.includes("food") || firstValues.includes("Caloric Value");
  const headers = hasHeader ? firstValues : NEPALI_FOOD_HEADERS;
  const lines = hasHeader ? remainingLines : [firstLine, ...remainingLines];
  const indexOf = (name: string) => headers.indexOf(name);

  return lines
    .map((line, rowIndex): LocalFood | null => {
      if (!line.trim()) return null;

      const values = parseCsvLine(line);
      const name = getFirstAvailable(values, headers, ["food", "English Name", "Nepali Romanized"]);
      if (!name) return null;
      const aliases = [
        getFirstAvailable(values, headers, ["English Name"]),
        getFirstAvailable(values, headers, ["Nepali Romanized"]),
        getFirstAvailable(values, headers, ["Nepali Script"]),
        name,
      ].filter((value, index, all) => value && all.indexOf(value) === index);

      return {
        id: `local-food-${groupIndex}-${rowIndex}`,
        name,
        aliases,
        category: getFirstAvailable(values, headers, ["Category"]),
        basis: getFirstAvailable(values, headers, ["Basis"]),
        calories: toNumber(values[indexOf("Caloric Value")]),
        fat: toNumber(values[indexOf("Fat")]),
        saturatedFat: toNumber(values[indexOf("Saturated Fats")]),
        carbs: toNumber(values[indexOf("Carbohydrates")]),
        sugar: toNumber(values[indexOf("Sugars")]),
        protein: toNumber(values[indexOf("Protein")]),
        fiber: toNumber(values[indexOf("Dietary Fiber")]),
        sodium: toNumber(values[indexOf("Sodium")]),
        vitaminA: toNumber(values[indexOf("Vitamin A")]),
        vitaminB1: toNumber(values[indexOf("Vitamin B1")]),
        vitaminB11: toNumber(values[indexOf("Vitamin B11")]),
        vitaminB12: toNumber(values[indexOf("Vitamin B12")]),
        vitaminB2: toNumber(values[indexOf("Vitamin B2")]),
        vitaminB3: toNumber(values[indexOf("Vitamin B3")]),
        vitaminB5: toNumber(values[indexOf("Vitamin B5")]),
        vitaminB6: toNumber(values[indexOf("Vitamin B6")]),
        vitaminC: toNumber(values[indexOf("Vitamin C")]),
        vitaminD: toNumber(values[indexOf("Vitamin D")]),
        vitaminE: toNumber(values[indexOf("Vitamin E")]),
        vitaminK: toNumber(values[indexOf("Vitamin K")]),
        calcium: toNumber(values[indexOf("Calcium")]),
        copper: toNumber(values[indexOf("Copper")]),
        iron: toNumber(values[indexOf("Iron")]),
        magnesium: toNumber(values[indexOf("Magnesium")]),
        manganese: toNumber(values[indexOf("Manganese")]),
        phosphorus: toNumber(values[indexOf("Phosphorus")]),
        potassium: toNumber(values[indexOf("Potassium")]),
        selenium: toNumber(values[indexOf("Selenium")]),
        zinc: toNumber(values[indexOf("Zinc")]),
      };
    })
    .filter((food): food is LocalFood => Boolean(food));
}

export async function loadLocalFoods() {
  if (cachedFoods) return cachedFoods;

  const files = await Promise.all(
    FOOD_DATA_FILES.map(async (file, index) => {
      const response = await fetch(file);
      if (!response.ok) return [];
      return parseFoodCsv(await response.text(), index + 1);
    })
  );

  cachedFoods = files.flat();
  return cachedFoods;
}

export function searchLocalFoods(foods: LocalFood[], query: string, limit = 8) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return foods
    .filter((food) => [food.name, ...food.aliases].join(" ").toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aAliases = a.aliases.map((alias) => alias.toLowerCase());
      const bAliases = b.aliases.map((alias) => alias.toLowerCase());
      const aExact = aAliases.includes(normalizedQuery) ? 0 : aAliases.some((alias) => alias.startsWith(normalizedQuery)) ? 1 : 2;
      const bExact = bAliases.includes(normalizedQuery) ? 0 : bAliases.some((alias) => alias.startsWith(normalizedQuery)) ? 1 : 2;
      return aExact - bExact || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
