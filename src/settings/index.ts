import { App, PluginSettingTab, Setting } from "obsidian";
import msFn, { StringValue } from "src/lib/time/ms";
import type GlimtPlugin from "src/main";
import { ErrorNotice, SuccessNotice } from "src/notice";

export * from "./types";

export class GlimtSettingsTab extends PluginSettingTab {
	plugin: GlimtPlugin;

	constructor(app: App, plugin: GlimtPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const secretSetting = new Setting(containerEl)
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
		secretSetting.descEl.appendChild(br);
		secretSetting.descEl.appendChild(a);

		let intermediarySyncIntervalValue: StringValue = msFn(
			this.plugin.settings.syncInterval
		) as StringValue;

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
			.setName("Sync Interval")
			.setDesc(
				"How often to sync Glimt Bookmarks. example: 40sec, 5min, 1hour, 2days etc"
			)
			.addText((text) =>
				text
					.setPlaceholder("5min")
					.setValue(intermediarySyncIntervalValue)
					.onChange(async (value: StringValue) => {
						intermediarySyncIntervalValue = value;
					})
			)
			.addButton((button) => {
				button
					.setButtonText("Set Sync Interval")
					.setCta()
					.onClick(async () => {
						try {
							const newValue = msFn(
								intermediarySyncIntervalValue
							);

							if (
								newValue === this.plugin.settings.syncInterval
							) {
								return;
							}

							this.plugin.settings.syncInterval = newValue;
							if (
								typeof this.plugin.settings.syncInterval !==
									"number" ||
								isNaN(this.plugin.settings.syncInterval)
							) {
								throw new Error("Invalid value");
							}
							await this.plugin.saveSettings();
							this.plugin.syncBackend();
						} catch (error) {
							new ErrorNotice(
								"Invalid value, use 5min 1hour or something similar."
							);
						}
					});
			});

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
					})
					.buttonEl.addClass("force-sync-glimts-button");
			});
	}
}
