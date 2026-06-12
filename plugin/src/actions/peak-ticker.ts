import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";

import { derivePeakState } from "../lib/peak";
import { renderBadge, formatCountdown } from "../lib/render";
import { withPeakDefaults, type PeakSettings } from "../lib/settings";

const POLL_MS = 15000;

interface ActionRef {
	id: string;
	getSettings(): Promise<Partial<PeakSettings>>;
	setImage(image: string): Promise<void>;
}

/** Draws PEAK / OFF-PEAK and a countdown to the next switch, fully client-side. */
@action({ UUID: "com.erbendriessen.claude.peak" })
export class PeakTicker extends SingletonAction {
	#timers = new Map<string, ReturnType<typeof setInterval>>();

	override onWillAppear(ev: WillAppearEvent): void {
		const ref = ev.action as unknown as ActionRef;
		void this.#draw(ref);
		const timer = setInterval(() => void this.#draw(ref), POLL_MS);
		this.#timers.set(ref.id, timer);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const timer = this.#timers.get(ev.action.id);
		if (timer) clearInterval(timer);
		this.#timers.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		void this.#draw(ev.action as unknown as ActionRef);
	}

	async #draw(action: ActionRef): Promise<void> {
		const s = withPeakDefaults(await action.getSettings());
		const nowS = Math.floor(Date.now() / 1000);
		const schedule = { startHourUTC: s.peakStartUTC, endHourUTC: s.peakEndUTC, weekdays: [1, 2, 3, 4, 5] };
		const state = derivePeakState(nowS, schedule);
		void action.setImage(renderBadge({ isPeak: state.isPeak, countdown: formatCountdown(state.secondsToSwitch), showCountdown: s.showCountdown, background: s.background, bgColor: s.bgColor }));
	}
}
