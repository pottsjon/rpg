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
    let queue_awards = [];
    queue.task.items.forEach((item) => {
        let item_data = Items.findOne({ name: item },{ fields: { name: 1, roll: 1 } });
        queue_awards.push(item_data);
    });
    queue.awards = queue_awards;
    queueInt[queue.owner+queue.worker] = Meteor.setInterval(function() {
        awardQueue(queue)
    }, 1000*queue.length);
};

invUpdate = function (owner,item,amount,queued) {
    let inc_amount = { amount: amount };
    if ( queued ) {
        inc_amount["runs"] = 1;
        inc_amount["total"] = amount;
    };
    Inventory.update({ "$and": [
        { owner: owner },
        { item: item }
    ]},{
        $inc: inc_amount
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
                invUpdate(queue.owner,award_items[choose_item],roll_amount,true);
            } else {
                let adjust_roll = ( roll-100 > 599 ) ? roll-100 : 0;
                awardItems(adjust_roll);
            };
        };
        awardItems(item_roll);
    } else {
        invUpdate(queue.owner,queue.task.items[0],roll_amount,true);
    }
    const update_amount = skill_amount-(-roll_amount*10);
    const update_level = itemLevel(update_amount);
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
}

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
        const elapsed = Math.floor(time_lapsed/queue_length);
        const timeout_length = queue_length-(time_lapsed-(queue_length*elapsed));
        let queue_awards = [];
        queue.task.items.forEach((item) => {
            let item_data = Items.findOne({ name: item },{ fields: { name: 1, roll: 1 } });
            queue_awards.push(item_data);
        });
        queue.awards = queue_awards;
        Meteor.setTimeout(function() {
            awardQueue(queue)
            startQueue(queue);
        }, timeout_length);
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
		for ( i = 1; 1000 >= i; i++ ) {
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