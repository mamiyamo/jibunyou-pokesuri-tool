import React from 'react';
import { styled } from '@mui/system';
import { Button, Typography } from '@mui/material';
import { IngredientName, IngredientNames } from '../../../data/pokemons';
import IvState, { IvAction } from '../IvState';
import IngredientIcon from '../IngredientIcon';
import PokemonIcon from '../PokemonIcon';
import PokemonIconData from '../PokemonIconData';
import {
    calculateDailyTeamAllocationResult,
    DailyPlannerAllocationMember,
    DailyPlannerAllocationSegment,
} from '../../../util/DailyPlanner';
import { formatWithComma, round1 } from '../../../util/NumberUtil';
import { useTranslation } from 'react-i18next';
import { TeamPlanSkillRoundingMode, useTeamPlanMealSettings } from './TeamPlanMealSettings';
import PokemonIv from '../../../util/PokemonIv';

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
    const candidates = React.useMemo(() => {
        return state.teamPlanSelectedItemIds
            .map(id => state.box.items.find(item => item.id === id))
            .filter((item): item is NonNullable<typeof item> => item !== undefined);
    }, [state.box.items, state.teamPlanSelectedItemIds]);
    const result = React.useMemo(() => calculateDailyTeamAllocationResult(
        candidates,
        state.parameter,
        mealChoices,
        stock,
    ), [candidates, mealChoices, state.parameter, stock]);
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

    return <StyledRoot>
        <section className="summary">
            <header>
                <div>
                    <h3>1日チーム編成</h3>
                    <Typography variant="body2" sx={{color: '#666'}}>
                        下のボックスで選択した最大10匹を候補に、24時間×5枠の原型を表示します。
                    </Typography>
                </div>
                <Button size="small" onClick={onSettingClick}>設定</Button>
            </header>

            <div className="cards">
                <InfoCard label="きのみエナジー" value={formatWithComma(Math.round(result.totalBerryEnergy))}
                    breakdown={energyBreakdown.berry}/>
                <InfoCard label="料理エナジー" value={formatWithComma(Math.round(result.totalMealEnergy))}
                    breakdown={energyBreakdown.meal}/>
                <InfoCard label="スキルエナジー" value={formatWithComma(Math.round(result.totalSkillEnergy))}
                    breakdown={energyBreakdown.skill}/>
            </div>

            <TeamTimeline members={result.candidates} skillRoundingMode={skillRoundingMode}/>

            <IngredientShortageView
                demand={result.demand}
                stock={result.stock}
                supply={ingredientSupply}
                randomSupply={randomIngredientSupply}
                remaining={result.remainingDemand}
            />

            <details className="collapsible candidate-panel" open>
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

const TeamTimeline = React.memo(({members, skillRoundingMode}: {
    members: DailyPlannerAllocationMember[];
    skillRoundingMode: TeamPlanSkillRoundingMode;
}) => {
    const { t } = useTranslation();
    const rows = React.useMemo(() => createTimelineRows(members, t), [members, t]);
    return <div className="timeline">
        {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="timeline-row">
                <span>{rowIndex + 1}</span>
                <div>
                    {timeMarkers.map(marker => (
                        <b
                            key={marker.hour}
                            className={`time-marker ${marker.kind}-marker ${marker.hour === 0 ? 'start-marker' : ''}`}
                            title={marker.label}
                            style={{left: `${marker.hour / 24 * 100}%`}}
                        >
                            {rowIndex === rows.length - 1 && <em>{marker.label}</em>}
                        </b>
                    ))}
                    {row.map((segment, segmentIndex) => (
                        <i key={segmentIndex} title={`${segment.name}: ${round1(segment.hours)}h`} style={{
                            width: `${segment.hours / 24 * 100}%`,
                            background: segment.color,
                        }}>
                            {segment.startHour > 0 && <em className="segment-time">
                                {formatTimelineHour(segment.startHour + timelineStartClockHour)}頃
                            </em>}
                            <span className="segment-icon"><PokemonIcon idForm={segment.idForm} size={18}/></span>
                            <IngredientSegmentYield counts={segment.ingredientCounts}/>
                            <SkillTriggerMarkers count={segment.skillTriggerCount}
                                roundingMode={skillRoundingMode}/>
                            <span className="energy-overlay">
                                元気 {Math.round(segment.energyStart)} → {Math.round(segment.energyEnd)}
                            </span>
                        </i>
                    ))}
                </div>
            </div>
        ))}
    </div>;
});

const IngredientShortageView = React.memo(({
    demand, stock, supply, randomSupply, remaining,
}: {
    demand: Partial<Record<IngredientName, number>>;
    stock: Partial<Record<IngredientName, number>>;
    supply: Partial<Record<IngredientName, number>>;
    randomSupply: Partial<Record<IngredientName, number>>;
    remaining: Partial<Record<IngredientName, number>>;
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

    return <details className="collapsible ingredients" open>
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

function formatTimelineHour(hour: number): string {
    const normalized = ((hour % 24) + 24) % 24;
    const h = Math.floor(normalized);
    const m = Math.round((normalized - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
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
            last.idForm === segment.idForm &&
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
            },
        },
    },
    '& .cards': {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '.45rem',
        marginTop: '.55rem',
        '& > div': {
            border: '1px solid #e6e6e6',
            borderRadius: '.4rem',
            padding: '.45rem .55rem',
            '& > details': {
                marginTop: '.35rem',
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
    '& .timeline-row': {
        display: 'grid',
        gridTemplateColumns: '1.4rem 1fr',
        gap: '.35rem',
        alignItems: 'center',
        '& > span': {
            color: '#777',
            fontSize: '.75rem',
            textAlign: 'right',
        },
        '& > div': {
            display: 'flex',
            position: 'relative',
            height: '22px',
            border: '1px solid #ddd',
            borderRadius: '999px',
            overflow: 'visible',
            background: '#f3f3f3',
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
            '& > i': {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
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
        },
    },
    '@media (max-width: 640px)': {
        '& .cards': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        },
    },
});

export default TeamPlanView;
