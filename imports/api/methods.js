Meteor.methods({
	'visitNext': function(visit) {
		let position = Positions.findOne({ owner: this.userId });
		const update = ( visit ? { $set: { visit: true } } : { $unset: { visit: "" } } );
		Positions.update({ _id: position._id },update);
		if ( visit )
		position.visit = true;
		if ( Meteor.isServer )
		cityTimerStart(position);
	},
	'startMovement': function(angle, angleDeg) {
		const time_now = (new Date()).getTime();
		let position = Positions.findOne({ owner: this.userId });
		if ( position.angle ) {
			const time_int = (time_now-position.started)/1000;
			const int_dist = time_int*5;
			position.x = fixEdge(int_dist*Math.cos(position.angle)+position.x, map_size.width);
			position.y = fixEdge(int_dist*Math.sin(position.angle)+position.y, map_size.height);
		};
		let set_position = {
			x: position.x,
			y: position.y,
			angle: angle,
			angleDeg: angleDeg,
			started: time_now
		};
		if ( position.city )
		set_position['city.visiting'] = false;
		Positions.update({ _id: position._id },{
			$set: set_position
		});
		set_position.owner = this.userId;
		if ( Meteor.isServer )
		cityTimerStart(set_position);
		return {
			x: position.x,
			y: position.y,
			started: time_now
		};
	},
	'stopMovement': function(owner) {
		const time_now = (new Date()).getTime();
		const pos_owner = ( !owner ? this.userId : owner );
		let position = Positions.findOne({ owner: pos_owner });
		if ( position.angle ) {
			if ( Meteor.isServer )
			cityTimerStop(pos_owner);
			const time_int = (time_now-position.started)/1000;
			const int_dist = time_int*5;
			position.x = fixEdge(int_dist*Math.cos(position.angle)+position.x, map_size.width);
			position.y = fixEdge(int_dist*Math.sin(position.angle)+position.y, map_size.height);
			let set_position = {
				x: position.x,
				y: position.y
			}
			if ( position.city )
			set_position['city.visiting'] = true;
			Positions.update({ owner: pos_owner },{
				$set: set_position,
				$unset: {
					angle: "",
					angleDeg: "",
					started: "",
					visit: ""
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