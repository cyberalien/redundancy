/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import { RedundancyConfig } from '../lib/config';
import { Query } from '../lib/query';

describe('Query configuration tests', () => {
	it('Timeout as callback', done => {
		const prefix = 'timeout callback ';

		let timeoutCalled = false;
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: (retry, nextIndex, startTime) => {
				expect(timeoutCalled).to.be.equal(false);
				timeoutCalled = true;

				expect(retry).to.be.equal(1); // Second try for same index
				expect(nextIndex).to.be.equal(0);

				done();

				return 100;
			},
			rotate: (queriesSent, retry, nextIndex, startTime) => {
				done('Rotate should not have been called!');
				return 0;
			},
			random: false,
			limit: 0,
		};

		let tracker = 0;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This callback should have been called before timeout callback
				expect(timeoutCalled).to.be.equal(false);

				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;

				// Mark as complete on tick after next tick
				setTimeout(() => {
					setTimeout(status.done);
				});
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});

	it('Rotate as callback', done => {
		const prefix = 'rotate callback ';

		let rotateCalled = false;
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1', prefix + 'item 2'],
			index: 0,
			timeout: (retry, nextIndex, startTime) => {
				done('Timeout should not have been called!');
				return 0;
			},
			rotate: (queriesSent, retry, nextIndex, startTime) => {
				expect(rotateCalled).to.be.equal(false);
				rotateCalled = true;

				expect(queriesSent).to.be.equal(1);
				expect(retry).to.be.equal(0); // First try for current index
				expect(nextIndex).to.be.equal(1);

				done();

				return 100;
			},
			random: false,
			limit: 0,
		};

		let tracker = 0;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This callback should have been called before timeout callback
				expect(rotateCalled).to.be.equal(false);

				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;

				// Mark as complete on tick after next tick
				setTimeout(() => {
					setTimeout(status.done);
				});
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});

	it('Limit as callback', done => {
		const prefix = 'limit callback ';

		let limitCalled = false;

		const config: RedundancyConfig = {
			resources: [prefix + 'item 1'],
			index: 0,
			timeout: 100,
			rotate: (queriesSent, retry, nextIndex, startTime) => {
				done('Rotate should not have been called!');
				return 0;
			},
			random: false,
			limit: (retry, startTime) => {
				expect(limitCalled).to.be.equal(false);
				limitCalled = true;
				expect(retry).to.be.equal(1); // Second try for same index

				setTimeout(done); // Finish test on next tick

				return 1;
			},
		};

		let tracker = 0;

		const q1 = new Query(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This callback should have been called before limit callback
				expect(limitCalled).to.be.equal(false);

				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1.status).to.be.equal('pending');
	});
});
