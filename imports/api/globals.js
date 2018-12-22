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