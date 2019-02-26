workforceEvaluate = function () {
    const workforceCount = Workers.find({ owner: { $exists: false } },{ limit: 20 }).count();
    if ( workforceCount < 20 )
    workforceAdd(20-workforceCount);
};

workforceAdd = function (count) {
    let time_now = (new Date()).getTime();
    let names = [];
	for ( let i = 1; count >= i; i++ ) {
        names.push(Fake.user().fullname);
    }
    names.forEach((name) => {
        Workers.insert({
            name: name,
            created: time_now
        });
    });
};

startingCity = function (userId) {
	const city_list = Cities.find({}).fetch();
	const choice = Math.floor(Math.random()*(city_list.length-1));
    const city = city_list[choice];
    city.visiting = true;
    Positions.insert({
        owner: userId,
        x: city.x,
        y: city.y,
        city: city
    });
};

nextCity = function (position) {
    let hitting_cities = findHitCities(position),
    lowest = Number.POSITIVE_INFINITY,
    tmp,
    found_city;
    if ( hitting_cities )
        for ( let i = hitting_cities.length-1; i >= 0 ; i-- ) {
            tmp = hitting_cities[i].distance;
            if ( tmp < lowest ) {
                lowest = tmp;
                found_city = hitting_cities[i];
            };
        }
    return found_city;
};

stopNext = function () {
    Positions.find({ "$and": [
        { city: { $exists: true } },
        { visit: true }
    ] },{ fields: {
        owner: 1,
        city: 1
    } }).observe({
        added: function(position) {
            cityTimerStop(position.owner);
            position.city.visiting = true;
            delete position.city.time;
            delete position.city.distance;
            delete position.city.started;
            Meteor.call('stopMovement', position.owner, position.city);
        }
    });
};

let cityTimers = [];
cityTimerStart = function (position) {
    try { Meteor.clearTimeout(cityTimers[position.owner]) } catch(e) {};
    let city = nextCity(position);
    if ( city ) {
        cityTimers[position.owner] = Meteor.setTimeout(function() {
            const time_now = (new Date()).getTime();
            const find_pos = realPosition(position,position,time_now,time_now);
            position.x = find_pos.x;
            position.y = find_pos.y;
            position.started = time_now;
            Positions.update({ "$and": [
                { owner: position.owner },
                { angle: { $exists: true } }
            ] },{
                $set: {
                    x: find_pos.x,
                    y: find_pos.y,
                    started: time_now,
                    city: city
                }
            });
            cityTimerStart(position);
        }, city.time*1000);
    };
};

positionTracker = function () {
    const time_now = (new Date()).getTime();
    Positions.find({ started: { $exists: true } }).fetch().forEach((position) => {
        const find_pos = realPosition(position,position,time_now,time_now);
        position.x = find_pos.x;
        position.y = find_pos.y;
        cityTimerStart(position);
    });
};

let tradeTimers = [];
tradeTracker = function () {
    cityTrade = function (data) {
        try { Meteor.clearTimeout(tradeTimers[data.owner]) } catch(e) { };
        let counter = 0;
        cityTradeStart = function (data) {
            tradeTimers[data.owner] = Meteor.setTimeout(function(){
                counter++
                const time_now = (new Date()).getTime();
                const find_pos = realPosition(data,data,time_now,time_now);
                const inside = inCircle(find_pos, { x: data.city.x, y: data.city.y }, data.city.radius);
                if ( counter == 10 ) {
                    cityTrade(data);
                } else if ( inside ) {
                    cityTradeStart(data);
                } else if ( !inside ) {
                    Positions.update({ "$and": [
                        { _id: data._id },
                        { angle: { $exists: true } }
                    ] },{
                        $unset: {
                            city: ""
                        }
                    });
                };
            }, 500);
        };
        cityTradeStart(data);
    };
    Positions.find({ "$and": [
        { city: { $exists: true } },
        { started: { $exists: true } }
    ] }).observe({
        added: function(data) {
            cityTrade(data);
        },
        changed: function(data) {
            try { Meteor.clearTimeout(tradeTimers[data.owner]) } catch(e) { };
            cityTrade(data);
        }
    });
};

cityTimerStop = function (owner) {
    try { Meteor.clearTimeout(cityTimers[owner]) } catch(e) { };
    try { Meteor.clearTimeout(tradeTimers[owner]) } catch(e) { };
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
        let item_data = Items.findOne({ 'name.single': item },{ fields: { name: 1, roll: 1 } });
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
}

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
                award_items.push(item.name.single);
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
    let skill_set = {
        amount: update_amount,
        level: update_level
    };
    if ( queue.worker != queue.owner )
    skill_set["boss"] = queue.owner;
    Skills.update({ "$and": [
        { owner: queue.worker },
        { name: queue.task.skill }
    ]},{
        $set: skill_set
    },{ upsert: true },
    function(err, count) {
    });
    if ( queue.skill.level != update_level )
    initQueue(queue);
};

awardQueues = function () {
    const queues = Queues.find({ "$and": [
        { started: { $exists: true } },
        { completed: { $exists: false } }
    ]}).fetch();
    queues.forEach((queue) => {
        initQueue(queue);
    });
    clearQueues();
    let clearingQueues = Meteor.setInterval(function() {
        clearQueues();
    }, 1000*60*60);
};

clearQueues = function () {
    const time_now = (new Date()).getTime();
	const users_away = Meteor.users.find({ "$and": [
		{ 'status.logout': { $lte: new Date(time_now-(1000*60*60*4)) } },
		{ 'status.online': false }
	]});
	users_away.forEach((user) => {
		const find_queues = Queues.find({ "$and": [
            { owner: user._id },
			{ completed: { $exists: false } }
		]},{ fields: { owner: 1, worker: 1 } }).fetch();
		Queues.update({ "$and": [
            { owner: user._id },
			{ completed: { $exists: false } }
		]},{
			$set: {
				completed: time_now
            }
        },{
            multi: true
        },
        function(err, count) {
        });
        find_queues.forEach((queue) => {
            try { Meteor.clearInterval(queueInt[queue.owner+queue.worker]) } catch (e) { };
            try { Meteor.clearTimeout(queueTimeout[queue.owner+queue.worker]) } catch (e) { };
        });
	});
};

checkCities = function () {
	if ( !Cities.findOne({}) ) {
        let data = [];
        /*
        // evenly spaced cities
        for ( let i = 200; map_size.height-200 >= i; i+=400 ) {
            for ( let o = 200; map_size.width-200 >= o; o+=400 ) {
                data.push({
                    x: o,
                    y: i,
                    radius: 100,
                    fill: 'red',
                    name: Fake.user().surname
                });
            }
        }
        */
        for ( let i = 200; map_size.height-200 >= i; i+=500 ) {
            for ( let o = 200; map_size.width-200 >= o; o+=500 ) {
                const chance = Math.floor(Math.random()*100-1);
                if ( chance > 15 ) {
                    const radius = Math.floor(Math.random()*50)+50;
                    const offset_o = Math.floor(Math.random()*150+50);
                    const offset_i = Math.floor(Math.random()*150+50);
                    data.push({
                        x: o+offset_o,
                        y: i+offset_i,
                        radius: radius*1,
                        name: Fake.user().surname
                    });
                };
            }
        }
        data.forEach((city) => {
			Cities.insert(city);
        });
    };
    /*
    // used during city creation process to determine if any cities were touching with a little extra bias
    const find_cities = Cities.find({});
    let found_cities = [];
    find_cities.forEach((city) => {
        let cities = Cities.findOne({ "$and": [
            { name: { $ne: city.name } },
            { "$and": [
                { "$and": [
                    { x: { $gte: city.x-(city.radius*2) } },
                    { x: { $lte: city.x+(city.radius*2) } },
                ] },
                { "$and": [
                    { y: { $gte: city.y-(city.radius*2) } },
                    { y: { $lte: city.y+(city.radius*2) } }
                ] },
            ] },
        ] });
        if ( cities )
        found_cities.push(city);
    });
    console.log(found_cities)
    console.log(found_cities.length)
    */
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
                items: ["Bronze Ore", "Yellow Gem", "Green Gem", "Blue Gem", "Red Gem"]
			},
			{
				skill: "Mining",
				task: "Mine Copper",
                exp: 100,
                items: ["Copper Ore", "Green Gem"]
			},
			{
				skill: "Mining",
				task: "Mine Silver",
                exp: 1000,
                items: ["Silver Ore", "Blue Gem"]
			},
			{
				skill: "Logging",
                task: "Chop Beech",
                exp: 0,
                items: ["Beech Log"]
			},
			{
				skill: "Logging",
				task: "Chop Ash",
                exp: 100,
                items: ["Ash Log"]
			},
			{
				skill: "Logging",
				task: "Chop Oak",
                exp: 1000,
                items: ["Oak Log"]
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
                name: { single: "Potato" , plural: "Potatoes" },
                roll: 0,
                level: 1
            },
            {
                skill: "Farming",
                type: "Food",
                rarity: 'Common',
                name: { single: "Apple" , plural: "Apples" },
                roll: 0,
                level: 2
            },
            {
                skill: "Farming",
                type: "Food",
                rarity: 'Common',
                name: { single: "Orange" , plural: "Oranges" },
                roll: 0,
                level: 3
            },
            {
                skill: "Mining",
                type: "Metal",
                rarity: 'Common',
                name: { single: "Bronze Ore" , plural: "Bronze Ore" },
                roll: 0,
                level: 1
            },
            {
                skill: "Mining",
                type: "Metal",
                rarity: 'Common',
                name: { single: "Copper Ore" , plural: "Copper Ore" },
                roll: 0,
                level: 2
            },
            {
                skill: "Mining",
                type: "Metal",
                rarity: 'Common',
                name: { single: "Silver Ore" , plural: "Silver Ore" },
                roll: 0,
                level: 3
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Uncommon',
                name: { single: "Yellow Gem" , plural: "Yellow Gems" },
                roll: 650,
                level: 1
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Rare',
                name: { single: "Green Gem" , plural: "Green Gems" },
                roll: 750,
                level: 2
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Epic',
                name: { single: "Blue Gem" , plural: "Blue Gems" },
                roll: 850,
                level: 3
            },
            {
                skill: "Mining",
                type: "Material",
                rarity: 'Legendary',
                name: { single: "Red Gem" , plural: "Red Gems" },
                roll: 950,
                level: 3
            },
            {
                skill: "Logging",
                type: "Wood",
                rarity: 'Common',
                name: { single: "Beech Log" , plural: "Beech Logs" },
                roll: 0,
                level: 1
            },
            {
                skill: "Logging",
                type: "Wood",
                rarity: 'Common',
                name: { single: "Ash Log" , plural: "Ash Logs" },
                roll: 0,
                level: 2
            },
            {
                skill: "Logging",
                type: "Wood",
                rarity: 'Common',
                name: { single: "Oak Log" , plural: "Oak Logs" },
                roll: 0,
                level: 3
            }
        ];
        data.forEach((item) => {
            Items.insert(item);
        });
    };
};