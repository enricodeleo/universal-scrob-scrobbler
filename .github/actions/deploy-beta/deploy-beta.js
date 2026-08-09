const { getInput, setFailed } = require('@actions/core');
const { context, getOctokit } = require('@actions/github');
const fs = require('fs');
const path = require('path');
const packageJson = require('../../../package.json');

const defaultParams = {
	...context.repo,
};

const deployBeta = async () => {
	const token =
		getInput('github-token') || getInput('trakt-tools-bot-token') || process.env.GITHUB_TOKEN;
	const octokit = getOctokit(token, {
		userAgent: 'universal-scrob-scrobbler',
	});

	console.log('Deleting previous beta release...');

	const releases = await octokit.rest.repos.listReleases({
		...defaultParams,
	});

	const previousRelease = releases.data.find((release) => release.prerelease);
	if (previousRelease) {
		await octokit.rest.repos.deleteRelease({
			...defaultParams,
			release_id: previousRelease.id,
		});
	}

	console.log('Deleting preious beta tag...');

	try {
		await octokit.rest.git.deleteRef({
			...defaultParams,
			ref: 'tags/beta',
		});
	} catch (err) {
		console.log('Beta tag does not exist or was already deleted:', err.message);
	}

	console.log('Generating release...');

	const name = `Beta (${new Date().toISOString()})`;

	const release = await octokit.rest.repos.createRelease({
		...defaultParams,
		name,
		tag_name: 'beta',
		prerelease: true,
	});

	const distPath = path.resolve(__dirname, '../../../dist');
	const files = [
		{
			content: fs.readFileSync(path.resolve(distPath, 'chrome.zip')),
			name: 'chrome.zip',
			type: 'application/zip',
		},
		{
			content: fs.readFileSync(path.resolve(distPath, 'firefox.zip')),
			name: 'firefox.zip',
			type: 'application/zip',
		},
	];

	console.log('Uploading assets...');

	const promises = [];
	for (const file of files) {
		promises.push(
			octokit.rest.repos.uploadReleaseAsset({
				...defaultParams,
				release_id: release.data.id,
				name: file.name,
				data: file.content,
				url: release.data.upload_url,
			})
		);
	}
	await Promise.all(promises);

	console.log('Publishing release...');

	await octokit.rest.repos.updateRelease({
		...defaultParams,
		release_id: release.data.id,
		draft: false,
	});
};

const main = async () => {
	try {
		await deployBeta();
	} catch (err) {
		setFailed(err.message);
	}
};

void main();
