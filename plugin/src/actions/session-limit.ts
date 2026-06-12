import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";

import { readUsageFile } from "../lib/usage";
import { readCredentials } from "../lib/credentials";
import { fetchUsage, type UsageSnapshot } from "../lib/usageApi";
import { resolveSessionReading } from "../lib/source";
import { renderGauge, formatCountdown } from "../lib/render";
import { withSessionDefaults, type SessionSettings } from "../lib/settings";

const DRAW_MS = 5000; // redraw cadence (keeps the countdown ticking)
const API_MS = 30000; // how often to re-poll the live usage endpoint

interface ActionRef {
	id: string;
	getSettings(): Promise<Partial<SessionSettings>>;
	setImage(image: string): Promise<void>;
}

/** Draws a configurable gauge of the chosen window, live from the official usage API. */
@action({ UUID: "com.erbendriessen.claude.session" })
export class SessionLimit extends SingletonAction {
	#timers = new Map<string, ReturnType<typeof setInterval>>();
	#snapshot: UsageSnapshot | null = null;
	#snapAt = 0;

	override onWillAppear(ev: WillAppearEvent): void {
		const ref = ev.action as unknown as ActionRef;
		void this.#tick(ref, true);
		const timer = setInterval(() => void this.#tick(ref, false), DRAW_MS);
		this.#timers.set(ref.id, timer);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const timer = this.#timers.get(ev.action.id);
		if (timer) clearInterval(timer);
		this.#timers.delete(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
		void this.#tick(ev.action as unknown as ActionRef, false);
	}

	async #tick(action: ActionRef, force: boolean): Promise<void> {
		const now = Date.now();
		if (force || now - this.#snapAt >= API_MS) {
			this.#snapAt = now;
			const creds = readCredentials();
			if (creds) {
				const result = await fetchUsage(creds.accessToken);
				if (result.ok && result.snapshot) this.#snapshot = result.snapshot;
				else if (result.status === 401) this.#snapshot = null; // expired -> fall back
			}
		}
		await this.#draw(action);
	}

	async #draw(action: ActionRef): Promise<void> {
		const s = withSessionDefaults(await action.getSettings());
		const nowS = Math.floor(Date.now() / 1000);
		const reading = resolveSessionReading(this.#snapshot, readUsageFile(), nowS, s.window);
		const colours = { colourMode: s.colourMode, accent: s.accent, warnAt: s.warnAt, dangerAt: s.dangerAt };
		const common = { showCountdown: s.showCountdown, background: s.background, bgColor: s.bgColor, colours, style: s.gaugeStyle };

		if (reading.kind === "official") {
			void action.setImage(renderGauge({ ...common, pct: reading.pct, countdown: formatCountdown(reading.secondsToReset) }));
			return;
		}
		void action.setImage(renderGauge({ ...common, pct: 0, countdown: "—" }));
	}
}
