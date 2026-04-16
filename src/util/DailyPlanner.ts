import { IngredientName, IngredientNames } from '../data/pokemons';
import { PokemonBoxItem } from './PokemonBox';
import PokemonStrength, { StrengthParameter } from './PokemonStrength';
import { ingredientStrength as ingredientValue } from './PokemonRp';
import {
    getDailyIngredientDetailMapWithStrengthParameter,
    getRecipeFinalEnergy,
    PokedayRecipe,
    pokedayRecipeGroups,
} from './Pokeday';

export type DailyPlannerIngredientStock = Partial<Record<IngredientName, number>>;

export type DailyPlannerMealChoice = {
    slot: 0 | 1 | 2;
    recipe: PokedayRecipe;
};

export type DailyPlannerPokemonSummary = {
    item: PokemonBoxItem;
    directEnergy: number;
    ingredientCounts: Partial<Record<IngredientName, number>>;
    ingredientCoverage: number;
    score: number;
    helpBonusCount: number;
    hasHelpingBonus: boolean;
};

export type DailyPlannerResult = {
    mealChoices: DailyPlannerMealChoice[];
    demand: Partial<Record<IngredientName, number>>;
    stock: DailyPlannerIngredientStock;
    remainingDemand: Partial<Record<IngredientName, number>>;
    selectedSummaries: DailyPlannerPokemonSummary[];
    totalDirectEnergy: number;
    totalMealEnergy: number;
    totalExpectedEnergy: number;
    isDemandSatisfied: boolean;
};

export const dailyPlannerRecipes: PokedayRecipe[] = pokedayRecipeGroups
    .flatMap(group => group.recipes);

export function getRecipeByName(name: string): PokedayRecipe | null {
    return dailyPlannerRecipes.find(recipe => recipe.name === name) ?? null;
}

export function getRecipeLabel(recipe: PokedayRecipe): string {
    const group = pokedayRecipeGroups.find(x => x.category === recipe.category);
    return group === undefined ? recipe.name : `${group.title} / ${recipe.title}`;
}

export function getDefaultDailyPlannerMeals(): DailyPlannerMealChoice[] {
    const defaults = [
        pokedayRecipeGroups[0]?.recipes[0],
        pokedayRecipeGroups[1]?.recipes[0],
        pokedayRecipeGroups[2]?.recipes[0],
    ];
    return defaults.map((recipe, index) => ({
        slot: index as 0 | 1 | 2,
        recipe: recipe ?? dailyPlannerRecipes[0],
    }));
}

function createPlannerParameter(parameter: StrengthParameter,
    helpBonusCount: number): StrengthParameter {
    return {
        ...parameter,
        period: 24,
        helpBonusCount: Math.max(0, Math.min(4, Math.floor(helpBonusCount))) as 0|1|2|3|4,
    };
}

function isResourceMainSkill(skillName: string): boolean {
    return skillName.startsWith('Ingredient Magnet S') ||
        skillName.startsWith('Ingredient Draw S') ||
        skillName.startsWith('Cooking Assist S') ||
        skillName.startsWith('Cooking Power-Up S');
}

function getSkillName(item: PokemonBoxItem): string {
    return item.iv.pokemon.skill === 'Versatile' ? item.iv.versatileSkill : item.iv.pokemon.skill;
}

function calculatePokemonDailySummary(item: PokemonBoxItem,
    parameter: StrengthParameter,
    helpBonusCount: number,
): DailyPlannerPokemonSummary {
    const dailyParameter = createPlannerParameter(parameter, helpBonusCount);
    const strength = new PokemonStrength(item.iv, dailyParameter);
    const result = strength.calculate();
    const skillName = getSkillName(item);
    const resourceSkillStrength = isResourceMainSkill(skillName) ?
        result.skillStrength + result.skillStrength2 : 0;
    const directEnergy = Math.max(0,
        result.totalStrength - result.ingStrength - resourceSkillStrength);
    const ingredientMap = getDailyIngredientDetailMapWithStrengthParameter(
        item, dailyParameter, helpBonusCount);
    const ingredientCounts: Partial<Record<IngredientName, number>> = {};
    let ingredientCoverage = 0;
    for (const ingredientName of IngredientNames) {
        const total = ingredientMap[ingredientName]?.total ?? 0;
        if (total > 0) {
            ingredientCounts[ingredientName] = total;
            ingredientCoverage += total * ingredientValue[ingredientName];
        }
    }
    return {
        item,
        directEnergy,
        ingredientCounts,
        ingredientCoverage,
        score: directEnergy + ingredientCoverage,
        helpBonusCount,
        hasHelpingBonus: item.iv.hasHelpingBonusInActiveSubSkills,
    };
}

function subtractIngredientCounts(
    target: Partial<Record<IngredientName, number>>,
    source: Partial<Record<IngredientName, number>>,
): void {
    for (const ingredientName of IngredientNames) {
        const value = source[ingredientName] ?? 0;
        if (value <= 0) {
            continue;
        }
        target[ingredientName] = Math.max(0, (target[ingredientName] ?? 0) - value);
    }
}

function calculateDemandFromMeals(mealChoices: DailyPlannerMealChoice[]):
Partial<Record<IngredientName, number>> {
    const demand: Partial<Record<IngredientName, number>> = {};
    for (const meal of mealChoices) {
        for (const ingredient of meal.recipe.ingredients) {
            demand[ingredient.name] = (demand[ingredient.name] ?? 0) + ingredient.count;
        }
    }
    return demand;
}

function calculateStockedDemand(
    demand: Partial<Record<IngredientName, number>>,
    stock: DailyPlannerIngredientStock,
): Partial<Record<IngredientName, number>> {
    const remaining: Partial<Record<IngredientName, number>> = {};
    for (const ingredientName of IngredientNames) {
        const required = demand[ingredientName] ?? 0;
        if (required <= 0) {
            continue;
        }
        remaining[ingredientName] = Math.max(0, required - (stock[ingredientName] ?? 0));
    }
    return remaining;
}

function calculateCoverage(
    ingredientCounts: Partial<Record<IngredientName, number>>,
    remainingDemand: Partial<Record<IngredientName, number>>,
): number {
    let ret = 0;
    for (const ingredientName of IngredientNames) {
        const remaining = remainingDemand[ingredientName] ?? 0;
        if (remaining <= 0) {
            continue;
        }
        const covered = Math.min(remaining, ingredientCounts[ingredientName] ?? 0);
        ret += covered * ingredientValue[ingredientName];
    }
    return ret;
}

export function calculateDailyPlannerResult(
    items: PokemonBoxItem[],
    parameter: StrengthParameter,
    mealChoices: DailyPlannerMealChoice[] = getDefaultDailyPlannerMeals(),
    stock: DailyPlannerIngredientStock = {},
): DailyPlannerResult {
    const baseParameter: StrengthParameter = {
        ...parameter,
        helpBonusCount: 0,
    };
    const normalizedMeals = mealChoices.length >= 3 ? mealChoices.slice(0, 3) : [
        ...mealChoices,
        ...getDefaultDailyPlannerMeals().slice(mealChoices.length),
    ];
    const demand = calculateDemandFromMeals(normalizedMeals);
    const remainingDemand = calculateStockedDemand(demand, stock);

    const selectedItems: PokemonBoxItem[] = [];
    const usedIds = new Set<number>();
    let selectedHelpingBonusCount = 0;
    const currentRemaining: Partial<Record<IngredientName, number>> = {...remainingDemand};

    for (let i = 0; i < 5 && usedIds.size < items.length; i++) {
        let bestSummary: DailyPlannerPokemonSummary | null = null;
        let bestScore = -Infinity;
        for (const item of items) {
            if (usedIds.has(item.id)) {
                continue;
            }
            const summary = calculatePokemonDailySummary(
                item,
                baseParameter,
                selectedHelpingBonusCount,
            );
            const coverage = calculateCoverage(summary.ingredientCounts, currentRemaining);
            const score = summary.directEnergy + coverage;
            if (score > bestScore) {
                bestScore = score;
                bestSummary = {
                    ...summary,
                    ingredientCoverage: coverage,
                    score,
                    helpBonusCount: selectedHelpingBonusCount,
                };
            }
        }
        if (bestSummary === null) {
            break;
        }
        usedIds.add(bestSummary.item.id);
        selectedItems.push(bestSummary.item);
        subtractIngredientCounts(currentRemaining, bestSummary.ingredientCounts);
        if (bestSummary.hasHelpingBonus) {
            selectedHelpingBonusCount = Math.min(4, selectedHelpingBonusCount + 1);
        }
    }

    const finalSummaries: DailyPlannerPokemonSummary[] = selectedItems.map(item => {
        const helpBonusCount = Math.max(
            0,
            Math.min(4, selectedHelpingBonusCount - (item.iv.hasHelpingBonusInActiveSubSkills ? 1 : 0)),
        ) as 0|1|2|3|4;
        return calculatePokemonDailySummary(item, baseParameter, helpBonusCount);
    }).map(summary => ({
        ...summary,
        score: summary.directEnergy + summary.ingredientCoverage,
    }));

    const totalDirectEnergy = finalSummaries.reduce((sum, summary) => sum + summary.directEnergy, 0);
    const totalMealEnergy = normalizedMeals.reduce((sum, meal) =>
        sum + getRecipeFinalEnergy(meal.recipe, baseParameter) * 1.1,
    0);
    const totalExpectedEnergy = totalDirectEnergy + totalMealEnergy;
    const finalRemaining: Partial<Record<IngredientName, number>> = {...remainingDemand};
    for (const summary of finalSummaries) {
        subtractIngredientCounts(finalRemaining, summary.ingredientCounts);
    }

    return {
        mealChoices: normalizedMeals,
        demand,
        stock,
        remainingDemand: finalRemaining,
        selectedSummaries: finalSummaries,
        totalDirectEnergy,
        totalMealEnergy,
        totalExpectedEnergy,
        isDemandSatisfied: IngredientNames.every(name => (finalRemaining[name] ?? 0) <= 0),
    };
}
