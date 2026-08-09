import { Service } from '@models/Service';

export const HboMaxService = new Service({
	id: 'hbo-max',
	name: 'Max / HBO Max',
	homePage: 'https://www.max.com/',
	hostPatterns: ['*://*.max.com/*', '*://*.hbo.com/*', '*://*.hbomax.com/*'],
	hasScrobbler: true,
	hasSync: true,
	hasAutoSync: true,
});
