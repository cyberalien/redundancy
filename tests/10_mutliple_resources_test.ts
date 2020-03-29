/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import { RedundancyConfig } from '../lib/config';
import { sendQuery } from '../lib/query';

describe('Multiple resources tests', () => {
	it('2 resources', done => {
		const prefix = '2 resources ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1', prefix + 'item 2'],
			index: 0,
			timeout: 100,
			rotate: 100,
			random: false,
			limit: 0,
		};

		let tracker = 0;

		const q1 = sendQuery(
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

				expect(q1().status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				status.abort = (): void => {
					done('Abort should not be called!');
				};

				// Mark as complete
				status.done();

				// Check if query is completed
				expect(q1().status).to.be.equal('completed');

				done();
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1().status).to.be.equal('pending');
	});

	it('Start index', done => {
		const prefix = 'start index ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1', prefix + 'item 2'],
			index: 1,
			timeout: 100,
			rotate: 100,
			random: false,
			limit: 0,
		};

		let tracker = 0;

		const q1 = sendQuery(
			null,
			config,
			'query',
			(resource, payload, status) => {
				// This should be called asynchronously
				expect(tracker).to.be.equal(1);
				tracker++;

				expect(resource).to.be.equal(prefix + 'item 2');
				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(status.attempt).to.be.equal(1);

				expect(q1().status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				status.abort = (): void => {
					done('Abort should not be called!');
				};

				// Mark as complete
				status.done();

				// Check if query is completed
				expect(q1().status).to.be.equal('completed');

				done();
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1().status).to.be.equal('pending');
	});

	it('Fail first resource', done => {
		const prefix = 'fail first ';
		const config: RedundancyConfig = {
			resources: [prefix + 'item 1', prefix + 'item 2'],
			index: 0,
			timeout: 100,
			rotate: 50,
			random: false,
			limit: 0,
		};

		let tracker = 0;

		const q1 = sendQuery(
			null,
			config,
			'query',
			(resource, payload, status) => {
				const timeDiff = Date.now() - status.getStatus().startTime;
				// console.log(resource, timeDiff, status);

				switch (resource) {
					case prefix + 'item 1':
						expect(tracker).to.be.equal(
							1,
							`Item "${resource}" was called with tracker ${tracker}`
						);
						expect(status.attempt).to.be.equal(1);

						// ~0ms
						expect(timeDiff).to.be.below(25);
						break;

					case prefix + 'item 2':
						expect(tracker).to.be.equal(
							2,
							`Item "${resource}" was called with tracker ${tracker}`
						);
						expect(status.attempt).to.be.equal(2);

						// ~50ms
						expect(timeDiff).to.be.above(25);
						expect(timeDiff).to.be.below(75);
						break;
				}
				tracker++;

				expect(payload).to.be.equal('query');
				expect(status.status).to.be.equal('pending');
				expect(q1().status).to.be.equal('pending');

				// Set custom "abort" callback to make sure it is not called
				expect(status.abort).to.be.equal(null);

				// Mark as complete on second attempt
				switch (resource) {
					case prefix + 'item 1':
						expect(q1().status).to.be.equal('pending');
						break;

					case prefix + 'item 2':
						status.abort = (): void => {
							done('Abort should not be called!');
						};
						status.done();
						expect(q1().status).to.be.equal('completed');
						done();
				}
			}
		);

		// This should be called first
		expect(tracker).to.be.equal(0);
		tracker++;
		expect(q1().status).to.be.equal('pending');
	});
});
