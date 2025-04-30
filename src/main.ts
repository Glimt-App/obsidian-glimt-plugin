import { addIcon, App, Modal, Notice, Plugin } from "obsidian";
import { GLIMT_ICON } from "src/icons";
import { PodcastGlimt } from "src/types";
import { SuccessNotice, WarnNotice } from "./notice";
import { GlimtSettingsTab } from "./settings";
import { formatTimeStampFromSeconds } from "./lib/time";
import { API_URL } from "./constants";

// Remember to rename these classes and interfaces!

interface GlimtPluginSettings {
	folder: string;
	token: string;
	cursor: number;
}

const DEFAULT_SETTINGS: GlimtPluginSettings = {
	folder: "Glimt",
	token: "",
	cursor: 0,
};

export default class GlimtPlugin extends Plugin {
	settings: GlimtPluginSettings;

	statusBarItemEl: HTMLElement;

	async onload() {
		addIcon("glimt-icon", GLIMT_ICON);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"glimt-icon",
			"Glimt Sync",
			(evt: MouseEvent) => {
				this.syncBackend();
			}
		);

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
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	async syncBackend({ force }: { force: boolean } = { force: false }) {
		const apiKey = this.settings.token;

		if (!apiKey) {
			new WarnNotice(
				"Glimt: please set your secret key in the settings.",
				"file-warning",
				10_000
			);
			return;
		}

		const isSyncingMessage = new Notice("Syncing Glimts");

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

		new SuccessNotice("Glimts synced!");
		isSyncingMessage.hide();
	}

	onunload() {}

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

		if (response.ok) {
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

		if (response.ok) {
			const body = (await response.json()) as any;
			return body.success;
		} else {
			throw new Error("Failed to fetch Glimts");
		}
	}
}

const formatGlimtToMarkdown = (glimt: PodcastGlimt) => {
	return (
		`## ${glimt.punchline} \n\n` +
		`**${glimt.summary}** \n\n` +
		`${
			glimt.personal_analysis
				? `##### AI Personal Insight: \n\`\`\`${glimt.personal_analysis} \`\`\` \n\n`
				: ""
		}` +
		`#### Transcript: \n` +
		`> ${glimt.transcript} \n\n` +
		`**${glimt.podcast_name}: ${glimt.podcast_episode_name}** \n` +
		`	*at: ${formatTimeStampFromSeconds(glimt.timestamp ?? 0)}* \n\n` +
		`#glimt #${cleanTag(glimt.podcast_name ?? "")} #${cleanTag(
			glimt.podcast_episode_name ?? ""
		)} \n\n` +
		`[${API_URL}/glimt/${glimt.id}](${API_URL}/glimt/${glimt.id})\n\n\n\n` +
		`**Warning:** *These documents should be considered __read only__ as syncing might overwrite them. Please copy them to another folder if you want to make edits.* \n\n`
	);
};

const cleanTag = (tag: string) => {
	return tag
		.replace(/[^a-zA-Z0-9]/g, "")
		.replace(/([A-Z])/g, "_$1")
		.replace(/^_/, "")
		.toLowerCase();
};
