import { Meteor } from 'meteor/meteor';
import '../imports/api/collections.js';
import '../imports/api/methods.js';
import '../imports/api/globals.js';
import './publications.js';
import './crons.js';
import './functions.js';

Accounts.onCreateUser(function(options, user) {
	return user;
});

// don't let people write arbitrary data to their 'profile' field from the client
Meteor.users.deny({
	update() {
	  return true;
	},
});

Meteor.startup(() => {
	Tasks._ensureIndex({ _id: 1 });
	Items._ensureIndex({ 'name.single': 1 });
	Queues._ensureIndex({ owner: 1 });
	Workers._ensureIndex({ owner: 1 });
	Skills._ensureIndex({ boss: 1, owner: 1 });
	Inventory._ensureIndex({ owner: 1, amount: 1 });
	checkTasks();
	checkItems();
	awardQueues();
});
