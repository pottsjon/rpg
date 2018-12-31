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
	Items._ensureIndex({ name: 1 });
	checkTasks();
	checkItems();
	awardQueues();
});
