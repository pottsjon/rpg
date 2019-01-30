var collide = require('line-circle-collision');

map_size = { width: 6000, height: 6000 };

formatTimer = function(secs) {
    "use strict";
    // returns seconds in 00:00:00 (up to 86400 seconds)
    const secMinutes = Math.floor(secs / 60);
    const secHours = Math.floor(secs / 60 / 60);
    const minute = (secMinutes%60)+":";
    const minutes = ("0"+(secMinutes%60)).slice(-2)+":";
    const finalSecs = ( secs >= 10 ? ("0"+(secs%60)).slice(-2) : secs%60 );
    const finalMinutes = ( secHours >= 1 ? minutes : minute );
    const finalHours = ( secHours >= 1 ? secHours%60+":" : "" );
    return finalHours+finalMinutes+finalSecs;
};

itemLevel = function (exp) {
    // 243215879437 exp is the end of level 9999
	for ( let i = 1; 10000000 >= i; i++ ) {
		let level_amount = ((4000*i*(i/1.25))*(-Math.log(4000*i)/Math.log(0.0000000001)));
		if (  exp <= level_amount ) {
			return i
			break;
		};
	}
};

startingCity = function (userId) {
    // let city_list = Cities.find({}).fetch();
    Positions.insert({
        owner: userId,
        x: 1155,
        y: 262,
        city: 'Betionar',
        visiting: true
    });
};

findHitCities = function (position,angle,angleDeg) {
	let hit_cities = [];
	let line_number = 0;
	let find_lines = findNextLines({ x: position.x, y: position.y }, angle, angleDeg);
	find_lines.forEach((line) => {
		Cities.find().fetch().forEach((city) => {
			let circle = [city.x, city.y],
			radius = city.radius,
			a = [line[0].x, line[0].y],
			b = [line[1].x, line[1].y];
			if ( collide(a, b, circle, radius*1) ) {
				let distance = distanceOf({ x: line[0].x, y: line[0].y },{ x: city.x, y: city.y });
				distance = Math.round(line_number*6000+distance)-city.radius;
				hit_cities.push({ name: city.name, distance: distance, time: Math.round(distance/5) });
			};
		});
		line_number++;
	});
	return hit_cities;
}

distanceOf = function (start, end) {
	let a = start.x - end.x;
	let b = start.y - end.y;
	let c = Math.sqrt( a*a + b*b );
	return c;
};

inCircle = function (point, circle, radius) {
    return Math.sqrt(Math.pow(point.x-circle.x, 2)+Math.pow(point.y-circle.y, 2)) < radius;
};

getEquationOfLineFromTwoPoints = function (point1, point2) {
	let lineObj = {
		gradient: (point1.y - point2.y) / (point1.x - point2.x)
	}, parts;
 
	lineObj.yIntercept = point1.y - lineObj.gradient * point1.x;
	lineObj.toString = function() {
		if ( Math.abs(lineObj.gradient) === Infinity ) {
			return 'x = ' + point1.x;
		} else {
			parts = [];
 
			if(lineObj.gradient !== 0) {
				parts.push(lineObj.gradient + 'x');
			}
 
			if(lineObj.yIntercept !== 0) {
				parts.push(lineObj.yIntercept);
			}
 
			return 'y = ' + parts.join(' + ');
		};
	};
 
	return lineObj;
};

findLinePoints = function (start, angle, angleDeg) {
	const x_dir = ( angleDeg <= -90 || angleDeg >= 90 ? "left" : "right" );
	const y_dir = ( angleDeg > 0 ? "down" : "up" );
	const cos = 2 * Math.cos(angle);
	const sin = 2 * Math.sin(angle);
	const line = getEquationOfLineFromTwoPoints({ x: start.x, y: start.y },{ x: start.x+cos, y: start.y+sin });
	const x_end = ( x_dir == "left" ? { x: 0, y: line.yIntercept } : { x: map_size.width, y: line.gradient*map_size.height+line.yIntercept } );
	const y_end = ( y_dir == "up" ? { x: -line.yIntercept/line.gradient, y: 0 } : { x: (map_size.width-line.yIntercept)/line.gradient, y: map_size.height } );
	let closest_end = ( x_end.x < 0 || x_end.x > map_size.width || x_end.y < 0 || x_end.y > map_size.height ? y_end : x_end );
	if ( ( !closest_end.x && closest_end.x != 0 ) || ( !closest_end.y && closest_end.y != 0 ) )
	closest_end = ( angleDeg == -90 ? { x: start.x, y: 0 } : { x: start.x, y: map_size.height } );
	let second_x = {};
	let second_y = {};
	if ( closest_end.x == 0 || closest_end.x == map_size.width ) {
		second_x = ( closest_end.x == 0 ? 6000 : 0 );
		second_y = closest_end.y;
	} else {
		second_x = closest_end.x;
		second_y = ( closest_end.y == 0 ? 6000 : 0 );
	};
	const next_point_start = { x: second_x, y: second_y };
	const points = [ { x: start.x, y: start.y }, closest_end, next_point_start ];
	return points;
}

findNextLines = function (start, angle, angleDeg) {
	let lines = [];
	let count = 0;
	findLine = function (start, angle, angleDeg) {
		count++
		const point = findLinePoints({ x: start.x, y: start.y }, angle, angleDeg);
		lines.push(point);
		if ( count < 10 )
		findLine({ x: point[2].x, y: point[2].y }, angle, angleDeg);
	}
	findLine(start, angle, angleDeg);
	return lines;
}