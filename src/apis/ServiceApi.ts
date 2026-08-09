import { ScrobSearch } from '@apis/ScrobSearch';
import { ScrobSync } from '@apis/ScrobSync';
import { Cache, CacheItems } from '@common/Cache';
import { RequestError } from '@common/RequestError';
import { Shared } from '@common/Shared';
import { createScrobbleItem, ScrobbleItem, ScrobbleItemValues } from '@models/Item';
import { getSyncStore } from '@stores/SyncStore';

const serviceApis = new Map<string, ServiceApi>();

export const registerServiceApi = (id: string, api: ServiceApi): void => {
	serviceApis.set(id, api);
};

export const getServiceApi = (id: string): ServiceApi => {
	const api = serviceApis.get(id);
	if (!api) {
		throw new Error(`API not registered for ${id}`);
	}
	return api;
};

export interface ServiceApiSession {
	profileName: string | null;
}

export abstract class ServiceApi {
	readonly id: string;
	private leftoverHistoryItems: unknown[] = [];
	hasCheckedHistoryCache = false;
	hasReachedHistoryEnd = false;
	nextHistoryPage = 0;
	nextHistoryUrl = '';
	session?: ServiceApiSession | null;

	constructor(id: string) {
		this.id = id;

		registerServiceApi(this.id, this);
	}

	reset(): void {
		this.leftoverHistoryItems = [];
		this.hasCheckedHistoryCache = false;
		this.hasReachedHistoryEnd = false;
		this.nextHistoryPage = 0;
		this.nextHistoryUrl = '';
	}

	static async loadScrobHistory(
		items: ScrobbleItem[],
		processItem?: (item: ScrobbleItem) => Promise<ScrobbleItem>,
		cancelKey = 'default'
	): Promise<ScrobbleItem[]> {
		const hasLoadedScrobHistory = !items.some(
			(item) =>
				typeof item.scrob === 'undefined' ||
				(item.scrob && typeof item.scrob.watchedAt === 'undefined')
		);
		if (hasLoadedScrobHistory) {
			return items;
		}
		let newItems = items.map((item) => item.clone());
		try {
			const caches = await Cache.get([
				'itemsToScrobItems',
				'scrobItems',
				'scrobHistoryItems',
				'urlsToScrobItems',
			]);
			const promises = [];
			for (const item of newItems) {
				if (
					typeof item.scrob === 'undefined' ||
					(item.scrob && typeof item.scrob.watchedAt === 'undefined')
				) {
					promises.push(ServiceApi.loadScrobItemHistory(item, caches, processItem, cancelKey));
				} else {
					let promise;
					if (processItem) {
						promise = processItem(item);
					} else {
						promise = Promise.resolve(item);
					}
					promises.push(promise);
				}
			}
			newItems = await Promise.all(promises);
			await Cache.set(caches);
		} catch (err) {
			if (Shared.errors.validate(err)) {
				Shared.errors.error('Failed to load Scrob history.', err);
				await Shared.events.dispatch('SCROB_HISTORY_LOAD_ERROR', null, {
					error: err,
				});
			}
			throw err;
		}
		return newItems;
	}

	static async loadScrobItemHistory(
		item: ScrobbleItem,
		caches: CacheItems<
			['itemsToScrobItems', 'scrobItems', 'scrobHistoryItems', 'urlsToScrobItems']
		>,
		processItem?: (item: ScrobbleItem) => Promise<ScrobbleItem>,
		cancelKey = 'default'
	): Promise<ScrobbleItem> {
		try {
			if (!item.scrob) {
				item.scrob = await ScrobSearch.find(item, caches, cancelKey);
				if (processItem) {
					item = await processItem(item.clone());
				}
			}
			if (item.scrob && typeof item.scrob.watchedAt === 'undefined') {
				await ScrobSync.loadHistory(item, caches.scrobHistoryItems, false, cancelKey);
				if (processItem) {
					item = await processItem(item.clone());
				}
			}
		} catch (err) {
			console.debug(
				`[USS] Failed to load Scrob data for "${item.getFullTitle()}" (${item.serviceId})`,
				err
			);
			if (item.scrob) {
				delete item.scrob.watchedAt;
			} else {
				item.scrob = null;
			}
			if (processItem) {
				item = await processItem(item.clone());
			}
			if (err instanceof RequestError && err.isCanceled) {
				throw err;
			}
		}
		return item;
	}

	checkLogin(): Promise<boolean> {
		return Promise.resolve(!!this.session && this.session.profileName !== null);
	}

	async loadHistory(
		itemsToLoad: number,
		lastSync: number,
		lastSyncId: string,
		cancelKey = 'default'
	): Promise<ScrobbleItem[]> {
		let items: ScrobbleItem[] = [];
		try {
			const caches = await Cache.get(['history', 'historyItemsToItems', 'items']);
			let historyCache = caches.history.get(this.id);
			if (!historyCache) {
				historyCache = {
					items: [],
				};
			}
			const store = getSyncStore(this.id);
			let { hasReachedEnd, hasReachedLastSyncDate } = store.data;
			const historyItems: unknown[] = [];
			do {
				let responseItems: unknown[] = [];
				if (this.leftoverHistoryItems.length > 0) {
					responseItems = this.leftoverHistoryItems;
					this.leftoverHistoryItems = [];
				} else if (!this.hasReachedHistoryEnd && this.loadHistoryItems) {
					responseItems = await this.loadHistoryItems(cancelKey);
					if (!this.hasCheckedHistoryCache) {
						let firstItem: ScrobbleItemValues | null = null;
						if (historyCache.items.length > 0 && this.getHistoryItemId) {
							const historyItemId = `${this.id}_${this.getHistoryItemId(historyCache.items[0])}`;
							const itemId = caches.historyItemsToItems.get(historyItemId);
							if (itemId) {
								firstItem = caches.items.get(itemId) ?? null;
							}
						}
						if (
							responseItems.length > 0 &&
							firstItem &&
							this.isNewHistoryItem &&
							this.isNewHistoryItem(responseItems[0], firstItem.watchedAt ?? 0, firstItem.id ?? '')
						) {
							historyCache = {
								items: [],
							};
						}
						this.nextHistoryPage = historyCache.nextPage ?? this.nextHistoryPage;
						this.nextHistoryUrl = historyCache.nextUrl ?? this.nextHistoryUrl;
						if (historyCache.items.length > 0) {
							responseItems = historyCache.items;
							historyCache.items = [];
						}
						this.hasCheckedHistoryCache = true;
					}
					historyCache.nextPage = this.nextHistoryPage;
					historyCache.nextUrl = this.nextHistoryUrl;
					historyCache.items.push(...responseItems);
				}

				if (responseItems.length === 0) {
					hasReachedEnd = true;
				}

				for (let i = 0; i < responseItems.length; i++) {
					const historyItem = responseItems[i];
					const historyItemId = this.getHistoryItemId
						? `${this.id}_${this.getHistoryItemId(historyItem)}`
						: `${this.id}_${i.toString()}`;
					let scrobbleItem: ScrobbleItem | null = null;
					const itemId = caches.historyItemsToItems.get(historyItemId);
					if (itemId) {
						const cachedValues = caches.items.get(itemId);
						if (cachedValues) {
							scrobbleItem = createScrobbleItem(cachedValues);
						}
					}
					if (!scrobbleItem && this.parseHistoryItem) {
						scrobbleItem = await this.parseHistoryItem(historyItem);
						if (scrobbleItem) {
							caches.historyItemsToItems.set(historyItemId, scrobbleItem.getDatabaseId());
							caches.items.set(scrobbleItem.getDatabaseId(), scrobbleItem.save());
						}
					}
					if (scrobbleItem) {
						historyItems.push(historyItem);
						items.push(scrobbleItem);
						if (
							lastSync > 0 &&
							lastSyncId &&
							this.isNewHistoryItem &&
							!this.isNewHistoryItem(historyItem, lastSync, lastSyncId)
						) {
							hasReachedLastSyncDate = true;
							this.leftoverHistoryItems = responseItems.slice(i + 1);
							break;
						}
					}
				}
			} while (
				items.length < itemsToLoad &&
				!hasReachedEnd &&
				!hasReachedLastSyncDate &&
				!this.hasReachedHistoryEnd
			);

			if (this.hasReachedHistoryEnd && this.leftoverHistoryItems.length === 0) {
				hasReachedEnd = true;
			}

			historyCache.items = historyCache.items.filter(
				(historyItem) => !historyItems.includes(historyItem)
			);
			caches.history.set(this.id, historyCache);
			await Cache.set(caches);

			items = await ServiceApi.loadScrobHistory(items, undefined, cancelKey);

			await store.setData({
				items,
				hasReachedEnd,
				hasReachedLastSyncDate,
			});
		} catch (err) {
			if (Shared.errors.validate(err)) {
				Shared.errors.error('Failed to load history.', err);
				await Shared.events.dispatch('SERVICE_HISTORY_LOAD_ERROR', null, {
					error: err,
				});
			}
			throw err;
		}
		return items;
	}

	getItem?(id: string): Promisable<ScrobbleItem | null>;

	loadHistoryItems?(cancelKey?: string): Promise<unknown[]>;

	isNewHistoryItem?(historyItem: unknown, lastSync: number, lastSyncId: string): boolean;

	getHistoryItemId?(historyItem: unknown): string;

	parseHistoryItem?(historyItem: unknown): Promisable<ScrobbleItem | null>;
}
