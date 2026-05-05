import React from 'react';
import { IngredientNames } from '../../../data/pokemons';
import {
    dailyPlannerRecipes,
    DailyPlannerIngredientStock,
    DailyPlannerMealChoice,
    getRecipeByName,
} from '../../../util/DailyPlanner';

export const teamPlanMealRecipeStorageKey = 'PstTeamPlanMealRecipes';
export const teamPlanStockStorageKey = 'PstTeamPlanStock';
const defaultTeamPlanRecipeName = 'しんりょくアボカドグラタン';
const teamPlanMealSettingsChangedEvent = 'PstTeamPlanMealSettingsChanged';

export function getDefaultTeamPlanStock(): DailyPlannerIngredientStock {
    const ret: DailyPlannerIngredientStock = {};
    for (const ingredientName of IngredientNames) {
        if (!ingredientName.startsWith('unknown')) {
            ret[ingredientName] = 0;
        }
    }
    return ret;
}

export function useTeamPlanMealSettings(): {
    mealRecipeNames: string[];
    setMealRecipeNames: React.Dispatch<React.SetStateAction<string[]>>;
    mealChoices: DailyPlannerMealChoice[];
    stock: DailyPlannerIngredientStock;
    setStock: React.Dispatch<React.SetStateAction<DailyPlannerIngredientStock>>;
} {
    const [mealRecipeNames, setMealRecipeNames] = usePersistentState<string[]>(
        teamPlanMealRecipeStorageKey,
        () => [defaultTeamPlanRecipeName, defaultTeamPlanRecipeName, defaultTeamPlanRecipeName],
    );
    const [stock, setStock] = usePersistentState<DailyPlannerIngredientStock>(
        teamPlanStockStorageKey,
        getDefaultTeamPlanStock,
    );
    const mealChoices = React.useMemo<DailyPlannerMealChoice[]>(() => {
        const normalizedNames = mealRecipeNames.length >= 3 ? mealRecipeNames.slice(0, 3) : [
            ...mealRecipeNames,
            ...new Array(3 - mealRecipeNames.length).fill(defaultTeamPlanRecipeName),
        ];
        return normalizedNames.map((recipeName, slot) => ({
            slot: slot as 0 | 1 | 2,
            recipe: getRecipeByName(recipeName) ?? dailyPlannerRecipes[0],
        }));
    }, [mealRecipeNames]);

    return {mealRecipeNames, setMealRecipeNames, mealChoices, stock, setStock};
}

function usePersistentState<T>(
    key: string,
    defaultValue: () => T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = React.useState<T>(() => {
        const stored = localStorage.getItem(key);
        if (stored === null) {
            return defaultValue();
        }
        try {
            return JSON.parse(stored) as T;
        }
        catch {
            return defaultValue();
        }
    });

    React.useEffect(() => {
        const handler = (event: Event) => {
            if (!(event instanceof CustomEvent) || event.detail?.key !== key) {
                return;
            }
            const stored = localStorage.getItem(key);
            if (stored === null) {
                return;
            }
            try {
                setValue(JSON.parse(stored) as T);
            }
            catch {
                // ignore broken stored values
            }
        };
        window.addEventListener(teamPlanMealSettingsChangedEvent, handler);
        return () => {
            window.removeEventListener(teamPlanMealSettingsChangedEvent, handler);
        };
    }, [key]);

    const setPersistentValue = React.useCallback<React.Dispatch<React.SetStateAction<T>>>((action) => {
        setValue(prev => {
            const next = typeof action === 'function' ?
                (action as (prevState: T) => T)(prev) :
                action;
            localStorage.setItem(key, JSON.stringify(next));
            window.dispatchEvent(new CustomEvent(teamPlanMealSettingsChangedEvent, {
                detail: {key},
            }));
            return next;
        });
    }, [key]);

    return [value, setPersistentValue];
}
