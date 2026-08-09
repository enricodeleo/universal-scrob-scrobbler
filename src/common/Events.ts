import {
	ScrobblingDetails,
	StorageValuesOptions,
	StorageValuesSyncOptions,
} from '@common/BrowserStorage';
import { DispatchEventMessage, Messaging } from '@common/Messaging';
import { Shared } from '@common/Shared';
import { ScrobbleItem, ScrobbleItemValues } from '@models/Item';
import { ScrobItemValues } from '@models/ScrobItem';
import { AlertColor } from '@mui/material';
import { SyncStore } from '@stores/SyncStore';
import { ReactNode } from 'react';
import { PartialDeep } from 'type-fest';

export interface EventData {
	LOGIN_SUCCESS: LoginSuccessData;
	LOGIN_ERROR: ErrorData;
	LOGOUT_SUCCESS: SuccessData;
	LOGOUT_ERROR: ErrorData;
	SCROBBLE_SUCCESS: ScrobbleSuccessData;
	SCROBBLE_ERROR: ScrobbleErrorData;
	SCROBBLE_START: ScrobblingDetails;
	SCROBBLE_PAUSE: ScrobblingDetails;
	SCROBBLE_STOP: ScrobblingDetails;
	SCROBBLE_PROGRESS: ScrobblingDetails;
	SEARCH_SUCCESS: SearchSuccessData;
	SEARCH_ERROR: SearchErrorData;
	OPTIONS_CHANGE: PartialDeep<StorageValuesOptions>;
	DIALOG_SHOW: DialogShowData;
	SNACKBAR_SHOW: SnackbarShowData;
	MISSING_WATCHED_DATE_DIALOG_SHOW: MissingWatchedDateDialogShowData;
	MISSING_WATCHED_DATE_ADDED: MissingWatchedDateAddedData;
	SYNC_OPTIONS_CHANGE: PartialDeep<StorageValuesSyncOptions>;
	SYNC_STORE_RESET: SuccessData;
	SERVICE_HISTORY_LOAD_ERROR: ErrorData;
	SCROB_HISTORY_LOAD_ERROR: ErrorData;
	HISTORY_SYNC_SUCCESS: HistorySyncSuccessData;
	HISTORY_SYNC_ERROR: ErrorData;
	REQUESTS_CANCEL: RequestsCancelData;
	STORAGE_OPTIONS_CHANGE: StorageOptionsChangeData;
	STORAGE_OPTIONS_CLEAR: SuccessData;
	CONTENT_SCRIPT_CONNECT: ContentScriptConnectData;
	CONTENT_SCRIPT_DISCONNECT: ContentScriptConnectData;
	SYNC_DIALOG_SHOW: SyncDialogShowData;
	ITEMS_LOAD: ItemsLoadData;
	SYNC_STORE_LOADING_START: SuccessData;
	SYNC_STORE_LOADING_STOP: SuccessData;
}

export type Event = keyof EventData;

export type SuccessData = Record<string, unknown>;

export interface ErrorData {
	error: Error;
}

export interface LoginSuccessData {
	auth: Record<string, unknown>;
}

export interface ScrobbleSuccessData {
	item?: ScrobItemValues;
	scrobbleType: number;
}

export type ScrobbleErrorData = ScrobbleSuccessData & {
	error: Error;
};

export interface SearchSuccessData {
	searchItem: unknown;
}

export interface SearchErrorData {
	error: Error;
}

export interface DialogShowData {
	title: string | ReactNode;
	message: string | ReactNode;
	onConfirm?: () => Promisable<void>;
	onDeny?: () => Promisable<void>;
}

export interface SnackbarShowData {
	messageName: MessageName;
	messageArgs?: string[];
	severity: AlertColor;
}

export interface MissingWatchedDateDialogShowData {
	items: ScrobbleItem[];
}

export interface MissingWatchedDateAddedData {
	oldItems: ScrobbleItem[];
	newItems: ScrobbleItem[];
}

export interface HistorySyncSuccessData {
	added: Record<string, unknown>;
}

export interface RequestsCancelData {
	tabId: number | null;
	key: string;
}

export interface StorageOptionsChangeData {
	options?: PartialDeep<StorageValuesOptions>;
	syncOptions?: PartialDeep<StorageValuesSyncOptions>;
}

export interface ContentScriptConnectData {
	tabId: number;
}

export interface SyncDialogShowData {
	store: SyncStore;
	serviceId: string | null;
	items: ScrobbleItem[];
}

export interface ItemsLoadData {
	items: Partial<Record<number, ScrobbleItem | null>>;
}

export type EventDispatcherListeners = Record<
	string,
	Record<string, EventDispatcherListener<any>[]>
>;

export type EventDispatcherListener<T extends Event = Event> = (
	data: EventData[T],
	eventSpecifier: string | null
) => Promisable<void>;

class _EventDispatcher {
	private listeners: EventDispatcherListeners = {};

	init() {
		// Do nothing
	}

	subscribe<T extends Event>(
		eventType: T,
		eventSpecifier: string | null,
		listener: EventDispatcherListener<T>
	) {
		const key = this.getKey(eventType, eventSpecifier);
		this.listeners[key] = this.listeners[key] || {};
		this.listeners[key][Shared.pageType] = this.listeners[key][Shared.pageType] || [];
		this.listeners[key][Shared.pageType].push(listener);
	}

	unsubscribe<T extends Event>(
		eventType: T,
		eventSpecifier: string | null,
		listener: EventDispatcherListener<T>
	) {
		const key = this.getKey(eventType, eventSpecifier);
		if (this.listeners[key]?.[Shared.pageType]) {
			this.listeners[key][Shared.pageType] = this.listeners[key][Shared.pageType].filter(
				(l) => l !== listener
			);
		}
	}

	async dispatch<T extends Event>(
		eventType: T,
		eventSpecifier: string | null,
		data: EventData[T],
		isFromBackground = false
	) {
		const key = this.getKey(eventType, eventSpecifier);
		if (this.listeners[key]?.[Shared.pageType]) {
			for (const listener of this.listeners[key][Shared.pageType]) {
				await listener(data, eventSpecifier);
			}
		}
		if (!isFromBackground) {
			const message: DispatchEventMessage<T> = {
				action: 'dispatch-event',
				eventType,
				eventSpecifier,
				data,
			};
			if (Shared.pageType === 'background') {
				await Messaging.toAllContent(message);
			} else {
				await Messaging.toExtension(message);
			}
		}
	}

	getKey(eventType: Event, eventSpecifier: string | null) {
		return `${eventType}_${eventSpecifier ?? ''}`;
	}
}

export const EventDispatcher = new _EventDispatcher();
Shared.events = EventDispatcher;
