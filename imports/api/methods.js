Meteor.methods({
	'startBattle': function(end) {
		if ( Meteor.isServer ) {
			const time_now = (new Date()).getTime();
			Battles.update({ "$and": [
				{ owner: this.userId },
				{ completed: { $exists: false } },
			] },{ $set: { completed: time_now } },
			function(err, count) {
			});
			if ( !end ) {
				const battle = {
					owner: this.userId,
					started: time_now,
					allies: [{
						_id: this.userId,
						level: 1,
						health: 100,
						stats: {
							attack: 10,
							speed: 5,
							defense: 6,
							armor: 5,
							magic_defense: 5
						},
						attacks: [
							{ 
								name: "Slash",
								time: 4,
								cooldown: 6,
								open: 1,
								power: 100
							},
							{ 
								name: "Lunge",
								time: 5,
								cooldown: 6,
								open: 2,
								power: 150
							},
							{
								name: "Jab",
								time: 2,
								cooldown: 4,
								power: 50
							},
							{
								name: "Thrust",
								time: 3,
								cooldown: 6,
								open: 2,
								power: 125
							}
						]
					}],
					opponents: [{
						_id : Random.id(),
						name: "Skeleton",
						level: 1,
						health: 100,
						stats: {
							attack: 5,
							speed: 5,
							defense: 5,
							armor: 5,
							magic_defense: 5
						},
						attacks: [
							{ 
								name: "Slash",
								time: 4,
								cooldown: 6,
								open: 1,
								power: 100
							},
							{ 
								name: "Lunge",
								time: 5,
								cooldown: 6,
								open: 2,
								power: 150
							},
							{
								name: "Jab",
								time: 2,
								cooldown: 4,
								power: 50
							},
							{
								name: "Thrust",
								time: 3,
								cooldown: 6,
								open: 2,
								power: 125
							}
						]
					},
					{
						_id : Random.id(),
						name: "Skeleton",
						level: 1,
						health: 100,
						stats: {
							attack: 5,
							speed: 5,
							defense: 5,
							armor: 5,
							magic_defense: 5
						},
						attacks: [
							{ 
								name: "Slash",
								time: 4,
								cooldown: 6,
								open: 1,
								power: 100
							},
							{ 
								name: "Lunge",
								time: 5,
								cooldown: 6,
								open: 2,
								power: 150
							},
							{
								name: "Jab",
								time: 2,
								cooldown: 4,
								power: 50
							},
							{
								name: "Thrust",
								time: 3,
								cooldown: 6,
								open: 2,
								power: 125
							}
						]
					}]
				};
				Battles.insert(battle,
				function(err, id) {
					if ( id ) {
					battle._id = id;
					startBattle(battle);
					};
				});
			};
		};
	},
	'eatFood': function(itemId, amount) {
		if ( Meteor.isServer ) {
			const inv = Inventory.findOne({ _id: itemId },{ fields: { amount: 1, item: 1 } });
			const item = Items.findOne({ 'name.single': inv.item },{ fields: { energy: 1 } });
			const user = Meteor.users.findOne({ _id: this.userId },{ fields: { energy: 1, maxEnergy: 1 } });
			const leftover = user.maxEnergy-user.energy;
			const update = ( item.energy*amount >= leftover ? Math.ceil(leftover/item.energy) : amount );
			const total = ( item.energy*amount >= leftover ? leftover : item.energy*amount );
			if ( update > 0 && inv && inv.amount && inv.amount >= update && item && item.energy ) {
				Inventory.update({ _id: itemId },{ $inc: { amount: -update } });
				Meteor.users.update({ _id: this.userId },{ $inc: { energy: total } });
			};
		};
	},
	'chooseAvatar': function(number) {
		if ( Meteor.isServer )
		Meteor.users.update({ _id: this.userId },{ $set: { avatar: number } });
	},
	'visitNext': function(visit) {
		let position = Positions.findOne({ owner: this.userId });
		const update = ( visit ? { $set: { visit: true } } : { $unset: { visit: "" } } );
		Positions.update({ _id: position._id },update,
		function(err, count) {
		});
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
		},
		function(err, count) {
		});
		set_position.owner = this.userId;
		if ( Meteor.isServer ) {
			cityTimerStart(set_position);
			clearQueue(this.userId, this.userId);
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
			},
			function(err, count) {
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
		Skills.update({ owner: workerId },{ $set: { boss: this.userId } },{ multi: true },
		function(err, count) {
		});
	},
	'stallWorker': function(stallId, workerId) {
		if ( Meteor.isServer ) {
			const time_now = (new Date()).getTime();
			const find_worker = ( workerId == this.userId ? true : Workers.findOne({ "$and": [{ _id: workerId },{ owner: this.userId }] },{ fields: { _id: 1 } }) );
			const find_pos = Positions.findOne({ "$and": [{ 'city.visiting': true },{ owner: this.userId }] },{ fields: { 'city.name': 1 } });
			if ( find_worker && find_pos && find_pos.city.name ) {
				const stall_update = ( stallId != 1 && stallId != 2 ) ? { "$and": [{ _id: stallId },{  owner: this.userId }] } : { "$and": [{ city: find_pos.city.name },{ number: stallId },{ owner: this.userId }] };
				const stall = Stalls.findOne(stall_update,{ fields: {
					worker: 1,
					number: 1
				} });
				if ( stall && stall.number )
				Queues.update({"$and": [
					{ owner: this.userId },
					{ worker: stall.worker },
					{ city: find_pos.city.name },
					{ stall: stall.number },
					{ started: { $exists: true } },
					{ completed: { $exists: false } }
				]},{ $set: {
					completed: time_now
				} },function(err, count) {
				});
				if ( !stall || stall.worker != workerId )
				Stalls.update(stall_update,{ $set: { worker: workerId }, $unset: { taskId: "" } },{ upsert: true },
				function(err, count) {
				});
			};
		};
	},
	'startTask': function(stallId, workerId, taskId) {
		if ( Meteor.isServer ) {
			const time_now = (new Date()).getTime();
			const userId = ( Meteor.isServer ? this.userId : Meteor.userId() );
			const find_worker = ( workerId == userId ? true : Workers.findOne({ "$and": [{ _id: workerId },{ owner: userId }] },{ fields: { _id: 1 } }) );
			const find_pos = Positions.findOne({ "$and": [{ 'city.visiting': true },{ owner: userId }] },{ fields: { 'city.name': 1 } });
			const task = Tasks.findOne({ _id: taskId },{ fields: { exp: 0 } });
			let queue = {
				taskId: taskId,
				task: task,
				city: find_pos.city.name,
				stall: stallId,
				owner: this.userId,
				worker: workerId,
				created: time_now,
				started: time_now,
				length: 30
			};
			const reqs = ( task.energy || task.requires ? feedQueue(queue) : true );
			if ( find_worker && find_pos && find_pos.city.name && reqs ) {
				Stalls.update({ "$and": [
					{ city: find_pos.city.name },
					{ number: stallId },
					{ owner: userId }
				] },{ $set: { taskId: taskId } },
				function(err, count) {
				});
				Queues.update({"$and": [
					{ owner: this.userId },
					{ worker: workerId },
					{ started: { $exists: true } },
					{ completed: { $exists: false } }
				]},{ $set: { completed: time_now } },
				function(err, count) {
					Queues.insert(queue);
					initQueue(queue);
					Workers.update({ _id: workerId },{
						$set: { working: time_now }
					},function(err, count) {
					});
				});
			};
		};
	}
});