/**
 * SettingsPage - Route-based settings view
 * Route: /settings
 *
 * Renders the SettingsModal component as a full-page overlay.
 * All state is read from / written to the UI store.
 */

import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores';
import { SplashScreen } from '../components/SplashScreen';

const SettingsModal = React.lazy(() => import('../components/Settings').then(m => ({ default: m.SettingsModal })));

export const SettingsPage: React.FC = () => {
    const navigate = useNavigate();

    const {
        theme, setTheme,
        currency, setCurrency,
        accentColor, setAccentColor,
        agencyName, setAgencyName,
        agencyWebsite, setAgencyWebsite,
        tjh, setTjh,
        aiTone, setAiTone,
        briefingVocal, setBriefingVocal,
        signatureSettings, setSignatureSettings,
        notificationPrefs, setNotificationPrefs,
    } = useUIStore();

    return (
        <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des paramètres..." />}>
            <SettingsModal
                isOpen={true}
                onClose={() => navigate('/')}
                currentTheme={theme}
                onThemeChange={setTheme}
                currency={currency}
                onCurrencyChange={setCurrency}
                accentColor={accentColor}
                onAccentColorChange={setAccentColor}
                agencyName={agencyName}
                setAgencyName={setAgencyName}
                agencyWebsite={agencyWebsite}
                setAgencyWebsite={setAgencyWebsite}
                tjh={tjh}
                setTjh={setTjh}
                aiTone={aiTone}
                setAiTone={setAiTone}
                briefingVocal={briefingVocal}
                setBriefingVocal={setBriefingVocal}
                signatureSettings={signatureSettings}
                setSignatureSettings={setSignatureSettings}
                notificationSettings={notificationPrefs}
                setNotificationSettings={setNotificationPrefs}
            />
        </Suspense>
    );
};

export default SettingsPage;
