// Allow <any> type because query and resource can be anything
/* eslint-disable @typescript-eslint/no-explicit-any */

import { RedundancyConfig } from './config';
import { Redundancy } from './redundancy';

/**
 * Status
 */
type ExecStatus = 'pending' | 'completed' | 'aborted';

/**
 * Callback for "done" pending item.
 */
export interface QueryDoneCallback {
	(data?: any): void;
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
	(resource: any, payload: any, status: PendingItem): void;
}

/**
 * Function to send to item on completion
 */
export interface DoneCallback {
	(data: any, payload: any, query: Query): void;
}

export type OptionalDoneCallback = DoneCallback | null;

/**
 * Item in pending items list
 */
export interface PendingItem {
	readonly query: Query;
	status: ExecStatus;
	readonly startTime: number;
	readonly attempt: number; // Starts with 1 for first attempt
	readonly done: QueryDoneCallback;
	abort: QueryAbortCallback | null;
}

/**
 * Query class
 */
export class Query {
	protected readonly parent: Redundancy | null;
	protected readonly config: RedundancyConfig;
	public readonly payload: any;
	protected readonly queryCallback: QueryCallback; // Callback to call to send query
	protected doneCallbacks: DoneCallback[]; // Optional callbacks to call when query is complete

	public readonly startTime: number; // Start time
	public loop: number; // Current loop number (increased once per full loop of available resources)
	public attempt: number; // Current attempt number (increased on every query)
	public readonly startIndex: number; // Resource start index
	public index: number; // Last index
	public readonly maxIndex: number; // Max index (config.resources.length - 1)
	protected pending: PendingItem[]; // List of pending items
	public status: ExecStatus = 'pending'; // Query status

	protected timer = 0; // Timer

	constructor(
		parent: Redundancy | null,
		config: RedundancyConfig,
		payload: any,
		queryCallback: QueryCallback,
		doneCallback: OptionalDoneCallback = null
	) {
		// Bind callbacks
		this._next = this._next.bind(this);
		this._nextTimer = this._nextTimer.bind(this);
		this._done = this._done.bind(this);
		this._startTimer = this._startTimer.bind(this);

		// Copy parameters
		this.parent = parent;
		this.config = config;
		this.payload = payload;
		this.queryCallback = queryCallback;
		this.doneCallbacks = [];
		if (typeof doneCallback === 'function') {
			this.doneCallbacks.push(doneCallback);
		}

		// Set stuff
		this.startTime = Date.now();
		this.loop = 0;
		this.attempt = 0;
		this.maxIndex = config.resources.length - 1;

		// Set start index
		this.startIndex = config.index ? config.index : 0;
		if (config.random && config.resources.length > 1) {
			this.startIndex = Math.floor(
				Math.random() * config.resources.length
			);
		}
		this.startIndex = Math.min(this.startIndex, this.maxIndex);
		this.index = this.startIndex;

		this.pending = [];

		setTimeout(this._next);
	}

	/**
	 * Check if next run is new loop
	 *
	 * Returns true on new loop or next index number
	 */
	_isNewLoop(): boolean | number {
		if (this.maxIndex < 1) {
			return true;
		}

		let nextIndex = this.index + 1;
		if (nextIndex > this.maxIndex) {
			nextIndex = 0;
		}
		if (nextIndex === this.startIndex) {
			return true;
		}
		return nextIndex;
	}

	/**
	 * Next attempt
	 */
	_next(): void {
		if (this.status !== 'pending') {
			return;
		}

		// Send query
		this._sendQuery();

		// Start timer on next tick
		setTimeout(this._startTimer);
	}

	/**
	 * Next attempt on timer
	 */
	_nextTimer(): void {
		// Increase index
		const index = this._isNewLoop();
		if (typeof index === 'boolean') {
			this.loop++;
			this.index = this.startIndex;
		} else {
			this.index = index;
		}
		this.attempt++;

		// Start next attempt
		this._next();
	}

	/**
	 * Send query
	 */
	_sendQuery(): void {
		const index = this.index;
		const resource = this.config.resources[index];
		const pendingItem: PendingItem = {
			query: this,
			startTime: this.startTime,
			attempt: this.attempt + 1,
			status: 'pending',
			done: (data: any = void 0) => {
				this._completePendingItem(pendingItem, index, data);
			},
			abort: null,
		};

		// Clean up old pending queries
		if (this.pending.length > Math.max(this.maxIndex * 2, 5)) {
			// Array is not empty, so first shift() will always return item
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			this._abortPendingItem(this.pending.shift()!);
		}

		// Add pending query and call callback
		this.pending.push(pendingItem);
		this.queryCallback(resource, this.payload, pendingItem);
	}

	/**
	 * Start timer for next query
	 */
	_startTimer(): void {
		if (this.status !== 'pending') {
			return;
		}

		const nextIndex = this._isNewLoop();
		let timeout;
		if (typeof nextIndex === 'boolean') {
			// New loop
			const nextLoop = this.loop + 1;

			// Check limit
			let limit: number;
			if (typeof this.config.limit === 'function') {
				limit = this.config.limit(nextLoop, this.startTime);
			} else {
				limit = this.config.limit;
			}

			if (limit > 0 && limit <= nextLoop) {
				// Attempts limit was hit
				this._stopTimer();
				return;
			}

			if (typeof this.config.timeout === 'function') {
				timeout = this.config.timeout(
					nextLoop,
					this.startIndex,
					this.startTime
				);
			} else {
				timeout = this.config.timeout;
			}
		} else {
			// Next index
			if (typeof this.config.rotate === 'function') {
				const queriesSent =
					nextIndex < this.startIndex
						? this.maxIndex - this.startIndex + nextIndex
						: nextIndex - this.startIndex;

				timeout = this.config.rotate(
					queriesSent,
					this.loop,
					nextIndex,
					this.startTime
				);
			} else {
				timeout = this.config.rotate;
			}
		}

		if (typeof timeout !== 'number' || timeout < 1) {
			// Stop sending queries
			this._stopTimer();
			return;
		}

		this.timer = setTimeout(this._nextTimer, timeout) as any;
	}

	/**
	 * Stop timer
	 */
	_stopTimer(): void {
		if (this.timer) {
			clearTimeout(this.timer);
		}
		this.timer = 0;
	}

	/**
	 * Abort pending item
	 */
	_abortPendingItem(item: PendingItem): void {
		if (item.abort && item.status === 'pending') {
			item.status = 'aborted';
			item.abort();
		}
	}

	/**
	 * Complete stuff
	 */
	_done(data: any = void 0): void {
		// Stop timer
		this._stopTimer();

		// Complete query
		if (this.status === 'pending') {
			this.status = 'completed';
			this._stopQuery();
			if (data !== void 0) {
				this._sendRetrievedData(data);
			}
		}
		return;
	}

	/**
	 * Send retrieved data to doneCallbacks
	 */
	_sendRetrievedData(data: any): void {
		this.doneCallbacks.forEach(callback => {
			callback(data, this.payload, this);
		});
	}

	/**
	 * Done, called by pendingItem
	 */
	_completePendingItem(
		pendingItem: PendingItem,
		index: number,
		data: any = void 0
	): void {
		if (pendingItem.status === 'pending') {
			pendingItem.status = 'completed';

			// Complete query
			this._done(data);

			// Change parent index
			if (
				this.parent !== null &&
				!this.config.random &&
				index !== this.startIndex
			) {
				// Tell Redundancy instance to change start index
				this.parent.setIndex(index);
			}
		}
	}

	/**
	 * Stop everything
	 */
	_stopQuery(): void {
		this._stopTimer();

		// Stop all pending queries that have abort() callback
		this.pending.forEach(this._abortPendingItem);
		this.pending = [];

		// Cleanup parent
		if (this.parent !== null) {
			this.parent.cleanup();
		}
	}

	/**
	 * Done, called by Redundancy
	 */
	done(data: any = void 0): void {
		this._done(data);
	}

	/**
	 * Abort all queries
	 */
	abort(): void {
		if (this.status !== 'pending') {
			return;
		}

		this.status = 'aborted';
		this._stopQuery();
	}

	/**
	 * Add / replace doneCallback
	 */
	doneCallback(callback: OptionalDoneCallback, overwrite = false): void {
		if (overwrite) {
			this.doneCallbacks = [];
		}
		if (typeof callback === 'function') {
			this.doneCallbacks.push(callback);
		}
	}
}
