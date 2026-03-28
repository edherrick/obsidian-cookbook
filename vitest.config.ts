import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			obsidian: `${__dirname}src/__mocks__/obsidian.ts`,
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
