/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import { RedundancyConfig } from '../code/config';
import { Query } from '../code/query';

describe('Basic query tests', () => {
	it('Simple query', done => {
		const prefix = 'simple test ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 100,
			rotate: 100,
			random: false,
			limit: 0,
		};

		let tracker = 0;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;

				expect(resource).to.be.equal(prefix + 'item 1');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(status.attempt).to.be.equal(1);

				expect(q1.status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				status.abort = (): void => {
					done('Abort should not be called!');
				};

				// Mark as complete
				status.done();

				// Check if query is completed
				expect(q1.status).to.be.equal('completed');

				done();
			},
			(data, payload, query) => {
				done('doneCallback should have never been called without data');
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});

	it('Query with response', done => {
		const prefix = 'response test ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 100,
			rotate: 100,
			random: false,
			limit: 0,
		};
		const result = {
			foo: 1,
		};

		let tracker = 0;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;

				expect(resource).to.be.equal(prefix + 'item 1');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(status.attempt).to.be.equal(1);

				expect(q1.status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				status.abort = (): void => {
					done('Abort should not be called!');
				};

				// Mark as complete
				status.done(result);

				// Check if query is completed
				expect(q1.status).to.be.equal('completed');
			},
			(data, payload, query) => {
				expect(data).to.be.equal(result);
				expect(payload).to.be.equal('query');
				expect(query).to.be.equal(q1);

				done();
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});

	it('Query with multiple response callbacks', done => {
		const prefix = 'response callbacks test ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 100,
			rotate: 100,
			random: false,
			limit: 0,
		};
		const result = {
			foo: 1,
		};

		let tracker = 0;
		let callbacksTracker = false;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;

				expect(resource).to.be.equal(prefix + 'item 1');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(status.attempt).to.be.equal(1);

				expect(q1.status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				status.abort = (): void => {
					done('Abort should not be called!');
				};

				// Mark as complete
				status.done(result);

				// Check if query is completed
				expect(q1.status).to.be.equal('completed');
			},
			(data, payload, query) => {
				done('Default callback should have been overwritten');
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');

		// Replace callback
		q1.doneCallback(data => {
			expect(callbacksTracker).to.be.equal(false);
			expect(data).to.be.equal(result);
			callbacksTracker = true;
		}, true);

		// Add second callback
		q1.doneCallback((data, payload, query) => {
			expect(callbacksTracker).to.be.equal(true);
			expect(data).to.be.equal(result);
			expect(payload).to.be.equal('query');
			expect(query).to.be.equal(q1);

			done();
		});
	});

	it('Complete query from Query instance', done => {
		const prefix = 'complete query ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 100,
			rotate: 100,
			random: false,
			limit: 0,
		};
		const result = {
			foo: 1,
		};

		let tracker = 0;
		let abortCalled = false;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;

				expect(resource).to.be.equal(prefix + 'item 1');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(status.attempt).to.be.equal(1);

				expect(q1.status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				status.abort = (): void => {
					expect(q1.status).to.be.equal('completed');
					abortCalled = true;
				};

				// Mark as complete via query, which means status.abort should be called
				q1.done(result);

				// Check if query is completed
				expect(q1.status).to.be.equal('completed');
			},
			(data, payload, query) => {
				expect(abortCalled).to.be.equal(true);
				expect(data).to.be.equal(result);
				expect(payload).to.be.equal('query');
				expect(query).to.be.equal(q1);

				done();
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});

	it('Fail first loop', done => {
		const prefix = 'fail loop ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 50,
			rotate: 1000,
			random: false,
			limit: 0,
		};

		let tracker = 0;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				const timeDiff = Date.now() - status.startTime;
				// console.log(resource, timeDiff, status);

				expect(resource).to.be.equal(prefix + 'item 1');

				switch (tracker) {
					case 1:
						expect(status.attempt).to.be.equal(1);

						// ~0ms
						expect(timeDiff).to.be.below(25);
						break;

					case 2:
						expect(status.attempt).to.be.equal(2);

						// ~50ms
						expect(timeDiff).to.be.above(25);
						expect(timeDiff).to.be.below(75);
						break;
				}
				tracker++;

				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(q1.status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				expect(status.abort).to.be.equal(null);

				// Mark as complete on second attempt
				switch (tracker - 1) {
					case 1:
						expect(q1.status).to.be.equal('pending');
						status.abort = (): void => {
							done();
						};
						break;

					case 2:
						status.abort = (): void => {
							done('Abort should not be called!');
						};
						status.done();
						expect(q1.status).to.be.equal('completed');

					// Call done() in abort() for first item
					// done();
				}
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});

	it('Abort', done => {
		const prefix = 'abort ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 1,
			rotate: 1,
			random: false,
			limit: 0,
		};

		let tracker = 0;
		let abortCalled = false;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				expect(status.attempt).to.be.equal(1);
				tracker++;

				expect(resource).to.be.equal(prefix + 'item 1');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(q1.status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				expect(status.abort).to.be.equal(null);
				status.abort = (): void => {
					abortCalled = true;
					expect(status.status).to.be.equal('aborted');
					expect(q1.status).to.be.equal('aborted');
				};

				// Abort query
				q1.abort();

				// Done on timer
				setTimeout((): void => {
					expect(abortCalled).to.be.equal(true);
					expect(status.status).to.be.equal('aborted');
					expect(q1.status).to.be.equal('aborted');
					done();
				}, 50);
			},
			(data, payload, query) => {
				done('doneCallback should have never been called on abort');
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});
});
