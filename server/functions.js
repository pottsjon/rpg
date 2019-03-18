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
	const city_list = Cities.find({ type: "City" }).fetch();
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

var navSkill = [];
awardMovement = function (old_pos, new_pos) {
    const distance = Math.round(distanceOf([old_pos.x, old_pos.y], [new_pos.x, new_pos.y])/10);
    if ( distance >= 1 ) {
        if ( !navSkill[old_pos.owner] ) {
        const skill = Skills.findOne({ "$and": [
            { owner: old_pos.owner },
            { name: "Navigation" }
        ]},{ fields: { amount: 1, level: 1 } });
        navSkill[old_pos.owner] = ( !skill || !skill.amount ? 0 : skill.amount );
        };
        const update_amount = navSkill[old_pos.owner]-(-distance);
        navSkill[old_pos.owner] = update_amount;
        const update_level = itemLevel(update_amount);
        const skill_set = {
            amount: update_amount,
            level: update_level
        };
        Skills.update({ "$and": [
            { owner: old_pos.owner },
            { name: "Navigation" },
            { type: "Life" }
        ]},{
            $set: skill_set
        },{ upsert: true },
        function(err, count) {
        });
    };
};

nextCity = function (position) {
    let hitting_cities = findHitCities(position, position),
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
            const find_pos = realPosition(position);
            awardMovement(position,find_pos);
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
    Positions.find({ started: { $exists: true } }).fetch().forEach((position) => {
        const find_pos = realPosition(position);
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
                const find_pos = realPosition(data);
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

var queueInt = [];
var queueTimeout = [];
startQueue = function (queue) {
    try { Meteor.clearInterval(queueInt[queue.owner+queue.worker]) } catch (e) { };
    queueInt[queue.owner+queue.worker] = Meteor.setInterval(function() {
        queue = queueSkill(queue);
        queue = queueRoll(queue);
        awardQueue(queue)
    }, 1000*queue.length);
};

queueSkill = function (queue) {
    if ( !queue.skill ) {
        const skill = Skills.findOne({ "$and": [
            { owner: queue.worker },
            { name: queue.task.skill }
        ]},{ fields: { amount: 1, level: 1 } });
        queue.skill = ( !skill ? { amount: 0, level: 1 } : skill );
    };
    if ( queue.worker != queue.owner && !queue.manager ) {
        const manager_skill = Skills.findOne({ "$and": [
            { owner: queue.owner },
            { name: "Management" }
        ]},{ fields: { amount: 1, level: 1 } });
        queue.manager = ( !manager_skill ? { amount: 0, level: 1 } : manager_skill );
    };
    return queue;
};

queueRoll = function (queue) {
    queue.roll = Math.floor(Math.random()*(1-(-queue.skill.level))-(-1));
    const update_amount = queue.skill.amount-(-queue.roll*10);
    queue.skill = {
        amount: update_amount,
        level: itemLevel(update_amount)
    };
    if ( queue.worker != queue.owner ) {
        queue.skill.boss = queue.owner;
        const manager_amount = queue.manager.amount-(-queue.roll);
        queue.manager = {
            amount: manager_amount,
            level: itemLevel(manager_amount)
        };
    };
    return queue;
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
    queue = queueSkill(queue);
    const time_lapsed = (new Date()).getTime()-queue.started;
    const queue_length = queue.length*1000;
    const elapsed_count = Math.floor(time_lapsed/queue_length);
    if ( elapsed_count >= 1 ) {
        const timeout_length = queue_length-(time_lapsed-(queue_length*elapsed_count));
        queueTimeout[queue.owner+queue.worker] = Meteor.setTimeout(function() {
            queue = queueRoll(queue);
            awardQueue(queue);
            initQueue(queue);
        }, timeout_length);
    } else {
        startQueue(queue);
    };
}

invUpdate = function (queue,item,queued) {
    // queued updates are from new items you create
    let inc_amount = { amount: queue.roll };
    if ( queued ) {
        inc_amount["runs"] = 1;
        inc_amount["total"] = queue.roll;
    };
    Inventory.update({ "$and": [
        { owner: queue.owner },
        { item: item }
    ]},{
        $set: {
            updatedAt: (new Date()).getTime(),
            updatedBy: queue.worker,
            updatedHow: queue.task.skill
        },
        $inc: inc_amount
    },{ upsert: true },
    function(err, count) {
    });
};

awardQueue = function (queue) {
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
                invUpdate(queue,award_items[choose_item],true);
            } else {
                let adjust_roll = ( roll-100 > 599 ) ? roll-100 : 0;
                awardItems(adjust_roll);
            };
        };
        awardItems(item_roll);
    } else {
        invUpdate(queue,queue.task.items[0],true);
    }
    if ( queue.worker != queue.owner ) {
        Skills.update({ "$and": [
            { owner: queue.owner },
            { name: "Management" },
            { type: "Life" }
        ]},{
            $inc: { amount: queue.roll },
            $set: { level: queue.manager.level }
        },{ upsert: true },
        function(err, count) {
        });
    };
    Skills.update({ "$and": [
        { owner: queue.worker },
        { name: queue.task.skill },
        { type: "Resource" }
    ]},{
        $set: queue.skill
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
		{ 'status.logout': { $lte: new Date(time_now-(1000*60*60*12)).getTime() } },
		{ 'status.logout': { $gte: new Date(time_now-(1000*60*60*24)).getTime() } },
		{ 'status.online': false }
    ]},{ fields: { _id: 1 } });
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
        // good spacing but I want them a little closer
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
        */
       let row = 1;
       let chance = 5;
       let temples = [1,2,3,4,5,6];
        for ( let i = 125; map_size.height >= i; i+=425 ) {
            row++
            for ( let o = 125; map_size.width >= o; o+=425 ) {
                chance += 5;
                let row_extra = ( row % 2 ? 200 : 0 );
                const offset_o = Math.floor(Math.random()*30+20);
                const offset_i = Math.floor(Math.random()*80+20);
                const roll = Math.floor(Math.random()*90+10);
                if ( roll <= 80 ) {
                    let data_push = {
                        x: o+offset_o+row_extra,
                        y: i+offset_i
                    };
                    if ( roll > chance || temples.length == 0 ) {
                        data_push["radius"] = Math.floor(Math.random()*50)+50;
                        data_push["name"] = Fake.user().surname;
                        data_push["type"] = "City";
                    } else if ( roll <= chance && temples.length > 0 ) {
                        chance = 0;
                        const num = Math.floor(Math.random()*temples.length+1);
                        data_push["radius"] = 100;
                        data_push["name"] = "Temple "+temples[num-1];
                        data_push["type"] = "Temple";
                        data_push["level"] = temples[num-1];
                        temples.splice(num-1, 1);
                    };
                    data.push(data_push);
                    if ( chance > 60 )
                    chance = 0;
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