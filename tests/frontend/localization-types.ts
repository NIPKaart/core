import i18n from 'i18next';

// These compile-time assertions fail when unknown literals become accepted.
i18n.t('common.close', { ns: 'global/common' });
i18n.t('result_count', { ns: 'backend/imports', count: 2, total: 2 });
// @ts-expect-error Unknown key, even with a default value.
i18n.t('common.typo', { ns: 'global/common', defaultValue: 'Typo' });
// @ts-expect-error Unknown namespace.
i18n.t('common.close', { ns: 'global/typo' });
// @ts-expect-error Key from another namespace.
i18n.t('common.close', { ns: 'backend/imports' });

// Finite application choices use t directly and preserve plural/count handling.
declare const status: 'pending' | 'approved' | 'rejected';
i18n.t(`status.${status}` as const, { ns: 'backend/parking/main' });
declare const invalidStatus: 'approved' | 'published';
// @ts-expect-error A dynamic union still rejects values missing from its catalog.
i18n.t(`status.${invalidStatus}` as const, { ns: 'backend/parking/main' });
