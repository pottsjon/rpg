Meteor.methods({
	'startTask': function(taskId) {
		const queued_tasks = Queues.find({ "$and": [
			{ owner: this.userId },
			{ worker: this.userId },
			{ completed: { $exists: false } }
		] },{ limit: 4 }).count();
		if ( !queued_tasks || queued_tasks <= 3 ) {
			const task = Tasks.findOne({ _id: taskId },{ fields: { exp: 0 } });
			Queues.insert({
				task,
				owner: this.userId,
				worker: this.userId,
				created: (new Date()).getTime()
			});
		};
	}
});