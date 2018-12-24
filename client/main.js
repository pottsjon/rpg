import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { ReactiveDict } from 'meteor/reactive-dict';

import '../imports/api/collections.js';
import './subscriptions.js';
import './main.html';
import './management/main.html';
import './trackers.js';
import './routing.js';
import './login.js';
import '../imports/api/globals.js';
import '../imports/api/methods.js';
import './management/main.js';

Template.gathering.helpers({
	inventory(){
		return Inventory.find();
	},
	queues(){
		return Queues.find({ completed: { $exists: false } });
	},
	gathers(){
		return Tasks.find();
	}
});

Template.gathering.events({
	'click .gather'() {
		const user_skills = Meteor.user().skills
		const skill_name = this.skill.toLowerCase();
		const current_skill = (	!user_skills || !user_skills[skill_name] ? 0 : user_skills[skill_name].exp );
		if ( current_skill >= this.exp )
		Meteor.call('startTask',this._id);
	}
});

Template.menu.helpers({
	menu() {
		const data = [
			{
				text: "Manage",
				route: '/'
			},
			{
				text: "Gather",
				route: '/gathering'
			},
			{
				text: "Produce",
				route: '/production'
			},
			{
				text: "Travel",
				route: '/traveling'
			},
		]
		return data
	}
});

Template.menu.events({
	'click .button'() {
    	Router.go(this.route);
	}
});

Meteor.startup(() => {
	sAlert.config({
	position: 'top',
	timeout: 3000,
	html: false,
	onRouteClose: true,
	stack: {
		spacing: 1,
		limit: 1
	}
	});
});
