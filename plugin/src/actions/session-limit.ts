import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";

import { readUsageFile, deriveSessionState } from "../lib/usage";
import { renderGauge, formatCountdown } from "../lib/render";
import { withSessionDefaults, type SessionSettings } from "../lib/settings";

const POLL_MS = 5000;

type DrawEvent = { action: { setImage(image: string): Promise<void> }; payload: { settings: Partial<SessionSettings> } };

/** Draws a configurable gauge of the chosen rate-limit window. */
@action({ UUID: "com.erbendriessen.claude.session" })
export class SessionLimit extends SingletonAction {
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
		const s = withSessionDefaults(ev.payload.settings ?? {});
		const nowS = Math.floor(Date.now() / 1000);
		const file = readUsageFile();
		const state = deriveSessionState(file, nowS);
		const colours = { colourMode: s.colourMode, accent: s.accent, warnAt: s.warnAt, dangerAt: s.dangerAt };
		const common = { showCountdown: s.showCountdown, background: s.background, colours, style: s.gaugeStyle };

		if (state.kind === "ok" && file) {
			const win = s.window === "sevenDay" && file.sevenDay ? file.sevenDay : file.fiveHour;
			const secs = Math.max(0, win.resetsAt - nowS);
			void ev.action.setImage(renderGauge({ ...common, pct: win.usedPercentage, countdown: formatCountdown(secs) }));
			return;
		}
		const label = state.kind === "reset" ? "reset" : state.kind === "stale" ? "idle" : "—";
		void ev.action.setImage(renderGauge({ ...common, pct: 0, countdown: label }));
	}
}
