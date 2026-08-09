import { I18N } from '@common/I18N';
import { CustomSnackbar } from '@components/CustomSnackbar';
import { PopupInfo } from '@components/PopupInfo';
import { PopupOverlay } from '@components/PopupOverlay';
import { BackgroundImage } from '@components/BackgroundImage';
import { ScrobbleItem } from '@models/Item';
import { Pause as PauseIcon } from '@mui/icons-material';
import { Box, LinearProgress, Tooltip, Typography } from '@mui/material';

export interface PopupWatchingProps {
	item: ScrobbleItem;
	isPaused: boolean;
}

export const PopupWatching = ({ item, isPaused }: PopupWatchingProps): JSX.Element => {
	return (
		<>
			<Box>
				<BackgroundImage imageUrl={item.scrob?.imageUrl || item.imageUrl} />
				<Box
					sx={{
						position: 'relative',
						height: 1,

						'& > *': {
							height: 1,
						},
					}}
				>
					<PopupInfo>
						<Typography variant="overline">{I18N.translate('nowScrobbling')}</Typography>
						{item.scrob?.type === 'episode' ? (
							<>
								<Typography variant="h6">{item.scrob.title}</Typography>
								<Typography variant="subtitle2">{I18N.translate('from')}</Typography>
								<Typography variant="subtitle1">{item.scrob.show.title}</Typography>
							</>
						) : (
							<Typography variant="h6">{item.scrob?.title || item.title}</Typography>
						)}
						{item.progress > 0.0 && (
							<Tooltip title={I18N.translate('progress', item.progress.toString())}>
								<LinearProgress
									value={item.progress}
									variant="determinate"
									sx={{
										position: 'absolute',
										bottom: 0,
										left: 0,
										width: 1,
										height: ({ spacing }) => spacing(1),
									}}
								/>
							</Tooltip>
						)}
					</PopupInfo>
				</Box>
			</Box>
			{isPaused && (
				<PopupOverlay>
					<PauseIcon />
				</PopupOverlay>
			)}
			<CustomSnackbar />
		</>
	);
};
