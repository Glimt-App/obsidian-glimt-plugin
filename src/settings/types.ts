import { App, PluginSettingTab, Setting } from "obsidian";
import type GlimtPlugin from "src/main";
import { ErrorNotice, SuccessNotice } from "src/notice";

export interface GlimtPluginSettings {
	folder: string;
	token: string;
	cursor: number;
}

export const DEFAULT_SETTINGS: GlimtPluginSettings = {
	folder: "Glimt",
	token: "",
	cursor: 0,
};
