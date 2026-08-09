import { ServiceApi } from '@apis/ServiceApi';
import { ScrobScrobble } from '@apis/ScrobScrobble';
import { ScrobSearch } from '@apis/ScrobSearch';
import { Cache } from '@common/Cache';
import { StorageOptionsChangeData } from '@common/Events';
import { getScrobbleParser, ScrobbleParser } from '@common/ScrobbleParser';
import { Shared } from '@common/Shared';

const scrobbleControllers = new Map<string, ScrobbleController>();

export const getScrobbleController = (id: string): ScrobbleController => {
	if (!scrobbleControllers.has(id)) {
		const scrobbleParser = getScrobbleParser(id);
		scrobbleControllers.set(id, new ScrobbleController(scrobbleParser));
	}
	const controller = scrobbleControllers.get(id);
	if (!controller) {
		throw new Error(`Scrobble controller not registered for ${id}`);
	}
	return controller;
};

export class ScrobbleController {
	readonly api: ServiceApi;
	readonly parser: ScrobbleParser;
	private reachedScrobbleThreshold = false;
	private scrobbleThreshold = 80.0;
	private progress = 0.0;

	constructor(parser: ScrobbleParser) {
		this.parser = parser;
		this.api = this.parser.api;
	}

	init(): void {
		Shared.events.subscribe('STORAGE_OPTIONS_CHANGE', null, this.onStorageOptionsChange);
	}

	onStorageOptionsChange = (data: StorageOptionsChangeData): void => {
		// Handle options change if needed
	};

	async startScrobble(): Promise<void> {
		const item = this.parser.getItem();
		if (!item) {
			return;
		}
		this.reachedScrobbleThreshold = false;
		this.progress = 0.0;
		if (typeof item.scrob === 'undefined') {
			const caches = await Cache.get(['itemsToScrobItems', 'scrobItems', 'urlsToScrobItems']);
			try {
				item.scrob = await ScrobSearch.find(item, caches);
			} catch (err) {
				item.scrob = null;
				throw err;
			}
			await Cache.set(caches);
		}
		if (!item.scrob) {
			return;
		}
		item.scrob.progress = item.progress;
		await ScrobScrobble.start(item);
	}

	async pauseScrobble(): Promise<void> {
		const item = this.parser.getItem();
		if (!item?.scrob) {
			return;
		}
		await ScrobScrobble.pause(item);
	}

	async stopScrobble(): Promise<void> {
		const item = this.parser.getItem();
		if (!item?.scrob) {
			return;
		}
		await ScrobScrobble.stop(item);
		this.parser.clearItem();
		this.reachedScrobbleThreshold = false;
		this.progress = 0.0;
	}

	async updateProgress(progress: number): Promise<void> {
		const item = this.parser.getItem();
		if (!item) {
			return;
		}
		item.progress = progress;
		if (!item?.scrob) {
			return;
		}
		item.scrob.progress = progress;
		if (!this.reachedScrobbleThreshold && item.scrob.progress > this.scrobbleThreshold) {
			this.reachedScrobbleThreshold = true;
			const { scrobblingDetails } = await Shared.storage.get('scrobblingDetails');
			if (scrobblingDetails) {
				scrobblingDetails.item = item.save();
				await Shared.storage.set({ scrobblingDetails }, false);
				await Shared.events.dispatch('SCROBBLE_PROGRESS', null, scrobblingDetails);
			}
		} else if (
			item.progress < this.progress ||
			(this.progress === 0.0 && item.progress > 1.0) ||
			item.progress - this.progress > 10.0
		) {
			this.progress = item.progress;
			const { scrobblingDetails } = await Shared.storage.get('scrobblingDetails');
			if (scrobblingDetails) {
				scrobblingDetails.item = item.save();
				await Shared.storage.set({ scrobblingDetails }, false);
				await Shared.events.dispatch('SCROBBLE_PROGRESS', null, scrobblingDetails);
			}
		}
	}
}
