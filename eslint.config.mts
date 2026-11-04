// Runs in Node; the plugin source deliberately doesn't load Node's types
/// <reference types="node" />
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.mts',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			// Frontmatter keys and folder names appear in placeholders exactly as
			// the user types them, so they must stay lowercase.
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					ignoreRegex: [
						"^(cook-soon|cook-together|cover|prep|title, cook-time, cover|recipes/cook sessions)$",
					],
				},
			],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"vitest.config.ts",
	]),
);
