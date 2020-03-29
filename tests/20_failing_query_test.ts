/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import { RedundancyConfig } from '../lib/config';
import { Query } from '../lib/query';

describe('Failing query tests', () => {
	const failTimeout = 500;

	it('Fail on first 2 loops, then success', done => {
		const prefix = 'failing 2 loops test ';

		let tracker = 0;
		let timeoutTracker = 1; // Start with 1 to match tracker. Tracker will be increased first

		const timers = [20, 35, 15]; // Various timers
		const slack = 10; // Slack for timer
		let lastDiff = 0;

		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: (retry, nextIndex, startTime) => {
				expect(retry).to.be.equal(timeoutTracker); // Starts with 1
				expect(timeoutTracker).to.be.equal(tracker);

				timeoutTracker++;

				if (timers[retry - 1] !== void 0) {
					// Array starts with 0, but retry starts with 1
					return timers[retry - 1];
				}

				done('Unexpected timeout call');
				return 2000;
			},
			rotate: 100,
			random: false,
			limit: 0,
		};

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This should be called asynchronously
				tracker++;
				expect(tracker).to.be.equal(status.attempt);
				expect(resource).to.be.equal(prefix + 'item 1');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(q1.status).to.be.equal('pending');

				const diff = Date.now() - status.startTime;

				if (status.attempt === 1) {
					// First attemt
					expect(diff).to.be.lessThan(slack);
				} else {
					const timeout = lastDiff + timers[status.attempt - 2];
					const msg = `Expected ${timeout}ms, got ${diff}ms on attempt ${status.attempt}`;

					expect(diff).to.be.greaterThan(timeout - slack, msg);
					expect(diff).to.be.lessThan(timeout + slack, msg);
				}

				// Save difference because new timer is started after this function has been executed
				lastDiff = diff;

				// Mark as complete only on third attempt
				if (status.attempt === 3) {
					status.abort = (): void => {
						done('Abort should not have been called');
					};

					// Mark as complete and trigger doneCallback
					status.done('foo');

					// Check if query is completed
					expect(q1.status).to.be.equal('completed');
				}
			},
			(data, payload, query) => {
				expect(data).to.be.equal('foo');
				expect(query.status).to.be.equal('completed');
				done();
			}
		);
	});

	it('Fail on first 2 loops, then delayed success of first attempt', done => {
		const prefix = 'failing 2 loops, delayed success test ';

		let tracker = 0;
		let timeoutTracker = 1; // Start with 1 to match tracker. Tracker will be increased first

		const timers = [40, 15, 50]; // Various timers
		const attemptDelay = timers[0] + timers[1] + 10;
		const slack = 10; // Slack for timer
		let lastDiff = 0;

		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: (retry, nextIndex, startTime) => {
				expect(retry).to.be.equal(timeoutTracker); // Starts with 1
				expect(timeoutTracker).to.be.equal(tracker);

				timeoutTracker++;

				if (timers[retry - 1] !== void 0) {
					// Array starts with 0, but retry starts with 1
					return timers[retry - 1];
				}

				done('Unexpected timeout call');
				return 2000;
			},
			rotate: 100,
			random: false,
			limit: 0,
		};

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This should be called asynchronously
				tracker++;
				expect(tracker).to.be.equal(status.attempt);
				expect(resource).to.be.equal(prefix + 'item 1');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(q1.status).to.be.equal('pending');

				const diff = Date.now() - status.startTime;

				if (status.attempt === 1) {
					// First attemt
					expect(diff).to.be.lessThan(slack); // Give 5ms slack
				} else {
					const timeout = lastDiff + timers[status.attempt - 2];
					const msg = `Expected ${timeout}ms, got ${diff}ms on attempt ${status.attempt}`;

					expect(diff).to.be.greaterThan(timeout - slack, msg);
					expect(diff).to.be.lessThan(timeout + slack, msg);
				}

				// Save difference because new timer is started after this function has been executed
				lastDiff = diff;

				// Mark as complete only on third attempt
				if (status.attempt === 1) {
					status.abort = (): void => {
						done('Abort should not have been called');
					};

					setTimeout(() => {
						expect(tracker).to.be.equal(3); // 2 more attempts should have been executed
						status.done();

						// Check if query is completed
						expect(q1.status).to.be.equal('completed');
						done();
					}, attemptDelay);
				}
			}
		);
	});

	it('Fail on first 2 loops, then cancel in timeout', done => {
		const prefix = 'failing 2 loops, then stop ';

		let queryCounter = 0;

		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: (retry, nextIndex, startTime) => {
				return retry === 2 ? 0 : 10;
			},
			rotate: 3000,
			random: false,
			limit: 0,
		};

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				queryCounter++;
				expect(status.attempt).to.be.equal(queryCounter);
				expect(status.attempt).to.be.lessThan(3);
				expect(status.status).to.be.equal('pending');

				// Assign custom abort
				expect(status.abort).to.be.equal(null);
				status.abort = (): void => {
					// Query has not been aborted
					done('Abort should not have been called');
				};
			}
		);

		// Timeout
		setTimeout(() => {
			// Only 2 queries should have been executed
			expect(queryCounter).to.be.equal(2);
			done();
		}, failTimeout);
	});

	it('Fail on first 2 loops, abort after 500ms', done => {
		const prefix = 'failing 2 loops, then abort ';

		let queryCounter = 0;
		const aborted = [false, false];

		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: (retry, nextIndex, startTime) => {
				return retry === 2 ? 0 : 10;
			},
			rotate: 3000,
			random: false,
			limit: 0,
		};

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				queryCounter++;
				expect(status.attempt).to.be.equal(queryCounter);
				expect(status.attempt).to.be.lessThan(3);
				expect(status.status).to.be.equal('pending');

				// Assign custom abort
				expect(status.abort).to.be.equal(null);
				status.abort = (): void => {
					// Query has been aborted
					aborted[status.attempt - 1] = true;
					if (status.attempt === 2) {
						expect(aborted).to.be.eql([true, true]);
						done();
					}
				};
			}
		);

		// Timeout
		setTimeout(() => {
			// Only 2 queries should have been executed
			expect(queryCounter).to.be.equal(2);
			q1.abort();
		}, failTimeout);
	});

	it('Fail on first 2 loops, hit limit', done => {
		const prefix = 'failing 2 loops, then hit limit ';

		let queryCounter = 0;

		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 10,
			rotate: 3000,
			random: false,
			limit: 2,
		};

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				queryCounter++;
				expect(status.attempt).to.be.equal(queryCounter);
				expect(status.attempt).to.be.lessThan(3);
				expect(status.status).to.be.equal('pending');

				// Assign custom abort
				expect(status.abort).to.be.equal(null);
				status.abort = (): void => {
					// Query has not been aborted
					done('Abort should not have been called');
				};
			}
		);

		// Timeout
		setTimeout(() => {
			// Only 2 queries should have been executed
			expect(queryCounter).to.be.equal(2);
			done();
		}, failTimeout);
	});
});
