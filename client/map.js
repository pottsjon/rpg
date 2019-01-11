windowSize = function () {
	const width = document.getElementById("map").offsetWidth;
	const top = document.getElementById("top").offsetHeight;
	const height = $(window).height()-top;
	return { width: width, height: height };
};

var kbd = {};
var position = { x: 0, y: 0 };
function startGame() {
    let window_size = windowSize();

    var stage = new Konva.Stage({
        container: 'map',
        width: window_size.width,
        height: window_size.height
    });
    position = { x: window_size.width/2, y: window_size.height/2 };

    var cities = new Konva.Layer();
    stage.add(cities);

    var players = new Konva.Layer();
    stage.add(players);
    
    var city1 = new Konva.Circle({
        radius: 100,
        fill: 'red',
        x: 100,
        y: 100
    });
    cities.add(city1);

    var city2 = new Konva.Circle({
        radius: 50,
        fill: 'red',
        x: 1900,
        y: 100
    });
    cities.add(city2);

    var player = new Konva.Circle({
        radius: 10,
        fill: 'green',
        x: window_size.width/2,
        y: window_size.height/2
    });
    players.add(player);
    
    var textNode = new Konva.Text({
        text: 'X: '+position.x+" "+'Y: '+position.y,
        x: 20,
        y: 10,
        fontSize: 20,
    });

    players.add(textNode);

    function update(cities, frame) {
        const city_list = cities.getChildren();
        for(let n = 0; n < city_list.length; n++) {
            const city = city_list[n];
            let top = position.y-city.attrs.radius-(window_size.height/2);
            let bottom = position.y+city.attrs.radius+(window_size.height/2);
            let left = position.x-city.attrs.radius-(window_size.width/2);
            let right = position.x+city.attrs.radius+(window_size.width/2);
            let inBottom = city.attrs.y <= bottom;
            let inTop = city.attrs.y >= top;
            let inLeft = city.attrs.x >= left;
            let inRight = city.attrs.x <= right;
            let fixLeft = right > 2000 && city.attrs.x >= left-2000;
            inLeft = ( fixLeft ? true : inLeft );
            let fixRight = right > 2000 && city.attrs.x <= right-2000;
            inRight = ( fixRight ? true : inRight );
            let fixBottom = bottom > 2000 && city.attrs.y >= top-2000;
            inBottom = ( fixBottom ? true : inBottom );
            let fixTop = bottom > 2000 && city.attrs.y <= bottom-2000;
            inTop = ( fixTop ? true : inTop );
            /*
            inLeft = ( left < 0 && city.attrs.x >= left+2000 ? true : inLeft );
            inRight = ( left < 0 && city.attrs.x <= right+2000 ? true : inRight );
            inBottom = ( top < 0 && city.attrs.y >= top+2000 ? true : inBottom );
            inTop = ( top < 0 && city.attrs.y <= bottom+2000 ? true : inTop );
            */
            if ( inBottom && inTop && inLeft && inRight ) {
                city.show();
            } else {
                city.hide();
            };
        }
        if ( kbd ) {
            if ( kbd.l ) {
                position.x += 2;
                cities.move({ x: -2 })
            };
            if ( kbd.r ) {
                position.x -= 2;
                cities.move({ x: 2 })
            };
            if ( kbd.u ) {
                position.y += 2;
                cities.move({ y: -2 })
            };
            if ( kbd.d ) {
                position.y -= 2;
                cities.move({ y: 2 })
            };
        }
        textNode.text('X: '+position.x+" "+'Y: '+position.y);
        if ( position.x < 0 ) {
            position.x = 2000;
        };
        if ( position.y < 0 ) {
            position.y = 2000;
        };
        if ( position.x > 2000 ) {
            position.x = 0;
        };
        if ( position.y > 2000 ) {
            position.y = 0;
        };
    }

    var anim = new Konva.Animation(function(frame) {
        update(cities, frame);
    }, stage);

    document.addEventListener("keydown", e => {
        if (e.keyCode === 37) {
        kbd.l = true;
        e.preventDefault();
      }
        else if (e.keyCode === 38) {
        kbd.u = true;
        e.preventDefault();
      }
        else if (e.keyCode === 39) {
        kbd.r = true;
        e.preventDefault();
      }
        else if (e.keyCode === 40) {
        kbd.d = true;
        e.preventDefault();
      }
    });
    
    document.addEventListener("keyup", e => {
        if (e.keyCode === 37) {
        kbd.l = false;
        e.preventDefault();
      }
        else if (e.keyCode === 38) {
        kbd.u = false;
        e.preventDefault();
      }
        else if (e.keyCode === 39) {
        kbd.r = false;
        e.preventDefault();
      }
        else if (e.keyCode === 40) {
        kbd.d = false;
        e.preventDefault();
      }
    });
    
    anim.start();
}

Template.traveling.onRendered(function () {
	Tracker.autorun(function() {
	  $(window).resize(function() {
	  });
	});
	startGame();
});