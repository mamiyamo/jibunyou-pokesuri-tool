import React from 'react';
import {
    Accordion, AccordionDetails, AccordionSummary, Box, Button, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, FormControlLabel, MenuItem, Paper, Select,
    SelectChangeEvent, Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { IngredientName, IngredientNames } from '../../data/pokemons';
import { formatWithComma } from '../../util/NumberUtil';
import { PokemonBoxItem } from '../../util/PokemonBox';
import { noFavoriteFieldIndex, StrengthParameter } from '../../util/PokemonStrength';
import { loadBoxSortConfig, sortPokemonItems } from '../../util/PokemonBoxSort';
import {
    calculateMinimumWorkDaysDetail, getDailyIngredientDetailMap, getRecipeFinalEnergy,
    getIngredientBaselineDetailMaps, defaultIngredientBaselinePokemonConfig,
    ingredientBaselineSources, pokedayRecipeGroups,
    PokedayIngredientDailyDetail, PokedayRecipe, MinimumWorkDaysResult,
    IngredientBaselinePokemonConfig,
} from '../../util/Pokeday';
import { useTranslation } from 'react-i18next';
import IngredientIcon from '../IvCalc/IngredientIcon';
import PokemonIcon from '../IvCalc/PokemonIcon';
import { AlwaysTap, NoTap, TapFrequency } from '../../util/Energy';

type TeamSelectionMap = Record<string, (number | '')[]>;
type RecipeIngredientEnabledMap = Record<string, Partial<Record<IngredientName, boolean>>>;
type BaselinePokemonSkillKey = Exclude<keyof IngredientBaselinePokemonConfig, 'level'>;
const PARTY_COUNT = 5;

function formatTapFrequency(value: TapFrequency): string {
    if (value === AlwaysTap) {
        return '毎分';
    }
    if (value === NoTap) {
        return 'なし';
    }
    return `${value}分ごと`;
}

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

type SurplusIngredientPart = {
    key: string;
    ingredientName: IngredientName | '?';
    count: number;
    isMystery: boolean;
};

function getPokemonSkillName(item: PokemonBoxItem): string {
    return item.iv.pokemon.skill === 'Versatile' ? item.iv.versatileSkill : item.iv.pokemon.skill;
}

function buildSurplusIngredientParts(
    item: PokemonBoxItem,
    detailMap: Partial<Record<IngredientName, PokedayIngredientDailyDetail>>,
    recipeNeedCountMap: Partial<Record<IngredientName, number>>,
    workDays: number,
    recipeIngredientNames: Set<IngredientName>,
): SurplusIngredientPart[] {
    const skillName = getPokemonSkillName(item);
    const isIngredientMagnet = skillName.startsWith('Ingredient Magnet S');
    const ret: SurplusIngredientPart[] = [];
    let mysteryCount = 0;
    for (const ingredientName of IngredientNames) {
        const detail = detailMap[ingredientName];
        if (detail === undefined || detail.total <= 0) {
            continue;
        }
        const totalCount = detail.total * workDays;
        const recipeNeedCount = recipeNeedCountMap[ingredientName] ?? 0;
        if (recipeIngredientNames.has(ingredientName)) {
            const surplusCount = Math.max(0, totalCount - recipeNeedCount);
            if (surplusCount <= 0) {
                continue;
            }
            if (isIngredientMagnet) {
                mysteryCount += surplusCount;
                continue;
            }
            ret.push({
                key: `${item.id}:${ingredientName}:surplus`,
                ingredientName,
                count: surplusCount,
                isMystery: false,
            });
            continue;
        }
        if (isIngredientMagnet) {
            const baseCount = detail.base * workDays;
            if (baseCount > 0) {
                ret.push({
                    key: `${item.id}:${ingredientName}:base`,
                    ingredientName,
                    count: baseCount,
                    isMystery: false,
                });
            }
            mysteryCount += detail.skill * workDays;
            continue;
        }
        ret.push({
            key: `${item.id}:${ingredientName}`,
            ingredientName,
            count: totalCount,
            isMystery: false,
        });
    }
    if (isIngredientMagnet && mysteryCount > 0) {
        ret.push({
            key: `${item.id}:mystery`,
            ingredientName: '?',
            count: mysteryCount,
            isMystery: true,
        });
    }
    return ret;
}

function mergeSurplusIngredientParts(parts: SurplusIngredientPart[]): SurplusIngredientPart[] {
    const merged = new Map<string, SurplusIngredientPart>();
    for (const part of parts) {
        const key = part.isMystery ? '?' : part.ingredientName;
        const current = merged.get(String(key));
        if (current === undefined) {
            merged.set(String(key), {...part});
            continue;
        }
        current.count += part.count;
    }
    const sorted: SurplusIngredientPart[] = [];
    for (const ingredientName of IngredientNames) {
        const part = merged.get(ingredientName);
        if (part !== undefined) {
            sorted.push(part);
        }
    }
    const mysteryPart = merged.get('?');
    if (mysteryPart !== undefined) {
        sorted.push(mysteryPart);
    }
    return sorted;
}

function renderSurplusIngredientParts(parts: SurplusIngredientPart[]) {
    if (parts.length === 0) {
        return 'ー';
    }
    return <Stack
        direction="row"
        spacing={0.2}
        alignItems="center"
        justifyContent="flex-end"
        flexWrap="wrap"
        sx={{minWidth: 0}}
    >
        {parts.map(part => (
            <Stack
                key={part.key}
                direction="row"
                spacing={0.1}
                alignItems="center"
                sx={{whiteSpace: 'nowrap'}}
            >
                {part.isMystery ? (
                    <Box sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '1px solid rgba(0, 0, 0, 0.3)',
                        fontSize: '0.75rem',
                        lineHeight: 1,
                        fontWeight: 700,
                        color: 'text.secondary',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    }}>
                        ?
                    </Box>
                ) : (
                    <IngredientIcon name={part.ingredientName as IngredientName} />
                )}
                <Typography variant="caption" sx={{lineHeight: 1}}>
                    {formatDailyCount(part.count)}
                </Typography>
            </Stack>
        ))}
    </Stack>;
}

function renderIngredientParts(parts: SurplusIngredientPart[]) {
    return renderSurplusIngredientParts(parts);
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
    const [greatSuccessRatePercent, setGreatSuccessRatePercent] = React.useState(10);
    const [useHelpingBonus, setUseHelpingBonus] = React.useState(false);
    const [baselinePokemonConfig, setBaselinePokemonConfig] =
        React.useState<IngredientBaselinePokemonConfig>(defaultIngredientBaselinePokemonConfig);
    const [recipeIngredientEnabledByRecipeId, setRecipeIngredientEnabledByRecipeId] =
        React.useState<RecipeIngredientEnabledMap>({});
    const [activePartyIndexByRecipeId, setActivePartyIndexByRecipeId] = React.useState<Record<string, number>>({});
    const [partySelections, setPartySelections] = React.useState<TeamSelectionMap[]>(
        () => Array.from({length: PARTY_COUNT}, () => ({})),
    );
    const [openSelectKey, setOpenSelectKey] = React.useState<string | null>(null);
    const [sortConfigRevision, setSortConfigRevision] = React.useState(0);
    const pokedayParameter = React.useMemo(() => ({
        event: parameter.event,
        fieldIndex: noFavoriteFieldIndex,
        expertEffect: parameter.expertEffect,
        useSkillPity: parameter.useSkillPity,
        isGoodCampTicketSet: parameter.isGoodCampTicketSet,
        isEnergyAlwaysFull: parameter.isEnergyAlwaysFull,
        sleepScore: parameter.sleepScore,
        tapFrequencyAwake: parameter.tapFrequencyAwake,
        tapFrequencyAsleep: parameter.tapFrequencyAsleep,
    }), [
        parameter.event,
        parameter.expertEffect,
        parameter.useSkillPity,
        parameter.isGoodCampTicketSet,
        parameter.isEnergyAlwaysFull,
        parameter.sleepScore,
        parameter.tapFrequencyAwake,
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
        pokedayParameter.tapFrequencyAwake,
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
        getIngredientBaselineDetailMaps(pokedayParameter, ingredientNames, baselinePokemonConfig)
    ), [baselinePokemonConfig, ingredientNames, pokedayParameter]);
    const eventLabel = parameter.event === 'none' ? 'なし' : t(`events.${parameter.event}`);
    const fieldLabel = t('no favorite berries');
    const energySettingLabel = parameter.isEnergyAlwaysFull
        ? '常に80%固定'
        : `設定通り(${parameter.sleepScore}%)`;
    const tapSettingLabel = `起床 ${formatTapFrequency(parameter.tapFrequencyAwake)} / 睡眠 ${formatTapFrequency(parameter.tapFrequencyAsleep)}`;
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

    const ensureRecipeIngredientEnabled = React.useCallback((source: RecipeIngredientEnabledMap) => {
        const next: RecipeIngredientEnabledMap = {...source};
        for (const group of pokedayRecipeGroups) {
            for (const recipe of group.recipes) {
                const key = recipeKey(recipe);
                const current = next[key] ?? {};
                const nextRecipe: Partial<Record<IngredientName, boolean>> = {...current};
                for (const ingredient of recipe.ingredients) {
                    if (nextRecipe[ingredient.name] === undefined) {
                        nextRecipe[ingredient.name] = true;
                    }
                }
                next[key] = nextRecipe;
            }
        }
        return next;
    }, []);

    React.useEffect(() => {
        if (!open || boxItems.length === 0) {
            return;
        }
        setPartySelections(prev => ensurePartySelections(prev));
    }, [boxItems, ensurePartySelections, open]);

    React.useEffect(() => {
        if (!open) {
            return;
        }
        setRecipeIngredientEnabledByRecipeId(prev => ensureRecipeIngredientEnabled(prev));
    }, [ensureRecipeIngredientEnabled, open]);

    const onMealCountChange = React.useCallback((
        _event: React.MouseEvent<HTMLElement>,
        nextValue: 1 | 3 | null,
    ) => {
        if (nextValue !== null) {
            setMealCount(nextValue);
        }
    }, []);
    const onGreatSuccessRateChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = Number(e.target.value);
        if (Number.isNaN(nextValue)) {
            return;
        }
        setGreatSuccessRatePercent(Math.max(1, Math.min(100, Math.trunc(nextValue))));
    }, []);
    const onUseHelpingBonusChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUseHelpingBonus(e.target.checked);
    }, []);
    const onBaselineLevelChange = React.useCallback((_: React.MouseEvent<HTMLElement>, nextValue: 30|60 | null) => {
        if (nextValue !== null) {
            setBaselinePokemonConfig(prev => ({...prev, level: nextValue}));
        }
    }, []);
    const onBaselineSkillToggle = React.useCallback((key: BaselinePokemonSkillKey) => (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const checked = e.target.checked;
        setBaselinePokemonConfig(prev => ({...prev, [key]: checked}));
    }, []);
    const onPartyChange = React.useCallback((recipeId: string, _: React.SyntheticEvent, nextValue: number) => {
        setActivePartyIndexByRecipeId(prev => ({
            ...prev,
            [recipeId]: nextValue,
        }));
        setOpenSelectKey(null);
    }, []);

    const onIngredientEnabledChange = React.useCallback((
        recipeId: string,
        ingredientName: IngredientName,
    ) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const checked = event.target.checked;
        setRecipeIngredientEnabledByRecipeId(prev => ({
            ...prev,
            [recipeId]: {
                ...(prev[recipeId] ?? {}),
                [ingredientName]: checked,
            },
        }));
    }, []);

    const onTeamSelectionChange = React.useCallback((recipeKeyText: string, partyIndex: number, index: number, value: string) => {
        setPartySelections(prev => {
            const next = [...prev];
            const currentParty = {...(next[partyIndex] ?? {})};
            const current = [...(currentParty[recipeKeyText] ?? ['', '', '', '', ''])];
            const nextValue: number | '' = value === '' ? '' : Number(value);
            current[index] = nextValue;
            currentParty[recipeKeyText] = current;
            next[partyIndex] = currentParty;
            return next;
        });
    }, []);

    if (!open) {
        return <></>;
    }

    return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl"
        fullScreen={isSmallScreen}>
        <DialogTitle>食材シミュ</DialogTitle>
        <DialogContent dividers sx={{
            px: isSmallScreen ? 1 : 3,
            overflowX: 'hidden',
        }}>
            <Typography sx={{mb: 1}} variant="body2">
                料理の最終エナジーと、必要な食材を集めるのにかかる稼働時間を見ます。
            </Typography>
            <Typography sx={{mb: 2}} variant="body2" color="text.secondary">
                参照中の設定: フィールド {fieldLabel} / レシピレベル {parameter.recipeLevel} / レシピボーナス {parameter.recipeBonus}% / フィールドボーナス {parameter.fieldBonus}% / 元気 {energySettingLabel} / タップ {tapSettingLabel} / スキル天井 {parameter.useSkillPity ? 'ON' : 'OFF'} / いいキャンプ {parameter.isGoodCampTicketSet ? 'ON' : 'OFF'} / イベント {eventLabel}
                <br />
                食材バッグの持ち越しは、食材表の必要数トグルで OFF にすると、最初から持っている前提として扱います。
            </Typography>
            <Accordion disableGutters sx={{mb: 1}}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">寄与度の基準</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{pt: 0}}>
                    <Stack spacing={1} sx={{mb: 1}}>
                        <Typography variant="body2">
                            各食材の基準は、固定の基準ポケモンを今の設定で毎回再計算した1日供給量です。
                            いいキャンプチケットやイベント、元気設定、タップ頻度もここに反映されます。
                            イワパレスのように複数食材を持ってくるポケモンも、そのポケモン自身の実際の食材内訳で再計算しています。
                            食材表は基準24h個数と24h個数の増減を見ています。
                            ポケモン表は、各ポケモンの最適稼働日数と、レシピに必要な量だけを基準ポケモンで再現した基準換算を見ています。
                            余剰食材はレシピ外の食材をまとめ、食材ゲットSは「？」でまとめています。
                        </Typography>
                        <Stack
                            direction={isSmallScreen ? 'column' : 'row'}
                            spacing={1}
                            flexWrap="wrap"
                            alignItems="center"
                            sx={{rowGap: 0.75}}
                        >
                            <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                基準ポケモン設定:
                            </Typography>
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={baselinePokemonConfig.level}
                                onChange={onBaselineLevelChange}
                                aria-label="baseline level"
                            >
                                <ToggleButton value={30} aria-label="baseline level 30">
                                    Lv30
                                </ToggleButton>
                                <ToggleButton value={60} aria-label="baseline level 60">
                                    Lv60
                                </ToggleButton>
                            </ToggleButtonGroup>
                            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={baselinePokemonConfig.ingredientFinderM}
                                            onChange={onBaselineSkillToggle('ingredientFinderM')}
                                        />
                                    }
                                    label="食材M"
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={baselinePokemonConfig.ingredientFinderS}
                                            onChange={onBaselineSkillToggle('ingredientFinderS')}
                                        />
                                    }
                                    label="食材S"
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={baselinePokemonConfig.helpingSpeedM}
                                            onChange={onBaselineSkillToggle('helpingSpeedM')}
                                        />
                                    }
                                    label="お手伝いスピードM"
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={baselinePokemonConfig.helpingSpeedS}
                                            onChange={onBaselineSkillToggle('helpingSpeedS')}
                                        />
                                    }
                                    label="お手伝いスピードS"
                                />
                            </Stack>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{lineHeight: 1.2}}>
                            Lv30では先頭2枠、Lv60では先頭4枠まで反映されます。
                        </Typography>
                    </Stack>
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
            {pokedayRecipeGroups.map(group => (
                <Paper key={group.category} variant="outlined" sx={{
                    p: isSmallScreen ? 1 : 1.5,
                    mb: 2,
                    minWidth: 0,
                }}>
                    <Typography variant="subtitle1" sx={{mb: 1}}>{group.title}</Typography>
                    {group.recipes.map(recipe => {
                        const recipeId = recipeKey(recipe);
                        const activePartyIndex = activePartyIndexByRecipeId[recipeId] ?? 0;
                        const team = partySelections[activePartyIndex]?.[recipeId] ?? ['', '', '', '', ''];
                        const ingredientEnabledMap = recipeIngredientEnabledByRecipeId[recipeId] ?? {};
                        const enabledIngredients = recipe.ingredients.filter(ingredient =>
                            ingredientEnabledMap[ingredient.name] ?? true
                        );
                        const enabledIngredientNames = new Set(enabledIngredients.map(ingredient => ingredient.name));
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
                        const greatSuccessExpectedEnergy =
                            finalEnergy * mealCount * (1 + greatSuccessRatePercent / 100);
                        const recipeRequirements = enabledIngredients.map(ingredient => ingredient.count * mealCount);
                        const recipeIngredientNames = enabledIngredientNames;
                        const recipeBaselineRows = enabledIngredients
                            .map(ingredient =>
                                enabledIngredients.map(targetIngredient =>
                                    ingredientBaselineDetailMaps[ingredient.name]?.[targetIngredient.name]?.total ?? 0
                                )
                            );
                        const recipeBaselineTotalDays = enabledIngredients.length === 0 ? 0 : (
                            calculateMinimumWorkDaysDetail(
                                recipeRequirements,
                                recipeBaselineRows,
                            )?.totalDays ?? 0
                        );
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
                                enabledIngredients.map(ingredient =>
                                    detailMap[item.id]?.[ingredient.name]?.total ?? 0
                                )
                            );
                        };
                        const buildSelectedWorkDaysResult = (
                            items: PokemonBoxItem[],
                            disabledHelpingBonusHolderId: number | null = null,
                        ): MinimumWorkDaysResult => {
                            if (recipeRequirements.every(value => value <= 0)) {
                                return {
                                    totalDays: 0,
                                    workDaysByPokemon: items.map(() => 0),
                                };
                            }
                            const result = calculateMinimumWorkDaysDetail(
                                recipeRequirements,
                                buildRatesByPokemon(items, disabledHelpingBonusHolderId),
                            );
                            return result ?? {
                                totalDays: 0,
                                workDaysByPokemon: items.map(() => 0),
                            };
                        };
                        const selectedTeamDetailMap = buildTeamDetailMap(selectedTeamItems);
                        const totalWorkDaysResult = selectedTeamItems.length === 0 ? null :
                            buildSelectedWorkDaysResult(selectedTeamItems);
                        const totalWorkDays = totalWorkDaysResult?.totalDays ?? null;
                        const energyPerDay = totalWorkDays === null || totalWorkDays <= 0 ? null :
                            finalEnergy * mealCount / totalWorkDays;
                        const workDaysByPokemonId = new Map<number, number>();
                        if (totalWorkDaysResult !== null) {
                            selectedTeamItems.forEach((item, index) => {
                                workDaysByPokemonId.set(item.id, totalWorkDaysResult.workDaysByPokemon[index] ?? 0);
                            });
                        }
                        const pokemonRows = totalWorkDaysResult === null ? [] : selectedTeamItems.map((item, index) => {
                            const workDays = totalWorkDaysResult.workDaysByPokemon[index] ?? 0;
                            return {item, workDays};
                        });
                        const recipeNeedCountMap = Object.fromEntries(recipe.ingredients.map(ingredient => [
                            ingredient.name,
                            (ingredientEnabledMap[ingredient.name] ?? true) ? ingredient.count * mealCount : 0,
                        ] as const)) as Partial<Record<IngredientName, number>>;
                        const pokemonContributionCountById = new Map<number, SurplusIngredientPart[]>();
                        for (const {item, workDays} of pokemonRows) {
                            const parts = enabledIngredients
                                .map(ingredient => {
                                    const detail = selectedTeamDetailMap[item.id]?.[ingredient.name];
                                    const count = (detail?.total ?? 0) * workDays;
                                    if (count <= 0) {
                                        return null;
                                    }
                                    return {
                                        key: `${item.id}:${ingredient.name}:count`,
                                        ingredientName: ingredient.name,
                                        count,
                                        isMystery: false,
                                    } satisfies SurplusIngredientPart;
                                })
                                .filter((part): part is SurplusIngredientPart => part !== null);
                            pokemonContributionCountById.set(item.id, parts);
                        }
                        const totalContributionCountParts = enabledIngredients
                            .map(ingredient => ({
                                key: `total:${ingredient.name}`,
                                ingredientName: ingredient.name,
                                count: ingredient.count * mealCount,
                                isMystery: false,
                            }))
                            .filter(part => part.count > 0);
                        const contributionByPokemonId = new Map<number, number>();
                        const helpingBonusContributionByPokemonId = new Map<number, number>();
                        if (totalWorkDaysResult !== null && totalWorkDays !== null && totalWorkDays > 0) {
                            for (const selectedItem of selectedTeamItems) {
                                const absentResult = buildSelectedWorkDaysResult(
                                    selectedTeamItems.filter(item => item.id !== selectedItem.id),
                                );
                                if (absentResult !== null) {
                                    contributionByPokemonId.set(
                                        selectedItem.id,
                                        Math.max(0, absentResult.totalDays - totalWorkDays),
                                    );
                                }
                                if (useHelpingBonus && selectedItem.iv.hasHelpingBonusInActiveSubSkills) {
                                    const noBonusResult = buildSelectedWorkDaysResult(
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
                        const pokemonSurplusPartsById = new Map<number, SurplusIngredientPart[]>();
                        const teamSurplusParts: SurplusIngredientPart[] = [];
                        for (const selectedItem of selectedTeamItems) {
                            const detailMap = selectedTeamDetailMap[selectedItem.id] ?? {};
                            const workDays = workDaysByPokemonId.get(selectedItem.id) ?? 0;
                            const surplusParts = buildSurplusIngredientParts(
                                selectedItem,
                                detailMap,
                                recipeNeedCountMap,
                                workDays,
                                recipeIngredientNames,
                            );
                            pokemonSurplusPartsById.set(selectedItem.id, surplusParts);
                            teamSurplusParts.push(...surplusParts);
                        }
                        const totalSurplusParts = mergeSurplusIngredientParts(teamSurplusParts);
                        const pokemonBaselineDaysById = new Map<number, number | null>();
                        const pokemonBaselineCountById = new Map<number, SurplusIngredientPart[]>();
                        for (const selectedItem of selectedTeamItems) {
                            if (recipeBaselineTotalDays === null) {
                                pokemonBaselineDaysById.set(selectedItem.id, null);
                                pokemonBaselineCountById.set(selectedItem.id, []);
                                continue;
                            }
                            const itemRequirements = enabledIngredients.map(ingredient => {
                                const carriedCount = pokemonContributionCountById.get(selectedItem.id)
                                    ?.find(part => part.ingredientName === ingredient.name)?.count ?? 0;
                                return Math.min(carriedCount, ingredient.count * mealCount);
                            });
                            if (itemRequirements.every(value => value <= 0)) {
                                pokemonBaselineDaysById.set(selectedItem.id, 0);
                                pokemonBaselineCountById.set(selectedItem.id, []);
                                continue;
                            }
                            const itemBaselineResult = calculateMinimumWorkDaysDetail(itemRequirements, recipeBaselineRows);
                            pokemonBaselineDaysById.set(
                                selectedItem.id,
                                itemBaselineResult?.totalDays ?? 0,
                            );
                            pokemonBaselineCountById.set(
                                selectedItem.id,
                                pokemonContributionCountById.get(selectedItem.id) ?? [],
                            );
                        }

                        return <Accordion key={recipeKey(recipe)} disableGutters sx={{mb: 0.5}}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Stack sx={{width: '100%'}} spacing={0.5}>
                                    <Typography variant="subtitle2">{recipe.name}</Typography>
                                    <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="flex-start">
                                        <Stack spacing={0.25}>
                                            <Typography variant="body2">
                                                最終エナジー（{mealCount}食）: {formatWithComma(finalEnergy * mealCount)}
                                            </Typography>
                                            <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center">
                                                <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                    大成功率:
                                                </Typography>
                                                <TextField
                                                    value={greatSuccessRatePercent}
                                                    onChange={onGreatSuccessRateChange}
                                                    type="number"
                                                    variant="standard"
                                                    size="small"
                                                    InputProps={{
                                                        endAdornment: <Typography variant="body2" sx={{ml: 0.5}}>%</Typography>,
                                                        inputProps: {min: 1, max: 100, step: 1},
                                                    }}
                                                    sx={{
                                                        width: 72,
                                                        '& input': {textAlign: 'right'},
                                                    }}
                                                />
                                                <Typography variant="body2" sx={{whiteSpace: 'nowrap'}}>
                                                    期待値: {formatWithComma(Math.round(greatSuccessExpectedEnergy))}
                                                </Typography>
                                            </Stack>
                                        </Stack>
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
                                                稼働効率:
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
                                <Tabs
                                    value={activePartyIndex}
                                    onChange={(event, nextValue) => onPartyChange(recipeId, event, nextValue)}
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    sx={{mb: 1, minHeight: 36}}
                                >
                                    {Array.from({length: PARTY_COUNT}, (_, index) => (
                                        <Tab
                                            key={`party:${recipeId}:${index}`}
                                            label={`編成${index + 1}`}
                                            sx={{minHeight: 36}}
                                        />
                                    ))}
                                </Tabs>
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
                                                    onTeamSelectionChange(recipeId, activePartyIndex, index, e.target.value)}
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
                                                                {helpingBonusContributionByPokemonId.has(selected.id) && (
                                                                    <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                        おてボ寄与度: {formatDays(
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
                                                                {helpingBonusContributionByPokemonId.has(item.id) && (
                                                                    <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                        おてボ寄与度: {formatDays(
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
                                    ポケモン別最適稼働日数
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
                                                        最適稼働日数
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{width: isSmallScreen ? 82 : 'auto'}}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        基準換算
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{width: isSmallScreen ? 64 : 'auto'}}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        加速量
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{width: isSmallScreen ? 120 : 'auto'}}>
                                                    <Typography variant="caption" sx={{lineHeight: 1}}>
                                                        余剰食材
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
                                                        <Stack spacing={0} alignItems="flex-end">
                                                            <Typography variant="body2" sx={{lineHeight: 1}}>
                                                                {formatWorkDays(totalWorkDays)}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                {renderIngredientParts(totalContributionCountParts)}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        <Stack spacing={0} alignItems="flex-end">
                                                            <Typography variant="body2" sx={{lineHeight: 1}}>
                                                                {recipeBaselineTotalDays === null ? 'ー' : formatWorkDays(recipeBaselineTotalDays)}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                {recipeBaselineTotalDays === null ? 'ー' : renderIngredientParts(totalContributionCountParts)}
                                                            </Typography>
                                                        </Stack>
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
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        {renderSurplusIngredientParts(totalSurplusParts)}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {pokemonRows.map(({item, workDays}) => {
                                                const isZero = workDays <= 1e-6;
                                                const baselineWorkDays = pokemonBaselineDaysById.get(item.id) ?? null;
                                                const deltaPercent = formatPercentAcceleration(workDays, baselineWorkDays);
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
                                                                    寄与度: {formatDays(contributionByPokemonId.get(item.id) ?? 0)}日
                                                                </Typography>
                                                            )}
                                                            {helpingBonusContributionByPokemonId.has(item.id) && (
                                                                <Typography variant="caption" sx={{whiteSpace: 'nowrap'}}>
                                                                    おてボ寄与度: {formatDays(
                                                                        helpingBonusContributionByPokemonId.get(item.id) ?? 0
                                                                    )}日
                                                                </Typography>
                                                            )}
                                                        </Stack>
                                                    </Stack>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        <Stack spacing={0} alignItems="flex-end">
                                                            <Typography variant="body2" sx={{lineHeight: 1}}>
                                                                {workDays <= 0 ? '0.00日（0時間0分）' : formatWorkDays(workDays)}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                {renderIngredientParts(pokemonContributionCountById.get(item.id) ?? [])}
                                                            </Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        <Stack spacing={0} alignItems="flex-end">
                                                            <Typography variant="body2" sx={{lineHeight: 1}}>
                                                                {baselineWorkDays === null ? 'ー' : `${formatDays(baselineWorkDays)}日`}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{lineHeight: 1}}>
                                                                {baselineWorkDays === null ? 'ー' : renderIngredientParts(pokemonBaselineCountById.get(item.id) ?? [])}
                                                            </Typography>
                                                        </Stack>
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
                                                    <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                        {renderSurplusIngredientParts(pokemonSurplusPartsById.get(item.id) ?? [])}
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
                                                                width: isSmallScreen ? 56 : 'auto',
                                                            }}
                                                        >
                                                            {(() => {
                                                                const ingredientEnabled = ingredientEnabledMap[row.ingredient.name] ?? true;
                                                                const requiredCount = ingredientEnabled ? row.ingredient.count * mealCount : 0;
                                                                return (
                                                                    <Stack spacing={0} alignItems="flex-end">
                                                                        <Stack direction="row" spacing={0.4} alignItems="center">
                                                                            <Typography
                                                                                variant="body2"
                                                                                sx={{lineHeight: 1, opacity: ingredientEnabled ? 1 : 0.45}}
                                                                            >
                                                                                {formatWithComma(requiredCount)}
                                                                            </Typography>
                                                                            <Switch
                                                                                size="small"
                                                                                checked={ingredientEnabled}
                                                                                onChange={onIngredientEnabledChange(recipeId, row.ingredient.name)}
                                                                                inputProps={{'aria-label': `${recipe.name} ${row.ingredient.name} collect toggle`}}
                                                                                sx={{transform: 'scale(0.82)', ml: -0.6, mr: -0.8}}
                                                                            />
                                                                        </Stack>
                                                                        <Typography variant="caption" sx={{lineHeight: 1, color: 'text.secondary'}}>
                                                                            {ingredientEnabled ? '集める' : '持ち越し'}
                                                                        </Typography>
                                                                    </Stack>
                                                                );
                                                            })()}
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
