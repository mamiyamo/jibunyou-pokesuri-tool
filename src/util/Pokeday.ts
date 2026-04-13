import { IngredientName } from '../data/pokemons';
import { PokemonBoxItem } from './PokemonBox';
import PokemonStrength, {
    createStrengthParameter, noFavoriteFieldIndex, recipeLevelBonus, StrengthParameter
} from './PokemonStrength';

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

function roundHalfUp(value: number): number {
    return Math.floor(value + 0.5);
}

export function getRecipeDisplayEnergy(recipe: PokedayRecipe, parameter: StrengthParameter): number {
    const bonus = recipeLevelBonus[parameter.recipeLevel] ?? 0;
    return recipe.baseEnergy + roundHalfUp(recipe.baseEnergy * bonus / 100);
}

export function getRecipeFinalEnergy(recipe: PokedayRecipe, parameter: StrengthParameter): number {
    return roundHalfUp(getRecipeDisplayEnergy(recipe, parameter) * (1 + parameter.fieldBonus / 100));
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
    baseParameter?: Pick<StrengthParameter, 'event'|'fieldIndex'|'expertEffect'>;
}): StrengthParameter {
    const helpBonus = Math.max(0, Math.min(4, Math.floor(helpBonusCount))) as 0|1|2|3|4;
    return createStrengthParameter({
        period: 24,
        isEnergyAlwaysFull: true,
        tapFrequency: 'always',
        tapFrequencyAsleep: 'always',
        event: baseParameter?.event ?? 'none',
        fieldIndex: baseParameter?.fieldIndex ?? noFavoriteFieldIndex,
        expertEffect: baseParameter?.expertEffect ?? 'berry',
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
        parameter?: Pick<StrengthParameter, 'event'|'fieldIndex'|'expertEffect'>;
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
        parameter?: Pick<StrengthParameter, 'event'|'fieldIndex'|'expertEffect'>;
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
    const shouldUseEqualWeight = skillName === "Ingredient Draw S";
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

function getSkillIngredientPool(boxItem: PokemonBoxItem, skillName: string): IngredientName[] {
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
