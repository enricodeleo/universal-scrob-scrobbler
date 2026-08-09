import { ScrobAuth } from '@apis/ScrobAuth';
import { Messaging } from '@common/Messaging';
import { Shared } from '@common/Shared';

class _Session {
	isLoggedIn: boolean;

	constructor() {
		this.isLoggedIn = false;
	}

	async checkLogin(): Promise<void> {
		try {
			const auth = await ScrobAuth.validateConnection();
			if (auth && auth.instanceUrl && auth.apiKey) {
				this.isLoggedIn = true;
				await Shared.events.dispatch('LOGIN_SUCCESS', null, { auth });
			} else {
				throw new Error('Not connected to Scrob');
			}
		} catch (err) {
			this.isLoggedIn = false;
			if (Shared.errors.validate(err)) {
				await Shared.events.dispatch('LOGIN_ERROR', null, { error: err });
			}
		}
	}

	async login(instanceUrl: string, apiKey: string): Promise<void> {
		try {
			const auth = await Messaging.toExtension({ action: 'login', instanceUrl, apiKey });
			if (auth && auth.instanceUrl && auth.apiKey) {
				this.isLoggedIn = true;
				await Shared.events.dispatch('LOGIN_SUCCESS', null, { auth });
			} else {
				throw new Error('Invalid Scrob connection');
			}
		} catch (err) {
			this.isLoggedIn = false;
			if (Shared.errors.validate(err)) {
				Shared.errors.error('Failed to connect to Scrob.', err);
				await Shared.events.dispatch('LOGIN_ERROR', null, { error: err });
			}
		}
	}

	async logout(): Promise<void> {
		try {
			await Messaging.toExtension({ action: 'logout' });
			this.isLoggedIn = false;
			await Shared.events.dispatch('LOGOUT_SUCCESS', null, {});
		} catch (err) {
			this.isLoggedIn = true;
			if (Shared.errors.validate(err)) {
				Shared.errors.error('Failed to disconnect from Scrob.', err);
				await Shared.events.dispatch('LOGOUT_ERROR', null, { error: err });
			}
		}
	}
}

export const Session = new _Session();
