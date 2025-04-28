import {
	App,
	ButtonComponent,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { PodcastGlimt } from "types";

// Remember to rename these classes and interfaces!

interface GlimtPluginSettings {
	apiKey: string;
	cursor: number;
}

const DEFAULT_SETTINGS: GlimtPluginSettings = {
	apiKey: "",
	cursor: 0,
};

const API_URL = "http://localhost:3000";

export default class MyPlugin extends Plugin {
	settings: GlimtPluginSettings;

	async onload() {
		await this.loadSettings();
		this.syncBackend();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"sparkles",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("Syncing Glimts");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText("Status Bar Text");

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

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: "open-sample-modal-simple",
		// 	name: "Open sample modal (simple)",
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	},
		// });

		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: "open-sample-modal-complex",
		// 	name: "Open sample modal (complex)",
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView =
		// 			this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	},
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, "click", (evt: MouseEvent) => {
		// 	console.log("click", evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	async syncBackend({ force }: { force: boolean } = { force: false }) {
		const apiKey = this.settings.apiKey;
		if (!apiKey) {
			new Notice("Please set your secret key in the settings.");
			return;
		}

		new Notice("Syncing Glimts");

		const response = await fetch(
			`${API_URL}/api/integrations/obsidian/glimt?cursor=${
				force ? 0 : this.settings.cursor
			}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `${apiKey}`,
				},
			}
		);

		if (response.ok) {
			const data = (await response.json()) as PodcastGlimt[];

			const FOLDER = "glimt";

			let folder = this.app.vault.getAbstractFileByPath(FOLDER);

			if (!folder) {
				await this.app.vault.createFolder(FOLDER);
			}

			console.log(`syncing ${data.length} glimts`);

			for (const glimt of data) {
				const filePath = `${FOLDER}/${glimt.title?.replace(
					/\:/g,
					""
				)} [${glimt.id}].md`;
				const content = formatGlimtToMarkdown(glimt);

				let file = this.app.vault.getAbstractFileByPath(filePath);

				if (file && force) {
					await this.app.vault.modify(file as any, content);
				} else if (!file) {
					await this.app.vault.create(filePath, content);
				}
			}

			const newCursor = data.reduce((cursor, item) => {
				if (item.id > cursor) {
					return item.id;
				}
				return cursor;
			}, this.settings.cursor);

			this.settings.cursor = newCursor;
			await this.saveSettings();

			new Notice("Glimts synced successfully!");
		} else {
			new Notice("Failed to sync Glimts.");
		}
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
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Secret Key")
			.setDesc(
				"Login to Glimt and get your secret key. Go to Integrations -> Obsidian Plugin."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret.")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Force Sync Glimts")
			.setDesc(
				"Resync all Glimts. Will overwrite existing files with the same name."
			)
			.addButton((button) => {
				button
					.setButtonText("Sync Glimts")
					.setCta()

					.onClick(async () => {
						if (
							confirm(
								"Are you sure you want to sync all Glimts? This will overwrite existing files with the same name."
							)
						) {
							await this.plugin.syncBackend({ force: true });
						}
					});
			});
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
		`#${cleanTag(glimt.podcast_name ?? "")} #${cleanTag(
			glimt.podcast_episode_name ?? ""
		)} \n\n` +
		`[${API_URL}/glimt/${glimt.id}](${API_URL}/glimt/${glimt.id})`
	);
};

export const formatTimeStampFromSeconds = (seconds: number) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${hours ? `${zeroPad(hours)}:` : ""}${zeroPad(minutes)}:${zeroPad(
		remainingSeconds
	)}`;
};

export const zeroPad = (num: number) => {
	return num.toString().padStart(2, "0");
};

const cleanTag = (tag: string) => {
	return tag
		.replace(/[^a-zA-Z0-9]/g, "")
		.replace(/([A-Z])/g, "_$1")
		.replace(/^_/, "")
		.toLowerCase();
};
