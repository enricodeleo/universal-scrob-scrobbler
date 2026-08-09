import { Requests, withHeaders } from '@common/Requests';
import { Shared } from '@common/Shared';

export const getScrobApiUrl = (instanceUrl: string): string => {
	const trimmed = instanceUrl.replace(/\/+$/, '');
	if (trimmed.endsWith('/api/proxy')) {
		return trimmed;
	}
	return `${trimmed}/api/proxy`;
};

export class ScrobApi {
	HOST_URL = '';
	API_URL = '';
	HISTORY_URL = '';
	SCROBBLE_URL = '';
	SEARCH_URL = '';
	MEDIA_URL = '';

	requests = Requests;

	isActivated = false;

	async activate(): Promise<void> {
		const values = await Shared.storage.get('auth');
		const auth = values.auth;
		if (auth?.instanceUrl && auth?.apiKey) {
			const baseUrl = auth.instanceUrl.replace(/\/+$/, '');
			const apiUrl = getScrobApiUrl(baseUrl);
			this.HOST_URL = baseUrl;
			this.API_URL = apiUrl;
			this.HISTORY_URL = `${apiUrl}/history`;
			this.SCROBBLE_URL = `${apiUrl}/history/session`;
			this.SEARCH_URL = `${apiUrl}/media/search`;
			this.MEDIA_URL = `${apiUrl}/media`;

			const headers: Record<string, string> = {
				'X-Api-Key': auth.apiKey,
			};
			this.requests = withHeaders(headers, Requests);
			this.isActivated = true;
		}
	}
}
