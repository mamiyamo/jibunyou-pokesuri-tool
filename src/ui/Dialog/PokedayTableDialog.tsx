import React from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, FormControlLabel, MenuItem, Paper, Select,
    SelectChangeEvent, Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography,
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
    getIngredientBaselineDetailMaps, ingredientBaselineSources, pokedayRecipeGroups,
    PokedayIngredientDailyDetail, PokedayRecipe,
} from '../../util/Pokeday';
import { useTranslation } from 'react-i18next';
import IngredientIcon from '../IvCalc/IngredientIcon';
import PokemonIcon from '../IvCalc/PokemonIcon';

type TeamSelectionMap = Record<string, (number | '')[]>;
const PARTY_COUNT = 5;

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

function formatPercentDelta(current: number | null, baseline: number | null): string | null {
    if (current === null || baseline === null || baseline <= 0) {
        return null;
    }
    const delta = (current - baseline) / baseline * 100;
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`;
}

function formatPercentAcceleration(current: number | null, baseline: number | null): string | null {
    if (current === null || baseline === null || current <= 0 || baseline <= 0) {
        return null;
    }
    const delta = (baseline / current - 1) * 100;
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`;
}

function formatWorkDays(value: number): string {
    return `${formatDays(value)}日（${formatHoursMinutesFromDays(value)}）`;
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
    const [activePartyIndex, setActivePartyIndex] = React.useState(0);
    const [partySelections, setPartySelections] = React.useState<TeamSelectionMap[]>(
        () => Array.from({length: PARTY_COUNT}, () => ({})),
    );
    const [openSelectKey, setOpenSelectKey] = React.useState<string | null>(null);
    const [sortConfigRevision, setSortConfigRevision] = React.useState(0);
    const pokedayParameter = React.useMemo(() => ({
        event: parameter.event,
        fieldIndex: parameter.fieldIndex,
        expertEffect: parameter.expertEffect,
        useSkillPity: parameter.useSkillPity,
        isGoodCampTicketSet: parameter.isGoodCampTicketSet,
        isEnergyAlwaysFull: parameter.isEnergyAlwaysFull,
        sleepScore: parameter.sleepScore,
        tapFrequency: parameter.tapFrequency,
        tapFrequencyAsleep: parameter.tapFrequencyAsleep,
    }), [
        parameter.event,
        parameter.fieldIndex,
        parameter.expertEffect,
        parameter.useSkillPity,
        parameter.isGoodCampTicketSet,
        parameter.isEnergyAlwaysFull,
        parameter.sleepScore,
        parameter.tapFrequency,
        parameter.tapFrequencyAsleep,
    ]);
    const detailCacheRef = React.useRef<Map<string, Partial<Record<IngredientName, PokedayIngredientDailyDetail>>>>(
        new Map(),
    );
    React.useEffect(() => {
        detailCacheRef.current.clear();
    }, [
        boxItems,
        pokedayParameter.event,
        pokedayParameter.fieldIndex,
        pokedayParameter.expertEffect,
        pokedayParameter.useSkillPity,
        pokedayParameter.isGoodCampTicketSet,
        pokedayParameter.isEnergyAlwaysFull,
        pokedayParameter.sleepScore,
        pokedayParameter.tapFrequency,
        pokedayParameter.tapFrequencyAsleep,
    ]);
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
    const ingredientBaselineDetailMaps = React.useMemo(() => (
        getIngredientBaselineDetailMaps(pokedayParameter, ingredientNames)
    ), [ingredientNames, pokedayParameter]);
    const eventLabel = parameter.event === 'none' ? 'なし' : t(`events.${parameter.event}`);
    const fieldLabel = t(`area.${parameter.fieldIndex}`);
    const energySettingLabel = parameter.isEnergyAlwaysFull
        ? '常に80%固定'
        : `設定通り(${parameter.sleepScore}%)`;
    const tapSettingLabel = `起床 ${parameter.tapFrequency === 'always' ? '毎分' : 'なし'} / 睡眠 ${parameter.tapFrequencyAsleep === 'always' ? '毎分' : 'なし'}`;
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

    const ensurePartySelections = React.useCallback((source: TeamSelectionMap[]) => {
        return Array.from({length: PARTY_COUNT}, (_, index) => {
            const current = source[index] ?? {};
            const next: TeamSelectionMap = {...current};
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
    }, []);

    React.useEffect(() => {
        if (!open || boxItems.length === 0) {
            return;
        }
        setPartySelections(prev => ensurePartySelections(prev));
    }, [boxItems, ensurePartySelections, open]);

    const activeTeamSelections = partySelections[activePartyIndex] ?? {};

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
    const onPartyChange = React.useCallback((_: React.SyntheticEvent, nextValue: number) => {
        setActivePartyIndex(nextValue);
        setOpenSelectKey(null);
    }, []);

    const onTeamSelectionChange = React.useCallback((recipeKeyText: string, index: number, value: string) => {
        setPartySelections(prev => {
            const next = [...prev];
            const currentParty = {...(next[activePartyIndex] ?? {})};
            const current = [...(currentParty[recipeKeyText] ?? ['', '', '', '', ''])];
            const nextValue: number | '' = value === '' ? '' : Number(value);
            current[index] = nextValue;
            currentParty[recipeKeyText] = current;
            next[activePartyIndex] = currentParty;
            return next;
        });
    }, [activePartyIndex]);

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
                参照中の設定: フィールド {fieldLabel} / レシピレベル {parameter.recipeLevel} / レシピボーナス {parameter.recipeBonus}% / フィールドボーナス {parameter.fieldBonus}% / 元気 {energySettingLabel} / タップ {tapSettingLabel} / スキル天井 {parameter.useSkillPity ? 'ON' : 'OFF'} / いいキャンプ {parameter.isGoodCampTicketSet ? 'ON' : 'OFF'} / イベント {eventLabel}
            </Typography>
            <Accordion disableGutters sx={{mb: 1}}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">貢献度の基準</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{pt: 0}}>
                    <Typography variant="body2" sx={{mb: 1}}>
                        各食材の基準は、固定の基準ポケモンを今の設定で毎回再計算した1日供給量です。
                        いいキャンプチケットやイベント、元気設定、タップ頻度もここに反映されます。
                        イワパレスのように複数食材を持ってくるポケモンも、そのポケモン自身の実際の食材内訳で再計算しています。
                        食材表は基準24h個数と24h個数の増減を見ています。
                        ポケモン表は、基準必要日数と現在の必要日数を見て、どれだけ速く終わるかを見ています。
                    </Typography>
                    <TableContainer sx={{overflowX: 'auto', maxWidth: '100%'}}>
                        <Table size="small" sx={{width: '100%'}}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>食材</TableCell>
                                    <TableCell>基準ポケモン</TableCell>
                                    <TableCell>基準</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {ingredientNames.map(name => {
                                    const source = ingredientBaselineSources[name];
                                    const baselineDetail = ingredientBaselineDetailMaps[name]?.[name];
                                    if (source === undefined || baselineDetail === undefined) {
                                        return null;
                                    }
                                    return <TableRow key={name}>
                                        <TableCell sx={{width: 56}}>
                                            <Box title={t(`ingredients.${name}`)} sx={{display: 'inline-flex', alignItems: 'center'}}>
                                                <IngredientIcon name={name} />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            {t(`pokemons.${source.pokemonName}`)} / {source.ingredientType}
                                        </TableCell>
                                        <TableCell>{formatDailyTotal(baselineDetail)}</TableCell>
                                    </TableRow>;
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </AccordionDetails>
            </Accordion>
            <FormControlLabel
                control={<Switch checked={useHelpingBonus} onChange={onUseHelpingBonusChange} />}
                label="おてつだいボーナス考慮"
                sx={{display: 'flex', mb: 1}}
            />
            <Tabs
                value={activePartyIndex}
                onChange={onPartyChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{mb: 1, minHeight: 36}}
            >
                {Array.from({length: PARTY_COUNT}, (_, index) => (
                    <Tab
                        key={`party:${index}`}
                        label={`編成${index + 1}`}
                        sx={{minHeight: 36}}
                    />
                ))}
            </Tabs>
            {pokedayRecipeGroups.map(group => (
                <Paper key={group.category} variant="outlined" sx={{
                    p: isSmallScreen ? 1 : 1.5,
                    mb: 2,
                    minWidth: 0,
                }}>
                    <Typography variant="subtitle1" sx={{mb: 1}}>{group.title}</Typography>
                    {group.recipes.map(recipe => {
                        const recipeId = recipeKey(recipe);
                        const team = activeTeamSelections[recipeId] ?? ['', '', '', '', ''];
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
                        const finalEnergy = getRecipeFinalEnergy(recipe, parameter);
                        const recipeRequirements = recipe.ingredients.map(ingredient => ingredient.count * mealCount);
                        const recipeBaselineRows = recipe.ingredients
                            .map(ingredient =>
                                recipe.ingredients.map(targetIngredient =>
                                    ingredientBaselineDetailMaps[ingredient.name]?.[targetIngredient.name]?.total ?? 0
                                )
                            );
                        const recipeBaselineTotalDays = calculateMinimumWorkDaysDetail(
                            recipeRequirements,
                            recipeBaselineRows,
                        )?.totalDays ?? null;
                        const buildTeamDetailMap = (
                            items: PokemonBoxItem[],
                            disabledHelpingBonusHolderId: number | null = null,
                        ) => {
                            const helpingBonusHolders = useHelpingBonus
                                ? items.filter(item =>
                                    item.iv.hasHelpingBonusInActiveSubSkills &&
                                    item.id !== disabledHelpingBonusHolderId
                                )
                                : [];
                            const detailMap: Record<number, Partial<Record<IngredientName, PokedayIngredientDailyDetail>>> = {};
                            for (const selectedItem of items) {
                                const helpBonusCount = useHelpingBonus
                                    ? helpingBonusHolders.filter(x => x.id !== selectedItem.id).length
                                    : 0;
                                detailMap[selectedItem.id] = useHelpingBonus ?
                                    getDetailMap(selectedItem, helpBonusCount) :
                                    getDetailMap(selectedItem, 0);
                            }
                            return detailMap;
                        };
                        const buildRatesByPokemon = (
                            items: PokemonBoxItem[],
                            disabledHelpingBonusHolderId: number | null = null,
                        ) => {
                            const detailMap = buildTeamDetailMap(items, disabledHelpingBonusHolderId);
                            return items.map(item =>
                                recipe.ingredients.map(ingredient =>
                                    detailMap[item.id]?.[ingredient.name]?.total ?? 0
                                )
                            );
                        };
                        const buildWorkDaysResult = (
                            items: PokemonBoxItem[],
                            disabledHelpingBonusHolderId: number | null = null,
                        ) => calculateMinimumWorkDaysDetail(
                            recipeRequirements,
                            [...buildRatesByPokemon(items, disabledHelpingBonusHolderId), ...recipeBaselineRows],
                        );
                        const totalWorkDaysResult = selectedTeamItems.length === 0 ? null :
                            buildWorkDaysResult(selectedTeamItems);
                        const totalWorkDays = totalWorkDaysResult?.totalDays ?? null;
                        const energyPerDay = totalWorkDays === null || totalWorkDays <= 0 ? null :
                            finalEnergy * mealCount / totalWorkDays;
                        const pokemonRows = totalWorkDaysResult === null ? [] : selectedTeamItems.map((item, index) => {
                            const workDays = totalWorkDaysResult.workDaysByPokemon[index] ?? 0;
                            return {item, workDays};
                        });
                        const contributionByPokemonId = new Map<number, number>();
                        const helpingBonusContributionByPokemonId = new Map<number, number>();
                        if (totalWorkDaysResult !== null && totalWorkDays !== null && totalWorkDays > 0) {
                            for (const selectedItem of selectedTeamItems) {
                                const absentResult = buildWorkDaysResult(
                                    selectedTeamItems.filter(item => item.id !== selectedItem.id),
                                );
                                if (absentResult !== null) {
                                    contributionByPokemonId.set(
                                        selectedItem.id,
                                        Math.max(0, absentResult.totalDays - totalWorkDays),
                                    );
                                }
                                if (useHelpingBonus && selectedItem.iv.hasHelpingBonusInActiveSubSkills) {
                                    const noBonusResult = buildWorkDaysResult(
                                        selectedTeamItems,
                                        selectedItem.id,
                                    );
                                    if (noBonusResult !== null) {
                                        helpingBonusContributionByPokemonId.set(
                                            selectedItem.id,
                                            Math.max(0, noBonusResult.totalDays - totalWorkDays),
                                        );
                                    }
                                }
                            }
                        }
                        const powerPerDayByPokemonId = new Map<number, number>();
                        if (totalWorkDaysResult !== null && totalWorkDays !== null && totalWorkDays > 0) {
                            selectedTeamItems.forEach((item, index) => {
                                const workDays = totalWorkDaysResult.workDaysByPokemon[index] ?? 0;
                                const contribution = contributionByPokemonId.get(item.id) ?? 0;
                                powerPerDayByPokemonId.set(item.id, workDays > 0 ? contribution / workDays : 0);
                            });
                        }
                        const selectedTeamDetailMap = buildTeamDetailMap(selectedTeamItems);
                        const ingredientRows = recipe.ingredients.map(ingredient => {
                            let base = 0;
                            let skill = 0;
                            for (const selectedItem of selectedTeamItems) {
                                const detail = selectedTeamDetailMap[selectedItem.id]?.[ingredient.name];
                                base += detail?.base ?? 0;
                                skill += detail?.skill ?? 0;
                            }
                            const dailyDetail: PokedayIngredientDailyDetail = {base, skill, total: base + skill};
                            const dailyCount = dailyDetail.total;
                            const perPokemon = selectedTeamItems.map(item => {
                                const detail = selectedTeamDetailMap[item.id]?.[ingredient.name] ?? {base: 0, skill: 0, total: 0};
                                return {item, detail};
                            });
                            return {ingredient, dailyDetail, dailyCount, perPokemon};
                        });
                        const pokemonBaselineDaysById = new Map<number, number | null>();
                        for (const selectedItem of selectedTeamItems) {
                            const requirements = recipe.ingredients.map(ingredient =>
                                (selectedTeamDetailMap[selectedItem.id]?.[ingredient.name]?.total ?? 0) * mealCount
                            );
                            const hasRequirement = requirements.some(value => value > 0);
                            if (!hasRequirement) {
                                pokemonBaselineDaysById.set(selectedItem.id, 0);
                                continue;
                            }
                            const baselineResult = calculateMinimumWorkDaysDetail(requirements, recipeBaselineRows);
                            pokemonBaselineDaysById.set(selectedItem.id, baselineResult?.totalDays ?? null);
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
                                                            {powerPerDayByPokemonId.has(selected.id) && (
                                                                <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                    貢献パワー: {formatWithComma(
                                                                        Math.round(powerPerDayByPokemonId.get(selected.id) ?? 0)
                                                                    )}
                                                                </Typography>
                                                            )}
                                                            {helpingBonusContributionByPokemonId.has(selected.id) && (
                                                                <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                    おてつだいボーナス貢献: {formatDays(
                                                                        helpingBonusContributionByPokemonId.get(selected.id) ?? 0
                                                                    )}日
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
                                                                {powerPerDayByPokemonId.has(item.id) && (
                                                                    <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                        貢献パワー: {formatWithComma(
                                                                            Math.round(powerPerDayByPokemonId.get(item.id) ?? 0)
                                                                        )}
                                                                    </Typography>
                                                                )}
                                                                {helpingBonusContributionByPokemonId.has(item.id) && (
                                                                    <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                        おてつだいボーナス貢献: {formatDays(
                                                                            helpingBonusContributionByPokemonId.get(item.id) ?? 0
                                                                        )}日
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
                                <Typography variant="subtitle2" sx={{mb: 0.5}}>
                                    ポケモン別必要日数
                                </Typography>
                                <TableContainer sx={{
                                    mb: 1,
                                    overflowX: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    maxWidth: '100%',
                                }}>
                                    <Table size="small" sx={{
                                        width: '100%',
                                        minWidth: isSmallScreen ? 0 : '100%',
                                    }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{width: isSmallScreen ? 160 : 'auto'}}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        ポケモン
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{width: isSmallScreen ? 80 : 'auto'}}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        必要日数
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{width: isSmallScreen ? 82 : 'auto'}}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        基準必要日数
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{width: isSmallScreen ? 64 : 'auto'}}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        加速量
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {totalWorkDays !== null && (
                                                <TableRow sx={{backgroundColor: 'rgba(0, 0, 0, 0.02)'}}>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{fontWeight: 'bold'}}>
                                                            合計稼働時間
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        <Typography variant="body2" sx={{lineHeight: 1}}>
                                                            {formatWorkDays(totalWorkDays)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        <Typography variant="body2" sx={{lineHeight: 1}}>
                                                            {recipeBaselineTotalDays === null ? 'ー' : formatWorkDays(recipeBaselineTotalDays)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        {(() => {
                                                            const deltaPercent = formatPercentAcceleration(totalWorkDays, recipeBaselineTotalDays);
                                                            if (deltaPercent === null) {
                                                                return <Typography variant="body2" sx={{lineHeight: 1}}>ー</Typography>;
                                                            }
                                                            return <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    lineHeight: 1,
                                                                    color: deltaPercent.startsWith('+') ? 'primary.main' : 'error.main',
                                                                }}
                                                            >
                                                                {deltaPercent}
                                                            </Typography>;
                                                        })()}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {pokemonRows.map(({item, workDays}) => {
                                                const isZero = workDays <= 1e-6;
                                                const baselineWorkDays = pokemonBaselineDaysById.get(item.id) ?? null;
                                                const deltaPercent = formatPercentDelta(workDays, baselineWorkDays);
                                                return <TableRow
                                                    key={`${recipeId}:pokemon:${item.id}`}
                                                    sx={{opacity: isZero ? 0.35 : 1}}
                                                >
                                                    <TableCell>
                                                        <Stack direction="row" spacing={0.8} alignItems="center">
                                                            <Box sx={getHelpingBonusHighlightSx(
                                                                useHelpingBonus && item.iv.hasHelpingBonusInActiveSubSkills
                                                            )}>
                                                                <Stack spacing={0} alignItems="center" sx={{minWidth: 0}}>
                                                                    <Typography variant="caption" sx={{lineHeight: 1, whiteSpace: 'nowrap'}}>
                                                                        Lv.{item.iv.level}
                                                                    </Typography>
                                                                    <PokemonIcon idForm={item.iv.idForm} size={24}/>
                                                                </Stack>
                                                            </Box>
                                                        <Stack spacing={0} sx={{minWidth: 0}}>
                                                            <Typography variant="body2" sx={{wordBreak: 'break-word'}}>
                                                                {getDisplayName(item, t)}
                                                            </Typography>
                                                            {contributionByPokemonId.has(item.id) && (
                                                                <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                    貢献度: {formatDays(contributionByPokemonId.get(item.id) ?? 0)}日
                                                                </Typography>
                                                            )}
                                                            {helpingBonusContributionByPokemonId.has(item.id) && (
                                                                <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                    おてつだいボーナス貢献: {formatDays(
                                                                        helpingBonusContributionByPokemonId.get(item.id) ?? 0
                                                                    )}日
                                                                </Typography>
                                                            )}
                                                        </Stack>
                                                    </Stack>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        <Typography variant="body2" sx={{lineHeight: 1}}>
                                                            {workDays <= 0 ? '0.00日（0時間0分）' : formatWorkDays(workDays)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        <Typography variant="body2" sx={{lineHeight: 1}}>
                                                            {baselineWorkDays === null ? 'ー' : `${formatDays(baselineWorkDays)}日`}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        {deltaPercent === null ? (
                                                            <Typography variant="body2" sx={{lineHeight: 1}}>ー</Typography>
                                                        ) : (
                                                            <Typography
                                                                variant="body2"
                                                                sx={{
                                                                    lineHeight: 1,
                                                                    color: deltaPercent.startsWith('+') ? 'primary.main' : 'error.main',
                                                                }}
                                                            >
                                                                {deltaPercent}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                </TableRow>;
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <Accordion disableGutters sx={{mb: 0.5}}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="subtitle2">
                                            食材表
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{pt: 0}}>
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
                                                                    基準24h個数
                                                                </Typography>
                                                                <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                    (基準)
                                                                </Typography>
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell
                                                            align="right"
                                                            sx={{
                                                                px: isSmallScreen ? 0.1 : 2,
                                                                width: isSmallScreen ? 150 : 'auto',
                                                            }}
                                                        >
                                                            <Stack spacing={0} alignItems="flex-end">
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
                                                                width: isSmallScreen ? 64 : 'auto',
                                                            }}
                                                        >
                                                            <Stack spacing={0} alignItems="flex-end">
                                                                <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                    差分
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
                                                                width: isSmallScreen ? 52 : 'auto',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {(() => {
                                                                const baselineDaily = ingredientBaselineDetailMaps[row.ingredient.name]?.[row.ingredient.name]?.total ?? 0;
                                                                return baselineDaily <= 0 ? 'ー' : (
                                                                    <Typography variant="body2" sx={{lineHeight: 1}}>
                                                                        {formatDailyCount(baselineDaily)}
                                                                    </Typography>
                                                                );
                                                            })()}
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
                                                                width: isSmallScreen ? 64 : 'auto',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {(() => {
                                                                const baselineDaily = ingredientBaselineDetailMaps[row.ingredient.name]?.[row.ingredient.name]?.total ?? 0;
                                                                const deltaPercent = formatPercentDelta(row.dailyCount, baselineDaily);
                                                                if (deltaPercent === null) {
                                                                    return <Typography variant="body2" sx={{lineHeight: 1}}>ー</Typography>;
                                                                }
                                                                return <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        lineHeight: 1,
                                                                        color: deltaPercent.startsWith('+') ? 'primary.main' : 'error.main',
                                                                    }}
                                                                >
                                                                    {deltaPercent}
                                                                </Typography>;
                                                            })()}
                                                        </TableCell>
                                                    </TableRow>)}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </AccordionDetails>
                                </Accordion>
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
