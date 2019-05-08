workforceEvaluate = function () {
	const city_list = Cities.find({ type: "City" },{ fields: { name: 1 } }).fetch();
    city_list.forEach((city) => {
        const workforceCount = Workers.find({ "$and": [{ city: city.name },{ owner: { $exists: false } }] },{ limit: 20 }).count();
        if ( workforceCount < 20 )
        workforceAdd(20-workforceCount, city.name);
    });
};

workforceAdd = function (count, city) {
    const time_now = (new Date()).getTime();
    let names = [];
	for ( let i = 1; count >= i; i++ ) {
        names.push(Fake.user().name.charAt(0)+". "+Fake.user().surname);
    }
    names.forEach((name) => {
        const choice = Math.floor(Math.random()*64)+1;
        Workers.insert({
            name: name,
            city: city,
            created: time_now,
            avatar: choice
        });
    });
};

var battleTimer = [];
startBattle = function (battle) {

    fighterAttack = function (fighter) {
        if ( !fighter.dead ) {
            let opps = ( fighter.ally ? battle.opponents : battle.allies );
            if ( fighter.target == "None" )
            fighter.target = Math.floor(Math.random()*opps.length);

            const random = Math.floor(Math.random()*fighter.attacks.length);
            const attack = fighter.attacks[random];
            fighter.attacks.splice(random,1);
            
            if ( opps.length >=1 ) {
                if ( opps[fighter.target].health > 0 ) {
                    const time_now = (new Date()).getTime();
                    let target = opps[fighter.target];
                    const open = ( target.open ? .05 : 0 );
                    const chance_roll = Math.floor(Math.random()*1000)+1;
                    const chance = 1200-(((target.stats.defense/fighter.stats.attack)-open)*1000);
                    const type = ( fighter.ally ? "ally" : "opponent" );
                    if ( chance_roll < chance ) {
                        const damage = fighter.stats.attack*(attack.power/100);
                        const armor = ( target.stats.armor/fighter.stats.attack > 1 ? 1 : target.stats.armor/fighter.stats.attack );
                        battle_push = { created: time_now, fighter: fighter.name, action: attack.action, target: opps[fighter.target].name, damage: damage, armor: armor };
                        const group = ( fighter.ally ? "opponents" : "allies" );
                        battle_push[type] = true;
                        opps[fighter.target].health = opps[fighter.target].health-(damage-(damage*armor));
                        if ( opps[fighter.target].health <= 0 ) {
                            opps[fighter.target].dead = true;
                            battle_push.dead = true;
                            try { Meteor.clearTimeout(opps[fighter.target].id) } catch(e) {};
                            let update_query = { _id: battle._id };
                            update_query[group+"._id"] = opps[fighter.target]._id;
                            let update_set = {};
                            update_set[group+".$.health"] = 0;
                            Battles.update(update_query,{ $set: update_set },
                            function(err, count) {
                            });
                            opps.splice(fighter.target,1);
                            fighter.target = "None";
                            let battle_update = { $push: { logs: battle_push } };
                            // if ( opps.length <= 0 || !opps )
                            // battle_update["$set"] = { completed: time_now };
                            Battles.update({ _id: battle._id },battle_update,
                            function(err, count) {
                            });
                        } else {
                            let update_query = { _id: battle._id };
                            update_query[group+"._id"] = opps[fighter.target]._id;
                            let update_inc = {};
                            update_inc[group+".$.health"] = -(damage-(damage*armor));
                            Battles.update(update_query,{ $inc: update_inc },
                            function(err, count) {
                            });
                            Battles.update({ _id: battle._id },{ $push: { logs: battle_push } },
                            function(err, count) {
                            });
                        };
                    } else {
                        battle_push = { created: time_now, fighter: fighter.name, action: "missed", target: opps[fighter.target].name, miss: true };
                        battle_push[type] = true;
                        Battles.update({ _id: battle._id },{ $push: { logs: battle_push } });
                    };
                };
            };

            if ( attack.open ) {
                fighter.open = true;
                Meteor.setTimeout(function() {
                    fighter.open = false;
                }, 1000*attack.open);
            };

            Meteor.setTimeout(function() {
                fighter.attacks.push(attack);
            }, 1000*attack.cooldown);

            battleTimer[fighter._id] = Meteor.setTimeout(function() {
                checkAttacksLength = function () {
                    if ( opps.length >= 1 ) {
                        if ( fighter.attacks.length > 1 ) {
                            fighterAttack(fighter);
                        } else {
                            Meteor.setTimeout(function() {
                                checkAttacksLength();
                            }, 500);
                        };
                    };
                };
                checkAttacksLength();
            }, 1000*attack.time);
        };
    };

    
    let fighters = [];
    battle.allies.forEach((ally) => {
        ally.ally = true;
        fighters.push(ally);
    });
    battle.opponents.forEach((opponent) => {
        opponent.opponent = true;
        fighters.push(opponent);
    });
    
    fighters.forEach((fighter) => {
        try { Meteor.clearTimeout(battleTimer[fighter._id]) } catch(e) {};
        fighter.target = "None";
        fighterAttack(fighter);
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
        awardQueue(queue);
    }, 1000*queue.length);
};

feedQueue = function (queue) {
    let reqs = true;
    let energy = Meteor.users.findOne({ "$and": [
        { _id: queue.owner },
        { energy: { $gte: queue.task.energy } }
    ] },{ fields: { _id: 1 } });
    if ( queue.task.requires )
    queue.task.requires.forEach((req) => {
        let inv = Inventory.findOne({ "$and": [
            { city: queue.city },
            { item: req.name },
            { amount: { $gte: req.amount } }
        ] },{ fields: { _id: 1 } });
        if ( inv ) {
            reqs = true;
        } else {
            reqs = false;
        };
    });
    if ( energy && reqs ) {
        Meteor.users.update({ "$and": [
            { _id: queue.owner },
            { energy: { $gte: queue.task.energy } }
        ] },{ $inc: { energy: -queue.task.energy } },
        function(err, count) {
        });
        if ( queue.task.requires )   
        queue.task.requires.forEach((req) => {
            Inventory.update({ "$and": [
                { city: queue.city },
                { item: req.name },
                { amount: { $gte: req.amount } }
            ] },{ $inc: { amount: -req.amount } },
            function(err, count) {
            });
        });
        return true;
    } else {
        return false;
    };
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
    queue.task.items.forEach((item) => {
        let item_data = Items.findOne({ 'name.single': item },{ fields: { name: 1, roll: 1 } });
        queue_awards.push(item_data);
    });
    queue.awards = queue_awards;
    queue = queueSkill(queue);
    const time_lapsed = (new Date()).getTime()-queue.started;
    const queue_length = queue.length*1000;
    const elapsed_count = Math.floor(time_lapsed/queue_length)
    if ( elapsed_count >= 1 ) {
        const timeout_length = queue_length-(time_lapsed-(queue_length*elapsed_count));
        queueTimeout[queue.owner+queue.worker] = Meteor.setTimeout(function() {
            queue = queueRoll(queue);
            awardQueue(queue);
            startQueue(queue);
        }, timeout_length);
    } else {
        startQueue(queue);
    };
}

invUpdate = function (queue,item,queued) {
    // queued updates are from new items you create
    let inc_amount = { amount: queue.roll },
    inv_update = [
        { owner: queue.owner },
        { item: item }
    ];
    if ( queued ) {
        inc_amount["runs"] = 1;
        inc_amount["total"] = queue.roll;
    };
    if ( queue.city )
    inv_update.push({ city: queue.city });
    Inventory.update({ "$and": inv_update },{
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
        // optimization (based on lowest item roll need) *must change adjust_roll below
        // item_roll = ( item_roll > 599 ? item_roll : 0 );
        awardItems = function (roll) {
            queue.awards.forEach((item) => {
                if ( roll >= item.roll && roll-100 <= item.roll )
                award_items.push(item.name.single);
            });
            if ( award_items.length >= 1 ) {                
                const choose_item = Math.floor(Math.random()*(award_items.length));
                invUpdate(queue,award_items[choose_item],true);
            } else {
                // let adjust_roll = ( roll-100 > 599 ) ? roll-100 : 0;
                let adjust_roll = ( roll-100 > 99 ) ? roll-100 : 0;
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
    const reqs = ( queue.task.energy || queue.task.requires ? feedQueue(queue) : true );
    if ( !reqs )
    clearQueue(queue.owner, queue.worker);
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
        clearQueue(user._id);
	});
};

clearQueue = function (userId,workerId) {
    let lookup = [
        { owner: userId },
        { completed: { $exists: false } }
    ];
    if ( workerId )
    lookup.push({ worker: workerId });
    
    const find_queues = Queues.find(
        { "$and": lookup },
        { fields: { owner: 1, worker: 1, city: 1, stall: 1 } }
    ).fetch(),
    time_now = (new Date()).getTime();

    Queues.update({ "$and": lookup },{ $set: {
        completed: time_now
    } },{ multi: true },
    function(err, count) {
    });

    find_queues.forEach((queue) => {
        Stalls.update({ "$and": [
            { owner: queue.owner },
            { number: queue.stall },
            { city: queue.city }
        ] },
        { $unset: { taskId: "" } },
        function(err, count) {
        });
        Workers.update({ _id: queue.worker },
        { $unset: { working: "" } },
        function(err, count) {
        });
        try { Meteor.clearInterval(queueInt[queue.owner+queue.worker]) } catch (e) { };
        try { Meteor.clearTimeout(queueTimeout[queue.owner+queue.worker]) } catch (e) { };
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
};

checkTasks = function () {
    const data = [
        {
            type: "Resource",
            skill: "Farming",
            task: "Farm Strawberry",
            level: 1,
            items: ["Strawberry"]
        },
        {
            type: "Resource",
            skill: "Farming",
            task: "Farm Orange",
            level: 2,
            items: ["Orange"]
        },
        {
            type: "Resource",
            skill: "Farming",
            task: "Farm Apple",
            level: 3,
            items: ["Apple"]
        },
        {
            type: "Resource",
            skill: "Farming",
            task: "Farm Banana",
            level: 4,
            items: ["Banana"]
        },
        {
            type: "Resource",
            skill: "Farming",
            task: "Farm Plum",
            level: 5,
            items: ["Plum"]
        },
        {
            type: "Resource",
            skill: "Farming",
            task: "Farm Peach",
            level: 6,
            items: ["Peach"]
        },
        {
            type: "Resource",
            skill: "Mining",
            task: "Mine Bronze",
            level: 1,
            energy: 5,
            items: ["Bronze Ore", "Yellow Gem"]
        },
        {
            type: "Resource",
            skill: "Mining",
            task: "Mine Copper",
            level: 2,
            energy: 10,
            items: ["Copper Ore", "Yellow Gem", "Green Gem"]
        },
        {
            type: "Resource",
            skill: "Mining",
            task: "Mine Silver",
            level: 3,
            energy: 15,
            items: ["Silver Ore", "Yellow Gem", "Green Gem"]
        },
        {
            type: "Resource",
            skill: "Mining",
            task: "Mine Gold",
            level: 4,
            energy: 20,
            items: ["Gold Ore", "Yellow Gem", "Green Gem", "Blue Gem"]
        },
        {
            type: "Resource",
            skill: "Mining",
            task: "Mine Iron",
            level: 5,
            energy: 25,
            items: ["Iron Ore", "Yellow Gem", "Green Gem", "Blue Gem"]
        },
        {
            type: "Resource",
            skill: "Mining",
            task: "Mine Titanium",
            level: 6,
            energy: 30,
            items: ["Titanium Ore", "Yellow Gem", "Green Gem", "Blue Gem", "Red Gem"]
        },
        {
            type: "Resource",
            skill: "Logging",
            task: "Chop Maple",
            level: 1,
            energy: 5,
            items: ["Maple Log"]
        },
        {
            type: "Resource",
            skill: "Logging",
            task: "Chop Ash",
            level: 2,
            energy: 10,
            items: ["Ash Log"]
        },
        {
            type: "Resource",
            skill: "Logging",
            task: "Chop Elm",
            level: 3,
            energy: 15,
            items: ["Elm Log"]
        },
        {
            type: "Resource",
            skill: "Logging",
            task: "Chop Cedar",
            level: 4,
            energy: 20,
            items: ["Cedar Log"]
        },
        {
            type: "Resource",
            skill: "Logging",
            task: "Chop Fir",
            level: 5,
            energy: 25,
            items: ["Fir Log"]
        },
        {
            type: "Resource",
            skill: "Logging",
            task: "Chop Pine",
            level: 6,
            energy: 30,
            items: ["Pine Log"]
        },
        {
            type: "Resource",
            skill: "Foraging",
            task: "Forage Cotton",
            level: 1,
            energy: 5,
            items: ["Cotton"]
        },
        {
            type: "Resource",
            skill: "Foraging",
            task: "Forage Milkweed",
            level: 2,
            energy: 10,
            items: ["Milkweed"]
        },
        {
            type: "Resource",
            skill: "Foraging",
            task: "Forage Grass",
            level: 3,
            energy: 15,
            items: ["Grass"]
        },
        {
            type: "Resource",
            skill: "Foraging",
            task: "Forage Coconut",
            level: 4,
            energy: 20,
            items: ["Coconut"]
        },
        {
            type: "Resource",
            skill: "Foraging",
            task: "Forage Flax",
            level: 5,
            energy: 25,
            items: ["Flax"]
        },
        {
            type: "Resource",
            skill: "Foraging",
            task: "Forage Jute",
            level: 6,
            energy: 30,
            items: ["Jute"]
        },
        {
            type: "Resource",
            skill: "Hunting",
            task: "Hunt Fine",
            level: 1,
            energy: 5,
            items: ["Fine Carcass"]
        },
        {
            type: "Resource",
            skill: "Hunting",
            task: "Hunt Light",
            level: 2,
            energy: 10,
            items: ["Light Carcass"]
        },
        {
            type: "Resource",
            skill: "Hunting",
            task: "Hunt Heavy",
            level: 3,
            energy: 15,
            items: ["Heavy Carcass"]
        },
        {
            type: "Resource",
            skill: "Hunting",
            task: "Hunt Rough",
            level: 4,
            energy: 20,
            items: ["Rough Carcass"]
        },
        {
            type: "Resource",
            skill: "Hunting",
            task: "Hunt Rugged",
            level: 5,
            energy: 25,
            items: ["Rugged Carcass"]
        },
        {
            type: "Resource",
            skill: "Hunting",
            task: "Hunt Tough",
            level: 6,
            energy: 30,
            items: ["Tough Carcass"]
        },
        {
            type: "Material",
            skill: "Blacksmithing",
            task: "Smelt Bronze",
            level: 1,
            energy: 5,
            items: ["Bronze Bar"],
            requires: [{ name: "Bronze Ore", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Blacksmithing",
            task: "Smelt Copper",
            level: 2,
            energy: 10,
            items: ["Copper Bar"],
            requires: [{ name: "Copper Ore", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Blacksmithing",
            task: "Smelt Silver",
            level: 3,
            energy: 15,
            items: ["Silver Bar"],
            requires: [{ name: "Silver Ore", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Blacksmithing",
            task: "Smelt Gold",
            level: 4,
            energy: 20,
            items: ["Gold Bar"],
            requires: [{ name: "Gold Ore", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Blacksmithing",
            task: "Smelt Iron",
            level: 5,
            energy: 25,
            items: ["Iron Bar"],
            requires: [{ name: "Iron Ore", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Blacksmithing",
            task: "Smelt Titanium",
            level: 6,
            energy: 30,
            items: ["Titanium Bar"],
            requires: [{ name: "Titanium Ore", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Woodworking",
            task: "Process Maple",
            level: 1,
            energy: 5,
            items: ["Maple Wood"],
            requires: [{ name: "Maple Log", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Woodworking",
            task: "Process Ash",
            level: 2,
            energy: 10,
            items: ["Ash Wood"],
            requires: [{ name: "Ash Log", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Woodworking",
            task: "Process Elm",
            level: 3,
            energy: 15,
            items: ["Elm Wood"],
            requires: [{ name: "Elm Log", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Woodworking",
            task: "Process Cedar",
            level: 4,
            energy: 20,
            items: ["Cedar Wood"],
            requires: [{ name: "Cedar Log", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Woodworking",
            task: "Process Fir",
            level: 5,
            energy: 25,
            items: ["Fir Wood"],
            requires: [{ name: "Fir Log", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Woodworking",
            task: "Process Pine",
            level: 6,
            energy: 30,
            items: ["Pine Wood"],
            requires: [{ name: "Pine Log", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Textiles",
            task: "Weave Cotton",
            level: 1,
            energy: 5,
            items: ["Cotton"],
            requires: [{ name: "Cotton Fabric", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Textiles",
            task: "Weave Milkweed",
            level: 2,
            energy: 10,
            items: ["Milkweed"],
            requires: [{ name: "Milkweed Fabric", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Textiles",
            task: "Weave Grass",
            level: 3,
            energy: 15,
            items: ["Grass"],
            requires: [{ name: "Grass Fabric", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Textiles",
            task: "Weave Coconut",
            level: 4,
            energy: 20,
            items: ["Coconut"],
            requires: [{ name: "Coconut Fabric", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Textiles",
            task: "Weave Flax",
            level: 5,
            energy: 25,
            items: ["Flax"],
            requires: [{ name: "Flax Fabric", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Textiles",
            task: "Weave Jute",
            level: 6,
            energy: 30,
            items: ["Jute"],
            requires: [{ name: "Jute Fabric", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Leatherworking",
            task: "Tan Fine",
            level: 1,
            energy: 5,
            items: ["Fine Leather"],
            requires: [{ name: "Fine Carcass", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Leatherworking",
            task: "Tan Light",
            level: 2,
            energy: 10,
            items: ["Light Leather"],
            requires: [{ name: "Light Carcass", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Leatherworking",
            task: "Tan Heavy",
            level: 3,
            energy: 15,
            items: ["Heavy Leather"],
            requires: [{ name: "Heavy Carcass", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Leatherworking",
            task: "Tan Rough",
            level: 4,
            energy: 20,
            items: ["FiRoughne Leather"],
            requires: [{ name: "Rough Carcass", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Leatherworking",
            task: "Tan Rugged",
            level: 5,
            energy: 25,
            items: ["Rugged Leather"],
            requires: [{ name: "Rugged Carcass", amount: 5 }]
        },
        {
            type: "Material",
            skill: "Leatherworking",
            task: "Tan Tough",
            level: 6,
            energy: 30,
            items: ["Tough Leather"],
            requires: [{ name: "Tough Carcass", amount: 5 }]
        }
    ];
    data.forEach((job) => {
        Tasks.update({ task: job.task },job,{ upsert: true });
    });
};

checkItems = function () {
    const data = [
        {
            skill: "Farming",
            type: "Food",
            rarity: 'Common',
            name: { single: "Strawberry" , plural: "Strawberries" },
            roll: 0,
            level: 1,
            energy: 2
        },
        {
            skill: "Farming",
            type: "Food",
            rarity: 'Common',
            name: { single: "Orange" , plural: "Oranges" },
            roll: 0,
            level: 2,
            energy: 5
        },
        {
            skill: "Farming",
            type: "Food",
            rarity: 'Common',
            name: { single: "Apple" , plural: "Apples" },
            roll: 0,
            level: 3,
            energy: 8
        },
        {
            skill: "Farming",
            type: "Food",
            rarity: 'Common',
            name: { single: "Banana" , plural: "Bananas" },
            roll: 0,
            level: 4,
            energy: 12
        },
        {
            skill: "Farming",
            type: "Food",
            rarity: 'Common',
            name: { single: "Plum" , plural: "Plums" },
            roll: 0,
            level: 5,
            energy: 18
        },
        {
            skill: "Farming",
            type: "Food",
            rarity: 'Common',
            name: { single: "Peach" , plural: "Peaches" },
            roll: 0,
            level: 6,
            energy: 27
        },
        {
            skill: "Mining",
            type: "Ore",
            rarity: 'Common',
            name: { single: "Bronze Ore" , plural: "Bronze Ore" },
            roll: 0,
            level: 1
        },
        {
            skill: "Mining",
            type: "Ore",
            rarity: 'Common',
            name: { single: "Copper Ore" , plural: "Copper Ore" },
            roll: 0,
            level: 2
        },
        {
            skill: "Mining",
            type: "Ore",
            rarity: 'Common',
            name: { single: "Silver Ore" , plural: "Silver Ore" },
            roll: 0,
            level: 3
        },
        {
            skill: "Mining",
            type: "Ore",
            rarity: 'Common',
            name: { single: "Gold Ore" , plural: "Gold Ore" },
            roll: 0,
            level: 4
        },
        {
            skill: "Mining",
            type: "Ore",
            rarity: 'Common',
            name: { single: "Iron Ore" , plural: "Iron Ore" },
            roll: 0,
            level: 5
        },
        {
            skill: "Mining",
            type: "Ore",
            rarity: 'Common',
            name: { single: "Titanium Ore" , plural: "Titanium Ore" },
            roll: 0,
            level: 6
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
            level: 1
        },
        {
            skill: "Mining",
            type: "Material",
            rarity: 'Epic',
            name: { single: "Blue Gem" , plural: "Blue Gems" },
            roll: 850,
            level: 1
        },
        {
            skill: "Mining",
            type: "Material",
            rarity: 'Legendary',
            name: { single: "Red Gem" , plural: "Red Gems" },
            roll: 950,
            level: 1
        },
        {
            skill: "Logging",
            type: "Log",
            rarity: 'Common',
            name: { single: "Maple Log" , plural: "Maple Logs" },
            roll: 0,
            level: 1
        },
        {
            skill: "Logging",
            type: "Log",
            rarity: 'Common',
            name: { single: "Ash Log" , plural: "Ash Logs" },
            roll: 0,
            level: 2
        },
        {
            skill: "Logging",
            type: "Log",
            rarity: 'Common',
            name: { single: "Elm Log" , plural: "Elm Logs" },
            roll: 0,
            level: 3
        },
        {
            skill: "Logging",
            type: "Log",
            rarity: 'Common',
            name: { single: "Cedar Log" , plural: "Cedar Logs" },
            roll: 0,
            level: 4
        },
        {
            skill: "Logging",
            type: "Log",
            rarity: 'Common',
            name: { single: "Fir Log" , plural: "Fir Logs" },
            roll: 0,
            level: 5
        },
        {
            skill: "Logging",
            type: "Log",
            rarity: 'Common',
            name: { single: "Pine Log" , plural: "Pine Logs" },
            roll: 0,
            level: 6
        },
        {
            skill: "Blacksmithing",
            type: "Metal",
            rarity: 'Common',
            name: { single: "Copper Bar" , plural: "Copper Bars" },
            roll: 0,
            level: 1
        },
        {
            skill: "Blacksmithing",
            type: "Metal",
            rarity: 'Common',
            name: { single: "Bronze Bar" , plural: "Bronze Bars" },
            roll: 0,
            level: 2
        },
        {
            skill: "Blacksmithing",
            type: "Metal",
            rarity: 'Common',
            name: { single: "Silver Bar" , plural: "Silver Bars" },
            roll: 0,
            level: 3
        },
        {
            skill: "Blacksmithing",
            type: "Metal",
            rarity: 'Common',
            name: { single: "Gold Bar" , plural: "Gold Bars" },
            roll: 0,
            level: 4
        },
        {
            skill: "Blacksmithing",
            type: "Metal",
            rarity: 'Common',
            name: { single: "Iron Bar" , plural: "Iron Bars" },
            roll: 0,
            level: 5
        },
        {
            skill: "Blacksmithing",
            type: "Metal",
            rarity: 'Common',
            name: { single: "Titanium Bar" , plural: "Titanium Bars" },
            roll: 0,
            level: 6
        },
        {
            skill: "Woodworking",
            type: "Wood",
            rarity: 'Common',
            name: { single: "Maple Wood" , plural: "Maple Wood" },
            roll: 0,
            level: 1
        },
        {
            skill: "Woodworking",
            type: "Wood",
            rarity: 'Common',
            name: { single: "Ash Wood" , plural: "Ash Wood" },
            roll: 0,
            level: 2
        },
        {
            skill: "Woodworking",
            type: "Wood",
            rarity: 'Common',
            name: { single: "Elm Wood" , plural: "Elm Wood" },
            roll: 0,
            level: 3
        },
        {
            skill: "Woodworking",
            type: "Wood",
            rarity: 'Common',
            name: { single: "Cedar Wood" , plural: "Cedar Wood" },
            roll: 0,
            level: 4
        },
        {
            skill: "Woodworking",
            type: "Wood",
            rarity: 'Common',
            name: { single: "Fir Wood" , plural: "Fir Wood" },
            roll: 0,
            level: 5
        },
        {
            skill: "Woodworking",
            type: "Wood",
            rarity: 'Common',
            name: { single: "Pine Wood" , plural: "Pine Wood" },
            roll: 0,
            level: 6
        },
        {
            skill: "Foraging",
            type: "Plant",
            rarity: 'Common',
            name: { single: "Cotton" , plural: "Cotton" },
            roll: 0,
            level: 1
        },
        {
            skill: "Foraging",
            type: "Plant",
            rarity: 'Common',
            name: { single: "Milkweed" , plural: "Milkweeds" },
            roll: 0,
            level: 2
        },
        {
            skill: "Foraging",
            type: "Plant",
            rarity: 'Common',
            name: { single: "Grass" , plural: "Grass" },
            roll: 0,
            level: 3
        },
        {
            skill: "Foraging",
            type: "Plant",
            rarity: 'Common',
            name: { single: "Coconut" , plural: "Coconuts" },
            roll: 0,
            level: 4
        },
        {
            skill: "Foraging",
            type: "Plant",
            rarity: 'Common',
            name: { single: "Flax" , plural: "Flax" },
            roll: 0,
            level: 5
        },
        {
            skill: "Foraging",
            type: "Plant",
            rarity: 'Common',
            name: { single: "Jute" , plural: "Jute" },
            roll: 0,
            level: 6
        },
        {
            skill: "Textiles",
            type: "Cloth",
            rarity: 'Common',
            name: { single: "Cotton Fabric" , plural: "Cotton Fabric" },
            roll: 0,
            level: 1
        },
        {
            skill: "Textiles",
            type: "Cloth",
            rarity: 'Common',
            name: { single: "Milkweed Fabric" , plural: "Milkweeds Fabric" },
            roll: 0,
            level: 2
        },
        {
            skill: "Textiles",
            type: "Cloth",
            rarity: 'Common',
            name: { single: "Grass Fabric" , plural: "Grass Fabric" },
            roll: 0,
            level: 3
        },
        {
            skill: "Textiles",
            type: "Cloth",
            rarity: 'Common',
            name: { single: "Coconut Fabric" , plural: "Coconuts Fabric" },
            roll: 0,
            level: 4
        },
        {
            skill: "Textiles",
            type: "Cloth",
            rarity: 'Common',
            name: { single: "Flax Fabric" , plural: "Flax Fabric" },
            roll: 0,
            level: 5
        },
        {
            skill: "Textiles",
            type: "Cloth",
            rarity: 'Common',
            name: { single: "Jute Fabric" , plural: "Jute Fabric" },
            roll: 0,
            level: 6
        },  
        {
            skill: "Hunting",
            type: "Carcass",
            rarity: 'Common',
            name: { single: "Fine Carcass" , plural: "Fine Carcasses" },
            roll: 0,
            level: 1
        },
        {
            skill: "Hunting",
            type: "Carcass",
            rarity: 'Common',
            name: { single: "Light Carcass" , plural: "Light Carcasses" },
            roll: 0,
            level: 2
        },
        {
            skill: "Hunting",
            type: "Carcass",
            rarity: 'Common',
            name: { single: "Heavy Carcass" , plural: "Heavy Carcasses" },
            roll: 0,
            level: 3
        },
        {
            skill: "Hunting",
            type: "Carcass",
            rarity: 'Common',
            name: { single: "Rough Carcass" , plural: "Rough Carcasses" },
            roll: 0,
            level: 4
        },
        {
            skill: "Hunting",
            type: "Carcass",
            rarity: 'Common',
            name: { single: "Rugged Carcass" , plural: "Rugged Carcasses" },
            roll: 0,
            level: 5
        },
        {
            skill: "Hunting",
            type: "Carcass",
            rarity: 'Common',
            name: { single: "Tough Carcass" , plural: "Tough Carcasses" },
            roll: 0,
            level: 6
        },
        {
            skill: "Leatherworking",
            type: "Leather",
            rarity: 'Common',
            name: { single: "Fine Leather" , plural: "Fine Leathers" },
            roll: 0,
            level: 1
        },
        {
            skill: "Leatherworking",
            type: "Leather",
            rarity: 'Common',
            name: { single: "Light Leather" , plural: "Light Leathers" },
            roll: 0,
            level: 2
        },
        {
            skill: "Leatherworking",
            type: "Leather",
            rarity: 'Common',
            name: { single: "Heavy Leather" , plural: "Heavy Leathers" },
            roll: 0,
            level: 3
        },
        {
            skill: "Leatherworking",
            type: "Leather",
            rarity: 'Common',
            name: { single: "Rough Leather" , plural: "Rough Leathers" },
            roll: 0,
            level: 4
        },
        {
            skill: "Leatherworking",
            type: "Leather",
            rarity: 'Common',
            name: { single: "Rugged Leather" , plural: "Rugged Leathers" },
            roll: 0,
            level: 5
        },
        {
            skill: "Leatherworking",
            type: "Leather",
            rarity: 'Common',
            name: { single: "Tough Leather" , plural: "Tough Leathers" },
            roll: 0,
            level: 6
        }
    ];
    data.forEach((item) => {
        Items.update({ 'name.single': item.name.single },item,{ upsert: true });
    });
};