workforceEvaluate = function () {
    const workforceCount = Workers.find({ owner: { $exists: false } },{ limit: 10 }).count();
    if ( workforceCount < 10 )
    workforceAdd();
};

workforceAdd = function () {
    Workers.insert({
        name: Fake.user().fullname,
    })
};

var queueInt = [];
startQueue = function (queue) {
    try { Meteor.clearInterval(queueInt[queue.owner+queue.worker]) } catch (e) { };
    queueInt[queue.owner+queue.worker] = Meteor.setInterval(function() {
        awardQueue(queue)
    }, 1000*queue.length);
};

invUpdate = function (owner,item,roll) {
    Inventory.update({ "$and": [
        { owner: owner },
        { item: item }
    ]},{
        $inc: {
            amount: roll
        }
    },{ upsert: true },
    function(err, count) {
    });
};

awardQueue = function (queue) {
    const skill_update = Skills.findOne({ "$and": [
        { owner: queue.owner },
        { name: queue.task.skill }
    ]},{ fields: { amount: 1, level: 1 } });
    const skill_amount = ( !skill_update || !skill_update.amount ? 0 : skill_update.amount );
    const skill_level = ( !skill_update || !skill_update.level ? 1 : skill_update.level );
    const roll_amount = Math.floor(Math.random()*(1-(-skill_level))-(-1));
    const update_amount = skill_amount-(-roll_amount*10);
    const update_level = itemLevel(update_amount);
    invUpdate(queue.owner,queue.task.item,roll_amount);
    Skills.update({ "$and": [
        { owner: queue.owner },
        { name: queue.task.skill }
    ]},{
        $set: {
            amount: update_amount,
            level: update_level
        }
    },{ upsert: true },
    function(err, count) {
    });
};

awardQueues = function () {
    const queues = Queues.find({ "$and": [
        { started: { $exists: true } },
        { completed: { $exists: false } }
    ]}).fetch();
    queues.forEach((queue) => {
        try { Meteor.clearInterval(queueInt[queue.owner+queue.worker]) } catch (e) { };
        const time_now = (new Date()).getTime();
        const time_lapsed = time_now-queue.started;
        const queue_length = queue.length*1000;
        const rolls = Math.floor(time_lapsed/queue_length);
        const timeout_length = queue_length-(time_lapsed-(queue_length*rolls));
        Meteor.setTimeout(function() {
            awardQueue(queue)
            startQueue(queue);
        }, timeout_length);
    });
    clearQueues();
};

clearQueues = function () {
	const time_now = (new Date()).getTime();
	const users_away = Meteor.users.find({ "$and": [
		{ 'status.lastLogin.date': { $lte: new Date(time_now-(1000*60*60*24)) } },
		{ 'status.online': false }
	]},{ sort: { 'status.lastLogin.date': 1 } });

	users_away.forEach((user) => {
		Queues.update({ "$and": [
			{ owner: user._id },
			{ completed: { $exists: false } }
		]},{
			$set: {
				completed: time_now
			}
		},
        function(err, count) {
        });
	});
};

checkTasks = function () {
	if ( !Tasks.findOne({}) ) {
        const data = [
			{
				skill: "Farming",
				task: "Farm",
				item: { name: "Potato", skill: "Farming", type: "Food", exp: 0 }
			},
			{
				skill: "Farming",
				task: "Farm",
				item: { name: "Apple", skill: "Farming", type: "Food", exp: 100 }
			},
			{
				skill: "Farming",
				task: "Farm",
				item: { name: "Orange", skill: "Farming", type: "Food", exp: 1000 }
			},
			{
				skill: "Mining",
				task: "Mine",
				item: { name: "Bronze", skill: "Mining", type: "Metal", exp: 0 }
			},
			{
				skill: "Mining",
				task: "Mine",
				item: { name: "Copper", skill: "Mining", type: "Metal", exp: 100 }
			},
			{
				skill: "Mining",
				task: "Mine",
				item: { name: "Silver", skill: "Mining", type: "Metal", exp: 1000 }
			},
			{
				skill: "Logging",
				task: "Chop",
				item: { name: "Beech", skill: "Logging", type: "Wood", exp: 0 }
			},
			{
				skill: "Logging",
				task: "Chop",
				item: { name: "Ash", skill: "Logging", type: "Wood", exp: 100 }
			},
			{
				skill: "Logging",
				task: "Chop",
				item: { name: "Oak", skill: "Logging", type: "Wood", exp: 1000 }
			}
		];
        data.forEach((job) => {
			Tasks.insert(job);
		});
	};
};