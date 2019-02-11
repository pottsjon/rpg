windowSize = function () {
	const width = document.getElementById("map").offsetWidth;
	const height = $(window).height();
	return { width: width, height: height };
};

let stage, gameStarted = false;
Template.traveling.onRendered(function () {
	Tracker.autorun(function() {
        if ( Meteor.user() ) {
            window_size = windowSize();
            let position = Positions.findOne({ owner: Meteor.userId() });
            if ( position && !gameStarted ) {
                gameStarted = true;
                const top = position.y-(window_size.height/2)-500,
                    bottom = position.y+(window_size.height/2)+500,
                    left = position.x-(window_size.width/2)-500,
                    right = position.x+(window_size.width/2)+500;
                let near_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: left } },{ x: { $lte: right } }] },{ "$and": [{ y: { $lte: bottom } },{ y: { $gte: top } }] }] }).fetch(),
                    other_cities = Cities.find({ "$or": [{ "$or": [{ x: { $lt: left } },{ x: { $gt: right } }] },{ "$or": [{ y: { $gt: bottom } },{ y: { $lt: top } }] }] }).fetch();
                    if ( top < 0 ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: left } },{ x: { $lte: right } }] },{ "$and": [{ y: { $lte: map_size.height+top } },{ y: { $gte: map_size.height } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                    if ( bottom > map_size.height ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: left } },{ x: { $lte: right } }] },{ "$and": [{ y: { $lte: bottom-map_size.height } },{ y: { $gte: 0 } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                    if ( left < 0 ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: map_size.width+left } },{ x: { $lte: map_size.width } }] },{ "$and": [{ y: { $lte: bottom } },{ y: { $gte: top } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                    if ( right > map_size.width ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: 0 } },{ x: { $lte: right-map_size.width } }] },{ "$and": [{ y: { $lte: bottom } },{ y: { $gte: top } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                    if ( top < 0 && left < 0 ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: map_size.width+left } },{ x: { $lte: map_size.width } }] },{ "$and": [{ y: { $lte: map_size.height+top } },{ y: { $gte: map_size.height } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                    if ( top < 0 && right > map_size.width ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: 0 } },{ x: { $lte: right-map_size.width } }] },{ "$and": [{ y: { $lte: map_size.height+top } },{ y: { $gte: map_size.height } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                    if ( bottom > map_size.height && left < 0 ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: map_size.width+left } },{ x: { $lte: map_size.width } }] },{ "$and": [{ y: { $lte: bottom-map_size.height } },{ y: { $gte: 0 } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                    if ( bottom > map_size.height && right > map_size.width ) {
                        const side_cities = Cities.find({ "$and": [{ "$and": [{ x: { $gte: 0 } },{ x: { $lte: right-map_size.width } }] },{ "$and": [{ y: { $lte: bottom-map_size.height } },{ y: { $gte: 0 } }] }] }).fetch();
                        side_cities.forEach((city) => {
                            near_cities.push(city);
                        });
                    };
                startGame(position,near_cities,other_cities);
            };
            $(window).resize(function() {
                window_size = windowSize();
            });
        };
	});
});

Template.traveling.onDestroyed(function () {
    gameStarted = false;
    try { stage.destroy() } catch(e) {};
});

Template.traveling.helpers({
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

// var position = { x: 0, y: 0, started: false, angle: false };
// game size must be larger than the window size
let loadCount = 0;
function startGame(position,near_cities,other_cities) {
    let loading, loadLength, time_passed, client_start, server_time,
    start_pos = { x: 0, y: 0 };

    stage = new Konva.Stage({
        container: 'map',
        width: window_size.width,
        height: window_size.height
    });
    
    const box_size = 200;
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

    const circle = new Konva.Circle({
        fill: 'red'
    });
    city_group.add(circle);

    const label = new Konva.Label();
    city_group.add(label);

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
        fontSize: 18,
        fill: 'white',
        padding: 5,
    });
    label.add(text);
    city_group.cache();

    function initCities(inits, others) {
        loadLength = inits.length;
        function incWidth(inc) {
            Meteor.setTimeout(function(){
            if ( !others ) {
                const winW = window_size.width-(window_size.width*.2);
                const width = winW*(inc/loadLength);
                loading.setAttr('width', width-4);
            };
            const city = inits[inc];
            const cg_clone = city_group.clone({
                x: city.x,
                y: city.y,
                radius: city.radius
            });
            cg_clone.children[0].setAttrs({
                radius: city.radius,
                name: city.name
            });
            cg_clone.children[1].children[1].setAttrs({
                text: city.name+" ["+city.x+","+city.y+"]"
            });
            city_hold.push(cg_clone);
            cities.add(cg_clone);
            cg_clone.cache();
            inc++;
            if ( inc < loadLength ) {
                incWidth(inc);
            } else {
                cloneCities(others);
                try { clearLoad(others) } catch(e) {};
                client_start = (new Date()).getTime();
                server_time = TimeSync.serverTime( client_start );
                showCities();
                insertHitCities();
            }
            }, 0.1);
        }
        city_hold = [];
        incWidth(0);
    }
    
    let players = new Konva.Layer({
        hitGraphEnabled : false
    });
    stage.add(players);

    let player = new Konva.Circle({
        radius: 10,
        fill: 'green',
        x: window_size.width/2,
        y: window_size.height/2
    });
    players.add(player);

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
                clone.cache();
            };
            if ( cityX <= winW+radius && cityY >= mapH-winH-radius ) {
                clone = city.clone({ x: cityX+mapW, y: cityY-mapH });
                cities.add(clone);
                clone.cache();
            };
            if ( cityX >= mapW-winW-radius && cityY >= mapH-winH-radius ) {
                clone = city.clone({ x: cityX-mapW, y: cityY-mapH });
                cities.add(clone);
                clone.cache();
            };
            if ( cityX >= mapW-winW-radius && cityY <= winH+radius ) {
                clone = city.clone({ x: cityX-mapW, y: cityY+mapH });
                cities.add(clone);
                clone.cache();
            };
            if ( cityX <= winW+radius ) {
                clone = city.clone({ x: cityX+mapW });
                cities.add(clone);
                clone.cache();
            };
            if ( cityX >= mapW-winW-radius ) {
                clone = city.clone({ x: cityX-mapW });
                cities.add(clone);
                clone.cache();
            };
            if ( cityY <= winH+radius ) {
                clone = city.clone({ y: cityY+mapH });
                cities.add(clone);
                clone.cache();
            };
            if ( cityY >= mapH-winH-radius ) {
                clone = city.clone({ y: cityY-mapH });
                cities.add(clone);
                clone.cache();
            };
        });
        city_list = cities.getChildren();
        if ( others )
        city_hold = null;
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

    function movement(time_passed) {
        if ( loaded ) {
            time_passed = ( !time_passed ? 0 : time_passed );
            const time_int = ( !position.started ? 0 : (server_time-position.started+time_passed)/1000 ),
            int_dist = time_int*5,
            cos = ( !position.angle ? 1 : Math.cos(position.angle) ),
            sin = ( !position.angle ? 1 : Math.sin(position.angle) ),
            position_x = int_dist*cos+start_pos.x,
            position_y = int_dist*sin+start_pos.y;
            position.x = fixEdge(position_x, map_size.width);
            position.y = fixEdge(position_y, map_size.height);
            cities.setAttrs({ x: -position.x+(window_size.width/2), y: -position.y+(window_size.height/2) });
            background.move({ x: -cos/5, y: -sin/5 });
        };
    }

    let loaded = false;
    function update(frame) {
        if ( loaded && position.angle ) {
            let find_angle = ( !position.angleDeg ? "" : 'A: '+Math.round(position.angleDeg)+'°' );
            textX.text('X: '+Math.round(position.x));
            textY.text('Y: '+Math.round(position.y));
            textA.text(find_angle);

            showCities();
            time_passed = (new Date()).getTime()-client_start;
            movement(time_passed);

            // background boxes only move 50 pixels (their size) in either direction before reseting
            if ( background.attrs.x < -box_size || background.attrs.x > box_size )
                background.attrs.x = 0;
            if ( background.attrs.y < -box_size || background.attrs.y > box_size )
                background.attrs.y = 0;
        };
    }

    let nextTimeout = false;
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
            hitCities.remove({});
            hitting_cities.forEach((city) => {
                hitCities.insert(city);
            });
            if ( hitting_cities && hitting_cities.length >= 1 )
            startTimer();
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
    function startMovement(e) {
        clicked = true;
        const start = { x: window_size.width/2, y: window_size.height/2 };
        const end = { x: e.layerX, y: e.layerY };
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const angleDeg = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
        Meteor.call('startMovement', angle, angleDeg, (error, result) => {
            position.x = result.x;
            position.y = result.y;
            position.started = result.started;
            position.angle = angle;
            position.angleDeg = angleDeg;
            start_pos = { x: result.x, y: result.y };
            client_start = (new Date()).getTime();
            server_time = TimeSync.serverTime( client_start );
            time_passed = 0;
            insertHitCities();
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
    doc_map.addEventListener("contextmenu", e => {
        e.preventDefault();
        position.angle = false;
        position.angleDeg = false;
        Meteor.call('stopMovement');
        hitCities.remove({});
    });

    let period = 20;
    let anim = new Konva.Animation(function(frame) {
        if ((frame.time % (period * 2)) < period) {
            update(frame);
        } else {
            return false;
        }
    }, stage);
    
    let clicked = false;
    let loadBox;
    time_passed = 0;
    start_pos = { x: position.x, y: position.y };

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
    }
    anim.start();
    loadScreen();
}