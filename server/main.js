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
	if ( !Tasks.findOne({}) ) {
    const data = [
			{
				skill: "Farming",
				task: "Farm",
				item: "Potatoe",
				exp: 0
			},
			{
				skill: "Farming",
				task: "Farm",
				item: "Apple",
				exp: 100
			},
			{
				skill: "Farming",
				task: "Farm",
				item: "Orange",
				exp: 1000
			},
			{
				skill: "Mining",
				task: "Mine",
				item: "Bronze",
				exp: 0
			},
			{
				skill: "Mining",
				task: "Mine",
				item: "Copper",
				exp: 100
			},
			{
				skill: "Mining",
				task: "Mine",
				item: "Silver",
				exp: 1000
			},
			{
				skill: "Logging",
				task: "Chop",
				item: "Beech",
				exp: 0
			},
			{
				skill: "Logging",
				task: "Chop",
				item: "Ash",
				exp: 100
			},
			{
				skill: "Logging",
				task: "Chop",
				item: "Oak",
				exp: 1000
			}
		]
    data.forEach((job) => {
			Tasks.insert(job);
		});
	}
});