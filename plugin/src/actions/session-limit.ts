import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";

import { readUsageFile, deriveSessionState } from "../lib/usage";
import { renderGauge, formatCountdown } from "../lib/render";

const POLL_MS = 5000;

/** Polls ~/.claude/usage.json and draws a horseshoe gauge of the 5h session-limit %. */
@action({ UUID: "com.erbendriessen.claude.session" })
export class SessionLimit extends SingletonAction {
	#timers = new Map<string, ReturnType<typeof setInterval>>();

	override onWillAppear(ev: WillAppearEvent): void {
		this.#draw(ev.action);
		const timer = setInterval(() => this.#draw(ev.action), POLL_MS);
		this.#timers.set(ev.action.id, timer);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const timer = this.#timers.get(ev.action.id);
		if (timer) clearInterval(timer);
		this.#timers.delete(ev.action.id);
	}

	#draw(target: { setImage(image: string): Promise<void> }): void {
		const nowS = Math.floor(Date.now() / 1000);
		const state = deriveSessionState(readUsageFile(), nowS);
		const colours = { colourMode: "heat" as const, accent: "#3fb950", warnAt: 70, dangerAt: 90 };
		const common = { showCountdown: true, background: "dark" as const, colours, style: "horseshoe" as const };
		switch (state.kind) {
			case "setup":
				void target.setImage(renderGauge({ ...common, pct: 0, countdown: "—" }));
				break;
			case "reset":
				void target.setImage(renderGauge({ ...common, pct: 0, countdown: "reset" }));
				break;
			case "stale":
				void target.setImage(renderGauge({ ...common, pct: 0, countdown: "idle" }));
				break;
			case "ok":
				void target.setImage(renderGauge({ ...common, pct: state.percentage, countdown: formatCountdown(state.secondsToReset) }));
				break;
		}
	}
}
