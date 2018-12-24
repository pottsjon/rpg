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

UI.body.onRendered(function() {
	Tracker.autorun(function() {
		if( Meteor.user() )
		Meteor.setInterval(function() {
			const timenow = TimeSync.serverTime( (new Date()).getTime() );
			if ( timenow ) {
				time = timenow;
				timeDep.changed();
			};
		}, 333);
	});
});

Deps.autorun(function(c) {
	try {
	UserStatus.startMonitor({
	threshold: 1000*60*10,
	interval: 1000*60*5,
	idleOnBlur: true
	});
	return c.stop();
	} catch (_error) {}
});

Template.queue.helpers({
	progress(){
		timeDep.depend();
        let time_lapsed = time-this.started;
        let queue_length = this.length*1000;
        let rolls = Math.floor(time_lapsed/queue_length);
		let time_left = queue_length-(time_lapsed-(queue_length*rolls));
		let progress = ( !this.started ? 0 : 100-((time_left/queue_length)*100) );
		console.log(Template.instance());
		return progress;
	}
});

Template.gathering.helpers({
	skills(){
		return Skills.find({},{ sort: { amount: -1 } });
	},
	inventory(){
		return Inventory.find({},{ sort: { amount: -1 } });
	},
	queues(){
		return Queues.find({ completed: { $exists: false } });
	},
	tasks(){
		return Tasks.find();
	}
});

Template.gathering.events({
	'click .task'() {
		const user_skill = Skills.findOne({ name: this.skill },{ fields: { amount: 1 } });
		const skill_amount = ( !user_skill || !user_skill.amount ? 0 : user_skill.amount );
		if ( skill_amount >= this.exp )
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
