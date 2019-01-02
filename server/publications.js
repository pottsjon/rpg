// server-side collections
sysMsgs = new Meteor.Collection("sysmsgs");

Meteor.publish("items", function () {
	return Items.find({});
});

Meteor.publish("tasks", function () {
	return Tasks.find({});
});

Meteor.publish("skills", function () {
	return Skills.find({ owner: this.userId });
});

queuesPub = [];
Meteor.publish("queues", function () {
	let pub = this;
    let foundPub = Queues.find({ owner: this.userId });
	queuesPub[this.userId] = foundPub.observeChanges({
		added: function(oId, oFields) {
			oFields.task = Tasks.findOne({ _id: oFields.taskId });
			pub.added('queues', oId, oFields);
		},
		changed: function(oId, oFields) {
			pub.changed('queues', oId, oFields);
		},
		removed: function(oId) {
			pub.removed('invqueuesentory', oId);
		}
	});
	pub.ready();
	pub.onStop(function () {
        queuesPub[this.userId].stop();
	});
});

Meteor.publish("workers", function () {
	let pub = this;
    let foundPub = Workers.find({ owner: { $exists: false } });
	runningPub = foundPub.observeChanges({
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
        runningPub.stop();
	});
});

Meteor.publish("employees", function () {
	let pub = this;
    let foundPub = Workers.find({ owner: this.userId });
	runningPub = foundPub.observeChanges({
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
        runningPub.stop();
	});
});

inventoryPub = [];
Meteor.publish("inventory", function () {
	let pub = this;
    let foundPub = Inventory.find({ owner: this.userId });
	inventoryPub[this.userId] = foundPub.observeChanges({
		added: function(oId, oFields) {
			oFields.item = Items.findOne({ name: oFields.item });
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

Meteor.publish("leaders", function (skip) {
	let pub = this;
	let foundPub = Inventory.find({
		 amount: {
			 $gt: 0
			}
		},
		{ fields: {
			owner: 1,
			amount: 1
		},
		sort: {
			amount: -1
		},
		skip: skip*20,
		limit: 21,
		disableOplog: true,
		pollingIntervalMs: 60000,
		pollingThrottleMs: 60000
	});	
	runningPub = foundPub.observeChanges({
		added: function(oId,oFields) {
			oFields["name"] = Meteor.users.findOne({ _id: oFields.owner },{ fields: { username: 1 } }).username;
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
		runningPub.stop();
	});
});