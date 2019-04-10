import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { ReactiveDict } from 'meteor/reactive-dict';
import { konva } from 'konva';

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
import './map.js';
import { SlowBuffer } from 'buffer';

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
				city: 1,
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
		interval: 1000*60*2,
		idleOnBlur: true
	});
	return c.stop();
	} catch (e) {}
});

Template.game.onCreated(function () {
	this.invToggle = new ReactiveVar( true );
});

Template.game.events({
	'click .toggle_inv'(e,t) {
		const toggle = t.invToggle.get();
		if ( toggle ) {
			t.invToggle.set(false);
		} else {
			t.invToggle.set(true);
		}
	},
	'click .inventory.tucked .box'(e,t) {
		t.invToggle.set(false);
	}
});

Template.game.helpers({
	showInv(){
		let toggle = Template.instance().invToggle.get();
		if ( toggle )
		return "tucked";
	},
	coords() {
        playerPositionDep.depend();
        if ( playerPosition && playerPosition.x && playerPosition.y )
        return "<div class='coords'>"+Math.round(playerPosition.x)+","+Math.round(playerPosition.y)+"</div>";
    },
	time() {
		timeDep.depend();
		if ( time )
		return moment(time).format('h:mm:ssa');
	},
	showGame(){
		if ( Meteor.user() )
		return true
	},
	inventory(){
		return Inventory.find({ city: { $exists: false } },{ sort: { amount: -1 } });
	}
});

Template.stall.helpers({
	warn(){
		if ( !this.taskId && this.worker )
		return "<div class='warn flex'>Choose Task</div>";
	},
	flex(){
		if ( !this.taskId && !this.worker )
		return "flex";
	},
	stage(){
		if ( this.taskId ) {
			return "running";
		} else if ( this.worker ) {
			return "choose";
		} else {
			return "start";
		};
	},
	worker(){
		if ( this.worker ) {
			const avatar = ( this.worker == Meteor.userId() ? "walking-1" : "workers/person-1" );
			const tasking = ( !this.taskId ? "tasking" : "" );
			return "<div class='job-worker noselect "+tasking+"'><img src='/assets/"+avatar+".png'/></div>";
		};
	},
	tasking(){
		if ( this.taskId ) {
			const task = Tasks.findOne({ _id: this.taskId },{ fields: { items: 1 } });
			return "<img src='/assets/inv/"+task.items[0].replace(/\s+/g, '-').toLowerCase()+".png'/>";
		} else if ( this.worker ) {
			return "<img src='/assets/plus.png'/>";
		} else {
			return "<div class='open'>Open Stall</div>";
		};
	},
	queues(){
		return Queues.find({ "$and": [
			{ city: this.city },
			{ stall: this.number },
			{ completed: { $exists: false } }
		] }).map(function(queue, index){
			queue.award = sysMsgs.findOne({ updatedBy: queue.worker },{
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
			return queue;
		});
	},
});

Template.town.onCreated(function () {
	this.stallSelect = new ReactiveVar( false );
	Tracker.autorun(function() {
		let visiting = Positions.findOne({ 'city.visiting': true },{ fields: { 'city.name': 1 } });
		if ( visiting && visiting.city.name ) {
			try { prospectsSub.stop() } catch (e) {};
			prospectsSub = Meteor.subscribe('prospects', visiting.city.name);
			try { invSub.stop() } catch (e) {};
			invSub = Meteor.subscribe('inventory', visiting.city.name);
			try { stallsSub.stop() } catch (e) {};
			stallsSub = Meteor.subscribe('stalls', visiting.city.name);
			visitingCity = visiting.city.name;
			visitingCityDep.changed();
		} else {
			try { prospectsSub.stop() } catch (e) {};
			try { invSub.stop() } catch (e) {};
			try { stallsSub.stop() } catch (e) {};
			visitingCity = false;
			visitingCityDep.changed();
		};
	});
});

Template.town.events({
	'click .task'(e, t) {
		const stall = t.stallSelect.get();
		const user_skill = Skills.findOne({ "$and": [{ owner: this.worker },{ name: this.skill }] },{ fields: { amount: 1 } });
		const skill_amount = ( !user_skill || !user_skill.amount ? 0 : user_skill.amount );
		if ( skill_amount >= this.exp )
		Meteor.call('startTask', stall._id, this.worker, this._id);
		t.stallSelect.set(false);
	},
	'click .close_menu'(e, t) {
		t.stallSelect.set(false);
	},
	'click .select_stall'(e, t) {
		if ( !this.worker ) {
			t.stallSelect.set({ _id: this.number, workers: true });
		} else if ( !this.task ) {
			t.stallSelect.set({ _id: this.number, tasks: true });
		} else {
			t.stallSelect.set({ _id: this.number, stop: true });			
		};
	},
	'click .worker'(e, t) {
		const stall = t.stallSelect.get();
		Meteor.call('stallWorker', stall._id, this._id);
		t.stallSelect.set(false);
	}
});

Template.town.helpers({
	city(){
		visitingCityDep.depend();
		if ( visitingCity )
		return visitingCity;
	},
	showMenus(){
		let selected = Template.instance().stallSelect.get();
		if ( selected && ( selected.tasks || selected.workers ) )
		return true;
	},
	showTasks(){
		let selected = Template.instance().stallSelect.get();
		if ( selected && selected.tasks )
		return true;
	},
	showWorkers(){
		let selected = Template.instance().stallSelect.get();
		if ( selected && selected.workers )
		return true;
	},
	tasks(){
		let selected = Template.instance().stallSelect.get();
		let stall = Stalls.findOne({ number: selected._id },{ fields: { worker: 1 } });
		if ( stall.worker ) {
			let worker = stall.worker, available_tasks = [], skills = {}, nexts = {}, tasks = Tasks.find({},{ sort: { exp: -1 } }).fetch();
			skills["Farming"] = Skills.findOne({ "$and": [{ name: "Farming" },{ owner: worker }] },{ fields: { amount: 1 } });
			skills["Mining"] = Skills.findOne({ "$and": [{ name: "Mining" },{ owner: worker }] },{ fields: { amount: 1 } });
			skills["Logging"] = Skills.findOne({ "$and": [{ name: "Logging" },{ owner: worker }] },{ fields: { amount: 1 } });
			tasks.forEach((task) => {
				task.worker = worker;
				if ( task.exp == 0 || ( skills[task.skill] && skills[task.skill].amount && skills[task.skill].amount >= task.exp ) ) {
					available_tasks.push(task);
				} else if ( !nexts[task.skill] ) {
					nexts[task.skill] = true;
					task.next = true;
					task.name = "You";
					available_tasks.push(task);
				};
			});
			return available_tasks;
		};
	},
	employees() {
		visitingCityDep.depend();
		if ( visitingCity ) {
			let employees = Workers.find({ "$and": [{ city: visitingCity },{ owner: Meteor.userId() }] },{
				sort: {
					working: -1,
					started: -1
				}
			}).fetch();
			employees.map(function(emp, index){
				const workerId = emp._id
				emp.skills = Skills.find({ owner: workerId });
				emp.queues = Queues.find({ "$and": [
					{ worker: { $ne: Meteor.userId() } },
					{ worker: workerId },
					{ completed: { $exists: false } }
				] },{ sort: {
					started: -1
				} });
				return emp;
			});
			const skills = Skills.find({ owner: Meteor.userId() });
			employees.unshift({ _id: Meteor.userId(), owner: Meteor.userId(), skills: skills });
			return employees;
		};
	},
	stalls(){
		let stalls = Stalls.find({},{ sort: { number: 1 } }).fetch();
		if ( stalls.length < 3 )
		for ( let n = stalls.length; 3 > n; n++ ) {
			stalls.push({ number: n+1 });
		}
		return stalls;
	},
	skills(){
		let skills = Skills.find({ owner: Meteor.userId() },{ sort: { type: 1, amount: -1 } }).fetch();
		let skill_return = [];
		let skill_types = [];
		skills.forEach((skill) => {
			if ( !skill_types[skill.type] ) {
				skill_types[skill.type] = true;
				skill_return.push({ title: skill.type+" Skills" });
			};
			skill_return.push(skill);
		});
		return skill_return;
	},
	queues(){
		return Queues.find({ "$and": [
			{ worker: Meteor.userId() },
			{ completed: { $exists: false } }
		] }).map(function(queue, index){
			queue.award = sysMsgs.findOne({ updatedBy: queue.worker },{
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
			return queue;
		});
	},
	logs(){
		visitingCityDep.depend();
		if ( visitingCity )
		return sysMsgs.find({ city: visitingCity },{ sort: { updatedAt: -1 }, limit: 200 });
	}
});

Template.storage.onCreated(function () {
	this.storageMenu = new ReactiveVar( false );
	this.storageSort = new ReactiveVar({ amount: -1 });
	this.storageFilter = new ReactiveVar([]);
});

Template.storage.events({
	'click .filter'(e,t) {
		if ( e.currentTarget.innerText == "Clear" ) {
			t.storageFilter.set([]);
		} else {
			let count = 0, final, push = true, filters = t.storageFilter.get();
			filters.forEach((filter) => {
				if ( filter["item.type"] == e.currentTarget.innerText ) {
					push = false;
					final = count;
				};
				count++
			});
			if ( push ) {
				filters.push({ 'item.type': e.currentTarget.innerText });
			} else {
				filters.splice(final, 1);
			};
			t.storageFilter.set(filters);
		};
	},
	'click .sort'(e,t) {
		let setting = { };
		const text = e.currentTarget.innerText.toLowerCase();
		let inner = ( text != "amount" ? "item."+text : text );
		inner = ( text == "updated" ? text+"At" : inner );
		setting[inner] = ( !t.storageSort.get()[inner] || t.storageSort.get()[inner] == 1 ? -1 : 1 );
		t.storageSort.set(setting);
	},
	'click .sort_items'(e,t) {
		if ( t.storageMenu.get() != "sort" ) {
			t.storageMenu.set("sort");
		} else {
			t.storageMenu.set(false);
		};
	},
	'click .filter_items'(e,t) {
		if ( t.storageMenu.get() != "filter" ) {
			t.storageMenu.set("filter");
		} else {
			t.storageMenu.set(false);
		};
	}
});

Template.storage.helpers({
	filter_back(){
		if ( Template.instance().storageMenu.get() == "filter" )
		return "selected";
	},
	sort_back(){
		if ( Template.instance().storageMenu.get() == "sort" )
		return "selected";
	},
	check(){
		let check, filters = Template.instance().storageFilter.get();
		filters.forEach((filter) => {
			if ( filter["item.type"] == this.text )
			check = "<span class='mdi mdi-check'></span>";
		});
		return check;
	},
	arrow(){
		let direction = Template.instance().storageSort.get()[this.text.toLowerCase()];
		direction = !direction ? Template.instance().storageSort.get()["item."+this.text.toLowerCase()] : direction;
		direction = !direction ? Template.instance().storageSort.get()[this.text.toLowerCase()+"At"] : direction;
		if ( direction ) {
			const arr_up = "<span class='mdi mdi-menu-up'></span>";
			const arr_down = "<span class='mdi mdi-menu-down'></span>";
			let arrow = ( direction == 1 ? arr_up : arr_down );
			return arrow;
		};
	},
	selected(){
		if ( this.text.toLowerCase() == Object.keys(Template.instance().storageSort.get())[0] || "item."+this.text.toLowerCase() == Object.keys(Template.instance().storageSort.get())[0]  || this.text.toLowerCase()+"At" == Object.keys(Template.instance().storageSort.get())[0] ) {
			return "selected";
		} else if ( this.text == "Clear" ) {
			return "clear";
		};
	},
	sorts(){
		return [{ text: "Amount" },{ text: "Level" },{ text: "Type" },{ text: "Name" },{ text: "Rarity" },{ text: "Updated" }];
	},
	filters(){
		visitingCityDep.depend();
		let filters = Template.instance().storageFilter.get(), types = {};
		if ( visitingCity ) {
			let inventory = Inventory.find({ city: visitingCity },{ fields: { 'item.type': 1 } }).fetch();
			var flags = [], output = [], l = inventory.length, i;
			for( i=0; i<l; i++) {
				if( flags[inventory[i].item.type] ) continue;
				flags[inventory[i].item.type] = true;
				output.push({ text: inventory[i].item.type });
			}
			if ( filters.length >= 1 )
			output.unshift({ text: "Clear" });
			return output;
		};
	},
	sorting(){
		if ( Template.instance().storageMenu.get() == "sort" )
		return "show";
	},
	filtering(){
		if ( Template.instance().storageMenu.get() == "filter" )
		return "show";
	},
	city(){
		visitingCityDep.depend();
		if ( visitingCity )
		return visitingCity;
	},
	inventory(){
		visitingCityDep.depend();
		let filters = Template.instance().storageFilter.get();
		let sorts = Template.instance().storageSort.get();
		if ( filters.length == 0 )
		filters = [{}];
		if ( visitingCity )
		return Inventory.find({ "$and": [{ city: visitingCity },{ "$or": filters }] },{ sort: sorts });
	}
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
		const updated_by = ( this.updatedBy == Meteor.userId() ? "You" : "A worker" );
		const item_name = ( this.amount > 1 ? this.item.name.plural : this.item.name.single );
		return "<span class='timestamp'>"+moment(this.updatedAt).format('h:mm:ssa')+"</span> "+updated_by+" found "+this.amount+" "+item_name.toLowerCase()+" while "+this.updatedHow.toLowerCase()+".";
	}
});

Template.queue.helpers({
	awarded(){
		let award_class = ( !this.award || !this.award.hide ? "" : "hide" );
		if ( this.award ) {
			let award_name = ( this.award.amount > 1 ? this.award.item.name.plural : this.award.item.name.single );
			return "<div class='award "+award_class+"'>+"+this.award.amount+" "+award_name+"</div>";
		};
	},
	progress(){
		if ( this.started ) {
			try { Meteor.clearTimeout(queueInts[this._id]) } catch (e) { };
			const queue_length = this.length*1000;
			const time_lapsed = TimeSync.serverTime( (new Date()).getTime() )-this.started;
			const rolls = Math.floor(time_lapsed/queue_length);
			const time_left = queue_length-(time_lapsed-(queue_length*rolls));
			const progress_left = 100-((time_left/queue_length)*100);
			const progress_next = 100-(((time_left-(-15))/queue_length)*100);
			const tick = progress_left-progress_next;
			Template.instance().queueInt.set(progress_left);
			queueInterval(this._id,tick,Template.instance());
		};
		let progress = Template.instance().queueInt.get();
		return "<div class='progress' style='width: "+progress+"%;'></div>";
	}
});

queueInts = [];
queueInterval = function (queueId,tick,t) {
	queueInts[queueId] = Meteor.setInterval(function() {
		tick = tick-(-tick);
		t.queueInt.set(tick);
	}, 15);
};

Template.queue.onCreated(function () {
	this.queueInt = new ReactiveVar( 0 );
});

Template.queue.onDestroyed(function () {
    try { Meteor.clearTimeout(queueInts[this.data._id]) } catch (e) { };
});

Template.skill.helpers({
	amount(){
		if ( this.amount )
		return numeral(this.amount).format('0,0.[00]a');
	},
	level(){
		const level = ( !this.boss ? this.level : "("+this.level+")" );
		return level;
	},
	icon(){
		return "<img class='icon' src='/assets/icons/"+this.name.toLowerCase()+".png'/>";
	},
	showTitle(){
		if ( this.title )
		return true;
	}
});

Template.item.helpers({
	img(){
		let img = this.item.name.single.replace(/\s+/g, '-').toLowerCase();
		return "<img class='round-sm' src='/assets/inv/"+img+".png'/>";
	}
});

Template.task.helpers({
	name(){
		return this.items[0];
	},
	needed(){
		if ( this.next )
		return "<div class='needed flex'>"+this.skill+" +"+this.exp+"</div>";
	},
	next(){
		if ( this.next )
		return "next";
	},
	item(){
		let img = this.items[0].replace(/\s+/g, '-').toLowerCase();
		let task_img = this.skill.replace(/\s+/g, '-').toLowerCase();
		return "<img class='image' src='/assets/inv/"+img+".png'/><img class='icon' src='/assets/icons/"+task_img+".png'/>";
	}
});

Template.gathering.events({
	'click .task'() {
		const user_skill = Skills.findOne({ "$and": [{ owner: Meteor.userId() },{ name: this.skill }] },{ fields: { amount: 1 } });
		const skill_amount = ( !user_skill || !user_skill.amount ? 0 : user_skill.amount );
		if ( skill_amount >= this.exp )
		Meteor.call('startTask',this._id);
	}
});

Template.gathering.helpers({
	logs(){
		return sysMsgs.find({},{ sort: { updatedAt: -1 }, limit: 200 });
	},
	tasks(){
		let available_tasks = [], skills = {}, nexts = {}, tasks = Tasks.find({ type: "Resource" }).fetch();
		skills["Farming"] = Skills.findOne({ "$and": [{ name: "Farming" },{ owner: Meteor.userId() }] },{ fields: { amount: 1 } });
		skills["Mining"] = Skills.findOne({ "$and": [{ name: "Mining" },{ owner: Meteor.userId() }] },{ fields: { amount: 1 } });
		skills["Logging"] = Skills.findOne({ "$and": [{ name: "Logging" },{ owner: Meteor.userId() }] },{ fields: { amount: 1 } });
		tasks.forEach((task) => {
			if ( task.exp == 0 || ( skills[task.skill] && skills[task.skill].amount && skills[task.skill].amount >= task.exp ) ) {
			available_tasks.push(task);
			} else if ( !nexts[task.skill] ) {
				nexts[task.skill] = true;
				task.next = true;
				available_tasks.push(task);
			};
		});
		return available_tasks;
	}
});

Template.production.helpers({
	tasks(){
		return Tasks.find({ type: "Product" });
	}
});

Template.hiring.onCreated(function () {
	this.selectEmployee = new ReactiveVar( false );
});

Template.hiring.helpers({
	logs(){
		return sysMsgs.find({},{ sort: { updatedAt: -1 }, limit: 200 });
	},
	employees() {
		visitingCityDep.depend();
		if ( visitingCity )
		return Workers.find({ "$and": [{ city: visitingCity },{ owner: Meteor.userId() }] },{
			sort: {
				working: -1,
				started: -1
			}
		}).map(function(emp, index){
			const workerId = emp._id
			emp.skills = Skills.find({ owner: workerId });
			emp.queues = Queues.find({ "$and": [
				{ worker: { $ne: Meteor.userId() } },
				{ worker: workerId },
				{ completed: { $exists: false } }
			] },{ sort: {
				started: -1
			} }).map(function(queue, index){
				queue.award = sysMsgs.findOne({
					updatedBy: queue.worker
				},{
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
				return queue;
			});
			emp.tasks = Tasks.find().map(function(task, index){
				task.workerId = workerId;
				return task;
			});
			emp.menu = Template.instance().selectEmployee.get() == workerId;
			return emp;
		});
	},
	prospects() {
		return Prospects.find({ owner: { $exists: false } });
	}
});

Template.hiring.events({
	'click .employee'(e,t) {
		t.selectEmployee.set(this._id);
	}
});

Template.employee.events({
	'click .task'() {
		const user_skill = Skills.findOne({ "$and": [{ owner: this._id },{ name: this.skill }] },{ fields: { amount: 1 } });
		const skill_amount = ( !user_skill || !user_skill.amount ? 0 : user_skill.amount );
		if ( skill_amount >= this.exp )
		Meteor.call('startTask',this._id,this.workerId);
	}
});

Template.employee.helpers({
	avatar() {
		const avatar = ( !this.avatar ? "walking-1" : "workers/person-"+this.avatar );
		return "<img class='avatar' src='/assets/"+avatar+".png'/>"
	}
});

Template.worker.events({
	'click .worker'() {
		Meteor.call('hireWorker',this._id);
	}
});

Template.worker.helpers({
	avatar() {
		return "<img class='avatar' src='/assets/workers/person-"+this.avatar+".png'/>"
	}
});

Template.menu.helpers({
	menu() {
		const data = [
			{
				text: "Town",
				route: '/town'
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
			/*
			{
				text: "Leaderboard",
				route: '/leaderboard'
			},
			*/
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
