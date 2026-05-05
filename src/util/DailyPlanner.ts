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
    berryCount: number;
    mealEnergy: number;
    skillEnergy: number;
    totalEnergy: number;
    ingredientCounts: Partial<Record<IngredientName, number>>;
    randomIngredientCounts: Partial<Record<IngredientName, number>>;
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
};

export type DailyPlannerAllocationResult = {
    candidates: DailyPlannerAllocationMember[];
    demand: Partial<Record<IngredientName, number>>;
    stock: DailyPlannerIngredientStock;
    remainingDemand: Partial<Record<IngredientName, number>>;
    totalTeamHours: number;
    totalBerryCount: number;
    totalBerryEnergy: number;
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

function calculatePokemonPeriodSummary(item: PokemonBoxItem,
    parameter: StrengthParameter,
    helpBonusCount: number,
    periodHours: number,
    teamContext: { hasOtherPlusMinus: boolean } = {hasOtherPlusMinus: false},
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
    const detailMap = getDailyIngredientDetailMapWithStrengthParameter(
        item, dailyParameter, helpBonusCount, periodHours);
    const ingredientCounts: Partial<Record<IngredientName, number>> = {};
    const randomIngredientCounts: Partial<Record<IngredientName, number>> = {};
    let ingredientCoverage = 0;
    for (const ingredientName of IngredientNames) {
        const total = detailMap[ingredientName]?.total ?? 0;
        if (total > 0) {
            ingredientCounts[ingredientName] = total;
        }
    }
    if (isRandomIngredientSkill(skillName)) {
        for (const ingredientName of IngredientNames) {
            const randomTotal = detailMap[ingredientName]?.skill ?? 0;
            if (randomTotal > 0) {
                randomIngredientCounts[ingredientName] = randomTotal;
            }
        }
    }
    else if (skillName === 'Ingredient Magnet S (Plus)') {
        if (teamContext.hasOtherPlusMinus) {
            const pool = getEqualIngredientPool(item, skillName);
            const countPerIngredient = pool.length === 0 ? 0 : result.skillValue / pool.length;
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
const allocationStepHours = 0.25;
const timeBoundaryHours = [4, 7, 12, 18, 22.5];

function isNightPeriod(startHour: number, endHour: number): boolean {
    const middle = (startHour + endHour) / 2;
    return middle < 7 || middle >= 22.5;
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

function scaleIngredientCounts(
    source: Partial<Record<IngredientName, number>>,
    rate: number,
): Partial<Record<IngredientName, number>> {
    const ret: Partial<Record<IngredientName, number>> = {};
    for (const ingredientName of IngredientNames) {
        const value = source[ingredientName] ?? 0;
        if (value > 0) {
            ret[ingredientName] = value * rate;
        }
    }
    return ret;
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

function createAllocationMember(summary: DailyPlannerPokemonSummary): DailyPlannerAllocationMember {
    return {
        item: summary.item,
        workHours: 0,
        totalHours: 0,
        berryEnergyPerHour: summary.berryEnergy / dayHours,
        berryCountPerHour: summary.berryCount / dayHours,
        ingredientCounts: {},
        randomIngredientCounts: {},
        berryCount: 0,
        berryEnergy: 0,
    };
}

function calculateTeamContextSummaries(
    candidates: PokemonBoxItem[],
    parameter: StrengthParameter,
    activeItemIds: Set<number> | null,
): DailyPlannerPokemonSummary[] {
    const contextItems = activeItemIds === null ?
        candidates :
        candidates.filter(item => activeItemIds.has(item.id));
    const plusMinusCandidateIds = new Set(contextItems
        .filter(item => isPlusMinusSkill(getSkillName(item)))
        .map(item => item.id));
    const helpingBonusCount = contextItems
        .filter(item => item.iv.hasHelpingBonusInActiveSubSkills)
        .length;

    return candidates.map(item => calculatePokemonDailySummary(item, parameter, Math.max(
        0,
        Math.min(4, helpingBonusCount - (item.iv.hasHelpingBonusInActiveSubSkills ? 1 : 0)),
    ), {
        hasOtherPlusMinus: plusMinusCandidateIds.size > (plusMinusCandidateIds.has(item.id) ? 1 : 0),
    }));
}

function calculateAllocationFromSummaries(
    summaries: DailyPlannerPokemonSummary[],
    demand: Partial<Record<IngredientName, number>>,
    stock: DailyPlannerIngredientStock,
): {
    members: DailyPlannerAllocationMember[];
    remainingDemand: Partial<Record<IngredientName, number>>;
} {
    const remainingDemand = calculateStockedDemand(demand, stock);
    const members = summaries.map(createAllocationMember);
    const maxTeamHours = dayHours * Math.min(dailyPlannerMaxTeamSize, summaries.length);
    const requiredIngredientNames = IngredientNames
        .filter(name => (remainingDemand[name] ?? 0) > 0);
    const mealRequirements = requiredIngredientNames.map(name => remainingDemand[name] ?? 0);
    const mealRatesByPokemon = summaries.map(summary =>
        requiredIngredientNames.map(name => summary.ingredientCounts[name] ?? 0)
    );
    const mealWorkDays = calculateMinimumWorkDaysDetail(mealRequirements, mealRatesByPokemon);

    if (mealWorkDays !== null) {
        mealWorkDays.workDaysByPokemon.forEach((workDays, index) => {
            const member = members[index];
            if (member === undefined || workDays <= 0) {
                return;
            }
            const workHours = Math.min(dayHours, workDays * dayHours);
            member.workHours = workHours;
            member.totalHours = workHours;
            member.berryCount = member.berryCountPerHour * workHours;
            member.berryEnergy = member.berryEnergyPerHour * workHours;
            member.ingredientCounts = scaleIngredientCounts(summaries[index].ingredientCounts, workHours / dayHours);
            member.randomIngredientCounts =
                scaleIngredientCounts(summaries[index].randomIngredientCounts, workHours / dayHours);
            subtractIngredientCounts(remainingDemand, member.ingredientCounts);
        });
    }

    while (members.reduce((sum, member) => sum + member.totalHours, 0) < maxTeamHours - 1e-9) {
        let bestIndex = -1;
        let bestBerryEnergyPerHour = -Infinity;
        for (let index = 0; index < members.length; index++) {
            const member = members[index];
            if (member.totalHours >= dayHours - 1e-9) {
                continue;
            }
            if (member.berryEnergyPerHour > bestBerryEnergyPerHour) {
                bestBerryEnergyPerHour = member.berryEnergyPerHour;
                bestIndex = index;
            }
        }
        if (bestIndex < 0) {
            break;
        }

        const member = members[bestIndex];
        const remainingTeamHours = maxTeamHours -
            members.reduce((sum, allocationMember) => sum + allocationMember.totalHours, 0);
        const allocatedHours = Math.min(allocationStepHours, remainingTeamHours, dayHours - member.totalHours);
        member.workHours += allocatedHours;
        member.totalHours += allocatedHours;
        member.berryCount += member.berryCountPerHour * allocatedHours;
        member.berryEnergy += member.berryEnergyPerHour * allocatedHours;
        const extraIngredientCounts = scaleIngredientCounts(
            summaries[bestIndex].ingredientCounts,
            allocatedHours / dayHours,
        );
        const extraRandomIngredientCounts = scaleIngredientCounts(
            summaries[bestIndex].randomIngredientCounts,
            allocatedHours / dayHours,
        );
        addScaledIngredientCounts(member.ingredientCounts, extraIngredientCounts, 1);
        addScaledIngredientCounts(member.randomIngredientCounts, extraRandomIngredientCounts, 1);
        subtractIngredientCounts(remainingDemand, extraIngredientCounts);
    }

    return {members, remainingDemand};
}

type AllocationSegment = {
    memberIndex: number;
    startHour: number;
    endHour: number;
};

function createAllocationSegments(members: DailyPlannerAllocationMember[]): AllocationSegment[] {
    const rowHours = [0, 0, 0, 0, 0];
    const segments: AllocationSegment[] = [];
    members.forEach((member, memberIndex) => {
        let rest = member.totalHours;
        while (rest > 1e-9) {
            const rowIndex = rowHours.findIndex(hours => hours < dayHours - 1e-9);
            if (rowIndex < 0) {
                break;
            }
            const allocated = Math.min(rest, dayHours - rowHours[rowIndex]);
            segments.push({
                memberIndex,
                startHour: rowHours[rowIndex],
                endHour: rowHours[rowIndex] + allocated,
            });
            rowHours[rowIndex] += allocated;
            rest -= allocated;
        }
    });
    return segments;
}

function createEmptyLikeMember(member: DailyPlannerAllocationMember): DailyPlannerAllocationMember {
    return {
        ...member,
        berryCount: 0,
        berryEnergy: 0,
        ingredientCounts: {},
        randomIngredientCounts: {},
    };
}

function recalculateAllocationByTimeOverlap(
    members: DailyPlannerAllocationMember[],
    parameter: StrengthParameter,
    demand: Partial<Record<IngredientName, number>>,
    stock: DailyPlannerIngredientStock,
): {
    members: DailyPlannerAllocationMember[];
    remainingDemand: Partial<Record<IngredientName, number>>;
} {
    const segments = createAllocationSegments(members);
    const breakpoints = [...new Set([
        0,
        dayHours,
        ...timeBoundaryHours,
        ...segments.flatMap(segment => [segment.startHour, segment.endHour]),
    ])].sort((a, b) => a - b);
    const nextMembers = members.map(createEmptyLikeMember);
    const remainingDemand = calculateStockedDemand(demand, stock);

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

        for (const segment of activeSegments) {
            const member = members[segment.memberIndex];
            const overlapHours = Math.min(end, segment.endHour) - Math.max(start, segment.startHour);
            if (overlapHours <= 1e-9) {
                continue;
            }
            const summary = calculatePokemonPeriodSummary(
                member.item,
                createTimeScopedParameter(parameter, start, end),
                Math.max(0, Math.min(
                    4,
                    helpingBonusCount - (member.item.iv.hasHelpingBonusInActiveSubSkills ? 1 : 0),
                )),
                overlapHours,
                {
                    hasOtherPlusMinus: plusMinusIds.size > (plusMinusIds.has(member.item.id) ? 1 : 0),
                },
            );
            const nextMember = nextMembers[segment.memberIndex];
            nextMember.berryCount += summary.berryCount;
            nextMember.berryEnergy += summary.berryEnergy;
            addScaledIngredientCounts(nextMember.ingredientCounts, summary.ingredientCounts, 1);
            addScaledIngredientCounts(nextMember.randomIngredientCounts, summary.randomIngredientCounts, 1);
            subtractIngredientCounts(remainingDemand, summary.ingredientCounts);
        }
    }

    return {members: nextMembers, remainingDemand};
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
    const initialSummaries = calculateTeamContextSummaries(candidates, parameter, null);
    const initialAllocation = calculateAllocationFromSummaries(initialSummaries, demand, stock);
    const activeItemIds = new Set(initialAllocation.members
        .filter(member => member.totalHours > 0)
        .map(member => member.item.id));
    const summaries = calculateTeamContextSummaries(candidates, parameter, activeItemIds);
    const timeBlindAllocation = calculateAllocationFromSummaries(summaries, demand, stock);
    const {members, remainingDemand} = recalculateAllocationByTimeOverlap(
        timeBlindAllocation.members,
        parameter,
        demand,
        stock,
    );

    const totalTeamHours = members.reduce((sum, member) => sum + member.totalHours, 0);
    const totalBerryCount = members.reduce((sum, member) => sum + member.berryCount, 0);
    const totalBerryEnergy = members.reduce((sum, member) => sum + member.berryEnergy, 0);

    return {
        candidates: members,
        demand,
        stock,
        remainingDemand,
        totalTeamHours,
        totalBerryCount,
        totalBerryEnergy,
        isDemandSatisfied: IngredientNames.every(name => (remainingDemand[name] ?? 0) <= 0),
    };
}
