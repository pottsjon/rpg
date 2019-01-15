map_size = { width: 3000, height: 3000 };

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
        x: 100,
        y: 100,
        city: 'Setantion',
        visiting: true
    });
};