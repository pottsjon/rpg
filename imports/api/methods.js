Meteor.methods({
	'startMovement': function(angle, angleDeg) {
		const time_now = (new Date()).getTime();
		let position = Positions.findOne({ owner: this.userId });
		if ( position.angle ) {
			const time_int = (time_now-position.started)/1000;
			const int_dist = time_int*5;
			position.x = fixEdge(int_dist*Math.cos(position.angle)+position.x, map_size.width);
			position.y = fixEdge(int_dist*Math.sin(position.angle)+position.y, map_size.height);
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
		return { 
			x: position.x,
			y: position.y,
			started: time_now
		};
	},
	'stopMovement': function() {
		const time_now = (new Date()).getTime();
		let position = Positions.findOne({ owner: this.userId });
		if ( position.angle ) {
			const time_int = (time_now-position.started)/1000;
			const int_dist = time_int*5;
			position.x = fixEdge(int_dist*Math.cos(position.angle)+position.x, map_size.width);
			position.y = fixEdge(int_dist*Math.sin(position.angle)+position.y, map_size.height);
			Positions.update({ owner: this.userId },{
				$set: {
					x: position.x,
					y: position.y,
				},
				$unset: {
					angle: "",
					angleDeg: "",
					started: ""
				}
			});
		};
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