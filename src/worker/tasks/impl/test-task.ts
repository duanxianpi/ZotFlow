import { BaseTask } from "../base";

export class TestTask extends BaseTask {
    constructor(private duration: number = 5000) {
        super("test-task");
    }

    protected async run(signal: AbortSignal): Promise<void> {
        const steps = 10;
        const stepDuration = this.duration / steps;

        for (let i = 0; i < steps; i++) {
            if (signal.aborted) return;

            await new Promise((resolve) => setTimeout(resolve, stepDuration));

            this.reportProgress(
                i + 1,
                steps,
                `Processing step ${i + 1} of ${steps}...`,
            );
        }
    }
}
