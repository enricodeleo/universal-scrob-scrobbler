import { ScrobblingDetails } from '@common/BrowserStorage';
import { Shared } from '@common/Shared';
import { Center } from '@components/Center';
import { PopupNotWatching } from '@components/PopupNotWatching';
import { PopupWatching } from '@components/PopupWatching';
import { createScrobbleItem, ScrobbleItem } from '@models/Item';
import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';

interface IPopupHomeContent {
	isLoading: boolean;
	scrobblingItem: ScrobbleItem | null;
	isPaused: boolean;
}

const initialContentState: IPopupHomeContent = {
	isLoading: true,
	scrobblingItem: null,
	isPaused: false,
};

export const HomePage = (): JSX.Element => {
	const [content, setContent] = useState(initialContentState);

	useEffect(() => {
		const getScrobblingItem = async (): Promise<void> => {
			const { scrobblingDetails } = await Shared.storage.get('scrobblingDetails');
			setContent({
				isLoading: false,
				scrobblingItem: scrobblingDetails?.item ? createScrobbleItem(scrobblingDetails.item) : null,
				isPaused: scrobblingDetails?.isPaused ?? false,
			});
		};

		void getScrobblingItem();
	}, []);

	useEffect(() => {
		const startListeners = () => {
			Shared.events.subscribe('SCROBBLE_START', null, onScrobbleStart);
			Shared.events.subscribe('SCROBBLE_PAUSE', null, onScrobblePause);
			Shared.events.subscribe('SCROBBLE_STOP', null, onScrobbleStop);
			Shared.events.subscribe('SCROBBLE_PROGRESS', null, onScrobbleProgress);
		};

		const stopListeners = () => {
			Shared.events.unsubscribe('SCROBBLE_START', null, onScrobbleStart);
			Shared.events.unsubscribe('SCROBBLE_PAUSE', null, onScrobblePause);
			Shared.events.unsubscribe('SCROBBLE_STOP', null, onScrobbleStop);
			Shared.events.unsubscribe('SCROBBLE_PROGRESS', null, onScrobbleProgress);
		};

		const onScrobbleStart = (data: ScrobblingDetails) => {
			setContent((prevContent) => ({
				...prevContent,
				scrobblingItem: data.item
					? createScrobbleItem({
							...data.item,
							imageUrl: prevContent.scrobblingItem?.imageUrl,
						})
					: null,
				isPaused: false,
			}));
		};

		const onScrobblePause = () => {
			setContent((prevContent) => ({
				...prevContent,
				isPaused: true,
			}));
		};

		const onScrobbleStop = () => {
			setContent((prevContent) => ({
				...prevContent,
				scrobblingItem: null,
				isPaused: false,
			}));
		};

		const onScrobbleProgress = (data: ScrobblingDetails) => {
			setContent((prevContent) => ({
				...prevContent,
				scrobblingItem: data.item
					? createScrobbleItem({
							...data.item,
							imageUrl: prevContent.scrobblingItem?.imageUrl,
						})
					: null,
			}));
		};

		startListeners();
		return stopListeners;
	}, []);

	let component = null;
	if (content.isLoading) {
		component = (
			<Center>
				<CircularProgress color="secondary" />
			</Center>
		);
	} else if (content.scrobblingItem) {
		component = <PopupWatching item={content.scrobblingItem} isPaused={content.isPaused} />;
	} else {
		component = <PopupNotWatching />;
	}
	return component;
};
