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
  if ( !Gathered.findOne({}) ) {
    const data = [
			{
					task: "fish",
					item: "Talfin",
					exp: 0
			},
			{
					task: "fish",
					item: "Soppa",
					exp: 100
			},
			{
					task: "fish",
					item: "Quali",
					exp: 1000
			},
			{
					task: "farm",
					item: "Potatoe",
					exp: 0
			},
			{
					task: "farm",
					item: "Apple",
					exp: 100
			},
			{
					task: "farm",
					item: "Orange",
					exp: 1000
			}
		]
    data.forEach((job) => {
			Gathered.insert({
				task: job.task,
				item: job.item,
				exp: job.exp,
			});
		});
	}
  if ( !Produced.findOne({}) ) {
	}
});