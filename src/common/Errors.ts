import { ScrobbleErrorData, SearchErrorData } from '@common/Events';
import { RequestError } from '@common/RequestError';
import { Shared } from '@common/Shared';
import { ErrorInfo } from 'react';

class _Errors {
	init() {
		Shared.events.subscribe('SCROBBLE_ERROR', null, (data: ScrobbleErrorData) =>
			this.onItemError(data, 'scrobble')
		);
		Shared.events.subscribe('SEARCH_ERROR', null, (data: SearchErrorData) =>
			this.onItemError(data, 'find')
		);
	}

	async onItemError(
		data: ScrobbleErrorData | SearchErrorData,
		type: 'scrobble' | 'find'
	): Promise<void> {
		if (data.error) {
			const values = await Shared.storage.get('auth');
			if (values.auth && values.auth.apiKey) {
				this.error(`Failed to ${type} item.`, data.error);
			} else {
				this.warning(`Failed to ${type} item.`, data.error);
			}
		}
	}

	log(message: Error | string, details: Error | ErrorInfo): void {
		console.log(`[UTS] ${message.toString()}`, details);
	}

	warning(message: string, details: Error): void {
		console.warn(`[UTS] ${message}`, details);
	}

	error(message: string, details: Error): void {
		console.error(`[UTS] ${message}`, details);
	}

	validate(err: unknown): err is Error {
		if (err instanceof RequestError) {
			return !err.isCanceled;
		}

		return err instanceof Error;
	}
}

export const Errors = new _Errors();

Shared.errors = Errors;
