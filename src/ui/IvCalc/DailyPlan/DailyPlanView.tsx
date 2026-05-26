import React from 'react';
import { styled } from '@mui/system';
import {
    FormControl,
    ListSubheader,
    MenuItem,
    Select,
    SelectChangeEvent,
    Typography,
} from '@mui/material';
import { IngredientName, IngredientNames } from '../../../data/pokemons';
import NumericInput from '../../common/NumericInput';
import IngredientIcon from '../IngredientIcon';
import PokemonIcon from '../PokemonIcon';
import { PokemonBoxItem } from '../../../util/PokemonBox';
import { StrengthParameter } from '../../../util/PokemonStrength';
import {
    calculateDailyPlannerCarryoverOptimization,
    calculateDailyPlannerResult,
    dailyPlannerRecipes,
    DailyPlannerIngredientStock,
    DailyPlannerMealChoice,
    getDefaultDailyPlannerMeals,
    getRecipeByName,
    getRecipeLabel,
} from '../../../util/DailyPlanner';
import { pokedayRecipeGroups } from '../../../util/Pokeday';
import { formatWithComma, round1 } from '../../../util/NumberUtil';
import { useTranslation } from 'react-i18next';

const StyledRoot = styled('div')({
    padding: '0 .5rem 10rem .5rem',
    '& section': {
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '.5rem',
        marginBottom: '1rem',
        padding: '.75rem .75rem .9rem .75rem',
    },
    '& h3': {
        margin: 0,
        fontSize: '1rem',
    },
});

const recipeSlotLabels = ['6:00', '12:00', '18:00'] as const;

const DailyPlanView = React.memo(({items, parameter}: {
    items: PokemonBoxItem[],
    parameter: StrengthParameter,
}) => {
    const { t } = useTranslation();
    const [mealRecipeNames, setMealRecipeNames] = usePersistentState<string[]>(
        'PstDailyPlanMealRecipes',
        () => getDefaultDailyPlannerMeals().map(x => x.recipe.name),
    );
    const [stock, setStock] = usePersistentState<DailyPlannerIngredientStock>('PstDailyPlanStock', () => {
        const ret: DailyPlannerIngredientStock = {};
        for (const ingredientName of IngredientNames) {
            if (ingredientName.startsWith('unknown')) {
                continue;
            }
            ret[ingredientName] = 0;
        }
        return ret;
    });

    const mealChoices = React.useMemo<DailyPlannerMealChoice[]>(() => {
        return mealRecipeNames.map((recipeName, slot) => ({
            slot: slot as 0 | 1 | 2,
            recipe: getRecipeByName(recipeName) ?? dailyPlannerRecipes[0],
        }));
    }, [mealRecipeNames]);

    const result = React.useMemo(() => {
        return calculateDailyPlannerResult(items, parameter, mealChoices, stock);
    }, [items, mealChoices, parameter, stock]);

    const carryoverOptimization = React.useMemo(() => {
        return calculateDailyPlannerCarryoverOptimization(items, parameter, 800);
    }, [items, parameter]);

    const selectedIngredientSupply = React.useMemo(() => {
        const ret: Partial<Record<IngredientName, number>> = {};
        for (const summary of result.selectedSummaries) {
            for (const ingredientName of IngredientNames) {
                const value = summary.ingredientCounts[ingredientName] ?? 0;
                if (value <= 0) {
                    continue;
                }
                ret[ingredientName] = (ret[ingredientName] ?? 0) + value;
            }
        }
        return ret;
    }, [result.selectedSummaries]);

    const onMealRecipeChange = React.useCallback((slot: number) => (e: SelectChangeEvent) => {
        const next = [...mealRecipeNames];
        next[slot] = e.target.value;
        setMealRecipeNames(next);
    }, [mealRecipeNames, setMealRecipeNames]);

    const onStockChange = React.useCallback((ingredientName: IngredientName, value: number) => {
        setStock(prev => ({...prev, [ingredientName]: value}));
    }, [setStock]);

    return <StyledRoot>
        <section>
            <h3>料理設定</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                6:00 / 12:00 / 18:00 の3回分を指定します。
            </Typography>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '.75rem',
                marginTop: '.75rem',
            }}>
                {mealChoices.map((meal, index) => (
                    <div key={index} style={{
                        border: '1px solid #e2e2e2',
                        borderRadius: '.4rem',
                        padding: '.6rem',
                    }}>
                        <Typography variant="body2" sx={{marginBottom: '.35rem', color: '#444'}}>
                            {recipeSlotLabels[index]}
                        </Typography>
                        <FormControl fullWidth size="small" variant="standard">
                            <Select value={mealRecipeNames[index]} onChange={onMealRecipeChange(index)}>
                                {pokedayRecipeGroups.map(group => [
                                    <ListSubheader key={`${group.category}-header-${index}`}>
                                        {group.title}
                                    </ListSubheader>,
                                    ...group.recipes.map(recipe => (
                                        <MenuItem key={`${group.category}-${recipe.name}`} value={recipe.name}>
                                            {recipe.title}
                                        </MenuItem>
                                    )),
                                ])}
                            </Select>
                        </FormControl>
                        <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                            {getRecipeLabel(meal.recipe)}
                        </Typography>
                    </div>
                ))}
            </div>
        </section>

        <section>
            <h3>在庫</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                0〜999 の範囲で初期食材を設定します。
            </Typography>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '.5rem',
                marginTop: '.75rem',
            }}>
                {IngredientNames.filter(name => !name.startsWith('unknown')).map(ingredientName => (
                    <div key={ingredientName} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '.45rem',
                        border: '1px solid #e6e6e6',
                        borderRadius: '.35rem',
                        padding: '.35rem .5rem',
                    }}>
                        <IngredientIcon name={ingredientName}/>
                        <Typography variant="body2" sx={{minWidth: '4rem'}}>
                            {ingredientName}
                        </Typography>
                        <NumericInput
                            value={stock[ingredientName] ?? 0}
                            onChange={value => onStockChange(ingredientName, Math.min(999, Math.max(0, value)))}
                            min={0}
                            max={999}
                            sx={{width: '4.5rem'}}
                            inputProps={{style: {textAlign: 'right'}}}
                        />
                    </div>
                ))}
            </div>
        </section>

        <section>
            <h3>時間帯プラン</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                6:00 / 12:00 / 18:00 の料理に合わせて、4つの時間帯でパーティを切り替えます。
            </Typography>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '.75rem',
                marginTop: '.75rem',
            }}>
                {result.phases.map(phase => (
                    <div key={`${phase.slot}-${phase.startHour}`} style={{
                        border: '1px solid #e2e2e2',
                        borderRadius: '.45rem',
                        padding: '.6rem',
                    }}>
                        <Typography variant="body2" sx={{fontWeight: 600}}>
                            {phase.startHour}:00 - {phase.endHour}:00
                        </Typography>
                        <Typography variant="body2" sx={{color: '#666', marginTop: '.15rem'}}>
                            {phase.meal === null ? '食事なし' : getRecipeLabel(phase.meal)}
                        </Typography>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '.35rem .5rem',
                            marginTop: '.5rem',
                        }}>
                            <InfoBlock label="きのみ" value={formatWithComma(Math.round(phase.totalBerryEnergy))}/>
                            <InfoBlock label="料理" value={formatWithComma(Math.round(phase.totalMealEnergy))}/>
                            <InfoBlock label="スキル" value={formatWithComma(Math.round(phase.totalSkillEnergy))}/>
                            <InfoBlock label="合計" value={formatWithComma(Math.round(phase.totalExpectedEnergy))}/>
                        </div>
                        <div style={{marginTop: '.5rem', display: 'grid', gap: '.35rem'}}>
                            {phase.selectedSummaries.length === 0 ? (
                                <Typography variant="body2" sx={{color: '#888'}}>
                                    編成候補なし
                                </Typography>
                            ) : phase.selectedSummaries.map(summary => (
                                <div key={summary.item.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'auto 1fr',
                                    gap: '.5rem',
                                    alignItems: 'center',
                                }}>
                                    <PokemonIcon idForm={summary.item.iv.idForm} size={32} shiny={summary.item.iv.shiny}/>
                                    <Typography variant="body2" sx={{lineHeight: 1.25}}>
                                        {summary.item.filledNickname(t)}
                                        <br/>
                                        <span style={{color: '#666'}}>
                                            きのみ {formatWithComma(Math.round(summary.berryEnergy))} / 料理 {formatWithComma(Math.round(summary.mealEnergy))} / スキル {formatWithComma(Math.round(summary.skillEnergy))}
                                        </span>
                                    </Typography>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>

        <section>
            <h3>1日集計</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                期待エナジー = きのみエナジー + 料理エナジー + スキルエナジー。
            </Typography>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '.6rem',
                marginTop: '.75rem',
            }}>
                <InfoBlock label="きのみエナジー" value={formatWithComma(Math.round(result.totalBerryEnergy))}/>
                <InfoBlock label="料理エナジー" value={formatWithComma(Math.round(result.totalMealEnergy))}/>
                <InfoBlock label="スキルエナジー" value={formatWithComma(Math.round(result.totalSkillEnergy))}/>
                <InfoBlock label="期待総エナジー" value={formatWithComma(Math.round(result.totalExpectedEnergy))}/>
                <InfoBlock label="食材不足" value={result.isDemandSatisfied ? 'なし' : 'あり'}/>
            </div>
            <div style={{marginTop: '.75rem', display: 'grid', gap: '.45rem'}}>
                {result.selectedSummaries.length === 0 ? (
                    <Typography variant="body2" sx={{color: '#888'}}>
                        ボックスにポケモンがいません。
                    </Typography>
                ) : result.selectedSummaries.map(summary => (
                    <div key={summary.item.id} style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: '.65rem',
                        alignItems: 'center',
                        border: '1px solid #e6e6e6',
                        borderRadius: '.45rem',
                        padding: '.5rem .65rem',
                    }}>
                        <PokemonIcon idForm={summary.item.iv.idForm} size={42} shiny={summary.item.iv.shiny}/>
                        <div>
                            <div style={{fontWeight: 600}}>
                                {summary.item.filledNickname(t)}
                            </div>
                            <Typography variant="body2" sx={{color: '#666'}}>
                                {summary.item.iv.pokemon.name} ・ {summary.item.iv.pokemon.skill}
                            </Typography>
                            <Typography variant="body2" sx={{color: '#666'}}>
                                きのみ {formatWithComma(Math.round(summary.berryEnergy))} / 料理 {formatWithComma(Math.round(summary.mealEnergy))} / スキル {formatWithComma(Math.round(summary.skillEnergy))}
                            </Typography>
                        </div>
                        <Typography variant="body2" sx={{fontWeight: 600}}>
                            {formatWithComma(Math.round(summary.totalEnergy))}
                        </Typography>
                    </div>
                ))}
            </div>
        </section>

        <section>
            <h3>食材内訳</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                需要 / 在庫 / 供給 / 残り をまとめて確認できます。
            </Typography>
            <div style={{
                overflowX: 'auto',
                marginTop: '.75rem',
            }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '.9rem',
                }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>食材</th>
                            <th style={thStyle}>需要</th>
                            <th style={thStyle}>在庫</th>
                            <th style={thStyle}>供給</th>
                            <th style={thStyle}>残り</th>
                        </tr>
                    </thead>
                    <tbody>
                        {IngredientNames.filter(name => !name.startsWith('unknown')).map(ingredientName => {
                            const demand = result.demand[ingredientName] ?? 0;
                            const stockValue = result.stock[ingredientName] ?? 0;
                            const supply = selectedIngredientSupply[ingredientName] ?? 0;
                            const remaining = Math.max(0, demand - stockValue - supply);
                            return <tr key={ingredientName}>
                                <td style={tdStyle}>
                                    <span style={{display: 'inline-flex', alignItems: 'center', gap: '.35rem'}}>
                                        <IngredientIcon name={ingredientName}/>
                                        {ingredientName}
                                    </span>
                                </td>
                                <td style={tdStyle}>{Math.round(demand)}</td>
                                <td style={tdStyle}>{Math.round(stockValue)}</td>
                                <td style={tdStyle}>{round1(supply)}</td>
                                <td style={tdStyle}>{round1(remaining)}</td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
        </section>

        <section>
            <h3>次週持ち越し最適化</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                来週の料理ジャンルが未確定でも使いやすいように、食材バッグ800個を3ジャンル共通で効きやすい食材から選びます。効率は「料理エナジー ÷ 必要稼働日数」です。
            </Typography>
            {carryoverOptimization.bestRecipes.length === 0 ? (
                <Typography variant="body2" sx={{marginTop: '.75rem', color: '#888'}}>
                    編成候補がないため計算できません。
                </Typography>
            ) : (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '.75rem',
                        marginTop: '.75rem',
                    }}>
                        {carryoverOptimization.bestRecipes.map(recipePlan => (
                            <div key={recipePlan.category} style={{
                                border: '1px solid #e2e2e2',
                                borderRadius: '.45rem',
                                padding: '.65rem',
                            }}>
                                <Typography variant="body2" sx={{fontWeight: 700}}>
                                    {recipePlan.categoryTitle}
                                </Typography>
                                <Typography variant="body2" sx={{marginTop: '.2rem'}}>
                                    {recipePlan.recipe.title}
                                </Typography>
                                <Typography variant="body2" sx={{marginTop: '.2rem', color: '#666'}}>
                                    稼働 {round1(recipePlan.totalWorkDays)}日 / 料理 {formatWithComma(Math.round(recipePlan.mealEnergy))} / 効率 {formatWithComma(Math.round(recipePlan.efficiency))}
                                </Typography>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '.35rem',
                                    marginTop: '.45rem',
                                }}>
                                    {recipePlan.recipe.ingredients.map(ingredient => (
                                        <span key={ingredient.name} style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '.2rem',
                                            border: '1px solid #eee',
                                            borderRadius: '999px',
                                            padding: '.1rem .45rem',
                                            fontSize: '.85rem',
                                        }}>
                                            <IngredientIcon name={ingredient.name}/>
                                            x{ingredient.count}
                                        </span>
                                    ))}
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gap: '.3rem',
                                    marginTop: '.55rem',
                                }}>
                                    {recipePlan.selectedSummaries.map((summary, index) => (
                                        <div key={summary.item.id} style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'auto 1fr auto',
                                            alignItems: 'center',
                                            gap: '.45rem',
                                        }}>
                                            <PokemonIcon idForm={summary.item.iv.idForm} size={30} shiny={summary.item.iv.shiny}/>
                                            <Typography variant="body2" sx={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                {summary.item.filledNickname(t)}
                                            </Typography>
                                            <Typography variant="body2" sx={{color: '#666'}}>
                                                {round1(recipePlan.workDaysByPokemon[index] ?? 0)}日
                                            </Typography>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{
                        border: '1px solid #e2e2e2',
                        borderRadius: '.45rem',
                        padding: '.65rem',
                        marginTop: '.75rem',
                    }}>
                        <Typography variant="body2" sx={{fontWeight: 700}}>
                            推奨持ち越し配分（合計 {carryoverOptimization.capacity}個）
                        </Typography>
                        <Typography variant="body2" sx={{marginTop: '.25rem', color: '#666'}}>
                            各ジャンルの最効率レシピを週21食作る想定で、どのジャンルでもカバー率が落ちにくい食材を優先しています。
                        </Typography>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '.5rem',
                            marginTop: '.5rem',
                        }}>
                            {carryoverOptimization.categoryPlans.map(plan => (
                                <Typography key={plan.category} variant="body2" sx={{
                                    border: '1px solid #eee',
                                    borderRadius: '.35rem',
                                    padding: '.4rem .5rem',
                                }}>
                                    {plan.categoryTitle}: 対応 {plan.capacity}個 / 約{round1(plan.estimatedServings)}食分 / {round1(plan.coverageRate * 100)}%
                                </Typography>
                            ))}
                        </div>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '.4rem',
                            marginTop: '.6rem',
                        }}>
                            {carryoverOptimization.ingredientPlans.map(plan => (
                                <span key={plan.ingredientName} style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '.25rem',
                                    border: '1px solid #e6e6e6',
                                    borderRadius: '999px',
                                    padding: '.2rem .5rem',
                                    background: '#fafafa',
                                }}>
                                    <IngredientIcon name={plan.ingredientName}/>
                                    {plan.count}
                                </span>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </section>
    </StyledRoot>;
});

const InfoBlock = React.memo(({label, value}: {label: string; value: string}) => {
    return <div style={{
        border: '1px solid #e6e6e6',
        borderRadius: '.4rem',
        padding: '.55rem .6rem',
    }}>
        <Typography variant="body2" sx={{color: '#666'}}>{label}</Typography>
        <Typography variant="h6" sx={{fontSize: '1.05rem', lineHeight: 1.2}}>{value}</Typography>
    </div>;
});

const thStyle: React.CSSProperties = {
    borderBottom: '1px solid #ddd',
    textAlign: 'right',
    padding: '.35rem .45rem',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    borderBottom: '1px solid #eee',
    textAlign: 'right',
    padding: '.35rem .45rem',
    whiteSpace: 'nowrap',
};

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
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
}

export default DailyPlanView;
