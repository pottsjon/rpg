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
    queueInt[queue._id] = Meteor.setInterval(function() {
        awardQueue(queue,1)
    }, 1000*queue.length);
};

awardQueue = function (queue,rolls) {
    let roll_total = 0;
    for ( i = 0; rolls > i; i++ ) {
        let roll_amount = Math.floor(Math.random()*5-(-1));
        roll_total = roll_total-(-roll_amount);
    }
    Inventory.update({ "$and": [
        { owner: queue.owner },
        { item: queue.task.item }
    ]},{
        $inc: {
            amount: roll_total
        }
    },{ upsert: true });
    let inc_exp = {};
    const skill_name = 'skills'+queue.task.skill.toLowerCase()+'exp';
    inc_exp[skill_name] = roll_total*10;
    Meteor.users.update({ _id: queue.owner },{ $inc: inc_exp });
};

awardQueues = function () {
    const queues = Queues.find({ "$and": [
        { started: { $exists: true } },
        { completed: { $exists: false } }
    ]}).fetch();
    queues.forEach((queue) => {
        try { Meteor.clearInterval(queueInt[queue._id]) } catch (e) { };
        const time_now = (new Date()).getTime();
        const time_lapsed = Math.floor(time_now-queue.started);
        const queue_length = queue.length*1000;
        const rolls = time_lapsed/queue_length;
        const timeout_length = queue_length-(time_lapsed-(queue_length*rolls));
        Meteor.setTimeout(function() {
            awardQueue(queue,1)
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
		});
	});
};

checkTasks = function () {
	if ( !Tasks.findOne({}) ) {
        const data = [
			{
				skill: "Farming",
				task: "Farm",
				item: "Potato",
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
		];
        data.forEach((job) => {
			Tasks.insert(job);
		});
	};
};