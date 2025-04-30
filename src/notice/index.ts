import { IconName, Notice, setIcon } from "obsidian";

export class SuccessNotice extends Notice {
	constructor(message: string, icon: IconName = "check", duration = 5000) {
		super(message, duration);

		const iconEl = document.createElement("span");
		setIcon(iconEl, icon);

		this.messageEl.addClass("glimt-notice-message");
		this.containerEl.addClass("glimt-success");
		this.messageEl.appendChild(iconEl);
	}
}

export class ErrorNotice extends Notice {
	constructor(message: string, icon: IconName = "ban", duration = 5000) {
		super(message, duration);

		const iconEl = document.createElement("span");
		setIcon(iconEl, icon);

		this.messageEl.addClass("glimt-notice-message");
		this.containerEl.addClass("glimt-error");
		this.messageEl.appendChild(iconEl);
	}
}

export class WarnNotice extends Notice {
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
