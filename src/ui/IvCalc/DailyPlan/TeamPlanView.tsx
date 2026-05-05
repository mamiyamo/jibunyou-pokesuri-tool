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
} from '../../../util/DailyPlanner';
import { formatWithComma, round1 } from '../../../util/NumberUtil';
import { useTranslation } from 'react-i18next';
import { useTeamPlanMealSettings } from './TeamPlanMealSettings';
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
    {hour: 4, label: '4:00'},
    {hour: 7, label: '7:00'},
    {hour: 12, label: '12:00'},
    {hour: 18, label: '18:00'},
    {hour: 22.5, label: '22:30'},
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
    const {mealChoices, stock} = useTeamPlanMealSettings();
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
                <InfoCard label="稼働" value={`${round1(result.totalTeamHours)}h`}/>
                <InfoCard label="きのみ数" value={round1(result.totalBerryCount).toString()}/>
                <InfoCard label="不足" value={result.isDemandSatisfied ? 'なし' : 'あり'}/>
                <InfoCard label="きのみエナジー" value={formatWithComma(Math.round(result.totalBerryEnergy))}/>
            </div>

            <TeamTimeline members={result.candidates}/>

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
                                    稼働 {round1(member.workHours)}h / きのみ {round1(member.berryCount)}個 / エナジー {formatWithComma(Math.round(member.berryEnergy))}
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

const InfoCard = React.memo(({label, value}: {
    label: string;
    value: string;
}) => <div>
    <Typography variant="body2" sx={{color: '#666'}}>{label}</Typography>
    <Typography variant="h6" sx={{fontSize: '1.05rem', lineHeight: 1.2}}>{value}</Typography>
</div>);

const TeamTimeline = React.memo(({members}: {
    members: DailyPlannerAllocationMember[];
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
                            className="time-marker"
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
                            '--icon-left': `${segment.iconLeftPercent}%`,
                        } as React.CSSProperties}>
                            {segment.startHour > 0 && <em className="segment-time">
                                {formatTimelineHour(segment.startHour)}
                            </em>}
                            <span><PokemonIcon idForm={segment.idForm} size={18}/></span>
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

type TimelineSegment = {
    name: string;
    idForm: number;
    startHour: number;
    hours: number;
    color: string;
    iconLeftPercent: number;
};

function formatTimelineHour(hour: number): string {
    const normalized = ((hour % 24) + 24) % 24;
    const h = Math.floor(normalized);
    const m = Math.round((normalized - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
}

function getIconLeftPercent(startHour: number, hours: number): number {
    const baseLeft = Math.min(88, Math.max(12, 240 / Math.max(hours, 0.1)));
    const overlappedMarker = timeMarkers.find(marker =>
        marker.hour > startHour && marker.hour < startHour + hours &&
        Math.abs((marker.hour - startHour) / hours * 100 - baseLeft) < 16);
    if (overlappedMarker === undefined) {
        return baseLeft;
    }
    const markerPercent = (overlappedMarker.hour - startHour) / hours * 100;
    return markerPercent <= baseLeft ? Math.min(88, markerPercent + 18) : Math.max(12, markerPercent - 18);
}

function createTimelineRows(members: DailyPlannerAllocationMember[],
    t: (key: string) => string): TimelineSegment[][] {
    const rows: TimelineSegment[][] = [[], [], [], [], []];
    const rowHours = [0, 0, 0, 0, 0];
    const segments = members.map(member => {
        const color = getMemberColor(member.item.iv.idForm);
        return {
            name: member.item.filledNickname(t),
            idForm: member.item.iv.idForm,
            startHour: 0,
            hours: member.totalHours,
            color,
            iconLeftPercent: 50,
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
                iconLeftPercent: getIconLeftPercent(rowHours[rowIndex], allocated),
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
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '.45rem',
        marginTop: '.55rem',
        '& > div': {
            border: '1px solid #e6e6e6',
            borderRadius: '.4rem',
            padding: '.45rem .55rem',
        },
    },
    '& .timeline': {
        display: 'grid',
        gap: '12px',
        marginTop: '.65rem',
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
                    top: 0,
                    padding: '0 2px',
                    borderRadius: '0 0 3px 0',
                    background: 'rgba(255,255,255,.72)',
                    color: '#555',
                    fontSize: '.58rem',
                    fontStyle: 'normal',
                    lineHeight: 1.05,
                    whiteSpace: 'nowrap',
                },
                '& > span': {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    left: 'var(--icon-left, 50%)',
                    transform: 'translateX(-50%)',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,.78)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,.12)',
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
