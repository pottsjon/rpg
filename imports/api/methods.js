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
		if ( Meteor.isServer ) {
			cityTimerStart(set_position);
			clearQueue(this.userId, true);
		};
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
		});
		Skills.update({ owner: workerId },{ $set: { boss: this.userId } },{ multi: true });
	},
	'stallWorker': function(stallId, workerId) {
		const userId = ( Meteor.isServer ? this.userId : Meteor.userId() );
		const find_worker = ( workerId == userId ? true : Workers.findOne({ "$and": [{ _id: workerId },{ owner: userId }] },{ fields: { _id: 1 } }) );
		const find_pos = Positions.findOne({ "$and": [{ 'city.visiting': true },{ owner: userId }] },{ fields: { 'city.name': 1 } });
		if ( find_worker && find_pos && find_pos.city.name ) {
			const stall_update = ( stallId != 1 && stallId != 2 ) ? { "$and": [{ _id: stallId },{  owner: userId }] } : { "$and": [{ city: find_pos.city.name },{ number: stallId },{ owner: userId }] };
			Stalls.update(stall_update,{ $set: { worker: workerId } },{ upsert: true });
		};
	},
	'startTask': function(stallId, workerId, taskId) {
		const time_now = (new Date()).getTime();
		const userId = ( Meteor.isServer ? this.userId : Meteor.userId() );
		const find_worker = ( workerId == userId ? true : Workers.findOne({ "$and": [{ _id: workerId },{ owner: userId }] },{ fields: { _id: 1 } }) );
		const find_pos = Positions.findOne({ "$and": [{ 'city.visiting': true },{ owner: userId }] },{ fields: { 'city.name': 1 } });
		if ( find_worker && find_pos && find_pos.city.name ) {
			Stalls.update({ "$and": [
				{ city: find_pos.city.name },
				{ number: stallId },
				{ owner: userId }
			] },{ $set: { taskId: taskId } },
			function(err, count) {
			});
			if ( Meteor.isServer ) {
				let queue = {
					taskId: taskId,
					city: find_pos.city.name,
					stall: stallId,
					owner: this.userId,
					worker: workerId,
					created: time_now,
					started: time_now,
					length: 30
				};
				Queues.update({"$and": [
					{ owner: this.userId },
					{ worker: workerId },
					{ started: { $exists: true } },
					{ completed: { $exists: false } }
				]},{ $set: {
					completed: time_now
				} },function(err, count) {
					Queues.insert(queue);
					initQueue(queue);
					Workers.update({ _id: workerId },{
						$set: {
							working: time_now
						}
					},function(err, count) {
					});
				});
			};
		};
	},
	'startTaskBak': function(taskId,workerId) {
		if ( Meteor.isServer ) {
			const location = ( workerId ? Workers.findOne({ _id: workerId },{ fields: { city: 1 } }) : Positions.findOne({ "$and": [{ 'city.visiting': true },{ owner: this.userId }]},{ fields: { 'city.name': 1 } }) );
			const worker_id = ( workerId ? workerId : this.userId );
			const time_now = (new Date()).getTime();
			let queue = {
				taskId: taskId,
				owner: this.userId,
				worker: worker_id,
				created: time_now,
				started: time_now,
				length: 30
			};
			queue["city"] = ( workerId ? location.city : location.city.name );
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
				initQueue(queue);
				Workers.update({ _id: worker_id },{
					$set: {
						working: time_now
					}
				});
			});
		};
	}
});