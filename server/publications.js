// server-side collections
Workers = new Meteor.Collection("workers");

Meteor.publish("gathered", function () {
	return Gathered.find({ });
});

Meteor.publish("inventory", function () {
	return Inventory.find({ owner: this.userId });
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