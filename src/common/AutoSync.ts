import { getServiceApi, ServiceApi } from '@apis/ServiceApi';
import { ScrobSync } from '@apis/ScrobSync';
import { BrowserStorage } from '@common/BrowserStorage';
import { Shared } from '@common/Shared';
import { Utils } from '@common/Utils';
import { ScrobbleItem } from '@models/Item';
import { getService, getServices } from '@models/Service';
import { getSyncStore } from '@stores/SyncStore';
import browser, { Alarms as WebExtAlarms } from 'webextension-polyfill';

class _AutoSync {
	readonly ALARM_NAME = 'auto-sync';

	addBackgroundListeners() {
		if (Shared.pageType === 'background' && !browser.alarms.onAlarm.hasListener(this.onAlarm)) {
			browser.alarms.onAlarm.addListener(this.onAlarm);
		}
	}

	private onAlarm = (alarm: WebExtAlarms.Alarm) => {
		if (alarm.name === this.ALARM_NAME) {
			void this.sync();
		}
	};

	async initFromBackground() {
		browser.alarms.create(this.ALARM_NAME, {
			periodInMinutes: 60,
		});
		await this.sync();
	}

	async sync() {
		const now = Utils.unix();
		const services = getServices();
		for (const service of services) {
			if (!service.hasAutoSync) {
				continue;
			}

			const serviceValue = BrowserStorage.options.services[service.id];
			if (!serviceValue?.autoSync || serviceValue.autoSyncDays === 0) {
				continue;
			}

			const nextSync = serviceValue.lastSync + serviceValue.autoSyncDays * 24 * 60 * 60;
			if (now < nextSync) {
				continue;
			}

			let items: ScrobbleItem[] = [];
			const store = getSyncStore(service.id);
			const api = getServiceApi(service.id);
			try {
				await api.loadHistory(Infinity, serviceValue.lastSync, serviceValue.lastSyncId, 'autoSync');

				items = store.data.items.filter(
					(item) => item.progress >= Shared.storage.syncOptions.minPercentageWatched
				);
				if (items.length > 0) {
					items = await ServiceApi.loadScrobHistory(items, undefined, 'autoSync');

					const foundItems = items.filter((item) => item.scrob);
					const itemsToSync = foundItems.filter(
						(item) => !item.scrob?.watchedAt && !item.isMissingWatchedDate()
					);
					if (itemsToSync.length > 0) {
						for (const itemToSync of itemsToSync) {
							itemToSync.isSelected = true;
						}
						await ScrobSync.sync(store, itemsToSync, 'autoSync');
					}

					items = store.data.items.filter(
						(item) => item.progress >= Shared.storage.syncOptions.minPercentageWatched
					);

					const missingWatchedDate = items.some((item) => item.isMissingWatchedDate());
					if (missingWatchedDate || foundItems.length !== items.length) {
						let { autoSyncCache } = await Shared.storage.get('autoSyncCache');
						autoSyncCache = autoSyncCache ?? {};
						autoSyncCache[service.id] = {
							items: items.map((item) => item.save()),
							failed: true,
						};
						await Shared.storage.set({ autoSyncCache }, false);
					} else {
						let { autoSyncCache } = await Shared.storage.get('autoSyncCache');
						if (autoSyncCache?.[service.id]) {
							delete autoSyncCache[service.id];
							await Shared.storage.set({ autoSyncCache }, false);
						}
					}
				} else {
					let { autoSyncCache } = await Shared.storage.get('autoSyncCache');
					if (autoSyncCache?.[service.id]) {
						delete autoSyncCache[service.id];
						await Shared.storage.set({ autoSyncCache }, false);
					}
				}

				const lastSync = items[0]?.watchedAt ?? now;
				await Shared.storage.saveOptions({
					services: {
						[service.id]: {
							lastSync,
							lastSyncId: items[0]?.id ?? '',
						},
					},
				});
			} catch (err) {
				if (Shared.errors.validate(err)) {
					Shared.errors.error(`Failed to auto sync ${getService(service.id).name}.`, err);
				}
			}
		}
	}
}

export const AutoSync = new _AutoSync();
