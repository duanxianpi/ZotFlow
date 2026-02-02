import React, { useEffect, useRef } from "react";
import { setIcon } from "obsidian";

interface ObsidianIconProps {
    icon: string;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const ObsidianIcon: React.FC<ObsidianIconProps> = ({
    icon,
    className,
    style,
    onClick,
}) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = "";
            setIcon(ref.current, icon);
        }
    }, [icon]);

    return (
        <div
            ref={ref}
            className={className}
            style={{ display: "flex", alignItems: "center", ...style }}
            onClick={onClick}
        />
    );
};
