import { describe, expect, test } from 'vitest';
import { PokemonBoxItem } from './PokemonBox';
import PokemonIv from './PokemonIv';
import { getDailyIngredientDetailMap } from './Pokeday';

describe('Pokeday', () => {
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
});
