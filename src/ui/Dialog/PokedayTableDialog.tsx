import React from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, FormControlLabel, MenuItem, Paper, Select,
    SelectChangeEvent, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { IngredientName } from '../../data/pokemons';
import { formatWithComma } from '../../util/NumberUtil';
import { PokemonBoxItem } from '../../util/PokemonBox';
import { StrengthParameter } from '../../util/PokemonStrength';
import { loadBoxSortConfig, sortPokemonItems } from '../../util/PokemonBoxSort';
import {
    calculateMinimumWorkDaysDetail, getDailyIngredientDetailMap, getRecipeFinalEnergy,
    pokedayRecipeGroups, PokedayIngredientDailyDetail, PokedayRecipe,
} from '../../util/Pokeday';
import { useTranslation } from 'react-i18next';
import IngredientIcon from '../IvCalc/IngredientIcon';
import PokemonIcon from '../IvCalc/PokemonIcon';

type TeamSelectionMap = Record<string, (number | '')[]>;

function recipeKey(recipe: PokedayRecipe): string {
    return `${recipe.category}:${recipe.name}`;
}

const BOX_SORT_CONFIG_CHANGED_EVENT = 'PstPokemonBoxSortConfigChanged';

function formatDays(value: number): string {
    return value.toFixed(2);
}

function formatHoursMinutesFromDays(value: number): string {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}時間${minutes}分`;
}

function formatDailyCount(value: number): string {
    return value.toFixed(1);
}

function formatDailyDetail(value: PokedayIngredientDailyDetail): string {
    return `${formatDailyCount(value.base)} + ${formatDailyCount(value.skill)}`;
}

function formatDailyTotal(value: PokedayIngredientDailyDetail): string {
    return formatDailyCount(value.total);
}

function getDisplayName(item: PokemonBoxItem, t: (key: string) => string): string {
    return item.nickname !== '' ? item.nickname : t(`pokemons.${item.iv.pokemonName}`);
}

function createPokemonTooltipText(item: PokemonBoxItem, t: (key: string) => string): string {
    const iv = item.iv;
    const skills = [
        {lv: 10, skill: iv.subSkills.lv10},
        {lv: 25, skill: iv.subSkills.lv25},
        {lv: 50, skill: iv.subSkills.lv50},
        {lv: 75, skill: iv.subSkills.lv75},
        {lv: 100, skill: iv.subSkills.lv100},
    ]
        .filter(x => x.skill !== null)
        .map(x => `Lv${x.lv}:${t(`subskill.${x.skill!.name}`)}`)
        .join(' / ');
    return [
        getDisplayName(item, t),
        `Lv.${iv.level}`,
        `スキルLv.${iv.skillLevel}`,
        `性格:${t(`natures.${iv.nature.name}`)}`,
        `食材タイプ:${iv.ingredient}`,
        `サブスキル:${skills || 'なし'}`,
    ].join('\n');
}

function getHelpingBonusHighlightSx(hasHelpingBonus: boolean) {
    return hasHelpingBonus ? {
        display: 'inline-flex',
        borderRadius: '0.5rem',
        padding: '2px',
        border: '2px solid #e0b400',
        backgroundColor: 'rgba(255, 224, 102, 0.16)',
        boxShadow: '0 0 0 1px rgba(224, 180, 0, 0.18) inset',
        lineHeight: 0,
    } : {
        display: 'inline-flex',
        borderRadius: '0.5rem',
        padding: '2px',
        border: '2px solid transparent',
        lineHeight: 0,
    };
}

const PokedayTableDialog = React.memo(({open, onClose, parameter, boxItems}: {
    open: boolean;
    onClose: () => void;
    parameter: StrengthParameter;
    boxItems: PokemonBoxItem[];
}) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [mealCount, setMealCount] = React.useState<1 | 3>(3);
    const [useHelpingBonus, setUseHelpingBonus] = React.useState(false);
    const [teamSelections, setTeamSelections] = React.useState<TeamSelectionMap>({});
    const [openSelectKey, setOpenSelectKey] = React.useState<string | null>(null);
    const [sortConfigRevision, setSortConfigRevision] = React.useState(0);
    const pokedayParameter = React.useMemo(() => ({
        event: parameter.event,
        fieldIndex: parameter.fieldIndex,
        expertEffect: parameter.expertEffect,
        useSkillPity: parameter.useSkillPity,
    }), [parameter.event, parameter.fieldIndex, parameter.expertEffect, parameter.useSkillPity]);
    const detailCacheRef = React.useRef<Map<string, Partial<Record<IngredientName, PokedayIngredientDailyDetail>>>>(
        new Map(),
    );
    React.useEffect(() => {
        detailCacheRef.current.clear();
    }, [boxItems, pokedayParameter.event, pokedayParameter.fieldIndex, pokedayParameter.expertEffect, pokedayParameter.useSkillPity]);
    React.useEffect(() => {
        const updateSortConfig = () => {
            setSortConfigRevision(value => value + 1);
        };
        const onStorage = (event: StorageEvent) => {
            if (event.key === 'PstPokemonBoxParam') {
                updateSortConfig();
            }
        };
        window.addEventListener(BOX_SORT_CONFIG_CHANGED_EVENT, updateSortConfig);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(BOX_SORT_CONFIG_CHANGED_EVENT, updateSortConfig);
            window.removeEventListener('storage', onStorage);
        };
    }, []);
    const getDetailMap = React.useCallback((boxItem: PokemonBoxItem, helpBonusCount: number) => {
        const key = `${boxItem.id}:${helpBonusCount}`;
        const cached = detailCacheRef.current.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const calculated = getDailyIngredientDetailMap(boxItem, {
            helpBonusCount,
            parameter: pokedayParameter,
        });
        detailCacheRef.current.set(key, calculated);
        return calculated;
    }, [pokedayParameter]);
    const ingredientNames = React.useMemo(() => {
        const names = new Set<IngredientName>();
        for (const group of pokedayRecipeGroups) {
            for (const recipe of group.recipes) {
                for (const ingredient of recipe.ingredients) {
                    names.add(ingredient.name);
                }
            }
        }
        return [...names];
    }, []);
    const baseDailyCountMap = React.useMemo(() => {
        const ret: Record<number, Partial<Record<IngredientName, PokedayIngredientDailyDetail>>> = {};
        for (const boxItem of boxItems) {
            const itemMap = getDetailMap(boxItem, 0);
            ret[boxItem.id] = {};
            for (const ingredientName of ingredientNames) {
                ret[boxItem.id][ingredientName] = itemMap[ingredientName] ?? {base: 0, skill: 0, total: 0};
            }
        }
        return ret;
    }, [boxItems, ingredientNames, getDetailMap]);
    const sortedBoxItems = React.useMemo(() => {
        void sortConfigRevision;
        const sortConfig = loadBoxSortConfig();
        const [sorted] = sortPokemonItems(
            boxItems,
            sortConfig.sort,
            sortConfig.descending,
            sortConfig.ingredient,
            sortConfig.mainSkill,
            parameter,
            t,
        );
        return sortConfig.descending ? sorted : [...sorted].reverse();
    }, [boxItems, parameter, t, sortConfigRevision]);

    React.useEffect(() => {
        if (!open || boxItems.length === 0) {
            return;
        }
        setTeamSelections(prev => {
            const next = {...prev};
            for (const group of pokedayRecipeGroups) {
                for (const recipe of group.recipes) {
                    const key = recipeKey(recipe);
                    if (next[key] === undefined) {
                        next[key] = ['', '', '', '', ''];
                    }
                }
            }
            return next;
        });
    }, [boxItems, baseDailyCountMap, open]);

    const onMealCountChange = React.useCallback((
        _event: React.MouseEvent<HTMLElement>,
        nextValue: 1 | 3 | null,
    ) => {
        if (nextValue !== null) {
            setMealCount(nextValue);
        }
    }, []);
    const onUseHelpingBonusChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUseHelpingBonus(e.target.checked);
    }, []);

    const onTeamSelectionChange = React.useCallback((recipeKeyText: string, index: number, value: string) => {
        setTeamSelections(prev => {
            const current = [...(prev[recipeKeyText] ?? ['', '', '', '', ''])];
            const nextValue: number | '' = value === '' ? '' : Number(value);
            current[index] = nextValue;
            return {
                ...prev,
                [recipeKeyText]: current,
            };
        });
    }, []);

    if (!open) {
        return <></>;
    }

    return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl"
        fullScreen={isSmallScreen}>
        <DialogTitle>ポケ日算</DialogTitle>
        <DialogContent dividers sx={{
            px: isSmallScreen ? 1 : 3,
            overflowX: 'hidden',
        }}>
            <Typography sx={{mb: 1}} variant="body2">
                料理の最終エナジーと、必要な食材を集めるのにかかる稼働時間を見ます。
            </Typography>
            <Typography sx={{mb: 2}} variant="body2" color="text.secondary">
                参照中の設定: レシピレベル {parameter.recipeLevel} / レシピボーナス {parameter.recipeBonus}% / フィールドボーナス {parameter.fieldBonus}%
            </Typography>
            <FormControlLabel
                control={<Switch checked={useHelpingBonus} onChange={onUseHelpingBonusChange} />}
                label="おてつだいボーナス考慮"
                sx={{display: 'flex', mb: 1}}
            />
            {pokedayRecipeGroups.map(group => (
                <Paper key={group.category} variant="outlined" sx={{
                    p: isSmallScreen ? 1 : 1.5,
                    mb: 2,
                    minWidth: 0,
                }}>
                    <Typography variant="subtitle1" sx={{mb: 1}}>{group.title}</Typography>
                    {group.recipes.map(recipe => {
                        const recipeId = recipeKey(recipe);
                        const team = teamSelections[recipeId] ?? ['', '', '', '', ''];
                        const selectedIdsInOrder = team.filter((x): x is number => x !== '');
                        const orderedBoxItems = [
                            ...selectedIdsInOrder
                                .map(id => sortedBoxItems.find(item => item.id === id))
                                .filter((item): item is PokemonBoxItem => item !== undefined),
                            ...sortedBoxItems.filter(item => !selectedIdsInOrder.includes(item.id)),
                        ];
                        const selectedTeamItems = team
                            .map(id => id === '' ? null : boxItems.find(x => x.id === id) ?? null)
                            .filter((x): x is PokemonBoxItem => x !== null);
                        const helpingBonusHolders = selectedTeamItems
                            .filter(item => item.iv.hasHelpingBonusInActiveSubSkills);
                        const baseTeamDetailMap:
                            Record<number, Partial<Record<IngredientName, PokedayIngredientDailyDetail>>> = {};
                        const selectedTeamDetailMap:
                            Record<number, Partial<Record<IngredientName, PokedayIngredientDailyDetail>>> = {};
                        for (const selectedItem of selectedTeamItems) {
                            baseTeamDetailMap[selectedItem.id] = getDetailMap(selectedItem, 0);
                            const helpBonusCount = useHelpingBonus ?
                                helpingBonusHolders.filter(x => x.id !== selectedItem.id).length :
                                0;
                            selectedTeamDetailMap[selectedItem.id] = useHelpingBonus ?
                                getDetailMap(selectedItem, helpBonusCount) :
                                baseTeamDetailMap[selectedItem.id];
                        }
                        const finalEnergy = getRecipeFinalEnergy(recipe, parameter);
                        const ingredientRows = recipe.ingredients.map(ingredient => {
                            let base = 0;
                            let skill = 0;
                            for (const selectedItem of selectedTeamItems) {
                                const detail = selectedTeamDetailMap[selectedItem.id]?.[ingredient.name];
                                base += detail?.base ?? 0;
                                skill += detail?.skill ?? 0;
                            }
                            const dailyDetail: PokedayIngredientDailyDetail = {base, skill, total: base + skill};
                            const dailyCount = dailyDetail?.total ?? 0;
                            const days = dailyCount > 0 ? ingredient.count / dailyCount : null;
                            const perPokemon = selectedTeamItems.map(item => {
                                const detail = selectedTeamDetailMap[item.id]?.[ingredient.name] ??
                                    {base: 0, skill: 0, total: 0};
                                return {item, detail};
                            });
                            return {ingredient, dailyDetail, dailyCount, days, perPokemon};
                        });
                        const baseTotalWorkDaysResult = selectedTeamItems.length === 0 ? null : calculateMinimumWorkDaysDetail(
                            recipe.ingredients.map(ingredient => ingredient.count * mealCount),
                            selectedTeamItems.map(item =>
                                recipe.ingredients.map(ingredient =>
                                    baseTeamDetailMap[item.id]?.[ingredient.name]?.total ?? 0
                                )
                            ),
                        );
                        const totalWorkDaysResult = useHelpingBonus && selectedTeamItems.length > 0 ?
                            calculateMinimumWorkDaysDetail(
                                recipe.ingredients.map(ingredient => ingredient.count * mealCount),
                                selectedTeamItems.map(item =>
                                    recipe.ingredients.map(ingredient =>
                                        selectedTeamDetailMap[item.id]?.[ingredient.name]?.total ?? 0
                                    )
                                ),
                            ) :
                            baseTotalWorkDaysResult;
                        const baseTotalWorkDays = baseTotalWorkDaysResult?.totalDays ?? null;
                        const totalWorkDays = totalWorkDaysResult?.totalDays ?? null;
                        const baseEnergyPerDay = baseTotalWorkDays === null || baseTotalWorkDays <= 0 ? null :
                            finalEnergy * mealCount / baseTotalWorkDays;
                        const energyPerDay = totalWorkDays === null || totalWorkDays <= 0 ? null :
                            finalEnergy * mealCount / totalWorkDays;
                        const contributionByPokemonId = new Map<number, number>();
                        if (baseTotalWorkDaysResult !== null && baseEnergyPerDay !== null && baseTotalWorkDays > 0) {
                            selectedTeamItems.forEach((item, index) => {
                                const workDays = baseTotalWorkDaysResult.workDaysByPokemon[index] ?? 0;
                                contributionByPokemonId.set(item.id, baseEnergyPerDay * workDays / baseTotalWorkDays);
                            });
                        }
                        else if (totalWorkDaysResult !== null && energyPerDay !== null && totalWorkDays !== null && totalWorkDays > 0) {
                            selectedTeamItems.forEach((item, index) => {
                                const workDays = totalWorkDaysResult.workDaysByPokemon[index] ?? 0;
                                contributionByPokemonId.set(item.id, energyPerDay * workDays / totalWorkDays);
                            });
                        }
                        if (useHelpingBonus &&
                            totalWorkDaysResult !== null &&
                            energyPerDay !== null &&
                            baseEnergyPerDay !== null &&
                            totalWorkDays !== null &&
                            totalWorkDays > 0 &&
                            helpingBonusHolders.length > 0) {
                            const helpingBonusGain = Math.max(0, energyPerDay - baseEnergyPerDay);
                            const helpingBonusContribution = helpingBonusGain / helpingBonusHolders.length;
                            for (const holder of helpingBonusHolders) {
                                contributionByPokemonId.set(
                                    holder.id,
                                    (contributionByPokemonId.get(holder.id) ?? 0) + helpingBonusContribution,
                                );
                            }
                        }

                        return <Accordion key={recipeKey(recipe)} disableGutters sx={{mb: 0.5}}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Stack sx={{width: '100%'}} spacing={0.5}>
                                    <Typography variant="subtitle2">{recipe.name}</Typography>
                                    <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="flex-start">
                                        <Typography variant="body2">
                                            最終エナジー: {formatWithComma(finalEnergy)}
                                        </Typography>
                                        <Box
                                            onClick={e => e.stopPropagation()}
                                            onMouseDown={e => e.stopPropagation()}
                                            onPointerDown={e => e.stopPropagation()}
                                            sx={{ml: isSmallScreen ? 0 : 1}}
                                        >
                                            <ToggleButtonGroup
                                                exclusive
                                                size="small"
                                                value={mealCount}
                                                onChange={onMealCountChange}
                                                aria-label="meal count"
                                            >
                                                <ToggleButton value={1} aria-label="1 meal">
                                                    1食
                                                </ToggleButton>
                                                <ToggleButton value={3} aria-label="3 meals">
                                                    3食
                                                </ToggleButton>
                                                </ToggleButtonGroup>
                                            </Box>
                                        <Box sx={{
                                            display: 'grid',
                                            gridTemplateColumns: isSmallScreen ? '9.2rem max-content' : '11rem max-content',
                                            columnGap: 0.75,
                                            rowGap: 0,
                                            alignItems: 'start',
                                        }}>
                                            <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                合計稼働時間:
                                            </Typography>
                                            {totalWorkDays === null ? (
                                                <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                    ー
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                    {formatDays(totalWorkDays)}日（{formatHoursMinutesFromDays(totalWorkDays)}）
                                                </Typography>
                                            )}
                                            <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                1日あたりエナジー:
                                            </Typography>
                                            {energyPerDay !== null ? (
                                                <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                    {formatWithComma(Math.round(energyPerDay))}
                                                </Typography>
                                            ) : (
                                                <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                    ー
                                                </Typography>
                                            )}
                                        </Box>
                                    </Stack>
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails sx={{pt: 0}}>
                                <Stack sx={{
                                    mb: 1,
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
                                    gap: 1,
                                }}>
                                    {team.map((value, index) => {
                                        const slotKey = `${recipeId}:slot:${index}`;
                                        const isSelectOpen = openSelectKey === slotKey;
                                        const selected = value === '' ? null : boxItems.find(x => x.id === value) ?? null;
                                        const selectedIds = team.filter((x): x is number => x !== '');
                                        return <FormControl key={`${recipeId}:slot:${index}`} variant="standard" sx={{minWidth: '11rem'}} size="small">
                                            <Select
                                                value={value === '' ? '' : value.toString()}
                                                open={isSelectOpen}
                                                onOpen={() => setOpenSelectKey(slotKey)}
                                                onClose={() => setOpenSelectKey(null)}
                                                onChange={(e: SelectChangeEvent) =>
                                                    onTeamSelectionChange(recipeId, index, e.target.value)}
                                                displayEmpty
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: {
                                                            maxHeight: '72vh',
                                                            width: 'min(96vw, 1100px)',
                                                            '& .MuiMenu-list': {
                                                                display: 'grid',
                                                                gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
                                                                gap: 0.5,
                                                                p: 0.5,
                                                            },
                                                        },
                                                    },
                                                }}
                                                renderValue={(rawValue) => {
                                                    if (rawValue === '') {
                                                        return '未選択';
                                                    }
                                                    if (selected === null) {
                                                        return '未選択';
                                                    }
                                                    const hasHelpingBonus = useHelpingBonus &&
                                                        selected.iv.hasHelpingBonusInActiveSubSkills;
                                                    return <Stack
                                                        direction={isSmallScreen ? 'column' : 'row'}
                                                        spacing={0.6}
                                                        alignItems={isSmallScreen ? 'flex-start' : 'center'}
                                                        sx={{minWidth: 0, width: '100%'}}
                                                    >
                                                        <Box sx={getHelpingBonusHighlightSx(hasHelpingBonus)}>
                                                            <Stack spacing={0} alignItems="center" sx={{minWidth: 0}}>
                                                                <Typography variant="caption" sx={{lineHeight: 1, whiteSpace: 'nowrap'}}>
                                                                    Lv.{selected.iv.level}
                                                                </Typography>
                                                                <PokemonIcon idForm={selected.iv.idForm} size={24}/>
                                                            </Stack>
                                                        </Box>
                                                        <Stack spacing={0} sx={{minWidth: 0}}>
                                                            <Typography
                                                                variant="body2"
                                                                sx={{wordBreak: 'break-word'}}
                                                                title={createPokemonTooltipText(selected, t)}
                                                            >
                                                                {getDisplayName(selected, t)}
                                                            </Typography>
                                                            {contributionByPokemonId.has(selected.id) && (
                                                                <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                    貢献度: {formatWithComma(
                                                                        Math.round(contributionByPokemonId.get(selected.id) ?? 0)
                                                                    )}
                                                                </Typography>
                                                            )}
                                                        </Stack>
                                                        <Stack
                                                            direction="row"
                                                            spacing={0.4}
                                                            alignItems="center"
                                                            flexWrap="wrap"
                                                            sx={{minWidth: 0}}
                                                        >
                                                            {recipe.ingredients.map(ingredient => {
                                                                const detail = selectedTeamDetailMap[selected.id]?.[ingredient.name] ??
                                                                    {base: 0, skill: 0, total: 0};
                                                                if (detail.total <= 0) {
                                                                    return null;
                                                                }
                                                                return <Stack
                                                                    key={`${selected.id}:${ingredient.name}`}
                                                                    direction="row"
                                                                    spacing={0.2}
                                                                    alignItems="center"
                                                                    >
                                                                        <IngredientIcon name={ingredient.name} />
                                                                        <Typography variant="caption">{formatDailyTotal(detail)}</Typography>
                                                                    </Stack>;
                                                            })}
                                                        </Stack>
                                                    </Stack>;
                                                }}
                                            >
                                                <MenuItem value="" sx={{gridColumn: '1 / -1'}}>未選択</MenuItem>
                                                {value !== '' && selected !== null && !isSelectOpen && (
                                                    <MenuItem value={value.toString()} sx={{display: 'none'}}>
                                                        {getDisplayName(selected, t)}
                                                    </MenuItem>
                                                )}
                                                {isSelectOpen && orderedBoxItems.map(item => {
                                                    const isUsedByOther = selectedIds.includes(item.id) && item.id !== value;
                                                    const hasHelpingBonus = useHelpingBonus &&
                                                        item.iv.hasHelpingBonusInActiveSubSkills;
                                                    return <MenuItem key={item.id} value={item.id.toString()} disabled={isUsedByOther}>
                                                        <Stack direction="row" spacing={0.8} alignItems="center">
                                                            <Box sx={getHelpingBonusHighlightSx(hasHelpingBonus)}>
                                                                <Stack spacing={0} alignItems="center" sx={{minWidth: 0}}>
                                                                    <Typography variant="caption" sx={{lineHeight: 1, whiteSpace: 'nowrap'}}>
                                                                        Lv.{item.iv.level}
                                                                    </Typography>
                                                                    <PokemonIcon idForm={item.iv.idForm} size={24}/>
                                                                </Stack>
                                                            </Box>
                                                            <Stack spacing={0} sx={{minWidth: 0}}>
                                                                <Typography
                                                                    variant="body2"
                                                                    title={createPokemonTooltipText(item, t)}
                                                                >
                                                                    {getDisplayName(item, t)}
                                                                </Typography>
                                                                {contributionByPokemonId.has(item.id) && (
                                                                    <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                        貢献度: {formatWithComma(
                                                                            Math.round(contributionByPokemonId.get(item.id) ?? 0)
                                                                        )}
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                            <Stack direction="row" spacing={0.4} alignItems="center" flexWrap="wrap">
                                                                {recipe.ingredients.map(ingredient => {
                                                                    const detail = baseDailyCountMap[item.id]?.[ingredient.name] ??
                                                                        {base: 0, skill: 0, total: 0};
                                                                    if (detail.total <= 0) {
                                                                        return null;
                                                                    }
                                                                    return <Stack
                                                                        key={`${item.id}:${ingredient.name}`}
                                                                        direction="row"
                                                                        spacing={0.2}
                                                                        alignItems="center"
                                                                    >
                                                                        <IngredientIcon name={ingredient.name} />
                                                                        <Typography variant="caption">{formatDailyTotal(detail)}</Typography>
                                                                    </Stack>;
                                                                })}
                                                            </Stack>
                                                        </Stack>
                                                    </MenuItem>;
                                                })}
                                            </Select>
                                        </FormControl>;
                                    })}
                                </Stack>
                                <TableContainer sx={{
                                    overflowX: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    maxWidth: '100%',
                                }}>
                                    <Table size="small" sx={{
                                        width: isSmallScreen ? 'fit-content' : '100%',
                                        minWidth: isSmallScreen ? 0 : '100%',
                                        tableLayout: isSmallScreen ? 'fixed' : 'auto',
                                    }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{
                                                    px: isSmallScreen ? 0 : 2,
                                                    pl: isSmallScreen ? 0 : 2,
                                                    pr: isSmallScreen ? 0.25 : 2,
                                                    width: isSmallScreen ? 30 : 'auto',
                                                }}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        食材
                                                    </Typography>
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        px: isSmallScreen ? 0 : 2,
                                                        pl: isSmallScreen ? 0.1 : 2,
                                                        pr: isSmallScreen ? 0.1 : 2,
                                                        width: isSmallScreen ? 40 : 'auto',
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        必要数
                                                    </Typography>
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        px: isSmallScreen ? 0.1 : 2,
                                                        width: isSmallScreen ? 150 : 'auto',
                                                    }}
                                                >
                                                    <Stack spacing={0} sx={{lineHeight: 1}}>
                                                        <Typography variant="caption" sx={{lineHeight: 1}}>
                                                            24h個数
                                                        </Typography>
                                                        <Typography variant="caption" sx={{lineHeight: 1}}>
                                                            (食材+スキル)
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        px: isSmallScreen ? 0.1 : 2,
                                                        width: isSmallScreen ? 70 : 'auto',
                                                    }}
                                                >
                                                    <Stack spacing={0} alignItems="flex-end">
                                                        <Typography variant="caption" sx={{lineHeight: 1}}>
                                                            必要日数
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {ingredientRows.map(row => <TableRow key={`${recipeId}:${row.ingredient.name}`}>
                                                <TableCell sx={{
                                                    px: isSmallScreen ? 0 : 2,
                                                    pl: isSmallScreen ? 0 : 2,
                                                    pr: isSmallScreen ? 0.25 : 2,
                                                    width: isSmallScreen ? 24 : 'auto',
                                                }}>
                                                    <IngredientIcon name={row.ingredient.name} />
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        px: isSmallScreen ? 0 : 2,
                                                        pl: isSmallScreen ? 0.1 : 2,
                                                        pr: isSmallScreen ? 0.1 : 2,
                                                        width: isSmallScreen ? 36 : 'auto',
                                                    }}
                                                >
                                                    {formatWithComma(row.ingredient.count)}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        px: isSmallScreen ? 0.1 : 2,
                                                        width: isSmallScreen ? 72 : 'auto',
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {selectedTeamItems.length === 0 || row.dailyCount <= 0 ?
                                                        'ー' :
                                                        <Stack spacing={0} alignItems="flex-end" sx={{minWidth: 0, overflow: 'hidden'}}>
                                                            {row.perPokemon.map(({item, detail}) => {
                                                                if (detail.total <= 0) {
                                                                    return null;
                                                                }
                                                                return <Stack
                                                                    key={`${recipeId}:${row.ingredient.name}:${item.id}`}
                                                                    direction="row"
                                                                    spacing={0.1}
                                                                    alignItems="center"
                                                                    sx={{minWidth: 0}}
                                                                >
                                                                    <PokemonIcon idForm={item.iv.idForm} size={16}/>
                                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                        {formatDailyDetail(detail)}
                                                                    </Typography>
                                                                </Stack>;
                                                            })}
                                                            <Typography variant="caption" sx={{fontWeight: 'bold', lineHeight: 1}}>
                                                                合計 {formatDailyTotal(row.dailyDetail)}
                                                            </Typography>
                                                        </Stack>}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        px: isSmallScreen ? 0.1 : 2,
                                                        width: isSmallScreen ? 52 : 'auto',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {row.days === null ? 'ー' : (
                                                        <Stack spacing={0} alignItems="flex-end">
                                                            <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                {formatDays(row.days)}日
                                                            </Typography>
                                                            <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                {formatHoursMinutesFromDays(row.days)}
                                                            </Typography>
                                                        </Stack>
                                                    )}
                                                </TableCell>
                                            </TableRow>)}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </AccordionDetails>
                        </Accordion>;
                    })}
                </Paper>
            ))}
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>閉じる</Button>
        </DialogActions>
    </Dialog>;
});

export default PokedayTableDialog;
