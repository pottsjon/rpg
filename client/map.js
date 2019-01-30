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

Template.traveling.helpers({
    cities(){
        return hitCities.find({ distance: { $gt: 0 } },{ sort: { distance: 1 }, limit: 6 });
    },
    time(){
        // formatTimer(this.time);
        return this.time
    }
});

var kbd = {};
var position = { x: 0, y: 0, started: false };
// game size must be larger than the window size
function startGame(found_cities, found_position) {
    let clicked = false;
    let time_passed = 0;
    let time_now = TimeSync.serverTime( (new Date()).getTime() );
    console.log("Start "+time_now)
    let stage = new Konva.Stage({
        container: 'map',
        width: window_size.width,
        height: window_size.height
    });
    position = { x: found_position.x, y: found_position.y, started: found_position.started };
    let start_pos = { x: position.x, y: position.x };
    
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
        if ( city.attrs.x <= window_size.width+(city.attrs.radius*2) ) {
            let clone = city.clone({
                x: city.attrs.x+map_size.width
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x >= map_size.width-window_size.width-(city.attrs.radius*2) ) {
            let clone = city.clone({
                x: city.attrs.x-map_size.width
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.y <= window_size.height+(city.attrs.radius*2) ) {
            let clone = city.clone({
                y: city.attrs.y+map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.y >= map_size.height-window_size.height-(city.attrs.radius*2) ) {
            let clone = city.clone({
                y: city.attrs.y-map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x >= map_size.width-window_size.width-(city.attrs.radius*2) && city.attrs.y >= map_size.height-window_size.height-(city.attrs.radius*2) ) {
            let clone = city.clone({
                x: city.attrs.x-map_size.width,
                y: city.attrs.y-map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x <= window_size.width+(city.attrs.radius*2) && city.attrs.y <= window_size.height+(city.attrs.radius*2) ) {
            let clone = city.clone({
                x: city.attrs.x+map_size.width,
                y: city.attrs.y+map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x >= map_size.width-window_size.width-(city.attrs.radius*2) && city.attrs.y <= window_size.height+(city.attrs.radius*2) ) {
            let clone = city.clone({
                x: city.attrs.x-map_size.width,
                y: city.attrs.y+map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x <= window_size.width+(city.attrs.radius*2) && city.attrs.y >= map_size.height-window_size.height-(city.attrs.radius*2) ) {
            let clone = city.clone({
                x: city.attrs.x+map_size.width,
                y: city.attrs.y-map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
    });

    function update(frame) {
        // at 1, this is 60 points moved per second
        let move_speed = 0.10;

        let find_angle = ( !kbd.angleDeg ? "" : 'A: '+Math.round(kbd.angleDeg)+'°' );
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

        if ( kbd.angle ) {
            time_passed = time_passed+frame.timeDiff;
            const time_int = (time_now-position.started+time_passed)/1000;
			const int_dist = time_int*5;
            const cos = Math.cos(kbd.angle);
            const sin = Math.sin(kbd.angle);
			const position_x = int_dist*cos+start_pos.x;
            const position_y = int_dist*sin+start_pos.y;
            position.x = position_x;
            position.y = position_y;
            cities.move({ x: -cos, y: -sin });
            background.move({ x: -cos, y: -sin });
            /*
            let cos = move_speed * Math.cos(kbd.angle);
            let sin = move_speed * Math.sin(kbd.angle);
            position.x += cos;
            position.y += sin;
            cities.move({ x: -cos, y: -sin })
            background.move({ x: -cos, y: -sin });
            */
        };

        // keep position within the game size
        if ( position.x < 0 ) {
            position.x = map_size.width;
        };
        if ( position.y < 0 ) {
            position.y = map_size.height;
        };
        if ( position.x > map_size.width ) {
            position.x = 0;
        };
        if ( position.y > map_size.height ) {
            position.y = 0;
        };

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
            
        // background boxes only move 50 pixels (their size) in either direction before reseting
        if ( background.attrs.x < -box_size || background.attrs.x > box_size )
            background.attrs.x = 0;
        if ( background.attrs.y < -box_size || background.attrs.y > box_size )
            background.attrs.y = 0;
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
            time_now = TimeSync.serverTime( (new Date()).getTime() );
            console.log("Click "+time_now)
            clicked = true;
            time_passed = 0;
            start_pos = { x: position.x, y: position.y };
            let start_time = TimeSync.serverTime( (new Date()).getTime() );
            const start = { x: window_size.width/2, y: window_size.height/2 };
            const end = { x: e.layerX, y: e.layerY };
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const angleDeg = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
            position.started = start_time;
            kbd.angle = angle;
            kbd.angleDeg = angleDeg;
            Meteor.call('startMovement', angle, angleDeg);
            const cities = findHitCities(position,angle,angleDeg);
            hitCities.remove({});
            cities.forEach((city) => {
                hitCities.insert(city);
            });
            clearClick();
        };
    });
    doc_map.addEventListener("contextmenu", e => {
        e.preventDefault();
        kbd.angle = false;
        kbd.angleDeg = false;
        Meteor.call('stopMovement');
    });

    let period = 20;
    let anim = new Konva.Animation(function(frame) {
        if ((frame.time % (period * 2)) < period) {
            update(frame);
        } else {
            return false;
        }
    }, stage);
    anim.start();
}