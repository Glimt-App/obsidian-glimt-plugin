import { zeroPad } from "../number";

export const formatTimeStampFromSeconds = (seconds: number) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${hours ? `${zeroPad(hours)}:` : ""}${zeroPad(minutes)}:${zeroPad(
		remainingSeconds
	)}`;
};
