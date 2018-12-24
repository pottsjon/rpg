Meteor.methods({
	'startTask': function(taskId) {
		const queued_tasks = Queues.findOne({ "$and": [
			{ owner: this.userId },
			{ worker: this.userId },
			{ completed: { $exists: false } }
		]});
		if ( !queued_tasks ) {
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
				}
				Queues.insert(queue);
				if ( Meteor.isServer )
				startQueue(queue);
			};
		};
	}
});