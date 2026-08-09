import { Session } from '@common/Session';
import { Shared } from '@common/Shared';
import { Center } from '@components/Center';
import { useHistory } from '@contexts/HistoryContext';
import { Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';

export const LoginPage = (): JSX.Element => {
	const history = useHistory();
	const [isLoading, setLoading] = useState(false);
	const [isCheckingLogin, setCheckingLogin] = useState(true);
	const [instanceUrl, setInstanceUrl] = useState('');
	const [apiKey, setApiKey] = useState('');
	const [error, setError] = useState('');

	const onConnectSubmit = async (e: FormEvent): Promise<void> => {
		e.preventDefault();
		if (!instanceUrl || !apiKey) {
			setError('Please enter both Instance URL and API Key.');
			return;
		}
		setError('');
		setLoading(true);
		await Session.login(instanceUrl, apiKey);
	};

	useEffect(() => {
		const startListeners = () => {
			Shared.events.subscribe('LOGIN_SUCCESS', null, onLoginSuccess);
			Shared.events.subscribe('LOGIN_ERROR', null, onLoginError);
		};

		const stopListeners = () => {
			Shared.events.unsubscribe('LOGIN_SUCCESS', null, onLoginSuccess);
			Shared.events.unsubscribe('LOGIN_ERROR', null, onLoginError);
		};

		const onLoginSuccess = () => {
			setLoading(false);
			setCheckingLogin(false);
			if (Shared.redirectPath) {
				history.push(Shared.redirectPath);
			} else {
				history.push('/home');
			}
		};

		const onLoginError = () => {
			setLoading(false);
			setCheckingLogin(false);
			setError('Failed to connect to Scrob instance. Check URL and API Key.');
		};

		startListeners();
		return stopListeners;
	}, [history]);

	useEffect(() => {
		const init = async () => {
			await Session.checkLogin();
			setCheckingLogin(false);
		};

		void init();
	}, []);

	if (isCheckingLogin) {
		return (
			<Center>
				<CircularProgress color="secondary" />
			</Center>
		);
	}

	return (
		<Center>
			<Box
				component="form"
				onSubmit={(e) => void onConnectSubmit(e)}
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: 2,
					width: '100%',
					maxWidth: 400,
					p: 3,
				}}
			>
				<Typography variant="h5" align="center" gutterBottom>
					Connect to Scrob
				</Typography>
				<TextField
					label="Scrob Instance URL"
					placeholder="https://scrob.example.com"
					value={instanceUrl}
					onChange={(e) => setInstanceUrl(e.target.value)}
					fullWidth
					required
					variant="outlined"
					size="small"
				/>
				<TextField
					label="API Key"
					placeholder="Enter your Scrob API Key"
					value={apiKey}
					onChange={(e) => setApiKey(e.target.value)}
					type="password"
					fullWidth
					required
					variant="outlined"
					size="small"
				/>
				{error && (
					<Typography color="error" variant="body2" align="center">
						{error}
					</Typography>
				)}
				<Button color="secondary" type="submit" variant="contained" disabled={isLoading} fullWidth>
					{isLoading ? <CircularProgress size={24} color="inherit" /> : 'Connect'}
				</Button>
			</Box>
		</Center>
	);
};
