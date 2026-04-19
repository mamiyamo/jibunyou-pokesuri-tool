import { describe, expect, test } from 'vitest';
import { PokemonBoxItem } from './PokemonBox';
import PokemonIv from './PokemonIv';
import {
    calculateMinimumWorkDays,
    createPokedayHelpParameter,
    createPokedayHelpParameterWith,
    getDailyIngredientDetailMap,
    getIngredientBaselineDetailMap,
    ingredientBaselineSources,
} from './Pokeday';

describe('Pokeday', () => {
    test('minimum work days are optimized across multiple pokemon', () => {
        const totalDays = calculateMinimumWorkDays(
            [40, 30],
            [
                [30, 0],
                [10, 20],
            ],
        );

        expect(totalDays).toBeCloseTo(2.3333333333);
    });

    test('Hyper Cutter distributes skill ingredients across four fixed ingredients', () => {
        const boxItem = new PokemonBoxItem(new PokemonIv({
            pokemonName: 'Mawile',
            level: 30,
            ingredient: 'AAB',
        }));
        const detailMap = getDailyIngredientDetailMap(boxItem);

        expect(detailMap.potato?.skill ?? 0).toBeGreaterThan(0);
        expect(detailMap.oil?.skill ?? 0).toBeGreaterThan(0);
        expect(detailMap.tomato?.skill ?? 0).toBeGreaterThan(0);
        expect(detailMap.corn?.skill ?? 0).toBeGreaterThan(0);
        expect(detailMap.milk?.skill ?? 0).toBe(0);
    });

    test('ingredient baseline sources are fixed but counts depend on parameter', () => {
        expect(ingredientBaselineSources.oil.pokemonName).toBe('Toxicroak');

        const base = getIngredientBaselineDetailMap(createPokedayHelpParameter());
        const camp = getIngredientBaselineDetailMap(
            createPokedayHelpParameterWith({
                helpBonusCount: 0,
                baseParameter: { isGoodCampTicketSet: true },
            }),
        );

        expect((camp.milk?.total ?? 0)).toBeGreaterThan(base.milk?.total ?? 0);
        expect((camp.oil?.total ?? 0)).toBeGreaterThan(base.oil?.total ?? 0);
    });

    test('ingredient baseline pokemon config changes daily counts', () => {
        const base = getIngredientBaselineDetailMap(createPokedayHelpParameter(), {
            level: 60,
            ingredientFinderM: false,
            ingredientFinderS: false,
            helpingSpeedM: false,
            helpingSpeedS: false,
        });
        const boosted = getIngredientBaselineDetailMap(createPokedayHelpParameter(), {
            level: 60,
            ingredientFinderM: true,
            ingredientFinderS: true,
            helpingSpeedM: true,
            helpingSpeedS: true,
        });

        expect((boosted.milk?.total ?? 0)).toBeGreaterThan(base.milk?.total ?? 0);
        expect((boosted.oil?.total ?? 0)).toBeGreaterThan(base.oil?.total ?? 0);
    });
});
