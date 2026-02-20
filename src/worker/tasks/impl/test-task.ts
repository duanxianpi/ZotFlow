import { BaseTask } from "../base";
import type { TaskStatus } from "types/tasks";

export class TestTask extends BaseTask {
    constructor(private duration: number = 5000) {
        super("test-task");
        this.displayText = "Test Task";
        this.taskInput = { duration, steps: 100 };
    }

    protected async run(signal: AbortSignal): Promise<void> {
        const steps = 100;
        const stepDuration = this.duration / steps;

        for (let i = 0; i < steps; i++) {
            if (signal.aborted) throw new Error("Aborted");

            if (i === 10) {
                throw new Error("Test error at step 10");
            }

            await new Promise((resolve) => setTimeout(resolve, stepDuration));

            this.reportProgress(
                i + 1,
                steps,
                `Processing step ${i + 1} of ${steps}...`,
            );
        }

        this.result = {
            successCount: 1,
            failCount: 0,
            details: { duration: this.duration, steps },
        };
    }

    protected getTerminalDisplayText(status: TaskStatus): string {
        if (status === "cancelled") return "Test Task — Cancelled";
        if (status === "failed") return "Test Task — Failed";
        return `Test Task — Done (${this.duration}ms)`;
    }
}
