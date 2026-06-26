import React from "react";
export const GuideWrapper = ({ id, children, className = '', isGuideMode, activeHotspotId, onHotspotClick, dotPosition = 'top-0 right-0 -mt-2 -mr-2' }: { id: string, children: React.ReactNode, className?: string, isGuideMode?: boolean, activeHotspotId?: string, onHotspotClick?: (id: string) => void, dotPosition?: string }) => {
    if (!isGuideMode) return <>{children}</>;

    return (
        <div 
            className={`relative w-fit h-fit cursor-pointer ${className}`}
            onClickCapture={(e) => {
                // Intercept the click during capture phase so child buttons don't trigger their normal actions
                e.stopPropagation();
                e.preventDefault();
                if (onHotspotClick) onHotspotClick(id);
            }}
        >
            {children}
            <div className={`absolute ${dotPosition} z-[60] pointer-events-none`}>
                <div className="guide-hotspot relative flex items-center justify-center w-8 h-8 pointer-events-none">
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${activeHotspotId === id ? 'bg-indigo-600 scale-125' : 'bg-indigo-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-lg transition-transform ${activeHotspotId === id ? 'bg-indigo-700 scale-125' : 'bg-primary'}`}></span>
                </div>
            </div>
        </div>
    );
};
