/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import { initRedundancy } from '../lib/redundancy';

type DummyResponses = Record<string, string>;

describe('Redundancy class', () => {
	it('Simple query', (done) => {
		const redundancy = initRedundancy({
			resources: [
				'https://api.local', // Will fail
				'https://api-backup1.local', // Success
				'https://api-backup2.local',
			],
			rotate: 20,
			timeout: 100,
		});

		// Premade responses
		const responses: DummyResponses = {
			'https://api-backup1.local/foo': 'foo',
		};
		let counter = 0;
		let doneCallbackCalled = false;

		const query = redundancy.query(
			'/foo',
			(resource, payload, status) => {
				counter++;
				expect(counter).to.be.lessThan(3); // No more than 2 queries should be executed

				// Make URI from resource + payload
				const uri = (resource as string) + (payload as string);

				// Get fake data if it exists
				if (responses[uri] === void 0) {
					return;
				}

				// Do something with "data", simulate instant callback
				status.done(responses[uri]);

				// Complete test
				setTimeout(() => {
					expect(counter).to.be.equal(2);
					expect(doneCallbackCalled).to.be.equal(true);
					expect(query().status).to.be.equal('completed');
					expect(redundancy.getIndex()).to.be.equal(1); // Should have changed to 1 after query
					done();
				});
			},
			(data) => {
				expect(data).to.be.equal('foo');
				doneCallbackCalled = true;
			}
		);

		// Test find()
		expect(
			redundancy.find((item) => (item().payload as string) === '/foo')
		).to.be.equal(query);
		expect(
			redundancy.find((item) => item().status === 'pending')
		).to.be.equal(query);
	});

	it('Different start index', (done) => {
		const redundancy = initRedundancy({
			resources: [
				'https://api.local',
				'https://api-backup1.local',
				'https://api-backup2.local',
			],
			rotate: 20,
			timeout: 3000,
			index: 1,
		});

		// Premade responses
		const responses: DummyResponses = {
			'https://api-backup1.local/foo': 'foo',
		};
		let counter = 0;

		const query = redundancy.query('/foo', (resource, payload, status) => {
			counter++;
			expect(counter).to.be.lessThan(2); // Should be success on first call because start index = 1

			// Make URI from resource + payload
			const uri = (resource as string) + (payload as string);

			// Get fake data if it exists
			if (responses[uri] === void 0) {
				return;
			}

			// Do something with "data", simulate instant callback
			status.done(responses[uri]);

			// Complete test
			setTimeout(() => {
				expect(counter).to.be.equal(1);
				expect(query().status).to.be.equal('completed');
				expect(redundancy.getIndex()).to.be.equal(1);
				done();
			});
		});

		// Test find()
		expect(
			redundancy.find((item) => item().payload === '/foo')
		).to.be.equal(query);
		expect(
			redundancy.find((item) => item().status === 'pending')
		).to.be.equal(query);
	});
});
