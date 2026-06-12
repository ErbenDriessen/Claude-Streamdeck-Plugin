import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";

import { derivePeakState } from "../lib/peak";
import { renderBadge, formatCountdown } from "../lib/render";

const POLL_MS = 15000;

/** Draws PEAK / OFF-PEAK and a countdown to the next switch, fully client-side. */
@action({ UUID: "com.erbendriessen.claude.peak" })
export class PeakTicker extends SingletonAction {
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
		const state = derivePeakState(nowS);
		void target.setImage(renderBadge({ isPeak: state.isPeak, countdown: formatCountdown(state.secondsToSwitch), showCountdown: true, background: "dark" }));
	}
}
