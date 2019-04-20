import { Meteor } from 'meteor/meteor';
import '../imports/api/collections.js';
import '../imports/api/methods.js';
import '../imports/api/globals.js';
import './publications.js';
import './crons.js';
import './functions.js';
import collide from 'line-circle-collision';

Accounts.onCreateUser(function(options, user) {
	startingCity(user._id);
	user.avatar = Math.floor(Math.random()*60+1);
	user.energy = 0;
	user.maxEnergy = 100;
	return user;
});

// don't let people write arbitrary data to their 'profile' field from the client
Meteor.users.deny({
	update() {
	  return true;
	},
});

Meteor.startup(() => {
	Cities._ensureIndex({ x: 1, y: 1 });
	Tasks._ensureIndex({ _id: 1 });
	Items._ensureIndex({ 'name.single': 1 });
	Queues._ensureIndex({ owner: 1 });
	Workers._ensureIndex({ owner: 1 });
	Skills._ensureIndex({ boss: 1, owner: 1 });
	Inventory._ensureIndex({ owner: 1, amount: 1 });
	checkCities();
	checkTasks();
	checkItems();
	awardQueues();
	positionTracker();
	tradeTracker();
	stopNext();
	UserStatus.events.on("connectionLogout", function(fields) {
		Meteor.users.update({ _id: fields.userId },{
			$set: {
				'status.logout': (new Date()).getTime()
			}
		});
	});
});
