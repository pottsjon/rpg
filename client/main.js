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
import './helpers.js';
import '../imports/api/globals.js';
import '../imports/api/methods.js';
import './management/main.js';

UI.body.onRendered(function() {
	Tracker.autorun(function() {
		if ( Meteor.user() ) {
			Meteor.setInterval(function() {
				const timenow = TimeSync.serverTime( (new Date()).getTime() );
				if ( timenow ) {
					time = timenow;
					timeDep.changed();
				};
			}, 333);
		} else {
			try { sysMsgs.remove({}) } catch (e) {}
		};
		let initializing = true;
		let found_inventory = Inventory.find({},
			{
				fields: {
				'item.name': 1,
				amount: 1,
				updatedAt: 1,
				updatedBy: 1,
				updatedHow: 1
				}
			}
		);
		runningInventory = found_inventory.observe({
			added: function(item) {
				if (!initializing) {
					delete item._id;
					let item_insert = sysMsgs.insert(item);
					Meteor.setTimeout(function() {
						sysMsgs.update({ _id: item_insert },{ $set: { hide: true } });
					}, 2000);
				};
			},
			changed: function(item,itemOld) {
				item.amount = item.amount-itemOld.amount;
				delete item._id;
				let item_insert = sysMsgs.insert(item);
				Meteor.setTimeout(function() {
					sysMsgs.update({ _id: item_insert },{ $set: { hide: true } });
				}, 2000);
			}
		});
		Meteor.setTimeout(function() {
			initializing = false;
		}, 2000);
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
	} catch (e) {}
});

Template.leaderboard.onCreated(function () {
	leadersSub = Meteor.subscribe('leaders');
	this.leaderSkip = new ReactiveVar( 0 );
});

Template.leaderboard.onDestroyed(function () {
	try { leadersSub.stop() } catch (e) {};
});

Template.leaderboard.helpers({
	leaders(){
		let skip = Template.instance().leaderSkip.get()*20;
		return Leaders.find({},
			{ sort:
				{ amount: -1 },
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
			try { leadersSub.stop() } catch (e) { };
			leadersSub = Meteor.subscribe("leaders", skip-1);
		};
	},
	'click .next'(e,t) {
		const count = Leaders.find({}).count();
		const skip = t.leaderSkip.get();
		if ( count > 20 ) {
			t.leaderSkip.set(skip-(-1));
			try { leadersSub.stop() } catch (e) { };
			leadersSub = Meteor.subscribe("leaders", skip-(-1));
		};
	}
});

Template.log.helpers({
	message(){
		const updated_by = ( this.updatedBy == Meteor.userId() ? "You" : "Worker" );
		return "<span class='timestamp'>"+moment(this.updatedAt).format('h:mm:ssa')+"</span> "+updated_by+" found "+this.amount+" "+this.item.name.toLowerCase()+" while "+this.updatedHow.toLowerCase()+".";
	}
});

Template.queue.helpers({
	awarded(){
		let award = sysMsgs.findOne({ updatedBy: Meteor.userId() },{
			sort: {
				updatedAt: -1
			},
			fields: {
				'item.name': 1,
				amount: 1,
				updatedAt: 1,
				hide: 1
			}
		});
		let award_class = ( !award || !award.hide ? "" : "hide" );
		if ( award )
		return "<div class='award "+award_class+"'>+"+award.amount+" "+award.item.name+"</div>";
	},
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
	logs(){
		return sysMsgs.find({},{ sort: { updatedAt: -1 } });
	},
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

Template.hiring.onCreated(function () {
	this.selectEmployee = new ReactiveVar( false );
});

Template.hiring.helpers({
	employees() {
		return Employees.find().map(function(emp, index){
			emp.menu = Template.instance().selectEmployee.get() == emp._id;
			return emp;
		});
	},
	prospects() {
		return Workers.find();
	}
});

Template.hiring.events({
	'click .employee'(e,t) {
		t.selectEmployee.set(this._id);
	},
	'click .prospect'() {
		Meteor.call('hireWorker',this._id);
	}
});

Template.worker.events({
	'click .task'() {
		Meteor.call('startTask',this._id,this.workerId);
	}
});

Template.worker.helpers({
	tasks(){
		let worker_id = this._id;
		return Tasks.find().map(function(task, index){
			task.workerId = worker_id;
			return task;
		});
	},
	menu() {
		if ( this.menu )
		return "<div class='menu'><div class='button'>Farm Potato</div></div>";
	},
	employee() {
		return ( this.owner ? "employee" : "prospect" );
	}
});

Template.menu.helpers({
	time() {
		timeDep.depend();
		if ( time )
		return moment(time).format('h:mm:ssa');
	},
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
				text: "Hire",
				route: '/hiring'
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
