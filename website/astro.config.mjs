// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://shieldedshell.com',
	integrations: [
		starlight({
			title: 'ShieldedShell',
			description:
				'Zero-trust local safety harness and dual-agent loop orchestrator for CLI coding agents.',
			logo: {
				light: './src/assets/logo.svg',
				dark: './src/assets/logo.svg',
				replacesTitle: true,
			},
			customCss: ['./src/styles/custom.css'],
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/connerkup/shielded-shell',
				},
			],
			editLink: {
				baseUrl: 'https://github.com/connerkup/shielded-shell/edit/main/website/',
			},
			head: [
				{
					tag: 'meta',
					attrs: {
						name: 'keywords',
						content:
							'AI agents, CLI sandbox, coding agents, Claude Code, Cline, dual-agent loop, security',
					},
				},
			],
			sidebar: [
				{
					label: 'Getting started',
					items: [
						{ label: 'Introduction', slug: 'index' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick start', slug: 'getting-started/quick-start' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Sandbox and policy', slug: 'guides/sandbox' },
						{ label: 'Dual-agent loop', slug: 'guides/dual-agent-loop' },
						{ label: 'Benchmarks', slug: 'guides/benchmarks' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'CLI commands', slug: 'reference/commands' },
						{ label: 'Agent engines', slug: 'reference/engines' },
						{ label: 'Configuration', slug: 'reference/configuration' },
						{ label: 'Engine profiles', slug: 'reference/engine-profiles' },
					],
				},
				{
					label: 'Project',
					items: [
						{ label: 'Contributing', slug: 'project/contributing' },
						{ label: 'Changelog', slug: 'project/changelog' },
					],
				},
			],
		}),
	],
});
