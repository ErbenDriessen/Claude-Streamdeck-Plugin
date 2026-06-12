import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";

import { derivePeakState } from "../lib/peak";
import { renderBadge, formatCountdown } from "../lib/render";
import { withPeakDefaults, type PeakSettings } from "../lib/settings";

const POLL_MS = 15000;

type DrawEvent = { action: { setImage(image: string): Promise<void> }; payload: { settings: Partial<PeakSettings> } };

/** Draws PEAK / OFF-PEAK and a countdown to the next switch, fully client-side. */
@action({ UUID: "com.erbendriessen.claude.peak" })
export class PeakTicker extends SingletonAction {
	#timers = new Map<string, ReturnType<typeof setInterval>>();

	override onWillAppear(ev: WillAppearEvent): void {
		this.#draw(ev as unknown as DrawEvent);
		const timer = setInterval(() => this.#draw(ev as unknown as DrawEvent), POLL_MS);
		this.#timers.set(ev.action.id, timer);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const timer = this.#timers.get(ev.action.id);
		if (timer) clearInterval(timer);
		this.#timers.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		this.#draw(ev as unknown as DrawEvent);
	}

	#draw(ev: DrawEvent): void {
		const s = withPeakDefaults(ev.payload.settings ?? {});
		const nowS = Math.floor(Date.now() / 1000);
		const schedule = { startHourUTC: s.peakStartUTC, endHourUTC: s.peakEndUTC, weekdays: [1, 2, 3, 4, 5] };
		const state = derivePeakState(nowS, schedule);
		void ev.action.setImage(renderBadge({ isPeak: state.isPeak, countdown: formatCountdown(state.secondsToSwitch), showCountdown: s.showCountdown, background: s.background }));
	}
}
