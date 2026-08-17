import React from 'react';

/** Halos colorés du thème clair — le fond n’est plus une plaque blanche. */
export const JoyfulBackdrop: React.FC = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute -top-28 -left-24 w-[540px] h-[540px] rounded-full bg-[#FF7EB6]/50 blur-3xl" />
        <div className="absolute -top-10 -right-28 w-[500px] h-[500px] rounded-full bg-[#5EEAD4]/45 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[18%] w-[580px] h-[580px] rounded-full bg-[#93C5FD]/45 blur-3xl" />
        <div className="absolute top-[42%] left-[38%] w-[320px] h-[320px] rounded-full bg-[#FBBF24]/35 blur-3xl" />
    </div>
);
