/**
 * Runs async tasks one at a time in submission order, so concurrent settings
 * and shopping-list writes can't interleave a read-modify-write.
 */
export class SerialQueue {
	private tail: Promise<void> = Promise.resolve();

	run(fn: () => Promise<void>): Promise<void> {
		const next = this.tail.then(fn);
		// Swallow rejections on the chain so one failure doesn't poison the queue
		this.tail = next.then(
			() => {},
			() => {},
		);
		return next;
	}
}
