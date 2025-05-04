import { App, PluginSettingTab, setIcon, Setting } from "obsidian";
import { isApiError, verifyToken } from "src/api";
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

	upgradeSetting?: Setting;

	displayUpgradeSetting() {
		const { containerEl } = this;

		if (this.upgradeSetting) {
			this.upgradeSetting.settingEl.remove();
		}

		this.upgradeSetting = new Setting(containerEl)
			.setName("Upgrade")
			.setDesc(
				"Glimt is a paid service and you need to have a paid plan to use this plugin."
			)
			.addButton((button) => {
				const icon = document.createElement("span");
				setIcon(icon, "sparkles");
				button
					.setButtonText("Go Pro")
					.setCta()
					.onClick(async () => {});
				button.buttonEl.addClass("upgrade-button");
				button.buttonEl.appendChild(icon);
			});
	}

	removeUpgradeSetting() {
		if (this.upgradeSetting) {
			this.upgradeSetting.settingEl.remove();
			this.upgradeSetting = undefined;
		}
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
					.setButtonText(
						this.plugin.settings.connected ? "Connected" : "Connect"
					)
					.setCta()
					.onClick(async () => {
						const response = await verifyToken(
							this.plugin.settings.token
						);

						console.log(response, isApiError(response));

						if (isApiError(response)) {
							new ErrorNotice(
								response.message ?? "Glimt Failed to Log In!"
							);

							this.plugin.settings.connected = false;

							if (response.type === "NotCorrectPlanLevel") {
								this.displayUpgradeSetting();
								this.plugin.settings.isPro = false;
							} else {
								this.removeUpgradeSetting();
							}
						} else {
							new SuccessNotice("Glimt Logged In!");
							this.plugin.settings.isPro = true;
							this.removeUpgradeSetting();
							this.plugin.settings.connected = true;
						}

						await this.plugin.saveSettings();
						this.display();
					});

				button.buttonEl.addClass("connect-button");

				const indicator = document.createElement("span");
				const indicatorClass = this.plugin.settings.connected
					? "connected"
					: "disconnected";
				indicator.classList.add("indicator");
				indicator.classList.add(indicatorClass);
				button.buttonEl.appendChild(indicator);
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
							await this.plugin.syncBackend();
							this.display();
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
							this.display();
						}
					})
					.buttonEl.addClass("force-sync-glimts-button");
			});

		if (!this.plugin.settings.isPro) {
			this.displayUpgradeSetting();
		} else {
			this.removeUpgradeSetting();
		}
	}
}
