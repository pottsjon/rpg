windowSize = function () {
	const width = document.getElementById("map").offsetWidth;
	const height = $(window).height();
	return { width: width, height: height };
};

var stage, anim, loaded = false, gameStarted, nextTimeout;
Template.traveling.onRendered(function () {
	Tracker.autorun(function() {
        if ( Meteor.user() ) { 
            window_size = windowSize();
            let position = Positions.findOne({ owner: Meteor.userId() });
            if ( position && !gameStarted ) {
                gameStarted = true;
                let start_pos = { x: position.x, y: position.y };
                let client_start = (new Date()).getTime();
                let server_time = TimeSync.serverTime( client_start );
                const find_pos = realPosition(position,position,server_time,client_start);
                position.x = find_pos.x;
                position.y = find_pos.y;
                const top = position.y-(window_size.height/2)-1000,
                    bottom = position.y+(window_size.height/2)+1000,
                    left = position.x-(window_size.width/2)-1000,
                    right = position.x+(window_size.width/2)+1000;
                let near_cities = Cities.find({ "$and": [
                        { "$and": [{ x: { $gte: left } },{ x: { $lte: right } }] },
                        { "$and": [{ y: { $lte: bottom } },{ y: { $gte: top } }] }
                    ] }).fetch();
                const other_cities = Cities.find({ "$or": [
                        { "$or": [{ x: { $lt: left } },{ x: { $gt: right } }] },
                        { "$or": [{ y: { $gt: bottom } },{ y: { $lt: top } }] }
                    ] }).fetch();
                if ( top < 0 )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: left } },{ x: { $lte: right } }] },
                    { "$and": [{ y: { $lte: map_size.height+top } },{ y: { $gte: map_size.height } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });
                if ( bottom > map_size.height )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: left } },{ x: { $lte: right } }] },
                    { "$and": [{ y: { $lte: bottom-map_size.height } },{ y: { $gte: 0 } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });

                if ( left < 0 )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: map_size.width+left } },{ x: { $lte: map_size.width } }] },
                    { "$and": [{ y: { $lte: bottom } },{ y: { $gte: top } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });

                if ( right > map_size.width )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: 0 } },{ x: { $lte: right-map_size.width } }] },
                    { "$and": [{ y: { $lte: bottom } },{ y: { $gte: top } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });

                if ( top < 0 && left < 0 )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: map_size.width+left } },{ x: { $lte: map_size.width } }] },
                    { "$and": [{ y: { $lte: map_size.height+top } },{ y: { $gte: map_size.height } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });
                    
                if ( top < 0 && right > map_size.width )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: 0 } },{ x: { $lte: right-map_size.width } }] },
                    { "$and": [{ y: { $lte: map_size.height+top } },{ y: { $gte: map_size.height } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });

                if ( bottom > map_size.height && left < 0 )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: map_size.width+left } },{ x: { $lte: map_size.width } }] },
                    { "$and": [{ y: { $lte: bottom-map_size.height } },{ y: { $gte: 0 } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });

                if ( bottom > map_size.height && right > map_size.width )
                Cities.find({ "$and": [
                    { "$and": [{ x: { $gte: 0 } },{ x: { $lte: right-map_size.width } }] },
                    { "$and": [{ y: { $lte: bottom-map_size.height } },{ y: { $gte: 0 } }] }
                ] }).fetch().forEach((city) => {
                    near_cities.push(city);
                });
                
                let loading, loadLength, player;

                stage = new Konva.Stage({
                    container: 'map',
                    width: window_size.width,
                    height: window_size.height
                });
                
                const box_size = 100;
                const box_group = new Konva.Group();
                const box = new Konva.Rect({
                    width: box_size,
                    height: box_size,
                    fill: '#885530',
                    stroke: '#8e5c37',
                    strokeWidth: 4
                });

                for ( let i = 0; box_size*2 >= i; i+=box_size ) {
                    for ( let o = 0; box_size*2 >= o; o+=box_size ) {
                        const box_clone = box.clone({
                            x: i,
                            y: o
                        });
                        box_group.add(box_clone);
                    }
                }
                box_group.cache();

                let background = new Konva.Layer();

                function drawBoxes() {
                    stage.add(background);
                    background.moveToBottom();
                    for ( let i = -(box_size*2); window_size.width+(box_size*2) >= i; i+=(box_size*3) ) {
                        for ( let o = -(box_size*2); window_size.height+(box_size*2) >= o; o+=(box_size*3) ) {
                            const box_clone = box_group.clone({
                                x: i,
                                y: o
                            });
                            background.add(box_clone);
                            box_clone.cache();
                        }
                    }
                    background.cache();
                }
                drawBoxes();

                let cities = new Konva.Layer({
                    x: -position.x+(window_size.width/2),
                    y: -position.y+(window_size.height/2),
                    hitGraphEnabled : false
                });
                stage.add(cities);

                let city_list = cities.getChildren();

                function proxCities(found_cities, others) {
                    initCities(found_cities, others);
                }

                let city_hold;
                
                const city_group = new Konva.Group({});

                let imageObj = new Image(),
                village;
                imageObj.onload = function() {
                    village = new Konva.Image({
                        image: imageObj
                    });
                    city_group.add(village);

                    const label = new Konva.Label({
                        y: -30
                    });
                
                    const tag = new Konva.Tag({
                        fill: '#111',
                        lineJoin: 'round',
                        pointerDirection: 'down',
                        pointerWidth: 5,
                        pointerHeight: 5,
                        cornerRadius: 5
                    });
                    label.add(tag);
                
                    const text = new Konva.Text({
                        fontSize: 16,
                        fill: 'white',
                        padding: 5,
                        align: 'center'
                    });
                    label.add(text);
                        
                    city_group.add(label);
                };
                imageObj.src = '/assets/village.png'


                function incWidth(inc,inits,others) {
                    const timer = ( !others ? .1 : 1 );
                    Meteor.setTimeout(function(){
                        if ( !others ) {
                        const winW = window_size.width-(window_size.width*.2);
                        const width = winW*(inc/inits.length);
                        loading.setAttr('width', width-4);
                        };
                        const city = inits[inc];
                        const cg_clone = city_group.clone({
                            x: city.x,
                            y: city.y,
                            radius: city.radius
                        });
                        if ( cg_clone.children[0] )
                        cg_clone.children[0].setAttrs({
                            offsetX: city.radius,
                            offsetY: city.radius,
                            width: city.radius*2,
                            height: city.radius*2
                        });
                        if ( cg_clone.children[1] )
                        cg_clone.children[1].children[1].setAttrs({
                            text: city.name+"\n"+city.x+','+city.y
                        });
                        city_hold.push(cg_clone);
                        cities.add(cg_clone);
                        inc++;
                        if ( inc < inits.length ) {
                            incWidth(inc,inits,others);
                        } else {
                            cloneCities(others);
                            try { clearLoad(others) } catch(e) {};
                            insertHitCities();
                        }
                    }, timer);
                }

                function initCities(inits, others) {
                    city_hold = [];
                    incWidth(0,inits,others);
                }
                
                let players = new Konva.Layer({
                    hitGraphEnabled : false
                });
                stage.add(players);

                const walker = new Image();
                
                let animations = {
                    standing: [0, 0, 100, 129],
                    walking: [100, 0, 100, 129,
                            200, 0, 200, 129]
                };
                const start_anim = ( !position.angle ? "standing" : "walking" );
                walker.onload = function() {
                    const rotation = ( !position.angleDeg ? 0 : position.angleDeg-90 );
                    player = new Konva.Sprite({
                        x: window_size.width/2,
                        y: window_size.height/2,
                        image: walker,
                        animation: start_anim,
                        animations: animations,
                        frameRate: 3,
                        frameIndex: 0,
                        width: 100,
                        height: 129,
                        offsetX: 50,
                        offsetY: 65,
                        rotation: rotation,
                        scaleX: .35,
                        scaleY: .35
                    });
                    players.add(player);
                    player.start();
                };
                walker.src = "/assets/walking.png";

                let textX = new Konva.Text({
                    text: 'X: '+Math.round(position.x),
                    x: 10,
                    y: 50,
                    fontSize: 20
                });
                players.add(textX);

                let textY = new Konva.Text({
                    text: 'Y: '+Math.round(position.y),
                    x: 10,
                    y: 70,
                    fontSize: 20
                });
                players.add(textY);

                let textA = new Konva.Text({
                    x: 10,
                    y: 90,
                    fontSize: 20
                });
                players.add(textA);

                function cloneCities(others) {
                    // clones the cities on the left, right, top, bottom and corners, within the screen width, then places them on opposing sides.
                    city_hold.forEach((city) => {
                        const radius = city.attrs.radius*2,
                        cityX = city.attrs.x,
                        cityY = city.attrs.y,
                        winW = window_size.width,
                        winH = window_size.height,
                        mapW = map_size.width,
                        mapH = map_size.height;
                        let clone = 0;
                        if ( cityX <= winW+radius && cityY <= winH+radius ) {
                            clone = city.clone({ x: cityX+mapW, y: cityY+mapH });
                            cities.add(clone);
                        };
                        if ( cityX <= winW+radius && cityY >= mapH-winH-radius ) {
                            clone = city.clone({ x: cityX+mapW, y: cityY-mapH });
                            cities.add(clone);
                        };
                        if ( cityX >= mapW-winW-radius && cityY >= mapH-winH-radius ) {
                            clone = city.clone({ x: cityX-mapW, y: cityY-mapH });
                            cities.add(clone);
                        };
                        if ( cityX >= mapW-winW-radius && cityY <= winH+radius ) {
                            clone = city.clone({ x: cityX-mapW, y: cityY+mapH });
                            cities.add(clone);
                        };
                        if ( cityX <= winW+radius ) {
                            clone = city.clone({ x: cityX+mapW });
                            cities.add(clone);
                        };
                        if ( cityX >= mapW-winW-radius ) {
                            clone = city.clone({ x: cityX-mapW });
                            cities.add(clone);
                        };
                        if ( cityY <= winH+radius ) {
                            clone = city.clone({ y: cityY+mapH });
                            cities.add(clone);
                        };
                        if ( cityY >= mapH-winH-radius ) {
                            clone = city.clone({ y: cityY-mapH });
                            cities.add(clone);
                        };
                    });
                    city_list = cities.getChildren();
                    if ( others )
                    city_hold = null;
                    showCities();
                };

                function showCities() {
                    let top = -cities.attrs.y-window_size.height-500,
                    bottom = -cities.attrs.y+window_size.height+500,
                    left = -cities.attrs.x-window_size.width-500,
                    right = -cities.attrs.x+window_size.width+500,
                    n;
                    // only shows cities within viewport
                    for( n = 0; n < city_list.length; n++ ) {
                        const city = city_list[n],
                        checkTop = top <= city.attrs.y,
                        checkBottom = bottom >= city.attrs.y,
                        checkLeft = left <= city.attrs.x,
                        checkRight = right >= city.attrs.x;
                        if ( checkLeft && checkRight && checkTop && checkBottom ) {
                            city.show();
                        } else {
                            if ( city.attrs.name )
                            city.hide();
                        };
                    }
                }

                const move_speed = 5.14/window.devicePixelRatio;
                function movement() {
                    if ( loaded ) {
                        const find_pos = realPosition(start_pos,position,server_time,client_start);
                        position.x = find_pos.x;
                        position.y = find_pos.y;
                        cities.setAttrs({ x: -position.x+(window_size.width/2), y: -position.y+(window_size.height/2) });
                        if ( position.angle )
                        background.move({ x: -find_pos.cos/move_speed, y: -find_pos.sin/move_speed });
                    };
                }

                loaded = false;
                function update(frame) {
                    if ( loaded && position.angle ) {
                        let find_angle = ( !position.angleDeg ? "" : 'A: '+Math.round(position.angleDeg)+'°' );
                        textX.text('X: '+Math.round(position.x));
                        textY.text('Y: '+Math.round(position.y));
                        textA.text(find_angle);

                        showCities();
                        movement();

                        // background boxes only move 50 pixels (their size) in either direction before reseting
                        if ( background.attrs.x < -box_size || background.attrs.x > box_size )
                            background.attrs.x = 0;
                        if ( background.attrs.y < -box_size || background.attrs.y > box_size )
                            background.attrs.y = 0;
                    };
                }

                function startTimer() {
                    try { Meteor.clearTimeout(nextTimeout) } catch(e) {};
                    let find_city = hitCities.findOne({ time: { $gt: 0 } },{ fields: { time: 1, name: 1 }, sort: { distance: 1 } });
                    let timer = ( !find_city ? 200 : find_city.time*1000 );
                    nextTimeout = Meteor.setTimeout(function(){
                        if ( !find_city ) {
                            startTimer();
                        } else {
                            insertHitCities();
                        };
                    }, timer);
                }

                function insertHitCities() {
                    if ( position.angle ) {
                        let hitting_cities = findHitCities(position);
                        hitCities.remove({},function(err, count) {
                            hitting_cities.forEach((city) => {
                                hitCities.insert(city,function(err, count) {               
                                });
                            });
                            if ( hitting_cities && hitting_cities.length >= 1 )
                            startTimer();
                        });
                    };
                }

                function startAttrs() {
                    background.remove();
                    drawBoxes();
                    stage.setAttr('width', window_size.width);
                    stage.setAttr('height', window_size.height);
                    cities.setAttr('x', cities.attrs.x-player.attrs.x+(window_size.width/2));
                    cities.setAttr('y', cities.attrs.y-player.attrs.y+(window_size.height/2));
                    player.setAttr('x', window_size.width/2);
                    player.setAttr('y', window_size.height/2);
                }

                let resizeTimeout;
                function fixWindowSize() {
                    Meteor.clearTimeout(resizeTimeout);
                    resizeTimeout = Meteor.setTimeout(function(){
                        startAttrs();
                    }, 500);
                }
                window.addEventListener('resize', fixWindowSize);

                let doc_map = document.getElementById('map');
                function clearClick() {
                    Meteor.setTimeout(function(){
                        clicked = false;
                    }, 1000);
                }

                stopPlayer = function () {
                    position.angle = false;
                    position.angleDeg = false;
                    hitCities.remove({});
                    player.setAttrs({ animation: 'standing', rotation: 0 });
                };

                stopMovement = function () {
                    Meteor.call('stopMovement');
                };

                function startMovement(e) {
                    clicked = true;
                    const start = { x: window_size.width/2, y: window_size.height/2 };
                    const end = { x: e.layerX, y: e.layerY };
                    const angle = Math.atan2(end.y - start.y, end.x - start.x);
                    const angleDeg = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
                    Meteor.call('startMovement', angle, angleDeg, (error, result) => {
                        if ( result ) {
                            position.x = result.x;
                            position.y = result.y;
                            position.started = result.started;
                            position.angle = angle;
                            position.angleDeg = angleDeg;
                            start_pos = { x: result.x, y: result.y };
                            client_start = (new Date()).getTime();
                            server_time = TimeSync.serverTime( client_start );
                            insertHitCities();
                            player.setAttrs({ animation: 'walking', rotation: angleDeg-90 });
                        };
                    });
                    clearClick();
                }

                doc_map.addEventListener("touchstart", e => {
                    if ( !clicked )
                    startMovement(e);    
                });
                doc_map.addEventListener("click", e => {
                    if ( !clicked )
                    startMovement(e);
                });
                /*
                doc_map.addEventListener("contextmenu", e => {
                    e.preventDefault();
                    stopMovement();
                });
                */

                let period = 20;
                anim = new Konva.Animation(function(frame) {
                    if ((frame.time % (period * 2)) < period) {
                        update(frame);
                    } else {
                        return false;
                    }
                }, stage);
                
                let clicked = false;
                let loadBox;

                function loadScreen() {
                    background.moveToTop();
                    players.moveToTop();
                    loadBox = new Konva.Group({
                        x: window_size.width*.1,
                        y: window_size.height/2-25
                    });
                    players.add(loadBox);
                    let loadBar = new Konva.Rect({
                        fill: 'white',
                        width: window_size.width*.8,
                        height: 40
                    });
                    loadBox.add(loadBar);
                    loading = new Konva.Rect({
                        fill: 'green',
                        height: 36,
                        x: 2,
                        y: 2
                    });
                    loadBox.add(loading);
                    let text = new Konva.Text({
                        text: "LOADING",
                        fontSize: 18,
                        fontStyle: 'bold',
                        fill: '#074007',
                        align: 'center',
                        width: window_size.width*.8-4,
                        y: 13
                    });
                    loadBox.add(text);
                    proxCities(near_cities, false);
                    movement();
                }

                function clearLoad(others) {
                    loadBox.destroy();
                    background.moveToBottom();
                    loaded = true;
                    if ( !others )
                    proxCities(other_cities, true);
                };

                loadScreen();

            };
            
            $(window).resize(function() {
                window_size = windowSize();
            });

        } else {
            try { stage.destroy() } catch(e) { };
            gameStarted = false;
            hitCities.remove({});
            try { Meteor.clearTimeout(nextTimeout) } catch(e) {};
        };
    });
});


Template.traveling.onCreated(function () {
    this.visitNext = new ReactiveVar( false );
    checkLoaded = function () {
        Meteor.setTimeout(function(){
            if ( loaded ) {
                Tracker.autorun(function() {
                    animStartDep.depend();
                    if ( animStart ) {
                        anim.start();
                    } else {
                        anim.stop();
                    };
                    let position = Positions.findOne({ owner: Meteor.userId() },{ fields: { angle: 1 } });
                    if ( !position.angle )
                    stopPlayer();
                });
            } else {
                checkLoaded();
            }
        }, 500);
    };
    checkLoaded();
});

Template.traveling.onDestroyed(function () {
    gameStarted = false;
    try { stage.destroy() } catch(e) {};
});

Template.traveling.events({
    'click .visit_next'(e,t) {
        if ( t.visitNext.get() ) {
            t.visitNext.set(false);
            Meteor.call('visitNext', false);
        } else {
            t.visitNext.set(true);
            Meteor.call('visitNext', true);
        };
    },
    'click .visit_city'(e,t) {
        t.visitNext.set(false);
        stopMovement();
    }
});

Template.traveling.helpers({
    next(){
        const find_pos = Positions.findOne({ angle: { $exists: true } },{ fields: { angle: 1 } });
        const check_circle = ( Template.instance().visitNext.get() ? "checkbox-marked-circle lit" : "checkbox-blank-circle" );
        if ( find_pos && find_pos.angle )
        return "<div class='checkbox visit_next'><span class='mdi mdi-"+check_circle+"'></span></div>";
    },
    visit(){
        const find_pos = Positions.findOne({ angle: { $exists: true } },{ fields: { angle: 1, city: 1 } });
        if ( find_pos && find_pos.angle ) {
            const text = ( find_pos.city && find_pos.city.name ? "Visit "+find_pos.city.name : "Stop Here" );
            const stop = ( find_pos.city && find_pos.city.name ? "" : "stop" );
            return "<div class='button visit_city round-sm "+stop+"'>"+text+"</div>";
        };
    },
    cities(){
        return hitCities.find({ time: { $gt: 0 } },{ sort: { distance: 1 }, limit: 3 });
    }
});

cityInts = [];
queueTimer = function (queueId,tick,t) {
	cityInts[queueId] = Meteor.setInterval(function() {
        tick = tick-1;
		t.cityInt.set(tick);
	}, 1000);
};

Template.city.onCreated(function () {
    this.cityInt = new ReactiveVar( 0 );
    try { Meteor.clearTimeout(cityInts[this.data.name]) } catch (e) { };
    Template.instance().cityInt.set(this.data.time);
    queueTimer(this.data.name,this.data.time,Template.instance());
});

Template.city.onDestroyed(function () {
    try { Meteor.clearTimeout(cityInts[this.data.name]) } catch (e) { };
});

Template.city.helpers({
    time(){
        let progress = Template.instance().cityInt.get();
        return formatTimer(progress);
    }
});