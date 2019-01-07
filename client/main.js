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

/*
windowSize = function () {
	const width = document.getElementById("map").offsetWidth;
	const top = document.getElementById("top").offsetHeight;
	const height = $(window).height()-top;
	return { width: width, height: height };
};

var myGamePiece;
var otherPiece;
var myObstacles = [];
var myLoc;
var myAngle;
var getAngle = false;

function startGame() {
	myGamePiece = new component(15, 15, "red", 100, 100);
	otherPiece = new component(40, 40, "green", 150, 150);
    myLoc = new component("14px", "Consolas", "black", 20, 20, "text");
	myLoc.text = "X: 100 Y: 100";
    myAngle = new component("16px", "Consolas", "black", 20, 40, "text");
	myGameArea.start();
}

function stopGame() {
	myGameArea.clear();
}

var myGameArea = {
	canvas : document.createElement("canvas"),
	start : function() {
		this.canvas.width = 6000;
		this.canvas.height = 6000;
		this.context = this.canvas.getContext("2d");
		var element = document.getElementById("map");
		element.appendChild(this.canvas);
		otherPiece.newPos();
		otherPiece.update();
		myGamePiece.newPos();
		myGamePiece.update();
		myLoc.update();
		},
	clear : function() {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}
}

function component(width, height, color, x, y, type) {
	this.type = type;
	this.width = width;
	this.height = height;
	this.speedX = 0;
	this.speedY = 0;    
	this.x = x;
	this.y = y;
	this.gravity = 0;
	this.gravitySpeed = 0;
	this.interval = Meteor.setInterval(updateGameArea, 20);
	this.update = function() {
		ctx = myGameArea.context;
		if (this.type == "text") {
			ctx.font = this.width + " " + this.height;
			ctx.fillStyle = color;
			ctx.fillText(this.text, this.x, this.y);
		} else {
			ctx.beginPath()
			ctx.arc(this.x, this.y, this.width, 0, 2 * Math.PI, false);
			ctx.fillStyle = color;
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#333333';
			ctx.stroke();
		}
	}
	this.newPos = function() {
		this.x += this.speedX;
		this.y += this.speedY; 
	}
	this.hitBottom = function() {
		var rockbottom = myGameArea.canvas.height - this.height;
		if (this.y > rockbottom) {
			this.y = rockbottom;
			this.gravitySpeed = 0;
		}
	}
	this.crashWith = function(otherobj) {
		var myleft = this.x;
		var myright = this.x + (this.width);
		var mytop = this.y;
		var mybottom = this.y + (this.height);
		var otherleft = otherobj.x;
		var otherright = otherobj.x + (otherobj.width);
		var othertop = otherobj.y;
		var otherbottom = otherobj.y + (otherobj.height);
		var crash = true;
		if ((mybottom < othertop) || (mytop > otherbottom) || (myright < otherleft) || (myleft > otherright)) {
			crash = false;
		}
		return crash;
	}
}

function updateGameArea() {
	myGameArea.clear();
	myAngle.text = "Angle: " + getAngle;
	if ( getAngle )
	myAngle.update();
	myLoc.text = "X: "+myGamePiece.x+" Y: "+myGamePiece.y;
	myLoc.update();
	otherPiece.newPos();
	otherPiece.update();
	myGamePiece.newPos();
	myGamePiece.update();
}

function everyinterval(n) {
	if ((myGameArea.frameNo / n) % 1 == 0) {return true;}
	return false;
}

function accelerate(n) {
	myGamePiece.gravity = n;
}

function angle(cx, cy, ex, ey) {
	var dy = ey - cy;
	var dx = ex - cx;
	var theta = Math.atan2(dy, dx); // range (-PI, PI]
	theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
	//if (theta < 0) theta = 360 + theta; // range [0, 360)
	return theta;
}

Template.traveling.onRendered(function () {
	Tracker.autorun(function() {
	  $(window).resize(function() {
	  });
	});
	startGame();
});

Template.traveling.events({
	'mousemove canvas'(e) {
		getAngle = numeral(angle(myGamePiece.x,myGamePiece.y,e.offsetX,e.offsetY)).format('0');
	},
	'click canvas'(e) {
		myGamePiece.speedX += 1;	
		myGamePiece.speedY += 1;
	},
	'click .stop'() {
		stopGame();
	},
	'mousedown .accelerate'() {
		accelerate(-0.2);
	},
	'mouseup .accelerate'() {
		accelerate(0.5);
	}
});
*/

Template.gathering.helpers({
	logs(){
		return sysMsgs.find({},{ sort: { updatedAt: -1 }, limit: 200 });
	},
	skills(){
		return Skills.find({ owner: Meteor.userId() },{ sort: { amount: -1 } });
	},
	inventory(){
		return Inventory.find({},{ sort: { amount: -1 } });
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
	tasks(){
		return Tasks.find();
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

Template.hiring.onCreated(function () {
	this.selectEmployee = new ReactiveVar( false );
});

Template.hiring.helpers({
	logs(){
		return sysMsgs.find({},{ sort: { updatedAt: -1 }, limit: 200 });
	},
	employees() {
		return Employees.find({ owner: Meteor.userId() },{
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
		return Workers.find({ owner: { $exists: false } });
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

Template.worker.events({
	'click .worker'() {
		Meteor.call('hireWorker',this._id);
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
