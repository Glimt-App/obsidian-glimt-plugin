import { PodcastGlimt } from "src/types";
import { formatTimeStampFromSeconds } from "../time";
import { API_URL } from "src/constants";

export const formatGlimtToMarkdown = (glimt: PodcastGlimt) => {
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
