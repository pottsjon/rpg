// server-side collections
Workers = new Meteor.Collection("workers");

Meteor.publish("items", function () {
	return Items.find({});
});

Meteor.publish("tasks", function () {
	return Tasks.find({});
});

Meteor.publish("skills", function () {
	return Skills.find({ owner: this.userId });
});

Meteor.publish("queues", function () {
	return Queues.find({ owner: this.userId });
});

Meteor.publish("prospects", function () {
	let pub = this;
    let foundPub = Workers.find({ owner: { $exists: false } });
	runningPub = foundPub.observeChanges({
		added: function(oId, oFields) {
			pub.added('prospects', oId, oFields);
		},
		changed: function(oId, oFields) {
			pub.changed('prospects', oId, oFields);
		},
		removed: function(oId) {
			pub.removed('prospects', oId);
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

Meteor.publish("inventory", function () {
	let pub = this;
    let foundPub = Inventory.find({ owner: this.userId });
	runningPub = foundPub.observeChanges({
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
        runningPub.stop();
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