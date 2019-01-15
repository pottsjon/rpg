windowSize = function () {
	const width = document.getElementById("map").offsetWidth;
	const top = document.getElementById("top").offsetHeight;
	const height = $(window).height()-top;
	return { width: width, height: height };
};

Template.traveling.onRendered(function () {
	Tracker.autorun(function() {
        if ( Meteor.user() ) {
            let found_cities = Cities.find({}).fetch();
            let found_position = Positions.findOne({ owner: Meteor.userId() });
            if ( found_cities && found_position )
            startGame(found_cities, found_position);
            $(window).resize(function() {
            });
        };
	});
});

// game size must be larger than the window size
var kbd = {};
var position = { x: 0, y: 0 };
function startGame(found_cities, found_position) {
    let window_size = windowSize();

    var stage = new Konva.Stage({
        container: 'map',
        width: window_size.width,
        height: window_size.height
    });
    position = { x: found_position.x, y: found_position.y };

    var cities = new Konva.Layer({
        x: 0,
        y: 0,
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
            text: city.name,
            fontSize: 18,
            fill: 'white',
            padding: 5,
        });
        label.add(text);
    });

    var players = new Konva.Layer({
        hitGraphEnabled : false
    });
    stage.add(players);

    /*
    var lines = new Konva.Layer({
        x: 0,
        y: 0
    });
    stage.add(lines);

    let line = new Konva.Line({
        x: 0,
        y: 0,
        points: [0, 0, 0, map_size.height],
        stroke: '#4a4a4a',
        strokeWidth: 1
    });
    lines.add(line);
    line.cache();

	for ( let i = 50; map_size.width >= i; i+=50 ) {
        let clone = line.clone({
            x: i,
            y: 0
        });
        lines.add(clone);
        clone.cache();
        for ( let i = 50; map_size.height >= i; i+=50 ) {
            let clone = line.clone({
                x: 0,
                y: i,
                points: [0, 0, map_size.width, 0],
            });
            lines.add(clone);
            clone.cache();
        }
    }
    */

    var player = new Konva.Circle({
        radius: 10,
        fill: 'green',
        x: window_size.width/2,
        y: window_size.height/2
    });
    players.add(player);
    
    var textX = new Konva.Text({
        text: 'X: '+position.x,
        x: 20,
        y: 10,
        fontSize: 20
    });
    players.add(textX);

    var textY = new Konva.Text({
        text: 'Y: '+position.y,
        x: 20,
        y: 30,
        fontSize: 20
    });
    players.add(textY);

    var textA = new Konva.Text({
        x: 20,
        y: 50,
        fontSize: 20
    });
    players.add(textA);


    // clones the cities on the left, right, top, bottom and corners, within the screen width, then places them on opposing sides.
    const city_list = cities.getChildren();
    city_list.forEach((city) => {
        if ( city.attrs.x <= window_size.width ) {
            let clone = city.clone({
                x: city.attrs.x+map_size.width
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x >= map_size.width-window_size.width ) {
            let clone = city.clone({
                x: city.attrs.x-map_size.width
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.y <= window_size.height ) {
            let clone = city.clone({
                y: city.attrs.y+map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.y >= map_size.height-window_size.height ) {
            let clone = city.clone({
                y: city.attrs.y-map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x >= map_size.width-window_size.width && city.attrs.y >= map_size.height-window_size.height ) {
            let clone = city.clone({
                x: city.attrs.x-map_size.width,
                y: city.attrs.y-map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x <= window_size.width && city.attrs.y <= window_size.height ) {
            let clone = city.clone({
                x: city.attrs.x+map_size.width,
                y: city.attrs.y+map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x >= map_size.width-window_size.width && city.attrs.y <= window_size.height ) {
            let clone = city.clone({
                x: city.attrs.x-map_size.width,
                y: city.attrs.y+map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        if ( city.attrs.x <= window_size.width && city.attrs.y >= map_size.height-window_size.height ) {
            let clone = city.clone({
                x: city.attrs.x+map_size.width,
                y: city.attrs.y-map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        /*
        if ( ( city.attrs.x <= window_size.width || city.attrs.x >= map_size.width-window_size.width  ) && ( city.attrs.y <= window_size.height || city.attrs.y >= map_size.height-window_size.height  ) ) {
            let clone = city.clone({
                x: city.attrs.x-map_size.width,
                y: city.attrs.y-map_size.height
            });
            cities.add(clone);
            clone.cache();
        };
        */
    });

    /*
    const line_list = lines.getChildren();
    line_list.forEach((line) => {
        if ( line.attrs.x <= window_size.width || line.attrs.x >= map_size.width-window_size.width  ) {
            let clone = line.clone({
                x: line.attrs.x-map_size.width
            });
            lines.add(clone);
            clone.cache();
        };
        if ( line.attrs.y <= window_size.height || line.attrs.y >= map_size.height-window_size.height  ) {
            let clone = line.clone({
                y: line.attrs.y-map_size.height
            });
            lines.add(clone);
            clone.cache();
        };
        if ( ( line.attrs.x <= window_size.width || line.attrs.x >= map_size.width-window_size.width  ) && ( line.attrs.y <= window_size.height || line.attrs.y >= map_size.height-window_size.height  ) ) {
            let clone = line.clone({
                x: line.attrs.x-map_size.width,
                y: line.attrs.y-map_size.height
            });
            lines.add(clone);
            clone.cache();
        };
    });
    */

    function update(cities, frame) {
        let find_angle = ( !kbd.angleDeg ? "" : 'A: '+Math.round(kbd.angleDeg)+'°' );
        textX.text('X: '+Math.round(position.x));
        textY.text('Y: '+Math.round(position.y));
        textA.text(find_angle);

        let top = -cities.attrs.y-window_size.height-1000;
        let bottom = -cities.attrs.y+window_size.height+1000;
        let left = -cities.attrs.x-window_size.width-1000;
        let right = -cities.attrs.x+window_size.width+1000;
        // console.log(top+" "+bottom+" "+left+" "+right);
        // only shows cities within viewport
        const city_list = cities.getChildren();
        for(let n = 0; n < city_list.length; n++) {
            const city = city_list[n];
            let checkTop = top <= city.attrs.y;
            let checkBottom = bottom >= city.attrs.y;
            let checkLeft = left <= city.attrs.x;
            let checkRight = right >= city.attrs.x;
            if ( checkLeft && checkRight && checkTop && checkBottom ) {
                city.show();
            } else {
                // console.log('hide '+city.attrs.x+" "+city.attrs.y)
                city.hide();
            };
        }

        /*
        const line_list = lines.getChildren();
        for(let n = 0; n < line_list.length; n++) {
            const line = line_list[n];
            let left = line.attrs.x >= position.x-window_size.width;
            let right = line.attrs.x <= position.x+window_size.width;
            let top = line.attrs.y >= position.x-window_size.width;
            let bottom = line.attrs.y <= position.x+window_size.width;
            if ( left && right && top && bottom ) {
                line.show();
            } else {
                line.hide();
            };
        }
        */

        // move with arrow keys
        var move_speed = 1;
        if ( kbd ) {
            if ( kbd.l ) {
                position.x += move_speed;
                cities.move({ x: -move_speed })
            };
            if ( kbd.r ) {
                position.x -= move_speed;
                cities.move({ x: move_speed })
            };
            if ( kbd.u ) {
                position.y += move_speed;
                cities.move({ y: -move_speed })
            };
            if ( kbd.d ) {
                position.y -= move_speed;
                cities.move({ y: move_speed })
            };
            if ( kbd.angle ) {
                let sin = move_speed * Math.sin(kbd.angle);
                let cos = move_speed * Math.cos(kbd.angle);
                position.x += cos;
                position.y += sin;
                cities.move({ x: -cos, y: -sin })
            };
        }

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
        if ( cities.attrs.x > window_size.width ) {
            cities.attrs.x = -map_size.width+window_size.width;
        };
        if ( cities.attrs.x < -map_size.width+window_size.width ) {
            cities.attrs.x = window_size.width;
        };
        if ( cities.attrs.y > window_size.height ) {
            cities.attrs.y = -map_size.height+window_size.height;
        };
        if ( cities.attrs.y < -map_size.height+window_size.height ) {
            cities.attrs.y = window_size.height;
        };
    }

    document.addEventListener("keydown", e => {
        if (e.keyCode === 37) {
        anim.start();
        kbd.r = true;
        e.preventDefault();
      } else if (e.keyCode === 38) {
        anim.start();
        kbd.d = true;
        e.preventDefault();
      } else if (e.keyCode === 39) {
        anim.start();
        kbd.l = true;
        e.preventDefault();
      } else if (e.keyCode === 40) {
        anim.start();
        kbd.u = true;
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", e => {
        if (e.keyCode === 37) {
        kbd.r = false;
        e.preventDefault();
      } else if (e.keyCode === 38) {
        kbd.d = false;
        e.preventDefault();
      } else if (e.keyCode === 39) {
        kbd.l = false;
        e.preventDefault();
      } else if (e.keyCode === 40) {
        kbd.u = false;
        e.preventDefault();
      }
    });

    let doc_map = document.getElementById('map');
    doc_map.addEventListener("click", e => {
        const start = { x: window_size.width/2, y: window_size.height/2 };
        const end = { x: e.layerX, y: e.layerY };
        kbd.angle = Math.atan2(end.y - start.y, end.x - start.x);
        kbd.angleDeg = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    });
    doc_map.addEventListener("contextmenu", e => {
        e.preventDefault();
        kbd.angle = false;
        kbd.angleDeg = false;
    });

    var anim = new Konva.Animation(function(frame) {
        update(cities, frame);
    }, stage);
    
    anim.start();
}