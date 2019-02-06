windowSize = function () {
	const width = document.getElementById("map").offsetWidth;
	const top = document.getElementById("top").offsetHeight;
	const height = $(window).height()-top;
	return { width: width, height: height };
};

let gameStarted = false;
Template.traveling.onRendered(function () {
	Tracker.autorun(function() {
        if ( Meteor.user() ) {
            window_size = windowSize();
            let found_cities = Cities.find({}).fetch();
            let found_position = Positions.findOne({ owner: Meteor.userId() });
            if ( found_cities && found_position && !gameStarted ) {
                gameStarted = true;
                startGame(found_cities, found_position);
            };
            $(window).resize(function() {
                window_size = windowSize();
            });
        };
	});
});

Template.traveling.onDestroyed(function () {
    gameStarted = false;
});

Template.traveling.helpers({
    cities(){
        return hitCities.find({ time: { $gt: 0 } },{ sort: { distance: 1 }, limit: 10 });
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

var position = { x: 0, y: 0, started: false, angle: false };
// game size must be larger than the window size
function startGame(found_cities, found_position) {
    let clicked = false;
    let time_passed = 0;
    let client_start = (new Date()).getTime();
    let server_time = TimeSync.serverTime( client_start );

    position = found_position;
    let start_pos = { x: position.x, y: position.y };
    
    let stage = new Konva.Stage({
        container: 'map',
        width: window_size.width,
        height: window_size.height
    });
    
    let box_group = new Konva.Group();

    let box_size = 200;

    let box = new Konva.Rect({
        width: box_size,
        height: box_size,
        fill: '#885530',
        stroke: '#8e5c37',
        strokeWidth: 4
    });

    for ( let i = 0; box_size*2 >= i; i+=box_size ) {
        for ( let o = 0; box_size*2 >= o; o+=box_size ) {
            let box_clone = box.clone({
                x: i,
                y: o
            });
            box_group.add(box_clone);
        }
    }
    box_group.cache();

    var background = new Konva.Layer();

    function drawBoxes() {
        stage.add(background);
        background.moveToBottom();
        for ( let i = -(box_size*2); window_size.width+(box_size*2) >= i; i+=(box_size*3) ) {
            for ( let o = -(box_size*2); window_size.height+(box_size*2) >= o; o+=(box_size*3) ) {
                let box_clone = box_group.clone({
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
    
    var cities = new Konva.Layer({
        x: -found_position.x+(window_size.width/2),
        y: -found_position.y+(window_size.height/2),
        hitGraphEnabled : false
    });
    stage.add(cities);

    found_cities.forEach((city) => {
        let city_group = new Konva.Group({
            x: city.x,
            y: city.y,
            radius: city.radius
        });
        cities.add(city_group);

        let circle = new Konva.Circle({
            radius: city.radius,
            fill: 'red',
            name: city.name
        });
        city_group.add(circle);
        circle.cache();
    
        let label = new Konva.Label();
        city_group.add(label);

        let tag = new Konva.Tag({
          fill: '#111',
          lineJoin: 'round',
          pointerDirection: 'down',
          pointerWidth: 5,
          pointerHeight: 5,
          cornerRadius: 5
        });
        label.add(tag);

        let text = new Konva.Text({
            text: city.name+" ["+city.x+","+city.y+"]",
            fontSize: 18,
            fill: 'white',
            padding: 5,
        });
        label.add(text);
        city_group.cache();
    });

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
        text: 'X: '+position.x,
        x: 20,
        y: 10,
        fontSize: 20
    });
    players.add(textX);

    let textY = new Konva.Text({
        text: 'Y: '+position.y,
        x: 20,
        y: 30,
        fontSize: 20
    });
    players.add(textY);

    let textA = new Konva.Text({
        x: 20,
        y: 50,
        fontSize: 20
    });
    players.add(textA);

    // clones the cities on the left, right, top, bottom and corners, within the screen width, then places them on opposing sides.
    const city_list = cities.getChildren();
    city_list.forEach((city) => {
        let radius = city.attrs.radius*2;
        let cityX = city.attrs.x;
        let cityY = city.attrs.y;
        let winW = window_size.width;
        let winH = window_size.height;
        let mapW = map_size.width;
        let mapH = map_size.height;
        let clone = false;
        
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
        if ( cityX <= winW+radius ) {
            clone = city.clone({ x: cityX+mapW });
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

    function movement(time_passed) {
        time_passed = ( !time_passed ? 0 : time_passed );
        const time_int = (server_time-position.started+time_passed)/1000;
        const int_dist = time_int*5;
        const cos = Math.cos(position.angle);
        const sin = Math.sin(position.angle);
        const position_x = int_dist*cos+start_pos.x;
        const position_y = int_dist*sin+start_pos.y;
        position.x = fixEdge(position_x, map_size.width);
        position.y = fixEdge(position_y, map_size.height);
        cities.setAttrs({ x: -position.x+(window_size.width/2), y: -position.y+(window_size.height/2) });
        background.move({ x: -cos/5, y: -sin/5 });
    }

    function update(frame) {
        let find_angle = ( !position.angleDeg ? "" : 'A: '+Math.round(position.angleDeg)+'°' );
        textX.text('X: '+Math.round(position.x));
        textY.text('Y: '+Math.round(position.y));
        textA.text(find_angle);

        let top = -cities.attrs.y-window_size.height-500;
        let bottom = -cities.attrs.y+window_size.height+500;
        let left = -cities.attrs.x-window_size.width-500;
        let right = -cities.attrs.x+window_size.width+500;

        // only shows cities within viewport
        const city_list = cities.getChildren();
        for( let n = 0; n < city_list.length; n++ ) {
            const city = city_list[n];
            let checkTop = top <= city.attrs.y;
            let checkBottom = bottom >= city.attrs.y;
            let checkLeft = left <= city.attrs.x;
            let checkRight = right >= city.attrs.x;
            if ( checkLeft && checkRight && checkTop && checkBottom ) {
                city.show();
            } else {
                if ( city.attrs.name )
                city.hide();
            };
        }

        if ( position.angle ) {
            time_passed = (new Date()).getTime()-client_start;
            movement(time_passed);
        };

        /*
        // keep position within the game size
        if ( position.x < 0 )
            position.x = map_size.width;
        if ( position.y < 0 )
            position.y = map_size.height;
        if ( position.x > map_size.width )
            position.x = 0;
        if ( position.y > map_size.height )
            position.y = 0;

        // important piece, this adjusts the cities layer which holds each city
        // this creates the infinite wrap around, using your window size to create a faux area
        // when you reach your window size away from the normal map, it adjusts to the other end of the map
        if ( cities.attrs.x > window_size.width )
            cities.attrs.x = -map_size.width+window_size.width;
        if ( cities.attrs.x < -map_size.width+window_size.width )
            cities.attrs.x = window_size.width;
        if ( cities.attrs.y > window_size.height )
            cities.attrs.y = -map_size.height+window_size.height;
        if ( cities.attrs.y < -map_size.height+window_size.height )
            cities.attrs.y = window_size.height;
        */

        // background boxes only move 50 pixels (their size) in either direction before reseting
        if ( background.attrs.x < -box_size || background.attrs.x > box_size )
            background.attrs.x = 0;
        if ( background.attrs.y < -box_size || background.attrs.y > box_size )
            background.attrs.y = 0;
    }

    let nextTimeout = false;
    function startTimer() {
        try { Meteor.clearTimeout(nextTimeout) } catch(e) {};
        let find_city = hitCities.findOne({ time: { $gt: 0 } },{ fields: { time: 1, name: 1 }, sort: { distance: 1 } });
        console.log(find_city)
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

    function setAttrs() {
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
            setAttrs();
        }, 500);
    }
    window.addEventListener('resize', fixWindowSize);

    let doc_map = document.getElementById('map');
    function clearClick() {
        Meteor.setTimeout(function(){
            clicked = false;
        }, 1000);
    }
    doc_map.addEventListener("click", e => {
        if ( !clicked ) {
            clicked = true;
            const start = { x: window_size.width/2, y: window_size.height/2 };
            const end = { x: e.layerX, y: e.layerY };
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const angleDeg = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
            let timing = (new Date()).getTime()-client_start;
            let dis = distanceOf({ x: start_pos.x, y: start_pos.y },{ x: position.x, y: position.y });
            console.log(dis/timing/1000)
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
        };
    });
    doc_map.addEventListener("contextmenu", e => {
        e.preventDefault();
        position.angle = false;
        position.angleDeg = false;
        Meteor.call('stopMovement');
        hitCities.remove({});
        let timing = (new Date()).getTime()-client_start;
        let dis = distanceOf({ x: start_pos.x, y: start_pos.y },{ x: position.x, y: position.y });
        console.log(dis/timing/1000)
    });

    let period = 10;
    let anim = new Konva.Animation(function(frame) {
        if ((frame.time % (period * 2)) < period) {
            update(frame);
        } else {
            return false;
        }
    }, stage);
    movement();
    insertHitCities();
    anim.start();    
}