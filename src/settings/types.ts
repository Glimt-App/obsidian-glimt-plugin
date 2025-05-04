export interface GlimtPluginSettings {
	folder: string;
	token: string;
	cursor: number;
	syncInterval: number;
	isPro: boolean;
	connected: boolean;
}

export const DEFAULT_SETTINGS: GlimtPluginSettings = {
	folder: "Glimt",
	token: "",
	cursor: 0,
	syncInterval: 1000 * 60 * 5, // 5 minutes
	isPro: true,
	connected: false,
};
