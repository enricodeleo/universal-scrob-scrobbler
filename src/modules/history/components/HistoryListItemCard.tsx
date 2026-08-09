import { I18N } from '@common/I18N';
import { Shared } from '@common/Shared';
import { Utils } from '@common/Utils';
import { Center } from '@components/Center';
import { HistoryListItemDivider } from '@components/HistoryListItemDivider';
import { BackgroundImage } from '@components/BackgroundImage';
import { isItem, ScrobbleItem } from '@models/Item';
import { isScrobItem, ScrobItem } from '@models/ScrobItem';
import {
	Button,
	Card,
	CardContent,
	LinearProgress,
	Link,
	Skeleton,
	Tooltip,
	Typography,
} from '@mui/material';

interface HistoryListItemCardProps {
	isLoading: boolean;
	item?: ScrobbleItem | ScrobItem | null;
	name: string;
	imageUrl?: string | null;
	openMissingWatchedDateDialog?: () => Promise<void>;
}

export const HistoryListItemCard = ({
	isLoading,
	item,
	name,
	imageUrl,
	openMissingWatchedDateDialog,
}: HistoryListItemCardProps): JSX.Element => {
	const watchedAt = isItem(item) ? item.getWatchedDate() : item?.watchedAt;
	let watchedAtComponent;
	if (item) {
		if (watchedAt) {
			if (isItem(item)) {
				watchedAtComponent = (
					<Typography variant="overline">
						{`${I18N.translate('watched')} ${Utils.timestamp(watchedAt)}`}
					</Typography>
				);
			} else {
				watchedAtComponent = (
					<Typography variant="overline">
						{`${I18N.translate('watched')} ${Utils.timestamp(watchedAt)}`}
					</Typography>
				);
			}
		} else if (isScrobItem(item) && typeof watchedAt === 'undefined') {
			watchedAtComponent = (
				<Typography variant="overline">{I18N.translate('loadingHistory')}...</Typography>
			);
		} else if (openMissingWatchedDateDialog) {
			watchedAtComponent = (
				<Button
					color="secondary"
					disabled={isLoading}
					onClick={() => void openMissingWatchedDateDialog()}
				>
					<Typography variant="caption">{I18N.translate('missingWatchedDate')}</Typography>
				</Button>
			);
		} else if (isScrobItem(item) && item.otherWatches?.length) {
			watchedAtComponent = (
				<Typography variant="overline">
					<Tooltip
						title={
							<span style={{ whiteSpace: 'pre-line', textAlign: 'center', display: 'block' }}>
								{[
									I18N.translate('otherPlays'),
									...item.otherWatches.map((watch) => Utils.timestamp(watch)),
								].join('\n')}
							</span>
						}
					>
						<span>{I18N.translate('notWatched')}</span>
					</Tooltip>
				</Typography>
			);
		} else {
			watchedAtComponent = (
				<Typography variant="overline">{I18N.translate('notWatched')}</Typography>
			);
		}
	} else {
		watchedAtComponent = <Typography variant="overline">{I18N.translate('notFound')}</Typography>;
	}

	const _showImage =
		Shared.storage.options.loadImages && (!!item?.imageUrl || isScrobItem(item) || item === null);

	return (
		<Card
			sx={{
				position: 'relative',
				display: 'flex',
				flexDirection: 'column',
				width: 350,
				height: 250,
			}}
		>
			<BackgroundImage imageUrl={imageUrl} />
			<CardContent
				sx={{
					position: 'relative',
					zIndex: 1,
					display: 'flex',
					flexDirection: 'column',
					flexGrow: 1,
					justifyContent: 'space-between',
					padding: 2,
					backgroundColor: 'rgba(0, 0, 0, 0.7)',
					color: '#fff',
				}}
			>
				{isLoading ? (
					<>
						<Typography variant="caption">
							<Skeleton width="40%" />
						</Typography>
						<Typography variant="h6">
							<Skeleton />
						</Typography>
						<Typography variant="subtitle1">
							<Skeleton width="60%" />
						</Typography>
						<Typography variant="overline">
							<Skeleton width="50%" />
						</Typography>
					</>
				) : (
					<>
						<Typography variant="caption">{name}</Typography>
						{item ? (
							<>
								{item.type === 'episode' ? (
									<>
										<Typography variant="h6">{item.title}</Typography>
										<Typography variant="subtitle1">{item.show.title}</Typography>
									</>
								) : (
									<Typography variant="h6">{item.title}</Typography>
								)}
							</>
						) : (
							<Typography variant="h6">{I18N.translate('notFound')}</Typography>
						)}
						{watchedAtComponent}
					</>
				)}
			</CardContent>
			{isItem(item) && item.progress > 0 && (
				<LinearProgress variant="determinate" value={item.progress} />
			)}
		</Card>
	);
};
