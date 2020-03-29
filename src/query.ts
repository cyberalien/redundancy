import { RedundancyConfig } from './config';
import { Redundancy } from './redundancy';

/**
 * Execution status
 */
type ExecStatus = 'pending' | 'completed' | 'aborted';

/**
 * Status for query
 */
export interface QueryStatus {
	done: (data: unknown) => void; // Function to call to complete query
	abort: () => void; // Function to call to abort everything
	subscribe: (callback: OptionalDoneCallback, overwrite?: boolean) => void; // Add function to call when query is complete. Can be used to abort execution of query implementation
	payload: unknown; // Payload
	startTime: number; // Start time
	loop: number; // Current loop number (increased once per full loop of available resources)
	attempt: number; // Current attempt number (increased on every query)
	startIndex: number; // Resource start index
	index: number; // Last index
	maxIndex: number; // Max index (config.resources.length - 1)
	status: ExecStatus; // Query status (global, not specific to one query)
}

/**
 * Callback to track status
 */
export type GetQueryStatus = () => QueryStatus;

/**
 * Callback for "done" pending item.
 */
export interface QueryDoneCallback {
	(data?: unknown): void;
}

/**
 * Callback for "abort" pending item.
 */
export interface QueryAbortCallback {
	(): void;
}

/**
 * Function to send to item to send query
 */
export interface QueryCallback {
	(resource: unknown, payload: unknown, status: PendingItem): void;
}

/**
 * Function to send to item on completion
 */
export interface DoneCallback {
	(data: unknown, payload: unknown, getStatus: GetQueryStatus): void;
}

export type OptionalDoneCallback = DoneCallback | null;

/**
 * Item in pending items list
 */
export interface PendingItem {
	readonly getStatus: GetQueryStatus;
	status: ExecStatus; // Current query status
	readonly attempt: number; // Starts with 1 for first attempt
	readonly done: QueryDoneCallback; // Function to call with data
	abort: QueryAbortCallback | null; // Function to call to abort query, set by query handler
}

/**
 * Send query
 */
export function sendQuery(
	parent: Redundancy | null,
	config: RedundancyConfig,
	payload: unknown,
	queryCallback: QueryCallback,
	doneCallback: OptionalDoneCallback = null
): GetQueryStatus {
	// Optional callbacks to call when query is complete
	let doneCallbacks: DoneCallback[] = [];
	if (typeof doneCallback === 'function') {
		doneCallbacks.push(doneCallback);
	}

	// Start time
	const startTime = Date.now();

	// Current loop number (increased once per full loop of available resources)
	let loop = 0;

	// Current attempt number (increased on every query)
	let attempt = 0;

	// Max index (config.resources.length - 1)
	const maxIndex = config.resources.length - 1;

	// Resource start index
	let startIndex = config.index ? config.index : 0;
	if (config.random && config.resources.length > 1) {
		startIndex = Math.floor(Math.random() * config.resources.length);
	}
	startIndex = Math.min(startIndex, maxIndex);

	// Last index
	let index = startIndex;

	// List of pending items
	let pending: PendingItem[] = [];

	// Query status
	let status: ExecStatus = 'pending';

	// Timer
	let timer = 0;

	/**
	 * Add / replace callback to call when execution is complete.
	 * This can be used to abort pending query implementations when query is complete or aborted.
	 */
	function subscribe(
		callback: OptionalDoneCallback,
		overwrite = false
	): void {
		if (overwrite) {
			doneCallbacks = [];
		}
		if (typeof callback === 'function') {
			doneCallbacks.push(callback);
		}
	}

	/**
	 * Get query status
	 */
	function getStatus(): QueryStatus {
		return {
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			done,
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			abort,
			subscribe,
			payload,
			startTime,
			loop,
			attempt,
			startIndex,
			index,
			maxIndex,
			status,
		};
	}

	/**
	 * Stop timer
	 */
	function stopTimer(): void {
		if (timer) {
			clearTimeout(timer);
		}
		timer = 0;
	}

	/**
	 * Abort pending item
	 */
	function abortPendingItem(item: PendingItem): void {
		if (item.abort && item.status === 'pending') {
			item.status = 'aborted';
			item.abort();
		}
	}

	/**
	 * Stop everything
	 */
	function stopQuery(): void {
		stopTimer();

		// Stop all pending queries that have abort() callback
		pending.forEach(abortPendingItem);
		pending = [];

		// Cleanup parent
		if (parent !== null) {
			parent.cleanup();
		}
	}

	/**
	 * Send retrieved data to doneCallbacks
	 */
	function sendRetrievedData(data: unknown): void {
		doneCallbacks.forEach(callback => {
			callback(data, payload, getStatus);
		});
	}

	/**
	 * Complete stuff
	 */
	function done(data: unknown = void 0): void {
		// Stop timer
		stopTimer();

		// Complete query
		if (status === 'pending') {
			status = 'completed';
			stopQuery();
			if (data !== void 0) {
				sendRetrievedData(data);
			}
		}
	}

	/**
	 * Check if next run is new loop
	 *
	 * Returns true on new loop or next index number
	 */
	function isNewLoop(): boolean | number {
		if (maxIndex < 1) {
			return true;
		}

		let nextIndex = index + 1;
		if (nextIndex > maxIndex) {
			nextIndex = 0;
		}
		if (nextIndex === startIndex) {
			return true;
		}
		return nextIndex;
	}

	/**
	 * Done, called by pendingItem
	 */
	function completePendingItem(
		pendingItem: PendingItem,
		index: number,
		data: unknown = void 0
	): void {
		if (pendingItem.status === 'pending') {
			pendingItem.status = 'completed';

			// Complete query
			done(data);

			// Change parent index
			if (parent !== null && !config.random && index !== startIndex) {
				// Tell Redundancy instance to change start index
				parent.setIndex(index);
			}
		}
	}

	/**
	 * Send query
	 */
	function sendQuery(): void {
		const queryIndex = index;
		const queryResource = config.resources[queryIndex];
		const pendingItem: PendingItem = {
			getStatus,
			attempt: attempt + 1,
			status: 'pending',
			done: (data: unknown = void 0) => {
				completePendingItem(pendingItem, queryIndex, data);
			},
			abort: null,
		};

		// Clean up old pending queries
		if (pending.length > Math.max(maxIndex * 2, 5)) {
			// Array is not empty, so first shift() will always return item
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			abortPendingItem(pending.shift()!);
		}

		// Add pending query and call callback
		pending.push(pendingItem);
		queryCallback(queryResource, payload, pendingItem);
	}

	/**
	 * Start timer for next query
	 */
	function startTimer(): void {
		if (status !== 'pending') {
			return;
		}

		const nextIndex = isNewLoop();
		let timeout;
		if (typeof nextIndex === 'boolean') {
			// New loop
			const nextLoop = loop + 1;

			// Check limit
			let limit: number;
			if (typeof config.limit === 'function') {
				limit = config.limit(nextLoop, startTime);
			} else {
				limit = config.limit;
			}

			if (limit > 0 && limit <= nextLoop) {
				// Attempts limit was hit
				stopTimer();
				return;
			}

			if (typeof config.timeout === 'function') {
				timeout = config.timeout(nextLoop, startIndex, startTime);
			} else {
				timeout = config.timeout;
			}
		} else {
			// Next index
			if (typeof config.rotate === 'function') {
				const queriesSent =
					nextIndex < startIndex
						? maxIndex - startIndex + nextIndex
						: nextIndex - startIndex;

				timeout = config.rotate(
					queriesSent,
					loop,
					nextIndex,
					startTime
				);
			} else {
				timeout = config.rotate;
			}
		}

		if (typeof timeout !== 'number' || timeout < 1) {
			// Stop sending queries
			stopTimer();
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		timer = (setTimeout(nextTimer, timeout) as unknown) as number;
	}

	/**
	 * Next attempt
	 */
	function next(): void {
		if (status !== 'pending') {
			return;
		}

		// Send query
		sendQuery();

		// Start timer on next tick
		setTimeout(startTimer);
	}

	/**
	 * Next attempt on timer
	 */
	function nextTimer(): void {
		// Increase index
		index = isNewLoop() as number;
		if (typeof index === 'boolean') {
			loop++;
			index = startIndex;
		}
		attempt++;

		// Start next attempt
		next();
	}

	/**
	 * Abort all queries
	 */
	function abort(): void {
		if (status !== 'pending') {
			return;
		}

		status = 'aborted';
		stopQuery();
	}

	// Run next attempt on next tick
	setTimeout(next);

	// Return function that can check status
	return getStatus;
}
