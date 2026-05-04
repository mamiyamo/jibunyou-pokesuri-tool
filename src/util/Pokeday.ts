import { IngredientName, IngredientNames } from '../data/pokemons';
import { PokemonBoxItem } from './PokemonBox';
import Nature from './Nature';
import PokemonIv from './PokemonIv';
import PokemonStrength, {
    createStrengthParameter, noFavoriteFieldIndex, recipeLevelBonus, StrengthParameter
} from './PokemonStrength';
import SubSkill from './SubSkill';
import SubSkillList from './SubSkillList';
import { SubSkillListProps } from './SubSkillList';
import { IngredientType } from './PokemonRp';
import { getEventBonus } from '../data/events';
import { AlwaysTap } from './Energy';

export type PokedayRecipeCategory = 'curry' | 'salad' | 'dessert';

export type PokedayIngredient = {
    name: IngredientName;
    count: number;
};

export type PokedayRecipe = {
    category: PokedayRecipeCategory;
    title: string;
    name: string;
    baseEnergy: number;
    ingredients: PokedayIngredient[];
};

export type PokedayIngredientDailyDetail = {
    base: number;
    skill: number;
    total: number;
};

const LP_EPSILON = 1e-9;

export type MinimumWorkDaysResult = {
    totalDays: number;
    workDaysByPokemon: number[];
};

export type IngredientBaselineSource = {
    ingredientName: IngredientName;
    pokemonName: string;
    ingredientType: IngredientType;
};

export type IngredientBaselineDetailMaps =
    Partial<Record<IngredientName, Partial<Record<IngredientName, PokedayIngredientDailyDetail>>>>;

export type IngredientBaselinePokemonConfig = {
    level: 30|60;
    ingredientFinderM: boolean;
    ingredientFinderS: boolean;
    helpingSpeedM: boolean;
    helpingSpeedS: boolean;
};

export const defaultIngredientBaselinePokemonConfig: IngredientBaselinePokemonConfig = {
    level: 60,
    ingredientFinderM: false,
    ingredientFinderS: false,
    helpingSpeedM: false,
    helpingSpeedS: false,
};

export const pokedayRecipeGroups: {
    category: PokedayRecipeCategory;
    title: string;
    recipes: PokedayRecipe[];
}[] = [
    {
        category: 'curry',
        title: 'カレー・シチュー',
        recipes: [
            {
                category: 'curry',
                title: 'しんりょくアボカドグラタン',
                name: 'しんりょくアボカドグラタン',
                baseEnergy: 24802,
                ingredients: [
                    { name: 'avocado', count: 22 },
                    { name: 'potato', count: 20 },
                    { name: 'milk', count: 41 },
                    { name: 'oil', count: 32 },
                ],
            },
            {
                category: 'curry',
                title: 'いあいぎりすき焼きカレー',
                name: 'いあいぎりすき焼きカレー',
                baseEnergy: 20655,
                ingredients: [
                    { name: 'leek', count: 27 },
                    { name: 'sausage', count: 26 },
                    { name: 'honey', count: 26 },
                    { name: 'egg', count: 22 },
                ],
            },
            {
                category: 'curry',
                title: 'めざめるパワーシチュー',
                name: 'めざめるパワーシチュー',
                baseEnergy: 19061,
                ingredients: [
                    { name: 'soy', count: 28 },
                    { name: 'tomato', count: 25 },
                    { name: 'mushroom', count: 23 },
                    { name: 'coffee', count: 16 },
                ],
            },
            {
                category: 'curry',
                title: 'なりきりバケッチャシチュー',
                name: 'なりきりバケッチャシチュー',
                baseEnergy: 15621,
                ingredients: [
                    { name: 'pumpkin', count: 10 },
                    { name: 'sausage', count: 16 },
                    { name: 'potato', count: 18 },
                    { name: 'mushroom', count: 25 },
                ],
            },
            {
                category: 'curry',
                title: 'れんごくコーンキーマカレー',
                name: 'れんごくコーンキーマカレー',
                baseEnergy: 13690,
                ingredients: [
                    { name: 'herb', count: 27 },
                    { name: 'sausage', count: 24 },
                    { name: 'corn', count: 14 },
                    { name: 'ginger', count: 12 },
                ],
            },
        ],
    },
    {
        category: 'salad',
        title: 'サラダ',
        recipes: [
            {
                category: 'salad',
                title: 'ごろごろねっとうサラダ',
                name: 'ごろごろねっとうサラダ',
                baseEnergy: 25356,
                ingredients: [
                    { name: 'pumpkin', count: 20 },
                    { name: 'potato', count: 30 },
                    { name: 'corn', count: 18 },
                    { name: 'mushroom', count: 27 },
                ],
            },
            {
                category: 'salad',
                title: 'じならしワカモレチップス',
                name: 'じならしワカモレチップス',
                baseEnergy: 25162,
                ingredients: [
                    { name: 'avocado', count: 28 },
                    { name: 'corn', count: 25 },
                    { name: 'herb', count: 30 },
                    { name: 'soy', count: 22 },
                ],
            },
            {
                category: 'salad',
                title: 'まけんきコーヒーサラダ',
                name: 'まけんきコーヒーサラダ',
                baseEnergy: 20218,
                ingredients: [
                    { name: 'coffee', count: 28 },
                    { name: 'sausage', count: 28 },
                    { name: 'oil', count: 22 },
                    { name: 'potato', count: 22 },
                ],
            },
            {
                category: 'salad',
                title: 'りんごさんヨーグルト',
                name: 'りんごさんヨーグルト',
                baseEnergy: 19293,
                ingredients: [
                    { name: 'egg', count: 35 },
                    { name: 'apple', count: 28 },
                    { name: 'tomato', count: 23 },
                    { name: 'milk', count: 18 },
                ],
            },
            {
                category: 'salad',
                title: 'はなふぶきミモザ',
                name: 'はなふぶきミモザ',
                baseEnergy: 11881,
                ingredients: [
                    { name: 'egg', count: 25 },
                    { name: 'oil', count: 17 },
                    { name: 'potato', count: 15 },
                    { name: 'sausage', count: 12 },
                ],
            },
            {
                category: 'salad',
                title: 'ワカクササラダ',
                name: 'ワカクササラダ',
                baseEnergy: 11393,
                ingredients: [
                    { name: 'oil', count: 22 },
                    { name: 'corn', count: 17 },
                    { name: 'tomato', count: 14 },
                    { name: 'potato', count: 9 },
                ],
            },
        ],
    },
    {
        category: 'dessert',
        title: 'デザート・ドリンク',
        recipes: [
            {
                category: 'dessert',
                title: 'みつあつめチョコワッフル',
                name: 'みつあつめチョコワッフル',
                baseEnergy: 25484,
                ingredients: [
                    { name: 'honey', count: 38 },
                    { name: 'corn', count: 28 },
                    { name: 'oil', count: 28 },
                    { name: 'cacao', count: 21 },
                ],
            },
            {
                category: 'dessert',
                title: 'ドキドキこわいかおパンケーキ',
                name: 'ドキドキこわいかおパンケーキ',
                baseEnergy: 24354,
                ingredients: [
                    { name: 'pumpkin', count: 18 },
                    { name: 'egg', count: 24 },
                    { name: 'honey', count: 32 },
                    { name: 'tomato', count: 29 },
                ],
            },
            {
                category: 'dessert',
                title: 'ドオーのエクレア',
                name: 'ドオーのエクレア',
                baseEnergy: 20885,
                ingredients: [
                    { name: 'cacao', count: 30 },
                    { name: 'milk', count: 26 },
                    { name: 'coffee', count: 24 },
                    { name: 'honey', count: 22 },
                ],
            },
            {
                category: 'dessert',
                title: 'スパークスパイスコーラ',
                name: 'スパークスパイスコーラ',
                baseEnergy: 17494,
                ingredients: [
                    { name: 'apple', count: 35 },
                    { name: 'ginger', count: 20 },
                    { name: 'leek', count: 20 },
                    { name: 'coffee', count: 12 },
                ],
            },
            {
                category: 'dessert',
                title: 'おちゃかいコーンスコーン',
                name: 'おちゃかいコーンスコーン',
                baseEnergy: 10925,
                ingredients: [
                    { name: 'apple', count: 20 },
                    { name: 'ginger', count: 20 },
                    { name: 'corn', count: 18 },
                    { name: 'milk', count: 9 },
                ],
            },
            {
                category: 'dessert',
                title: 'フラワーギフトマカロン',
                name: 'フラワーギフトマカロン',
                baseEnergy: 13834,
                ingredients: [
                    { name: 'cacao', count: 25 },
                    { name: 'egg', count: 25 },
                    { name: 'honey', count: 17 },
                    { name: 'milk', count: 10 },
                ],
            },
        ],
    },
];

const hyperCutterIngredientPool: IngredientName[] = [
    'potato',
    'oil',
    'tomato',
    'corn',
];

export const ingredientBaselineSources: Partial<Record<IngredientName, IngredientBaselineSource>> = {
    leek: { ingredientName: 'leek', pokemonName: "Farfetch'd", ingredientType: 'AAA' },
    mushroom: { ingredientName: 'mushroom', pokemonName: 'Spiritomb', ingredientType: 'AAA' },
    egg: { ingredientName: 'egg', pokemonName: 'Blissey', ingredientType: 'AAA' },
    potato: { ingredientName: 'potato', pokemonName: 'Cetitan', ingredientType: 'AAA' },
    apple: { ingredientName: 'apple', pokemonName: 'Skeledirge', ingredientType: 'AAA' },
    herb: { ingredientName: 'herb', pokemonName: 'Dragonite', ingredientType: 'AAA' },
    sausage: { ingredientName: 'sausage', pokemonName: 'Aggron', ingredientType: 'AAA' },
    milk: { ingredientName: 'milk', pokemonName: 'Blastoise', ingredientType: 'AAA' },
    honey: { ingredientName: 'honey', pokemonName: 'Venusaur', ingredientType: 'AAA' },
    oil: { ingredientName: 'oil', pokemonName: 'Toxicroak', ingredientType: 'AAA' },
    ginger: { ingredientName: 'ginger', pokemonName: 'Tyranitar', ingredientType: 'AAA' },
    tomato: { ingredientName: 'tomato', pokemonName: 'Luxray', ingredientType: 'AAA' },
    cacao: { ingredientName: 'cacao', pokemonName: 'Absol', ingredientType: 'AAA' },
    tail: { ingredientName: 'tail', pokemonName: 'Ditto', ingredientType: 'AAC' },
    soy: { ingredientName: 'soy', pokemonName: 'Tyranitar', ingredientType: 'ABB' },
    corn: { ingredientName: 'corn', pokemonName: 'Bewear', ingredientType: 'AAA' },
    coffee: { ingredientName: 'coffee', pokemonName: 'Vikavolt', ingredientType: 'AAA' },
    pumpkin: { ingredientName: 'pumpkin', pokemonName: 'Gourgeist (Small)', ingredientType: 'AAA' },
    avocado: { ingredientName: 'avocado', pokemonName: 'Flygon', ingredientType: 'AAA' },
};

function buildIngredientBaselineSubSkills(
    config: IngredientBaselinePokemonConfig,
): SubSkillList {
    const selectedSkills: SubSkill[] = [];
    if (config.ingredientFinderM) {
        selectedSkills.push(new SubSkill('Ingredient Finder M'));
    }
    if (config.ingredientFinderS) {
        selectedSkills.push(new SubSkill('Ingredient Finder S'));
    }
    if (config.helpingSpeedM) {
        selectedSkills.push(new SubSkill('Helping Speed M'));
    }
    if (config.helpingSpeedS) {
        selectedSkills.push(new SubSkill('Helping Speed S'));
    }
    const activeLevels: (10|25|50|75|100)[] = config.level === 30 ? [10, 25] : [10, 25, 50, 75, 100];
    const props: Partial<SubSkillListProps> = {};
    activeLevels.forEach((level, index) => {
        const subSkill = selectedSkills[index];
        if (subSkill !== undefined) {
            props[`lv${level}` as keyof SubSkillListProps] = subSkill;
        }
    });
    return new SubSkillList(props);
}

function roundHalfUp(value: number): number {
    return Math.floor(value + 0.5);
}

function solveLinearSystem(matrix: number[][], rhs: number[]): number[] | null {
    const size = rhs.length;
    const augmented = matrix.map((row, index) => [...row, rhs[index]]);
    for (let col = 0; col < size; col++) {
        let pivot = col;
        for (let row = col + 1; row < size; row++) {
            if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) {
                pivot = row;
            }
        }
        if (Math.abs(augmented[pivot][col]) < LP_EPSILON) {
            return null;
        }
        if (pivot !== col) {
            [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
        }
        const pivotValue = augmented[col][col];
        for (let i = col; i <= size; i++) {
            augmented[col][i] /= pivotValue;
        }
        for (let row = 0; row < size; row++) {
            if (row === col) {
                continue;
            }
            const factor = augmented[row][col];
            if (Math.abs(factor) < LP_EPSILON) {
                continue;
            }
            for (let i = col; i <= size; i++) {
                augmented[row][i] -= factor * augmented[col][i];
            }
        }
    }
    return augmented.map(row => row[size]);
}

function enumerateCombinations(
    total: number,
    choose: number,
    start = 0,
    current: number[] = [],
    result: number[][] = [],
): number[][] {
    if (current.length === choose) {
        result.push([...current]);
        return result;
    }
    if (start >= total) {
        return result;
    }
    for (let index = start; index < total; index++) {
        current.push(index);
        enumerateCombinations(total, choose, index + 1, current, result);
        current.pop();
    }
    return result;
}

/**
 * Calculate the minimum summed working days needed to satisfy all ingredient requirements.
 *
 * Each pokemon works in parallel, and the objective is the sum of active days across the team.
 * `ratesByPokemon[i][j]` is the daily amount pokemon `i` can contribute to ingredient `j`.
 */
export function calculateMinimumWorkDaysDetail(
    requirements: number[],
    ratesByPokemon: number[][],
): MinimumWorkDaysResult | null {
    const pokemonCount = ratesByPokemon.length;
    const ingredientCount = requirements.length;
    if (pokemonCount === 0 || ingredientCount === 0) {
        return null;
    }

    const combinations = enumerateCombinations(ingredientCount + pokemonCount, pokemonCount);
    let best: MinimumWorkDaysResult | null = null;

    for (const combination of combinations) {
        const matrix: number[][] = [];
        const rhs: number[] = [];
        for (const constraintIndex of combination) {
            if (constraintIndex < ingredientCount) {
                const ingredientIndex = constraintIndex;
                matrix.push(ratesByPokemon.map(pokemon => pokemon[ingredientIndex] ?? 0));
                rhs.push(requirements[ingredientIndex] ?? 0);
            }
            else {
                const pokemonIndex = constraintIndex - ingredientCount;
                const row = new Array(pokemonCount).fill(0);
                row[pokemonIndex] = 1;
                matrix.push(row);
                rhs.push(0);
            }
        }

        const solution = solveLinearSystem(matrix, rhs);
        if (solution === null) {
            continue;
        }
        if (solution.some(value => !Number.isFinite(value) || value < -LP_EPSILON)) {
            continue;
        }

        let feasible = true;
        for (let ingredientIndex = 0; ingredientIndex < ingredientCount; ingredientIndex++) {
            let total = 0;
            for (let pokemonIndex = 0; pokemonIndex < pokemonCount; pokemonIndex++) {
                total += (ratesByPokemon[pokemonIndex][ingredientIndex] ?? 0) * solution[pokemonIndex];
            }
            if (total + LP_EPSILON < requirements[ingredientIndex]) {
                feasible = false;
                break;
            }
        }
        if (!feasible) {
            continue;
        }

        const totalDays = solution.reduce((sum, value) => sum + value, 0);
        if (best === null || totalDays < best.totalDays) {
            best = {
                totalDays,
                workDaysByPokemon: solution,
            };
        }
    }

    return best;
}

export function calculateMinimumWorkDays(
    requirements: number[],
    ratesByPokemon: number[][],
): number | null {
    return calculateMinimumWorkDaysDetail(requirements, ratesByPokemon)?.totalDays ?? null;
}

export function getRecipeDisplayEnergy(recipe: PokedayRecipe, parameter: StrengthParameter): number {
    const bonus = recipeLevelBonus[parameter.recipeLevel] ?? 0;
    return recipe.baseEnergy + roundHalfUp(recipe.baseEnergy * bonus / 100);
}

export function getRecipeFinalEnergy(recipe: PokedayRecipe, parameter: StrengthParameter): number {
    const eventBonus = getEventBonus(parameter.event, parameter.customEventBonus).dish;
    return roundHalfUp(getRecipeDisplayEnergy(recipe, parameter) * (1 + parameter.fieldBonus / 100) * eventBonus);
}

export function createPokedayHelpParameter(): StrengthParameter {
    return createPokedayHelpParameterWith({
        helpBonusCount: 0,
    });
}

export function createPokedayHelpParameterWith({
    helpBonusCount,
    baseParameter,
}: {
    helpBonusCount: number;
    baseParameter?: Pick<StrengthParameter,
        'event'|'fieldIndex'|'expertEffect'|'useSkillPity'|'isGoodCampTicketSet'|
        'isEnergyAlwaysFull'|'sleepScore'|'tapFrequencyAwake'|'tapFrequencyAsleep'>;
}): StrengthParameter {
    const helpBonus = Math.max(0, Math.min(4, Math.floor(helpBonusCount))) as 0|1|2|3|4;
    return createStrengthParameter({
        period: 24,
        isEnergyAlwaysFull: baseParameter?.isEnergyAlwaysFull ?? true,
        tapFrequencyAwake: baseParameter?.tapFrequencyAwake ?? AlwaysTap,
        tapFrequencyAsleep: baseParameter?.tapFrequencyAsleep ?? AlwaysTap,
        sleepScore: baseParameter?.sleepScore ?? 100,
        event: baseParameter?.event ?? 'none',
        fieldIndex: baseParameter?.fieldIndex ?? noFavoriteFieldIndex,
        expertEffect: baseParameter?.expertEffect ?? 'berry',
        useSkillPity: baseParameter?.useSkillPity ?? false,
        isGoodCampTicketSet: baseParameter?.isGoodCampTicketSet ?? false,
        helpBonusCount: helpBonus,
    });
}

export function getDailyIngredientCount(
    boxItem: PokemonBoxItem,
    ingredient: IngredientName,
    options?: {
        parameter?: Pick<StrengthParameter, 'event'|'fieldIndex'|'expertEffect'>;
    }
): number {
    const countMap = getDailyIngredientCountMap(boxItem, options);
    return countMap[ingredient] ?? 0;
}

export function getDailyIngredientCountMap(
    boxItem: PokemonBoxItem,
    options?: {
        parameter?: Pick<StrengthParameter, 'event'|'fieldIndex'|'expertEffect'|'isGoodCampTicketSet'>;
    }
): Partial<Record<IngredientName, number>> {
    const detailMap = getDailyIngredientDetailMap(boxItem, options);
    const ret: Partial<Record<IngredientName, number>> = {};
    for (const key of Object.keys(detailMap) as IngredientName[]) {
        ret[key] = detailMap[key]?.total ?? 0;
    }
    return ret;
}

export function getDailyIngredientDetailMap(
    boxItem: PokemonBoxItem,
    options?: {
        helpBonusCount?: number;
        parameter?: Pick<StrengthParameter, 'event'|'fieldIndex'|'expertEffect'|'useSkillPity'|'isGoodCampTicketSet'>;
    }
): Partial<Record<IngredientName, PokedayIngredientDailyDetail>> {
    const helpBonusCount = options?.helpBonusCount ?? 0;
    const strength = new PokemonStrength(boxItem.iv, createPokedayHelpParameterWith({
        helpBonusCount,
        baseParameter: options?.parameter,
    }));
    const result = strength.calculate();
    const ret: Partial<Record<IngredientName, PokedayIngredientDailyDetail>> = {};
    const addCount = (ingredientName: IngredientName, count: number, type: 'base'|'skill') => {
        if (count <= 0) {
            return;
        }
        const current = ret[ingredientName] ?? {base: 0, skill: 0, total: 0};
        const next = {
            ...current,
            total: current.total + count,
        };
        next[type] = current[type] + count;
        ret[ingredientName] = next;
    };

    // Base ingredients from regular helps.
    for (const ingredient of result.ingredients) {
        addCount(ingredient.name, ingredient.count, 'base');
    }

    // Skill-based ingredients are distributed over unlocked ingredients as expected values.
    const skillName = boxItem.iv.pokemon.skill === "Versatile" ?
        boxItem.iv.versatileSkill : boxItem.iv.pokemon.skill;
    const ingredientPool = getSkillIngredientPool(boxItem, skillName);
    const shouldUseEqualWeight = skillName.startsWith("Ingredient Magnet S") ||
        skillName === "Ingredient Draw S" ||
        skillName === "Ingredient Draw S (Hyper Cutter)";
    if (ingredientPool.length === 0) {
        return ret;
    }

    const weightMap: Partial<Record<IngredientName, number>> = {};
    let weightSum = 0;
    for (const ingredientName of ingredientPool) {
        const weight = shouldUseEqualWeight ? 1 :
            (result.ingredients.find(x => x.name === ingredientName)?.count ?? 0);
        weightMap[ingredientName] = weight;
        weightSum += weight;
    }
    if (weightSum <= 0) {
        for (const ingredientName of ingredientPool) {
            weightMap[ingredientName] = 1;
        }
        weightSum = ingredientPool.length;
    }

    const addDistributedSkillIngredients = (totalCount: number) => {
        if (totalCount <= 0) {
            return;
        }
        for (const ingredientName of ingredientPool) {
            const weight = weightMap[ingredientName] ?? 0;
            addCount(ingredientName, totalCount * weight / weightSum, 'skill');
        }
    };

    if (skillName === "Ingredient Magnet S (Plus)") {
        // `Plus` has a dedicated fixed-ingredient effect in `skillValue2`.
        // `skillValue` is not tied to a single ingredient icon in UI, so we
        // don't distribute it here to avoid over-counting recipe-specific rows.
        addCount(boxItem.iv.pokemon.ing1.name, result.skillValue2, 'skill');
    }
    else if (skillName.startsWith("Ingredient Magnet S") ||
        skillName.startsWith("Ingredient Draw S") ||
        skillName === "Cooking Assist S (Bulk Up)") {
        addDistributedSkillIngredients(result.skillValue);
    }

    return ret;
}

export function getDailyIngredientDetailMapWithStrengthParameter(
    boxItem: PokemonBoxItem,
    parameter: StrengthParameter,
    helpBonusCount: number = 0,
    periodHours: number = 24,
): Partial<Record<IngredientName, PokedayIngredientDailyDetail>> {
    const helpBonus = Math.max(0, Math.min(4, Math.floor(helpBonusCount))) as 0|1|2|3|4;
    const strength = new PokemonStrength(boxItem.iv, {
        ...parameter,
        period: periodHours,
        helpBonusCount: helpBonus,
    });
    const result = strength.calculate();
    const ret: Partial<Record<IngredientName, PokedayIngredientDailyDetail>> = {};
    const addCount = (ingredientName: IngredientName, count: number, type: 'base'|'skill') => {
        if (count <= 0) {
            return;
        }
        const current = ret[ingredientName] ?? {base: 0, skill: 0, total: 0};
        const next = {
            ...current,
            total: current.total + count,
        };
        next[type] = current[type] + count;
        ret[ingredientName] = next;
    };

    for (const ingredient of result.ingredients) {
        addCount(ingredient.name, ingredient.count, 'base');
    }

    const skillName = boxItem.iv.pokemon.skill === "Versatile" ?
        boxItem.iv.versatileSkill : boxItem.iv.pokemon.skill;
    const ingredientPool = getSkillIngredientPool(boxItem, skillName);
    const shouldUseEqualWeight = skillName.startsWith("Ingredient Magnet S") ||
        skillName === "Ingredient Draw S" ||
        skillName === "Ingredient Draw S (Hyper Cutter)";
    if (ingredientPool.length === 0) {
        return ret;
    }

    const weightMap: Partial<Record<IngredientName, number>> = {};
    let weightSum = 0;
    for (const ingredientName of ingredientPool) {
        const weight = shouldUseEqualWeight ? 1 :
            (result.ingredients.find(x => x.name === ingredientName)?.count ?? 0);
        weightMap[ingredientName] = weight;
        weightSum += weight;
    }
    if (weightSum <= 0) {
        for (const ingredientName of ingredientPool) {
            weightMap[ingredientName] = 1;
        }
        weightSum = ingredientPool.length;
    }

    const addDistributedSkillIngredients = (totalCount: number) => {
        if (totalCount <= 0) {
            return;
        }
        for (const ingredientName of ingredientPool) {
            const weight = weightMap[ingredientName] ?? 0;
            addCount(ingredientName, totalCount * weight / weightSum, 'skill');
        }
    };

    if (skillName === "Ingredient Magnet S (Plus)") {
        addCount(boxItem.iv.pokemon.ing1.name, result.skillValue2, 'skill');
    }
    else if (skillName.startsWith("Ingredient Magnet S") ||
        skillName.startsWith("Ingredient Draw S") ||
        skillName === "Cooking Assist S (Bulk Up)") {
        addDistributedSkillIngredients(result.skillValue);
    }

    return ret;
}

export function getIngredientBaselineDetailMap(
    parameter: StrengthParameter,
    baselinePokemonConfig: IngredientBaselinePokemonConfig = defaultIngredientBaselinePokemonConfig,
): Partial<Record<IngredientName, PokedayIngredientDailyDetail>> {
    const ret: Partial<Record<IngredientName, PokedayIngredientDailyDetail>> = {};
    const baselineSubSkills = buildIngredientBaselineSubSkills(baselinePokemonConfig);
    for (const ingredientName of IngredientNames) {
        const source = ingredientBaselineSources[ingredientName];
        if (source === undefined) {
            continue;
        }
        const iv = new PokemonIv({
            pokemonName: source.pokemonName,
            level: baselinePokemonConfig.level,
            skillLevel: 1,
            ingredient: source.ingredientType,
            nature: new Nature('Hardy'),
            subSkills: baselineSubSkills,
        });
        const detailMap = getDailyIngredientDetailMap(
            new PokemonBoxItem(iv),
            { parameter },
        );
        const value = detailMap[ingredientName];
        if (value !== undefined) {
            ret[ingredientName] = value;
        }
    }
    return ret;
}

export function getIngredientBaselineDetailMaps(
    parameter: StrengthParameter,
    ingredientNames: IngredientName[],
    baselinePokemonConfig: IngredientBaselinePokemonConfig = defaultIngredientBaselinePokemonConfig,
): IngredientBaselineDetailMaps {
    const ret: IngredientBaselineDetailMaps = {};
    const baselineSubSkills = buildIngredientBaselineSubSkills(baselinePokemonConfig);
    for (const ingredientName of ingredientNames) {
        const source = ingredientBaselineSources[ingredientName];
        if (source === undefined) {
            continue;
        }
        const iv = new PokemonIv({
            pokemonName: source.pokemonName,
            level: baselinePokemonConfig.level,
            skillLevel: 1,
            ingredient: source.ingredientType,
            nature: new Nature('Hardy'),
            subSkills: baselineSubSkills,
        });
        const detailMap = getDailyIngredientDetailMap(
            new PokemonBoxItem(iv),
            { parameter },
        );
        ret[ingredientName] = detailMap;
    }
    return ret;
}

export function getSkillIngredientPool(boxItem: PokemonBoxItem, skillName: string): IngredientName[] {
    if (skillName.startsWith("Ingredient Magnet S")) {
        return IngredientNames;
    }

    if (skillName === "Ingredient Draw S (Hyper Cutter)") {
        return hyperCutterIngredientPool;
    }

    // 食材セレクトSは固定食材セットを使う（解放状況には依存しない）
    if (skillName === "Ingredient Draw S") {
        if (boxItem.iv.pokemon.ing1.name === 'avocado') {
            return ['avocado', 'potato', 'oil'];
        }
        if (boxItem.iv.pokemon.ing1.name === 'honey') {
            return ['honey', 'oil', 'corn'];
        }
    }

    // 食材ゲット系やその他は既存ロジック（解放済み食材ベース）
    return boxItem.iv.getIngredients(true)
        .filter(x => !x.startsWith('unknown'));
}

