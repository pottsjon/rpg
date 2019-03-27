// server-side collections
sysMsgs = new Meteor.Collection("sysmsgs");
hitCities = new Meteor.Collection("hitcities");

Meteor.publish("positions", function () {
	return Positions.find({ owner: this.userId });
});

Meteor.publish("items", function () {
	return Items.find({});
});

Meteor.publish("cities", function () {
	return Cities.find({});
});

Meteor.publish("tasks", function () {
	return Tasks.find({});
});

Meteor.publish("queues", function () {
	let pub = this,
	queuesPub = [],
    foundPub = Queues.find({ owner: this.userId });
	if ( this.userId ) {
		queuesPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				if ( oFields.worker != oFields.owner )
				oFields["name"] = Workers.findOne({
					_id: oFields.worker
				},{ fields: { name: 1 } }).name;
				oFields.task = Tasks.findOne({
					_id: oFields.taskId
				},{ fields: { task: 1 } });
				pub.added('queues', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('queues', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('queues', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			queuesPub.stop();
		});
	};
});

Meteor.publish("skills", function () {
	let pub = this,
	skillsPub = [],
	foundPub = Skills.find({ "$or": [{ owner: this.userId },{ boss: this.userId }] });
	if ( this.userId ) {
		skillsPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('skills', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('skills', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('skills', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			skillsPub.stop();
		});
	};
});

Meteor.publish("workers", function (city) {
	if ( this.userId && city ) {
		let pub = this,
		workersPub = [],
		foundPub = Workers.find({ "$and": [{ owner: { $exists: false } },{ city: city }] });
		workersPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				const skills = Skills.find({ owner: oId },{ fields: { amount: 0 } }).fetch();
				if ( skills )
				oFields.skills = skills;
				pub.added('workers', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('workers', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('workers', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			workersPub.stop();
		});
	};
});

Meteor.publish("employees", function () {
	let pub = this,
	employeesPub = [],
    foundPub = Workers.find({ owner: this.userId });
	if ( this.userId ) {
		employeesPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('employees', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('employees', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('employees', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			employeesPub.stop();
		});
	};
});

Meteor.publish("inventory", function (city) {
	let pub = this,
	inventoryPub = [];
	let inv_lookup = [{ "$and": [{ city: { $exists:  false } },{ owner: this.userId }] }];
	if ( city )
	inv_lookup.push({ "$and": [{ city: city },{ owner: this.userId }] });
    let foundPub = Inventory.find({ "$or": inv_lookup });
	if ( this.userId ) {
		inventoryPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				oFields.item = Items.findOne({ 'name.single': oFields.item });
				pub.added('inventory', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('inventory', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('inventory', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			inventoryPub.stop();
		});
	};
});

Meteor.publish("leaders", function (skip) {
	let pub = this,
	leadersPub = [],
	foundPub = Inventory.find({
		total: { $gt: 0 }
		},{
		fields: {
			owner: 1,
			total: 1
		},
		sort: {
			total: -1
		},
		skip: skip*20,
		limit: 21,
		disableOplog: true,
		pollingIntervalMs: 60000,
		pollingThrottleMs: 60000
	});	
	if ( this.userId ) {
		leadersPub = foundPub.observeChanges({
			added: function(oId,oFields) {
				oFields["name"] = Meteor.users.findOne({
					_id: oFields.owner
				},{ fields: { username: 1 } }).username;
				pub.added('leaders', oId, oFields);
			},
			changed: function(oId,oFields) {
				pub.changed('leaders', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('leaders', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			leadersPub.stop();
		});
	};
});