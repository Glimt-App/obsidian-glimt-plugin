import { GLIMT_ICON } from "icons";
import {
	addIcon,
	App,
	ButtonComponent,
	Editor,
	IconName,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	setIcon,
	Setting,
} from "obsidian";
import { PodcastGlimt } from "types";

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

const API_URL = "https://app.glimtapp.io";

export default class MyPlugin extends Plugin {
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

		const s = new Setting(containerEl)
			.setName("Secret Key")
			.setDesc("Login to Glimt and get your secret key. ")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret.")
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((button) => {
				button
					.setButtonText("Connect")
					.setCta()
					.onClick(async () => {
						try {
							await this.plugin.verifyToken();
							new SuccessNotice("Glimt Logged In!");
						} catch (error) {
							new ErrorNotice("Glimt Failed to Log In!");
						}
					});
			});

		const a = document.createElement("a");
		const br = document.createElement("br");
		a.href = "https://app.glimtapp.io/integrations";
		a.textContent = "glimtapp.io -> Integrations -> Obsidian Plugins";
		s.descEl.appendChild(br);
		s.descEl.appendChild(a);

		new Setting(containerEl)
			.setName("Sync Folder")
			.setDesc(
				"The folder to sync Glimt Bookmarks to. Will be created if it doesn't exist."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter the folder name.")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;
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
					.setButtonText("Force Sync")
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

class SuccessNotice extends Notice {
	constructor(message: string, icon: IconName = "check", duration = 5000) {
		super(message, duration);

		const iconEl = document.createElement("span");
		setIcon(iconEl, icon);

		this.messageEl.addClass("glimt-notice-message");
		this.containerEl.addClass("glimt-success");
		this.messageEl.appendChild(iconEl);
	}
}

class ErrorNotice extends Notice {
	constructor(message: string, icon: IconName = "ban", duration = 5000) {
		super(message, duration);

		const iconEl = document.createElement("span");
		setIcon(iconEl, icon);

		this.messageEl.addClass("glimt-notice-message");
		this.containerEl.addClass("glimt-error");
		this.messageEl.appendChild(iconEl);
	}
}

class WarnNotice extends Notice {
	constructor(
		message: string,
		icon: IconName = "file-warning",
		duration = 5000
	) {
		super(message, duration);

		const iconEl = document.createElement("span");
		setIcon(iconEl, icon);

		this.messageEl.addClass("glimt-notice-message");
		this.containerEl.addClass("glimt-warn");
		this.messageEl.appendChild(iconEl);
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
		`[${API_URL}/glimt/${glimt.id}](${API_URL}/glimt/${glimt.id})\n\n\n\n` +
		`**Warning:** *These documents should be considered __read only__ as syncing might overwrite them. Please copy them to another folder if you want to make edits.* \n\n`
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
