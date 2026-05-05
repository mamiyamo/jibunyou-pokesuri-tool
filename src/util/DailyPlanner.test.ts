import { describe, expect, test } from 'vitest';
import { PokemonBoxItem } from './PokemonBox';
import PokemonIv from './PokemonIv';
import {
    calculateDailyPlannerResult,
    calculatePokemonDailySummary,
    calculateDailyTeamAllocationResult,
    getDefaultDailyPlannerMeals,
} from './DailyPlanner';
import { createStrengthParameter } from './PokemonStrength';
import SubSkill from './SubSkill';
import SubSkillList from './SubSkillList';

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

    test('team allocation uses at most ten candidates and caps each pokemon at one day', () => {
        const items = [
            'Raichu',
            'Mawile',
            'Bulbasaur',
            'Charizard',
            'Blastoise',
            'Venusaur',
            'Gengar',
            'Typhlosion',
            'Feraligatr',
            'Meganium',
            'Walrein',
        ].map(name => new PokemonBoxItem(new PokemonIv({ pokemonName: name, level: 50 })));
        const parameter = createStrengthParameter({});
        const result = calculateDailyTeamAllocationResult(items, parameter, getDefaultDailyPlannerMeals(), {});

        expect(result.candidates.length).toBeLessThanOrEqual(10);
        expect(result.totalTeamHours).toBeLessThanOrEqual(24 * 5);
        expect(result.candidates.every(member => member.totalHours <= 24)).toBe(true);
    });

    test('team allocation fills remaining slots with berry-efficient candidates', () => {
        const items = [
            'Raichu',
            'Mawile',
            'Bulbasaur',
            'Charizard',
            'Blastoise',
            'Venusaur',
        ].map(name => new PokemonBoxItem(new PokemonIv({ pokemonName: name, level: 50 })));
        const parameter = createStrengthParameter({});
        const result = calculateDailyTeamAllocationResult(items, parameter, getDefaultDailyPlannerMeals(), {});

        expect(result.totalTeamHours).toBeCloseTo(24 * 5, 6);
        expect(result.candidates.some(member => member.berryEnergy > 0 && member.workHours > 0)).toBe(true);
    });

    test('team allocation counts berries and berry energy during food collection hours', () => {
        const items = [
            new PokemonBoxItem(new PokemonIv({ pokemonName: 'Bulbasaur', level: 50 })),
            new PokemonBoxItem(new PokemonIv({ pokemonName: 'Raichu', level: 50 })),
        ];
        const parameter = createStrengthParameter({});
        const result = calculateDailyTeamAllocationResult(items, parameter, getDefaultDailyPlannerMeals(), {});
        const workingMember = result.candidates.find(member => member.workHours > 0);

        expect(workingMember).toBeDefined();
        expect(workingMember!.berryCount).toBeGreaterThan(0);
        expect(workingMember!.berryEnergy).toBeGreaterThan(0);
        expect(result.totalBerryCount).toBeCloseTo(
            result.candidates.reduce((sum, member) => sum + member.berryCount, 0),
            6,
        );
        expect(result.totalBerryEnergy).toBeCloseTo(
            result.candidates.reduce((sum, member) => sum + member.berryEnergy, 0),
            6,
        );
    });

    test('plus skill keeps fixed ingredient visible and gates random ingredients by plus/minus teammate', () => {
        const plusle = new PokemonBoxItem(new PokemonIv({ pokemonName: 'Plusle', level: 50 }));
        const parameter = createStrengthParameter({});
        const withoutPartner = calculatePokemonDailySummary(plusle, parameter, 0, {
            hasOtherPlusMinus: false,
        });
        const withPartner = calculatePokemonDailySummary(plusle, parameter, 0, {
            hasOtherPlusMinus: true,
        });

        expect(withoutPartner.ingredientCounts.coffee).toBeGreaterThan(0);
        expect(Object.values(withoutPartner.randomIngredientCounts).reduce((sum, value) => sum + value, 0))
            .toBe(0);
        expect(Object.values(withPartner.randomIngredientCounts).reduce((sum, value) => sum + value, 0))
            .toBeGreaterThan(0);
    });

    test('team allocation uses actual helping bonus sub-skills instead of parameter count', () => {
        const raichu = new PokemonBoxItem(new PokemonIv({ pokemonName: 'Raichu', level: 50 }));
        const supportBulbasaur = new PokemonBoxItem(new PokemonIv({
            pokemonName: 'Bulbasaur',
            level: 50,
            subSkills: new SubSkillList({ lv10: new SubSkill('Helping Bonus') }),
        }));
        const normalBulbasaur = new PokemonBoxItem(new PokemonIv({ pokemonName: 'Bulbasaur', level: 50 }));
        const parameter = createStrengthParameter({ helpBonusCount: 4 });
        const withActualBonus = calculateDailyTeamAllocationResult(
            [raichu, supportBulbasaur],
            parameter,
            getDefaultDailyPlannerMeals(),
            {},
        );
        const withoutActualBonus = calculateDailyTeamAllocationResult(
            [raichu, normalBulbasaur],
            parameter,
            getDefaultDailyPlannerMeals(),
            {},
        );

        expect(withActualBonus.candidates[0].berryEnergy).toBeGreaterThan(
            withoutActualBonus.candidates[0].berryEnergy,
        );
    });
});
