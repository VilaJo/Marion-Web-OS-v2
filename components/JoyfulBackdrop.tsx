import React from 'react';

/** Halos saturés du thème clair. */
export const JoyfulBackdrop: React.FC = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute -top-28 -left-24 w-[560px] h-[560px] rounded-full bg-[#FF6B9D]/70 blur-3xl" />
        <div className="absolute -top-8 -right-24 w-[520px] h-[520px] rounded-full bg-[#5EEAD4]/65 blur-3xl" />
        <div className="absolute bottom-[-140px] left-[12%] w-[600px] h-[600px] rounded-full bg-[#5B8DEF]/60 blur-3xl" />
        <div className="absolute top-[38%] left-[42%] w-[340px] h-[340px] rounded-full bg-[#FFB347]/55 blur-3xl" />
        <div className="absolute top-[55%] right-[8%] w-[280px] h-[280px] rounded-full bg-[#C084FC]/50 blur-3xl" />
    </div>
);
