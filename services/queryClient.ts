/**
 * React Query Client Configuration
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Stale after 30 seconds
            staleTime: 30 * 1000,
            // Cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Refetch on window focus
            refetchOnWindowFocus: true,
            // Don't refetch on reconnect for non-critical data
            refetchOnReconnect: 'always',
        },
        mutations: {
            retry: 0,
        }
    }
});
