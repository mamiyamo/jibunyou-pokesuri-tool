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
import {
    getRecipeLabel,
} from '../../../util/DailyPlanner';
import { pokedayRecipeGroups } from '../../../util/Pokeday';
import IngredientIcon from '../IngredientIcon';
import NumericInput from '../../common/NumericInput';
import {
    teamPlanNoMealRecipeName,
    TeamPlanSkillRoundingMode,
    useTeamPlanMealSettings,
} from './TeamPlanMealSettings';

const mealLabels = ['朝', '昼', '晩'] as const;

const TeamPlanMealSettingsView = React.memo(() => {
    const {
        mealRecipeNames,
        setMealRecipeNames,
        mealChoices,
        stock,
        setStock,
        skillRoundingMode,
        setSkillRoundingMode,
    } = useTeamPlanMealSettings();

    const onMealRecipeChange = React.useCallback((slot: number) => (e: SelectChangeEvent) => {
        const next = [...mealRecipeNames];
        next[slot] = e.target.value;
        setMealRecipeNames(next);
    }, [mealRecipeNames, setMealRecipeNames]);

    const onStockChange = React.useCallback((ingredientName: IngredientName, value: number) => {
        setStock(prev => ({...prev, [ingredientName]: Math.min(999, Math.max(0, value))}));
    }, [setStock]);

    const onSkillRoundingModeChange = React.useCallback((e: SelectChangeEvent) => {
        setSkillRoundingMode(e.target.value as TeamPlanSkillRoundingMode);
    }, [setSkillRoundingMode]);

    return <StyledRoot>
        <section>
            <h3>料理</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                朝・昼・晩に作る料理を選択します。
            </Typography>
            <div className="meals">
                {mealChoices.map((meal, index) => (
                    <article key={index}>
                        <Typography variant="body2" sx={{marginBottom: '.35rem', color: '#444'}}>
                            {mealLabels[index]}
                        </Typography>
                        <FormControl fullWidth size="small" variant="standard">
                            <Select value={mealRecipeNames[index] ?? meal.recipe?.name ?? teamPlanNoMealRecipeName}
                                onChange={onMealRecipeChange(index)}>
                                <MenuItem value={teamPlanNoMealRecipeName}>なし</MenuItem>
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
                    </article>
                ))}
            </div>
            <div className="skill-rounding">
                <Typography variant="body2" sx={{marginBottom: '.25rem', color: '#444'}}>
                    スキル発動期待値
                </Typography>
                <FormControl size="small" variant="standard">
                    <Select value={skillRoundingMode} onChange={onSkillRoundingModeChange}>
                        <MenuItem value="round">四捨五入</MenuItem>
                        <MenuItem value="ceil">切り上げ</MenuItem>
                        <MenuItem value="floor">切り捨て</MenuItem>
                    </Select>
                </FormControl>
                <Typography variant="body2" sx={{marginTop: '.25rem', color: '#777'}}>
                    バー上の ! 個数と編成候補の表示に使います。内部の期待値計算は小数のままです。
                </Typography>
            </div>
        </section>

        <section>
            <h3>食材備蓄</h3>
            <Typography variant="body2" sx={{marginTop: '.35rem', color: '#666'}}>
                現在持っている食材数を入力します。
            </Typography>
            <div className="stock">
                {IngredientNames.filter(name => !name.startsWith('unknown')).map(ingredientName => (
                    <label key={ingredientName}>
                        <IngredientIcon name={ingredientName}/>
                        <NumericInput
                            value={stock[ingredientName] ?? 0}
                            onChange={value => onStockChange(ingredientName, value)}
                            min={0}
                            max={999}
                            sx={{
                                width: '3.4rem',
                                '&:before, &:after': {
                                    left: 0,
                                    right: 0,
                                },
                            }}
                            inputProps={{style: {textAlign: 'right'}}}
                        />
                    </label>
                ))}
            </div>
        </section>
    </StyledRoot>;
});

const StyledRoot = styled('div')({
    margin: '0 .5rem 10rem',
    '& section': {
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '.5rem',
        marginBottom: '1rem',
        padding: '.75rem .75rem .9rem',
        '& h3': {
            margin: 0,
            fontSize: '1rem',
        },
    },
    '& .meals': {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '.75rem',
        marginTop: '.75rem',
        '& > article': {
            border: '1px solid #e2e2e2',
            borderRadius: '.4rem',
            padding: '.6rem',
        },
    },
    '& .skill-rounding': {
        marginTop: '.75rem',
        borderTop: '1px solid #eee',
        paddingTop: '.65rem',
    },
    '& .stock': {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))',
        gap: '.45rem',
        marginTop: '.75rem',
        '& > label': {
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '.35rem',
            alignItems: 'center',
            border: '1px solid #e6e6e6',
            borderRadius: '.35rem',
            padding: '.35rem .45rem',
            overflow: 'hidden',
            '& > div.numeric': {
                justifySelf: 'end',
            },
        },
    },
});

export default TeamPlanMealSettingsView;
