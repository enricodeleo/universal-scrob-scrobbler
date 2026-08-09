export type ScrobItem = ScrobScrobbleItem | ScrobShowItem;

export type ScrobScrobbleItem = ScrobEpisodeItem | ScrobMovieItem;

export type ScrobItemValues = ScrobScrobbleItemValues | ScrobShowItemValues;

export type ScrobScrobbleItemValues = ScrobEpisodeItemValues | ScrobMovieItemValues;

export interface ScrobBaseItemValues {
	id: number;
	tmdbId: number;
	tvdbId?: number;
	syncId?: number;
	title: string;
	year: number;
	releaseDate?: number;
	watchedAt?: number | null;
	/** List of other watchedAt values available */
	otherWatches?: number[];
	progress?: number;
	imageUrl?: string | null;
}

export interface ScrobEpisodeItemValues extends ScrobBaseItemValues {
	type: 'episode';
	season: number;
	number: number;
	show: ScrobShowItemValues;
}

export type ScrobEpisodeItemParams = Omit<ScrobEpisodeItemValues, 'type' | 'show'> & {
	show: Omit<ScrobShowItemValues, 'type'>;
};

export interface ScrobShowItemValues extends ScrobBaseItemValues {
	type: 'show';
}

export type ScrobShowItemParams = Omit<ScrobShowItemValues, 'type'>;

export interface ScrobMovieItemValues extends ScrobBaseItemValues {
	type: 'movie';
}

export type ScrobMovieItemParams = Omit<ScrobMovieItemValues, 'type'>;

abstract class ScrobBaseItem implements ScrobBaseItemValues {
	id: number;
	tmdbId: number;
	tvdbId?: number;
	syncId?: number;
	title: string;
	year: number;
	releaseDate?: number;
	watchedAt?: number | null;
	otherWatches?: number[];
	progress: number;
	imageUrl?: string | null;

	constructor(values: ScrobBaseItemValues) {
		this.id = values.id || values.tmdbId || values.tvdbId || 0;
		this.tmdbId = values.tmdbId || 0;
		this.tvdbId = values.tvdbId;
		this.syncId = values.syncId;
		this.title = values.title;
		this.year = values.year;
		this.releaseDate = values.releaseDate;
		this.watchedAt = values.watchedAt;
		this.otherWatches =
			values.otherWatches != null ? [...values.otherWatches] : values.otherWatches;
		this.progress = values.progress ? Math.round(values.progress * 100) / 100 : 0.0;
		this.imageUrl = values.imageUrl;
	}

	save(): ScrobBaseItemValues {
		return {
			id: this.id,
			tmdbId: this.tmdbId,
			tvdbId: this.tvdbId,
			syncId: this.syncId,
			title: this.title,
			year: this.year,
			releaseDate: this.releaseDate,
			watchedAt: this.watchedAt,
			otherWatches: this.otherWatches != null ? [...this.otherWatches] : this.otherWatches,
			progress: this.progress,
			imageUrl: this.imageUrl,
		};
	}

	/**
	 * Returns the ID used to uniquely identify the item in the database.
	 */
	abstract getDatabaseId(): string;

	abstract getHistoryUrl(): string;

	/**
	 * Clones the item for immutability.
	 */
	abstract clone(): ScrobItem;
}

export class ScrobEpisodeItem extends ScrobBaseItem implements ScrobEpisodeItemValues {
	type = 'episode' as const;
	season: number;
	number: number;
	show: ScrobShowItem;

	constructor(values: ScrobEpisodeItemParams) {
		super(values);
		this.season = values.season;
		this.number = values.number;
		this.show = new ScrobShowItem(values.show);
	}

	save(): ScrobEpisodeItemValues {
		return {
			...super.save(),
			type: this.type,
			season: this.season,
			number: this.number,
			show: this.show.save(),
		};
	}

	getDatabaseId(): string {
		const showId = this.show?.tmdbId || this.show?.tvdbId || this.tmdbId || this.id;
		return `episode_${showId.toString()}_s${this.season.toString()}_e${this.number.toString()}`;
	}

	getHistoryUrl(): string {
		return `/media/episode/${this.tmdbId}`;
	}

	clone(): ScrobEpisodeItem {
		return new ScrobEpisodeItem(this);
	}
}

export class ScrobShowItem extends ScrobBaseItem implements ScrobShowItemValues {
	type = 'show' as const;

	constructor(values: ScrobShowItemParams) {
		super(values);
	}

	save(): ScrobShowItemValues {
		return {
			...super.save(),
			type: this.type,
		};
	}

	getDatabaseId(): string {
		return `show_${this.tmdbId ? this.tmdbId.toString() : this.id.toString()}`;
	}

	getHistoryUrl(): string {
		return `/media/series/${this.tmdbId}`;
	}

	clone(): ScrobShowItem {
		return new ScrobShowItem(this);
	}
}

export class ScrobMovieItem extends ScrobBaseItem implements ScrobMovieItemValues {
	type = 'movie' as const;

	constructor(values: ScrobMovieItemParams) {
		super(values);
	}

	save(): ScrobMovieItemValues {
		return {
			...super.save(),
			type: this.type,
		};
	}

	getDatabaseId(): string {
		return `movie_${this.tmdbId ? this.tmdbId.toString() : this.id.toString()}`;
	}

	getHistoryUrl(): string {
		return `/media/movie/${this.tmdbId}`;
	}

	clone(): ScrobMovieItem {
		return new ScrobMovieItem(this);
	}
}

export const createScrobItem = (values: ScrobItemValues): ScrobItem => {
	switch (values.type) {
		case 'show':
			return new ScrobShowItem(values);

		default:
			return createScrobScrobbleItem(values);
	}
};

export const createScrobScrobbleItem = (values: ScrobScrobbleItemValues): ScrobScrobbleItem => {
	switch (values.type) {
		case 'episode':
			return new ScrobEpisodeItem(values);

		case 'movie':
			return new ScrobMovieItem(values);
	}
};

export const isScrobItem = (item: unknown): item is ScrobItem => {
	return item instanceof ScrobBaseItem;
};
