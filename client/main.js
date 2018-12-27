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

Template.leaderboard.onCreated(function() {
	console.log("test")
	var leadersSub = Meteor.subscribe('leaders');
	this.leaderSkip = new ReactiveVar( 0 );
});

Template.leaderboard.onDestroyed(function() {
	try { leadersSub.stop() } catch (e) {};
});

Template.leaderboard.helpers({
	leaders(){
		let skip = Template.instance().leaderSkip.get()*20;
		return Leaders.find({},
			{ sort:
				{ amount: -1 },
			skip: skip,
			limit: 20
			}).map(function(leader, index){
				leader.rank = (skip)+index-(-1);
			return leader;
		});
	}
});

Template.leaderboard.events({
	'click .prev'(e,t) {
		const skip = t.leaderSkip.get();		
		if ( skip >= 1 ) {
			t.leaderSkip.set(skip-1);
			subSkip("leaders", skip-1);
		};
	},
	'click .next'(e,t) {
		const skip = t.leaderSkip.get();
		t.leaderSkip.set(skip-(-1));
		subSkip("leaders", skip-(-1));
	}
});

Template.queue.helpers({
	progress(){
		timeDep.depend();
        let time_lapsed = time-this.started;
        let queue_length = this.length*1000;
        let rolls = Math.floor(time_lapsed/queue_length);
		let time_left = queue_length-(time_lapsed-(queue_length*rolls));
		let progress = ( !this.started ? 0 : 100-((time_left/queue_length)*100) );
		return "<div class='progress' style='width: "+progress+"%'></div>";
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
		if ( skill_amount >= this.item.exp )
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
			{
				text: "Leaderboard",
				route: '/leaderboard'
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
