import { AmazonPrimeApi } from '@/amazon-prime/AmazonPrimeApi';
import { ScrobbleParser } from '@common/ScrobbleParser';
import { EpisodeItem, MovieItem, ScrobbleItem } from '@models/Item';

class _AmazonPrimeParser extends ScrobbleParser {
	constructor() {
		super(AmazonPrimeApi, {
			videoPlayerSelector: 'video',
			watchingUrlRegex: /\/(detail|dp|video|watch)\//,
		});
	}

	// skip API method, we parse from DOM instead
	protected override parseItem(): Promise<ScrobbleItem | null> {
		return Promise.resolve(this.parseItemFromDom());
	}

	protected override parseItemFromDom(): ScrobbleItem | null {
		const serviceId = AmazonPrimeApi.id;

		const playerContainer = this.videoPlayer?.closest('[id^="dv-web-player"]') || document;
		const titleElement =
			playerContainer.querySelector('.atvwebplayersdk-title-text') ||
			playerContainer.querySelector('[data-automation-id="title"]') ||
			playerContainer.querySelector('.atvwebplayersdk-title') ||
			document.querySelector('.atvwebplayersdk-title-text');

		const subtitleElement =
			playerContainer.querySelector('.atvwebplayersdk-subtitle-text') ||
			playerContainer.querySelector('[data-automation-id="subtitle"]') ||
			playerContainer.querySelector('.atvwebplayersdk-subtitle') ||
			document.querySelector('.atvwebplayersdk-subtitle-text');

		if (!titleElement) {
			return null;
		}

		const title = titleElement.textContent?.trim() || '';
		const subtitle = subtitleElement?.textContent?.trim() || '';

		if (!title) {
			return null;
		}

		const episodeMatch =
			subtitle.match(
				/(?:Season|S)\s*(?<season>\d+)[,:]?\s*(?:Ep\.?|Episode|E)\s*(?<episode>\d+)\s*[-:]?\s*(?<episodeTitle>.*)/i
			) || subtitle.match(/(?:Ep\.?|Episode|E)\s*(?<episode>\d+)\s*[-:]?\s*(?<episodeTitle>.*)/i);

		if (episodeMatch?.groups) {
			const season = episodeMatch.groups.season ? parseInt(episodeMatch.groups.season, 10) : 1;
			const episodeNumber = parseInt(episodeMatch.groups.episode, 10);
			const episodeTitle = episodeMatch.groups.episodeTitle?.trim() || `Episode ${episodeNumber}`;

			const showSlug = title.toLowerCase().replace(/[^a-z0-9]/gi, '');
			const episodeSlug = episodeTitle.toLowerCase().replace(/[^a-z0-9]/gi, '');
			const id = `${showSlug}-s${season}-e${episodeNumber}-${episodeSlug}`;

			return new EpisodeItem({
				serviceId,
				id,
				title: episodeTitle,
				season,
				number: episodeNumber,
				show: {
					serviceId,
					title,
				},
			});
		}

		const movieSlug = title.toLowerCase().replace(/[^a-z0-9]/gi, '');
		return new MovieItem({
			serviceId,
			id: movieSlug,
			title,
		});
	}
}

export const AmazonPrimeParser = new _AmazonPrimeParser();
