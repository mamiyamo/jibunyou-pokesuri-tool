import React from 'react';
import { styled } from '@mui/system';
import { Button, FormControl, MenuItem, Select, SelectChangeEvent, Typography } from '@mui/material';
import { IngredientName, IngredientNames } from '../../../data/pokemons';
import IvState, { IvAction } from '../IvState';
import IngredientIcon from '../IngredientIcon';
import PokemonIcon from '../PokemonIcon';
import PokemonIconData from '../PokemonIconData';
import {
    calculateDailyTeamAllocationResult,
    DailyPlannerAllocationMember,
    DailyPlannerAllocationSegment,
    DailyPlannerManualAllocationSegment,
} from '../../../util/DailyPlanner';
import { formatWithComma, round1 } from '../../../util/NumberUtil';
import { useTranslation } from 'react-i18next';
import { TeamPlanSkillRoundingMode, useTeamPlanMealSettings } from './TeamPlanMealSettings';
import PokemonIv from '../../../util/PokemonIv';
import { PokemonBoxItem } from '../../../util/PokemonBox';

const timelineColors = [
    '#4ba3ff',
    '#35c46f',
    '#ffb84d',
    '#ef6f6c',
    '#9b7bff',
    '#35b9b1',
    '#d58a3a',
    '#7588a3',
    '#d86bb3',
    '#7aad3d',
];

const timeMarkers = [
    {hour: 0, label: '7:00(起床)', kind: 'main'},
    {hour: 3, label: '10:00', kind: 'sub'},
    {hour: 6, label: '13:00', kind: 'sub'},
    {hour: 9, label: '16:00', kind: 'sub'},
    {hour: 12, label: '19:00', kind: 'sub'},
    {hour: 15.5, label: '22:30(就寝)', kind: 'main'},
    {hour: 18, label: '1:00', kind: 'sub'},
    {hour: 21, label: '4:00', kind: 'sub'},
];
const timelineStartClockHour = 7;
const timelineSplitHour = 15.5;
const teamPlanModeStorageKey = 'PstTeamPlanMode';
const teamPlanManualSegmentsStorageKey = 'PstTeamPlanManualSegments';
const teamPlanManualSegmentSlotsStorageKey = 'PstTeamPlanManualSegmentSlots';
const teamPlanManualActiveSlotStorageKey = 'PstTeamPlanManualActiveSlot';
type TeamPlanMode = 'auto' | 'manual';
type StoredManualSegment = DailyPlannerManualAllocationSegment & {id: string};
const manualPlanSlotCount = 5;
const emptyManualSegments: StoredManualSegment[] = [];
const manualPlanMinSegmentHours = 1 / 6;
type TimelinePeriod = 'day' | 'night';
const timelinePeriods: Array<{period: TimelinePeriod; startHour: number; endHour: number; label: string}> = [
    {period: 'day', startHour: 0, endHour: timelineSplitHour, label: '日中'},
    {period: 'night', startHour: timelineSplitHour, endHour: 24, label: '夜間'},
];

function getMemberColor(idForm: number): string {
    let id = idForm;
    if (!(id in PokemonIconData)) {
        id = PokemonIv.getIdByIdForm(idForm);
    }
    const rects = PokemonIconData[id];
    if (rects === undefined) {
        return timelineColors[Math.abs(idForm) % timelineColors.length];
    }
    const largest = rects.reduce((best, rect) =>
        rect.w * rect.h > best.w * best.h ? rect : best, rects[0]);
    return largest.color;
}

const TeamPlanView = React.memo(({state, dispatch}: {
    state: IvState;
    dispatch: React.Dispatch<IvAction>;
}) => {
    const { t } = useTranslation();
    const {mealChoices, stock, skillRoundingMode} = useTeamPlanMealSettings();
    const [mode, setMode] = usePersistentState<TeamPlanMode>(teamPlanModeStorageKey, () => 'auto');
    const [detailsOpen, setDetailsOpen] = React.useState(true);
    const [manualActiveSlot, setManualActiveSlot] = usePersistentState<number>(
        teamPlanManualActiveSlotStorageKey,
        () => 0,
    );
    const [manualSegmentSlots, setManualSegmentSlots] = usePersistentState<StoredManualSegment[][]>(
        teamPlanManualSegmentSlotsStorageKey,
        () => {
            const legacy = readStoredJson<StoredManualSegment[]>(teamPlanManualSegmentsStorageKey, []);
            return Array.from({length: manualPlanSlotCount}, (_, index) => index === 0 ? legacy : []);
        },
    );
    const normalizedManualActiveSlot = Math.max(0, Math.min(manualPlanSlotCount - 1, manualActiveSlot));
    const storedManualSegments = manualSegmentSlots[normalizedManualActiveSlot] ?? emptyManualSegments;
    const manualSegments = React.useMemo(() => normalizeStoredManualSegments(storedManualSegments),
        [storedManualSegments]);
    const setManualSegments = React.useCallback<React.Dispatch<React.SetStateAction<StoredManualSegment[]>>>((action) => {
        setManualSegmentSlots(prev => {
            const normalized = Array.from({length: manualPlanSlotCount}, (_, index) => prev[index] ?? []);
            const current = normalized[normalizedManualActiveSlot] ?? [];
            const next = typeof action === 'function' ?
                (action as (prevState: StoredManualSegment[]) => StoredManualSegment[])(current) :
                action;
            normalized[normalizedManualActiveSlot] = normalizeStoredManualSegments(next);
            return normalized;
        });
    }, [normalizedManualActiveSlot, setManualSegmentSlots]);
    const candidates = React.useMemo(() => {
        return state.teamPlanSelectedItemIds
            .map(id => state.box.items.find(item => item.id === id))
            .filter((item): item is NonNullable<typeof item> => item !== undefined);
    }, [state.box.items, state.teamPlanSelectedItemIds]);
    const effectiveManualSegments = React.useMemo(() => {
        if (mode !== 'manual') {
            return undefined;
        }
        const candidateIds = new Set(candidates.map(item => item.id));
        return manualSegments.filter(segment => candidateIds.has(segment.itemId));
    }, [candidates, manualSegments, mode]);
    const autoResult = React.useMemo(() => calculateDailyTeamAllocationResult(
        candidates,
        state.parameter,
        mealChoices,
        stock,
    ), [candidates, mealChoices, state.parameter, stock]);
    const result = React.useMemo(() => mode === 'manual' ? calculateDailyTeamAllocationResult(
        candidates,
        state.parameter,
        mealChoices,
        stock,
        effectiveManualSegments ?? [],
    ) : autoResult, [autoResult, candidates, effectiveManualSegments, mealChoices, mode, state.parameter, stock]);
    const ingredientSupply = React.useMemo(() => {
        const ret: Partial<Record<IngredientName, number>> = {};
        for (const member of result.candidates) {
            for (const ingredientName of IngredientNames) {
                const value = member.ingredientCounts[ingredientName] ?? 0;
                if (value > 0) {
                    ret[ingredientName] = (ret[ingredientName] ?? 0) + value;
                }
            }
        }
        return ret;
    }, [result.candidates]);
    const randomIngredientSupply = React.useMemo(() => {
        const ret: Partial<Record<IngredientName, number>> = {};
        for (const member of result.candidates) {
            for (const ingredientName of IngredientNames) {
                const value = member.randomIngredientCounts[ingredientName] ?? 0;
                if (value > 0) {
                    ret[ingredientName] = (ret[ingredientName] ?? 0) + value;
                }
            }
        }
        return ret;
    }, [result.candidates]);
    const energyBreakdown = React.useMemo(() => createEnergyBreakdown(result.candidates, {
        mealEnergy: result.totalMealEnergy,
        demand: result.demand,
        stock: result.stock,
        t,
    }), [result.candidates, result.demand, result.stock, result.totalMealEnergy, t]);

    const onSettingClick = React.useCallback(() => {
        dispatch({type: 'changeLowerTab', payload: {index: 2}});
    }, [dispatch]);
    const onCopyAutoToManual = React.useCallback(() => {
        const copied = autoResult.candidates.flatMap(member => member.segments.map(segment => ({
            id: `auto-${member.item.id}-${segment.rowIndex}-${segment.startHour}-${segment.endHour}`,
            itemId: member.item.id,
            rowIndex: segment.rowIndex,
            startHour: segment.startHour,
            endHour: segment.endHour,
        })));
        setManualSegments(copied);
        setMode('manual');
    }, [autoResult.candidates, setManualSegments, setMode]);
    const onQuickAddManualSegment = React.useCallback((itemId: number, rowIndex: number, period: TimelinePeriod) => {
        setManualSegments(prev => addManualSegmentToPeriodStart(prev, itemId, rowIndex, period, 0.5));
        setMode('manual');
    }, [setManualSegments, setMode]);

    return <StyledRoot>
        <section className="summary">
            <header>
                <div>
                    <h3>1日チーム編成 <small>最大10匹 / 24h×5枠 / {mode === 'auto' ? '自動' : '手動'}</small></h3>
                </div>
                <div className="header-actions">
                    <div className="mode-switch">
                        <Button size="small" variant={mode === 'auto' ? 'contained' : 'outlined'}
                            onClick={() => setMode('auto')}>自動</Button>
                        <Button size="small" variant={mode === 'manual' ? 'contained' : 'outlined'}
                            onClick={() => setMode('manual')}>手動</Button>
                    </div>
                    <Button size="small" variant="outlined" onClick={onCopyAutoToManual}
                        disabled={autoResult.candidates.every(member => member.segments.length === 0)}>
                        自動を手動へ
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => setDetailsOpen(prev => !prev)}>
                        {detailsOpen ? '全部たたむ' : '全部表示'}
                    </Button>
                    <Button size="small" onClick={onSettingClick}>設定</Button>
                </div>
            </header>

            <div className="cards">
                <InfoCard label="きのみエナジー" value={formatWithComma(Math.round(result.totalBerryEnergy))}
                    breakdown={energyBreakdown.berry}/>
                <InfoCard label="料理エナジー" value={formatWithComma(Math.round(result.totalMealEnergy))}
                    breakdown={energyBreakdown.meal}/>
                <InfoCard label="スキルエナジー" value={formatWithComma(Math.round(result.totalSkillEnergy))}
                    breakdown={energyBreakdown.skill}/>
            </div>

            {mode === 'manual' && <ManualPlanEditor
                candidates={candidates}
                activeSlot={normalizedManualActiveSlot}
                setActiveSlot={setManualActiveSlot}
                segments={manualSegments}
                setSegments={setManualSegments}
                open={detailsOpen}
            />}

            <TeamTimeline
                members={result.candidates}
                skillRoundingMode={skillRoundingMode}
                isManual={mode === 'manual'}
                manualSegments={mode === 'manual' ? manualSegments : undefined}
                setManualSegments={setManualSegments}
            />

            <IngredientShortageView
                demand={result.demand}
                stock={result.stock}
                supply={ingredientSupply}
                randomSupply={randomIngredientSupply}
                remaining={result.remainingDemand}
                open={detailsOpen}
            />

            <details className="collapsible candidate-panel" open={detailsOpen}>
                <summary>
                    <span>編成候補</span>
                    <small>{result.candidates.length}/10</small>
                </summary>
                <div className="members">
                    {result.candidates.length === 0 ? <Typography variant="body2" sx={{color: '#888'}}>
                        下のボックスで候補ポケモンを選択すると、ここに編成案が表示されます。
                    </Typography> : result.candidates.map(member => (
                        <article key={member.item.id}>
                            <span className="color" style={{background: getMemberColor(member.item.iv.idForm)}}/>
                            <PokemonIcon idForm={member.item.iv.idForm} size={34}/>
                            <div>
                                <strong>{member.item.filledNickname(t)}</strong>
                                <small>
                                    稼働 {round1(member.workHours)}h / きのみエナジー {formatWithComma(
                                        Math.round(member.berryEnergy),
                                    )}（{round1(member.berryCount)}個） / スキル {roundSkillCount(
                                        member.segments.reduce((sum, segment) => sum + segment.skillTriggerCount, 0),
                                        skillRoundingMode,
                                    )}回（日中 {roundSkillCount(
                                        member.awakeSkillTriggerCount,
                                        skillRoundingMode,
                                    )} / 夜間 {roundSkillCount(member.asleepSkillTriggerCount, skillRoundingMode)}）
                                </small>
                                <IngredientYield
                                    counts={member.ingredientCounts}
                                    randomCounts={member.randomIngredientCounts}
                                />
                                <CandidateManualAddControls
                                    itemId={member.item.id}
                                    onAdd={onQuickAddManualSegment}
                                />
                            </div>
                        </article>
                    ))}
                </div>
            </details>
        </section>
    </StyledRoot>;
});

type EnergyBreakdownItem = {
    id: number;
    idForm: number;
    name: string;
    value: number;
};

const InfoCard = React.memo(({label, value, breakdown}: {
    label: string;
    value: string;
    breakdown: EnergyBreakdownItem[];
}) => <div>
    <Typography variant="body2" sx={{color: '#666'}}>{label}</Typography>
    <Typography variant="h6" sx={{fontSize: '1.05rem', lineHeight: 1.2}}>{value}</Typography>
    {breakdown.length > 0 && <details>
        <summary>内訳</summary>
        <ul>
            {breakdown.map(item => (
                <li key={item.id}>
                    <PokemonIcon idForm={item.idForm} size={18}/>
                    <span>{item.name}</span>
                    <strong>{formatWithComma(Math.round(item.value))}</strong>
                </li>
            ))}
        </ul>
    </details>}
</div>);

const CandidateManualAddControls = React.memo(({itemId, onAdd}: {
    itemId: number;
    onAdd: (itemId: number, rowIndex: number, period: TimelinePeriod) => void;
}) => {
    const [rowIndex, setRowIndex] = React.useState('0');
    const [period, setPeriod] = React.useState<TimelinePeriod>('day');

    return <div className="candidate-add-controls">
        <Select size="small" variant="standard" value={rowIndex}
            onChange={(e: SelectChangeEvent) => setRowIndex(e.target.value)}>
            {[0, 1, 2, 3, 4].map(index => (
                <MenuItem key={index} value={index.toString()}>{index + 1}枠</MenuItem>
            ))}
        </Select>
        <Select size="small" variant="standard" value={period}
            onChange={(e: SelectChangeEvent<TimelinePeriod>) => setPeriod(e.target.value as TimelinePeriod)}>
            <MenuItem value="day">日中</MenuItem>
            <MenuItem value="night">夜間</MenuItem>
        </Select>
        <Button size="small" variant="outlined" onClick={() => onAdd(itemId, parseInt(rowIndex, 10), period)}>
            30分追加
        </Button>
    </div>;
});

const manualTimeOptions = Array.from({length: 24 * 6 + 1}, (_, index) => index / 6);

const ManualPlanEditor = React.memo(({candidates, activeSlot, setActiveSlot, segments, setSegments, open}: {
    candidates: PokemonBoxItem[];
    activeSlot: number;
    setActiveSlot: React.Dispatch<React.SetStateAction<number>>;
    segments: StoredManualSegment[];
    setSegments: React.Dispatch<React.SetStateAction<StoredManualSegment[]>>;
    open: boolean;
}) => {
    const { t } = useTranslation();
    const [rowIndex, setRowIndex] = React.useState('0');
    const [itemId, setItemId] = React.useState(() => candidates[0]?.id.toString() ?? '');
    const [startHour, setStartHour] = React.useState('0');
    const [endHour, setEndHour] = React.useState('3');
    const candidateIds = React.useMemo(() => new Set(candidates.map(item => item.id)), [candidates]);
    const visibleSegments = React.useMemo(() => segments
        .filter(segment => candidateIds.has(segment.itemId))
        .sort((a, b) => a.rowIndex === b.rowIndex ? a.startHour - b.startHour : a.rowIndex - b.rowIndex),
    [candidateIds, segments]);

    React.useEffect(() => {
        if (itemId !== '' && candidateIds.has(parseInt(itemId, 10))) {
            return;
        }
        setItemId(candidates[0]?.id.toString() ?? '');
    }, [candidateIds, candidates, itemId]);

    const addSegment = React.useCallback(() => {
        const parsedItemId = parseInt(itemId, 10);
        const parsedStart = parseFloat(startHour);
        const parsedEnd = parseFloat(endHour);
        if (!candidateIds.has(parsedItemId) || parsedEnd <= parsedStart) {
            return;
        }
        const nextSegment: StoredManualSegment = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            itemId: parsedItemId,
            rowIndex: parseInt(rowIndex, 10),
            startHour: parsedStart,
            endHour: parsedEnd,
        };
        setSegments(prev => [...prev, nextSegment]);
    }, [candidateIds, endHour, itemId, rowIndex, setSegments, startHour]);

    const removeSegment = React.useCallback((id: string) => {
        setSegments(prev => prev.filter(segment => segment.id !== id));
    }, [setSegments]);

    const clearSegments = React.useCallback(() => {
        setSegments([]);
    }, [setSegments]);

    return <details className="manual-editor" open={open}>
        <summary>
            <span>手動編成</span>
            <small>保存{activeSlot + 1} / {visibleSegments.length}件</small>
        </summary>
        <div className="manual-slots">
            <span>保存枠</span>
            {Array.from({length: manualPlanSlotCount}, (_, index) => (
                <Button key={index} size="small"
                    variant={activeSlot === index ? 'contained' : 'outlined'}
                    onClick={() => setActiveSlot(index)}>
                    {index + 1}
                </Button>
            ))}
        </div>
        <div className="manual-controls">
            <FormControl size="small" variant="standard">
                <Typography variant="caption">枠</Typography>
                <Select value={rowIndex} onChange={(e: SelectChangeEvent) => setRowIndex(e.target.value)}>
                    {[0, 1, 2, 3, 4].map(index => (
                        <MenuItem key={index} value={index.toString()}>{index + 1}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="small" variant="standard">
                <Typography variant="caption">ポケモン</Typography>
                <Select value={itemId} onChange={(e: SelectChangeEvent) => setItemId(e.target.value)}
                    disabled={candidates.length === 0}>
                    {candidates.map(item => (
                        <MenuItem key={item.id} value={item.id.toString()}>
                            {item.filledNickname(t)}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="small" variant="standard">
                <Typography variant="caption">開始</Typography>
                <Select value={startHour} onChange={(e: SelectChangeEvent) => setStartHour(e.target.value)}>
                    {manualTimeOptions.slice(0, -1).map(hour => (
                        <MenuItem key={hour} value={hour.toString()}>{formatTimelineHour(hour + timelineStartClockHour)}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="small" variant="standard">
                <Typography variant="caption">終了</Typography>
                <Select value={endHour} onChange={(e: SelectChangeEvent) => setEndHour(e.target.value)}>
                    {manualTimeOptions.slice(1).map(hour => (
                        <MenuItem key={hour} value={hour.toString()}>{formatTimelineHour(hour + timelineStartClockHour)}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Button size="small" variant="contained" onClick={addSegment}
                disabled={candidates.length === 0 || parseFloat(endHour) <= parseFloat(startHour)}>
                追加
            </Button>
            <Button size="small" variant="outlined" color="inherit" onClick={clearSegments}
                disabled={segments.length === 0}>
                クリア
            </Button>
        </div>
        <Typography variant="caption" sx={{display: 'block', color: '#666', marginTop: '.35rem'}}>
            時刻は10分単位です。同じ枠の重複、または同じポケモンの同時編成は集計時に二重計上しません。
        </Typography>
        <div className="manual-segments">
            {visibleSegments.length === 0 ? <Typography variant="body2" sx={{color: '#888'}}>
                上の入力から、枠・ポケモン・時間帯を追加してください。
            </Typography> : visibleSegments.map(segment => {
                const item = candidates.find(candidate => candidate.id === segment.itemId);
                return <span key={segment.id}>
                    <PokemonIcon idForm={item?.iv.idForm ?? 0} size={20}/>
                    <b>{segment.rowIndex + 1}</b>
                    <span>{item?.filledNickname(t) ?? '-'}</span>
                    <small>
                        {formatTimelineHour(segment.startHour + timelineStartClockHour)}
                        {' - '}
                        {formatTimelineHour(segment.endHour + timelineStartClockHour)}
                    </small>
                    <Button size="small" onClick={() => removeSegment(segment.id)}>削除</Button>
                </span>;
            })}
        </div>
    </details>;
});

const TeamTimeline = React.memo(({members, skillRoundingMode, isManual, manualSegments, setManualSegments}: {
    members: DailyPlannerAllocationMember[];
    skillRoundingMode: TeamPlanSkillRoundingMode;
    isManual?: boolean;
    manualSegments?: StoredManualSegment[];
    setManualSegments?: React.Dispatch<React.SetStateAction<StoredManualSegment[]>>;
}) => {
    const { t } = useTranslation();
    const rows = React.useMemo(() => isManual && manualSegments !== undefined ?
        createManualTimelineRows(manualSegments, members, t) :
        createTimelineRows(members, t),
    [isManual, manualSegments, members, t]);
    const helpingBonusSegments = React.useMemo(() => createHelpingBonusTimelineSegments(members), [members]);
    const duplicateSlotKeys = React.useMemo(() => isManual && manualSegments !== undefined ?
        createDuplicateSlotKeysFromManualSegments(manualSegments) :
        createDuplicateSlotKeys(members),
    [isManual, manualSegments, members]);
    const manualSlotPriorityMap = React.useMemo(() => isManual && manualSegments !== undefined ?
        createManualSlotPriorityMap(manualSegments) :
        new Map<string, boolean>(),
    [isManual, manualSegments]);
    const onResizeStart = React.useCallback((
        event: React.PointerEvent<HTMLElement>,
        segment: TimelineSegment,
        side: 'start' | 'end',
        period: TimelinePeriod,
    ) => {
        if (!isManual || setManualSegments === undefined) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const rowElement = event.currentTarget.parentElement?.parentElement;
        if (!(rowElement instanceof HTMLElement)) {
            return;
        }
        const periodRange = getTimelinePeriodRange(period);
        const rect = rowElement.getBoundingClientRect();
        const roundToSlot = (hour: number) => Math.round(hour * 6) / 6;
        let lastHour: number | null = null;
        let pendingHour: number | null = null;
        let frameId = 0;
        const flush = () => {
            frameId = 0;
            if (pendingHour === null) {
                return;
            }
            const hour = pendingHour;
            pendingHour = null;
            setManualSegments(prev => resizeStoredManualBoundary(prev, segment, side, hour));
        };
        const update = (clientX: number) => {
            const percent = Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100));
            const rawHour = periodRange.startHour + percent / 100 * (periodRange.endHour - periodRange.startHour);
            const nextHour = roundToSlot(rawHour);
            if (lastHour !== null && Math.abs(lastHour - nextHour) < 1e-6) {
                return;
            }
            lastHour = nextHour;
            pendingHour = nextHour;
            if (frameId === 0) {
                frameId = window.requestAnimationFrame(flush);
            }
        };
        const onPointerMove = (moveEvent: PointerEvent) => {
            update(moveEvent.clientX);
        };
        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            if (frameId !== 0) {
                window.cancelAnimationFrame(frameId);
                flush();
            }
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [isManual, setManualSegments]);
    const onSwapManualSegment = React.useCallback((segment: TimelineSegment, direction: 'left' | 'right') => {
        if (!isManual || setManualSegments === undefined) {
            return;
        }
        setManualSegments(prev => swapStoredManualNeighbor(prev, segment, direction));
    }, [isManual, setManualSegments]);

    return <div className="timeline">
        <div className="helping-bonus-row">
            <span/>
            <div className="timeline-track">
                {timelinePeriods.map(periodRange => (
                    <div key={periodRange.period} className={`timeline-part ${periodRange.period}-part`}>
                        {periodRange.period === 'day' && <strong className="helping-bonus-label">
                            おてつだいボーナス数
                        </strong>}
                        {helpingBonusSegments
                            .flatMap(segment => clipHelpingBonusSegment(
                                segment,
                                periodRange.startHour,
                                periodRange.endHour,
                            ))
                            .filter(segment => segment.count > 0)
                            .map((segment, index) => (
                                <i key={index}
                                    className={`helping-bonus-segment count-${segment.count}`}
                                    title={`${formatTimelineHour(segment.startHour + timelineStartClockHour)}-${formatTimelineHour(
                                        segment.endHour + timelineStartClockHour,
                                    )}: おてボ ${segment.count}`}
                                    style={{
                                        left: `${getTimelinePartLeftPercent(
                                            segment.startHour,
                                            periodRange.startHour,
                                            periodRange.endHour,
                                        )}%`,
                                        width: `${getTimelinePartWidthPercent(
                                            segment.startHour,
                                            segment.endHour,
                                            periodRange.startHour,
                                            periodRange.endHour,
                                        )}%`,
                                    }}
                                >
                                    <b>{segment.count}</b>
                                </i>
                            ))}
                    </div>
                ))}
            </div>
        </div>
        {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="timeline-row">
                <span>{rowIndex + 1}</span>
                <div className="timeline-track">
                    {timelinePeriods.map(periodRange => (
                        <div key={periodRange.period} className={`timeline-part ${periodRange.period}-part`}>
                            {timeMarkers
                                .filter(marker => marker.hour >= periodRange.startHour && marker.hour <= periodRange.endHour)
                                .map(marker => (
                                    <b
                                        key={marker.hour}
                                        className={`time-marker ${marker.kind}-marker ${marker.hour === 0 ? 'start-marker' : ''}`}
                                        title={marker.label}
                                        style={{
                                            left: `${getTimelinePartLeftPercent(
                                                marker.hour,
                                                periodRange.startHour,
                                                periodRange.endHour,
                                            )}%`,
                                        }}
                                    >
                                        {rowIndex === rows.length - 1 && <em>{marker.label}</em>}
                                    </b>
                                ))}
                            {(() => {
                                const clippedSegments = row.flatMap((segment, segmentIndex) =>
                                    clipTimelineSegment(segment, periodRange.startHour, periodRange.endHour)
                                        .map(clipped => ({...clipped, renderKey: `${segmentIndex}-${periodRange.period}`})));
                                return clippedSegments.map((clipped, clippedIndex) => {
                                    const duplicateRanges = createDuplicateOverlayRanges(
                                        clipped,
                                        duplicateSlotKeys,
                                        manualSlotPriorityMap,
                                    );
                                    return (
                                        <i
                                            key={clipped.renderKey}
                                            className={duplicateRanges.length > 0 ? 'duplicated-segment' : undefined}
                                            title={`${clipped.name}: ${round1(clipped.hours)}h`}
                                            style={{
                                                left: `${getTimelinePartLeftPercent(
                                                    clipped.startHour,
                                                    periodRange.startHour,
                                                    periodRange.endHour,
                                                )}%`,
                                                width: `${getTimelinePartWidthPercent(
                                                    clipped.startHour,
                                                    clipped.startHour + clipped.hours,
                                                    periodRange.startHour,
                                                    periodRange.endHour,
                                                )}%`,
                                                background: clipped.color,
                                            }}
                                        >
                                            {clipped.startHour > periodRange.startHour && <em className="segment-time">
                                                {formatTimelineHour(clipped.startHour + timelineStartClockHour)}頃
                                            </em>}
                                            <span className="segment-icon"><PokemonIcon idForm={clipped.idForm} size={18}/></span>
                                            {duplicateRanges.map((range, index) => (
                                                <span
                                                    key={index}
                                                    className={`duplicate-overlay ${range.isCounted ? 'counted' : 'ignored'}`}
                                                    title="同じポケモンが同時間帯に重複配置されています"
                                                    style={{
                                                        left: `${getSegmentInnerLeftPercent(range.startHour, clipped)}%`,
                                                        width: `${getSegmentInnerWidthPercent(
                                                            range.startHour,
                                                            range.endHour,
                                                            clipped,
                                                        )}%`,
                                                    }}
                                                />
                                            ))}
                                            <IngredientSegmentYield counts={clipped.ingredientCounts}/>
                                            <SkillTriggerMarkers count={clipped.skillTriggerCount}
                                                roundingMode={skillRoundingMode}/>
                                            {isManual && <>
                                                {clippedIndex > 0 && <button type="button"
                                                    className="swap-handle left-swap"
                                                    title="左隣と入れ替え"
                                                    onClick={() => onSwapManualSegment(clipped, 'left')}>
                                                    ‹
                                                </button>}
                                                <b className="resize-handle start-handle"
                                                    title="開始時刻を調整"
                                                    onPointerDown={event => onResizeStart(
                                                        event,
                                                        clipped,
                                                        'start',
                                                        periodRange.period,
                                                    )}/>
                                                <b className="resize-handle end-handle"
                                                    title="終了時刻を調整"
                                                    onPointerDown={event => onResizeStart(
                                                        event,
                                                        clipped,
                                                        'end',
                                                        periodRange.period,
                                                    )}/>
                                                {clippedIndex < clippedSegments.length - 1 && <button type="button"
                                                    className="swap-handle right-swap"
                                                    title="右隣と入れ替え"
                                                    onClick={() => onSwapManualSegment(clipped, 'right')}>
                                                    ›
                                                </button>}
                                            </>}
                                            <span className="energy-overlay">
                                                元気 {Math.round(clipped.energyStart)} → {Math.round(clipped.energyEnd)}
                                            </span>
                                        </i>
                                    );
                                });
                            })()}
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>;
});

const IngredientShortageView = React.memo(({
    demand, stock, supply, randomSupply, remaining, open,
}: {
    demand: Partial<Record<IngredientName, number>>;
    stock: Partial<Record<IngredientName, number>>;
    supply: Partial<Record<IngredientName, number>>;
    randomSupply: Partial<Record<IngredientName, number>>;
    remaining: Partial<Record<IngredientName, number>>;
    open: boolean;
}) => {
    const rows = IngredientNames
        .filter(name => !name.startsWith('unknown'))
        .map(name => ({
            name,
            demand: demand[name] ?? 0,
            stock: stock[name] ?? 0,
            supply: supply[name] ?? 0,
            remaining: remaining[name] ?? 0,
            surplus: Math.max(0, (stock[name] ?? 0) + (supply[name] ?? 0) - (demand[name] ?? 0)),
        }))
        .filter(row => row.demand > 0);
    const surplusRows = IngredientNames
        .filter(name => !name.startsWith('unknown'))
        .map(name => ({
            name,
            surplus: Math.max(0,
                (stock[name] ?? 0) +
                (supply[name] ?? 0) -
                (randomSupply[name] ?? 0) -
                (demand[name] ?? 0)),
        }))
        .filter(row => row.surplus > 0);
    const randomSurplus = IngredientNames
        .filter(name => !name.startsWith('unknown') && (demand[name] ?? 0) <= 0)
        .reduce((sum, name) => sum + (randomSupply[name] ?? 0), 0);

    if (rows.length === 0) {
        return <></>;
    }

    return <details className="collapsible ingredients" open={open}>
        <summary>
            <span>料理3食の食材収支</span>
            <small>{rows.length}食材</small>
        </summary>
        <div>
            {rows.map(row => (
                <article key={row.name} className={row.remaining > 0 ? 'shortage' : ''}>
                    <IngredientIcon name={row.name}/>
                    <span>必要 {Math.round(row.demand)}</span>
                    <span>備蓄 {Math.round(row.stock)}</span>
                    <span>供給 {round1(row.supply)}</span>
                    {row.remaining > 0 && <strong>不足 {round1(row.remaining)}</strong>}
                    <span>余剰 {round1(row.surplus)}</span>
                </article>
            ))}
        </div>
        {(surplusRows.length > 0 || randomSurplus > 0) && <div className="surplus-summary">
            <Typography variant="body2" sx={{color: '#666'}}>最終余剰食材</Typography>
            <span>
                {surplusRows.map(row => (
                    <span key={row.name}>
                        <IngredientIcon name={row.name}/>
                        {round1(row.surplus)}
                    </span>
                ))}
                {randomSurplus > 0 && <span>ランダム 約 {round1(randomSurplus)}個</span>}
            </span>
        </div>}
    </details>;
});

const IngredientYield = React.memo(({counts, randomCounts}: {
    counts: Partial<Record<IngredientName, number>>;
    randomCounts: Partial<Record<IngredientName, number>>;
}) => {
    const rows = IngredientNames
        .map(name => ({name, count: Math.max(0, (counts[name] ?? 0) - (randomCounts[name] ?? 0))}))
        .filter(row => row.count > 0);
    const randomTotal = IngredientNames
        .reduce((sum, name) => sum + (randomCounts[name] ?? 0), 0);
    if (rows.length === 0 && randomTotal <= 0) {
        return <></>;
    }
    return <span className="yield">
        {rows.map(row => (
            <span key={row.name}>
                <IngredientIcon name={row.name}/>
                {round1(row.count)}
            </span>
        ))}
        {randomTotal > 0 && <span>ランダム 約 {round1(randomTotal)}個</span>}
    </span>;
});

const IngredientSegmentYield = React.memo(({counts}: {
    counts: Partial<Record<IngredientName, number>>;
}) => {
    const rows = IngredientNames
        .map(name => ({name, count: counts[name] ?? 0}))
        .filter(row => row.count >= 0.05)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
    if (rows.length === 0) {
        return <></>;
    }
    return <span className="segment-yield">
        {rows.map(row => (
            <span key={row.name}>
                <IngredientIcon name={row.name}/>
                ×{round1(row.count)}
            </span>
        ))}
    </span>;
});

const SkillTriggerMarkers = React.memo(({count, roundingMode}: {
    count: number;
    roundingMode: TeamPlanSkillRoundingMode;
}) => {
    const roundedCount = roundSkillCount(count, roundingMode);
    if (roundedCount <= 0) {
        return <></>;
    }
    const markerCount = Math.min(12, roundedCount);
    return <>
        {Array.from({length: markerCount}, (_, index) => (
            <b
                key={index}
                className="skill-trigger-marker"
                style={{left: `${(index + 1) / (markerCount + 1) * 100}%`}}
                title={`スキル発動期待 ${floor1(count)}回（表示 ${roundedCount}回）`}
            >
                !
            </b>
        ))}
    </>;
});

function createEnergyBreakdown(
    members: DailyPlannerAllocationMember[],
    options: {
        mealEnergy: number;
        demand: Partial<Record<IngredientName, number>>;
        stock: Partial<Record<IngredientName, number>>;
        t: (key: string) => string;
    },
): {
    berry: EnergyBreakdownItem[];
    meal: EnergyBreakdownItem[];
    skill: EnergyBreakdownItem[];
} {
    const createItem = (member: DailyPlannerAllocationMember, value: number): EnergyBreakdownItem => ({
        id: member.item.id,
        idForm: member.item.iv.idForm,
        name: member.item.filledNickname(options.t),
        value,
    });
    const berry = members
        .map(member => createItem(member, member.berryEnergy))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
    const skill = members
        .map(member => createItem(member, member.skillEnergy))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
    const mealContributionById = new Map<number, number>();
    for (const ingredientName of IngredientNames) {
        const required = Math.max(0, (options.demand[ingredientName] ?? 0) - (options.stock[ingredientName] ?? 0));
        if (required <= 0) {
            continue;
        }
        const totalSupply = members.reduce((sum, member) => sum + (member.ingredientCounts[ingredientName] ?? 0), 0);
        if (totalSupply <= 0) {
            continue;
        }
        const cappedSupply = Math.min(required, totalSupply);
        for (const member of members) {
            const supply = member.ingredientCounts[ingredientName] ?? 0;
            if (supply > 0) {
                mealContributionById.set(
                    member.item.id,
                    (mealContributionById.get(member.item.id) ?? 0) + cappedSupply * supply / totalSupply,
                );
            }
        }
    }
    const totalContribution = [...mealContributionById.values()].reduce((sum, value) => sum + value, 0);
    const meal = members
        .map(member => createItem(member, totalContribution <= 0 ? 0 :
            options.mealEnergy * (mealContributionById.get(member.item.id) ?? 0) / totalContribution))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
    return {berry, meal, skill};
}

function roundSkillCount(value: number, mode: TeamPlanSkillRoundingMode): number {
    if (mode === 'ceil') {
        return Math.ceil(value);
    }
    if (mode === 'round') {
        return Math.round(value);
    }
    return Math.floor(value);
}

function floor1(value: number): number {
    return Math.floor(value * 10) / 10;
}

type TimelineSegment = {
    manualSegmentId?: string;
    itemId: number;
    rowIndex: number;
    name: string;
    idForm: number;
    startHour: number;
    hours: number;
    color: string;
    ingredientCounts: Partial<Record<IngredientName, number>>;
    energyStart: number;
    energyEnd: number;
    skillTriggerCount: number;
    isNight: boolean;
};

type HelpingBonusTimelineSegment = {
    startHour: number;
    endHour: number;
    count: number;
};

function formatTimelineHour(hour: number): string {
    const normalized = ((hour % 24) + 24) % 24;
    const h = Math.floor(normalized);
    const m = Math.round((normalized - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
}

function getTimelinePeriodRange(period: TimelinePeriod): {startHour: number; endHour: number} {
    return period === 'day' ?
        {startHour: 0, endHour: timelineSplitHour} :
        {startHour: timelineSplitHour, endHour: 24};
}

function getTimelinePartLeftPercent(hour: number, startHour: number, endHour: number): number {
    const clamped = Math.max(startHour, Math.min(endHour, hour));
    return (clamped - startHour) / (endHour - startHour) * 100;
}

function getTimelinePartWidthPercent(
    startHour: number,
    endHour: number,
    partStartHour: number,
    partEndHour: number,
): number {
    return Math.max(0,
        getTimelinePartLeftPercent(endHour, partStartHour, partEndHour) -
        getTimelinePartLeftPercent(startHour, partStartHour, partEndHour));
}

function getSegmentInnerLeftPercent(hour: number, segment: TimelineSegment): number {
    if (segment.hours <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(100, (hour - segment.startHour) / segment.hours * 100));
}

function getSegmentInnerWidthPercent(startHour: number, endHour: number, segment: TimelineSegment): number {
    return Math.max(0,
        getSegmentInnerLeftPercent(endHour, segment) -
        getSegmentInnerLeftPercent(startHour, segment));
}

function clipTimelineSegment(
    segment: TimelineSegment,
    startHour: number,
    endHour: number,
): TimelineSegment[] {
    const segmentEnd = segment.startHour + segment.hours;
    const clippedStart = Math.max(startHour, segment.startHour);
    const clippedEnd = Math.min(endHour, segmentEnd);
    if (clippedEnd - clippedStart <= 1e-6) {
        return [];
    }
    const ratio = segment.hours <= 0 ? 0 : (clippedEnd - clippedStart) / segment.hours;
    return [{
        ...segment,
        startHour: clippedStart,
        hours: clippedEnd - clippedStart,
        ingredientCounts: scaleIngredientCounts(segment.ingredientCounts, ratio),
        skillTriggerCount: segment.skillTriggerCount * ratio,
        energyStart: interpolate(segment.energyStart, segment.energyEnd,
            segment.hours <= 0 ? 0 : (clippedStart - segment.startHour) / segment.hours),
        energyEnd: interpolate(segment.energyStart, segment.energyEnd,
            segment.hours <= 0 ? 0 : (clippedEnd - segment.startHour) / segment.hours),
    }];
}

function createHelpingBonusTimelineSegments(
    members: DailyPlannerAllocationMember[],
): HelpingBonusTimelineSegment[] {
    const counts = Array.from<number>({length: 24 * 6}).fill(0);
    for (const member of members) {
        if (!member.item.iv.hasHelpingBonusInActiveSubSkills) {
            continue;
        }
        for (const segment of member.segments) {
            const startSlot = Math.max(0, Math.min(counts.length, Math.floor(segment.startHour * 6)));
            const endSlot = Math.max(startSlot, Math.min(counts.length, Math.ceil(segment.endHour * 6)));
            for (let slot = startSlot; slot < endSlot; slot++) {
                counts[slot] += 1;
            }
        }
    }

    const ret: HelpingBonusTimelineSegment[] = [];
    let currentCount = counts[0] ?? 0;
    let currentStartSlot = 0;
    for (let slot = 1; slot <= counts.length; slot++) {
        const count = slot < counts.length ? counts[slot] : -1;
        if (count === currentCount) {
            continue;
        }
        ret.push({
            startHour: currentStartSlot / 6,
            endHour: slot / 6,
            count: currentCount,
        });
        currentStartSlot = slot;
        currentCount = count;
    }
    return ret;
}

function createDuplicateSlotKeys(members: DailyPlannerAllocationMember[]): Set<string> {
    const slotItemCounts = new Map<string, number>();
    for (const member of members) {
        for (const segment of member.segments) {
            const startSlot = Math.max(0, Math.min(24 * 6, Math.floor(segment.startHour * 6)));
            const endSlot = Math.max(startSlot, Math.min(24 * 6, Math.ceil(segment.endHour * 6)));
            for (let slot = startSlot; slot < endSlot; slot++) {
                const key = `${member.item.id}:${slot}`;
                slotItemCounts.set(key, (slotItemCounts.get(key) ?? 0) + 1);
            }
        }
    }
    const ret = new Set<string>();
    for (const [key, count] of slotItemCounts) {
        if (count > 1) {
            ret.add(key);
        }
    }
    return ret;
}

function createDuplicateSlotKeysFromManualSegments(segments: StoredManualSegment[]): Set<string> {
    const slotItemCounts = new Map<string, number>();
    for (const segment of segments) {
        const startSlot = Math.max(0, Math.min(24 * 6, Math.floor(segment.startHour * 6)));
        const endSlot = Math.max(startSlot, Math.min(24 * 6, Math.ceil(segment.endHour * 6)));
        for (let slot = startSlot; slot < endSlot; slot++) {
            const key = `${segment.itemId}:${slot}`;
            slotItemCounts.set(key, (slotItemCounts.get(key) ?? 0) + 1);
        }
    }
    const ret = new Set<string>();
    for (const [key, count] of slotItemCounts) {
        if (count > 1) {
            ret.add(key);
        }
    }
    return ret;
}

function createManualSlotPriorityMap(segments: StoredManualSegment[]): Map<string, boolean> {
    const ret = new Map<string, boolean>();
    const schedule = Array.from({length: 5}, () => Array.from<number | null>({length: 24 * 6}).fill(null));
    for (const segment of segments) {
        const rowIndex = Math.max(0, Math.min(4, Math.floor(segment.rowIndex)));
        const startSlot = Math.max(0, Math.min(24 * 6, Math.floor(segment.startHour * 6)));
        const endSlot = Math.max(startSlot, Math.min(24 * 6, Math.ceil(segment.endHour * 6)));
        for (let slot = startSlot; slot < endSlot; slot++) {
            const key = `${segment.id}:${slot}`;
            const isCounted = schedule[rowIndex][slot] === null &&
                !schedule.some(row => row[slot] === segment.itemId);
            ret.set(key, isCounted);
            if (isCounted) {
                schedule[rowIndex][slot] = segment.itemId;
            }
        }
    }
    return ret;
}

function createDuplicateOverlayRanges(
    segment: TimelineSegment,
    duplicateSlotKeys: Set<string>,
    manualSlotPriorityMap: Map<string, boolean>,
): Array<{startHour: number; endHour: number; isCounted: boolean}> {
    const segmentEndHour = segment.startHour + segment.hours;
    const startSlot = Math.max(0, Math.min(24 * 6, Math.floor(segment.startHour * 6)));
    const endSlot = Math.max(startSlot, Math.min(24 * 6, Math.ceil(segmentEndHour * 6)));
    const ret: Array<{startHour: number; endHour: number; isCounted: boolean}> = [];
    let rangeStartSlot: number | null = null;
    let rangeIsCounted = false;

    for (let slot = startSlot; slot <= endSlot; slot++) {
        const duplicated = slot < endSlot && duplicateSlotKeys.has(`${segment.itemId}:${slot}`);
        const isCounted = segment.manualSegmentId === undefined ?
            true :
            manualSlotPriorityMap.get(`${segment.manualSegmentId}:${slot}`) ?? false;
        if (duplicated && rangeStartSlot === null) {
            rangeStartSlot = slot;
            rangeIsCounted = isCounted;
            continue;
        }
        if (duplicated && rangeStartSlot !== null && isCounted !== rangeIsCounted) {
            const startHour = Math.max(segment.startHour, rangeStartSlot / 6);
            const endHour = Math.min(segmentEndHour, slot / 6);
            if (endHour - startHour > 1e-6) {
                ret.push({startHour, endHour, isCounted: rangeIsCounted});
            }
            rangeStartSlot = slot;
            rangeIsCounted = isCounted;
            continue;
        }
        if ((!duplicated || slot === endSlot) && rangeStartSlot !== null) {
            const startHour = Math.max(segment.startHour, rangeStartSlot / 6);
            const endHour = Math.min(segmentEndHour, slot / 6);
            if (endHour - startHour > 1e-6) {
                ret.push({startHour, endHour, isCounted: rangeIsCounted});
            }
            rangeStartSlot = null;
        }
    }

    return ret;
}

function clipHelpingBonusSegment(
    segment: HelpingBonusTimelineSegment,
    startHour: number,
    endHour: number,
): HelpingBonusTimelineSegment[] {
    const clippedStart = Math.max(startHour, segment.startHour);
    const clippedEnd = Math.min(endHour, segment.endHour);
    if (clippedEnd - clippedStart <= 1e-6) {
        return [];
    }
    return [{
        ...segment,
        startHour: clippedStart,
        endHour: clippedEnd,
    }];
}

function scaleIngredientCounts(
    counts: Partial<Record<IngredientName, number>>,
    scale: number,
): Partial<Record<IngredientName, number>> {
    const ret: Partial<Record<IngredientName, number>> = {};
    for (const ingredientName of IngredientNames) {
        const value = counts[ingredientName] ?? 0;
        if (value > 0) {
            ret[ingredientName] = value * scale;
        }
    }
    return ret;
}

function interpolate(start: number, end: number, rate: number): number {
    return start + (end - start) * Math.max(0, Math.min(1, rate));
}

function findStoredManualSegmentIndex(
    segments: StoredManualSegment[],
    timelineSegment: TimelineSegment,
): number {
    const segmentEnd = timelineSegment.startHour + timelineSegment.hours;
    const index = segments.findIndex(segment =>
        segment.itemId === timelineSegment.itemId &&
        segment.rowIndex === timelineSegment.rowIndex &&
        Math.abs(segment.startHour - timelineSegment.startHour) < 1e-6 &&
        Math.abs(segment.endHour - segmentEnd) < 1e-6);
    const fallbackIndex = index >= 0 ? index : segments.findIndex(segment =>
        segment.itemId === timelineSegment.itemId &&
        segment.rowIndex === timelineSegment.rowIndex &&
        segment.startHour < segmentEnd &&
        segment.endHour > timelineSegment.startHour);
    return fallbackIndex;
}

function normalizeStoredManualSegments(segments: StoredManualSegment[]): StoredManualSegment[] {
    const normalized = segments
        .flatMap(segment => {
            const startHour = Math.round(Math.max(0, Math.min(24, segment.startHour)) * 6) / 6;
            const endHour = Math.round(Math.max(0, Math.min(24, segment.endHour)) * 6) / 6;
            const normalizedSegment = {
                ...segment,
                rowIndex: Math.max(0, Math.min(4, Math.floor(segment.rowIndex))),
                startHour: Math.min(startHour, endHour),
                endHour: Math.max(startHour, endHour),
            };
            if (normalizedSegment.startHour < timelineSplitHour && normalizedSegment.endHour > timelineSplitHour) {
                return [
                    {...normalizedSegment, id: `${normalizedSegment.id}-day`, endHour: timelineSplitHour},
                    {...normalizedSegment, id: `${normalizedSegment.id}-night`, startHour: timelineSplitHour},
                ];
            }
            return [normalizedSegment];
        })
        .filter(segment => segment.endHour - segment.startHour >= manualPlanMinSegmentHours)
        .sort((a, b) => a.rowIndex === b.rowIndex ?
            a.startHour === b.startHour ? a.endHour - b.endHour : a.startHour - b.startHour :
            a.rowIndex - b.rowIndex);
    const ret: StoredManualSegment[] = [];
    for (const segment of normalized) {
        const last = ret[ret.length - 1];
        if (last !== undefined && last.rowIndex === segment.rowIndex) {
            if (last.itemId === segment.itemId &&
                getManualSegmentPeriod(last) === getManualSegmentPeriod(segment) &&
                Math.abs(segment.startHour - last.endHour) < 1e-6
            ) {
                last.endHour = Math.max(last.endHour, segment.endHour);
                continue;
            }
        }
        ret.push({...segment});
    }
    return ret;
}

function getManualSegmentPeriod(segment: Pick<StoredManualSegment, 'startHour' | 'endHour'>): TimelinePeriod {
    const middle = (segment.startHour + segment.endHour) / 2;
    return middle >= timelineSplitHour ? 'night' : 'day';
}

function addManualSegmentToPeriodStart(
    segments: StoredManualSegment[],
    itemId: number,
    rowIndex: number,
    period: TimelinePeriod,
    hours: number,
): StoredManualSegment[] {
    const normalized = normalizeStoredManualSegments(segments);
    const periodRange = getTimelinePeriodRange(period);
    const insertStartHour = periodRange.startHour;
    const insertEndHour = Math.min(periodRange.endHour, insertStartHour + hours);
    const normalizedRowIndex = Math.max(0, Math.min(4, Math.floor(rowIndex)));
    const insertDuration = insertEndHour - insertStartHour;
    const insertedSegment: StoredManualSegment = {
        id: `quick-${itemId}-${normalizedRowIndex}-${period}-${Date.now()}`,
        itemId,
        rowIndex: normalizedRowIndex,
        startHour: insertStartHour,
        endHour: insertEndHour,
    };
    const samePeriodSegments = normalized
        .filter(segment =>
            segment.rowIndex === normalizedRowIndex &&
            getManualSegmentPeriod(segment) === period)
        .sort((a, b) => a.startHour === b.startHour ? a.endHour - b.endHour : a.startHour - b.startHour);
    const isInsertRangeOccupied = samePeriodSegments.some(segment =>
        segment.startHour < insertEndHour && segment.endHour > insertStartHour);
    if (!isInsertRangeOccupied) {
        return normalizeStoredManualSegments([...normalized, insertedSegment]);
    }

    const shrinkIndex = samePeriodSegments.findIndex(segment =>
        segment.endHour - segment.startHour - insertDuration >= manualPlanMinSegmentHours);
    if (shrinkIndex < 0) {
        return normalizeStoredManualSegments([...normalized, insertedSegment]);
    }

    const shiftedById = new Map<string, StoredManualSegment>();
    let cursor = insertEndHour;
    for (let index = 0; index <= shrinkIndex; index++) {
        const segment = samePeriodSegments[index];
        const originalDuration = segment.endHour - segment.startHour;
        const nextDuration = index === shrinkIndex ? originalDuration - insertDuration : originalDuration;
        shiftedById.set(segment.id, {
            ...segment,
            startHour: cursor,
            endHour: Math.min(periodRange.endHour, cursor + nextDuration),
        });
        cursor += nextDuration;
    }

    return normalizeStoredManualSegments([
        insertedSegment,
        ...normalized.map(segment => shiftedById.get(segment.id) ?? segment),
    ]);
}

function resizeStoredManualBoundary(
    segments: StoredManualSegment[],
    timelineSegment: TimelineSegment,
    side: 'start' | 'end',
    nextHour: number,
): StoredManualSegment[] {
    const targetIndex = findStoredManualSegmentIndex(segments, timelineSegment);
    if (targetIndex < 0) {
        return segments;
    }
    const target = segments[targetIndex];
    const periodRange = getTimelinePeriodRange(getManualSegmentPeriod(target));
    const sameRow = segments
        .map((segment, index) => ({segment, index}))
        .filter(item =>
            item.segment.rowIndex === target.rowIndex &&
            getManualSegmentPeriod(item.segment) === getManualSegmentPeriod(target))
        .sort((a, b) => a.segment.startHour - b.segment.startHour);
    const targetRowIndex = sameRow.findIndex(item => item.index === targetIndex);
    const neighborIndex = side === 'start' ?
        sameRow[targetRowIndex - 1]?.index ?? -1 :
        sameRow[targetRowIndex + 1]?.index ?? -1;

    if (side === 'start') {
        const minHour = neighborIndex >= 0 ?
            segments[neighborIndex].startHour + manualPlanMinSegmentHours :
            periodRange.startHour;
        const maxHour = target.endHour - manualPlanMinSegmentHours;
        const boundary = Math.max(minHour, Math.min(maxHour, nextHour));
        return segments.map((segment, currentIndex) => {
            if (currentIndex === targetIndex) {
                return {...segment, startHour: boundary};
            }
            if (currentIndex === neighborIndex) {
                return {...segment, endHour: boundary};
            }
            return segment;
        });
    }

    const minHour = target.startHour + manualPlanMinSegmentHours;
    const maxHour = neighborIndex >= 0 ?
        segments[neighborIndex].endHour - manualPlanMinSegmentHours :
        periodRange.endHour;
    const boundary = Math.max(minHour, Math.min(maxHour, nextHour));
    return segments.map((segment, currentIndex) => {
        if (currentIndex === targetIndex) {
            return {...segment, endHour: boundary};
        }
        if (currentIndex === neighborIndex) {
            return {...segment, startHour: boundary};
        }
        return segment;
    });
}

function swapStoredManualNeighbor(
    segments: StoredManualSegment[],
    timelineSegment: TimelineSegment,
    direction: 'left' | 'right',
): StoredManualSegment[] {
    const targetIndex = findStoredManualSegmentIndex(segments, timelineSegment);
    if (targetIndex < 0) {
        return segments;
    }
    const target = segments[targetIndex];
    const period = getManualSegmentPeriod(target);
    const sameRow = segments
        .map((segment, index) => ({segment, index}))
        .filter(item =>
            item.segment.rowIndex === target.rowIndex &&
            getManualSegmentPeriod(item.segment) === period)
        .sort((a, b) => a.segment.startHour - b.segment.startHour);
    const targetRowIndex = sameRow.findIndex(item => item.index === targetIndex);
    const neighborIndex = direction === 'left' ?
        sameRow[targetRowIndex - 1]?.index ?? -1 :
        sameRow[targetRowIndex + 1]?.index ?? -1;
    if (neighborIndex < 0) {
        return segments;
    }
    const neighbor = segments[neighborIndex];
    const targetDuration = target.endHour - target.startHour;
    const neighborDuration = neighbor.endHour - neighbor.startHour;
    const left = direction === 'left' ? neighbor : target;
    const right = direction === 'left' ? target : neighbor;
    const gap = Math.max(0, right.startHour - left.endHour);
    const firstStart = left.startHour;
    const secondStart = firstStart + right.endHour - right.startHour + gap;

    return segments.map((segment, index) => {
        if (index === targetIndex) {
            if (direction === 'left') {
                return {...segment, startHour: firstStart, endHour: firstStart + targetDuration};
            }
            return {...segment, startHour: secondStart, endHour: secondStart + targetDuration};
        }
        if (index === neighborIndex) {
            if (direction === 'left') {
                return {...segment, startHour: secondStart, endHour: secondStart + neighborDuration};
            }
            return {...segment, startHour: firstStart, endHour: firstStart + neighborDuration};
        }
        return segment;
    });
}

function mergeIngredientCounts(
    a: Partial<Record<IngredientName, number>>,
    b: Partial<Record<IngredientName, number>>,
): Partial<Record<IngredientName, number>> {
    const ret = {...a};
    for (const ingredientName of IngredientNames) {
        const value = b[ingredientName] ?? 0;
        if (value > 0) {
            ret[ingredientName] = (ret[ingredientName] ?? 0) + value;
        }
    }
    return ret;
}

function mergeContinuousSegments(row: TimelineSegment[]): TimelineSegment[] {
    const ret: TimelineSegment[] = [];
    for (const segment of row) {
        const last = ret[ret.length - 1];
        if (last !== undefined &&
            last.itemId === segment.itemId &&
            last.isNight === segment.isNight &&
            Math.abs(last.startHour + last.hours - segment.startHour) < 1e-6
        ) {
            last.hours += segment.hours;
            last.ingredientCounts = mergeIngredientCounts(last.ingredientCounts, segment.ingredientCounts);
            last.energyEnd = segment.energyEnd;
            last.skillTriggerCount += segment.skillTriggerCount;
            continue;
        }
        ret.push({...segment});
    }
    return ret;
}

function createTimelineSegment(
    member: DailyPlannerAllocationMember,
    segment: DailyPlannerAllocationSegment,
    t: (key: string) => string,
): TimelineSegment {
    const color = getMemberColor(member.item.iv.idForm);
    const hours = segment.endHour - segment.startHour;
    return {
        itemId: member.item.id,
        rowIndex: segment.rowIndex,
        name: member.item.filledNickname(t),
        idForm: member.item.iv.idForm,
        startHour: segment.startHour,
        hours,
        color,
        ingredientCounts: segment.ingredientCounts,
        energyStart: segment.energyStart,
        energyEnd: segment.energyEnd,
        skillTriggerCount: segment.skillTriggerCount,
        isNight: segment.isNight,
    };
}

function createTimelineRows(members: DailyPlannerAllocationMember[],
    t: (key: string) => string): TimelineSegment[][] {
    const rows: TimelineSegment[][] = [[], [], [], [], []];
    if (members.some(member => member.segments.length > 0)) {
        for (const member of members) {
            for (const segment of member.segments) {
                rows[segment.rowIndex]?.push(createTimelineSegment(member, segment, t));
            }
        }
        for (const row of rows) {
            row.sort((a, b) => a.startHour - b.startHour);
        }
        return rows.map(mergeContinuousSegments);
    }

    const rowHours = [0, 0, 0, 0, 0];
    const segments = members.map(member => {
        const color = getMemberColor(member.item.iv.idForm);
        return {
            itemId: member.item.id,
            rowIndex: -1,
            name: member.item.filledNickname(t),
            idForm: member.item.iv.idForm,
            startHour: 0,
            hours: member.totalHours,
            color,
            ingredientCounts: member.ingredientCounts,
            energyStart: 100,
            energyEnd: Math.max(0, 100 - member.totalHours * 6),
            skillTriggerCount: 0,
            isNight: false,
        };
    }).filter(segment => segment.hours > 0);

    for (const segment of segments) {
        let rest = segment.hours;
        while (rest > 0) {
            const rowIndex = rowHours.findIndex(hours => hours < 24);
            if (rowIndex < 0) {
                break;
            }
            const allocated = Math.min(rest, 24 - rowHours[rowIndex]);
            rows[rowIndex].push({
                ...segment,
                rowIndex,
                startHour: rowHours[rowIndex],
                hours: allocated,
                energyStart: 100,
                energyEnd: Math.max(0, 100 - allocated * 6),
                skillTriggerCount: 0,
                isNight: false,
            });
            rowHours[rowIndex] += allocated;
            rest -= allocated;
        }
    }
    return rows;
}

function createManualTimelineRows(
    segments: StoredManualSegment[],
    members: DailyPlannerAllocationMember[],
    t: (key: string) => string,
): TimelineSegment[][] {
    const rows: TimelineSegment[][] = [[], [], [], [], []];
    const memberByItemId = new Map(members.map(member => [member.item.id, member]));
    for (const segment of segments) {
        const member = memberByItemId.get(segment.itemId);
        if (member === undefined) {
            continue;
        }
        const hours = segment.endHour - segment.startHour;
        if (hours <= 0) {
            continue;
        }
        const rowIndex = Math.max(0, Math.min(4, Math.floor(segment.rowIndex)));
        const calculated = summarizeCalculatedSegmentsForManualSegment(member.segments, segment, rowIndex);
        rows[rowIndex].push({
            manualSegmentId: segment.id,
            itemId: member.item.id,
            rowIndex,
            name: member.item.filledNickname(t),
            idForm: member.item.iv.idForm,
            startHour: segment.startHour,
            hours,
            color: getMemberColor(member.item.iv.idForm),
            ingredientCounts: calculated.ingredientCounts,
            energyStart: calculated.energyStart,
            energyEnd: calculated.energyEnd,
            skillTriggerCount: calculated.skillTriggerCount,
            isNight: segment.startHour >= timelineSplitHour,
        });
    }
    for (const row of rows) {
        row.sort((a, b) => a.startHour === b.startHour ?
            a.itemId - b.itemId :
            a.startHour - b.startHour);
    }
    return rows;
}

function summarizeCalculatedSegmentsForManualSegment(
    calculatedSegments: DailyPlannerAllocationSegment[],
    manualSegment: StoredManualSegment,
    rowIndex: number,
): {
    ingredientCounts: Partial<Record<IngredientName, number>>;
    energyStart: number;
    energyEnd: number;
    skillTriggerCount: number;
} {
    const matched = calculatedSegments
        .filter(segment =>
            segment.rowIndex === rowIndex &&
            segment.startHour < manualSegment.endHour - 1e-9 &&
            segment.endHour > manualSegment.startHour + 1e-9)
        .sort((a, b) => a.startHour - b.startHour);

    if (matched.length === 0) {
        return {
            ingredientCounts: {},
            energyStart: 0,
            energyEnd: 0,
            skillTriggerCount: 0,
        };
    }

    const ingredientCounts: Partial<Record<IngredientName, number>> = {};
    let skillTriggerCount = 0;
    let energyStart = matched[0].energyStart;
    let energyEnd = matched[matched.length - 1].energyEnd;
    for (let index = 0; index < matched.length; index++) {
        const segment = matched[index];
        const segmentHours = segment.endHour - segment.startHour;
        const clippedStart = Math.max(manualSegment.startHour, segment.startHour);
        const clippedEnd = Math.min(manualSegment.endHour, segment.endHour);
        const clippedHours = clippedEnd - clippedStart;
        if (segmentHours <= 0 || clippedHours <= 0) {
            continue;
        }
        const startRate = (clippedStart - segment.startHour) / segmentHours;
        const endRate = (clippedEnd - segment.startHour) / segmentHours;
        if (index === 0) {
            energyStart = interpolate(segment.energyStart, segment.energyEnd, startRate);
        }
        if (index === matched.length - 1) {
            energyEnd = interpolate(segment.energyStart, segment.energyEnd, endRate);
        }
        const scale = clippedHours / segmentHours;
        addScaledTimelineIngredientCounts(ingredientCounts, segment.ingredientCounts, scale);
        skillTriggerCount += segment.skillTriggerCount * scale;
    }

    return {
        ingredientCounts,
        energyStart,
        energyEnd,
        skillTriggerCount,
    };
}

function addScaledTimelineIngredientCounts(
    target: Partial<Record<IngredientName, number>>,
    source: Partial<Record<IngredientName, number>>,
    scale: number,
): void {
    for (const ingredientName of IngredientNames) {
        const value = source[ingredientName] ?? 0;
        if (value > 0) {
            target[ingredientName] = (target[ingredientName] ?? 0) + value * scale;
        }
    }
}

const StyledRoot = styled('div')({
    '& section.summary': {
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '.5rem',
        padding: '.65rem .75rem .8rem',
        '& > header': {
            display: 'flex',
            gap: '.75rem',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            '& h3': {
                margin: 0,
                fontSize: '1rem',
                lineHeight: 1.1,
                '& > small': {
                    marginLeft: '.45rem',
                    color: '#777',
                    fontSize: '.72rem',
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                },
            },
            '& .header-actions': {
                display: 'flex',
                gap: '.4rem',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
            },
            '& .mode-switch': {
                display: 'inline-flex',
                gap: '.2rem',
            },
        },
    },
    '& .cards': {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '.35rem',
        marginTop: '.4rem',
        '& > div': {
            border: '1px solid #e6e6e6',
            borderRadius: '.4rem',
            padding: '.32rem .45rem',
            '& > p': {
                display: 'inline',
                marginRight: '.45rem',
                fontSize: '.72rem',
            },
            '& > h6': {
                display: 'inline',
            },
            '& > details': {
                marginTop: '.18rem',
                '& > summary': {
                    width: 'fit-content',
                    color: '#666',
                    fontSize: '.72rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                },
                '& > ul': {
                    display: 'grid',
                    gap: '.18rem',
                    margin: '.25rem 0 0',
                    padding: 0,
                    listStyle: 'none',
                    maxHeight: '7rem',
                    overflow: 'auto',
                    '& > li': {
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                        gap: '.25rem',
                        alignItems: 'center',
                        color: '#555',
                        fontSize: '.72rem',
                        '& > span': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        },
                        '& > strong': {
                            color: '#333',
                            fontWeight: 600,
                        },
                    },
                },
            },
        },
    },
    '& .timeline': {
        display: 'grid',
        gap: '16px',
        marginTop: '.85rem',
        paddingBottom: '.55rem',
    },
    '& .manual-editor': {
        marginTop: '.65rem',
        border: '1px solid #e6e6e6',
        borderRadius: '.5rem',
        padding: '.35rem .45rem',
        background: '#fbfcff',
        '& > summary': {
            display: 'flex',
            alignItems: 'center',
            gap: '.35rem',
            width: 'fit-content',
            color: '#555',
            cursor: 'pointer',
            listStyle: 'none',
            userSelect: 'none',
            '&::-webkit-details-marker': {
                display: 'none',
            },
            '&::before': {
                content: '"▼"',
                color: '#888',
                fontSize: '.65rem',
            },
            '& > span': {
                fontSize: '.875rem',
            },
            '& > small': {
                color: '#888',
                fontSize: '.75rem',
            },
        },
        '&:not([open]) > summary::before': {
            content: '"▶"',
        },
        '& .manual-slots': {
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '.25rem',
            marginTop: '.3rem',
            '& > span': {
                color: '#666',
                fontSize: '.75rem',
            },
            '& button': {
                minWidth: '2rem',
                padding: '1px .35rem',
                fontSize: '.75rem',
            },
        },
        '& .manual-controls': {
            display: 'grid',
            gridTemplateColumns: '4rem minmax(9rem, 1fr) 7rem 7rem auto auto',
            gap: '.45rem',
            alignItems: 'end',
            marginTop: '.3rem',
        },
        '& .manual-segments': {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '.35rem',
            marginTop: '.35rem',
            '& > span': {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.25rem',
                maxWidth: '100%',
                border: '1px solid #dde3ee',
                borderRadius: '999px',
                padding: '.15rem .2rem .15rem .35rem',
                background: 'white',
                fontSize: '.75rem',
                '& > b': {
                    color: '#667',
                },
                '& > span': {
                    maxWidth: '8rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                },
                '& > small': {
                    color: '#666',
                    whiteSpace: 'nowrap',
                },
                '& button': {
                    minWidth: 'auto',
                    padding: '0 .3rem',
                    fontSize: '.7rem',
                },
            },
        },
    },
    '& .helping-bonus-row, & .timeline-row': {
        display: 'grid',
        gridTemplateColumns: '1.4rem 1fr',
        gap: '.35rem',
        alignItems: 'center',
        '& > span': {
            color: '#777',
            fontSize: '.75rem',
            textAlign: 'right',
        },
    },
    '& .helping-bonus-row': {
        marginBottom: '-10px',
        '& > span': {
            color: '#4e6a52',
            fontSize: '.62rem',
            fontWeight: 700,
        },
        '& .timeline-track': {
            display: 'grid',
            gridTemplateColumns: `${timelineSplitHour}fr ${24 - timelineSplitHour}fr`,
            gap: '.65rem',
            alignItems: 'stretch',
        },
        '& .timeline-part': {
            position: 'relative',
            height: '12px',
            border: '1px solid #d8e7da',
            borderRadius: '999px',
            overflow: 'hidden',
            borderColor: '#d8e7da',
            background: '#f8fbf7',
        },
        '& .helping-bonus-label': {
            position: 'absolute',
            zIndex: 4,
            left: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '0 4px',
            borderRadius: '999px',
            background: 'rgba(248,251,247,.88)',
            color: '#4e6a52',
            fontSize: '.55rem',
            fontWeight: 700,
            lineHeight: 1,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
        },
        '& .helping-bonus-segment': {
            position: 'absolute',
            top: 0,
            bottom: 0,
            minWidth: '2px',
            borderRight: '1px solid rgba(255,255,255,.7)',
            background: 'rgba(175, 205, 172, .28)',
            '& > b': {
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#285d32',
                fontSize: '.58rem',
                lineHeight: 1,
            },
            '&.count-1': {
                background: 'rgba(142, 201, 129, .38)',
            },
            '&.count-2': {
                background: 'rgba(103, 184, 93, .48)',
            },
            '&.count-3': {
                background: 'rgba(75, 162, 73, .58)',
            },
            '&.count-4, &.count-5': {
                background: 'rgba(48, 139, 59, .68)',
            },
        },
    },
    '& .timeline-row': {
        '& .timeline-track': {
            display: 'grid',
            gridTemplateColumns: `${timelineSplitHour}fr ${24 - timelineSplitHour}fr`,
            gap: '.65rem',
            alignItems: 'stretch',
        },
        '& .timeline-part': {
            position: 'relative',
            height: '22px',
            border: '1px solid #ddd',
            borderRadius: '999px',
            overflow: 'visible',
            background: '#f3f3f3',
            '&.day-part': {
                background: '#f7fbff',
            },
            '&.night-part': {
                background: '#f7f4ff',
            },
            '& .time-marker': {
                position: 'absolute',
                zIndex: 2,
                top: 0,
                bottom: 0,
                width: '2px',
                background: 'rgba(30, 50, 80, .45)',
                boxShadow: '0 0 0 1px rgba(255,255,255,.55)',
                pointerEvents: 'none',
                '& > em': {
                    position: 'absolute',
                    left: '50%',
                    bottom: '-3px',
                    transform: 'translate(-50%, 100%)',
                    padding: '0 2px',
                    borderRadius: '3px',
                    background: 'rgba(255,255,255,.85)',
                    color: '#667',
                    fontSize: '.58rem',
                    fontStyle: 'normal',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                },
                '&.start-marker > em': {
                    left: 0,
                    transform: 'translate(0, 100%)',
                },
                '&.sub-marker': {
                    width: '1px',
                    background: 'rgba(30, 50, 80, .22)',
                    boxShadow: 'none',
                    '& > em': {
                        color: '#889',
                        background: 'rgba(255,255,255,.72)',
                    },
                },
            },
            '& > .duplicate-row-overlay': {
                position: 'absolute',
                zIndex: 5,
                top: 0,
                bottom: 0,
                borderRadius: '999px',
                pointerEvents: 'none',
                backgroundImage: `repeating-linear-gradient(
                    135deg,
                    rgba(210, 30, 30, .7) 0,
                    rgba(210, 30, 30, .7) 2px,
                    transparent 2px,
                    transparent 7px
                )`,
            },
            '& > i': {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'absolute',
                top: 0,
                bottom: 0,
                minWidth: '2px',
                borderRight: '1px solid rgba(255,255,255,.55)',
                overflow: 'visible',
                '& > .segment-time': {
                    position: 'absolute',
                    left: 0,
                    top: '-13px',
                    zIndex: 2,
                    padding: '0 2px',
                    borderRadius: '3px',
                    background: 'rgba(255,255,255,.72)',
                    color: '#555',
                    fontSize: '.58rem',
                    fontStyle: 'normal',
                    lineHeight: 1.05,
                    whiteSpace: 'nowrap',
                },
                '& > .segment-icon': {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    zIndex: 3,
                    left: '3px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,.78)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,.12)',
                },
                '& > .duplicate-overlay': {
                    position: 'absolute',
                    zIndex: 2,
                    top: 0,
                    bottom: 0,
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                    backgroundImage: `repeating-linear-gradient(
                        135deg,
                        rgba(210, 30, 30, .72) 0,
                        rgba(210, 30, 30, .72) 2px,
                        transparent 2px,
                        transparent 7px
                    )`,
                    '&.counted': {
                        opacity: .38,
                    },
                    '&.ignored': {
                        opacity: .9,
                    },
                },
                '& > .segment-yield': {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '.15rem',
                    position: 'absolute',
                    zIndex: 3,
                    left: '26px',
                    maxWidth: 'calc(100% - 28px)',
                    overflow: 'hidden',
                    color: '#334',
                    fontSize: '.58rem',
                    fontStyle: 'normal',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 0 rgba(255,255,255,.65)',
                    '& > span': {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '1px',
                    },
                    '& svg': {
                        width: '.72rem',
                        height: '.72rem',
                    },
                },
                '& > .skill-trigger-marker': {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    zIndex: 4,
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '999px',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255,255,255,.92)',
                    color: '#d86b00',
                    fontSize: '.75rem',
                    fontStyle: 'normal',
                    fontWeight: 800,
                    lineHeight: 1,
                    boxShadow: '0 0 0 1px rgba(42,75,120,.35), 0 1px 4px rgba(0,0,0,.16)',
                    pointerEvents: 'auto',
                },
                '& > .energy-overlay': {
                    display: 'none',
                    position: 'absolute',
                    zIndex: 8,
                    left: '50%',
                    top: '-30px',
                    transform: 'translateX(-50%)',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    background: 'rgba(28, 34, 46, .92)',
                    color: 'white',
                    fontSize: '.68rem',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,.2)',
                },
                '&:hover > .energy-overlay': {
                    display: 'block',
                },
                '& > .resize-handle': {
                    display: 'block',
                    position: 'absolute',
                    zIndex: 6,
                    top: '-2px',
                    bottom: '-2px',
                    width: '8px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,.85)',
                    boxShadow: '0 0 0 1px rgba(50,70,100,.35)',
                    cursor: 'ew-resize',
                    touchAction: 'none',
                    opacity: .25,
                    '&:hover': {
                        opacity: 1,
                    },
                },
                '& > .start-handle': {
                    left: '-4px',
                },
                '& > .end-handle': {
                    right: '-4px',
                },
                '& > .swap-handle': {
                    position: 'absolute',
                    zIndex: 7,
                    top: '50%',
                    width: '16px',
                    height: '16px',
                    padding: 0,
                    border: '1px solid rgba(70,90,120,.35)',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,.88)',
                    color: '#456',
                    fontSize: '.8rem',
                    lineHeight: '12px',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    opacity: .45,
                    '&:hover': {
                        opacity: 1,
                    },
                },
                '& > .left-swap': {
                    left: '10px',
                },
                '& > .right-swap': {
                    right: '10px',
                },
            },
        },
    },
    '& .collapsible': {
        marginTop: '.65rem',
        '& > summary': {
            display: 'flex',
            alignItems: 'center',
            gap: '.35rem',
            width: 'fit-content',
            color: '#666',
            cursor: 'pointer',
            listStyle: 'none',
            userSelect: 'none',
            '&::-webkit-details-marker': {
                display: 'none',
            },
            '&::before': {
                content: '"▼"',
                color: '#888',
                fontSize: '.65rem',
                transform: 'translateY(-1px)',
            },
            '& > span': {
                fontSize: '.875rem',
                lineHeight: 1,
            },
            '& > small': {
                color: '#888',
                fontSize: '.75rem',
                lineHeight: 1,
            },
        },
        '&:not([open]) > summary::before': {
            content: '"▶"',
        },
    },
    '& .ingredients': {
        '& > div': {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '.35rem',
            marginTop: '.35rem',
        },
        '& article': {
            display: 'grid',
            gridTemplateColumns: 'auto repeat(5, auto)',
            justifyContent: 'start',
            gap: '.35rem',
            alignItems: 'center',
            border: '1px solid #e6e6e6',
            borderRadius: '.4rem',
            padding: '.35rem .45rem',
            fontSize: '.78rem',
            '&.shortage': {
                borderColor: '#f0b5a8',
                background: '#fff7f4',
            },
            '& strong': {
                color: '#9a341f',
            },
        },
        '& .surplus-summary': {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '.4rem',
            alignItems: 'center',
            marginTop: '.45rem',
            padding: '.35rem .45rem',
            border: '1px solid #d9ead6',
            borderRadius: '.4rem',
            background: '#f6fbf4',
            '& > span': {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '.35rem',
            },
            '& > span > span': {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.1rem',
                fontSize: '.78rem',
                color: '#555',
            },
            '& svg': {
                width: '1rem',
                height: '1rem',
            },
        },
    },
    '& .candidate-panel': {
        marginTop: '.55rem',
    },
    '& .members': {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '.4rem',
        marginTop: '.3rem',
        '& > article': {
            display: 'grid',
            gridTemplateColumns: '.45rem auto 1fr',
            gap: '.45rem',
            alignItems: 'center',
            border: '1px solid #e6e6e6',
            borderRadius: '.45rem',
            padding: '.35rem .45rem',
            '& .color': {
                width: '.45rem',
                height: '2rem',
                borderRadius: '999px',
            },
            '& strong': {
                display: 'block',
                fontSize: '.85rem',
                lineHeight: 1.2,
            },
            '& small': {
                display: 'block',
                color: '#666',
                lineHeight: 1.2,
            },
            '& .yield': {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '.25rem',
                marginTop: '.15rem',
                color: '#555',
                fontSize: '.75rem',
                '& > span': {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '.1rem',
                },
                '& svg': {
                    width: '1rem',
                    height: '1rem',
                },
            },
            '& .candidate-add-controls': {
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '.35rem',
                marginTop: '.25rem',
                '& .MuiInputBase-root': {
                    fontSize: '.74rem',
                },
                '& button': {
                    minWidth: 'auto',
                    padding: '1px .45rem',
                    fontSize: '.72rem',
                },
            },
        },
    },
    '@media (max-width: 640px)': {
        '& .cards': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        },
        '& .manual-editor .manual-controls': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        },
    },
});

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

    const setPersistentValue = React.useCallback<React.Dispatch<React.SetStateAction<T>>>((action) => {
        setValue(prev => {
            const next = typeof action === 'function' ?
                (action as (prevState: T) => T)(prev) :
                action;
            localStorage.setItem(key, JSON.stringify(next));
            return next;
        });
    }, [key]);

    return [value, setPersistentValue];
}

function readStoredJson<T>(key: string, fallback: T): T {
    const stored = localStorage.getItem(key);
    if (stored === null) {
        return fallback;
    }
    try {
        return JSON.parse(stored) as T;
    }
    catch {
        return fallback;
    }
}

export default TeamPlanView;
