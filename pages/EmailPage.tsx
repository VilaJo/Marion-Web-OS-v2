/**
 * EmailPage - Full-screen email client view
 * Route: /emails
 *
 * Renders the EmailWidget at full viewport height with
 * integrated project/client list in the sidebar.
 */

import React, { Suspense } from 'react';
import { SplashScreen } from '../components/SplashScreen';

const EmailWidget = React.lazy(() => import('../components/email/EmailWidget'));

export const EmailPage: React.FC = () => {
    return (
        <Suspense fallback={<SplashScreen visible={true} loadingText="Chargement des emails..." />}>
            <div className="h-[calc(100vh-80px)] w-full">
                <EmailWidget fullscreen />
            </div>
        </Suspense>
    );
};

export default EmailPage;
