/**
 * recipes.ts: the 16 recipes, the non-recipe Mystery Mush, and the pure matcher (spec section 5 "Cooking",
 * section 6 "Recipes"). Ingredients are sorted ingredient-id arrays; 'any_fish' stands for exactly one fish of
 * any species. Matching is order-independent and exact-set.
 */
import { FISH_BY_ID, isFishId } from './fish';
import { FORAGE_BY_ID, isForageId } from './forage';
import { PANTRY_BY_ID, isPantryId } from './pantry';
import type { CookwareId, DishDef, DishId, FishId, IngredientId, MatchContext, MatchResult, RecipeDef, RecipeId } from './types';
import { CONTENTMENT, ECONOMY } from './world';

const sorted = (ids: readonly IngredientId[]): readonly IngredientId[] => [...ids].sort();

export const RECIPES: readonly RecipeDef[] = [
  {
    id: 'herb_tea', order: 1, name: 'Lemongrass Tea', cookware: 'kettle', ingredients: sorted(['herbs']),
    sell: { kind: 'fixed', value: 8 }, contentment: 8, hint: 'Just leaves and hot water',
    flavor: 'Green and gentle, with a little steam curl on top.',
  },
  {
    id: 'honey_tea', order: 2, name: 'Honey Kaapi', cookware: 'kettle', ingredients: sorted(['tea', 'honey']),
    sell: { kind: 'fixed', value: 14 }, contentment: 10, hint: 'Golden and sweet',
    flavor: 'Sweet, golden and warm all the way down.',
  },
  {
    id: 'berry_cordial', order: 3, name: 'Jamun Sharbat', cookware: 'kettle', ingredients: sorted(['berries', 'honey']),
    sell: { kind: 'fixed', value: 14 }, contentment: 10, hint: 'Pink and sweet',
    flavor: 'Pink as a sunrise and twice as sweet.',
  },
  {
    id: 'spiced_tea', order: 4, name: 'Cardamom Kaapi', cookware: 'kettle', ingredients: sorted(['tea', 'spice']),
    sell: { kind: 'fixed', value: 12 }, contentment: 12, hint: 'Warms you to the toes',
    flavor: 'A cup that warms you right to the toes.',
  },
  {
    id: 'mushroom_soup', order: 5, name: 'Mushroom Saaru', cookware: 'pot', ingredients: sorted(['mushrooms', 'herbs']),
    sell: { kind: 'fixed', value: 16 }, contentment: 12, hint: 'Earthy and green',
    flavor: 'Earthy, green and comforting as a blanket.',
  },
  {
    id: 'fish_congee', order: 6, name: 'Fish Ganji', cookware: 'pot', ingredients: sorted(['any_fish', 'rice']),
    sell: { kind: 'fixed', value: 20 }, contentment: 14, hint: 'Soft rice and something from the water',
    flavor: 'Soft rice simmered slow with the morning\'s catch.',
  },
  {
    id: 'campfire_stew', order: 7, name: 'Monsoon Fish Curry', cookware: 'pot', ingredients: sorted(['any_fish', 'mushrooms', 'herbs']),
    sell: { kind: 'fixed', value: 30 }, contentment: 18, hint: 'The woods and the water in one pot',
    flavor: 'The woods and the water, bubbling together in one pot.',
  },
  {
    id: 'berry_pudding', order: 8, name: 'Jamun Payasa', cookware: 'pot', ingredients: sorted(['rice', 'berries', 'honey']),
    sell: { kind: 'fixed', value: 24 }, contentment: 16, hint: 'Dessert from the pot',
    flavor: 'Creamy rice with a swirl of pink. Dessert by the fire.',
  },
  {
    id: 'nutty_porridge', order: 9, name: 'Jack-Seed Huggi', cookware: 'pot', ingredients: sorted(['rice', 'nuts', 'honey']),
    sell: { kind: 'fixed', value: 22 }, contentment: 14, hint: 'A crunchy breakfast',
    flavor: 'Warm, nutty and crunchy on top. A proper breakfast.',
  },
  {
    id: 'grilled_fish', order: 10, name: 'Meen Fry', cookware: 'skillet', ingredients: sorted(['any_fish']),
    sell: { kind: 'fish_multiple', factor: ECONOMY.grilledFishMultiplier }, contentment: 10, hint: 'Simple and smoky',
    flavor: 'Simple, smoky and a little crisp at the edges.',
  },
  {
    id: 'herb_butter_fish', order: 11, name: 'Pepper Fish Roast', cookware: 'skillet', ingredients: sorted(['any_fish', 'herbs', 'spice']),
    sell: { kind: 'fixed', value: 30 }, contentment: 16, hint: 'Fancy fish',
    flavor: 'Glossy, herby and a bit fancy for a campsite.',
  },
  {
    id: 'pancakes', order: 12, name: 'Honey Akki Otti', cookware: 'skillet', ingredients: sorted(['flour', 'honey']),
    sell: { kind: 'fixed', value: 16 }, contentment: 12, hint: 'Flip, flip!',
    flavor: 'Fluffy stacks with honey running down the sides.',
  },
  {
    id: 'berry_pancakes', order: 13, name: 'Jamun Otti', cookware: 'skillet', ingredients: sorted(['flour', 'berries', 'honey']),
    sell: { kind: 'fixed', value: 22 }, contentment: 14, hint: 'Fluffy, with a pink surprise',
    flavor: 'Fluffy pancakes hiding a pink surprise in every bite.',
  },
  {
    id: 'mushroom_skewers', order: 14, name: 'Pepper Mushroom Skewers', cookware: 'skillet', ingredients: sorted(['mushrooms', 'spice']),
    sell: { kind: 'fixed', value: 14 }, contentment: 10, hint: 'On a stick, over the flames',
    flavor: 'Spiced caps on a stick, toasted over the flames.',
  },
  {
    id: 'cloud_buns', order: 15, name: 'Cloud Idli', cookware: 'steamer', ingredients: sorted(['flour', 'honey', 'nuts']),
    sell: { kind: 'fixed', value: 26 }, contentment: 16, hint: 'Soft as a cloud',
    flavor: 'Soft as a cloud, with a sweet nutty heart.',
  },
  {
    id: 'moonlight_dumplings', order: 16, name: 'Moonlight Kadubu', cookware: 'steamer', ingredients: sorted(['flour', 'moonblossom', 'glowfin']),
    sell: { kind: 'unsellable' }, contentment: 25, hint: 'The legend\'s favorite',
    flavor: 'They glow a little. The guardian\'s favorite, so the legend says.',
  },
];

export const RECIPE_BY_ID: Record<RecipeId, RecipeDef> = RECIPES.reduce(
  (acc, r) => ((acc[r.id] = r), acc),
  {} as Record<RecipeId, RecipeDef>,
);
export const RECIPE_IDS: readonly RecipeId[] = RECIPES.map((r) => r.id);
export function isRecipeId(id: string): id is RecipeId { return id in RECIPE_BY_ID; }

/** The non-recipe result of a combination that matches nothing. Not a journal entry. */
export const MYSTERY_MUSH: DishDef = {
  id: 'mystery_mush',
  name: 'Mystery Mush',
  flavor: 'It\'s... edible? It has a funny face.',
  sell: ECONOMY.mysteryMushSell,
  contentment: CONTENTMENT.gains.mysteryMush,
  isRecipe: false,
};
export function isDishId(id: string): id is DishId { return id === 'mystery_mush' || isRecipeId(id); }

/** Shop/sell value of one ingredient: staples at shop price, forage and fish at their sell price, unsellable = 0. */
export function ingredientValue(id: IngredientId, ctx: MatchContext = {}): number {
  if (id === 'any_fish') return 0;
  if (isPantryId(id)) return PANTRY_BY_ID[id].price;
  if (isForageId(id)) return FORAGE_BY_ID[id].sell ?? 0;
  if (isFishId(id)) return ctx.fishPrices?.[id] ?? FISH_BY_ID[id].sell;
  return 0;
}

/** Sum of ingredient values for the actual ingredients used (so 'any fish' uses the real fish's price). */
export function ingredientsValue(ids: readonly IngredientId[], ctx: MatchContext = {}): number {
  return ids.reduce((sum, id) => sum + ingredientValue(id, ctx), 0);
}

/**
 * Does this ingredient multiset match the recipe's set exactly (order ignored)?
 * Each 'any_fish' slot in the recipe consumes exactly one fish of any species from the input.
 */
export function ingredientsMatch(recipe: RecipeDef, ingredientIds: readonly IngredientId[]): boolean {
  if (ingredientIds.length !== recipe.ingredients.length) return false;
  const left: IngredientId[] = [...ingredientIds];
  let wildcards = 0;
  for (const need of recipe.ingredients) {
    if (need === 'any_fish') {
      wildcards++;
      continue;
    }
    const i = left.indexOf(need);
    if (i < 0) return false;
    left.splice(i, 1);
  }
  for (let w = 0; w < wildcards; w++) {
    const i = left.findIndex((id) => id !== 'any_fish' && isFishId(id));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return left.length === 0;
}

/** Find the recipe for a cookware + ingredient set, or null (Mystery Mush). */
export function findRecipe(cookwareId: CookwareId, ingredientIds: readonly IngredientId[]): RecipeDef | null {
  for (const r of RECIPES) {
    if (r.cookware === cookwareId && ingredientsMatch(r, ingredientIds)) return r;
  }
  return null;
}

/** The fish actually used in a cook (for 'any fish' pricing); the first fish if several. */
export function fishUsed(ingredientIds: readonly IngredientId[]): FishId | null {
  for (const id of ingredientIds) if (id !== 'any_fish' && isFishId(id)) return id;
  return null;
}

/**
 * Sell value of a recipe cooked with these actual ingredients:
 *  - fixed price, raised to the floor of 1.25x the ingredient value (staples at shop price, fish at fish price);
 *  - Grilled Fish = fish price x1.5 (already >= 1.25x);
 *  - unsellable dishes return null.
 */
export function dishSellValue(recipe: RecipeDef, ingredientIds: readonly IngredientId[], ctx: MatchContext = {}): number | null {
  const floor = Math.ceil(ingredientsValue(ingredientIds, ctx) * ECONOMY.dishFloorMultiplier);
  switch (recipe.sell.kind) {
    case 'unsellable':
      return null;
    case 'fish_multiple': {
      const fish = fishUsed(ingredientIds);
      const price = fish ? ingredientValue(fish, ctx) : 0;
      return Math.max(floor, Math.ceil(price * recipe.sell.factor));
    }
    case 'fixed':
    default:
      return Math.max(floor, recipe.sell.value);
  }
}

/**
 * The cooking matcher: cookware + exact ingredient set (order ignored, 'any fish' accepts any species).
 * Anything else is Mystery Mush (sells for 2c, +3 Contentment, not a recipe).
 */
export function matchRecipe(cookwareId: CookwareId, ingredientIds: readonly IngredientId[], ctx: MatchContext = {}): MatchResult {
  const r = findRecipe(cookwareId, ingredientIds);
  if (!r) {
    return { recipeId: 'mystery_mush', sellValue: MYSTERY_MUSH.sell, contentment: MYSTERY_MUSH.contentment, isRecipe: false };
  }
  return { recipeId: r.id, sellValue: dishSellValue(r, ingredientIds, ctx), contentment: r.contentment, isRecipe: true };
}

/** Display info for any dish id (recipe or Mystery Mush); `sell` is the listed price with no fish context. */
export function dishInfo(id: DishId): DishDef {
  if (id === 'mystery_mush') return MYSTERY_MUSH;
  const r = RECIPE_BY_ID[id];
  const sell = r.sell.kind === 'fixed' ? r.sell.value : null;
  return { id, name: r.name, flavor: r.flavor, sell, contentment: r.contentment, isRecipe: true };
}

/** Recipes a cookware can make (for hints and the journal). */
export function recipesFor(cookwareId: CookwareId): readonly RecipeDef[] {
  return RECIPES.filter((r) => r.cookware === cookwareId);
}
