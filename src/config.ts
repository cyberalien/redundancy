// Allow <any> type because resource can be anything
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Callback for "timeout" configuration property.
 * "timeout" is used for timeout when all resources have been queried and loop must start again
 *
 * Function should return number in milliseconds, 0 to abort
 */
export interface TimeoutCallback {
	(
		retries: number, // Number of retries so far
		nextIndex: number, // Resource index for next query
		startTime: number // Start time
	): number;
}

/**
 * Callback for "rotate" configuration property.
 * "rotate" is used for timeout when switching to next resource within same loop.
 *
 * Function should return number in milliseconds, 0 to abort
 */
export interface RotationTimeoutCallback {
	(
		queriesSent: number, // Number of queries sent so far, starts with 0 for first callback
		retry: number, // Retry counter, starts with 1 for first callback
		nextIndex: number, // Resource index for next query
		startTime: number // Start time
	): number;
}

/**
 * Callback for "limit" configuration property.
 *
 * Function should return number (at least "retries" + 1), 0 to abort (different from default value 0 that means no limit)
 */
export interface LimitCallback {
	(
		retry: number, // Retry counter, starts with 1 for first callback
		startTime: number // Start time
	): number;
}

/**
 * Configuration object
 */
export interface RedundancyConfig {
	resources: Array<any>; // Resources to rotate
	index: number; // Start index
	timeout: number | TimeoutCallback; // Timeout for full loop
	rotate: number | RotationTimeoutCallback; // Timeout for one query
	random: boolean; // True if start index should be randomised
	limit: number | LimitCallback; // Maximum number of loops, 0 for no limit, 1 for only 1 try, 2 for 2 tries and so on
}

/**
 * Default RedundancyConfig for API calls
 */
export const defaultConfig: RedundancyConfig = {
	resources: [],
	index: 0,
	timeout: 2000,
	rotate: 750,
	random: false,
	limit: 2,
};
