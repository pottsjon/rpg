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
				skill: "Fishing",
				task: "Fish",
				item: "Talfin",
				exp: 0
			},
			{
				skill: "Fishing",
				task: "Fish",
				item: "Soppa",
				exp: 100
			},
			{
				skill: "Fishing",
				task: "Fish",
				item: "Quali",
				exp: 1000
			},
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