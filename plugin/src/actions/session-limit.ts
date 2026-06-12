import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";

import { readUsageFile, deriveSessionState } from "../lib/usage";
import { renderRingSvg, formatCountdown } from "../lib/render";

const POLL_MS = 5000;

/** Polls ~/.claude/usage.json and draws a ring of the 5h session-limit %. */
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
		switch (state.kind) {
			case "setup":
				void target.setImage(renderRingSvg(0, "—"));
				break;
			case "reset":
				void target.setImage(renderRingSvg(0, "reset"));
				break;
			case "stale":
				void target.setImage(renderRingSvg(0, "idle"));
				break;
			case "ok":
				void target.setImage(renderRingSvg(state.percentage, formatCountdown(state.secondsToReset)));
				break;
		}
	}
}
