import AppLayout from '@/layouts/app-layout';
import app from '@/routes/app';
import type { BreadcrumbItem, PaginatedResponse } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectionBar } from './bulk-pane';
import { DecidedList, DecisionPane, decisionColor } from './decided';
import { panelMode } from './geo';
import { SOURCE_COLOR, type ProposalRow } from './location-proposals';
import { QueueHeader, QueueList, TYPE_COLORS } from './queue-list';
import { ReviewPane } from './review-pane';
import { ShortcutsDialog, useShortcuts } from './shortcuts';
import {
    filterQuery,
    itemUrl,
    type Filters,
    type HistoryRow,
    type ItemLink,
    type Options,
    type Position,
    type QueueItem,
    type SelectedItem,
} from './types';
import { Workspace } from './workspace';

/** Where the overview starts when the queue is empty. */
const NETHERLANDS = { latitude: 52.2, longitude: 5.3 };
const COUNTRY_ZOOM = 7;

type PageProps = {
    status: 'open' | 'decided';
    locationProposals?: ProposalRow[];
    filters: Filters;
    items: PaginatedResponse<QueueItem> | null;
    history: PaginatedResponse<HistoryRow> | null;
    selected: SelectedItem | null;
    position: Position | null;
    decidedToday: number;
    options: Options;
};

/**
 * The community moderation inbox. The map fills the screen and one panel beside it switches between the queue, the
 * item under review and a selection, as on the public map. After a decision the inbox continues with the next item.
 * Selected items are rejected together; approving always happens one item at a time.
 */
export default function Index({ status, locationProposals, filters, items, history, selected, position, decidedToday, options }: PageProps) {
    const { t } = useTranslation('backend/moderation');
    const open = status === 'open';
    const query = filterQuery(filters);
    const [viewing, setViewing] = useState<HistoryRow | null>(null);
    const [checked, setChecked] = useState<string[]>([]);
    const [helping, setHelping] = useState(false);
    useEffect(() => setChecked((keys) => keys.filter((key) => items?.data.some((item) => item.key === key))), [items?.data]);

    const visit = (next: Partial<Filters & { status: string }>) => {
        const merged = { ...filters, ...next };
        router.get(
            app.moderation.index(),
            { ...filterQuery(merged), ...((next.status ?? status) === 'decided' ? { status: 'decided' } : {}) },
            { preserveScroll: true, preserveState: true },
        );
    };

    /** Keep the current view visible until the requested item's details arrive. */
    const [loading, setLoading] = useState<{ preview: QueueItem | null } | null>(null);
    const openItem = (link: ItemLink) => {
        setChecked([]);
        setLoading({ preview: items?.data.find((item) => item.key === link.key) ?? null });
        router.visit(itemUrl(link, query), {
            preserveState: true,
            preserveScroll: true,
            only: ['selected', 'position', 'imagery'],
            onFinish: () => setLoading(null),
        });
    };
    const closeReview = () => {
        setLoading(null);
        router.visit(app.moderation.index({ query }), { preserveState: true, preserveScroll: true, only: ['selected', 'position', 'imagery'] });
    };

    const current = selected;
    const checkedItems = (items?.data ?? []).filter((item) => checked.includes(item.key));
    const first = items?.data[0];
    const mode = panelMode(current !== null, checkedItems.length);
    const [hovered, setHovered] = useState<string | null>(null);
    const proposalPins = (Object.keys(query).length === 0 ? (locationProposals ?? []) : []).flatMap((proposal) =>
        proposal.points.map((point) => ({
            key: `proposal-point:${point.id}`,
            point,
            color: SOURCE_COLOR,
            legendLabel: t('types.proposal'),
            label: `${t('types.proposal')} · ${proposal.municipality} #${proposal.id}`,
        })),
    );
    const decidedPins = (history?.data ?? []).flatMap((row) =>
        row.latitude === null || row.longitude === null
            ? []
            : [
                  {
                      key: row.key,
                      point: { latitude: row.latitude, longitude: row.longitude },
                      color: decisionColor(row),
                      legendLabel: t(row.decision === 'rejected' ? 'history.legend.rejected' : 'history.legend.applied'),
                      label: row.street ?? t('no_address'),
                  },
              ],
    );
    const overviewCenter = first ? { latitude: first.latitude, longitude: first.longitude } : (proposalPins[0]?.point ?? NETHERLANDS);
    useShortcuts({
        j: !current && !checkedItems.length && first && (() => openItem(first)),
        Enter: !current && !checkedItems.length && first && (() => openItem(first)),
        x:
            current &&
            current.type !== 'report' &&
            options.can[current.type] &&
            (() => setChecked((keys) => (keys.includes(current.key) ? keys.filter((key) => key !== current.key) : [...keys, current.key]))),
        '?': () => setHelping(true),
    });

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('title'), href: app.moderation.index() }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={(current ?? viewing)?.street ? `${(current ?? viewing)?.street} · ${t('title')}` : t('title')} />
            <div className="flex h-[calc(100svh-4rem)] min-h-0 md:h-[calc(100svh-5rem)] md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-[calc(100svh-4rem)]">
                {!open ? (
                    <Workspace
                        scope="overview"
                        label={viewing ? t('tabs.decided') : t('queue.label')}
                        map={
                            viewing
                                ? {
                                      center:
                                          viewing.latitude !== null && viewing.longitude !== null
                                              ? { latitude: viewing.latitude, longitude: viewing.longitude }
                                              : NETHERLANDS,
                                      zoom: viewing.latitude !== null ? undefined : COUNTRY_ZOOM,
                                      queue: decidedPins.filter((pin) => pin.key === viewing.key),
                                      highlighted: viewing.key,
                                  }
                                : {
                                      center: decidedPins[0]?.point ?? NETHERLANDS,
                                      zoom: decidedPins.length ? undefined : COUNTRY_ZOOM,
                                      queue: decidedPins,
                                      highlighted: hovered,
                                      onPick: (key) => setViewing(history?.data.find((row) => row.key === key) ?? null),
                                  }
                        }
                    >
                        {viewing ? (
                            <DecisionPane row={viewing} options={options} onBack={() => setViewing(null)} />
                        ) : (
                            <DecidedList
                                history={history}
                                header={
                                    <QueueHeader
                                        status={status}
                                        total={0}
                                        decidedToday={decidedToday}
                                        filters={filters}
                                        options={options}
                                        onFilter={visit}
                                    />
                                }
                                onOpen={setViewing}
                                onHover={setHovered}
                            />
                        )}
                    </Workspace>
                ) : mode === 'item' ? (
                    <ReviewPane
                        selected={selected}
                        position={position}
                        loading={loading}
                        options={options}
                        query={query}
                        onNavigate={openItem}
                        onBack={closeReview}
                    />
                ) : (
                    <Workspace
                        scope="overview"
                        label={t('queue.label')}
                        map={{
                            center: overviewCenter,
                            zoom: first ? undefined : COUNTRY_ZOOM,
                            queue: [
                                ...(items?.data ?? []).map((item) => ({
                                    key: item.key,
                                    point: { latitude: item.latitude, longitude: item.longitude },
                                    color: TYPE_COLORS[item.type],
                                    legendLabel: t(`types.${item.type}`),
                                    label: item.street ?? t('no_address'),
                                    number: checked.includes(item.key) ? checkedItems.indexOf(item) + 1 : undefined,
                                })),
                                ...proposalPins,
                            ],
                            highlighted: hovered,
                            onPick: (key) => {
                                const item = items?.data.find((candidate) => candidate.key === key);
                                if (item) {
                                    openItem(item);
                                    return;
                                }
                                const proposal = proposalPins.find((candidate) => candidate.key === key)?.point;
                                if (proposal)
                                    router.visit(
                                        app.moderation.proposals.index({
                                            query: { proposal: proposal.proposal_id, point: proposal.id, from: 'queue' },
                                        }),
                                    );
                            },
                        }}
                    >
                        <QueueList
                            status={status}
                            locationProposals={locationProposals}
                            items={items}
                            filters={filters}
                            options={options}
                            checked={checked}
                            onCheck={setChecked}
                            decidedToday={decidedToday}
                            onOpen={openItem}
                            onFilter={visit}
                            onHover={setHovered}
                            footer={
                                mode === 'selection' ? (
                                    <SelectionBar items={checkedItems} options={options} onClear={() => setChecked([])} />
                                ) : undefined
                            }
                        />
                    </Workspace>
                )}
            </div>
            <ShortcutsDialog open={helping} onOpenChange={setHelping} />
        </AppLayout>
    );
}
