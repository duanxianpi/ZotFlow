import { Notice, setIcon } from "obsidian";

export type NotificationType = "info" | "success" | "warning" | "error";

export class NotificationService {
    /**
     * Display a stylised notification.
     * @param type - The urgency/type of the notification.
     * @param message - The content to display.
     */
    public notify(type: NotificationType, message: string) {
        let duration = 2000;
        let iconId = "info";
        let colorVar = "var(--text-normal)";

        switch (type) {
            case "info":
                duration = 2000;
                iconId = "info";
                colorVar = "var(--text-muted)";
                break;
            case "success":
                duration = 2000;
                iconId = "check-circle";
                colorVar = "var(--text-success)";
                break;
            case "warning":
                duration = 5000;
                iconId = "alert-triangle";
                colorVar = "var(--text-warning)";
                break;
            case "error":
                duration = 0;
                iconId = "alert-octagon";
                colorVar = "var(--text-error)";
                break;
        }

        const fragment = document.createDocumentFragment();
        const container = fragment.createEl("div", {
            cls: "zotflow-notice-container",
        });

        const iconEl = container.createEl("span", {
            cls: "zotflow-notice-icon",
        });
        setIcon(iconEl, iconId);
        iconEl.style.color = colorVar;

        container.createEl("span", {
            text: message,
            cls: "zotflow-notice-message",
        });

        new Notice(fragment, duration);
    }
}
