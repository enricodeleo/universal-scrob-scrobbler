import { FullView } from '@components/FullView';
import UtsIconImage from '@images/uts-icon-128.png';
import { Box } from '@mui/material';

interface BackgroundImageProps {
	imageUrl?: string | null;
	fallbackImageUrl?: string;
}

export const BackgroundImage = ({
	imageUrl,
	fallbackImageUrl = UtsIconImage,
}: BackgroundImageProps): JSX.Element => {
	return (
		<Box>
			<FullView
				sx={{
					backgroundColor: '#000',
					backgroundImage: `url("${imageUrl || fallbackImageUrl}")`,
					backgroundPosition: 'center',
					backgroundSize: 'cover',
					backgroundRepeat: 'no-repeat',
				}}
			/>
			<FullView
				sx={{
					backgroundColor: 'rgba(0, 0, 0, 0.5)',
				}}
			/>
		</Box>
	);
};
