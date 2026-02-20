import React, { useEffect, useRef } from "react";
import { setIcon } from "obsidian";

interface ObsidianIconProps {
    icon: string;
    className?: string;
    containerStyle?: React.CSSProperties;
    iconStyle?: React.CSSProperties;
    onClick?: () => void;
}

export const ObsidianIcon: React.FC<ObsidianIconProps> = ({
    icon,
    className,
    containerStyle,
    iconStyle,
    onClick,
}) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = "";
            setIcon(ref.current, icon);
        }
        if (iconStyle) {
            const iconElement = ref.current?.firstElementChild as HTMLElement;
            if (iconElement) {
                Object.assign(iconElement.style, iconStyle);
            }
        }
    }, [icon]);

    return (
        <div
            ref={ref}
            className={className}
            style={{ display: "flex", alignItems: "center", ...containerStyle }}
            onClick={onClick}
        />
    );
};
