import streamDeck from "@elgato/streamdeck";

import { SessionLimit } from "./actions/session-limit";
import { PeakTicker } from "./actions/peak-ticker";

streamDeck.actions.registerAction(new SessionLimit());
streamDeck.actions.registerAction(new PeakTicker());

streamDeck.connect();
