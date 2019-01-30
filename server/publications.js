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

Meteor.publish("skills", function (userId) {
    return Skills.find({ "$or": [{ owner: userId },{ boss: userId }] });
});

queuesPub = [];
Meteor.publish("queues", function () {
	let pub = this;
    let foundPub = Queues.find({ owner: this.userId });
	queuesPub[this.userId] = foundPub.observeChanges({
		added: function(oId, oFields) {
			if ( oFields.worker != oFields.owner )
			oFields["name"] = Workers.findOne({
				_id: oFields.worker
			},{ fields: { name: 1 } }).name;
			oFields.task = Tasks.findOne({ _id: oFields.taskId },{ fields: { task: 1 } });
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
        queuesPub[this.userId].stop();
	});
});

workersPub = [];
Meteor.publish("workers", function () {
	let pub = this;
    let foundPub = Workers.find({ owner: { $exists: false } });
	workersPub[this.userId] = foundPub.observeChanges({
		added: function(oId, oFields) {
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
        workersPub[this.userId].stop();
	});
});

employeesPub = [];
Meteor.publish("employees", function () {
	let pub = this;
    let foundPub = Workers.find({ owner: this.userId });
	employeesPub[this.userId] = foundPub.observeChanges({
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
        employeesPub[this.userId].stop();
	});
});

inventoryPub = [];
Meteor.publish("inventory", function () {
	let pub = this;
    let foundPub = Inventory.find({ owner: this.userId });
	inventoryPub[this.userId] = foundPub.observeChanges({
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
        inventoryPub[this.userId].stop();
	});
});

leadersPub = [];
Meteor.publish("leaders", function (skip) {
	let pub = this;
	let foundPub = Inventory.find({
		total: {
			 $gt: 0
		}
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
	leadersPub[this.userId] = foundPub.observeChanges({
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
		leadersPub[this.userId].stop();
	});
});