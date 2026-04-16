import { IngredientName, IngredientNames } from '../data/pokemons';
import { PokemonBoxItem } from './PokemonBox';
import PokemonStrength, { StrengthParameter } from './PokemonStrength';
import { ingredientStrength as ingredientValue } from './PokemonRp';
import {
    calculateMinimumWorkDaysDetail,
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
    berryEnergy: number;
    mealEnergy: number;
    skillEnergy: number;
    totalEnergy: number;
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
    phases: DailyPlannerPhaseResult[];
    selectedSummaries: DailyPlannerPokemonSummary[];
    totalBerryEnergy: number;
    totalDirectEnergy: number;
    totalMealEnergy: number;
    totalSkillEnergy: number;
    totalExpectedEnergy: number;
    isDemandSatisfied: boolean;
};

export type DailyPlannerPhaseResult = {
    slot: 0 | 1 | 2 | 3;
    startHour: number;
    endHour: number;
    meal: PokedayRecipe | null;
    demand: Partial<Record<IngredientName, number>>;
    remainingDemand: Partial<Record<IngredientName, number>>;
    selectedSummaries: DailyPlannerPokemonSummary[];
    totalBerryEnergy: number;
    totalMealEnergy: number;
    totalSkillEnergy: number;
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

function isDirectEnergySkill(skillName: string): boolean {
    return skillName.startsWith('Charge Strength S') ||
        skillName.startsWith('Charge Strength M') ||
        skillName.startsWith('Berry Burst') ||
        skillName === 'Energy for Everyone S (Lunar Blessing)';
}

function getSkillName(item: PokemonBoxItem): string {
    return item.iv.pokemon.skill === 'Versatile' ? item.iv.versatileSkill : item.iv.pokemon.skill;
}

function calculatePokemonPeriodSummary(item: PokemonBoxItem,
    parameter: StrengthParameter,
    helpBonusCount: number,
    periodHours: number,
): DailyPlannerPokemonSummary {
    const dailyParameter = createPlannerParameter(parameter, helpBonusCount);
    dailyParameter.period = periodHours;
    const strength = new PokemonStrength(item.iv, dailyParameter);
    const result = strength.calculate();
    const skillName = getSkillName(item);
    const resourceSkillStrength = isResourceMainSkill(skillName) ?
        result.skillStrength + result.skillStrength2 : 0;
    const directEnergy = Math.max(0,
        result.totalStrength - result.ingStrength - resourceSkillStrength);
    // First pass: only count clearly direct energy skills here.
    const skillEnergy = isDirectEnergySkill(skillName) ?
        Math.max(0, result.skillStrength + result.skillStrength2) : 0;
    const berryEnergy = Math.max(0, directEnergy - skillEnergy);
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
        berryEnergy,
        mealEnergy: 0,
        skillEnergy,
        totalEnergy: berryEnergy + skillEnergy,
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

function calculatePhaseResult(
    items: PokemonBoxItem[],
    parameter: StrengthParameter,
    meal: PokedayRecipe | null,
    stock: DailyPlannerIngredientStock,
    periodHours: number,
    slot: 0 | 1 | 2 | 3,
    startHour: number,
    endHour: number,
): {
    phase: DailyPlannerPhaseResult;
    nextStock: DailyPlannerIngredientStock;
} {
    const baseParameter: StrengthParameter = {
        ...parameter,
        helpBonusCount: 0,
        period: periodHours,
    };
    const demand = meal === null ? {} : calculateDemandFromMeals([{slot: 0, recipe: meal}]);
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
            const summary = calculatePokemonPeriodSummary(
                item,
                baseParameter,
                selectedHelpingBonusCount,
                periodHours,
            );
            const coverage = calculateCoverage(summary.ingredientCounts, currentRemaining);
            const score = summary.berryEnergy + summary.skillEnergy + coverage;
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
        return calculatePokemonPeriodSummary(item, baseParameter, helpBonusCount, periodHours);
    });

    const mealRequirements = IngredientNames.map(name => remainingDemand[name] ?? 0);
    const mealRatesByPokemon = finalSummaries.map(summary =>
        IngredientNames.map(name => summary.ingredientCounts[name] ?? 0)
    );
    const mealWorkDays = meal === null ? null : calculateMinimumWorkDaysDetail(mealRequirements, mealRatesByPokemon);
    const phaseMealEnergy = meal === null ? 0 : getRecipeFinalEnergy(meal, parameter) * 1.1;
    const totalCoverage = finalSummaries.reduce((sum, summary) => sum + summary.ingredientCoverage, 0);
    const mealEnergyByPokemon = finalSummaries.map((summary, index) => {
        if (phaseMealEnergy <= 0) {
            return 0;
        }
        if (mealWorkDays !== null && mealWorkDays.totalDays > 0) {
            return phaseMealEnergy * (mealWorkDays.workDaysByPokemon[index] ?? 0) / mealWorkDays.totalDays;
        }
        if (totalCoverage > 0) {
            return phaseMealEnergy * summary.ingredientCoverage / totalCoverage;
        }
        return 0;
    });
    const adjustedSummaries = finalSummaries.map((summary, index) => {
        const mealEnergy = mealEnergyByPokemon[index] ?? 0;
        const totalEnergy = summary.berryEnergy + mealEnergy + summary.skillEnergy;
        return {
            ...summary,
            mealEnergy,
            totalEnergy,
            score: summary.berryEnergy + summary.skillEnergy + summary.ingredientCoverage,
        };
    });

    const totalBerryEnergy = adjustedSummaries.reduce((sum, summary) => sum + summary.berryEnergy, 0);
    const totalMealEnergy = adjustedSummaries.reduce((sum, summary) => sum + summary.mealEnergy, 0);
    const totalSkillEnergy = adjustedSummaries.reduce((sum, summary) => sum + summary.skillEnergy, 0);
    const totalExpectedEnergy = adjustedSummaries.reduce((sum, summary) => sum + summary.totalEnergy, 0);

    const nextStock: DailyPlannerIngredientStock = {...stock};
    for (const summary of adjustedSummaries) {
        for (const ingredientName of IngredientNames) {
            const value = summary.ingredientCounts[ingredientName] ?? 0;
            if (value <= 0) {
                continue;
            }
            nextStock[ingredientName] = (nextStock[ingredientName] ?? 0) + value;
        }
    }
    if (meal !== null) {
        for (const ingredient of meal.ingredients) {
            nextStock[ingredient.name] = Math.max(0, (nextStock[ingredient.name] ?? 0) - ingredient.count);
        }
    }

    return {
        phase: {
            slot,
            startHour,
            endHour,
            meal,
            demand,
            remainingDemand: currentRemaining,
            selectedSummaries: adjustedSummaries,
            totalBerryEnergy,
            totalMealEnergy,
            totalSkillEnergy,
            totalExpectedEnergy,
            isDemandSatisfied: IngredientNames.every(name => (currentRemaining[name] ?? 0) <= 0),
        },
        nextStock,
    };
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
    const phaseDefinitions: Array<{
        slot: 0 | 1 | 2 | 3;
        startHour: number;
        endHour: number;
        meal: PokedayRecipe | null;
    }> = [
        {slot: 0, startHour: 0, endHour: 6, meal: normalizedMeals[0].recipe},
        {slot: 1, startHour: 6, endHour: 12, meal: normalizedMeals[1].recipe},
        {slot: 2, startHour: 12, endHour: 18, meal: normalizedMeals[2].recipe},
        {slot: 3, startHour: 18, endHour: 24, meal: null},
    ];

    const phases: DailyPlannerPhaseResult[] = [];
    let currentStock = {...stock};
    for (const phaseDefinition of phaseDefinitions) {
        const phaseResult = calculatePhaseResult(
            items,
            baseParameter,
            phaseDefinition.meal,
            currentStock,
            phaseDefinition.endHour - phaseDefinition.startHour,
            phaseDefinition.slot,
            phaseDefinition.startHour,
            phaseDefinition.endHour,
        );
        phases.push(phaseResult.phase);
        currentStock = phaseResult.nextStock;
    }

    const summaryMap = new Map<number, DailyPlannerPokemonSummary>();
    for (const phase of phases) {
        for (const summary of phase.selectedSummaries) {
            const current = summaryMap.get(summary.item.id);
            if (current === undefined) {
                summaryMap.set(summary.item.id, {
                    ...summary,
                    helpBonusCount: summary.helpBonusCount,
                    hasHelpingBonus: summary.hasHelpingBonus,
                });
                continue;
            }
            current.directEnergy += summary.directEnergy;
            current.berryEnergy += summary.berryEnergy;
            current.mealEnergy += summary.mealEnergy;
            current.skillEnergy += summary.skillEnergy;
            current.totalEnergy += summary.totalEnergy;
            current.ingredientCoverage += summary.ingredientCoverage;
            current.score += summary.score;
            current.hasHelpingBonus = current.hasHelpingBonus || summary.hasHelpingBonus;
            current.helpBonusCount = Math.max(current.helpBonusCount, summary.helpBonusCount);
        }
    }
    const adjustedSummaries = [...summaryMap.values()].sort((a, b) => a.item.id - b.item.id);

    const totalBerryEnergy = phases.reduce((sum, phase) => sum + phase.totalBerryEnergy, 0);
    const totalMealEnergy = phases.reduce((sum, phase) => sum + phase.totalMealEnergy, 0);
    const totalSkillEnergy = phases.reduce((sum, phase) => sum + phase.totalSkillEnergy, 0);
    const totalDirectEnergy = totalBerryEnergy + totalSkillEnergy;
    const totalExpectedEnergy = phases.reduce((sum, phase) => sum + phase.totalExpectedEnergy, 0);
    const finalRemaining: Partial<Record<IngredientName, number>> = {...remainingDemand};
    for (const summary of adjustedSummaries) {
        subtractIngredientCounts(finalRemaining, summary.ingredientCounts);
    }

    return {
        mealChoices: normalizedMeals,
        demand,
        stock,
        remainingDemand: finalRemaining,
        phases,
        selectedSummaries: adjustedSummaries,
        totalBerryEnergy,
        totalDirectEnergy,
        totalMealEnergy,
        totalSkillEnergy,
        totalExpectedEnergy,
        isDemandSatisfied: IngredientNames.every(name => (finalRemaining[name] ?? 0) <= 0),
    };
}
