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

var queueSkill = [];
var queueInt = [];
var queueTimeout = [];
startQueue = function (queue) {
    try { Meteor.clearInterval(queueInt[queue.owner+queue.worker]) } catch (e) { };
    queueInt[queue.owner+queue.worker] = Meteor.setInterval(function() {
        awardQueue(queue)
    }, 1000*queue.length);
};

initQueue = function (queue) {
    try { Meteor.clearInterval(queueInt[queue.owner+queue.worker]) } catch (e) { };
    try { Meteor.clearTimeout(queueTimeout[queue.owner+queue.worker]) } catch (e) { };
    let queue_awards = [];
	const task = Tasks.findOne({ _id: queue.taskId },{ fields: { exp: 0 } });
    queue.task = task;
    task.items.forEach((item) => {
        let item_data = Items.findOne({ name: item },{ fields: { name: 1, roll: 1 } });
        queue_awards.push(item_data);
    });
    queue.awards = queue_awards;
    const skill = Skills.findOne({ "$and": [
        { owner: queue.worker },
        { name: task.skill }
    ]},{ fields: { amount: 1, level: 1 } });
    queue.skill = ( !skill ? { amount: 0, level: 1 } : skill );
    queueSkill[queue.worker] = ( !skill ? 0 : skill.amount );
    const time_lapsed = (new Date()).getTime()-queue.started;
    const queue_length = queue.length*1000;
    const elapsed_count = Math.floor(time_lapsed/queue_length);
    if ( elapsed_count >= 1 ) {
        const timeout_length = queue_length-(time_lapsed-(queue_length*elapsed_count));
        queueTimeout[queue.owner+queue.worker] = Meteor.setTimeout(function() {
            awardQueue(queue);
            initQueue(queue);
        }, timeout_length);
    } else {
        startQueue(queue);
    };
};

invUpdate = function (owner,item,amount,updater,skill,queued) {
    // queued updates are from new items you create
    let inc_amount = { amount: amount };
    if ( queued ) {
        inc_amount["runs"] = 1;
        inc_amount["total"] = amount;
    };
    Inventory.update({ "$and": [
        { owner: owner },
        { item: item }
    ]},{
        $set: {
            updatedAt: (new Date()).getTime(),
            updatedBy: updater,
            updatedHow: skill
        },
        $inc: inc_amount
    },{ upsert: true },
    function(err, count) {
    });
};

awardQueue = function (queue) {
    let worker_skill = queueSkill[queue.worker];
    const roll_amount = Math.floor(Math.random()*(1-(-queue.skill.level))-(-1));
    if ( queue.task.items.length > 1 ) {
        let award_items = [];
        let item_roll = Math.floor(Math.random()*1000+1);
        item_roll = ( item_roll > 599 ? item_roll : 0 );
        awardItems = function (roll) {
            queue.awards.forEach((item) => {
                if ( roll >= item.roll && roll-100 <= item.roll )
                award_items.push(item.name);
            });
            if ( award_items.length >= 1 ) {                
                const choose_item = Math.floor(Math.random()*(award_items.length));
                invUpdate(queue.owner,award_items[choose_item],roll_amount,queue.worker,queue.task.skill,true);
            } else {
                let adjust_roll = ( roll-100 > 599 ) ? roll-100 : 0;
                awardItems(adjust_roll);
            };
        };
        awardItems(item_roll);
    } else {
        invUpdate(queue.owner,queue.task.items[0],roll_amount,queue.worker,queue.task.skill,true);
    }
    const update_amount = worker_skill-(-roll_amount*10);
    const update_level = itemLevel(update_amount);
    queueSkill[queue.worker] = update_amount;
    Skills.update({ "$and": [
        { owner: queue.worker },
        { name: queue.task.skill }
    ]},{
        $set: {
            amount: update_amount,
            level: update_level
        }
    },{ upsert: true },
    function(err, count) {
    });
    if ( queue.skill.level != update_level )
    initQueue(queue);
}

awardQueues = function () {
    const queues = Queues.find({ "$and": [
        { started: { $exists: true } },
        { completed: { $exists: false } }
    ]}).fetch();
    queues.forEach((queue) => {
        initQueue(queue);
    });
    // clearQueues();
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
            try { Meteor.clearInterval(queueInt[user._id+user._id]) } catch (e) { };
            try { Meteor.clearTimeout(queueTimeout[user._id+user._id]) } catch (e) { };
        });
	});
};

checkTasks = function () {
	if ( !Tasks.findOne({}) ) {
        const data = [
			{
				skill: "Farming",
                task: "Farm Potato",
                exp: 0,
                items: ["Potato"]
			},
			{
				skill: "Farming",
                task: "Farm Apple",
                exp: 100,
                items: ["Apple"]
			},
			{
				skill: "Farming",
                task: "Farm Orange",
                exp: 1000,
                items: ["Orange"]
			},
			{
				skill: "Mining",
                task: "Mine Bronze",
                exp: 0,
                items: ["Bronze", "Yellow Gem", "Green Gem", "Blue Gem", "Red Gem"]
			},
			{
				skill: "Mining",
				task: "Mine Copper",
                exp: 100,
                items: ["Copper", "Green Gem"]
			},
			{
				skill: "Mining",
				task: "Mine Silver",
                exp: 1000,
                items: ["Silver", "Blue Gem"]
			},
			{
				skill: "Logging",
                task: "Chop Beech",
                exp: 0,
                items: ["Beech"]
			},
			{
				skill: "Logging",
				task: "Chop Ash",
                exp: 100,
                items: ["Ash"]
			},
			{
				skill: "Logging",
				task: "Chop Oak",
                exp: 1000,
                items: ["Oak"]
			}
		];
        data.forEach((job) => {
			Tasks.insert(job);
		});
	};
};

checkItems = function () {
	if ( !Items.findOne({}) ) {
        const data = [
            {
                skill: "Farming",
                type: "Food",
                rarity: 'Common',
                name: "Potato",
                roll: 0,
                level: 1
            },
            {
                skill: "Farming",
                type: "Food",
                rarity: 'Common',
                name: "Apple",
                roll: 0,
                level: 2
            },
            {
                skill: "Farming",
                type: "Food",
                rarity: 'Common',
                name: "Orange",
                roll: 0,
                level: 3
            },
            {
                skill: "Mining",
                type: "Metal",
                rarity: 'Common',
                name: "Bronze",
                roll: 0,
                level: 1
            },
            {
                skill: "Mining",
                type: "Metal",
                rarity: 'Common',
                name: "Copper",
                roll: 0,
                level: 2
            },
            {
                skill: "Mining",
                type: "Metal",
                rarity: 'Common',
                name: "Silver",
                roll: 0,
                level: 3
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Uncommon',
                name: "Yellow Gem",
                roll: 650,
                level: 1
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Rare',
                name: "Green Gem",
                roll: 750,
                level: 2
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Epic',
                name: "Blue Gem",
                roll: 850,
                level: 3
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Legendary',
                name: "Red Gem",
                roll: 950,
                level: 3
            },
            {
                skill: "Logging",
                type: "Wood",
                rarity: 'Common',
                name: "Beech",
                roll: 0,
                level: 1
            },
            {
                skill: "Logging",
                type: "Wood",
                rarity: 'Common',
                name: "Ash",
                roll: 0,
                level: 2
            },
            {
                skill: "Logging",
                type: "Wood",
                rarity: 'Common',
                name: "Oak",
                roll: 0,
                level: 3
            }
        ];
        data.forEach((item) => {
            Items.insert(item);
        });
		for ( let i = 1; 1000 >= i; i++ ) {
            Items.insert({
                skill: "Logging",
                type: "Wood",
                rarity: 'Common',
                name: Fake.user().fullname,
                roll: Math.floor(Math.random()*1000+1),
                level: 1
            });
        }
    };
};