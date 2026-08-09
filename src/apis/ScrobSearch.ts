import { ScrobApi } from '@apis/ScrobApi';
import { CacheItems } from '@common/Cache';
import { RequestError } from '@common/RequestError';
import { Shared } from '@common/Shared';
import { EpisodeItem, Item, ScrobbleItem } from '@models/Item';
import {
	createScrobScrobbleItem,
	ScrobEpisodeItem,
	ScrobMovieItem,
	ScrobScrobbleItem,
	ScrobShowItemValues,
} from '@models/ScrobItem';

export interface ScrobSearchResult {
	id?: number;
	tmdb_id?: number;
	tvdb_id?: number;
	title?: string;
	name?: string;
	year?: number | string;
	first_air_date?: string;
	media_type?: string;
	poster_path?: string | null;
	backdrop_path?: string | null;
	still_path?: string | null;
}

class _ScrobSearch extends ScrobApi {
	async find(
		item: ScrobbleItem,
		caches: CacheItems<['itemsToScrobItems', 'scrobItems', 'urlsToScrobItems']>,
		cancelKey = 'default'
	): Promise<ScrobScrobbleItem | null> {
		let scrobItem: ScrobScrobbleItem | null = null;
		const databaseId = item.getDatabaseId();
		const scrobDatabaseId = caches.itemsToScrobItems.get(databaseId);
		let cacheItem = scrobDatabaseId ? caches.scrobItems.get(scrobDatabaseId) : null;
		if (cacheItem && cacheItem.type === 'episode' && item.type === 'episode') {
			if (cacheItem.season !== item.season || cacheItem.number !== item.number) {
				cacheItem = null;
			}
		}
		if (cacheItem && cacheItem.type !== 'show') {
			scrobItem = createScrobScrobbleItem(cacheItem);
			return scrobItem;
		}

		try {
			await this.activate();
			if (item.type === 'episode') {
				scrobItem = await this.findEpisode(item, caches, cancelKey);
			} else {
				scrobItem = await this.findMovie(item, cancelKey);
			}
			if (Shared.pageType === 'content') {
				await Shared.events.dispatch('SEARCH_SUCCESS', null, { searchItem: scrobItem });
			}
		} catch (err) {
			if (Shared.pageType === 'content' && Shared.errors.validate(err)) {
				await Shared.events.dispatch('SEARCH_ERROR', null, { error: err });
			}
			throw err;
		}

		if (scrobItem) {
			const id = scrobItem.getDatabaseId();
			caches.itemsToScrobItems.set(databaseId, id);
			caches.scrobItems.set(id, {
				...scrobItem.save(),
				syncId: undefined,
				watchedAt: undefined,
			});
		}
		return scrobItem;
	}

	async findMovie(item: Item, cancelKey = 'default'): Promise<ScrobMovieItem> {
		await this.activate();
		const responseText = await this.requests.send({
			url: `${this.SEARCH_URL}?q=${encodeURIComponent(item.title)}&type=movie${
				item.year ? `&year=${item.year.toString()}` : ''
			}`,
			method: 'GET',
			cancelKey,
		});
		const responseJson = JSON.parse(responseText);
		const results: ScrobSearchResult[] = Array.isArray(responseJson)
			? responseJson
			: responseJson.results || [];
		const match = results[0];
		if (!match) {
			throw new RequestError({
				status: 404,
				text: responseText,
				extra: { item: item.save() },
			});
		}
		const tmdbId = match.tmdb_id || match.id || 0;
		const tvdbId = match.tvdb_id;
		const posterPath = match.poster_path || match.backdrop_path;
		const imageUrl = posterPath
			? posterPath.startsWith('http')
				? posterPath
				: `https://image.tmdb.org/t/p/w500${posterPath}`
			: undefined;

		return new ScrobMovieItem({
			id: tmdbId || tvdbId || 0,
			tmdbId,
			tvdbId,
			title: match.title || match.name || item.title,
			year: match.year
				? typeof match.year === 'string'
					? parseInt(match.year, 10)
					: match.year
				: match.first_air_date
					? parseInt(match.first_air_date.split('-')[0], 10)
					: item.year || 0,
			imageUrl,
		});
	}

	async findShow(
		item: EpisodeItem,
		caches: CacheItems<['scrobItems', 'urlsToScrobItems']>,
		cancelKey = 'default'
	): Promise<ScrobShowItemValues> {
		const showTitle = item.show.title;
		const urlKey = `show_${showTitle.toLowerCase()}`;
		let scrobDatabaseId = caches.urlsToScrobItems.get(urlKey);
		let cacheItem = scrobDatabaseId
			? (caches.scrobItems.get(scrobDatabaseId) as ScrobShowItemValues | undefined)
			: null;

		if (!cacheItem) {
			await this.activate();
			// 1. Search via Scrob /media/search
			let responseText = await this.requests.send({
				url: `${this.SEARCH_URL}?q=${encodeURIComponent(showTitle)}&type=series${
					item.show.year ? `&year=${item.show.year.toString()}` : ''
				}`,
				method: 'GET',
				cancelKey,
			});
			let responseJson = JSON.parse(responseText);
			let results: ScrobSearchResult[] = Array.isArray(responseJson)
				? responseJson
				: responseJson.results || [];
			let match = results[0];

			// 2. Fallback to TVDB search if no TMDB match
			if (!match) {
				try {
					responseText = await this.requests.send({
						url: `${this.API_URL}/media/search-tvdb?q=${encodeURIComponent(showTitle)}`,
						method: 'GET',
						cancelKey,
					});
					responseJson = JSON.parse(responseText);
					results = Array.isArray(responseJson) ? responseJson : responseJson.results || [];
					match = results[0];
				} catch (_) {}
			}

			if (!match) {
				throw new RequestError({
					status: 404,
					text: 'Show not found',
					extra: { item: item.save() },
				});
			}

			const tmdbId = match.tmdb_id || match.id || 0;
			const tvdbId = match.tvdb_id;
			const yearVal = match.year
				? typeof match.year === 'string'
					? parseInt(match.year, 10)
					: match.year
				: match.first_air_date
					? parseInt(match.first_air_date.split('-')[0], 10)
					: item.show.year || 0;

			const posterPath = match.poster_path || match.backdrop_path;
			const imageUrl = posterPath
				? posterPath.startsWith('http')
					? posterPath
					: `https://image.tmdb.org/t/p/w500${posterPath}`
				: undefined;

			cacheItem = {
				type: 'show',
				id: tmdbId || tvdbId || 0,
				tmdbId,
				tvdbId,
				title: match.title || match.name || showTitle,
				year: yearVal,
				imageUrl,
			};
			scrobDatabaseId = `show_${(tmdbId || tvdbId || 0).toString()}`;
			caches.scrobItems.set(scrobDatabaseId, cacheItem);
			caches.urlsToScrobItems.set(urlKey, scrobDatabaseId);
		}
		return cacheItem;
	}

	async findEpisode(
		item: EpisodeItem,
		caches: CacheItems<['scrobItems', 'urlsToScrobItems']>,
		cancelKey = 'default'
	): Promise<ScrobEpisodeItem> {
		const showItem = await this.findShow(item, caches, cancelKey);
		let season = item.season || 0;
		let number = item.number || 0;
		let episodeTitle = item.title || '';
		let episodeTmdbId = 0;
		let epStillPath: string | undefined | null = undefined;

		if (showItem.tmdbId && showItem.tmdbId > 0) {
			let seasonsToTry: number[] = [];
			if (season > 0) {
				seasonsToTry = [season];
			} else {
				try {
					const showResponse = await this.requests.send({
						url: `${this.API_URL}/shows/${showItem.tmdbId.toString()}`,
						method: 'GET',
						cancelKey,
					});
					const showData = JSON.parse(showResponse) as {
						seasons_meta?: { season_number: number }[];
					};
					if (showData.seasons_meta && showData.seasons_meta.length > 0) {
						seasonsToTry = showData.seasons_meta
							.map((s) => s.season_number)
							.filter((sNum) => sNum > 0);
					}
				} catch (_) {}
				if (seasonsToTry.length === 0) {
					seasonsToTry = [1];
				}
			}

			for (const sNum of seasonsToTry) {
				try {
					const responseText = await this.requests.send({
						url: `${this.API_URL}/shows/${showItem.tmdbId.toString()}/season/${sNum.toString()}`,
						method: 'GET',
						cancelKey,
					});
					const seasonData = JSON.parse(responseText) as {
						episodes?: {
							id?: number;
							tmdb_id?: number;
							title?: string;
							season_number?: number;
							episode_number?: number;
							still_path?: string | null;
							poster_path?: string | null;
						}[];
					};

					if (seasonData.episodes && seasonData.episodes.length > 0) {
						let epMatch = undefined;
						if (number > 0) {
							epMatch = seasonData.episodes.find((ep) => ep.episode_number === number);
						}
						if (!epMatch && episodeTitle) {
							const normTarget = episodeTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
							epMatch = seasonData.episodes.find((ep) => {
								const normTitle = (ep.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
								return (
									normTitle.length > 0 &&
									normTarget.length > 0 &&
									(normTitle.includes(normTarget) || normTarget.includes(normTitle))
								);
							});
						}
						if (epMatch) {
							season = epMatch.season_number || sNum;
							number = epMatch.episode_number || number;
							episodeTitle = epMatch.title || episodeTitle;
							episodeTmdbId = epMatch.tmdb_id || epMatch.id || 0;
							epStillPath = epMatch.still_path || epMatch.poster_path;
							break;
						}
					}
				} catch (_) {}
			}
		}

		if (season === 0) season = 1;
		if (number === 0) number = 1;

		const imageUrl = epStillPath
			? epStillPath.startsWith('http')
				? epStillPath
				: `https://image.tmdb.org/t/p/w300${epStillPath}`
			: showItem.imageUrl;

		return new ScrobEpisodeItem({
			id: episodeTmdbId || showItem.tmdbId || showItem.tvdbId || 0,
			tmdbId: episodeTmdbId || showItem.tmdbId || 0,
			tvdbId: showItem.tvdbId,
			title: episodeTitle || `Episode ${number.toString()}`,
			year: showItem.year,
			season,
			number,
			show: showItem,
			imageUrl,
		});
	}
}

export const ScrobSearch = new _ScrobSearch();
