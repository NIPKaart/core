import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

export default function LocalizedToaster() {
    const { t } = useTranslation('global/notification');
    const { t: tCommon } = useTranslation('global/common');

    return <Toaster position="top-right" containerAriaLabel={t('header.title')} toastOptions={{ closeButtonAriaLabel: tCommon('common.close') }} />;
}
