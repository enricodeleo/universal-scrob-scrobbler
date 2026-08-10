module.exports = {
	plugins: [
		[
			'@babel/plugin-transform-runtime',
			{
				regenerator: false,
			},
		],
	],
	presets: [
		'@babel/typescript',
		[
			'@babel/preset-env',
			{
				targets: {
					firefox: '109',
					chrome: '109',
				},
			},
		],
		[
			'@babel/preset-react',
			{
				runtime: 'automatic',
			},
		],
	],
};
