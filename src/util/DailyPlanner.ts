import { IngredientName, IngredientNames } from '../data/pokemons';
import { PokemonBoxItem } from './PokemonBox';
import PokemonStrength, { StrengthParameter } from './PokemonStrength';
import { ingredientStrength as ingredientValue } from './PokemonRp';
import {
    calculateMinimumWorkDaysDetail,
    getDailyIngredientDetailMapWithStrengthParameter,
    getRecipeFinalEnergy,
    getSkillIngredientPool,
    PokedayRecipe,
    PokedayRecipeCategory,
    pokedayRecipeGroups,
} from './Pokeday';
import { getEfficiencyByEnergy, NoTap } from './Energy';
import Energy from './Energy';
import { calculateHelpCountPerTap, HelpCountSimulation } from './HelpCount';

export type DailyPlannerIngredientStock = Partial<Record<IngredientName, number>>;

export type DailyPlannerMealChoice = {
    slot: 0 | 1 | 2;
    recipe: PokedayRecipe | null;
};

export type DailyPlannerPokemonSummary = {
    item: PokemonBoxItem;
    directEnergy: number;
    berryEnergy: number;
    berryCount: number;
    mealEnergy: number;
    skillEnergy: number;
    totalEnergy: number;
    ingredientCounts: Partial<Record<IngredientName, number>>;
    randomIngredientCounts: Partial<Record<IngredientName, number>>;
    selfEnergyRecovery: number;
    teamEnergyRecovery: number;
    cheerEnergyRecovery: number;
    skillTriggerCount: number;
    tastyChanceBonus: number;
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

export type DailyPlannerAllocationMember = {
    item: PokemonBoxItem;
    workHours: number;
    totalHours: number;
    berryEnergyPerHour: number;
    berryCountPerHour: number;
    ingredientCounts: Partial<Record<IngredientName, number>>;
    randomIngredientCounts: Partial<Record<IngredientName, number>>;
    berryCount: number;
    berryEnergy: number;
    skillEnergy: number;
    awakeSkillTriggerCount: number;
    asleepSkillTriggerCount: number;
    tastyChanceBonus: number;
    segments: DailyPlannerAllocationSegment[];
};

export type DailyPlannerAllocationSegment = {
    rowIndex: number;
    startHour: number;
    endHour: number;
    energyStart: number;
    energyEnd: number;
    skillTriggerCount: number;
    isNight: boolean;
    tastyChanceBonus: number;
    ingredientCounts: Partial<Record<IngredientName, number>>;
    randomIngredientCounts: Partial<Record<IngredientName, number>>;
    berryCount: number;
    berryEnergy: number;
};

export type DailyPlannerAllocationResult = {
    candidates: DailyPlannerAllocationMember[];
    demand: Partial<Record<IngredientName, number>>;
    stock: DailyPlannerIngredientStock;
    remainingDemand: Partial<Record<IngredientName, number>>;
    totalTeamHours: number;
    totalBerryCount: number;
    totalBerryEnergy: number;
    totalMealEnergy: number;
    totalSkillEnergy: number;
    isDemandSatisfied: boolean;
};

export const dailyPlannerMaxTeamSize = 5;
export const dailyPlannerMaxCandidateCount = 10;

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

export type DailyPlannerRecipeEfficiencyCandidate = {
    category: PokedayRecipeCategory;
    categoryTitle: string;
    recipe: PokedayRecipe;
    selectedSummaries: DailyPlannerPokemonSummary[];
    workDaysByPokemon: number[];
    totalWorkDays: number;
    mealEnergy: number;
    efficiency: number;
    efficiencyPerBagSlot: number;
    ingredientTotal: number;
};

export type DailyPlannerCarryoverCategoryPlan = {
    category: PokedayRecipeCategory;
    categoryTitle: string;
    recipe: PokedayRecipe;
    capacity: number;
    estimatedServings: number;
    efficiency: number;
    coverageRate: number;
};

export type DailyPlannerCarryoverIngredientPlan = {
    ingredientName: IngredientName;
    count: number;
};

export type DailyPlannerCarryoverOptimizationResult = {
    bestRecipes: DailyPlannerRecipeEfficiencyCandidate[];
    categoryPlans: DailyPlannerCarryoverCategoryPlan[];
    ingredientPlans: DailyPlannerCarryoverIngredientPlan[];
    capacity: number;
};

export const dailyPlannerRecipes: PokedayRecipe[] = pokedayRecipeGroups
    .flatMap(group => group.recipes);

export function getRecipeByName(name: string): PokedayRecipe | null {
    return dailyPlannerRecipes.find(recipe => recipe.name === name) ?? null;
}

export function getRecipeLabel(recipe: PokedayRecipe | null): string {
    if (recipe === null) {
        return 'なし';
    }
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

function isSelfEnergySkill(skillName: string): boolean {
    return skillName === 'Charge Energy S' ||
        skillName === 'Charge Energy S (Moonlight)';
}

function isTeamEnergySkill(skillName: string): boolean {
    return skillName === 'Energy for Everyone S' ||
        skillName === 'Energy for Everyone S (Lunar Blessing)' ||
        skillName === 'Energy for Everyone S (Berry Juice)';
}

function isCheerEnergySkill(skillName: string): boolean {
    return skillName === 'Energizing Cheer S' ||
        skillName === 'Energizing Cheer S (Nuzzle)' ||
        skillName === 'Energizing Cheer S (Heal Pulse)';
}

function isTastyChanceSkill(skillName: string): boolean {
    return skillName === 'Tasty Chance S';
}

function isBulkUpSkill(skillName: string): boolean {
    return skillName === 'Cooking Assist S (Bulk Up)';
}

function getSkillName(item: PokemonBoxItem): string {
    return item.iv.pokemon.skill === 'Versatile' ? item.iv.versatileSkill : item.iv.pokemon.skill;
}

function isRandomIngredientSkill(skillName: string): boolean {
    return skillName === 'Ingredient Magnet S' ||
        skillName === 'Ingredient Draw S' ||
        skillName === 'Ingredient Draw S (Hyper Cutter)';
}

function isPlusMinusSkill(skillName: string): boolean {
    return skillName === 'Ingredient Magnet S (Plus)' ||
        skillName === 'Cooking Power-Up S (Minus)';
}

function getEqualIngredientPool(item: PokemonBoxItem, skillName: string): IngredientName[] {
    return getSkillIngredientPool(item, skillName)
        .filter(name => !name.startsWith('unknown'));
}

function addIngredientCount(
    target: Partial<Record<IngredientName, number>>,
    ingredientName: IngredientName,
    count: number,
): void {
    if (count <= 0) {
        return;
    }
    target[ingredientName] = (target[ingredientName] ?? 0) + count;
}

type DailyPlannerTeamContext = {
    hasOtherPlusMinus: boolean;
    skillTriggerCountOverride?: number;
};

function calculatePokemonPeriodSummary(item: PokemonBoxItem,
    parameter: StrengthParameter,
    helpBonusCount: number,
    periodHours: number,
    teamContext: DailyPlannerTeamContext = {hasOtherPlusMinus: false},
): DailyPlannerPokemonSummary {
    const dailyParameter = createPlannerParameter(parameter, helpBonusCount);
    dailyParameter.period = periodHours;
    const strength = new PokemonStrength(item.iv, dailyParameter);
    const result = strength.calculate();
    const skillTriggerCount = teamContext.skillTriggerCountOverride ?? result.skillCount;
    const adjustedSkill = Math.abs(skillTriggerCount - result.skillCount) < 1e-9 ? result :
        strength.getSkillValueAndStrength(skillTriggerCount, dailyParameter, result.bonus);
    const skillValueRatio = result.skillCount > 0 ? skillTriggerCount / result.skillCount : 0;
    const skillName = getSkillName(item);
    const resourceSkillStrength = isResourceMainSkill(skillName) ?
        result.skillStrength + result.skillStrength2 : 0;
    const directEnergy = Math.max(0,
        result.totalStrength - result.ingStrength - resourceSkillStrength);
    const rawSkillEnergy = isDirectEnergySkill(skillName) ?
        Math.max(0, result.skillStrength + result.skillStrength2) : 0;
    // First pass: only count clearly direct energy skills here.
    const skillEnergy = isDirectEnergySkill(skillName) ?
        Math.max(0, adjustedSkill.skillStrength + adjustedSkill.skillStrength2) : 0;
    const berryEnergy = Math.max(0, directEnergy - rawSkillEnergy);
    const detailMap = getDailyIngredientDetailMapWithStrengthParameter(
        item, dailyParameter, helpBonusCount, periodHours);
    const ingredientCounts: Partial<Record<IngredientName, number>> = {};
    const randomIngredientCounts: Partial<Record<IngredientName, number>> = {};
    const selfEnergyRecovery = isSelfEnergySkill(skillName) ? adjustedSkill.skillValue : 0;
    const teamEnergyRecovery = isTeamEnergySkill(skillName) ? adjustedSkill.skillValue : 0;
    const cheerEnergyRecovery = isCheerEnergySkill(skillName) ? adjustedSkill.skillValue : 0;
    const tastyChanceBonus = isTastyChanceSkill(skillName) ? adjustedSkill.skillValue :
        isBulkUpSkill(skillName) ? adjustedSkill.skillValue2 : 0;
    let ingredientCoverage = 0;
    for (const ingredientName of IngredientNames) {
        const detail = detailMap[ingredientName];
        const total = detail === undefined ? 0 :
            Math.max(0, detail.total - detail.skill) + detail.skill * skillValueRatio;
        if (total > 0) {
            ingredientCounts[ingredientName] = total;
        }
    }
    if (isRandomIngredientSkill(skillName)) {
        if (result.skillCount > 0) {
            for (const ingredientName of IngredientNames) {
                const randomTotal = (detailMap[ingredientName]?.skill ?? 0) * skillValueRatio;
                if (randomTotal > 0) {
                    randomIngredientCounts[ingredientName] = randomTotal;
                }
            }
        } else {
            const pool = getEqualIngredientPool(item, skillName);
            const countPerIngredient = pool.length === 0 ? 0 : adjustedSkill.skillValue / pool.length;
            for (const ingredientName of pool) {
                addIngredientCount(ingredientCounts, ingredientName, countPerIngredient);
                addIngredientCount(randomIngredientCounts, ingredientName, countPerIngredient);
            }
        }
    }
    else if (skillName === 'Ingredient Magnet S (Plus)') {
        if (teamContext.hasOtherPlusMinus) {
            const pool = getEqualIngredientPool(item, skillName);
            const countPerIngredient = pool.length === 0 ? 0 : adjustedSkill.skillValue / pool.length;
            for (const ingredientName of pool) {
                addIngredientCount(ingredientCounts, ingredientName, countPerIngredient);
                addIngredientCount(randomIngredientCounts, ingredientName, countPerIngredient);
            }
        }
    }
    for (const ingredientName of IngredientNames) {
        const total = ingredientCounts[ingredientName] ?? 0;
        if (total > 0) {
            ingredientCoverage += total * ingredientValue[ingredientName];
        }
    }
    return {
        item,
        directEnergy,
        berryEnergy,
        berryCount: result.berryCount,
        mealEnergy: 0,
        skillEnergy,
        totalEnergy: berryEnergy + skillEnergy,
        ingredientCounts,
        randomIngredientCounts,
        selfEnergyRecovery,
        teamEnergyRecovery,
        cheerEnergyRecovery,
        skillTriggerCount,
        tastyChanceBonus,
        ingredientCoverage,
        score: directEnergy + ingredientCoverage,
        helpBonusCount,
        hasHelpingBonus: item.iv.hasHelpingBonusInActiveSubSkills,
    };
}

export function calculatePokemonDailySummary(item: PokemonBoxItem,
    parameter: StrengthParameter,
    helpBonusCount: number = 0,
    teamContext: { hasOtherPlusMinus: boolean } = {hasOtherPlusMinus: false},
): DailyPlannerPokemonSummary {
    return calculatePokemonPeriodSummary(item, parameter, helpBonusCount, 24, teamContext);
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
        if (meal.recipe === null) {
            continue;
        }
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

function calculateRecipeEfficiencyCandidate(
    items: PokemonBoxItem[],
    parameter: StrengthParameter,
    recipe: PokedayRecipe,
    categoryTitle: string,
): DailyPlannerRecipeEfficiencyCandidate | null {
    const demand = calculateDemandFromMeals([{slot: 0, recipe}]);
    const selectedItems: PokemonBoxItem[] = [];
    const usedIds = new Set<number>();
    let selectedHelpingBonusCount = 0;
    const currentRemaining: Partial<Record<IngredientName, number>> = {...demand};

    for (let i = 0; i < dailyPlannerMaxTeamSize && usedIds.size < items.length; i++) {
        let bestSummary: DailyPlannerPokemonSummary | null = null;
        let bestScore = -Infinity;
        for (const item of items) {
            if (usedIds.has(item.id)) {
                continue;
            }
            const summary = calculatePokemonDailySummary(item, parameter, selectedHelpingBonusCount);
            const coverage = calculateCoverage(summary.ingredientCounts, currentRemaining);
            const score = coverage * 1000 + summary.berryEnergy + summary.skillEnergy;
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

    const finalSummaries = selectedItems.map(item => {
        const helpBonusCount = Math.max(
            0,
            Math.min(4, selectedHelpingBonusCount - (item.iv.hasHelpingBonusInActiveSubSkills ? 1 : 0)),
        );
        return calculatePokemonDailySummary(item, parameter, helpBonusCount);
    });
    const requirements = IngredientNames.map(name => demand[name] ?? 0);
    const ratesByPokemon = finalSummaries.map(summary =>
        IngredientNames.map(name => summary.ingredientCounts[name] ?? 0)
    );
    const workDays = calculateMinimumWorkDaysDetail(requirements, ratesByPokemon);
    if (workDays === null || workDays.totalDays <= 0) {
        return null;
    }

    const mealEnergy = getRecipeFinalEnergy(recipe, parameter) * 1.1;
    const ingredientTotal = recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.count, 0);
    const efficiency = mealEnergy / workDays.totalDays;
    return {
        category: recipe.category,
        categoryTitle,
        recipe,
        selectedSummaries: finalSummaries,
        workDaysByPokemon: workDays.workDaysByPokemon,
        totalWorkDays: workDays.totalDays,
        mealEnergy,
        efficiency,
        efficiencyPerBagSlot: ingredientTotal > 0 ? efficiency / ingredientTotal : 0,
        ingredientTotal,
    };
}

const carryoverMealCountPerWeek = 21;

function getCarryoverRequirement(recipePlan: DailyPlannerRecipeEfficiencyCandidate,
    ingredientName: IngredientName): number {
    const ingredient = recipePlan.recipe.ingredients.find(x => x.name === ingredientName);
    return ingredient === undefined ? 0 : ingredient.count * carryoverMealCountPerWeek;
}

function calculateCarryoverCoverageScore(
    recipePlan: DailyPlannerRecipeEfficiencyCandidate,
    carryoverCounts: Partial<Record<IngredientName, number>>,
): number {
    if (recipePlan.ingredientTotal <= 0) {
        return 0;
    }
    return recipePlan.recipe.ingredients.reduce((sum, ingredient) => {
        const requirement = ingredient.count * carryoverMealCountPerWeek;
        const carried = Math.min(requirement, carryoverCounts[ingredient.name] ?? 0);
        return sum + carried / recipePlan.ingredientTotal;
    }, 0);
}

function chooseCarryoverIngredient(
    recipePlans: DailyPlannerRecipeEfficiencyCandidate[],
    candidateIngredients: IngredientName[],
    carryoverCounts: Partial<Record<IngredientName, number>>,
): IngredientName | null {
    const currentScores = recipePlans.map(recipePlan =>
        calculateCarryoverCoverageScore(recipePlan, carryoverCounts));
    const currentMinScore = Math.min(...currentScores);
    let bestIngredient: IngredientName | null = null;
    let bestMinImprovement = -Infinity;
    let bestTotalImprovement = -Infinity;
    let bestSharedCount = -Infinity;

    for (const ingredientName of candidateIngredients) {
        const currentCount = carryoverCounts[ingredientName] ?? 0;
        if (recipePlans.every(recipePlan => currentCount >= getCarryoverRequirement(recipePlan, ingredientName))) {
            continue;
        }
        carryoverCounts[ingredientName] = currentCount + 1;
        const nextScores = recipePlans.map(recipePlan =>
            calculateCarryoverCoverageScore(recipePlan, carryoverCounts));
        carryoverCounts[ingredientName] = currentCount;

        const nextMinScore = Math.min(...nextScores);
        const minImprovement = nextMinScore - currentMinScore;
        const totalImprovement = nextScores.reduce((sum, score, index) =>
            sum + (score - currentScores[index]) * recipePlans[index].efficiency, 0);
        const sharedCount = recipePlans.filter(recipePlan =>
            getCarryoverRequirement(recipePlan, ingredientName) > currentCount).length;

        if (minImprovement > bestMinImprovement + 1e-12 ||
            (Math.abs(minImprovement - bestMinImprovement) <= 1e-12 &&
                totalImprovement > bestTotalImprovement + 1e-12) ||
            (Math.abs(minImprovement - bestMinImprovement) <= 1e-12 &&
                Math.abs(totalImprovement - bestTotalImprovement) <= 1e-12 &&
                sharedCount > bestSharedCount)) {
            bestIngredient = ingredientName;
            bestMinImprovement = minImprovement;
            bestTotalImprovement = totalImprovement;
            bestSharedCount = sharedCount;
        }
    }

    return bestIngredient;
}

export function calculateDailyPlannerCarryoverOptimization(
    items: PokemonBoxItem[],
    parameter: StrengthParameter,
    capacity: number = 800,
): DailyPlannerCarryoverOptimizationResult {
    const bestRecipes = pokedayRecipeGroups.flatMap(group => {
        const candidates = group.recipes
            .map(recipe => calculateRecipeEfficiencyCandidate(items, parameter, recipe, group.title))
            .filter((candidate): candidate is DailyPlannerRecipeEfficiencyCandidate => candidate !== null)
            .sort((a, b) => b.efficiency - a.efficiency);
        return candidates.length === 0 ? [] : [candidates[0]];
    });
    const safeCapacity = Math.max(0, Math.floor(capacity));
    const carryoverCounts: Partial<Record<IngredientName, number>> = {};
    const candidateIngredients = IngredientNames.filter(ingredientName =>
        bestRecipes.some(recipePlan => getCarryoverRequirement(recipePlan, ingredientName) > 0));

    for (let count = 0; count < safeCapacity; count++) {
        const ingredientName = chooseCarryoverIngredient(bestRecipes, candidateIngredients, carryoverCounts);
        if (ingredientName === null) {
            break;
        }
        addIngredientCount(carryoverCounts, ingredientName, 1);
    }

    const categoryPlans: DailyPlannerCarryoverCategoryPlan[] = bestRecipes.map(recipePlan => {
        const usableCapacity = recipePlan.recipe.ingredients.reduce((sum, ingredient) => {
            const requirement = ingredient.count * carryoverMealCountPerWeek;
            return sum + Math.min(requirement, carryoverCounts[ingredient.name] ?? 0);
        }, 0);
        const coverageScore = calculateCarryoverCoverageScore(recipePlan, carryoverCounts);
        return {
            category: recipePlan.category,
            categoryTitle: recipePlan.categoryTitle,
            recipe: recipePlan.recipe,
            capacity: Math.floor(usableCapacity),
            estimatedServings: coverageScore,
            efficiency: recipePlan.efficiency,
            coverageRate: Math.min(1, coverageScore / carryoverMealCountPerWeek),
        };
    });

    const ingredientPlans = IngredientNames
        .map(ingredientName => ({
            ingredientName,
            count: Math.floor(carryoverCounts[ingredientName] ?? 0),
        }))
        .filter(plan => plan.count > 0)
        .sort((a, b) => b.count - a.count);

    return {
        bestRecipes,
        categoryPlans,
        ingredientPlans,
        capacity: safeCapacity,
    };
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
            current.berryCount += summary.berryCount;
            current.mealEnergy += summary.mealEnergy;
            current.skillEnergy += summary.skillEnergy;
            current.totalEnergy += summary.totalEnergy;
            current.ingredientCoverage += summary.ingredientCoverage;
            current.score += summary.score;
            current.hasHelpingBonus = current.hasHelpingBonus || summary.hasHelpingBonus;
            current.helpBonusCount = Math.max(current.helpBonusCount, summary.helpBonusCount);
            addScaledIngredientCounts(current.randomIngredientCounts, summary.randomIngredientCounts, 1);
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

const dayHours = 24;
const teamPlanSlotMinutes = 10;
const teamPlanSlotHours = teamPlanSlotMinutes / 60;
const teamPlanSlotsPerDay = dayHours / teamPlanSlotHours;
const sleepStartHourFromWakeup = 15.5; // 7:00 -> 22:30
const sleepStartSlot = Math.round(sleepStartHourFromWakeup / teamPlanSlotHours);
const energyDrainPerSlot = 1;
const dailyPlannerMaxEnergy = 150;

function isNightPeriod(startHour: number, endHour: number): boolean {
    const middle = (startHour + endHour) / 2;
    return middle >= sleepStartHourFromWakeup;
}

function createTimeScopedParameter(
    parameter: StrengthParameter,
    startHour: number,
    endHour: number,
): StrengthParameter {
    const tapFrequency = isNightPeriod(startHour, endHour) ?
        parameter.tapFrequencyAsleep :
        parameter.tapFrequencyAwake;
    return {
        ...parameter,
        tapFrequencyAwake: tapFrequency,
        tapFrequencyAsleep: tapFrequency,
    };
}

function calculateNightNoTapSkillTriggerCount(
    item: PokemonBoxItem,
    parameter: StrengthParameter,
    helpBonusCount: number,
    periodHours: number,
): number {
    const dailyParameter = createPlannerParameter(parameter, helpBonusCount);
    dailyParameter.period = dayHours;
    dailyParameter.sleepScore = 100;
    const strength = new PokemonStrength(item.iv, dailyParameter);
    const result = strength.calculate();
    const energy = new Energy(strength.pokemonIv).calculate(dailyParameter, result.bonus);
    const sleepSeconds = periodHours * 60 * 60;
    const helpCounts = calculateHelpCountPerTap(
        energy.efficiencies,
        sleepStartHourFromWakeup * 60 * 60,
        result.baseFreq,
        sleepSeconds,
        sleepSeconds,
    );
    const simulation = new HelpCountSimulation(
        strength.pokemonIv,
        dailyParameter.isGoodCampTicketSet,
        result.overallSkillRate,
        result.inventoryBonus,
    );
    const skillCount = helpCounts.reduce((sum, helpCount) => {
        const simulationResult = simulation.compute(helpCount);
        return sum + simulationResult.skillOnce + simulationResult.skillTwice * 2;
    }, 0);
    return Math.min(2, Math.floor(skillCount));
}

function addScaledIngredientCounts(
    target: Partial<Record<IngredientName, number>>,
    source: Partial<Record<IngredientName, number>>,
    rate: number,
): void {
    for (const ingredientName of IngredientNames) {
        const value = source[ingredientName] ?? 0;
        if (value > 0) {
            target[ingredientName] = (target[ingredientName] ?? 0) + value * rate;
        }
    }
}

function getEnergyOutputScale(energy: number): number {
    return getEfficiencyByEnergy(Math.max(0, Math.min(100, energy))) / getEfficiencyByEnergy(100);
}

function scaleSummaryByEnergy(
    summary: DailyPlannerPokemonSummary,
    energy: number,
): DailyPlannerPokemonSummary {
    const scale = getEnergyOutputScale(energy);
    const ingredientCounts: Partial<Record<IngredientName, number>> = {};
    const randomIngredientCounts: Partial<Record<IngredientName, number>> = {};
    addScaledIngredientCounts(ingredientCounts, summary.ingredientCounts, scale);
    addScaledIngredientCounts(randomIngredientCounts, summary.randomIngredientCounts, scale);
    return {
        ...summary,
        directEnergy: summary.directEnergy * scale,
        berryEnergy: summary.berryEnergy * scale,
        berryCount: summary.berryCount * scale,
        mealEnergy: summary.mealEnergy * scale,
        skillEnergy: summary.skillEnergy * scale,
        totalEnergy: summary.totalEnergy * scale,
        ingredientCounts,
        randomIngredientCounts,
        selfEnergyRecovery: summary.selfEnergyRecovery * scale,
        teamEnergyRecovery: summary.teamEnergyRecovery * scale,
        cheerEnergyRecovery: summary.cheerEnergyRecovery * scale,
        skillTriggerCount: summary.skillTriggerCount * scale,
        tastyChanceBonus: summary.tastyChanceBonus * scale,
        ingredientCoverage: summary.ingredientCoverage * scale,
        score: summary.score * scale,
    };
}

function createAllocationMemberFromItem(item: PokemonBoxItem): DailyPlannerAllocationMember {
    return {
        item,
        workHours: 0,
        totalHours: 0,
        berryEnergyPerHour: 0,
        berryCountPerHour: 0,
        ingredientCounts: {},
        randomIngredientCounts: {},
        berryCount: 0,
        berryEnergy: 0,
        skillEnergy: 0,
        awakeSkillTriggerCount: 0,
        asleepSkillTriggerCount: 0,
        tastyChanceBonus: 0,
        segments: [],
    };
}

type AllocationSegment = {
    memberIndex: number;
    rowIndex: number;
    startHour: number;
    endHour: number;
};

function createEmptyLikeMember(member: DailyPlannerAllocationMember): DailyPlannerAllocationMember {
    return {
        ...member,
        workHours: 0,
        totalHours: 0,
        berryCount: 0,
        berryEnergy: 0,
        skillEnergy: 0,
        awakeSkillTriggerCount: 0,
        asleepSkillTriggerCount: 0,
        tastyChanceBonus: 0,
        ingredientCounts: {},
        randomIngredientCounts: {},
        segments: [],
    };
}

function mergeAllocationSegments(
    segments: DailyPlannerAllocationSegment[],
): DailyPlannerAllocationSegment[] {
    const sorted = [...segments].sort((a, b) =>
        a.rowIndex === b.rowIndex ? a.startHour - b.startHour : a.rowIndex - b.rowIndex);
    const ret: DailyPlannerAllocationSegment[] = [];
    for (const segment of sorted) {
        const last = ret[ret.length - 1];
        if (last !== undefined &&
            last.rowIndex === segment.rowIndex &&
            last.isNight === segment.isNight &&
            Math.abs(last.endHour - segment.startHour) < 1e-6
        ) {
            last.endHour = segment.endHour;
            last.energyEnd = segment.energyEnd;
            last.skillTriggerCount += segment.skillTriggerCount;
            last.tastyChanceBonus += segment.tastyChanceBonus;
            addScaledIngredientCounts(last.ingredientCounts, segment.ingredientCounts, 1);
            addScaledIngredientCounts(last.randomIngredientCounts, segment.randomIngredientCounts, 1);
            last.berryCount += segment.berryCount;
            last.berryEnergy += segment.berryEnergy;
            continue;
        }
        ret.push({
            ...segment,
            ingredientCounts: {...segment.ingredientCounts},
            randomIngredientCounts: {...segment.randomIngredientCounts},
        });
    }
    return ret;
}

function mergeMemberSegments(member: DailyPlannerAllocationMember): DailyPlannerAllocationMember {
    return {
        ...member,
        segments: mergeAllocationSegments(member.segments),
    };
}

function recalculateAllocationSegments(
    segments: AllocationSegment[],
    members: DailyPlannerAllocationMember[],
    parameter: StrengthParameter,
    demand: Partial<Record<IngredientName, number>>,
    stock: DailyPlannerIngredientStock,
    initialEnergyByMember: number[] = members.map(() => 100),
): {
    members: DailyPlannerAllocationMember[];
    remainingDemand: Partial<Record<IngredientName, number>>;
} {
    const nightIsFixed = parameter.tapFrequencyAsleep === NoTap;
    const slotBreakpoints = Array.from({length: teamPlanSlotsPerDay + 1}, (_, slot) => slot * teamPlanSlotHours)
        .filter(hour => !nightIsFixed || hour <= sleepStartHourFromWakeup + 1e-9 || hour >= dayHours - 1e-9);
    const breakpoints = [...new Set([
        0,
        dayHours,
        sleepStartHourFromWakeup,
        ...slotBreakpoints,
        ...segments.flatMap(segment => [segment.startHour, segment.endHour]),
    ])].sort((a, b) => a - b);
    const nextMembers = members.map(createEmptyLikeMember);
    const remainingDemand = calculateStockedDemand(demand, stock);
    const energyByMember = members.map((_, index) =>
        Math.max(0, Math.min(dailyPlannerMaxEnergy, initialEnergyByMember[index] ?? 100)));

    for (let i = 0; i < breakpoints.length - 1; i++) {
        const start = breakpoints[i];
        const end = breakpoints[i + 1];
        const periodHours = end - start;
        if (periodHours <= 1e-9) {
            continue;
        }
        const activeSegments = segments.filter(segment =>
            segment.startHour < end - 1e-9 && segment.endHour > start + 1e-9);
        const activeMemberIndices = [...new Set(activeSegments.map(segment => segment.memberIndex))];
        const activeItems = activeMemberIndices.map(index => members[index].item);
        const plusMinusIds = new Set(activeItems
            .filter(item => isPlusMinusSkill(getSkillName(item)))
            .map(item => item.id));
        const helpingBonusCount = activeItems
            .filter(item => item.iv.hasHelpingBonusInActiveSubSkills)
            .length;
        const intervalEntries: Array<{
            segment: AllocationSegment;
            overlapHours: number;
            energyStart: number;
            rawSummary: DailyPlannerPokemonSummary;
        }> = [];
        for (const segment of activeSegments) {
            const member = members[segment.memberIndex];
            const overlapHours = Math.min(end, segment.endHour) - Math.max(start, segment.startHour);
            if (overlapHours <= 1e-9) {
                continue;
            }
            const memberHelpBonusCount = Math.max(0, Math.min(
                4,
                helpingBonusCount - (member.item.iv.hasHelpingBonusInActiveSubSkills ? 1 : 0),
            ));
            const skillTriggerCountOverride = parameter.tapFrequencyAsleep === NoTap && isNightPeriod(start, end) ?
                calculateNightNoTapSkillTriggerCount(member.item, parameter, memberHelpBonusCount, overlapHours) :
                undefined;
            const rawSummary = calculatePokemonPeriodSummary(
                member.item,
                createTimeScopedParameter(parameter, start, end),
                memberHelpBonusCount,
                overlapHours,
                {
                    hasOtherPlusMinus: plusMinusIds.size > (plusMinusIds.has(member.item.id) ? 1 : 0),
                    skillTriggerCountOverride,
                },
            );
            const energyStart = energyByMember[segment.memberIndex] ?? 100;
            intervalEntries.push({segment, overlapHours, energyStart, rawSummary});
        }

        let summariesForEnergy: DailyPlannerPokemonSummary[] = [];
        let nextEnergyByMember = energyByMember;
        let effectiveEnergyByMember = energyByMember;
        for (let iteration = 0; iteration < 3; iteration++) {
            summariesForEnergy = [];
            for (const entry of intervalEntries) {
                summariesForEnergy[entry.segment.memberIndex] = scaleSummaryByEnergy(
                    entry.rawSummary,
                    effectiveEnergyByMember[entry.segment.memberIndex] ?? entry.energyStart,
                );
            }
            nextEnergyByMember = calculateScheduledTeamEnergy(
                energyByMember,
                activeMemberIndices,
                summariesForEnergy,
                Math.max(1, Math.round(periodHours / teamPlanSlotHours)),
            );
            if (iteration >= 2) {
                break;
            }
            effectiveEnergyByMember = energyByMember.map((energy, memberIndex) =>
                activeMemberIndices.includes(memberIndex) ?
                    Math.max(0, Math.min(dailyPlannerMaxEnergy, (energy + (nextEnergyByMember[memberIndex] ?? energy)) / 2)) :
                    energy);
        }

        for (const entry of intervalEntries) {
            const segment = entry.segment;
            const summary = summariesForEnergy[segment.memberIndex];
            if (summary === undefined) {
                continue;
            }
            summariesForEnergy[segment.memberIndex] = summary;
            const nextMember = nextMembers[segment.memberIndex];
            nextMember.workHours += entry.overlapHours;
            nextMember.totalHours += entry.overlapHours;
            nextMember.berryCount += summary.berryCount;
            nextMember.berryEnergy += summary.berryEnergy;
            nextMember.skillEnergy += summary.skillEnergy;
            nextMember.tastyChanceBonus += summary.tastyChanceBonus;
            if (isNightPeriod(start, end)) {
                nextMember.asleepSkillTriggerCount += summary.skillTriggerCount;
            } else {
                nextMember.awakeSkillTriggerCount += summary.skillTriggerCount;
            }
            addScaledIngredientCounts(nextMember.ingredientCounts, summary.ingredientCounts, 1);
            addScaledIngredientCounts(nextMember.randomIngredientCounts, summary.randomIngredientCounts, 1);
            subtractIngredientCounts(remainingDemand, summary.ingredientCounts);
            nextMember.segments.push({
                rowIndex: segment.rowIndex,
                startHour: Math.max(start, segment.startHour),
                endHour: Math.min(end, segment.endHour),
                energyStart: entry.energyStart,
                energyEnd: nextEnergyByMember[segment.memberIndex] ?? entry.energyStart,
                skillTriggerCount: summary.skillTriggerCount,
                isNight: isNightPeriod(start, end),
                tastyChanceBonus: summary.tastyChanceBonus,
                ingredientCounts: summary.ingredientCounts,
                randomIngredientCounts: summary.randomIngredientCounts,
                berryCount: summary.berryCount,
                berryEnergy: summary.berryEnergy,
            });
        }
        for (const memberIndex of activeMemberIndices) {
            energyByMember[memberIndex] = nextEnergyByMember[memberIndex] ?? energyByMember[memberIndex];
        }
    }

    return {members: nextMembers.map(mergeMemberSegments), remainingDemand};
}

function calculateAllocationScore(
    summary: DailyPlannerPokemonSummary,
    remainingDemand: Partial<Record<IngredientName, number>>,
): number {
    const coverage = calculateCoverage(summary.ingredientCounts, remainingDemand);
    return coverage * 1000 + summary.berryEnergy + summary.skillEnergy;
}

function chooseBestCandidateIndex(
    candidates: PokemonBoxItem[],
    summaries: DailyPlannerPokemonSummary[],
    remainingDemand: Partial<Record<IngredientName, number>>,
    activeMemberIndices: Set<number>,
    allocatedSlotsByMember: number[],
    energyByMember: number[],
    rowAffinityByMember: Array<number | null>,
    rowIndex: number,
    slotCount: number,
    preferredIndex: number | null = null,
): number {
    let bestIndex = -1;
    let bestScore = -Infinity;
    let preferredScore = -Infinity;
    for (let index = 0; index < candidates.length; index++) {
        if (activeMemberIndices.has(index)) {
            continue;
        }
        if ((allocatedSlotsByMember[index] ?? 0) + slotCount > teamPlanSlotsPerDay) {
            continue;
        }
        const summary = summaries[index];
        if (summary === undefined) {
            continue;
        }
        const energy = Math.max(1, energyByMember[index] ?? 100);
        const affinity = rowAffinityByMember[index];
        const rowAffinityScore =
            affinity === rowIndex ? 1.08 :
                affinity === null ? 1 :
                    0.94;
        const score = calculateAllocationScore(summary, remainingDemand) *
            Math.max(0.2, energy / 100) *
            rowAffinityScore;
        if (index === preferredIndex) {
            preferredScore = score;
        }
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }
    if (preferredIndex !== null && preferredScore > -Infinity && preferredScore >= bestScore * 0.92) {
        return preferredIndex;
    }
    return bestIndex;
}

function addScheduledIngredientCounts(
    remainingDemand: Partial<Record<IngredientName, number>>,
    summary: DailyPlannerPokemonSummary,
): void {
    subtractIngredientCounts(remainingDemand, summary.ingredientCounts);
}

function calculateScheduledTeamEnergy(
    energyByMember: number[],
    memberIndices: number[],
    summaries: DailyPlannerPokemonSummary[],
    slotCount: number,
): number[] {
    const ret = [...energyByMember];
    const activeSet = new Set(memberIndices);
    const teamRecovery = memberIndices.reduce((sum, memberIndex) =>
        sum + (summaries[memberIndex]?.teamEnergyRecovery ?? 0), 0);
    for (const memberIndex of memberIndices) {
        const currentEnergy = energyByMember[memberIndex] ?? 100;
        const selfRecovery = summaries[memberIndex]?.selfEnergyRecovery ?? 0;
        let cheerRecovery = 0;
        for (const healerIndex of memberIndices) {
            if (healerIndex === memberIndex) {
                continue;
            }
            const targetCount = Math.max(1, activeSet.size - 1);
            cheerRecovery += (summaries[healerIndex]?.cheerEnergyRecovery ?? 0) / targetCount;
        }
        ret[memberIndex] = Math.min(
            dailyPlannerMaxEnergy,
            Math.max(
                0,
                currentEnergy - energyDrainPerSlot * slotCount +
                    selfRecovery + teamRecovery + cheerRecovery,
            ),
        );
    }
    return ret;
}

function applyScheduledTeamEnergy(
    energyByMember: number[],
    memberIndices: number[],
    summaries: DailyPlannerPokemonSummary[],
    slotCount: number,
): void {
    const nextEnergyByMember = calculateScheduledTeamEnergy(energyByMember, memberIndices, summaries, slotCount);
    for (const memberIndex of memberIndices) {
        energyByMember[memberIndex] = nextEnergyByMember[memberIndex] ?? energyByMember[memberIndex];
    }
}

function calculateWakeEnergyAfterPreviousNightSkills(
    candidates: PokemonBoxItem[],
    parameter: StrengthParameter,
    memberIndices: number[],
): number[] {
    const ret = candidates.map(() => 100);
    if (memberIndices.length === 0) {
        return ret;
    }
    const activeItems = memberIndices.map(index => candidates[index]);
    const helpingBonusCount = activeItems
        .filter(item => item.iv.hasHelpingBonusInActiveSubSkills)
        .length;
    const plusMinusIds = new Set(activeItems
        .filter(item => isPlusMinusSkill(getSkillName(item)))
        .map(item => item.id));
    const summaries: DailyPlannerPokemonSummary[] = [];
    for (const memberIndex of memberIndices) {
        const item = candidates[memberIndex];
        const helpBonusCount = Math.max(0, Math.min(
            4,
            helpingBonusCount - (item.iv.hasHelpingBonusInActiveSubSkills ? 1 : 0),
        ));
        const skillTriggerCountOverride = calculateNightNoTapSkillTriggerCount(
            item,
            parameter,
            helpBonusCount,
            dayHours - sleepStartHourFromWakeup,
        );
        summaries[memberIndex] = calculatePokemonPeriodSummary(
            item,
            createTimeScopedParameter(parameter, sleepStartHourFromWakeup, dayHours),
            helpBonusCount,
            dayHours - sleepStartHourFromWakeup,
            {
                hasOtherPlusMinus: plusMinusIds.size > (plusMinusIds.has(item.id) ? 1 : 0),
                skillTriggerCountOverride,
            },
        );
    }
    const activeSet = new Set(memberIndices);
    const teamRecovery = memberIndices.reduce((sum, memberIndex) =>
        sum + (summaries[memberIndex]?.teamEnergyRecovery ?? 0), 0);
    for (const memberIndex of memberIndices) {
        const selfRecovery = summaries[memberIndex]?.selfEnergyRecovery ?? 0;
        let cheerRecovery = 0;
        for (const healerIndex of memberIndices) {
            if (healerIndex === memberIndex) {
                continue;
            }
            const targetCount = Math.max(1, activeSet.size - 1);
            cheerRecovery += (summaries[healerIndex]?.cheerEnergyRecovery ?? 0) / targetCount;
        }
        ret[memberIndex] = Math.min(dailyPlannerMaxEnergy, 100 + selfRecovery + teamRecovery + cheerRecovery);
    }
    return ret;
}

function calculateExpectedMealEnergy(
    mealChoices: DailyPlannerMealChoice[],
    parameter: StrengthParameter,
    segments: DailyPlannerAllocationSegment[],
): number {
    const mealHours = [0, 5, 11]; // 7:00, 12:00, 18:00
    let rateStates = [{rate: 0.1, probability: 1}];
    let totalEnergy = 0;
    for (const [index, meal] of mealChoices.entries()) {
        const startHour = index === 0 ? -1e-9 : mealHours[index - 1];
        const mealHour = mealHours[index] ?? dayHours;
        const tastyChanceBonus = segments.reduce((sum, segment) => {
            if (segment.tastyChanceBonus <= 0) {
                return sum;
            }
            const triggerCount = Math.floor(segment.skillTriggerCount);
            if (triggerCount <= 0) {
                return sum;
            }
            const triggerBonus = segment.tastyChanceBonus / triggerCount;
            for (let i = 0; i < triggerCount; i++) {
                const triggerHour = segment.startHour +
                    (i + 1) / (triggerCount + 1) * (segment.endHour - segment.startHour);
                if (triggerHour > startHour + 1e-9 && triggerHour <= mealHour + 1e-9) {
                    sum += triggerBonus;
                }
            }
            return sum;
        }, 0);
        if (meal.recipe === null) {
            rateStates = rateStates.map(state => ({
                ...state,
                rate: Math.min(0.8, state.rate + tastyChanceBonus / 100),
            }));
            continue;
        }
        const recipeEnergy = getRecipeFinalEnergy(meal.recipe, parameter);
        const nextStates: Array<{ rate: number; probability: number }> = [];
        for (const state of rateStates) {
            const rate = Math.min(0.8, state.rate + tastyChanceBonus / 100);
            totalEnergy += state.probability * recipeEnergy * (1 + rate);
            nextStates.push({rate: 0.1, probability: state.probability * rate});
            nextStates.push({rate, probability: state.probability * (1 - rate)});
        }
        const mergedStates = new Map<number, number>();
        for (const state of nextStates) {
            const key = Math.round(state.rate * 1000000) / 1000000;
            mergedStates.set(key, (mergedStates.get(key) ?? 0) + state.probability);
        }
        rateStates = [...mergedStates].map(([rate, probability]) => ({rate, probability}));
    }
    return totalEnergy;
}

function createSegmentsFromSchedule(schedule: Array<Array<number | null>>): AllocationSegment[] {
    const segments: AllocationSegment[] = [];
    schedule.forEach((row, rowIndex) => {
        let currentMemberIndex: number | null = null;
        let currentStartSlot = 0;
        for (let slot = 0; slot <= teamPlanSlotsPerDay; slot++) {
            const memberIndex = slot < teamPlanSlotsPerDay ? row[slot] : null;
            if (memberIndex === currentMemberIndex) {
                continue;
            }
            if (currentMemberIndex !== null) {
                segments.push({
                    memberIndex: currentMemberIndex,
                    rowIndex,
                    startHour: currentStartSlot * teamPlanSlotHours,
                    endHour: slot * teamPlanSlotHours,
                });
            }
            currentMemberIndex = memberIndex;
            currentStartSlot = slot;
        }
    });
    return segments;
}

function compactScheduleByMemberTotals(
    schedule: Array<Array<number | null>>,
    memberCount: number,
    rowAffinityByMember: Array<number | null>,
): Array<Array<number | null>> {
    const dayCounts = Array.from<number>({length: memberCount}).fill(0);
    const nightCounts = Array.from<number>({length: memberCount}).fill(0);
    const firstSlotByMember = Array.from<number>({length: memberCount}).fill(Number.POSITIVE_INFINITY);
    for (const row of schedule) {
        row.forEach((memberIndex, slot) => {
            if (memberIndex === null) {
                return;
            }
            if (slot < sleepStartSlot) {
                dayCounts[memberIndex] += 1;
            } else {
                nightCounts[memberIndex] += 1;
            }
            firstSlotByMember[memberIndex] = Math.min(firstSlotByMember[memberIndex], slot);
        });
    }

    const compacted = Array.from({length: dailyPlannerMaxTeamSize},
        () => Array.from<number | null>({length: teamPlanSlotsPerDay}).fill(null));

    const canPlace = (rowIndex: number, startSlot: number, count: number, memberIndex: number): boolean => {
        for (let slot = startSlot; slot < startSlot + count; slot++) {
            if (compacted[rowIndex][slot] !== null) {
                return false;
            }
            if (compacted.some(row => row[slot] === memberIndex)) {
                return false;
            }
        }
        return true;
    };

    const place = (rowIndex: number, startSlot: number, count: number, memberIndex: number): void => {
        for (let slot = startSlot; slot < startSlot + count; slot++) {
            compacted[rowIndex][slot] = memberIndex;
        }
    };

    const placePeriod = (startSlot: number, endSlot: number, counts: number[]) => {
        const rowCursors = Array.from({length: dailyPlannerMaxTeamSize}).fill(startSlot);
        const memberOrder = counts
            .map((count, memberIndex) => ({count, memberIndex}))
            .filter(item => item.count > 0)
            .sort((a, b) => {
                const aAffinity = rowAffinityByMember[a.memberIndex] ?? dailyPlannerMaxTeamSize;
                const bAffinity = rowAffinityByMember[b.memberIndex] ?? dailyPlannerMaxTeamSize;
                if (aAffinity !== bAffinity) {
                    return aAffinity - bAffinity;
                }
                return firstSlotByMember[a.memberIndex] - firstSlotByMember[b.memberIndex];
            });
        for (const {count, memberIndex} of memberOrder) {
            const preferredRow = rowAffinityByMember[memberIndex];
            const rowOrder = [
                ...(preferredRow === null ? [] : [preferredRow]),
                ...Array.from({length: dailyPlannerMaxTeamSize}, (_, index) => index)
                    .filter(index => index !== preferredRow),
            ];
            let placed = false;
            for (const rowIndex of rowOrder) {
                const cursor = rowCursors[rowIndex];
                if (cursor + count > endSlot || !canPlace(rowIndex, cursor, count, memberIndex)) {
                    continue;
                }
                place(rowIndex, cursor, count, memberIndex);
                rowCursors[rowIndex] = cursor + count;
                rowAffinityByMember[memberIndex] ??= rowIndex;
                placed = true;
                break;
            }
            if (!placed) {
                let rest = count;
                for (let rowIndex = 0; rowIndex < dailyPlannerMaxTeamSize && rest > 0; rowIndex++) {
                    for (let slot = rowCursors[rowIndex]; slot < endSlot && rest > 0; slot++) {
                        if (!canPlace(rowIndex, slot, 1, memberIndex)) {
                            continue;
                        }
                        place(rowIndex, slot, 1, memberIndex);
                        rowCursors[rowIndex] = Math.max(rowCursors[rowIndex], slot + 1);
                        rowAffinityByMember[memberIndex] ??= rowIndex;
                        rest -= 1;
                    }
                }
            }
        }
    };

    placePeriod(0, sleepStartSlot, dayCounts);
    placePeriod(sleepStartSlot, teamPlanSlotsPerDay, nightCounts);
    return compacted;
}

function calculateTimeSlotAllocation(
    candidates: PokemonBoxItem[],
    parameter: StrengthParameter,
    demand: Partial<Record<IngredientName, number>>,
    stock: DailyPlannerIngredientStock,
): {
    members: DailyPlannerAllocationMember[];
    remainingDemand: Partial<Record<IngredientName, number>>;
} {
    const members = candidates.map(createAllocationMemberFromItem);
    const schedule = Array.from({length: dailyPlannerMaxTeamSize},
        () => Array.from<number | null>({length: teamPlanSlotsPerDay}).fill(null));
    const allocatedSlotsByMember = candidates.map(() => 0);
    const rowAffinityByMember: Array<number | null> = candidates.map(() => null);
    const energyByMember = candidates.map(() => 100);
    const remainingDemand = calculateStockedDemand(demand, stock);
    const nightIsFixed = parameter.tapFrequencyAsleep === NoTap;
    const nightSlotCount = teamPlanSlotsPerDay - sleepStartSlot;
    let initialEnergyByMember = candidates.map(() => 100);
    const daySlotSummaries = candidates.map(item => calculatePokemonPeriodSummary(
        item,
        createTimeScopedParameter(parameter, 0, teamPlanSlotHours),
        0,
        teamPlanSlotHours,
    ));
    const nightSlotSummaries = candidates.map(item => calculatePokemonPeriodSummary(
        item,
        createTimeScopedParameter(parameter, sleepStartHourFromWakeup, sleepStartHourFromWakeup + teamPlanSlotHours),
        0,
        teamPlanSlotHours,
    ));

    for (let slot = 0; slot < teamPlanSlotsPerDay; slot++) {
        if (nightIsFixed && slot >= sleepStartSlot) {
            continue;
        }
        const summaries = slot >= sleepStartSlot ? nightSlotSummaries : daySlotSummaries;
        const activeMemberIndices = new Set<number>();
        const selectedMemberIndices: number[] = [];
        const selectedSummaries: DailyPlannerPokemonSummary[] = [];
        for (let rowIndex = 0; rowIndex < dailyPlannerMaxTeamSize; rowIndex++) {
            if (schedule[rowIndex][slot] !== null) {
                activeMemberIndices.add(schedule[rowIndex][slot]!);
                selectedMemberIndices.push(schedule[rowIndex][slot]!);
                selectedSummaries[schedule[rowIndex][slot]!] = scaleSummaryByEnergy(
                    summaries[schedule[rowIndex][slot]!],
                    energyByMember[schedule[rowIndex][slot]!] ?? 100,
                );
                continue;
            }
            const preferredIndex = slot > 0 ? schedule[rowIndex][slot - 1] : null;
            const memberIndex = chooseBestCandidateIndex(
                candidates,
                summaries,
                remainingDemand,
                activeMemberIndices,
                allocatedSlotsByMember,
                energyByMember,
                rowAffinityByMember,
                rowIndex,
                1,
                preferredIndex,
            );
            if (memberIndex < 0) {
                break;
            }
            schedule[rowIndex][slot] = memberIndex;
            rowAffinityByMember[memberIndex] ??= rowIndex;
            activeMemberIndices.add(memberIndex);
            selectedMemberIndices.push(memberIndex);
            allocatedSlotsByMember[memberIndex] += 1;
            selectedSummaries[memberIndex] = scaleSummaryByEnergy(
                summaries[memberIndex],
                energyByMember[memberIndex] ?? 100,
            );
            addScheduledIngredientCounts(remainingDemand, selectedSummaries[memberIndex]);
        }
        applyScheduledTeamEnergy(energyByMember, selectedMemberIndices, selectedSummaries, 1);
    }

    if (nightIsFixed && nightSlotCount > 0) {
        const nightSummaries = candidates.map(item => calculatePokemonPeriodSummary(
            item,
            createTimeScopedParameter(parameter, sleepStartHourFromWakeup, dayHours),
            0,
            dayHours - sleepStartHourFromWakeup,
        ));
        const activeMemberIndices = new Set<number>();
        const chosenMemberIndices: number[] = [];
        const chosenSummaries: DailyPlannerPokemonSummary[] = [];
        for (let rowIndex = 0; rowIndex < dailyPlannerMaxTeamSize; rowIndex++) {
            const preferredIndex = schedule[rowIndex][sleepStartSlot - 1];
            const memberIndex = chooseBestCandidateIndex(
                candidates,
                nightSummaries,
                remainingDemand,
                activeMemberIndices,
                allocatedSlotsByMember,
                energyByMember,
                rowAffinityByMember,
                rowIndex,
                nightSlotCount,
                preferredIndex,
            );
            if (memberIndex < 0) {
                break;
            }
            activeMemberIndices.add(memberIndex);
            chosenMemberIndices.push(memberIndex);
            rowAffinityByMember[memberIndex] ??= rowIndex;
            allocatedSlotsByMember[memberIndex] += nightSlotCount;
            chosenSummaries[memberIndex] = scaleSummaryByEnergy(
                nightSummaries[memberIndex],
                energyByMember[memberIndex] ?? 100,
            );
            addScheduledIngredientCounts(remainingDemand, chosenSummaries[memberIndex]);
        }
        applyScheduledTeamEnergy(energyByMember, chosenMemberIndices, chosenSummaries, nightSlotCount);
        initialEnergyByMember = calculateWakeEnergyAfterPreviousNightSkills(
            candidates,
            parameter,
            chosenMemberIndices,
        );
        const usedRows = new Set<number>();
        for (const memberIndex of chosenMemberIndices) {
            let rowIndex = schedule.findIndex((row, index) =>
                !usedRows.has(index) && row[sleepStartSlot - 1] === memberIndex);
            if (rowIndex < 0) {
                rowIndex = schedule.findIndex((_, index) => !usedRows.has(index));
            }
            if (rowIndex < 0) {
                continue;
            }
            usedRows.add(rowIndex);
            for (let slot = sleepStartSlot; slot < teamPlanSlotsPerDay; slot++) {
                schedule[rowIndex][slot] = memberIndex;
            }
        }
    }

    const compactedSchedule = compactScheduleByMemberTotals(
        schedule,
        candidates.length,
        rowAffinityByMember,
    );

    return recalculateAllocationSegments(
        createSegmentsFromSchedule(compactedSchedule),
        members,
        parameter,
        demand,
        stock,
        initialEnergyByMember,
    );
}

export function calculateDailyTeamAllocationResult(
    items: PokemonBoxItem[],
    parameter: StrengthParameter,
    mealChoices: DailyPlannerMealChoice[] = getDefaultDailyPlannerMeals(),
    stock: DailyPlannerIngredientStock = {},
): DailyPlannerAllocationResult {
    const candidates = items.slice(0, dailyPlannerMaxCandidateCount);
    const normalizedMeals = mealChoices.length >= 3 ? mealChoices.slice(0, 3) : [
        ...mealChoices,
        ...getDefaultDailyPlannerMeals().slice(mealChoices.length),
    ];
    const demand = calculateDemandFromMeals(normalizedMeals);
    const {members, remainingDemand} = calculateTimeSlotAllocation(candidates, parameter, demand, stock);

    const totalTeamHours = Math.min(
        dayHours * dailyPlannerMaxTeamSize,
        members.reduce((sum, member) => sum + member.totalHours, 0),
    );
    const totalBerryCount = members.reduce((sum, member) => sum + member.berryCount, 0);
    const totalBerryEnergy = members.reduce((sum, member) => sum + member.berryEnergy, 0);
    const totalSkillEnergy = members.reduce((sum, member) => sum + member.skillEnergy, 0);
    const totalMealEnergy = calculateExpectedMealEnergy(
        normalizedMeals,
        parameter,
        members.flatMap(member => member.segments),
    );

    return {
        candidates: members,
        demand,
        stock,
        remainingDemand,
        totalTeamHours,
        totalBerryCount,
        totalBerryEnergy,
        totalMealEnergy,
        totalSkillEnergy,
        isDemandSatisfied: IngredientNames.every(name => (remainingDemand[name] ?? 0) <= 0),
    };
}
