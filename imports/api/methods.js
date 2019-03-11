Meteor.methods({
	'visitNext': function(visit) {
		let position = Positions.findOne({ owner: this.userId });
		const update = ( visit ? { $set: { visit: true } } : { $unset: { visit: "" } } );
		Positions.update({ _id: position._id },update);
	},
	'startMovement': function(angle, angleDeg) {
		let position = Positions.findOne({ owner: this.userId });
		const time_now = (new Date()).getTime();		
		const find_pos = realPosition(position);
		let set_position = {
			x: find_pos.x,
			y: find_pos.y,
			angle: angle,
			angleDeg: angleDeg,
			started: time_now
		};
		if ( Meteor.isServer && position.angle )
		awardMovement(position,set_position);
		if ( position.city )
		set_position['city.visiting'] = false;
		Positions.update({ _id: position._id },{
			$set: set_position
		});
		set_position.owner = this.userId;
		if ( Meteor.isServer )
		cityTimerStart(set_position);
		return set_position;
	},
	'stopMovement': function(owner, city) {
		const pos_owner = ( !owner ? this.userId : owner );
		let position = Positions.findOne({ owner: pos_owner });
		if ( position.angle ) {
			const find_pos = realPosition(position);
			let set_position = {
				x: find_pos.x,
				y: find_pos.y
			};
			if ( Meteor.isServer ) {
			cityTimerStop(pos_owner);
			awardMovement(position,set_position);
			};
			if ( city) {
			city["visiting"] = true;
			} else if ( position.city ) {		
			try { delete position.city.time } catch(e) {};
			try { delete position.city.distance } catch(e) {};
			try { delete position.city.started } catch(e) {};
			position.city["visiting"] = true;
			};
			set_position["city"] = ( city ? city : position.city );
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