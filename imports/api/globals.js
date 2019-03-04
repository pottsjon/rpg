var collide = require('line-circle-collision');

map_size = { width: 4000, height: 4000 };

formatTimer = function(secs) {
    "use strict";
    // returns seconds in 00:00:00 (up to 86400 seconds)
    const secMinutes = Math.floor(secs / 60);
    const secHours = Math.floor(secs / 60 / 60);
    const minute = (secMinutes%60)+":";
    const minutes = ("0"+(secMinutes%60)).slice(-2)+":";
    const finalSecs = ( secMinutes >= 1 || secs < 10 ? ("0"+(secs%60)).slice(-2) : secs%60 );
    const finalMinutes = ( secHours >= 1 || minutes >= 10 ? minutes : minute );
	const finalHours = ( secHours >= 1 ? secHours%60+":" : "" );
	if ( secs >= 0 )
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

realPosition = function (start_pos) {
	// const int_dist = ( !start_pos.started ? 0 : ((server_time-start_pos.started+(new Date()).getTime()-client_start)/1000)*5 ),
	const time_now = ( Meteor.isServer ? (new Date()).getTime() : TimeSync.serverTime( (new Date()).getTime() )+TimeSync.roundTripTime() );
	const int_dist = ( !start_pos.started ? 1 : ((time_now-start_pos.started)/1000)*5 ),
	cos = ( !start_pos.angle ? 1 : Math.cos(start_pos.angle) ),
	sin = ( !start_pos.angle ? 1 : Math.sin(start_pos.angle) );
	return {
		x: fixEdge(int_dist*cos+start_pos.x, map_size.width),
		y: fixEdge(int_dist*sin+start_pos.y, map_size.height),
		cos: cos,
		sin: sin
	};
};

fixEdge = function (point,size) {
	return point-(Math.floor(point/size)*size);
};

findNextLines = function (start, angle, angleDeg) {
	let lines = [];
	let count = 0;
	findLine = function (start, angle, angleDeg) {
		count++
		const point = findLinePoints(start, angle, angleDeg);
		lines.push(point);
		/*
		if ( count < 5 )
		findLine({ x: point[2].x, y: point[2].y }, angle, angleDeg);
		*/
	}
	findLine(start, angle, angleDeg);
	return lines;
};

findHitCities = function (start_pos, position) {
	let hit_cities = [], offset = 0, time_now = (new Date()).getTime();
	startFindingHits = function (start_pos, position, next_line) {
		const line_start = ( !next_line ? { x: position.x, y: position.y } : { x: next_line.x, y: next_line.y } );
		const find_lines = findNextLines(line_start, start_pos.angle, start_pos.angleDeg);
		find_lines.forEach((line) => {
			let a = [line[0].x, line[0].y],
			b = [line[1].x, line[1].y];
			Cities.find().fetch().forEach((city) => {
				let distance,
				int1_distance,
				int2_distance;
				const circle = [city.x, city.y],
				radius = city.radius,
				intersect = getIntersections(a, b, [city.x, city.y, city.radius]),
				inside = inCircle({ x: position.x, y: position.y },{ x: city.x, y: city.y }, city.radius);			
				if ( collide( a, b, circle, radius*1 ) && !inside ) {
					if ( intersect.int1 && intersect.int2 ) {
						int1_distance = distanceOf(a, intersect.int1.coords );
						int2_distance = distanceOf(a, intersect.int2.coords );
						distance = ( int1_distance < int2_distance ? int1_distance : int2_distance );
					} else if ( intersect.int1 ) {
						distance = distanceOf(a, intersect.int1.coords );
					} else if ( intersect.int2 ) {
						distance = distanceOf(a, intersect.int2.coords );
					};
					let real_dist = distance+offset;
					city.distance = real_dist;
					city.time = Math.round(real_dist/5.0045);
					city.started = time_now
					if ( real_dist > 0 )
					hit_cities.push(city);
				};
			});
			offset = offset+distanceOf(a,b);
			if ( hit_cities.length < 5 ) {
				startFindingHits(start_pos, position, { x: line[2].x, y: line[2].y });
			} else {
				return hit_cities;
			};
		});
	};
	startFindingHits(start_pos, position);
	return hit_cities;
};

distanceOf = function (start, end) {
	let a, b, c;
	a = start[0] - end[0];
	b = start[1] - end[1];
	c = Math.sqrt( a*a + b*b );
	return c;
};

getIntersections = function (a, b, c) {
	// Calculate the euclidean distance between a & b
	eDistAtoB = Math.sqrt( Math.pow(a[0]-b[0], 2) + Math.pow(a[1]-b[1], 2) );

	// compute the direction vector d from a to b
	d = [ (b[0]-a[0])/eDistAtoB, (b[1]-a[1])/eDistAtoB ];

	// Now the line equation is x = dx*t + ax, y = dy*t + ay with 0 <= t <= 1.

	// compute the value t of the closest point to the circle center (cx, cy)
	t = (d[0] * (c[0]-a[0])) + (d[1] * (c[1]-a[1]));

	// compute the coordinates of the point e on line and closest to c
    let e = {coords:[]};
	e.coords[0] = (t * d[0]) + a[0];
	e.coords[1] = (t * d[1]) + a[1];

	// Calculate the euclidean distance between c & e
	eDistCtoE = Math.sqrt( Math.pow(e.coords[0]-c[0], 2) + Math.pow(e.coords[1]-c[1], 2) );

	// test if the line intersects the circle
	if( eDistCtoE < c[2] ) {
		// compute distance from t to circle intersection point
	    dt = Math.sqrt( Math.pow(c[2], 2) - Math.pow(eDistCtoE, 2));

	    // compute first intersection point
	    let f = {coords:[]};
	    f.coords[0] = ((t-dt) * d[0]) + a[0];
	    f.coords[1] = ((t-dt) * d[1]) + a[1];

	    // compute second intersection point
	    let g = {coords:[]};
	    g.coords[0] = ((t+dt) * d[0]) + a[0];
	    g.coords[1] = ((t+dt) * d[1]) + a[1];

		return {int1:f, int2:g};

	} else {
		return false;
	}
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
	const cos = 2 * Math.cos(angle);
	const sin = 2 * Math.sin(angle);
	const line = getEquationOfLineFromTwoPoints({ x: start.x, y: start.y },{ x: start.x+cos, y: start.y+sin });
	const x_end = ( angleDeg <= -90 || angleDeg >= 90 ? { x: 0, y: line.yIntercept } : { x: map_size.width, y: line.gradient*map_size.height+line.yIntercept } );
	const y_end = ( angleDeg > 0 ? { x: (map_size.width-line.yIntercept)/line.gradient, y: map_size.height } : { x: -line.yIntercept/line.gradient, y: 0 } );
	let closest_end = ( x_end.x < 0 || x_end.x > map_size.width || x_end.y < 0 || x_end.y > map_size.height ? y_end : x_end );
	if ( ( !closest_end.x && closest_end.x != 0 ) || ( !closest_end.y && closest_end.y != 0 ) )
	closest_end = ( angleDeg == -90 ? { x: start.x, y: 0 } : { x: start.x, y: map_size.height } );
	let second_x = {};
	let second_y = {};
	if ( closest_end.x == 0 || closest_end.x == map_size.width ) {
		second_x = ( closest_end.x == 0 ? map_size.width : 0 );
		second_y = closest_end.y;
	} else {
		second_x = closest_end.x;
		second_y = ( closest_end.y == 0 ? map_size.height : 0 );
	};
	const next_point_start = { x: second_x, y: second_y };
	const points = [ { x: start.x, y: start.y }, closest_end, next_point_start ];
	return points;
};