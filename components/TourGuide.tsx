import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface TourStep {
    targetId: string;
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourGuideProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const TOUR_STEPS: TourStep[] = [
    {
        targetId: 'header-title',
        title: "Bienvenue Marion ! 👋",
        content: "Ton nouvel espace est prêt. Je suis Franck, ton assistant. Laisse-moi te montrer tes nouveaux super-pouvoirs en 1 minute.",
        position: 'bottom'
    },
    {
        targetId: 'new-client-filter-button',
        title: "Nouveau Client 🚀",
        content: "Tout commence ici. En un clic, je crée automatiquement l'arborescence complète (Brief, Design, Admin) sur ton Bureau.",
        position: 'bottom'
    },
    {
        targetId: 'finance-card',
        title: "Finance & Dépenses 💸",
        content: "Suis ton Chiffre d'Affaires, mais aussi ton vrai Bénéfice Net. Tu peux maintenant scanner tes tickets de caisse : je les analyse pour toi.",
        position: 'right'
    },
    {
        targetId: 'media-btn',
        title: "L'Atelier Média 🎨",
        content: "Nouveau : Détoure des logos, crée des posts Instagram parfaits ou extrais des palettes de couleurs en une seconde.",
        position: 'bottom'
    },
    {
        targetId: 'focus-btn',
        title: "Mode Focus 🧘‍♀️",
        content: "Besoin de calme ou de motivation ? Active ce mode pour masquer les distractions. Je serai là pour te coacher.",
        position: 'bottom'
    },
    {
        targetId: 'bug-reporter-btn',
        title: "Un souci ? 🐞",
        content: "Si tu trouves un bug ou si tu as une idée géniale, clique sur cette petite coccinelle pour me le dire directement.",
        position: 'right'
    },
    {
        targetId: 'chat-btn',
        title: "Je suis là 🤖",
        content: "Pour tout le reste (analyser un brief, rédiger un mail ou juste discuter), je suis toujours disponible ici.",
        position: 'left'
    }
];

export const TourGuide: React.FC<TourGuideProps> = ({ isOpen, onClose, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [position, setPosition] = useState<{top: number, left: number, width: number, height: number} | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const updatePosition = () => {
            const step = TOUR_STEPS[currentStep];
            const element = document.getElementById(step.targetId);
            
            if (element) {
                const rect = element.getBoundingClientRect();
                // Calculate position relative to the viewport for the spotlight (fixed position)
                setPosition({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                });
                
                // Scroll element into view smoothly if needed
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Fallback center
                setPosition({
                    top: window.innerHeight / 2 - 50,
                    left: window.innerWidth / 2 - 100,
                    width: 200,
                    height: 100
                });
            }
        };

        // Update immediately and on resize/scroll
        updatePosition();
        // Add a small delay to allow for any layout shifts/animations
        const timer = setTimeout(updatePosition, 100); 
        
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);
        
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
            clearTimeout(timer);
        };
    }, [currentStep, isOpen]);

    if (!isOpen || !position) return null;

    const step = TOUR_STEPS[currentStep];
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    // Calculate Tooltip Position (Fixed)
    let tooltipStyle: React.CSSProperties = {};
    const gap = 20;
    const tooltipWidth = 320;

    if (step.position === 'bottom') {
        tooltipStyle = { 
            top: position.top + position.height + gap, 
            left: position.left + (position.width / 2) - (tooltipWidth / 2) 
        };
    } else if (step.position === 'top') {
        tooltipStyle = { 
            top: position.top - gap - 200, // approximate height
            left: position.left + (position.width / 2) - (tooltipWidth / 2) 
        }; 
    } else if (step.position === 'left') {
        tooltipStyle = { 
            top: position.top + (position.height / 2) - 100, 
            left: position.left - tooltipWidth - gap 
        };
    } else if (step.position === 'right') {
        tooltipStyle = { 
            top: position.top, 
            left: position.left + position.width + gap 
        };
    }

    // Boundary checks (keep tooltip on screen)
    const leftVal = tooltipStyle.left as number;
    if (leftVal < 20) tooltipStyle.left = 20;
    if (leftVal > window.innerWidth - tooltipWidth - 20) tooltipStyle.left = window.innerWidth - tooltipWidth - 20;
    
    // Vertical boundary check
    const topVal = tooltipStyle.top as number;
    if (topVal < 20) tooltipStyle.top = position.top + position.height + gap; // Flip to bottom if top is cut off

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none">
            {/* Spotlight Effect using huge box-shadow on a fixed div matching the target element */}
            <div 
                className="absolute transition-all duration-500 ease-in-out rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.75)] pointer-events-none border-2 border-brand-orange/50"
                style={{
                    top: position.top - 5,
                    left: position.left - 5,
                    width: position.width + 10,
                    height: position.height + 10,
                }}
            ></div>

            {/* Tooltip Card */}
            <div 
                onClick={handleNext}
                className="absolute pointer-events-auto w-[320px] bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300 border-2 border-brand-orange flex flex-col gap-4 transition-all ease-out duration-500 cursor-pointer"
                style={tooltipStyle}
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-orange to-pink-500 flex items-center justify-center text-white font-serif font-bold text-xl shadow-lg shrink-0">
                        F
                    </div>
                    <div>
                        <h3 className="font-serif text-xl font-bold text-slate-800 dark:text-white mb-1">{step.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {step.content}
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-1">
                        {TOUR_STEPS.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-brand-orange' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        ))}
                    </div>
                    
                    <div className="flex gap-2">
                        {currentStep > 0 && (
                            <button onClick={handlePrev} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <button 
                            onClick={handleNext}
                            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform shadow-lg"
                        >
                            {isLastStep ? 'C\'est parti !' : 'Suivant'}
                            {isLastStep ? <Check size={14} /> : <ChevronRight size={14} />}
                        </button>
                    </div>
                </div>

                <button onClick={onClose} className="absolute top-2 right-2 p-2 text-slate-300 hover:text-slate-500 rounded-full">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
