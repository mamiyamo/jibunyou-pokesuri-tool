import { describe, expect, test } from 'vitest';
import { PokemonBoxItem } from './PokemonBox';
import PokemonIv from './PokemonIv';
import { calculateDailyPlannerResult, getDefaultDailyPlannerMeals } from './DailyPlanner';
import { createStrengthParameter } from './PokemonStrength';

describe('DailyPlanner', () => {
    test('energy breakdown sums to total expected energy', () => {
        const items = [
            new PokemonBoxItem(new PokemonIv({ pokemonName: 'Raichu', level: 50 })),
            new PokemonBoxItem(new PokemonIv({ pokemonName: 'Mawile', level: 50 })),
            new PokemonBoxItem(new PokemonIv({ pokemonName: 'Bulbasaur', level: 50 })),
        ];
        const parameter = createStrengthParameter({});
        const result = calculateDailyPlannerResult(items, parameter, getDefaultDailyPlannerMeals(), {});

        const totalFromSummaries = result.selectedSummaries.reduce((sum, summary) =>
            sum + summary.totalEnergy, 0);

        expect(totalFromSummaries).toBeCloseTo(result.totalExpectedEnergy, 6);
        expect(result.selectedSummaries.every(summary =>
            Math.abs(summary.totalEnergy -
                (summary.berryEnergy + summary.mealEnergy + summary.skillEnergy)) < 1e-6
        )).toBe(true);
    });
});
