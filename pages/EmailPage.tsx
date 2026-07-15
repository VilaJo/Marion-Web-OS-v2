/**
 * EmailPage - Full-screen email client view
 * Route: /emails
 *
 * Renders the EmailWidget at full viewport height with
 * integrated project/client list in the sidebar.
 */

import React, { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { SplashScreen } from '../components/SplashScreen';
import type { ComposeInvoiceHint } from '../components/email/useEmailWidget';

const EmailWidget = React.lazy(() => import('../components/email/EmailWidget'));

interface EmailPageNavState {
    compose?: {
        to: string;
        subject: string;
        body: string;
        invoiceHint?: ComposeInvoiceHint;
    };
}

export const EmailPage: React.FC = () => {
    const location = useLocation();
    const navState = (location.state || null) as EmailPageNavState | null;

    return (
        <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des emails..." />}>
            <div className="h-[calc(100vh-80px)] w-full">
                <EmailWidget
                    fullscreen
                    initialCompose={navState?.compose}
                    key={navState?.compose ? `compose-${navState.compose.subject}` : 'email'}
                />
            </div>
        </Suspense>
    );
};

export default EmailPage;
