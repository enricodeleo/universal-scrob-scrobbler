import { ScrobHistoryItemEvent } from '@apis/ScrobSync';
import { Shared } from '@common/Shared';
import { Utils } from '@common/Utils';
import { ScrobbleItemValues } from '@models/Item';
import { ScrobItemValues } from '@models/ScrobItem';
import browser, { Alarms as WebExtAlarms } from 'webextension-polyfill';

export type CacheItems<T extends (keyof CacheValues)[]> = {
	[K in T[number]]: CacheItem<K>;
};

export type CacheValues = {
	[K in keyof CacheSubValues]: Partial<Record<string, Cacheable<CacheSubValues[K]>>>;
};

export interface CacheSubValues {
	history: HistoryCache;
	historyItemsToItems: string;
	items: ScrobbleItemValues;
	itemsToScrobItems: string;
	servicesData: unknown;
	tmdbApiConfigs: unknown;
	tmdbImageUrls: string | null;
	scrobHistoryItems: ScrobHistoryItemEvent[];
	scrobItems: ScrobItemValues;
	urlsToScrobItems: string;
}

export type Cacheable<T = unknown> = {
	value: T;
	timestamp: number;
};

export type CacheStorageValues = {
	[K in `${keyof CacheValues}Cache`]?: CacheValues[CacheStorageKeysToKeys[K]];
};

export type CacheStorageKeysToKeys = ReverseMap<CacheKeysToStorageKeys>;

export type CacheKeysToStorageKeys = {
	[K in keyof CacheValues]: `${K}Cache`;
};

export interface HistoryCache {
	nextPage?: number;
	nextUrl?: string;
	items: unknown[];
}

export class CacheItem<K extends keyof CacheValues> {
	readonly cache: CacheValues[K];

	constructor(cache: CacheValues[K]) {
		this.cache = cache;
	}

	get(subKey: string): CacheSubValues[K] | undefined {
		return this.cache[subKey]?.value as never;
	}

	set(subKey: string, subValue: CacheSubValues[K]) {
		// @ts-expect-error TODO: Type this better
		this.cache[subKey] = {
			value: subValue as never,
			timestamp: Cache.timestamp,
		};
	}
}

class _Cache {
	readonly CLEAR_ALARM_NAME = 'clear-cache';

	timestamp = Utils.unix();

	readonly keysToStorageKeys: CacheKeysToStorageKeys = {
		history: 'historyCache',
		historyItemsToItems: 'historyItemsToItemsCache',
		items: 'itemsCache',
		itemsToScrobItems: 'itemsToScrobItemsCache',
		servicesData: 'servicesDataCache',
		tmdbApiConfigs: 'tmdbApiConfigsCache',
		tmdbImageUrls: 'tmdbImageUrlsCache',
		scrobHistoryItems: 'scrobHistoryItemsCache',
		scrobItems: 'scrobItemsCache',
		urlsToScrobItems: 'urlsToScrobItemsCache',
	};

	get storageKeys() {
		return Object.values(this.keysToStorageKeys);
	}

	private clearTimestamps: Record<keyof CacheValues, number> = {
		history: 2 * 60 * 60,
		historyItemsToItems: 2 * 60 * 60,
		items: 2 * 60 * 60,
		itemsToScrobItems: 30 * 24 * 60 * 60,
		servicesData: 30 * 24 * 60 * 60,
		tmdbApiConfigs: 30 * 24 * 60 * 60,
		tmdbImageUrls: 30 * 24 * 60 * 60,
		scrobHistoryItems: 2 * 60 * 60,
		scrobItems: 30 * 24 * 60 * 60,
		urlsToScrobItems: 30 * 24 * 60 * 60,
	};

	addBackgroundListeners() {
		if (Shared.pageType === 'background' && !browser.alarms.onAlarm.hasListener(this.onAlarm)) {
			browser.alarms.onAlarm.addListener(this.onAlarm);
		}
	}

	private onAlarm = (alarm: WebExtAlarms.Alarm) => {
		if (alarm.name === this.CLEAR_ALARM_NAME) {
			void this.clear();
		}
	};

	async initFromBackground() {
		browser.alarms.create(this.CLEAR_ALARM_NAME, {
			periodInMinutes: 60,
		});
		await this.clear();
	}

	async get<T extends keyof CacheValues>(key: T): Promise<CacheItem<T>>;
	async get<T extends (keyof CacheValues)[]>(keys: T): Promise<CacheItems<T>>;
	async get<T extends keyof CacheValues | (keyof CacheValues)[]>(
		keys: T
	): Promise<CacheItem<keyof CacheValues> | CacheItems<(keyof CacheValues)[]>> {
		if (Array.isArray(keys)) {
			const storageKeys = keys.map((key) => this.keysToStorageKeys[key]);
			const values = await Shared.storage.get(storageKeys);
			const cacheItems = {} as CacheItems<(keyof CacheValues)[]>;
			for (const key of keys) {
				// @ts-expect-error TODO: Type this better
				const storageKey = this.keysToStorageKeys[key];
				// @ts-expect-error TODO: Type this better
				cacheItems[key] = new CacheItem((values[storageKey] as never) ?? {});
			}
			return cacheItems;
		}
		// @ts-expect-error TODO: Type this better
		const storageKey = this.keysToStorageKeys[keys];
		const values = await Shared.storage.get(storageKey);
		// @ts-expect-error TODO: Type this better
		return new CacheItem((values[storageKey] as never) ?? {});
	}

	async set(cacheItems: Partial<CacheItems<[keyof CacheValues]>>) {
		const storageValues: CacheStorageValues = {};
		for (const [key, cacheItem] of Object.entries(cacheItems) as [
			keyof CacheValues,
			CacheItem<keyof CacheValues>,
		][]) {
			const storageKey = this.keysToStorageKeys[key];
			storageValues[storageKey] = cacheItem.cache as never;
		}
		await Shared.storage.set(storageValues, false);
	}

	async clear() {
		const keys = Object.keys(this.keysToStorageKeys) as (keyof CacheValues)[];
		const cacheItems = await this.get(keys);
		for (const key of keys) {
			const cacheItem = cacheItems[key];
			const clearTimestamp = this.clearTimestamps[key];
			for (const [subKey, cacheable] of Object.entries(cacheItem.cache)) {
				if (cacheable && cacheable.timestamp + clearTimestamp < this.timestamp) {
					delete cacheItem.cache[subKey];
				}
			}
		}
		await this.set(cacheItems);
	}
}

export const Cache = new _Cache();
