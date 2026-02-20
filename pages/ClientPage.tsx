/**
 * ClientPage - Route-based client detail view
 * Wraps ClientView with URL parameter handling
 */

import React, { Suspense, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUIStore, useNotificationStore } from '../stores';
import { useProjects, useSaveProject, useDeleteProject } from '../services/queries';
import { SplashScreen } from '../components/SplashScreen';

const ClientView = React.lazy(() => import('../components/ClientView').then(m => ({ default: m.ClientView })));

export const ClientPage: React.FC = () => {
    const params = useParams();
    const navigate = useNavigate();
    const { data: projects = [], isLoading } = useProjects();
    const saveProjectMutation = useSaveProject();
    const deleteProjectMutation = useDeleteProject();
    const { theme } = useUIStore();
    const { addNotification } = useNotificationStore();

    // Find the project by ID — supports both :id and wildcard * routes
    const rawId = params['*'] || params.id || '';
    const decodedId = decodeURIComponent(rawId);
    const project = projects.find(p => p.id === decodedId);

    // If project not found and projects are loaded, redirect to dashboard
    useEffect(() => {
        if (!project && projects.length > 0 && decodedId) {
            navigate('/', { replace: true });
        }
    }, [project, projects.length, decodedId, navigate]);

    if (!project) {
        return <SplashScreen visible={true} loadingText="Chargement du client..." />;
    }

    return (
        <Suspense fallback={<SplashScreen visible={true} loadingText={`Ouverture de ${project.clientName}...`} />}>
            <ClientView
                project={project}
                onBack={() => navigate('/')}
                onUpdateProject={(updated, oldId) => {
                    saveProjectMutation.mutate({ project: updated, oldId }, {
                        onError: () => addNotification('Erreur Sauvegarde', "Les modifications n'ont pas été enregistrées.", 'error'),
                    });
                }}
                onNotify={addNotification}
                onDelete={(projectId) => {
                    deleteProjectMutation.mutate(projectId);
                    navigate('/');
                }}
                currentTheme={theme}
            />
        </Suspense>
    );
};

export default ClientPage;
