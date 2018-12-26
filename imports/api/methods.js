Meteor.methods({
	'startTask': function(taskId) {
		const time_now = (new Date()).getTime();
		const task = Tasks.findOne({ _id: taskId },{ fields: { exp: 0 } });
		if ( task ) {
			const queue = {
				task,
				owner: this.userId,
				worker: this.userId,
				created: time_now,
				started: time_now,
				length: 60
			};
			Queues.update({"$and": [
				{ owner: this.userId },
				{ started: { $exists: true } },
				{ completed: { $exists: false } }
			]},{ $set: {
				completed: time_now
			} },
			function(err, count) {
			});
			Queues.insert(queue);
			if ( Meteor.isServer )
			startQueue(queue);
		};
	}
});