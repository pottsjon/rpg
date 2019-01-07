Meteor.methods({
	'hireWorker': function(workerId) {
		Workers.update({ "$and": [
			{ _id: workerId },
			{ owner: { $exists: false } }
		]},{ $set: {
				owner: this.userId,
				started: (new Date()).getTime()
			}
		})
	},
	'startTask': function(taskId,workerId) {
		const worker_id = ( !workerId ? this.userId : workerId );
		const time_now = (new Date()).getTime();
		const queue = {
			taskId: taskId,
			owner: this.userId,
			worker: worker_id,
			created: time_now,
			started: time_now,
			length: 30
		};
		Queues.update({"$and": [
			{ owner: this.userId },
			{ worker: worker_id },
			{ started: { $exists: true } },
			{ completed: { $exists: false } }
		]},{ $set: {
			completed: time_now
		} },
		function(err, count) {
			Queues.insert(queue);
			if ( Meteor.isServer )
			initQueue(queue);
			Workers.update({ _id: worker_id },{ $set: { working: time_now } });
		});
	}
});