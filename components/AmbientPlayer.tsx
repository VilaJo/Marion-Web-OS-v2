import React from 'react';

interface AmbientPlayerProps {
    url: string | null;
    isPlaying: boolean;
    volume: number;
}

export const AmbientPlayer: React.FC<AmbientPlayerProps> = ({ url, isPlaying, volume }) => {
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    React.useEffect(() => {
        if (!url) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            return;
        }

        if (!audioRef.current || audioRef.current.src !== url) {
            audioRef.current = new Audio(url);
            audioRef.current.loop = true;
        }

        audioRef.current.volume = volume;

        if (isPlaying) {
            audioRef.current.play().catch(e => console.error("Audio play failed", e));
        } else {
            audioRef.current.pause();
        }

        // Cleanup only on unmount of the PLAYER, not on URL change (managed above)
        return () => {
            // Optional: pause on unmount
        };
    }, [url, isPlaying]);

    // Volume effect separately to avoid reloading audio
    React.useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    return null; // Invisible component
};
