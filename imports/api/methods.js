Meteor.methods({
	'startMovement': function(angle, angleDeg) {
		const time_now = (new Date()).getTime();
		let position = Positions.findOne({ owner: this.userId });
		if ( position.angle ) {
			const time_int = (time_now-position.started)/1000;
			const int_dist = time_int*5;
			position.x = int_dist*Math.cos(position.angle)+position.x;
			position.y = int_dist*Math.sin(position.angle)+position.y;
			console.log(position.x+" "+position.y);
		};
		Positions.update({ _id: position._id },{
			$set: {
				x: position.x,
				y: position.y,
				angle: angle,
				angleDeg: angleDeg,
				started: time_now
			}
		});
	},
	'stopMovement': function() {
		Positions.update({ owner: this.userId },{
			$set: {
				x: 1155,
				y: 262,
			},
			$unset: {
				angle: "",
				angleDeg: "",
				started: ""
			}
		});
	},
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
			Workers.update({ _id: worker_id },{
				$set: {
					working: time_now
				}
			});
		});
	}
});