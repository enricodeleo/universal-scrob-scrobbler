import { ScrobApi } from '@apis/ScrobApi';
import { Shared } from '@common/Shared';
import { createScrobbleItem, ScrobbleItem } from '@models/Item';

class _ScrobScrobble extends ScrobApi {
	private sessionKey: string | null = null;

	async start(item: ScrobbleItem): Promise<void> {
		if (!item.scrob) {
			return;
		}
		await this.activate();
		try {
			const body: Record<string, unknown> = {
				tmdb_id: item.scrob.tmdbId || 0,
				media_type: item.scrob.type,
				title: item.scrob.title,
			};
			if (item.scrob.tvdbId && item.scrob.tvdbId > 0) {
				body.tvdb_id = item.scrob.tvdbId;
			}
			if (item.scrob.type === 'episode') {
				body.tmdb_id = item.scrob.tmdbId || item.scrob.show.tmdbId || 0;
				body.show_tmdb_id = item.scrob.show.tmdbId || item.scrob.show.tvdbId || 0;
				if (item.scrob.show.tvdbId && item.scrob.show.tvdbId > 0) {
					body.show_tvdb_id = item.scrob.show.tvdbId;
				}
				body.season_number = item.scrob.season;
				body.episode_number = item.scrob.number;
			}

			const responseText = await this.requests.send({
				url: `${this.API_URL}/history/session/start`,
				method: 'POST',
				body,
			});
			const response = JSON.parse(responseText) as { session_key?: string };
			if (response.session_key) {
				this.sessionKey = response.session_key;
			}

			let { scrobblingDetails } = await Shared.storage.get('scrobblingDetails');
			if (scrobblingDetails?.tabId === Shared.tabId) {
				scrobblingDetails.isPaused = false;
			} else {
				scrobblingDetails = {
					item: item.save(),
					tabId: Shared.tabId,
					isPaused: false,
				};
			}
			await Shared.storage.set({ scrobblingDetails }, false);
			await Shared.events.dispatch('SCROBBLE_START', null, scrobblingDetails);
			await Shared.events.dispatch('SCROBBLE_SUCCESS', null, {
				item: item.scrob?.save(),
				scrobbleType: 1,
			});
		} catch (err) {
			if (Shared.errors.validate(err)) {
				await Shared.events.dispatch('SCROBBLE_ERROR', null, {
					item: item.scrob?.save(),
					scrobbleType: 1,
					error: err,
				});
			}
		}
	}

	async pause(item: ScrobbleItem): Promise<void> {
		if (!item.scrob) {
			return;
		}
		await this.activate();
		if (this.sessionKey) {
			try {
				await this.requests.send({
					url: `${this.API_URL}/history/session/${this.sessionKey}`,
					method: 'PATCH',
					body: {
						progress_seconds: Math.round(item.progress * 60),
						state: 'paused',
					},
				});
			} catch (_) {}
		}
		const { scrobblingDetails } = await Shared.storage.get('scrobblingDetails');
		if (scrobblingDetails) {
			scrobblingDetails.isPaused = true;
			await Shared.storage.set({ scrobblingDetails }, false);
			await Shared.events.dispatch('SCROBBLE_PAUSE', null, scrobblingDetails);
		}
	}

	async stop(item?: ScrobbleItem): Promise<void> {
		const { scrobblingDetails } = await Shared.storage.get('scrobblingDetails');
		if (!scrobblingDetails) {
			return;
		}
		if (!item) {
			item = createScrobbleItem(scrobblingDetails.item);
		}
		if (!item) {
			return;
		}
		if (item.scrob && this.sessionKey) {
			await this.activate();
			try {
				if (item.progress >= 80) {
					await this.requests.send({
						url: `${this.API_URL}/history/session/${this.sessionKey}/complete`,
						method: 'POST',
					});
				} else {
					await this.requests.send({
						url: `${this.API_URL}/history/session/${this.sessionKey}`,
						method: 'DELETE',
					});
				}
			} catch (_) {}
			this.sessionKey = null;
		}
		await Shared.storage.remove('scrobblingDetails', false);
		await Shared.events.dispatch('SCROBBLE_STOP', null, scrobblingDetails);
	}
}

export const ScrobScrobble = new _ScrobScrobble();
