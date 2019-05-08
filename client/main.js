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
import { ENGINE_METHOD_CIPHERS, SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS, SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION } from 'constants';
import { runInThisContext } from 'vm';

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
	skill(){
		if ( this.taskId && this.worker ) {
			const task = Tasks.findOne({ _id: this.taskId },{ fields: { skill: 1 } });
			const skill = Skills.findOne({ "$and": [{ owner: this.worker },{ name: task.skill }] },{ fields: { amount: 1 } });
			const amount = ( !skill || !skill.amount ? 0 : skill.amount );
			const level = itemLevel(amount, true);
			const width = (amount/level.next)*100;
			return "<div class='skill-text'><img class='icon' src='/assets/icons/"+task.skill.toLowerCase()+".png'/>"+task.skill+"<span class='amount'>"+numeral(amount).format('0,0.[00]a')+"/"+numeral(level.next).format('0,0.[00]a')+"</span></div><div class='skill'><div class='progress' style='width:"+width+"%;'></div></div>";
		};
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
	stall(){
		let inside = "", worker = "", flex = "";
		if ( this.worker ) {
			const find_worker = Workers.findOne({ _id: this.worker },{ fields: { avatar: 1 } });
			const player = Player.findOne({ _id: Meteor.userId() },{ fields: { avatar: 1 } });
			const pic = ( player && player.avatar ? player.avatar : 1 );
			const avatar = ( this.worker == Meteor.userId() ? "players/avatar-"+pic : "workers/person-"+find_worker.avatar );
			worker = "<div class='job-worker select_worker noselect'><div class='round-lg circle'><img src='/assets/"+avatar+".png'/></div></div>";
		};
		if ( this.taskId ) {
			const task = Tasks.findOne({ _id: this.taskId },{ fields: { items: 1 } });
			inside = "<img src='/assets/inv/"+task.items[0].replace(/\s+/g, '-').toLowerCase()+".png'/>";
		} else if ( this.worker ) {
			inside = "<div class='warn round-sm flex'>Choose Task</div>";
		} else {
			flex = "flex";
			inside = "<div class='open'>Open Stall</div>";
		};
		return worker+"<div class='job-task noselect select_stall "+flex+"'>"+inside+"</div>";
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

Template.battle.helpers({
	battles(){
		return Battles.find({ completed: { $exists: false } },{ sort: { 'logs.$.created': 1 } });
	},
	logs(){
		return _.sortBy(this.logs, function(log){ return -log.created; });
	},
	message(){
		const type = ( this.opponent ? "opponent" : "ally" );
		const dead = ( this.dead ? ", killing it" : "" );
		const message = ( !this.miss ? " doing "+(this.damage-(this.damage*this.armor))+"("+(this.damage*this.armor)+")"+" damage"+dead+"." : "." );
		return "<div class='log "+type+"'>"+this.fighter+" "+this.action+" "+this.target+message+"</div>";
	},
	ally_avatar(){
		const player = Player.findOne({ _id: this._id },{ fields: { avatar: 1 } });
		return "<img class='avatar round-lg' src='/assets/players/avatar-"+player.avatar+".png'/>"
	},
	opponent_avatar(){
		const image = this.name.replace(/\s+/g, '-').toLowerCase()+"-"+this.level;
		return "<img class='avatar round-lg' src='/assets/mobs/"+image+".png'/>"
	}
});

Template.town.onCreated(function () {
	this.taskSelect = new ReactiveVar( false );
	this.taskInfo = new ReactiveVar( false );
	this.stallSelect = new ReactiveVar( false );
	this.showAvatars = new ReactiveVar( false );
	this.showHiring = new ReactiveVar( false );
	this.storageToggle = new ReactiveVar( false );
	this.townBattle = new ReactiveVar( false );
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
	'click .start_battle'(e,t) {
		const toggle = t.townBattle.get();
		if ( toggle ) {
			t.townBattle.set(false);
			Meteor.call('startBattle', true);
		} else {
			t.townBattle.set(true);
			Meteor.call('startBattle');
		};	
	},
	'click .toggle_storage'(e,t) {
		const toggle = t.storageToggle.get();
		if ( toggle ) {
			t.storageToggle.set(false);
		} else {
			t.storageToggle.set(true);
		};
	},
	'click .prospects, click .employees, click .headline'(e,t) {
		e.stopPropagation();
	},
	'click .hiring'(e,t) {
		t.showHiring.set(false);
	},
	'click .show_hiring'(e,t) {
		t.showHiring.set(true);		
	},
	'click .heading'(e,t) {
		t.taskSelect.set(this.heading);
	},
	'click .select_avatar'(e,t) {
		e.stopPropagation();
		const show = t.showAvatars.get();
		const set = ( !show ? true : false );
		t.showAvatars.set(set);
	},
	'click .choose_avatar'(e,t) {
		Meteor.call('chooseAvatar', this.image);
	},
	'click .box'(e,t) {
		t.showAvatars.set(false);
	},
	'click .task .inner'(e, t) {
		e.stopPropagation();
	},
	'click .task .container'(e, t) {
		e.stopPropagation();
		t.taskInfo.set(false);
	},
	'click .start_task'(e, t) {
		if ( !this.waiting && !this.waitings ) {
			const stall = t.stallSelect.get();
			const user_skill = Skills.findOne({ "$and": [{ owner: this.worker },{ name: this.skill }] },{ fields: { level: 1 } });
			const skill_level = ( !user_skill || !user_skill.level ? 1 : user_skill.level );
			if ( skill_level >= this.level ) {
				Meteor.call('startTask', stall._id, this.worker, this._id);
				t.stallSelect.set(false);
				t.taskInfo.set(false);
			};
		};
	},
	'click .task'(e, t) {
		t.taskInfo.set(this._id);
	},
	'click .close_menu'(e, t) {
		t.stallSelect.set(false);
	},
	'click .select_worker'(e, t) {
		t.stallSelect.set({ _id: this.number, workers: true });
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
	showBattle(){
		return Template.instance().townBattle.get();	
	},
	toggled(){
		const toggle = Template.instance().storageToggle.get();
		if ( toggle )
		return "toggled";	
	},
	image(){
		return "<div class='avatar choose_avatar'><img src='/assets/players/avatar-"+this.image+".png'</div>";
	},
	avatars(){
		let avatars = [];
		for ( let i = 1; 60 >= i; i++ ) {
			avatars.push({ image: i });
		}
		return avatars;
	},
	showHiring(){
		return Template.instance().showHiring.get();
	},
	showAvatars(){
		return Template.instance().showAvatars.get();
	},
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
		visitingCityDep.depend();
		let selected = Template.instance().stallSelect.get();
		let taskSelect = Template.instance().taskSelect.get();
		let taskInfo = Template.instance().taskInfo.get();
		let stall = Stalls.findOne({ number: selected._id },{ fields: { worker: 1 } });
		if ( selected && selected.tasks && stall.worker ) {
			let worker = stall.worker, available_tasks = [], task_skills = [], skills = {}, nexts = {}, tasks = Tasks.find({},{ sort: { type: -1, skill: 1, level: 1 } }).fetch();
			const player = Player.findOne({ _id: Meteor.userId() },{ fields: { energy: 1 } });
			let find_skills = Skills.find({ owner: worker },{ fields: { name: 1, level: 1 } }).fetch();
			find_skills.forEach((skill) => {
				skills[skill.name] = skill.level;
			});
			tasks.forEach((task) => {
				if ( taskInfo == task._id )
				task.info = true;
				if ( task.requires ) {
					task.requires.forEach((req) => {
						const inv = Inventory.findOne({ "$and": [
							{ city: visitingCity },
							{ 'item.name.single': req.name },
							{ amount: { $gte: req.amount } }
						] });
						if ( !inv ) {
							if ( !task.waitings )
							task.waitings = [];
							task.waitings.push(req);
						};
					});
				};
				if ( ( taskSelect && taskSelect == task.skill ) || ( !taskSelect && task.skill == "Farming" ) )
					task.show = true;
				if ( !task_skills[task.skill] ) {
					task_skills[task.skill] = true;
					const task_push = ( task.show ? { heading: task.skill, selected: true } : { heading: task.skill } );
					available_tasks.push(task_push);
				};
				task.worker = worker;
				if ( task.level == 1 || ( skills[task.skill] && skills[task.skill] >= task.level ) ) {
					if ( task.energy && player.energy < task.energy ) {
						task.waiting = true;
						available_tasks.push(task);
					} else {
						available_tasks.push(task);
					};
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
		if ( stalls.length < 2 )
		for ( let n = stalls.length; 2 > n; n++ ) {
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

Template.player.helpers({
	avatar(){
		const player = Player.findOne({ _id: Meteor.userId() },{ fields: { avatar: 1 } });
		if ( player && player.avatar )
		return player.avatar;
	},
	username(){
		const player = Player.findOne({ _id: Meteor.userId() },{ fields: { username: 1 } });
		if ( player && player.username )
		return player.username;
	},
	energy(){
		const player = Player.findOne({ _id: Meteor.userId() },{ fields: { energy: 1, maxEnergy: 1 } });
		const energy = ( player && player.energy ? player.energy : 0 );
		const max = ( player && player.maxEnergy ? player.maxEnergy : 0 );
		const width = ( energy >= 1 ? Math.ceil((energy/max)*100) : 0 );
		return "<div class='bar' style='width:"+width+"%;'><div class='text'>"+energy+"/"+max+"</div></div>";
	}
});

Template.storage.onCreated(function () {
	this.showMenu = new ReactiveVar( false );
	this.showQuantity = new ReactiveVar( false );
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
	},
	'click .item'(e,t) {
		e.stopPropagation();
		t.showMenu.set(this._id);
	},
	'click .choices .inner'(e,t) {
		e.stopPropagation();
	},
	'click .choice'(e,t) {
		e.stopPropagation();
		t.showQuantity.set(this.call);
		Meteor.setTimeout(function() {
			document.getElementById("choiceQuantity").value = "";
			document.getElementById("choiceQuantity").focus();
		}, 50);
	},
	'click .choose'(e,t) {
		e.stopPropagation();
		const itemId = t.showMenu.get();
		if ( itemId ) {
			const inv = Inventory.findOne({ _id: itemId },{ fields: { amount: 1 } });
			let amount = document.getElementById("choiceQuantity").value;
			amount = ( amount && amount > 0 ? amount : 1 );
			if ( amount <= inv.amount ) {
				Meteor.call(t.showQuantity.get(), itemId, amount);
				t.showQuantity.set(false);
				t.showMenu.set(false);
			};
		};
	},
	'click .chooseMax'(e,t) {
		e.stopPropagation();
		const itemId = t.showMenu.get();
		if ( itemId ) {
			const inv = Inventory.findOne({ _id: itemId },{ fields: { amount: 1 } });
			if ( inv && inv.amount ) {
				Meteor.call(t.showQuantity.get(), itemId, inv.amount);
				t.showQuantity.set(false);
				t.showMenu.set(false);
			};
		};
	},
	'click .storage'(e,t) {
		t.showMenu.set(false);
		t.showQuantity.set(false);
	},
	'keyup input'(e,t) {
		if ( e.currentTarget.value <= 0 )
		e.currentTarget.value = 1;
	},
	'click input'(e,t) {
		e.currentTarget.value = "";
		e.currentTarget.focus();
	}
});

Template.storage.helpers({
	showQuantity(){
		if ( Template.instance().showQuantity.get() )
		return true;
	},
	hidden(){
		if ( Template.instance().showMenu.get() )
		return "hidden";
	},
	chosen(){
		const itemId = Template.instance().showMenu.get();
		if ( itemId ) {
			const inv = Inventory.findOne({ _id: itemId });
			const image =  "<div class='image'><img src='/assets/inv/"+inv.item.name.single.replace(/\s+/g, '-').toLowerCase()+".png'/></div>";
			const name =  "<div class='name'>"+inv.item.name.plural+"</div>";
			const amount = ( inv.amount ? "<div class='info amount'>x"+numeral(inv.amount).format('0,0.[00]a')+"</div>" : "" );
			const energy = ( inv.item.energy ? "<div class='info energy'>+"+inv.item.energy+"<span class='mdi mdi-flash'></span></div>" : "" );
			return image+"<div class='infos'>"+amount+energy+"</div>"+name;
		};
	},
	showMenu(){
		if ( Template.instance().showMenu.get() )
		return true;
	},
	menu(){
		const itemId = Template.instance().showMenu.get();
		if ( itemId ) {
			const inv = Inventory.findOne({ _id: itemId });
			let menu = [{ text: "Take", call: "takeInv" }];
			if ( inv.item.type == "Food" )
			menu.push({ text: "Eat", call: "eatFood" });
			return menu;
		};
	},
	choice(){
		return "<div class='choice "+this.call+"'>"+this.text+"</div>";
	},
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
		const sorts = Template.instance().storageSort.get();
		if ( filters.length == 0 )
		filters = [{}];
		if ( visitingCity )
		return Inventory.find({ "$and": [
			{ city: visitingCity },
			{ "$or": filters }
		] },{ sort: sorts });
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
	numbers(){
		const amount = ( this.amount ? numeral(this.amount/itemLevel(this.amount,true).next).format('.00') : "" );
		return this.level+amount;
	},
	icon(){
		return "<img class='icon' src='/assets/icons/"+this.name.toLowerCase()+".png'/>";
	},
	showTitle(){
		if ( this.title )
		return true;
	}
});

Template.skillLevel.helpers({
	icon(){
		return "<img class='icon' src='/assets/icons/"+this.name.toLowerCase()+".png'/>";
	}
});

Template.item.helpers({
	img(){
		let img = this.item.name.single.replace(/\s+/g, '-').toLowerCase();
		return "<img class='round-sm' src='/assets/inv/"+img+".png'/>";
	}
});

Template.req.onCreated(function () {
	this.showBubble = new ReactiveVar( false );
});

Template.req.events({
	'click .req'(e,t) {
		t.showBubble.set(true);
		Meteor.setTimeout(function() {
			t.showBubble.set(false);
		}, 1000);
	}
});

Template.req.helpers({
	req(){
		const img = this.name.replace(/\s+/g, '-').toLowerCase();
		const bubble = ( Template.instance().showBubble.get() ? "<div class='bubble'><span class='round-sm'>"+this.name+"</span></div>" : "" );
		return "<div class='req'>"+bubble+"<img class='mat' src='/assets/inv/"+img+".png'/><span>"+this.amount+"</span></div>";
	}
});

Template.task.helpers({
	energy(){
		if ( this.energy )
		return "<div class='energy'><span class='mdi mdi-flash'></span>"+this.energy+"</div>"
	},
	waitings(){
		if ( this.waiting || this.waitings )
		return "waiting";
	},
	showMore(){
		return this.info;
	},
	selected(){
		if ( this.selected )
		return "selected";
	},
	accent(){
		const selected = ( this.selected ? "<span class='mdi mdi-minus'></span>" : "<span class='mdi mdi-plus'></span>" );
		return selected;
	},
	showHeading(){
		if ( this.heading )
		return true;
	},
	name(){
		return this.task;
	},
	needed(){
		if ( this.next )
		return "<div class='needed flex'>LVL "+this.level+"</div>";
	},
	next(){
		if ( this.waiting && this.show ) {
			return "waiting show";
		} else if ( this.waiting ) {
			return "waiting";
		} else if ( this.next && this.show ) {
			return "next show";
		} else if ( this.next ) {
			return "next";
		} else if ( this.show ) {
			return "show";
		};
	},
	item(){
		let img = this.items[0].replace(/\s+/g, '-').toLowerCase();
		let task_img = this.skill.replace(/\s+/g, '-').toLowerCase();
		return "<img class='image' src='/assets/inv/"+img+".png'/><img class='icon' src='/assets/icons/"+task_img+".png'/>";
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
		return Prospects.find({ owner: { $exists: false } },{ sort: { skillCount: -1 } });
	}
});

Template.hiring.events({
	'click .employee'(e,t) {
		t.selectEmployee.set(this._id);
	}
});

Template.worker.events({
	'click .worker'() {
		Meteor.call('hireWorker',this._id);
	},
	'click .task'() {
		const user_skill = Skills.findOne({ "$and": [{ owner: this._id },{ name: this.skill }] },{ fields: { level: 1 } });
		const skill_level = ( !user_skill || !user_skill.level ? 1 : user_skill.level );
		if ( skill_level >= this.level )
		Meteor.call('startTask',this._id,this.workerId);
	}
});

Template.worker.helpers({
	name() {
		if ( !this.name ) {
			const player = Player.findOne({ _id: Meteor.userId() },{ fields: { username: 1 } });
			if ( player && player.username )
			return player.username;
		} else {
			return this.name;
		};
	},
	avatar() {
		const player = Player.findOne({ _id: Meteor.userId() },{ fields: { avatar: 1 } });
		const pic = ( player && player.avatar ? player.avatar : 1 );
		const avatar = ( !this.avatar ? "players/avatar-"+pic : "workers/person-"+this.avatar );
		return "<img class='avatar round-lg' src='/assets/"+avatar+".png'/>"
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
