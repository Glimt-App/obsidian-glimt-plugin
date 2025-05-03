import { addIcon, Notice, Plugin, setIcon } from "obsidian";
import { GLIMT_ICON } from "src/icons";
import { PodcastGlimt } from "src/types";
import { API_URL } from "./constants";
import { formatGlimtToMarkdown } from "./lib/documents";
import { SuccessNotice, WarnNotice } from "./notice";
import {
	DEFAULT_SETTINGS,
	GlimtPluginSettings,
	GlimtSettingsTab,
} from "./settings";

// Remember to rename these classes and interfaces!

export default class GlimtPlugin extends Plugin {
	settings: GlimtPluginSettings;

	statusBarItemEl: HTMLElement;

	syncTimer: NodeJS.Timeout;

	async onload() {
		addIcon("glimt-icon", GLIMT_ICON);

		// This creates an icon in the left ribbon.
		this.addRibbonIcon("glimt-icon", "Glimt Sync", (evt: MouseEvent) => {
			this.syncBackend();
		});

		await this.loadSettings();
		this.syncBackend();

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		this.statusBarItemEl = this.addStatusBarItem();

		this.addCommand({
			id: "sync-glimts",
			name: "Sync Glimt Bookmarks",
			callback: async () => {
				await this.syncBackend();
			},
		});

		this.addCommand({
			id: "sync-glimts-force",
			name: "Force - Sync Glimt Bookmarks",
			callback: async () => {
				if (
					confirm(
						"Are you sure you want to sync all Glimts? This will overwrite existing files with the same name."
					)
				) {
					await this.syncBackend({ force: true });
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GlimtSettingsTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(
		// 	window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		// );
	}

	async syncBackend(
		{ force, silent }: { force?: boolean; silent?: boolean } = {
			force: false,
		}
	) {
		const apiKey = this.settings.token;

		if (!apiKey) {
			new WarnNotice(
				"Glimt: please set your secret key in the settings.",
				"file-warning",
				10_000
			);
			return;
		}

		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
		}

		const isSyncingMessage = !silent ? new Notice("Syncing Glimts") : null;

		const batchSize = 50;
		const startCursor = force ? 0 : this.settings.cursor;

		let index = 0;

		while (true) {
			const glimts = await this.fetchGlimts({
				cursor: index === 0 ? startCursor : this.settings.cursor,
				limit: batchSize,
			});

			if (!glimts || glimts.length === 0) {
				break;
			}

			let folder = this.app.vault.getAbstractFileByPath(
				this.settings.folder
			);

			if (force && folder) {
				await this.app.vault.delete(folder, force);
				folder = null;
			}

			if (!folder) {
				await this.app.vault.createFolder(this.settings.folder);
			}

			for (const glimt of glimts) {
				const filePath = `${
					this.settings.folder
				}/${glimt.title?.replace(/\:/g, "")} [${glimt.id}].md`;
				const content = formatGlimtToMarkdown(glimt);

				let file = this.app.vault.getAbstractFileByPath(filePath);

				if (file && force) {
					await this.app.vault.modify(file as any, content);
				} else if (!file) {
					await this.app.vault.create(filePath, content);
				}
			}

			const newCursor = glimts
				.map((glimt) => glimt.id)
				.sort((a, b) => b - a)[0];

			if (newCursor === undefined) {
				break;
			}

			if (newCursor) {
				this.settings.cursor = newCursor;
			}

			index++;
		}

		await this.saveSettings();

		if (!silent) new SuccessNotice("Glimts synced!");

		isSyncingMessage?.hide();

		this.syncTimer = setTimeout(() => {
			this.syncBackend({ silent: true });
		}, this.settings.syncInterval);
	}

	onunload() {
		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async fetchGlimts({ cursor, limit }: { cursor: number; limit: number }) {
		const response = await fetch(
			`${API_URL}/api/integrations/obsidian/glimt?cursor=${cursor}&limit=${limit}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `${this.settings.token}`,
				},
			}
		);

		if (response.status === 200) {
			return (await response.json()) as PodcastGlimt[];
		} else {
			throw new Error("Failed to fetch Glimts");
		}
	}

	async verifyToken() {
		const response = await fetch(
			`${API_URL}/api/integrations/obsidian/auth`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `${this.settings.token}`,
				},
				body: JSON.stringify({
					token: this.settings.token,
				}),
			}
		);

		if (response.status === 200) {
			const body = (await response.json()) as any;
			return body.success;
		} else {
			throw new Error("Failed to log in");
		}
	}
}
