import { API_URL } from "./constants";
import { PodcastGlimt } from "./types";

export type ErrorResponse = {
	type: String;
	message: string;
};

export type AuthResponse = {
	success: true;
};

export type ApiError = ErrorResponse & {
	error: true;
	status: number;
};

export const isApiError = (data: unknown): data is ApiError => {
	if (typeof data !== "object" || data === null) {
		return false;
	}
	const errorResponse = data as ApiError;
	return (
		typeof errorResponse.message === "string" &&
		typeof errorResponse.error === "boolean" &&
		errorResponse.error === true
	);
};

export const verifyToken = async (token: string) => {
	const response = await fetch(`${API_URL}/api/integrations/obsidian/auth`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			token: token,
		}),
	});

	if (response.status === 200) {
		const body = (await response.json()) as AuthResponse;
		return body.success;
	} else {
		const error = (await response.json()) as ErrorResponse;
		return {
			...error,
			error: true,
			status: response.status,
		} satisfies ApiError;
	}
};

export const fetchGlimts = async ({
	cursor,
	limit,
	token,
}: {
	cursor: number;
	limit: number;
	token: String;
}) => {
	const response = await fetch(
		`${API_URL}/api/integrations/obsidian/glimt?cursor=${cursor}&limit=${limit}`,
		{
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `${token}`,
			},
		}
	);

	if (response.status === 200) {
		const body = (await response.json()) as PodcastGlimt[];
		return body;
	} else {
		const error = (await response.json()) as ErrorResponse;
		return {
			...error,
			error: true,
			status: response.status,
		} satisfies ApiError;
	}
};
